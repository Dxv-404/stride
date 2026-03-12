"""PRIORITY 1C: Validate all walking fixes.

1. Re-run hand-crafted ideal chromosome
2. Run quick GA (pop=50, gen=75)
3. Analyze best evolved creature
4. Compare old vs new settings
"""

import math
import sys
import time
import copy
import random
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.encoding import decode_direct
from src.physics_sim import simulate
from src.fitness import compute_fitness, evaluate_creature, safe_evaluate
from src.creature import JOINT_NAMES
from src.ga_core import run_ga


def create_ideal_chromosome():
    """Create hand-crafted 'ideal walking' chromosome (NEW encoding ranges)."""
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
        genes[i * 3 + 0] = amp / (math.pi / 2)        # amp: [0, pi/2]
        genes[i * 3 + 1] = (freq - 0.3) / 2.7          # freq: [0.3, 3.0] NEW
        genes[i * 3 + 2] = phase / (2 * math.pi)       # phase: [0, 2*pi]
    return np.clip(genes, 0.0, 1.0)


def analyze_result(chromosome, config, label=""):
    """Simulate and print analysis."""
    encoding = config.get("encoding", "direct")
    joint_params = decode_direct(chromosome)
    sim_result = simulate(joint_params, config["terrain"], config)
    fitness = compute_fitness(sim_result, config, joint_params=joint_params)

    S = sim_result.steps_completed
    total = int(config["simulation_time"] * config["simulation_fps"])

    print(f"\n  --- {label} ---")
    print(f"  Steps: {S}/{total} ({S/total*100:.1f}%)")
    print(f"  Terminated: {sim_result.terminated_early} ({sim_result.termination_reason})")

    if sim_result.torso_positions:
        positions = sim_result.torso_positions
        print(f"  Distance: {sim_result.distance:.2f} px")
        print(f"  Avg Y: {sum(y for x,y in positions)/len(positions):.1f}")

        angles = sim_result.torso_angles
        avg_angle = sum(abs(a) for a in angles) / len(angles)
        print(f"  Avg |angle|: {math.degrees(avg_angle):.1f} deg")

        # Forward velocity
        forward = sum(1 for i in range(1, len(positions))
                      if positions[i][0] - positions[i-1][0] > 0.1)
        print(f"  Forward frames: {forward}/{len(positions)-1} ({forward/(len(positions)-1)*100:.1f}%)")

        avg_vx = sim_result.distance / (S / config["simulation_fps"])
        print(f"  Avg velocity: {avg_vx:.1f} px/s")

    print(f"  FITNESS: {fitness:.2f}")
    return fitness


def main():
    print("=" * 70)
    print("  STRIDE Fix Validation (Priority 1C)")
    print("=" * 70)

    config = {**BASELINE_CONFIG}

    # =====================================================================
    # TEST 1: Hand-crafted ideal chromosome with new settings
    # =====================================================================
    print("\n[TEST 1] Hand-crafted 'ideal walking' chromosome")
    ideal = create_ideal_chromosome()

    # Decode and show params
    params = decode_direct(ideal)
    print(f"\n  Joint Parameters:")
    for i, (amp, freq, phase) in enumerate(params):
        print(f"    {JOINT_NAMES[i]:<12} amp={amp:.3f} freq={freq:.3f} phase={math.degrees(phase):.1f}")

    fitness_ideal = analyze_result(ideal, config, "Ideal, NEW settings")

    if fitness_ideal > 50:
        print(f"\n  >>> IDEAL CHROMOSOME WORKS! fitness={fitness_ideal:.2f}")
    elif fitness_ideal > 10:
        print(f"\n  >>> MARGINAL IMPROVEMENT. fitness={fitness_ideal:.2f}")
    else:
        print(f"\n  >>> STILL NOT WALKING. fitness={fitness_ideal:.2f}")
        print(f"      May need further motor tuning.")

    # =====================================================================
    # TEST 2: Quick GA run (pop=50, gen=75)
    # =====================================================================
    print("\n\n[TEST 2] Quick GA run (pop=50, gen=75)")
    quick_config = {**config}
    quick_config["population_size"] = 50
    quick_config["max_generations"] = 75

    print("  Running GA (this may take a few minutes)...")
    t0 = time.time()
    result = run_ga(quick_config, seed=42)
    elapsed = time.time() - t0
    print(f"  Completed in {elapsed:.1f}s")

    print(f"\n  Best fitness: {result['best_fitness']:.2f}")

    # Show convergence at key generations
    conv = result.get("convergence_history", result.get("best_fitness_per_gen", []))
    if conv:
        checkpoints = [0, 24, 49, 74]
        for g in checkpoints:
            if g < len(conv):
                print(f"    Gen {g+1:>3}: {conv[g]:.2f}")

    # =====================================================================
    # TEST 3: Analyze best evolved chromosome
    # =====================================================================
    print("\n\n[TEST 3] Analyzing best evolved chromosome")
    best_chromo = result["best_chromosome"]
    best_params = decode_direct(best_chromo)

    print(f"\n  Decoded joint parameters:")
    for i, (amp, freq, phase) in enumerate(best_params):
        print(f"    {JOINT_NAMES[i]:<12} amp={amp:.3f} freq={freq:.3f} phase={math.degrees(phase):.1f}")

    # Gait analysis
    hip_L_phase = best_params[0][2]
    hip_R_phase = best_params[1][2]
    phase_diff = abs(hip_L_phase - hip_R_phase) % (2 * math.pi)
    if phase_diff > math.pi:
        phase_diff = 2 * math.pi - phase_diff
    print(f"\n  Hip L-R phase diff: {math.degrees(phase_diff):.1f} deg (ideal=180)")

    hip_L_freq = best_params[0][1]
    hip_R_freq = best_params[1][1]
    print(f"  Hip freqs: L={hip_L_freq:.2f} R={hip_R_freq:.2f} Hz")

    fitness_new = analyze_result(best_chromo, config, "Best evolved, NEW settings")

    # =====================================================================
    # TEST 4: Compare — run old best on OLD vs NEW settings
    # =====================================================================
    print("\n\n[TEST 4] Comparison: old best chromosome on new settings")
    fitness_old_on_new = None
    old_recorded = None

    try:
        import pickle
        pkl_path = PROJECT_ROOT / "experiments" / "results" / "baseline.pkl"
        with open(pkl_path, "rb") as f:
            runs = pickle.load(f)
        old_best = max(runs, key=lambda r: r["best_fitness"])
        old_chromo = old_best["best_chromosome"]
        old_recorded = old_best["best_fitness"]

        print(f"  Old recorded fitness: {old_recorded:.2f}")

        # Run old chromosome on NEW settings (it was optimized for old encoding)
        # Note: the freq range changed, so the same genes decode differently now
        fitness_old_on_new = analyze_result(old_chromo, config,
                                            "OLD chromo on NEW settings")
    except FileNotFoundError:
        print("  (baseline.pkl not found — skipping old chromosome comparison)")
    except Exception as e:
        print(f"  (Error loading old baseline: {e})")

    # =====================================================================
    # SUMMARY
    # =====================================================================
    print("\n\n" + "=" * 70)
    print("  VALIDATION SUMMARY")
    print("=" * 70)
    print(f"  Ideal chromo fitness:     {fitness_ideal:>10.2f} (was 8.09)")
    print(f"  Quick GA best fitness:    {fitness_new:>10.2f} (was ~198)")
    if fitness_old_on_new is not None:
        print(f"  Old chromo on new config: {fitness_old_on_new:>10.2f} (was {old_recorded:.2f})")
    else:
        print(f"  Old chromo on new config:  N/A")

    if fitness_new > 250:
        print(f"\n  VERDICT: SIGNIFICANT IMPROVEMENT — ready to re-run baseline_v2")
    elif fitness_new > 150:
        print(f"\n  VERDICT: MODERATE IMPROVEMENT — consider further tuning")
    else:
        print(f"\n  VERDICT: INSUFFICIENT IMPROVEMENT — needs more motor work")

    print("=" * 70)


if __name__ == "__main__":
    main()
