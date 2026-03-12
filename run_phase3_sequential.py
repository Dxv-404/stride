"""Run Phase 3 experiments sequentially with new physics.

Re-runs all GA variant experiments (selection, mutation, crossover,
elitism, encoding, terrain, population size, advanced) that were
invalidated when we fixed the creature physics.

Skips baseline and random_search (handled by run_all_sequential.py).
Uses checkpointing to resume if interrupted.
"""

import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import EXPERIMENTS, PRIORITY_P0, PRIORITY_P1, PRIORITY_P2
from src.ga_core import run_ga
from src.random_search import random_search

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def run_sequential(name, config, n_runs=30):
    """Run an experiment n_runs times with checkpointing."""
    is_random = config.get("method", "ga") == "random"
    run_fn = random_search if is_random else run_ga

    final_path = RESULTS_DIR / f"{name}.pkl"
    checkpoint_path = RESULTS_DIR / f"{name}_checkpoint.pkl"

    # Check if already complete
    if final_path.exists():
        try:
            with open(final_path, "rb") as f:
                existing = pickle.load(f)
            if len(existing) >= n_runs:
                fits = [r["best_fitness"] for r in existing if r]
                print(f"  {name}: DONE ({len(existing)} runs, "
                      f"mean={np.mean(fits):.2f} +/- {np.std(fits):.2f})")
                return existing
        except Exception:
            pass

    # Resume from checkpoint
    completed = []
    if checkpoint_path.exists():
        try:
            with open(checkpoint_path, "rb") as f:
                completed = pickle.load(f)
            print(f"  {name}: Resuming from run {len(completed)}/{n_runs}")
        except Exception:
            completed = []

    seed_start = config.get("seed_start", 42)

    for i in range(len(completed), n_runs):
        seed = seed_start + i
        t0 = time.time()
        try:
            result = run_fn(config, seed)
            completed.append(result)
            elapsed = time.time() - t0
            fit = result["best_fitness"] if result else -999
            print(f"    Run {i + 1}/{n_runs}: fitness={fit:.2f} ({elapsed:.0f}s)")
        except Exception as e:
            print(f"    Run {i + 1}/{n_runs}: FAILED ({e})")
            completed.append(None)

        # Checkpoint every 5 runs
        if len(completed) % 5 == 0:
            with open(checkpoint_path, "wb") as f:
                pickle.dump(completed, f)

    # Save final results
    valid = [r for r in completed if r is not None]
    with open(final_path, "wb") as f:
        pickle.dump(valid, f)

    # Clean up checkpoint
    if checkpoint_path.exists():
        os.remove(checkpoint_path)
    bak = str(checkpoint_path) + ".bak"
    if os.path.exists(bak):
        os.remove(bak)

    fits = [r["best_fitness"] for r in valid]
    print(f"  {name}: {len(valid)}/{n_runs} runs | "
          f"mean={np.mean(fits):.2f} +/- {np.std(fits):.2f} | "
          f"best={max(fits):.2f}")
    return valid


# Phase 3 experiments — everything EXCEPT baseline, random_search
# (those are already handled by run_all_sequential.py)
PHASE3_EXPERIMENTS = []
SKIP = {"baseline", "random_search"}

for name in PRIORITY_P0:
    if name not in SKIP:
        PHASE3_EXPERIMENTS.append(name)
for name in PRIORITY_P1:
    if name not in SKIP:
        PHASE3_EXPERIMENTS.append(name)
for name in PRIORITY_P2:
    if name not in SKIP:
        PHASE3_EXPERIMENTS.append(name)


if __name__ == "__main__":
    n_runs = 30
    n_expts = len(PHASE3_EXPERIMENTS)

    print("=" * 70)
    print("  STRIDE: Re-running Phase 3 Experiments (New Physics)")
    print(f"  Experiments: {n_expts}")
    print(f"  Runs per experiment: {n_runs}")
    print(f"  Estimated time per GA run: ~255s")
    print(f"  Estimated total: ~{n_runs * n_expts * 255 / 3600:.1f}h")
    print("=" * 70)
    print(f"\n  Experiments to run:")
    for name in PHASE3_EXPERIMENTS:
        cfg = EXPERIMENTS[name]
        variant = ""
        if cfg.get("selection_method") != "tournament":
            variant = f"selection={cfg['selection_method']}"
        elif cfg.get("mutation_rate") != 0.05:
            variant = f"mutation={cfg['mutation_rate']}"
        elif cfg.get("crossover_rate") != 0.8:
            variant = f"crossover={cfg['crossover_rate']}"
        elif cfg.get("encoding") != "direct":
            variant = f"encoding={cfg['encoding']}"
        elif cfg.get("terrain") != "flat":
            variant = f"terrain={cfg['terrain']}"
        elif cfg.get("elitism_rate") != 0.05:
            variant = f"elitism={cfg['elitism_rate']}"
        elif cfg.get("population_size") != 100:
            variant = f"pop_size={cfg['population_size']}"
        elif cfg.get("island_model"):
            variant = "island_model"
        elif cfg.get("fitness_sharing"):
            variant = "fitness_sharing"
        print(f"    - {name:<25} ({variant})")

    total_t0 = time.time()

    for i, name in enumerate(PHASE3_EXPERIMENTS):
        config = EXPERIMENTS[name]
        n_runs_cfg = config.get("num_runs", 30)
        print(f"\n--- [{i+1}/{n_expts}] {name} ---")
        algo_t0 = time.time()
        run_sequential(name, config, n_runs=n_runs_cfg)
        algo_elapsed = time.time() - algo_t0
        print(f"  Time for {name}: {algo_elapsed:.0f}s "
              f"({algo_elapsed / 3600:.1f}h)")

    total_elapsed = time.time() - total_t0
    print(f"\n{'='*70}")
    print(f"  PHASE 3 COMPLETE in {total_elapsed:.0f}s "
          f"({total_elapsed / 3600:.1f}h)")
    print(f"{'='*70}")
