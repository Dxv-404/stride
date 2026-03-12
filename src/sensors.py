"""Sensor system for v2 controllers (CPG+NN closed-loop control).

Provides an 18-dimensional normalized sensor vector:
  Indices  0-5:   6 joint angles          (normalized by joint limits)
  Indices  6-11:  6 joint angular velocities (normalized by max ang. vel)
  Indices 12-15:  4 torso state           (angle, ang.vel, y-pos, x-vel)
  Indices 16-17:  2 foot contacts         (binary 0/1)

All values are clipped to [-1, 1] after normalization.

The reduced sensor set (6 dims) is used as NN input to keep the network
small (58 weights).  Only foot_L contact is included — this is intentional:
the NN relies on CPG inter-leg coupling for right-side timing rather than
direct foot_R feedback.  This keeps the search space manageable at 96 genes.
"""

import math

import numpy as np
import pymunk

from src.creature import (
    JOINT_NAMES,
    TERRAIN_COLLISION_TYPE,
    CREATURE_COLLISION_TYPE,
)


# ---------------------------------------------------------------------------
# Sensor layout constants
# ---------------------------------------------------------------------------

SENSOR_NAMES = [
    # Joint angles (0-5)
    "hip_L_angle", "hip_R_angle", "knee_L_angle", "knee_R_angle",
    "shoulder_L_angle", "shoulder_R_angle",
    # Joint angular velocities (6-11)
    "hip_L_angvel", "hip_R_angvel", "knee_L_angvel", "knee_R_angvel",
    "shoulder_L_angvel", "shoulder_R_angvel",
    # Torso state (12-15)
    "torso_angle", "torso_angvel", "torso_y", "torso_xvel",
    # Foot contacts (16-17)
    "foot_L_contact", "foot_R_contact",
]

# Normalization constants — each sensor is divided by its norm so that
# typical operating values fall in [-1, 1].  These are generous limits;
# clipping handles outliers.
SENSOR_NORMS = {
    # Joint angles: motor limits are roughly [-pi/2, pi/2] for hips/shoulders,
    # [-pi/6, pi/3] for knees.  Use pi/2 as universal joint angle norm.
    "joint_angle": math.pi / 2,
    # Angular velocities: empirically, joints rarely exceed 15 rad/s
    "joint_angvel": 15.0,
    # Torso angle: ±pi/2 is the practical range (beyond that, it's falling)
    "torso_angle": math.pi / 2,
    # Torso angular velocity: rarely exceeds 10 rad/s in stable walking
    "torso_angvel": 10.0,
    # Torso y-position: normalize relative to spawn height (~107 px).
    # Center at ground_base_height + limb_length ≈ 107, range ±50 px.
    "torso_y_center": 107.0,
    "torso_y_range": 50.0,
    # Torso x-velocity: normalize by typical walking speed (~100 px/s)
    "torso_xvel": 100.0,
    # Foot contacts: binary, no normalization needed (0 or 1)
}

# Reduced sensor indices for the NN input (6 dims).
# Selected to give the NN the most useful proprioceptive + contact info:
#   0: hip_L_angle      — primary leg phase indicator
#   1: hip_R_angle      — paired leg phase for anti-phase detection
#   6: hip_L_angvel     — rate of leg swing (timing cue)
#   7: hip_R_angvel     — paired rate
#  12: torso_angle      — balance/uprightness signal
#  16: foot_L_contact   — ground contact for stance detection
#
# Note: foot_R_contact (index 17) is intentionally excluded.  The NN has
# only 6 inputs to keep the chromosome at 96 genes (58 NN weights).  The
# CPG's hip_L<->hip_R coupling provides implicit right-side timing, so
# explicit foot_R feedback is redundant for the NN's modulation role.
REDUCED_SENSOR_INDICES = [0, 1, 6, 7, 12, 16]


# Convenience index map
SENSOR_IDX = {name: i for i, name in enumerate(SENSOR_NAMES)}


# ---------------------------------------------------------------------------
# Core sensor functions
# ---------------------------------------------------------------------------

def get_sensors(creature, foot_contacts):
    """Read and normalize the full 18-dim sensor vector from the creature.

    Args:
        creature: Creature instance with motors, torso, feet.
        foot_contacts: dict with keys "foot_L" and "foot_R" (bool),
                       maintained by setup_foot_contact_tracking().

    Returns:
        np.ndarray of shape (18,), values clipped to [-1, 1].
    """
    sensors = np.zeros(18, dtype=np.float64)

    # --- Joint angles (0-5) ---
    joint_angles = creature.get_joint_angles()
    for i in range(6):
        sensors[i] = joint_angles[i] / SENSOR_NORMS["joint_angle"]

    # --- Joint angular velocities (6-11) ---
    joint_angvels = creature.get_joint_angular_velocities()
    for i in range(6):
        sensors[6 + i] = joint_angvels[i] / SENSOR_NORMS["joint_angvel"]

    # --- Torso state (12-15) ---
    torso_angle = creature.get_torso_angle()
    sensors[12] = torso_angle / SENSOR_NORMS["torso_angle"]

    sensors[13] = creature.torso.angular_velocity / SENSOR_NORMS["torso_angvel"]

    tx, ty = creature.get_torso_position()
    sensors[14] = (ty - SENSOR_NORMS["torso_y_center"]) / SENSOR_NORMS["torso_y_range"]

    sensors[15] = creature.torso.velocity.x / SENSOR_NORMS["torso_xvel"]

    # --- Foot contacts (16-17) ---
    sensors[16] = 1.0 if foot_contacts.get("foot_L", False) else 0.0
    sensors[17] = 1.0 if foot_contacts.get("foot_R", False) else 0.0

    # Clip to [-1, 1]
    np.clip(sensors, -1.0, 1.0, out=sensors)

    return sensors


def get_reduced_sensors(full_sensors):
    """Extract the 6-dim reduced sensor vector for NN input.

    Args:
        full_sensors: np.ndarray of shape (18,) from get_sensors().

    Returns:
        np.ndarray of shape (6,).
    """
    return full_sensors[REDUCED_SENSOR_INDICES].copy()


# ---------------------------------------------------------------------------
# Foot contact tracking
# ---------------------------------------------------------------------------

def setup_foot_contact_tracking(space, creature):
    """Register pymunk collision handlers to track foot-terrain contact.

    Creates a dict that is updated each physics step with binary foot
    contact state.  The dict must be reset to False BEFORE each
    space.step() call.  The ``pre_solve`` callback then sets it to True
    for every foot that is in contact with the terrain during that step.

    Why ``pre_solve`` and not ``begin``?
      ``begin`` fires only on the first step of a new contact — it does
      NOT fire again while the same foot *stays* on the ground.  With
      the reset-before-step pattern this means contacts always read as
      False for persistent contacts.  ``pre_solve`` fires on *every*
      physics step where the shapes overlap, which is exactly what we
      need for per-step contact detection.

    Uses pymunk 7.x API (space.on_collision).

    Args:
        space: pymunk.Space with terrain shapes.
        creature: Creature instance.

    Returns:
        dict with keys "foot_L" and "foot_R" (initially False).

    Usage:
        contacts = setup_foot_contact_tracking(space, creature)
        for step in range(total_steps):
            contacts["foot_L"] = False
            contacts["foot_R"] = False
            space.step(dt)
            # After step, contacts["foot_L"] / ["foot_R"] are True if touching
            sensors = get_sensors(creature, contacts)
    """
    contacts = {"foot_L": False, "foot_R": False}

    # Get the body objects for each foot so we can identify them in the handler
    foot_l_body = creature.foot_l
    foot_r_body = creature.foot_r

    def _pre_solve(arbiter, space, data):
        """Called every step while two shapes overlap — sets contact True."""
        for shape in arbiter.shapes:
            if shape.body is foot_l_body:
                contacts["foot_L"] = True
            elif shape.body is foot_r_body:
                contacts["foot_R"] = True

    # pymunk 7.x API: space.on_collision() with named callback parameters.
    # We only need pre_solve — separate is unnecessary because contacts are
    # reset to False before each step.  If a foot is not touching, pre_solve
    # simply doesn't fire and the contact stays False.
    space.on_collision(
        collision_type_a=CREATURE_COLLISION_TYPE,
        collision_type_b=TERRAIN_COLLISION_TYPE,
        pre_solve=_pre_solve,
    )

    return contacts


# ---------------------------------------------------------------------------
# Sensor ablation helpers
# ---------------------------------------------------------------------------

def get_running_mean_sensors(sensor_history, window=30):
    """Compute running mean of sensor readings for ablation studies.

    For sensor ablation, we replace live sensor values with a running
    average rather than zero — this avoids injecting false information
    (zero could mean "perfectly upright" or "no contact") and instead
    provides a plausible but uninformative baseline.

    Args:
        sensor_history: list of np.ndarray (each shape (18,)),
                        most recent at the end.
        window: number of recent readings to average.

    Returns:
        np.ndarray of shape (18,) — running mean of last `window` entries.
        If fewer entries exist, averages what's available.
    """
    if not sensor_history:
        return np.zeros(18, dtype=np.float64)

    recent = sensor_history[-window:]
    return np.mean(recent, axis=0)
