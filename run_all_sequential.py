"""Run all experiments sequentially (avoids Windows multiprocessing issues).

Runs baseline + random_search + DE + PSO + CMA-ES, 30 runs each.
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

from src.config import BASELINE_CONFIG
from src.ga_core import run_ga
from src.random_search import random_search
from src.baselines import run_de, run_pso, run_cmaes

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def run_sequential(name, run_fn, config, n_runs=30):
    """Run an algorithm n_runs times with checkpointing."""
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


ALGORITHMS = [
    ("baseline", run_ga, "Genetic Algorithm"),
    ("random_search", random_search, "Random Search"),
    ("de_baseline", run_de, "Differential Evolution"),
    ("pso_baseline", run_pso, "Particle Swarm Optimization"),
    ("cmaes_baseline", run_cmaes, "CMA-ES"),
]


if __name__ == "__main__":
    config = {**BASELINE_CONFIG}
    n_runs = config.get("num_runs", 30)

    print("=" * 70)
    print("  STRIDE: Running All Experiments Sequentially")
    print(f"  Budget per run: {config['population_size']} x "
          f"{config['max_generations']} = "
          f"{config['population_size'] * config['max_generations']} evals")
    print(f"  Runs per algorithm: {n_runs}")
    print(f"  Estimated time per GA run: ~255s")
    print(f"  Estimated total: ~{n_runs * len(ALGORITHMS) * 255 / 3600:.1f}h")
    print("=" * 70)

    total_t0 = time.time()

    for name, run_fn, desc in ALGORITHMS:
        print(f"\n--- {desc} ({name}) ---")
        algo_t0 = time.time()
        run_sequential(name, run_fn, config, n_runs=n_runs)
        algo_elapsed = time.time() - algo_t0
        print(f"  Time for {name}: {algo_elapsed:.0f}s "
              f"({algo_elapsed / 3600:.1f}h)")

    total_elapsed = time.time() - total_t0
    print(f"\n{'='*70}")
    print(f"  ALL COMPLETE in {total_elapsed:.0f}s ({total_elapsed / 3600:.1f}h)")
    print(f"{'='*70}")
