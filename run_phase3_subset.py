"""Run a subset of Phase 3 experiments (for parallel execution).

Usage:
    python run_phase3_subset.py exp_name1 exp_name2 ...

Each experiment name must exist in src.config.EXPERIMENTS.
Uses same checkpointing as run_phase3_sequential.py.
"""

import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import EXPERIMENTS
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
            print(f"    Run {i + 1}/{n_runs}: fitness={fit:.2f} ({elapsed:.0f}s)",
                  flush=True)
        except Exception as e:
            print(f"    Run {i + 1}/{n_runs}: FAILED ({e})", flush=True)
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
          f"best={max(fits):.2f}", flush=True)
    return valid


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_phase3_subset.py exp1 exp2 ...")
        sys.exit(1)

    experiment_names = sys.argv[1:]
    # Validate
    for name in experiment_names:
        if name not in EXPERIMENTS:
            print(f"ERROR: '{name}' not in EXPERIMENTS config")
            sys.exit(1)

    n_expts = len(experiment_names)
    print(f"{'='*60}")
    print(f"  STRIDE Phase 3 Subset Runner")
    print(f"  Experiments: {', '.join(experiment_names)}")
    print(f"  ({n_expts} experiments × 30 runs)")
    print(f"{'='*60}", flush=True)

    total_t0 = time.time()
    for i, name in enumerate(experiment_names):
        config = EXPERIMENTS[name]
        n_runs = config.get("num_runs", 30)
        print(f"\n--- [{i+1}/{n_expts}] {name} ---", flush=True)
        t0 = time.time()
        run_sequential(name, config, n_runs=n_runs)
        elapsed = time.time() - t0
        print(f"  Time for {name}: {elapsed:.0f}s ({elapsed/3600:.1f}h)",
              flush=True)

    total = time.time() - total_t0
    print(f"\n{'='*60}")
    print(f"  SUBSET COMPLETE in {total:.0f}s ({total/3600:.1f}h)")
    print(f"{'='*60}", flush=True)
