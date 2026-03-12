"""Fitness evaluation for evolved creatures.

Primary fitness: distance traveled by torso in simulation time.
Extended fitness with gait bonuses:

F(x) = distance - alpha*E - beta*C + gamma*U + gait_bonus + velocity_bonus

The gait bonus rewards coordinated walking patterns (anti-phase legs,
hip-knee coupling, frequency matching). The velocity bonus rewards
consistent forward movement over lurching.

V2 additions:
  - compute_cost_of_transport(): metabolic efficiency metric
  - compute_reactivity_bonus(): perturbation recovery reward
  - compute_fitness_v2(): v2 fitness function (no gait bonus, adds CoT)
  - evaluate_creature_v2(): full pipeline for CPG/CPG+NN controllers
"""

import math
import logging

from src.encoding import decode_chromosome
from src.physics_sim import simulate

PENALTY_FITNESS = -1000.0


def compute_gait_bonus(joint_params, config):
    """Compute bonus for biologically plausible walking gait.

    Rewards:
      1. Anti-phase hip oscillation (L-R legs pi apart)
      2. Knee trailing hip in phase (~pi/4 offset)
      3. Frequency matching between hip and knee on same side

    Args:
        joint_params: list of 6 (amp, freq, phase) tuples.
        config: dict with fitness_weights containing gait_bonus_weight.

    Returns:
        float — gait coordination bonus.
    """
    w = config["fitness_weights"].get("gait_bonus_weight", 5.0)
    if w == 0:
        return 0.0

    # Joint order: hip_L=0, hip_R=1, knee_L=2, knee_R=3, shldr_L=4, shldr_R=5
    hip_L_amp, hip_L_freq, hip_L_phase = joint_params[0]
    hip_R_amp, hip_R_freq, hip_R_phase = joint_params[1]
    knee_L_amp, knee_L_freq, knee_L_phase = joint_params[2]
    knee_R_amp, knee_R_freq, knee_R_phase = joint_params[3]

    # 1. Anti-phase bonus: L-R hips should be pi apart
    #    cos(phase_diff - pi) = 1.0 when perfect anti-phase
    phase_diff = hip_L_phase - hip_R_phase
    antiphase = math.cos(phase_diff - math.pi)  # range [-1, 1]

    # 2. Hip-knee coupling: knee should trail hip by ~pi/4
    coupling_L = math.cos(knee_L_phase - hip_L_phase - math.pi / 4)
    coupling_R = math.cos(knee_R_phase - hip_R_phase - math.pi / 4)

    # 3. Frequency matching: hip and knee on same side should match
    freq_match_L = 1.0 / (1.0 + abs(hip_L_freq - knee_L_freq))
    freq_match_R = 1.0 / (1.0 + abs(hip_R_freq - knee_R_freq))

    # Sum ranges: antiphase[-1,1] + coupling_L[-1,1] + coupling_R[-1,1]
    #           + freq_match_L[0,1] + freq_match_R[0,1]
    # Max = 5.0, so max gait_bonus = 5.0 * 5.0 = 25.0
    raw_bonus = antiphase + coupling_L + coupling_R + freq_match_L + freq_match_R

    return w * raw_bonus


def compute_velocity_bonus(sim_result, config):
    """Compute bonus for consistent forward movement.

    Rewards fraction of simulation frames where torso moves forward.
    Penalizes creatures that lurch forward then fall backward.

    Returns:
        float — velocity consistency bonus.
    """
    w = config["fitness_weights"].get("velocity_bonus_weight", 3.0)
    if w == 0:
        return 0.0

    positions = sim_result.torso_positions
    if len(positions) < 2:
        return 0.0

    forward_count = 0
    for i in range(1, len(positions)):
        dx = positions[i][0] - positions[i - 1][0]
        if dx > 0.1:  # meaningful forward movement threshold
            forward_count += 1

    fraction = forward_count / (len(positions) - 1)
    return w * fraction  # max = 3.0


def compute_fitness(sim_result, config, joint_params=None):
    """Compute the extended fitness from a SimulationResult.

    Args:
        sim_result: SimulationResult from physics_sim.simulate().
        config: dict with fitness_weights (alpha, beta, gamma, etc.).
        joint_params: optional list of 6 (amp, freq, phase) tuples
                      for gait bonus computation.

    Returns:
        float — the fitness value.
    """
    weights = config["fitness_weights"]
    alpha = weights["alpha"]
    beta = weights["beta"]
    gamma = weights["gamma"]

    S = sim_result.steps_completed
    if S == 0:
        return PENALTY_FITNESS

    # Primary: distance traveled
    distance = sim_result.distance

    # Energy penalty: average total torque per step
    energy = sim_result.total_energy / S

    # Fall penalty: number of steps torso was touching ground
    fall_count = sim_result.fall_count

    # Uprightness bonus: average cos(angle) over steps
    uprightness = sim_result.uprightness_sum / S

    fitness = distance - alpha * energy - beta * fall_count + gamma * uprightness

    # Gait coordination bonus (requires joint_params)
    if joint_params is not None:
        fitness += compute_gait_bonus(joint_params, config)

    # Forward velocity consistency bonus
    fitness += compute_velocity_bonus(sim_result, config)

    return fitness


def evaluate_creature(chromosome, terrain_type, config):
    """Full pipeline: decode chromosome -> simulate -> compute fitness.

    Args:
        chromosome: numpy array of normalized [0,1] gene values.
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: dict with all parameters.

    Returns:
        tuple of (fitness_value, SimulationResult).
    """
    encoding = config.get("encoding", "direct")
    joint_params = decode_chromosome(chromosome, encoding)

    sim_result = simulate(joint_params, terrain_type, config)

    # Pass joint_params for gait bonus computation
    fitness = compute_fitness(sim_result, config, joint_params=joint_params)

    # Final sanity checks
    if math.isnan(fitness) or math.isinf(fitness):
        logging.warning("NaN/Inf fitness detected, assigning penalty")
        return PENALTY_FITNESS, sim_result

    if abs(fitness) > 100000:
        logging.warning(f"Unreasonable fitness {fitness:.2f}, likely physics explosion")
        return PENALTY_FITNESS, sim_result

    return fitness, sim_result


def safe_evaluate(chromosome, terrain_type, config):
    """Evaluate with full exception handling. Returns fitness only.

    This is the primary entry point for GA fitness evaluation.
    """
    try:
        fitness, _ = evaluate_creature(chromosome, terrain_type, config)
        return fitness
    except Exception as e:
        logging.error(f"Simulation crashed: {type(e).__name__}: {e}")
        return PENALTY_FITNESS


# =========================================================================
# V2 fitness functions — CPG and CPG+NN controllers
# =========================================================================

def compute_cost_of_transport(sim_result, creature_mass=11.6):
    """Compute metabolic Cost of Transport (CoT).

    CoT = total_energy / (mass * distance * g)

    Lower CoT = more efficient locomotion.  A typical efficient biped
    has CoT around 0.2-0.5.  Creatures that waste energy fighting gravity
    or oscillating without moving will have very high CoT.

    Uses a simplified concentric/eccentric metabolic model:
      - Each motor's torque contribution is categorized by the sign of
        (rate * angular_velocity): positive = concentric (1x cost),
        negative = eccentric (0.5x cost — muscles resist less when
        lengthening), near-zero = isometric (0.25x cost).
      - For simplicity, v2 uses the total_energy (sum |rate|) as a
        first-order proxy, since we don't separately track concentric
        vs eccentric in SimulationResult.

    Args:
        sim_result: SimulationResult or SimulationResultV2.
        creature_mass: total mass of all body segments (kg equivalent).
                       Default 11.6 from: torso(5) + 4*upper(1.5) +
                       4*lower(0.75) + 2*foot(0.5) + 2*arm_upper(0.8)
                       + 2*arm_lower(0.5) ≈ 11.6

    Returns:
        float — Cost of Transport (dimensionless).  Returns a large
        value (100.0) if distance is near zero.
    """
    if abs(sim_result.distance) < 1.0:
        return 100.0  # near-zero distance → infinite cost

    g = 981.0  # gravity magnitude (matches config gravity)
    cot = sim_result.total_energy / (creature_mass * abs(sim_result.distance) * g)
    return cot


def compute_reactivity_bonus(sim_result_v2, config):
    """Compute bonus for recovering from perturbation.

    Measures the ratio of uprightness in the 2 seconds after perturbation
    vs the 2 seconds before.  A creature that maintains walking after being
    pushed gets a bonus; one that falls gets nothing.

    Args:
        sim_result_v2: SimulationResultV2 instance.
        config: experiment config dict (needs fitness_weights.reactivity_weight).

    Returns:
        float — reactivity bonus (0 if no perturbation was applied).
    """
    if not sim_result_v2.perturbation_applied:
        return 0.0

    weight = config["fitness_weights"].get("reactivity_weight", 5.0)
    fps = config["simulation_fps"]
    window_steps = int(2.0 * fps)  # 2 seconds = 120 steps at 60fps

    perturb_step = sim_result_v2.perturbation_step

    # Pre-perturbation uprightness (2 seconds before)
    pre_start = max(0, perturb_step - window_steps)
    pre_end = perturb_step
    if pre_end <= pre_start:
        return 0.0

    pre_uprightness = 0.0
    for s in range(pre_start, pre_end):
        if s < len(sim_result_v2.torso_angles):
            pre_uprightness += max(0.0, math.cos(sim_result_v2.torso_angles[s]))
    pre_uprightness /= (pre_end - pre_start)

    # Post-perturbation uprightness (2 seconds after)
    post_start = perturb_step
    post_end = min(perturb_step + window_steps,
                   len(sim_result_v2.torso_angles))
    if post_end <= post_start:
        return 0.0

    post_uprightness = 0.0
    for s in range(post_start, post_end):
        post_uprightness += max(0.0, math.cos(sim_result_v2.torso_angles[s]))
    post_uprightness /= (post_end - post_start)

    # Ratio: 1.0 = perfect recovery, 0.0 = fell immediately
    if pre_uprightness < 0.1:
        # Was already falling before perturbation — no meaningful recovery
        return 0.0

    recovery_ratio = post_uprightness / pre_uprightness
    recovery_ratio = min(recovery_ratio, 1.0)  # cap at 1.0

    return weight * recovery_ratio


def compute_fitness_v2(sim_result, config, controller_type=None):
    """Compute fitness for v2 controllers (CPG / CPG+NN).

    Same base formula as v1 but:
      - No gait bonus (CPG doesn't use decoded sine params)
      - Adds Cost of Transport penalty
      - Adds reactivity bonus (if perturbation was applied)

    F_v2 = distance - alpha*E - beta*C + gamma*U + velocity_bonus
           - delta*CoT + reactivity_bonus

    Args:
        sim_result: SimulationResultV2 instance.
        config: experiment config dict.
        controller_type: "cpg" or "cpg_nn" (unused currently, reserved).

    Returns:
        float — fitness value.
    """
    weights = config["fitness_weights"]
    alpha = weights["alpha"]
    beta = weights["beta"]
    gamma = weights["gamma"]
    delta = weights.get("cot_weight", 2.0)

    S = sim_result.steps_completed
    if S == 0:
        return PENALTY_FITNESS

    distance = sim_result.distance
    energy = sim_result.total_energy / S
    fall_count = sim_result.fall_count
    uprightness = sim_result.uprightness_sum / S

    fitness = distance - alpha * energy - beta * fall_count + gamma * uprightness

    # Velocity consistency bonus (reuse v1 function)
    fitness += compute_velocity_bonus(sim_result, config)

    # Cost of Transport penalty
    cot = compute_cost_of_transport(sim_result)
    fitness -= delta * cot

    # Reactivity bonus (only if perturbation was applied)
    if hasattr(sim_result, 'perturbation_applied') and sim_result.perturbation_applied:
        fitness += compute_reactivity_bonus(sim_result, config)

    return fitness


def evaluate_creature_v2(chromosome, controller_type, terrain_type, config):
    """Full v2 pipeline: chromosome -> controller -> simulate -> fitness.

    Args:
        chromosome: numpy array of normalized [0,1] gene values.
        controller_type: "cpg" or "cpg_nn".
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: dict with all parameters.

    Returns:
        tuple of (fitness_value, SimulationResultV2).
    """
    from src.physics_sim import simulate_v2

    # Check for frozen-NN experiment
    if config.get("frozen_nn", False) and controller_type == "cpg_nn":
        from src.cpgnn_controller import evaluate_frozen_nn
        chromosome = evaluate_frozen_nn(chromosome)

    # Extract optional simulation modifiers from config
    motor_noise = config.get("motor_noise", 0.0)
    perturbation = config.get("perturbation", None)
    record_sensors = config.get("record_sensors", False)

    # Risk 2 mitigation: random perturbations during training evaluation.
    # If perturbation_during_training is True, generate 2-3 random pushes
    # per evaluation to create evolutionary pressure for NN stability.
    # This makes the training environment unpredictable, forcing the NN to
    # learn reactive control rather than ignoring its sensors.
    if config.get("perturbation_during_training", False) and perturbation is None:
        import random as _rng
        sim_time = config.get("simulation_time", 15.0)
        p_range = config.get("perturbation_range", [200, 600])
        n_pushes = _rng.randint(2, 3)
        # Push times: between t=3s and t=(sim_time-3)s, avoiding early/late
        push_times = sorted(_rng.uniform(3.0, sim_time - 3.0)
                            for _ in range(n_pushes))
        perturbation = []
        for pt in push_times:
            magnitude = _rng.uniform(p_range[0], p_range[1])
            direction = _rng.choice([-1, 1])
            perturbation.append({
                "time": pt,
                "impulse": (direction * magnitude, 0),
            })

    sim_result = simulate_v2(
        chromosome, controller_type, terrain_type, config,
        record_sensors=record_sensors,
        motor_noise=motor_noise,
        perturbation=perturbation,
    )

    fitness = compute_fitness_v2(sim_result, config, controller_type)

    # Sanity checks
    if math.isnan(fitness) or math.isinf(fitness):
        logging.warning("NaN/Inf fitness in v2 evaluation, assigning penalty")
        return PENALTY_FITNESS, sim_result

    if abs(fitness) > 100000:
        logging.warning(
            f"Unreasonable v2 fitness {fitness:.2f}, likely physics explosion")
        return PENALTY_FITNESS, sim_result

    return fitness, sim_result
