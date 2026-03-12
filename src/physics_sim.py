"""Pymunk simulation environment for evaluating creature locomotion.

Runs a creature in a physics world for a fixed duration and records
all data needed for fitness computation.

V2 additions:
  - SimulationResultV2: extends SimulationResult with sensor/modulation logs
  - simulate_v2(): supports CPG and CPG+NN controllers with sensor feedback,
    motor noise injection, and perturbation impulses
"""

import math
import pymunk
import numpy as np

from src.creature import Creature
from src.terrain import create_terrain


class SimulationResult:
    """Container for all data produced by a single simulation run."""

    __slots__ = [
        "distance", "total_energy", "fall_count", "uprightness_sum",
        "steps_completed", "torso_positions", "torso_angles",
        "torques_per_step", "terminated_early", "termination_reason",
    ]

    def __init__(self):
        self.distance = 0.0
        self.total_energy = 0.0
        self.fall_count = 0
        self.uprightness_sum = 0.0
        self.steps_completed = 0
        self.torso_positions = []   # list of (x, y)
        self.torso_angles = []      # list of float (radians)
        self.torques_per_step = []  # list of float (sum |torque| per step)
        self.terminated_early = False
        self.termination_reason = None


def simulate(joint_params, terrain_type, config):
    """Run a full physics simulation for one creature.

    Args:
        joint_params: list of 6 (amplitude, frequency, phase) tuples.
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: dict with simulation parameters.

    Returns:
        SimulationResult with all recorded data.
    """
    sim_time = config["simulation_time"]
    fps = config["simulation_fps"]
    dt = 1.0 / fps
    total_steps = int(sim_time * fps)
    v_max = config["max_velocity"]
    y_min = config["y_min"]
    y_max = config["y_max"]
    stuck_threshold = config["stuck_threshold"]
    stuck_window_steps = int(config["stuck_window"] * fps)
    ground_height = config["ground_base_height"]
    torso_half_h = config["torso_height"] / 2
    contact_epsilon = 5.0  # pixels

    # --- Build world ---
    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20  # higher accuracy for joint stability

    # Add terrain
    terrain = create_terrain(terrain_type)
    terrain.add_to_space(space)

    # Spawn creature
    creature = Creature(space, joint_params, config, spawn_x=100)

    # --- Simulate ---
    result = SimulationResult()
    initial_x = creature.initial_x

    for step in range(total_steps):
        t = step * dt

        # Update motor targets
        creature.update_motors(t)

        # Step physics
        space.step(dt)

        # Clamp velocities
        creature.clamp_velocities(v_max)

        # Record torso state
        tx, ty = creature.get_torso_position()
        angle = creature.get_torso_angle()

        # NaN check
        if math.isnan(tx) or math.isnan(ty) or math.isnan(angle):
            result.terminated_early = True
            result.termination_reason = "NaN detected"
            break

        result.torso_positions.append((tx, ty))
        result.torso_angles.append(angle)

        # Energy: sum of |motor rate| as torque proxy
        torque_sum = creature.get_total_torque()
        result.torques_per_step.append(torque_sum)
        result.total_energy += torque_sum

        # Fall detection: torso touching/below ground
        terrain_h = terrain.get_height(tx)
        if ty < terrain_h + torso_half_h + contact_epsilon:
            result.fall_count += 1

        # Uprightness bonus: cos(angle), clamped >= 0
        result.uprightness_sum += max(0.0, math.cos(angle))

        result.steps_completed = step + 1

        # --- Early termination checks ---
        # Flew off or fell through
        if ty < y_min or ty > y_max:
            result.terminated_early = True
            result.termination_reason = "out_of_bounds"
            break

        # Stuck detection: no movement in last stuck_window seconds
        # stuck_threshold <= 0 means disabled
        if stuck_threshold > 0 and step >= stuck_window_steps:
            old_x = result.torso_positions[step - stuck_window_steps][0]
            if abs(tx - old_x) < stuck_threshold:
                result.terminated_early = True
                result.termination_reason = "stuck"
                break

    # Compute distance traveled
    if result.torso_positions:
        final_x = result.torso_positions[-1][0]
        result.distance = final_x - initial_x
    else:
        result.distance = 0.0

    return result


# =========================================================================
# V2 simulation — CPG and CPG+NN controllers
# =========================================================================

class SimulationResultV2:
    """Extended container for v2 simulation data.

    Inherits all v1 fields plus sensor/modulation/target logs needed
    for analysis of closed-loop controllers.
    """

    __slots__ = [
        # --- v1 fields ---
        "distance", "total_energy", "fall_count", "uprightness_sum",
        "steps_completed", "torso_positions", "torso_angles",
        "torques_per_step", "terminated_early", "termination_reason",
        # --- v2 fields ---
        "sensor_log",         # list of np.ndarray (18,) per step
        "modulation_log",     # list of np.ndarray (6,) per step (CPG+NN only)
        "motor_targets_log",  # list of list[6] per step
        "perturbation_applied", # bool — was a perturbation impulse applied?
        "perturbation_step",    # int — step at which perturbation occurred
    ]

    def __init__(self):
        self.distance = 0.0
        self.total_energy = 0.0
        self.fall_count = 0
        self.uprightness_sum = 0.0
        self.steps_completed = 0
        self.torso_positions = []
        self.torso_angles = []
        self.torques_per_step = []
        self.terminated_early = False
        self.termination_reason = None
        # v2
        self.sensor_log = []
        self.modulation_log = []
        self.motor_targets_log = []
        self.perturbation_applied = False
        self.perturbation_step = -1


def simulate_v2(chromosome, controller_type, terrain_type, config,
                record_sensors=False, motor_noise=0.0, perturbation=None,
                sensor_override=None):
    """Run a v2 simulation with CPG or CPG+NN controller.

    Unlike simulate() which takes pre-decoded joint_params, this function
    takes a raw chromosome and creates the appropriate controller internally.
    The controller generates target angles each step, optionally using
    sensor feedback (CPG+NN only).

    Args:
        chromosome: np.array of [0,1] genes (38 for cpg, 96 for cpg_nn).
        controller_type: "cpg" or "cpg_nn".
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: experiment config dict.
        record_sensors: if True, store sensor readings per step in result.
        motor_noise: std dev of Gaussian noise added to motor targets
                     (for robustness testing).  0.0 = no noise.
        perturbation: single perturbation or list of perturbations, or None.
                      Each perturbation is a dict with:
                        {"time": float, "impulse": (fx, fy)}
                      Applies force impulse(s) to the torso at the specified
                      simulation time(s).  Use a single dict for test pushes,
                      or a list for training perturbation (Risk 2 mitigation).
        sensor_override: dict mapping sensor indices to replacement values,
                         or None.  Used for sensor ablation studies — after
                         reading sensors, overrides the specified indices
                         with constant values before feeding to the controller.

    Returns:
        SimulationResultV2 with all recorded data.
    """
    # Lazy imports to avoid circular dependency at module level
    from src.cpg_controller import CPGController
    from src.cpgnn_controller import CPGNNController
    from src.sensors import get_sensors, setup_foot_contact_tracking

    # --- Create controller ---
    if controller_type == "cpg":
        controller = CPGController(chromosome)
        uses_sensors = False
    elif controller_type == "cpg_nn":
        controller = CPGNNController(chromosome)
        uses_sensors = True
    else:
        raise ValueError(f"Unknown controller type: {controller_type}")

    # --- Extract simulation parameters ---
    sim_time = config["simulation_time"]
    fps = config["simulation_fps"]
    dt = 1.0 / fps
    total_steps = int(sim_time * fps)
    v_max = config["max_velocity"]
    y_min = config["y_min"]
    y_max = config["y_max"]
    stuck_threshold = config["stuck_threshold"]
    stuck_window_steps = int(config["stuck_window"] * fps)
    torso_half_h = config["torso_height"] / 2
    contact_epsilon = 5.0

    # Perturbation timing — support single dict or list of dicts
    perturb_steps = {}  # step_number -> (fx, fy)
    if perturbation is not None:
        if isinstance(perturbation, dict):
            # Single perturbation (backwards-compatible)
            step_num = int(perturbation["time"] * fps)
            perturb_steps[step_num] = perturbation["impulse"]
        elif isinstance(perturbation, list):
            # Multiple perturbations (for training perturbation / Risk 2)
            for p in perturbation:
                step_num = int(p["time"] * fps)
                perturb_steps[step_num] = p["impulse"]

    # --- Build world ---
    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain(terrain_type)
    terrain.add_to_space(space)

    # Spawn creature (no joint_params — controller drives motors externally)
    creature = Creature(space, joint_params=None, config=config, spawn_x=100)

    # Set up foot contact tracking for sensors
    foot_contacts = setup_foot_contact_tracking(space, creature)

    # Initial sensor reading (rest pose, no contacts) — used by the
    # controller on the very first step before any physics has run.
    sensors = get_sensors(creature, foot_contacts)

    # --- Simulate ---
    result = SimulationResultV2()
    initial_x = creature.initial_x

    for step in range(total_steps):
        t = step * dt

        # Reset foot contacts BEFORE the physics step.
        # The pre_solve callback fires DURING space.step() for active
        # contacts, setting them back to True.  Sensors are read AFTER
        # the step so they reflect the current contact state.
        foot_contacts["foot_L"] = False
        foot_contacts["foot_R"] = False

        # --- Get motor targets from controller ---
        # NOTE: On step 0, sensors from the previous iteration don't
        # exist yet.  We use a zero-sensor vector for the first step,
        # which is fine — the creature hasn't moved and is in its rest
        # pose, so all sensor values would be near zero anyway.
        if uses_sensors:
            targets, modulation = controller.get_targets(t, dt, sensors)
            if record_sensors:
                result.modulation_log.append(modulation.copy())
        else:
            targets = controller.get_targets(t, dt)

        # --- Optional motor noise ---
        if motor_noise > 0:
            noise = np.random.normal(0, motor_noise, 6)
            targets = [targets[i] + noise[i] for i in range(6)]

        # Log targets
        result.motor_targets_log.append(list(targets))

        # --- Apply targets to creature ---
        creature.set_motor_targets(targets)

        # --- Apply perturbation impulse(s) ---
        if step in perturb_steps:
            fx, fy = perturb_steps[step]
            creature.torso.apply_impulse_at_world_point(
                (fx, fy), creature.torso.position
            )
            result.perturbation_applied = True
            if result.perturbation_step < 0:
                result.perturbation_step = step

        # --- Step physics ---
        space.step(dt)

        # Clamp velocities
        creature.clamp_velocities(v_max)

        # --- Read sensors AFTER physics step ---
        # The pre_solve callback has now fired, so foot_contacts
        # correctly reflects whether each foot is touching the terrain.
        sensors = get_sensors(creature, foot_contacts)

        # --- Apply sensor override (for ablation studies) ---
        if sensor_override is not None:
            for idx, val in sensor_override.items():
                sensors[idx] = val

        if record_sensors:
            result.sensor_log.append(sensors.copy())

        # --- Record torso state ---
        tx, ty = creature.get_torso_position()
        angle = creature.get_torso_angle()

        # NaN check
        if math.isnan(tx) or math.isnan(ty) or math.isnan(angle):
            result.terminated_early = True
            result.termination_reason = "NaN detected"
            break

        result.torso_positions.append((tx, ty))
        result.torso_angles.append(angle)

        # Energy
        torque_sum = creature.get_total_torque()
        result.torques_per_step.append(torque_sum)
        result.total_energy += torque_sum

        # Fall detection
        terrain_h = terrain.get_height(tx)
        if ty < terrain_h + torso_half_h + contact_epsilon:
            result.fall_count += 1

        # Uprightness
        result.uprightness_sum += max(0.0, math.cos(angle))

        result.steps_completed = step + 1

        # --- Early termination ---
        if ty < y_min or ty > y_max:
            result.terminated_early = True
            result.termination_reason = "out_of_bounds"
            break

        if stuck_threshold > 0 and step >= stuck_window_steps:
            old_x = result.torso_positions[step - stuck_window_steps][0]
            if abs(tx - old_x) < stuck_threshold:
                result.terminated_early = True
                result.termination_reason = "stuck"
                break

    # Compute distance
    if result.torso_positions:
        final_x = result.torso_positions[-1][0]
        result.distance = final_x - initial_x
    else:
        result.distance = 0.0

    return result
