"""Priority 2: Run all algorithm comparisons (GA, DE, PSO, CMA-ES).

Each algorithm runs 30 independent trials with the same budget:
  pop_size * max_generations = 100 * 75 = 7500 fitness evaluations

Results saved to experiments/results/{algorithm_name}.pkl
"""

import logging
import multiprocessing
import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np
from tqdm import tqdm

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.ga_core import run_ga
from src.baselines import run_de, run_pso, run_cmaes

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

logger = logging.getLogger(__name__)


# Module-level worker functions (Windows spawn-safe)
def _worker_ga(args):
    config, seed = args
    try:
        return run_ga(config, seed)
    except Exception as e:
        logger.error(f"GA crashed (seed={seed}): {e}")
        return None


def _worker_de(args):
    config, seed = args
    try:
        return run_de(config, seed)
    except Exception as e:
        logger.error(f"DE crashed (seed={seed}): {e}")
        return None


def _worker_pso(args):
    config, seed = args
    try:
        return run_pso(config, seed)
    except Exception as e:
        logger.error(f"PSO crashed (seed={seed}): {e}")
        return None


def _worker_cmaes(args):
    config, seed = args
    try:
        return run_cmaes(config, seed)
    except Exception as e:
        logger.error(f"CMA-ES crashed (seed={seed}): {e}")
        return None


ALGORITHMS = {
    "ga_baseline": (_worker_ga, "Genetic Algorithm"),
    "de_baseline": (_worker_de, "Differential Evolution"),
    "pso_baseline": (_worker_pso, "Particle Swarm Optimization"),
    "cmaes_baseline": (_worker_cmaes, "CMA-ES"),
}


def run_algorithm(name, worker_fn, config, n_runs=30, n_workers=1):
    """Run an algorithm for n_runs independent trials."""
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    final_path = RESULTS_DIR / f"{name}.pkl"

    # Skip if already complete
    if final_path.exists():
        try:
            with open(final_path, "rb") as f:
                existing = pickle.load(f)
            if len(existing) >= n_runs:
                fits = [r["best_fitness"] for r in existing if r]
                print(f"  {name}: already complete ({len(existing)} runs) "
                      f"mean={np.mean(fits):.2f}")
                return existing
        except Exception:
            pass

    seed_start = config.get("seed_start", 42)
    seeds = [seed_start + i for i in range(n_runs)]
    work = [(config, s) for s in seeds]

    t0 = time.time()

    if n_workers > 1 and n_runs > 1:
        actual_workers = min(n_workers, n_runs)
        with multiprocessing.Pool(actual_workers) as pool:
            results = list(tqdm(
                pool.imap_unordered(worker_fn, work),
                total=n_runs,
                desc=f"  {name}",
                unit="run",
            ))
    else:
        results = []
        for w in tqdm(work, desc=f"  {name}", unit="run"):
            results.append(worker_fn(w))

    elapsed = time.time() - t0
    valid = [r for r in results if r is not None]

    # Save
    with open(final_path, "wb") as f:
        pickle.dump(valid, f)

    # Summary
    if valid:
        fits = [r["best_fitness"] for r in valid]
        print(f"  {name}: {len(valid)}/{n_runs} runs | "
              f"mean={np.mean(fits):.2f} +/- {np.std(fits):.2f} | "
              f"best={max(fits):.2f} | {elapsed:.0f}s")
    else:
        print(f"  {name}: ALL RUNS FAILED | {elapsed:.0f}s")

    return valid


def print_comparison_table():
    """Print a comparison table of all algorithm results."""
    from scipy.stats import mannwhitneyu

    print("\n" + "=" * 80)
    print("  ALGORITHM COMPARISON TABLE")
    print("=" * 80)
    print(f"  {'Algorithm':<20} {'Runs':>5} {'Mean':>10} {'Std':>8} "
          f"{'Best':>10} {'Median':>10} {'p-value':>10}")
    print(f"  {'-'*73}")

    # Load all results
    all_fits = {}
    for name in ALGORITHMS:
        path = RESULTS_DIR / f"{name}.pkl"
        if path.exists():
            with open(path, "rb") as f:
                runs = pickle.load(f)
            fits = [r["best_fitness"] for r in runs if r]
            all_fits[name] = fits

    # Also try 'baseline' (from Priority 1D)
    baseline_path = RESULTS_DIR / "baseline.pkl"
    if baseline_path.exists():
        with open(baseline_path, "rb") as f:
            runs = pickle.load(f)
        fits = [r["best_fitness"] for r in runs if r]
        all_fits["baseline (P1D)"] = fits

    # Print table
    ga_fits = all_fits.get("ga_baseline", all_fits.get("baseline (P1D)"))

    for name, fits in all_fits.items():
        fits_arr = np.array(fits)
        p_val = ""
        if ga_fits is not None and name != "ga_baseline" and name != "baseline (P1D)":
            try:
                _, p = mannwhitneyu(ga_fits, fits_arr, alternative="two-sided")
                p_val = f"{p:.4f}"
            except Exception:
                p_val = "N/A"

        print(f"  {name:<20} {len(fits):>5} {np.mean(fits_arr):>10.2f} "
              f"{np.std(fits_arr):>8.2f} {np.max(fits_arr):>10.2f} "
              f"{np.median(fits_arr):>10.2f} {p_val:>10}")

    print("=" * 80)


if __name__ == "__main__":
    n_workers = min(14, multiprocessing.cpu_count() - 1)
    config = {**BASELINE_CONFIG}
    n_runs = config.get("num_runs", 30)

    print("=" * 70)
    print("  STRIDE Algorithm Comparison (Priority 2)")
    print(f"  Budget: pop={config['population_size']} x "
          f"gen={config['max_generations']} = "
          f"{config['population_size'] * config['max_generations']} evals")
    print(f"  Runs: {n_runs} per algorithm, Workers: {n_workers}")
    print("=" * 70)

    total_t0 = time.time()

    for name, (worker_fn, desc) in ALGORITHMS.items():
        print(f"\n--- {desc} ({name}) ---")
        run_algorithm(name, worker_fn, config, n_runs=n_runs,
                      n_workers=n_workers)

    total_elapsed = time.time() - total_t0
    print(f"\n  Total time: {total_elapsed:.0f}s ({total_elapsed / 3600:.1f}h)")

    # Print comparison table with Wilcoxon tests
    print_comparison_table()
