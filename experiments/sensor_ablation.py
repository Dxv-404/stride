"""Experiment 9 — Sensor Ablation Study (Table 4).

Determines which sensors the CPG+NN neural network actually uses
for motor control by systematically disabling individual sensors
and measuring the resulting fitness drop.

Protocol (from stride_v3.md Section 9):
  - 10 best CPG+NN creatures from cpgnn_flat experiment
  - 8 ablation conditions: 6 individual reduced sensors + 2 pairs
  - 3 trials per ablation condition (flat terrain)
  - Replace ablated sensor with its RUNNING MEAN from unablated sim
    (NOT zero — Errata Fix 2)
  - Report % fitness drop relative to unablated baseline

Ablation conditions:
  1-6: Individual reduced sensors (hip_L_angle, hip_R_angle,
       hip_L_angvel, hip_R_angvel, torso_angle, foot_L_contact)
  7:   Pair — both hip angles (indices 0, 1)
  8:   Pair — both foot contacts (indices 16, 17)

Addition: Open-loop deviation check — compare CPG+NN vs frozen-NN
fitness to validate that the NN is genuinely using sensor feedback.

Test matrix: 10 creatures x 8 conditions x 3 trials = 240 evals
             + 10 creatures x 3 trials baseline = 30 evals
             + 10 creatures x 3 trials frozen = 30 evals
             Total: ~300 evals

Usage:
    python experiments/sensor_ablation.py
    python experiments/sensor_ablation.py --n-creatures 5

Estimated time: ~5-8 minutes
"""

import logging
import math
import os
import pickle
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG, V2_EXPERIMENTS
from src.fitness import compute_fitness_v2, evaluate_creature_v2, PENALTY_FITNESS
from src.physics_sim import simulate_v2
from src.sensors import SENSOR_NAMES, REDUCED_SENSOR_INDICES
from src.cpgnn_controller import evaluate_frozen_nn

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Fixed seed for reproducibility
RNG_SEED = 42

# Number of trials per ablation condition
N_TRIALS = 3

# Ablation conditions: name -> list of FULL sensor indices to override
# The 6 reduced sensors the NN actually sees
INDIVIDUAL_ABLATIONS = {
    "hip_L_angle":    [0],    # reduced idx 0
    "hip_R_angle":    [1],    # reduced idx 1
    "hip_L_angvel":   [6],    # reduced idx 2
    "hip_R_angvel":   [7],    # reduced idx 3
    "torso_angle":    [12],   # reduced idx 4
    "foot_L_contact": [16],   # reduced idx 5
}

PAIR_ABLATIONS = {
    "both_hip_angles":    [0, 1],    # both hip angle sensors
    "both_foot_contacts": [16, 17],  # both foot contacts (17 not in reduced set)
}

ALL_ABLATIONS = {**INDIVIDUAL_ABLATIONS, **PAIR_ABLATIONS}


def load_best_chromosomes(pkl_name, n=10):
    """Load best chromosomes from a completed experiment."""
    pkl_path = RESULTS_DIR / f"{pkl_name}.pkl"
    if not pkl_path.exists():
        print(f"  SKIP: {pkl_path} not found")
        return None

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid = [r for r in runs if r is not None and "best_chromosome" in r]
    valid.sort(key=lambda r: r["best_fitness"], reverse=True)
    top = valid[:n]

    return [(np.array(r["best_chromosome"]), r["best_fitness"]) for r in top]


def evaluate_with_ablation(chromosome, config, sensor_override, n_trials=3):
    """Evaluate a CPG+NN creature with specific sensors overridden.

    Args:
        chromosome: np.ndarray of shape (96,).
        config: experiment config dict.
        sensor_override: dict mapping sensor indices to replacement values.
        n_trials: number of evaluation trials.

    Returns:
        float — mean fitness over trials.
    """
    fitnesses = []
    for _ in range(n_trials):
        sim_result = simulate_v2(
            chromosome, "cpg_nn", "flat", config,
            record_sensors=False,
            sensor_override=sensor_override,
        )
        f = compute_fitness_v2(sim_result, config, "cpg_nn")
        if math.isnan(f) or math.isinf(f):
            f = PENALTY_FITNESS
        fitnesses.append(f)
    return float(np.mean(fitnesses))


def evaluate_baseline(chromosome, config, n_trials=3):
    """Evaluate a CPG+NN creature without ablation (recording sensors).

    Returns:
        tuple of (mean_fitness, mean_sensor_values)
    """
    fitnesses = []
    all_sensor_means = []

    for _ in range(n_trials):
        sim_result = simulate_v2(
            chromosome, "cpg_nn", "flat", config,
            record_sensors=True,
        )
        f = compute_fitness_v2(sim_result, config, "cpg_nn")
        if math.isnan(f) or math.isinf(f):
            f = PENALTY_FITNESS
        fitnesses.append(f)

        # Compute mean sensor values from this trial
        if sim_result.sensor_log:
            trial_mean = np.mean(sim_result.sensor_log, axis=0)
            all_sensor_means.append(trial_mean)

    mean_fitness = float(np.mean(fitnesses))

    # Average the mean sensor values across trials
    if all_sensor_means:
        mean_sensors = np.mean(all_sensor_means, axis=0)
    else:
        mean_sensors = np.zeros(18)

    return mean_fitness, mean_sensors


def evaluate_frozen(chromosome, config, n_trials=3):
    """Evaluate with NN frozen (zero modulation = pure CPG)."""
    frozen_chromo = evaluate_frozen_nn(chromosome)
    fitnesses = []
    for _ in range(n_trials):
        sim_result = simulate_v2(
            frozen_chromo, "cpg_nn", "flat", config,
            record_sensors=False,
        )
        f = compute_fitness_v2(sim_result, config, "cpg_nn")
        if math.isnan(f) or math.isinf(f):
            f = PENALTY_FITNESS
        fitnesses.append(f)
    return float(np.mean(fitnesses))


def run_sensor_ablation(n_creatures=10):
    """Run the full sensor ablation study.

    Returns:
        dict with ablation results, baseline/frozen comparisons.
    """
    np.random.seed(RNG_SEED)

    config = {**BASELINE_CONFIG}

    # Load best CPG+NN creatures (flat-trained)
    chromosomes = load_best_chromosomes("cpgnn_flat", n=n_creatures)
    if chromosomes is None:
        print("  ERROR: No cpgnn_flat.pkl found!")
        return None

    print(f"  Loaded {len(chromosomes)} CPG+NN chromosomes")

    all_results = []

    for ci, (chromo, train_fit) in enumerate(chromosomes):
        print(f"\n  Creature {ci+1}/{len(chromosomes)} "
              f"(train fitness={train_fit:.1f})")

        # Step 1: Baseline evaluation (with sensor recording)
        print("    Baseline ...", end="", flush=True)
        t0 = time.time()
        baseline_fitness, mean_sensors = evaluate_baseline(
            chromo, config, N_TRIALS)
        print(f" {baseline_fitness:.1f} ({time.time()-t0:.1f}s)")

        # Step 2: Frozen-NN evaluation (open-loop deviation check)
        print("    Frozen-NN ...", end="", flush=True)
        t0 = time.time()
        frozen_fitness = evaluate_frozen(chromo, config, N_TRIALS)
        nn_deviation = baseline_fitness - frozen_fitness
        print(f" {frozen_fitness:.1f} (deviation={nn_deviation:.1f}, "
              f"{time.time()-t0:.1f}s)")

        # Step 3: Ablation conditions
        creature_ablations = {}
        for abl_name, abl_indices in ALL_ABLATIONS.items():
            print(f"    Ablate {abl_name} ...", end="", flush=True)
            t0 = time.time()

            # Create sensor override: replace ablated indices with their mean
            override = {idx: float(mean_sensors[idx]) for idx in abl_indices}

            ablated_fitness = evaluate_with_ablation(
                chromo, config, override, N_TRIALS)

            drop = baseline_fitness - ablated_fitness
            drop_pct = (100 * drop / max(abs(baseline_fitness), 0.01)
                        if baseline_fitness != 0 else 0.0)

            creature_ablations[abl_name] = {
                "fitness": ablated_fitness,
                "drop": drop,
                "drop_pct": drop_pct,
                "override_values": {str(k): float(v)
                                    for k, v in override.items()},
            }
            print(f" {ablated_fitness:.1f} (drop={drop_pct:+.1f}%, "
                  f"{time.time()-t0:.1f}s)")

        all_results.append({
            "creature_idx": ci,
            "train_fitness": float(train_fit),
            "baseline_fitness": baseline_fitness,
            "frozen_fitness": frozen_fitness,
            "nn_deviation": nn_deviation,
            "ablations": creature_ablations,
            "mean_sensors": mean_sensors.tolist(),
        })

    return all_results


def print_results_table(results):
    """Print Table 4 format."""
    print(f"\n{'='*90}")
    print("  TABLE 4: Sensor Ablation Results")
    print(f"{'='*90}")
    print(f"{'Sensor':<22} {'Fitness':>10} {'Drop':>10} {'Drop %':>10}")
    print("-" * 90)

    # Average across creatures
    n = len(results)
    baseline_mean = np.mean([r["baseline_fitness"] for r in results])
    frozen_mean = np.mean([r["frozen_fitness"] for r in results])

    print(f"{'Baseline (unablated)':<22} {baseline_mean:>10.1f} {'---':>10} {'---':>10}")
    print(f"{'Frozen-NN (no NN)':<22} {frozen_mean:>10.1f} "
          f"{baseline_mean - frozen_mean:>10.1f} "
          f"{100*(baseline_mean - frozen_mean)/max(abs(baseline_mean), 0.01):>9.1f}%")
    print("-" * 90)

    for abl_name in ALL_ABLATIONS:
        fits = [r["ablations"][abl_name]["fitness"] for r in results]
        drops = [r["ablations"][abl_name]["drop"] for r in results]
        drop_pcts = [r["ablations"][abl_name]["drop_pct"] for r in results]

        print(f"{abl_name:<22} {np.mean(fits):>10.1f} "
              f"{np.mean(drops):>10.1f} {np.mean(drop_pcts):>9.1f}%")

    # Open-loop deviation check
    nn_devs = [r["nn_deviation"] for r in results]
    print(f"\n  Open-loop deviation check:")
    print(f"    Mean NN deviation: {np.mean(nn_devs):.1f} "
          f"+/- {np.std(nn_devs):.1f}")
    if np.mean(nn_devs) > 5:
        print("    --> NN is actively using sensor feedback (deviation > 5)")
    else:
        print("    --> WARNING: Low NN deviation — NN may not be using sensors")

    print(f"{'='*90}\n")


def save_results(results):
    """Save ablation results with metadata."""
    out_data = {
        "results": results,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "rng_seed": RNG_SEED,
            "n_trials": N_TRIALS,
            "n_creatures": len(results),
            "ablation_conditions": {k: v for k, v in ALL_ABLATIONS.items()},
            "reduced_sensor_indices": REDUCED_SENSOR_INDICES,
            "sensor_names": SENSOR_NAMES,
            "method": "running_mean_replacement",
        },
    }

    # Save with spec-expected filename
    out_path = RESULTS_DIR / "ablation_results.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path}")

    # CSV summary
    csv_path = RESULTS_DIR / "table_sensor_ablation.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("sensor,mean_fitness,mean_drop,mean_drop_pct,std_drop_pct\n")
        for abl_name in ALL_ABLATIONS:
            fits = [r["ablations"][abl_name]["fitness"] for r in results]
            drops = [r["ablations"][abl_name]["drop"] for r in results]
            drop_pcts = [r["ablations"][abl_name]["drop_pct"] for r in results]
            f.write(f"{abl_name},{np.mean(fits):.2f},{np.mean(drops):.2f},"
                    f"{np.mean(drop_pcts):.2f},{np.std(drop_pcts):.2f}\n")
    print(f"  Saved: {csv_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="STRIDE Experiment 9 -- Sensor Ablation (Table 4)")
    parser.add_argument(
        "--n-creatures", type=int, default=10,
        help="Number of best creatures to test (default: 10)")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  STRIDE -- Sensor Ablation Study (Experiment 9)")
    print("=" * 60)

    t0 = time.time()
    results = run_sensor_ablation(args.n_creatures)

    if not results:
        print("\n  No results! Run CPG+NN experiments first.")
        return

    print_results_table(results)
    save_results(results)

    elapsed = time.time() - t0
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
