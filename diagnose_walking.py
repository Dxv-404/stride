"""PRIORITY 1A: Comprehensive diagnosis of creature walking behavior.

Loads the best baseline chromosome and runs detailed analysis:
1. Decode and print joint parameters
2. Full simulation analysis
3. Test with stuck detection disabled
4. Test with extended simulation time
5. Test hand-crafted "ideal walking" chromosome
"""

import math
import pickle
import sys
import copy
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.encoding import decode_direct, decode_indirect
from src.physics_sim import simulate, SimulationResult
from src.fitness import compute_fitness, evaluate_creature
from src.creature import JOINT_NAMES


def load_best_chromosome():
    """Load the best chromosome from baseline.pkl."""
    pkl_path = PROJECT_ROOT / "experiments" / "results" / "baseline.pkl"
    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    best_run = max(runs, key=lambda r: r["best_fitness"])
    return best_run["best_chromosome"], best_run["best_fitness"]


def print_joint_params(joint_params):
    """Print decoded joint parameters in a table."""
    print(f"\n  {'Joint':<12} {'Amplitude':>10} {'Freq (Hz)':>10} {'Phase (rad)':>12} {'Phase (deg)':>12}")
    print(f"  {'-'*58}")
    for i, (amp, freq, phase) in enumerate(joint_params):
        name = JOINT_NAMES[i]
        print(f"  {name:<12} {amp:>10.4f} {freq:>10.3f} {phase:>12.4f} {math.degrees(phase):>12.1f}")

    # Analysis
    print(f"\n  --- Gait Analysis ---")

    # Hip anti-phase check
    hip_L_phase = joint_params[0][2]
    hip_R_phase = joint_params[1][2]
    phase_diff = abs(hip_L_phase - hip_R_phase)
    # Normalize to [0, 2pi]
    phase_diff = phase_diff % (2 * math.pi)
    if phase_diff > math.pi:
        phase_diff = 2 * math.pi - phase_diff
    anti_phase_quality = math.cos(phase_diff - math.pi)  # 1.0 when phase_diff = pi
    print(f"  Hip L-R phase diff: {math.degrees(phase_diff):.1f} deg "
          f"(ideal=180.0) quality={anti_phase_quality:.3f}")

    # Hip frequency check
    hip_L_freq = joint_params[0][1]
    hip_R_freq = joint_params[1][1]
    print(f"  Hip L freq: {hip_L_freq:.2f} Hz, Hip R freq: {hip_R_freq:.2f} Hz")
    walking_range = 0.8 <= hip_L_freq <= 2.5 and 0.8 <= hip_R_freq <= 2.5
    print(f"  Walking range [0.8-2.5 Hz]: {'YES' if walking_range else 'NO'}")

    # Knee-hip coupling check
    for side, hi, ki in [("L", 0, 2), ("R", 1, 3)]:
        hip_phase = joint_params[hi][2]
        knee_phase = joint_params[ki][2]
        coupling = knee_phase - hip_phase
        coupling_norm = coupling % (2 * math.pi)
        coupling_quality = math.cos(coupling_norm - math.pi / 4)
        print(f"  Knee-Hip coupling {side}: {math.degrees(coupling_norm):.1f} deg "
              f"(ideal=45.0) quality={coupling_quality:.3f}")

    # Frequency matching
    for side, hi, ki in [("L", 0, 2), ("R", 1, 3)]:
        hip_f = joint_params[hi][1]
        knee_f = joint_params[ki][1]
        match = 1.0 / (1.0 + abs(hip_f - knee_f))
        print(f"  Freq match {side}: hip={hip_f:.2f} knee={knee_f:.2f} "
              f"diff={abs(hip_f-knee_f):.2f} match={match:.3f}")


def analyze_simulation(sim_result, config, label=""):
    """Print detailed simulation analysis."""
    S = sim_result.steps_completed
    total = int(config["simulation_time"] * config["simulation_fps"])

    print(f"\n  --- Simulation Analysis{' (' + label + ')' if label else ''} ---")
    print(f"  Steps completed: {S}/{total} "
          f"({S/total*100:.1f}%)")
    print(f"  Terminated early: {sim_result.terminated_early}")
    print(f"  Termination reason: {sim_result.termination_reason}")

    if not sim_result.torso_positions:
        print(f"  NO POSITION DATA")
        return

    positions = sim_result.torso_positions
    final_x = positions[-1][0]
    final_y = positions[-1][1]
    initial_x = positions[0][0]
    max_x = max(x for x, y in positions)
    min_y = min(y for x, y in positions)
    max_y = max(y for x, y in positions)
    avg_y = sum(y for x, y in positions) / len(positions)

    print(f"  Initial X: {initial_x:.1f}")
    print(f"  Final X: {final_x:.1f}")
    print(f"  Max X reached: {max_x:.1f}")
    print(f"  Distance: {sim_result.distance:.2f} px")

    print(f"  Y range: [{min_y:.1f}, {max_y:.1f}], avg={avg_y:.1f}")

    # Torso angle analysis
    angles = sim_result.torso_angles
    avg_angle = sum(abs(a) for a in angles) / len(angles)
    max_angle = max(abs(a) for a in angles)
    print(f"  Avg |torso angle|: {math.degrees(avg_angle):.1f} deg "
          f"(0=upright)")
    print(f"  Max |torso angle|: {math.degrees(max_angle):.1f} deg")

    # Forward/backward/stationary analysis
    forward = 0
    backward = 0
    stationary = 0
    for i in range(1, len(positions)):
        dx = positions[i][0] - positions[i-1][0]
        if dx > 0.1:
            forward += 1
        elif dx < -0.1:
            backward += 1
        else:
            stationary += 1

    total_movement = forward + backward + stationary
    print(f"  Forward frames: {forward}/{total_movement} ({forward/total_movement*100:.1f}%)")
    print(f"  Backward frames: {backward}/{total_movement} ({backward/total_movement*100:.1f}%)")
    print(f"  Stationary frames: {stationary}/{total_movement} ({stationary/total_movement*100:.1f}%)")

    # Velocity analysis
    velocities = []
    for i in range(1, len(positions)):
        vx = (positions[i][0] - positions[i-1][0]) * config["simulation_fps"]
        velocities.append(vx)

    if velocities:
        avg_vx = sum(velocities) / len(velocities)
        max_vx = max(velocities)
        print(f"  Avg forward velocity: {avg_vx:.1f} px/s")
        print(f"  Max forward velocity: {max_vx:.1f} px/s")

    # Fitness breakdown
    S_val = S
    energy = sim_result.total_energy / S_val
    fall = sim_result.fall_count
    upright = sim_result.uprightness_sum / S_val
    w = config["fitness_weights"]

    print(f"\n  --- Fitness Breakdown ---")
    print(f"  Distance component:    {sim_result.distance:>+10.2f}")
    print(f"  Energy penalty:        {-w['alpha'] * energy:>+10.2f} "
          f"(raw energy={energy:.2f})")
    print(f"  Fall penalty:          {-w['beta'] * fall:>+10.2f} "
          f"(fall_count={fall})")
    print(f"  Uprightness bonus:     {+w['gamma'] * upright:>+10.2f} "
          f"(avg_upright={upright:.4f})")
    fitness = compute_fitness(sim_result, config)
    print(f"  TOTAL FITNESS:         {fitness:>+10.2f}")

    return fitness


def create_ideal_chromosome():
    """Create a hand-crafted 'ideal walking' chromosome.

    Target joint parameters:
    - Left hip:    amp=0.8, freq=1.5Hz, phase=0
    - Right hip:   amp=0.8, freq=1.5Hz, phase=pi
    - Left knee:   amp=0.4, freq=1.5Hz, phase=pi/4
    - Right knee:  amp=0.4, freq=1.5Hz, phase=pi+pi/4
    - Left shldr:  amp=0.3, freq=1.5Hz, phase=pi/2
    - Right shldr: amp=0.3, freq=1.5Hz, phase=3*pi/2

    Encoding ranges:
    - amp: gene * (pi/2)         → gene = amp / (pi/2)
    - freq: gene * 4.5 + 0.5    → gene = (freq - 0.5) / 4.5
    - phase: gene * (2*pi)       → gene = phase / (2*pi)
    """
    genes = np.zeros(18)

    targets = [
        (0.8, 1.5, 0.0),                        # hip_L
        (0.8, 1.5, math.pi),                     # hip_R
        (0.4, 1.5, math.pi / 4),                 # knee_L
        (0.4, 1.5, math.pi + math.pi / 4),       # knee_R
        (0.3, 1.5, math.pi / 2),                 # shoulder_L
        (0.3, 1.5, 3 * math.pi / 2),             # shoulder_R
    ]

    for i, (amp, freq, phase) in enumerate(targets):
        genes[i * 3 + 0] = amp / (math.pi / 2)        # normalize amp
        genes[i * 3 + 1] = (freq - 0.5) / 4.5         # normalize freq
        genes[i * 3 + 2] = phase / (2 * math.pi)       # normalize phase

    # Clamp to [0, 1]
    genes = np.clip(genes, 0.0, 1.0)
    return genes


def simulate_with_config(chromosome, config, encoding="direct"):
    """Simulate a chromosome and return (fitness, sim_result)."""
    joint_params = decode_direct(chromosome) if encoding == "direct" else decode_indirect(chromosome)
    sim_result = simulate(joint_params, config["terrain"], config)
    fitness = compute_fitness(sim_result, config)
    return fitness, sim_result


def main():
    print("=" * 70)
    print("  STRIDE Walking Diagnosis")
    print("=" * 70)

    # =====================================================================
    # STEP 1: Load and decode best chromosome
    # =====================================================================
    print("\n[1] Loading best baseline chromosome...")
    chromo, recorded_fitness = load_best_chromosome()
    print(f"  Recorded fitness: {recorded_fitness:.2f}")
    print(f"  Chromosome length: {len(chromo)}")

    joint_params = decode_direct(chromo)
    print_joint_params(joint_params)

    # =====================================================================
    # STEP 2: Full simulation analysis
    # =====================================================================
    print("\n[2] Simulating best chromosome (normal settings)...")
    config = {**BASELINE_CONFIG}
    fitness_normal, sim_normal = simulate_with_config(chromo, config)
    analyze_simulation(sim_normal, config, "normal")

    # =====================================================================
    # STEP 3: Simulate with stuck detection DISABLED
    # =====================================================================
    print("\n[3] Simulating with stuck detection DISABLED...")
    config_no_stuck = {**BASELINE_CONFIG}
    config_no_stuck["stuck_threshold"] = 0  # 0 means any movement counts
    # Actually, we need to set it very high to effectively disable
    config_no_stuck["stuck_threshold"] = 999999  # Effectively disabled

    fitness_no_stuck, sim_no_stuck = simulate_with_config(chromo, config_no_stuck)
    analyze_simulation(sim_no_stuck, config_no_stuck, "no stuck detection")

    stuck_cost = sim_no_stuck.distance - sim_normal.distance
    print(f"\n  >>> Stuck detection cost: {stuck_cost:.2f} px of travel")
    print(f"  >>> Fitness diff: {fitness_no_stuck - fitness_normal:.2f}")

    # =====================================================================
    # STEP 4: Extended time (15s) with stuck detection disabled
    # =====================================================================
    print("\n[4] Simulating with 15s time + no stuck detection...")
    config_extended = {**config_no_stuck}
    config_extended["simulation_time"] = 15.0

    fitness_extended, sim_extended = simulate_with_config(chromo, config_extended)
    analyze_simulation(sim_extended, config_extended, "15s, no stuck")

    time_gain = sim_extended.distance - sim_no_stuck.distance
    print(f"\n  >>> Extended time gained: {time_gain:.2f} additional px")
    print(f"  >>> Fitness diff (vs no-stuck 10s): {fitness_extended - fitness_no_stuck:.2f}")

    # =====================================================================
    # STEP 5: Hand-crafted "ideal walking" chromosome
    # =====================================================================
    print("\n[5] Testing hand-crafted 'ideal walking' chromosome...")
    ideal_chromo = create_ideal_chromosome()
    ideal_params = decode_direct(ideal_chromo)
    print_joint_params(ideal_params)

    print("\n  5a. With NORMAL settings:")
    fitness_ideal_normal, sim_ideal_normal = simulate_with_config(ideal_chromo, config)
    analyze_simulation(sim_ideal_normal, config, "ideal, normal settings")

    print("\n  5b. With no stuck + 15s:")
    fitness_ideal_extended, sim_ideal_extended = simulate_with_config(
        ideal_chromo, config_extended)
    analyze_simulation(sim_ideal_extended, config_extended, "ideal, 15s, no stuck")

    # =====================================================================
    # STEP 6: Test motor strength
    # =====================================================================
    print("\n[6] Testing motor strength (2x force)...")
    # We can't easily change motor force without modifying creature.py,
    # but we can test by increasing the gain factor
    # For now, report current motor settings
    print(f"  Current motor max_force: 50000")
    print(f"  Current motor gain: 5.0 (in creature.update_motors)")
    print(f"  Motor equation: rate = target_angle * 5.0")
    print(f"  Target angle: amp * sin(2*pi*freq*t + phase)")

    # Test: what's the max motor rate being commanded?
    max_amp = max(amp for amp, _, _ in joint_params)
    max_rate = max_amp * 5.0
    print(f"  Max commanded rate: {max_amp:.3f} * 5.0 = {max_rate:.2f} rad/s")

    # =====================================================================
    # DIAGNOSIS SUMMARY
    # =====================================================================
    print("\n" + "=" * 70)
    print("  DIAGNOSIS SUMMARY")
    print("=" * 70)

    # Stuck detection impact
    if sim_normal.termination_reason == "stuck":
        steps_lost = sim_no_stuck.steps_completed - sim_normal.steps_completed
        total_steps = int(config["simulation_time"] * config["simulation_fps"])
        pct_lost = steps_lost / total_steps * 100
        print(f"  Stuck detection impact: HIGH")
        print(f"    - Terminated at step {sim_normal.steps_completed}/{total_steps}")
        print(f"    - Lost {steps_lost} steps ({pct_lost:.1f}%) of simulation")
        print(f"    - Cost {stuck_cost:.1f} px of distance")
    else:
        print(f"  Stuck detection impact: LOW (did not trigger)")

    # Motor strength
    ideal_distance = sim_ideal_extended.distance
    if ideal_distance > 200:
        print(f"  Motor strength: SUFFICIENT (ideal chromo traveled {ideal_distance:.1f} px)")
    elif ideal_distance > 50:
        print(f"  Motor strength: MARGINAL (ideal chromo only traveled {ideal_distance:.1f} px)")
    else:
        print(f"  Motor strength: INSUFFICIENT (ideal chromo only traveled {ideal_distance:.1f} px)")

    # Frequency range
    all_freqs = [f for _, f, _ in joint_params]
    max_freq = max(all_freqs)
    min_freq = min(all_freqs)
    if max_freq > 3.0:
        print(f"  Frequency range: TOO WIDE (evolved max={max_freq:.2f} Hz, "
              f"human walking is 0.8-2.5 Hz)")
    else:
        print(f"  Frequency range: APPROPRIATE (range [{min_freq:.2f}, {max_freq:.2f}] Hz)")

    # Root cause assessment
    print(f"\n  ROOT CAUSE ASSESSMENT:")
    causes = []
    if sim_normal.termination_reason == "stuck":
        causes.append("stuck detection killing walkers prematurely")
    if ideal_distance < 100:
        causes.append("motors too weak for effective locomotion")
    if max_freq > 3.0:
        causes.append("frequency range allows non-walking spasming")
    if not causes:
        if fitness_normal < 200:
            causes.append("fitness landscape needs more guidance (gait bonus)")
        else:
            causes.append("walking is actually decent, just needs polish")

    for i, cause in enumerate(causes):
        print(f"    {i+1}. {cause}")

    print(f"\n  RECOMMENDATIONS:")
    print(f"    1. {'DISABLE' if sim_normal.termination_reason == 'stuck' else 'KEEP'} stuck detection")
    print(f"    2. INCREASE simulation time to 15s")
    print(f"    3. NARROW frequency range to [0.3, 3.0] Hz")
    print(f"    4. {'INCREASE' if ideal_distance < 100 else 'KEEP'} motor strength")
    print(f"    5. ADD gait coordination bonus to fitness")
    print(f"    6. ADD forward velocity bonus to fitness")

    print(f"\n{'='*70}")


if __name__ == "__main__":
    main()
