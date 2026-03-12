"""Experiment 7 — Transfer Testing (Table 2).

Tests how well controllers trained on one terrain generalize to others.

Protocol (from stride_v3.md Section 9):
  - Best chromosome from each of 30 runs per controller type
  - Test on 5 conditions: flat, hill, mixed, motor_noise_5%, motor_noise_10%
  - Deterministic conditions: 3 evaluations per chromosome (take mean)
  - Noise conditions: 10 evaluations per chromosome (higher variance)
  - Report absolute fitness and retention rate

Additions over spec:
  - Fixed seeds for reproducibility
  - 10 trials for noise conditions (statistical power)
  - Simulator consistency check (sine via v1 vs v2 comparison)
  - Metadata in output pkl

Controllers tested:
  - Sine (v1 baseline, flat-trained)
  - CPG (flat-trained)
  - CPG+NN flat-trained
  - CPG+NN mixed-trained

Usage:
    python experiments/transfer_test.py
    python experiments/transfer_test.py --controllers sine cpg cpgnn_flat
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
from src.fitness import evaluate_creature_v2, compute_fitness, PENALTY_FITNESS
from src.physics_sim import simulate, simulate_v2
from src.encoding import decode_direct

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Controller definitions: name -> (pkl_file, controller_type, encoding)
CONTROLLER_DEFS = {
    "sine":         ("baseline",      "sine",   "direct"),
    "cpg":          ("cpg_baseline",  "cpg",    "cpg"),
    "cpgnn_flat":   ("cpgnn_flat",    "cpg_nn", "cpg_nn"),
    "cpgnn_mixed":  ("cpgnn_mixed",   "cpg_nn", "cpg_nn"),
}

# Test conditions: name -> (terrain, motor_noise, n_evals)
# Noise conditions get 10 trials for statistical power (higher variance)
TEST_CONDITIONS = {
    "flat":       ("flat",  0.0,  3),
    "hill":       ("hill",  0.0,  3),
    "mixed":      ("mixed", 0.0,  3),
    "noise_5":    ("flat",  0.05, 10),
    "noise_10":   ("flat",  0.10, 10),
}

# Fixed seed for reproducibility
RNG_SEED = 42


def load_best_chromosomes(pkl_name, n=30):
    """Load best chromosomes from a completed experiment."""
    pkl_path = RESULTS_DIR / f"{pkl_name}.pkl"
    if not pkl_path.exists():
        print(f"  SKIP: {pkl_path} not found")
        return None

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid = [r for r in runs if r is not None and "best_chromosome" in r]
    # Sort by fitness descending, take top n
    valid.sort(key=lambda r: r["best_fitness"], reverse=True)
    top = valid[:n]

    return [(np.array(r["best_chromosome"]), r["best_fitness"]) for r in top]


def evaluate_sine_on_terrain(chromosome, terrain, config, motor_noise=0.0):
    """Evaluate a v1 sine chromosome on a given terrain.

    Uses v1 simulate() for consistency with training.
    NOTE: This means sine uses a different simulator than CPG/CPG+NN.
    The simulator_consistency_check() validates this doesn't bias results.
    """
    joint_params = decode_direct(chromosome)
    sim_result = simulate(joint_params, terrain, config)
    fitness = compute_fitness(sim_result, config)
    return fitness


def evaluate_on_condition(chromosome, controller_type, condition_name, config,
                          rng=None):
    """Evaluate a chromosome on a test condition.

    Returns mean fitness over n_evals evaluations.
    Uses fixed RNG seed for noise conditions to ensure reproducibility.
    """
    terrain, motor_noise, n_evals = TEST_CONDITIONS[condition_name]

    fitnesses = []
    for trial in range(n_evals):
        # Set seed per-trial for noise conditions
        if motor_noise > 0 and rng is not None:
            np.random.seed(rng.integers(0, 2**31))

        if controller_type == "sine":
            f = evaluate_sine_on_terrain(chromosome, terrain, config, motor_noise)
        else:
            test_config = {**config, "motor_noise": motor_noise}
            f, _ = evaluate_creature_v2(
                chromosome, controller_type, terrain, test_config)

        if math.isnan(f) or math.isinf(f):
            f = PENALTY_FITNESS
        fitnesses.append(f)

    return float(np.mean(fitnesses)), float(np.std(fitnesses))


def simulator_consistency_check(config, n_check=10):
    """Check that sine via v1 simulate() vs CPG-wrapped sine produce similar results.

    Sine controllers are evaluated with v1 simulate() (to match training),
    while CPG/CPG+NN use v2 simulate_v2(). This check validates that the
    two simulators produce comparable results for the same walking pattern.

    Returns Spearman rank correlation between v1 and v2 fitness values.
    """
    from scipy.stats import spearmanr

    pkl_path = RESULTS_DIR / "baseline.pkl"
    if not pkl_path.exists():
        print("  SKIP consistency check: no baseline.pkl")
        return None

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid = [r for r in runs if r is not None and "best_chromosome" in r]
    valid.sort(key=lambda r: r["best_fitness"], reverse=True)
    check_chromos = [np.array(r["best_chromosome"]) for r in valid[:n_check]]

    v1_fits, v2_fits = [], []
    for chromo in check_chromos:
        # V1 path: decode -> simulate -> compute_fitness
        jp = decode_direct(chromo)
        sr1 = simulate(jp, "flat", config)
        f1 = compute_fitness(sr1, config)
        v1_fits.append(f1)

        # V2 path: wrap as CPG with neutral coupling
        cpg_chromo = np.zeros(38, dtype=np.float64)
        cpg_chromo[:18] = chromo[:18]
        cpg_chromo[18:38] = 0.5  # neutral coupling
        f2, _ = evaluate_creature_v2(cpg_chromo, "cpg", "flat", config)
        v2_fits.append(f2)

    rho, p_value = spearmanr(v1_fits, v2_fits)
    mean_diff = np.mean(np.abs(np.array(v1_fits) - np.array(v2_fits)))

    print(f"\n  Simulator Consistency Check (n={n_check}):")
    print(f"    Spearman rho = {rho:.4f} (p={p_value:.4f})")
    print(f"    Mean absolute fitness diff = {mean_diff:.2f}")
    if rho < 0.9:
        print("    WARNING: Low correlation. Note in Threats to Validity.")

    return {"rho": rho, "p_value": p_value, "mean_abs_diff": mean_diff,
            "v1_fits": v1_fits, "v2_fits": v2_fits}


def run_transfer_test(controller_names=None):
    """Run the full transfer test protocol.

    Returns:
        dict: controller_name -> {condition_name -> list of 30 fitness values}
    """
    if controller_names is None:
        controller_names = list(CONTROLLER_DEFS.keys())

    config = {**BASELINE_CONFIG}
    rng = np.random.default_rng(RNG_SEED)

    all_results = {}

    for ctrl_name in controller_names:
        if ctrl_name not in CONTROLLER_DEFS:
            print(f"  SKIP: Unknown controller '{ctrl_name}'")
            continue

        pkl_name, ctrl_type, encoding = CONTROLLER_DEFS[ctrl_name]
        print(f"\n  Testing: {ctrl_name} (from {pkl_name}.pkl)")

        chromosomes = load_best_chromosomes(pkl_name)
        if chromosomes is None:
            continue

        print(f"    Loaded {len(chromosomes)} chromosomes")

        ctrl_results = {}
        for cond_name in TEST_CONDITIONS:
            terrain, noise, n_evals = TEST_CONDITIONS[cond_name]
            print(f"    Condition: {cond_name} (n={n_evals}) ...",
                  end="", flush=True)
            t0 = time.time()

            cond_fitnesses = []
            for chromo, train_fit in chromosomes:
                mean_f, std_f = evaluate_on_condition(
                    chromo, ctrl_type, cond_name, config, rng)
                cond_fitnesses.append(mean_f)

            elapsed = time.time() - t0
            mean_fit = np.mean(cond_fitnesses)
            std_fit = np.std(cond_fitnesses)
            print(f" {mean_fit:.2f} +/- {std_fit:.2f} ({elapsed:.1f}s)")

            ctrl_results[cond_name] = cond_fitnesses

        all_results[ctrl_name] = ctrl_results

    return all_results


def compute_retention_rates(results):
    """Compute retention rates: test_fitness / flat_test_fitness.

    Uses flat TEST fitness as denominator for ALL controllers
    (not training fitness — spec fix for mixed-trained controllers).
    """
    retention = {}
    for ctrl_name, conditions in results.items():
        flat_fits = conditions.get("flat", [])
        if not flat_fits:
            continue

        ctrl_retention = {}
        for cond_name, fits in conditions.items():
            # Per-chromosome retention: test_i / flat_i
            per_chromo = []
            for i in range(min(len(fits), len(flat_fits))):
                if flat_fits[i] > 0:
                    per_chromo.append(fits[i] / flat_fits[i])
                else:
                    per_chromo.append(0.0)
            ctrl_retention[cond_name] = per_chromo

        retention[ctrl_name] = ctrl_retention

    return retention


def print_results_table(results, retention):
    """Print Table 2 format."""
    print(f"\n{'='*90}")
    print("  TABLE 2: Transfer Testing -- Absolute Fitness")
    print(f"{'='*90}")
    print(f"{'Controller':<20}", end="")
    for cond in TEST_CONDITIONS:
        print(f"  {cond:>12}", end="")
    print()
    print("-" * 90)

    for ctrl_name in results:
        print(f"{ctrl_name:<20}", end="")
        for cond_name in TEST_CONDITIONS:
            fits = results[ctrl_name].get(cond_name, [])
            if fits:
                print(f"  {np.mean(fits):>6.1f}+/-{np.std(fits):>4.1f}", end="")
            else:
                print(f"  {'---':>12}", end="")
        print()

    print(f"\n{'='*90}")
    print("  Retention Rate (test / flat_test)")
    print(f"{'='*90}")
    print(f"{'Controller':<20}", end="")
    for cond in TEST_CONDITIONS:
        print(f"  {cond:>12}", end="")
    print()
    print("-" * 90)

    for ctrl_name in retention:
        print(f"{ctrl_name:<20}", end="")
        for cond_name in TEST_CONDITIONS:
            rates = retention[ctrl_name].get(cond_name, [])
            if rates:
                print(f"  {np.mean(rates):>10.1%}  ", end="")
            else:
                print(f"  {'---':>12}", end="")
        print()
    print(f"{'='*90}\n")


def save_results(results, retention, consistency=None):
    """Save transfer test results to pickle and CSV with metadata."""
    out_data = {
        "absolute": results,
        "retention": retention,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "rng_seed": RNG_SEED,
            "test_conditions": {k: {"terrain": v[0], "noise": v[1], "n_evals": v[2]}
                                for k, v in TEST_CONDITIONS.items()},
            "n_controllers": len(results),
            "controllers": list(results.keys()),
        },
    }
    if consistency is not None:
        out_data["simulator_consistency"] = consistency

    # Save with spec-expected filename
    out_path = RESULTS_DIR / "transfer_results.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path}")

    # Also save with the old name for backward compatibility
    out_path2 = RESULTS_DIR / "transfer_test_results.pkl"
    with open(out_path2, "wb") as f:
        pickle.dump(out_data, f)

    # CSV: absolute fitness
    csv_path = RESULTS_DIR / "table_transfer_absolute.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        conds = list(TEST_CONDITIONS.keys())
        f.write("controller," + ",".join(f"{c}_mean,{c}_std" for c in conds) + "\n")
        for ctrl_name, conditions in results.items():
            row = [ctrl_name]
            for cond in conds:
                fits = conditions.get(cond, [])
                if fits:
                    row.extend([f"{np.mean(fits):.2f}", f"{np.std(fits):.2f}"])
                else:
                    row.extend(["N/A", "N/A"])
            f.write(",".join(row) + "\n")
    print(f"  Saved: {csv_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="STRIDE Experiment 7 -- Transfer Testing (Table 2)")
    parser.add_argument(
        "--controllers", nargs="+", type=str,
        default=None,
        help="Controllers to test (default: all available)")
    parser.add_argument(
        "--skip-consistency", action="store_true",
        help="Skip simulator consistency check")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  STRIDE -- Transfer Testing (Experiment 7)")
    print("=" * 60)

    t0 = time.time()

    # Simulator consistency check (sine v1 vs v2)
    consistency = None
    if not args.skip_consistency:
        consistency = simulator_consistency_check({**BASELINE_CONFIG})

    results = run_transfer_test(args.controllers)

    if not results:
        print("\n  No results! Run GA experiments first.")
        return

    retention = compute_retention_rates(results)
    print_results_table(results, retention)
    save_results(results, retention, consistency)

    elapsed = time.time() - t0
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
