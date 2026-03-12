"""Quick progress checker for running experiments.

Shows:
  - Which experiments have completed .pkl files
  - Which experiments have checkpoint files (in progress)
  - Summary statistics for each

Usage:
    python check_progress.py
"""

import pickle
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Expected experiments
ALGO_COMPARISON = ["baseline", "random_search", "de_baseline",
                   "pso_baseline", "cmaes_baseline"]
PHASE3_EXPERIMENTS = [
    "roulette_selection", "rank_selection",
    "mutation_low", "mutation_high", "mutation_adaptive",
    "no_elitism", "high_elitism",
    "indirect_encoding",
    "hill_terrain", "mixed_terrain",
    "crossover_low", "crossover_high",
    "pop_small", "pop_large",
    "island_model", "fitness_sharing",
]


def check_experiment(name):
    """Check status of one experiment."""
    final = RESULTS_DIR / f"{name}.pkl"
    checkpoint = RESULTS_DIR / f"{name}_checkpoint.pkl"

    if final.exists():
        try:
            with open(final, "rb") as f:
                data = pickle.load(f)
            valid = [r for r in data if r is not None]
            fits = [r["best_fitness"] for r in valid]
            return "DONE", len(valid), np.mean(fits), np.std(fits), max(fits)
        except Exception:
            return "ERROR", 0, 0, 0, 0

    if checkpoint.exists():
        try:
            with open(checkpoint, "rb") as f:
                data = pickle.load(f)
            valid = [r for r in data if r is not None]
            fits = [r["best_fitness"] for r in valid]
            if fits:
                return "IN PROGRESS", len(valid), np.mean(fits), np.std(fits), max(fits)
            return "IN PROGRESS", len(valid), 0, 0, 0
        except Exception:
            return "CHECKPOINT ERROR", 0, 0, 0, 0

    return "NOT STARTED", 0, 0, 0, 0


def main():
    print("=" * 80)
    print("  STRIDE Experiment Progress")
    print("=" * 80)

    print(f"\n  {'Experiment':<25} {'Status':<15} {'Runs':>5} "
          f"{'Mean':>10} {'Std':>8} {'Best':>10}")
    print(f"  {'-'*73}")

    # Algorithm comparison
    print(f"\n  --- Algorithm Comparison ---")
    for name in ALGO_COMPARISON:
        status, n, mean, std, best = check_experiment(name)
        if n > 0:
            print(f"  {name:<25} {status:<15} {n:>5} "
                  f"{mean:>10.2f} {std:>8.2f} {best:>10.2f}")
        else:
            print(f"  {name:<25} {status:<15}")

    # Phase 3
    print(f"\n  --- Phase 3 Experiments ---")
    done_count = 0
    for name in PHASE3_EXPERIMENTS:
        status, n, mean, std, best = check_experiment(name)
        if n > 0:
            print(f"  {name:<25} {status:<15} {n:>5} "
                  f"{mean:>10.2f} {std:>8.2f} {best:>10.2f}")
        else:
            print(f"  {name:<25} {status:<15}")
        if status == "DONE":
            done_count += 1

    # Summary
    total = len(ALGO_COMPARISON) + len(PHASE3_EXPERIMENTS)
    algo_done = sum(1 for name in ALGO_COMPARISON
                    if check_experiment(name)[0] == "DONE")
    p3_done = done_count

    print(f"\n  {'='*73}")
    print(f"  Algorithm comparison: {algo_done}/{len(ALGO_COMPARISON)} complete")
    print(f"  Phase 3 experiments:  {p3_done}/{len(PHASE3_EXPERIMENTS)} complete")
    print(f"  Overall:              {algo_done + p3_done}/{total} complete")
    print(f"  {'='*73}")


if __name__ == "__main__":
    main()
