"""Stick figure body definition + joint physics using pymunk.

Creature anatomy:
  - 1 torso (rectangle)
  - 4 limbs (2 legs, 2 arms), each with upper + lower segments
  - 2 feet (wide flat boxes for ground stability)
  - 6 motorized joints: hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
  - 2 passive ankle joints (DampedRotarySpring): ankle_L, ankle_R
  - 2 spring elbow joints (DampedRotarySpring): elbow_L, elbow_R
  - Total motorized genes: 6 joints x 3 params = 18 (direct) or 9 (indirect)
"""

import math
import pymunk


# Collision group — all creature parts share the same group so they don't
# collide with each other, but DO collide with terrain (group 0).
CREATURE_GROUP = 1
CREATURE_FILTER = pymunk.ShapeFilter(group=CREATURE_GROUP)

# Collision type for terrain contact detection
TERRAIN_COLLISION_TYPE = 1
CREATURE_COLLISION_TYPE = 2

# Joint ordering (matches gene layout for direct encoding)
JOINT_NAMES = ["hip_L", "hip_R", "knee_L", "knee_R", "shoulder_L", "shoulder_R"]


def _make_segment_body(space, pos, length, angle, mass, width=4):
    """Create a single limb segment as a pymunk body + shape.

    The segment is modeled as a thin rectangle (poly shape).
    The body's position is at the center of the segment.
    """
    moment = pymunk.moment_for_box(mass, (width, length))
    body = pymunk.Body(mass, moment)
    body.position = pos
    body.angle = angle

    half_l = length / 2
    half_w = width / 2
    vertices = [
        (-half_w, -half_l),
        (half_w, -half_l),
        (half_w, half_l),
        (-half_w, half_l),
    ]
    shape = pymunk.Poly(body, vertices)
    shape.friction = 1.5   # high friction for ground grip
    shape.elasticity = 0.05
    shape.filter = CREATURE_FILTER
    shape.collision_type = CREATURE_COLLISION_TYPE

    space.add(body, shape)
    return body


def _make_torso(space, pos, width, height, mass=5.0):
    """Create the central torso body."""
    moment = pymunk.moment_for_box(mass, (width, height))
    body = pymunk.Body(mass, moment)
    body.position = pos

    half_w = width / 2
    half_h = height / 2
    vertices = [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h),
    ]
    shape = pymunk.Poly(body, vertices)
    shape.friction = 0.8
    shape.elasticity = 0.1
    shape.filter = CREATURE_FILTER
    shape.collision_type = CREATURE_COLLISION_TYPE

    space.add(body, shape)
    return body


def _add_motorized_joint(space, body_a, body_b, anchor_a, anchor_b,
                         min_angle=-math.pi / 2, max_angle=math.pi / 2):
    """Add a pivot joint + rotary limit between two bodies.

    Returns the pivot joint (used for motor control later).
    """
    pivot = pymunk.PivotJoint(body_a, body_b, anchor_a, anchor_b)
    pivot.collide_bodies = False

    limit = pymunk.RotaryLimitJoint(body_a, body_b, min_angle, max_angle)
    limit.collide_bodies = False

    motor = pymunk.SimpleMotor(body_a, body_b, 0.0)
    motor.collide_bodies = False
    motor.max_force = 300000  # strong for stable joint control under load

    space.add(pivot, limit, motor)
    return motor


def _add_spring_elbow(space, body_a, body_b, anchor_a, anchor_b, config):
    """Add a passive spring elbow joint (DampedRotarySpring)."""
    pivot = pymunk.PivotJoint(body_a, body_b, anchor_a, anchor_b)
    pivot.collide_bodies = False

    spring = pymunk.DampedRotarySpring(
        body_a, body_b,
        rest_angle=config["elbow_rest_angle"],
        stiffness=config["elbow_stiffness"],
        damping=config["elbow_damping"],
    )
    spring.collide_bodies = False

    limit = pymunk.RotaryLimitJoint(body_a, body_b, -math.pi / 3, math.pi / 3)
    limit.collide_bodies = False

    space.add(pivot, spring, limit)


def _make_foot(space, pos, width, height, mass=0.5):
    """Create a foot body — wide flat box for ground contact stability.

    Feet provide the creature with a broad base of support,
    preventing immediate toppling on landing.
    """
    moment = pymunk.moment_for_box(mass, (width, height))
    body = pymunk.Body(mass, moment)
    body.position = pos

    half_w = width / 2
    half_h = height / 2
    vertices = [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h),
    ]
    shape = pymunk.Poly(body, vertices)
    shape.friction = 2.0      # extra grip for ground contact
    shape.elasticity = 0.02   # minimal bounce on landing
    shape.filter = CREATURE_FILTER
    shape.collision_type = CREATURE_COLLISION_TYPE

    space.add(body, shape)
    return body


def _add_ankle_joint(space, lower_leg, foot, ll, foot_h):
    """Add passive ankle: pivot + spring (keeps foot flat) + rotation limit."""
    pivot = pymunk.PivotJoint(
        lower_leg, foot,
        (0, -ll / 2),       # bottom of lower leg
        (0, foot_h / 2))    # top of foot
    pivot.collide_bodies = False

    spring = pymunk.DampedRotarySpring(
        lower_leg, foot,
        rest_angle=0.0,
        stiffness=3000,
        damping=50,
    )
    spring.collide_bodies = False

    limit = pymunk.RotaryLimitJoint(lower_leg, foot, -math.pi / 6, math.pi / 6)
    limit.collide_bodies = False

    space.add(pivot, spring, limit)


def _wrap_angle(angle):
    """Wrap angle to [-pi, pi] for correct PD controller behaviour."""
    return (angle + math.pi) % (2 * math.pi) - math.pi


class Creature:
    """A stick-figure creature in the pymunk physics world."""

    def __init__(self, space, joint_params=None, config=None, spawn_x=100):
        """Build the creature in the given pymunk space.

        Args:
            space: pymunk.Space to add bodies to.
            joint_params: list of 6 tuples (amplitude, frequency, phase)
                          ordered by JOINT_NAMES.  Can be None for v2
                          controllers (CPG/CPG+NN) that use set_motor_targets().
            config: dict with creature dimension / physics params.
            spawn_x: horizontal spawn position.
        """
        self.space = space
        self.joint_params = joint_params  # [(amp, freq, phase), ...] x6 or None
        self.config = config
        self.motors = []   # 6 SimpleMotor references
        self.bodies = []   # all Body references for velocity clamping
        self.elbow_pairs = []  # [(upper_arm, lower_arm), ...] for angle tracking

        tw = config["torso_width"]
        th = config["torso_height"]
        ul = config["upper_limb_length"]
        ll = config["lower_limb_length"]
        ground_h = config["ground_base_height"]
        foot_w = config.get("foot_width", 20)
        foot_h = config.get("foot_height", 5)

        # Spawn height: ground + foot + leg length + torso half + margin
        spawn_y = ground_h + foot_h + ll + ul + th / 2 + config["spawn_margin"]

        # --- Torso ---
        self.torso = _make_torso(space, (spawn_x, spawn_y), tw, th)
        self.bodies.append(self.torso)

        # Attachment points on the torso (in torso-local coordinates)
        hip_l_anchor = (-tw / 4, -th / 2)    # bottom-left area
        hip_r_anchor = (tw / 4, -th / 2)     # bottom-right area
        shoulder_l_anchor = (-tw / 3, th / 2)  # top-left area
        shoulder_r_anchor = (tw / 3, th / 2)   # top-right area

        # --- Left Leg ---
        upper_leg_l_pos = (spawn_x - tw / 4, spawn_y - th / 2 - ul / 2)
        self.upper_leg_l = _make_segment_body(
            space, upper_leg_l_pos, ul, 0, mass=1.5)
        self.bodies.append(self.upper_leg_l)

        lower_leg_l_pos = (spawn_x - tw / 4, spawn_y - th / 2 - ul - ll / 2)
        self.lower_leg_l = _make_segment_body(
            space, lower_leg_l_pos, ll, 0, mass=1.0)
        self.bodies.append(self.lower_leg_l)

        # Hip_L motor (torso -> upper_leg_l) — moderate range for walking
        motor_hip_l = _add_motorized_joint(
            space, self.torso, self.upper_leg_l,
            hip_l_anchor, (0, ul / 2),
            min_angle=-math.pi / 3, max_angle=math.pi / 3)
        self.motors.append(motor_hip_l)

        # Knee_L motor — restricted to prevent leg collapse under load
        motor_knee_l = _add_motorized_joint(
            space, self.upper_leg_l, self.lower_leg_l,
            (0, -ul / 2), (0, ll / 2),
            min_angle=-math.pi / 6, max_angle=math.pi / 3)
        self.motors.append(motor_knee_l)

        # Foot_L (passive — wide base for ground contact stability)
        foot_l_pos = (spawn_x - tw / 4, spawn_y - th / 2 - ul - ll - foot_h / 2)
        self.foot_l = _make_foot(space, foot_l_pos, foot_w, foot_h)
        self.bodies.append(self.foot_l)
        _add_ankle_joint(space, self.lower_leg_l, self.foot_l, ll, foot_h)

        # --- Right Leg ---
        upper_leg_r_pos = (spawn_x + tw / 4, spawn_y - th / 2 - ul / 2)
        self.upper_leg_r = _make_segment_body(
            space, upper_leg_r_pos, ul, 0, mass=1.5)
        self.bodies.append(self.upper_leg_r)

        lower_leg_r_pos = (spawn_x + tw / 4, spawn_y - th / 2 - ul - ll / 2)
        self.lower_leg_r = _make_segment_body(
            space, lower_leg_r_pos, ll, 0, mass=1.0)
        self.bodies.append(self.lower_leg_r)

        # Hip_R motor (torso -> upper_leg_r) — moderate range for walking
        motor_hip_r = _add_motorized_joint(
            space, self.torso, self.upper_leg_r,
            hip_r_anchor, (0, ul / 2),
            min_angle=-math.pi / 3, max_angle=math.pi / 3)
        self.motors.append(motor_hip_r)

        # Knee_R motor — restricted to prevent leg collapse under load
        motor_knee_r = _add_motorized_joint(
            space, self.upper_leg_r, self.lower_leg_r,
            (0, -ul / 2), (0, ll / 2),
            min_angle=-math.pi / 6, max_angle=math.pi / 3)
        self.motors.append(motor_knee_r)

        # Foot_R (passive — wide base for ground contact stability)
        foot_r_pos = (spawn_x + tw / 4, spawn_y - th / 2 - ul - ll - foot_h / 2)
        self.foot_r = _make_foot(space, foot_r_pos, foot_w, foot_h)
        self.bodies.append(self.foot_r)
        _add_ankle_joint(space, self.lower_leg_r, self.foot_r, ll, foot_h)

        # --- Left Arm ---
        upper_arm_l_pos = (spawn_x - tw / 3, spawn_y + th / 2 + ul / 2)
        self.upper_arm_l = _make_segment_body(
            space, upper_arm_l_pos, ul, 0, mass=0.8)
        self.bodies.append(self.upper_arm_l)

        lower_arm_l_pos = (spawn_x - tw / 3, spawn_y + th / 2 + ul + ll / 2)
        self.lower_arm_l = _make_segment_body(
            space, lower_arm_l_pos, ll, 0, mass=0.5)
        self.bodies.append(self.lower_arm_l)

        # Shoulder_L motor (torso -> upper_arm_l)
        motor_shoulder_l = _add_motorized_joint(
            space, self.torso, self.upper_arm_l,
            shoulder_l_anchor, (0, -ul / 2))
        self.motors.append(motor_shoulder_l)

        # Elbow_L spring (upper_arm_l -> lower_arm_l)
        _add_spring_elbow(
            space, self.upper_arm_l, self.lower_arm_l,
            (0, ul / 2), (0, -ll / 2), config)
        self.elbow_pairs.append((self.upper_arm_l, self.lower_arm_l))

        # --- Right Arm ---
        upper_arm_r_pos = (spawn_x + tw / 3, spawn_y + th / 2 + ul / 2)
        self.upper_arm_r = _make_segment_body(
            space, upper_arm_r_pos, ul, 0, mass=0.8)
        self.bodies.append(self.upper_arm_r)

        lower_arm_r_pos = (spawn_x + tw / 3, spawn_y + th / 2 + ul + ll / 2)
        self.lower_arm_r = _make_segment_body(
            space, lower_arm_r_pos, ll, 0, mass=0.5)
        self.bodies.append(self.lower_arm_r)

        # Shoulder_R motor (torso -> upper_arm_r)
        motor_shoulder_r = _add_motorized_joint(
            space, self.torso, self.upper_arm_r,
            shoulder_r_anchor, (0, -ul / 2))
        self.motors.append(motor_shoulder_r)

        # Elbow_R spring (upper_arm_r -> lower_arm_r)
        _add_spring_elbow(
            space, self.upper_arm_r, self.lower_arm_r,
            (0, ul / 2), (0, -ll / 2), config)
        self.elbow_pairs.append((self.upper_arm_r, self.lower_arm_r))

        # Motor order matches JOINT_NAMES:
        # [hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R]
        # But we built: hip_L, knee_L, hip_R, knee_R, shoulder_L, shoulder_R
        # Reorder motors to match JOINT_NAMES
        self.motors = [
            motor_hip_l,     # hip_L
            motor_hip_r,     # hip_R
            motor_knee_l,    # knee_L
            motor_knee_r,    # knee_R
            motor_shoulder_l,  # shoulder_L
            motor_shoulder_r,  # shoulder_R
        ]

        # Record initial torso x for fitness computation
        self.initial_x = self.torso.position.x

    def update_motors(self, t):
        """Update motor rates using PD position controller at time t.

        For each motorized joint, compute the target angle from the
        sinusoidal pattern, then use a proportional-derivative (PD)
        controller to set the motor rate so that the joint tracks the
        target angle.  The SimpleMotor applies torque to maintain the
        commanded angular velocity (rate).

        PD law:  rate = Kp * (target - current) - Kd * relative_velocity
        Angles are wrapped to [-pi, pi] to avoid drift issues.
        """
        Kp = 30.0   # proportional gain — high for strong tracking
        Kd = 2.0    # derivative gain (damping to reduce oscillation)

        for i, motor in enumerate(self.motors):
            amp, freq, phase = self.joint_params[i]
            target_angle = amp * math.sin(2 * math.pi * freq * t + phase)

            # Current relative angle wrapped to [-pi, pi]
            current_angle = _wrap_angle(motor.b.angle - motor.a.angle)

            # Current relative angular velocity
            relative_vel = motor.b.angular_velocity - motor.a.angular_velocity

            # PD controller with wrapped error (shortest angular path)
            error = _wrap_angle(target_angle - current_angle)
            motor.rate = Kp * error - Kd * relative_vel

    def clamp_velocities(self, v_max):
        """Clamp all body velocities to prevent physics explosions."""
        for body in self.bodies:
            vx, vy = body.velocity
            speed = math.sqrt(vx * vx + vy * vy)
            if speed > v_max:
                scale = v_max / speed
                body.velocity = (vx * scale, vy * scale)

    def get_torso_position(self):
        """Return (x, y) of the torso center of mass."""
        return self.torso.position.x, self.torso.position.y

    def get_torso_angle(self):
        """Return torso angle in radians relative to horizontal."""
        return self.torso.angle

    def get_elbow_angles(self):
        """Return relative angles of each spring elbow joint.

        The relative angle is upper_body.angle - lower_body.angle.
        Returns a list of floats, one per elbow (L, R).
        """
        return [upper.angle - lower.angle
                for upper, lower in self.elbow_pairs]

    def get_total_torque(self):
        """Sum of absolute motor rates (proxy for energy usage)."""
        return sum(abs(m.rate) for m in self.motors)

    # ------------------------------------------------------------------
    # V2 methods — external controller interface
    # ------------------------------------------------------------------

    def set_motor_targets(self, targets):
        """Apply externally-computed target angles via PD controller.

        Used by CPG and CPG+NN controllers (v2).  This is the same PD
        control law as update_motors(), but accepts pre-computed target
        angles instead of computing sine patterns internally.

        Args:
            targets: list of 6 floats — target angles in radians,
                     ordered by JOINT_NAMES.
        """
        Kp = 30.0   # proportional gain — matches update_motors()
        Kd = 2.0    # derivative gain

        for i, motor in enumerate(self.motors):
            # Current relative angle wrapped to [-pi, pi]
            current_angle = _wrap_angle(motor.b.angle - motor.a.angle)

            # Current relative angular velocity
            relative_vel = motor.b.angular_velocity - motor.a.angular_velocity

            # PD controller with wrapped error (shortest angular path)
            error = _wrap_angle(targets[i] - current_angle)
            motor.rate = Kp * error - Kd * relative_vel

    def get_joint_angles(self):
        """Return relative angles of all 6 motorized joints.

        Each angle is the relative rotation between the child body
        and parent body (motor.b.angle - motor.a.angle), wrapped to
        [-pi, pi].  Order matches JOINT_NAMES.

        Used by the sensor system to read proprioceptive state.
        """
        return [_wrap_angle(m.b.angle - m.a.angle) for m in self.motors]

    def get_joint_angular_velocities(self):
        """Return relative angular velocities of all 6 motorized joints.

        Each value is motor.b.angular_velocity - motor.a.angular_velocity.
        Order matches JOINT_NAMES.

        Used by the sensor system to read proprioceptive rates.
        """
        return [m.b.angular_velocity - m.a.angular_velocity
                for m in self.motors]
