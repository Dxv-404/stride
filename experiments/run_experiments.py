"""Master experiment runner for STRIDE.

Runs all configured experiments with:
  - Multiprocessing (cpu_count - 1 workers)
  - Checkpoint every 5 runs (resume on interrupt)
  - Per-experiment 1-line summary
  - Robust error handling
  - tqdm progress bars
"""

import logging
import multiprocessing
import os
import pickle
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
from tqdm import tqdm

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import EXPERIMENTS, PRIORITY_P0, PRIORITY_P1, PRIORITY_P2
from src.ga_core import run_ga
from src.random_search import random_search
from src.utils import load_checkpoint_safe, save_checkpoint

logger = logging.getLogger(__name__)

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"


# ---------------------------------------------------------------------------
# Module-level workers for Windows spawn-safe multiprocessing
# ---------------------------------------------------------------------------

def _run_single_ga(args):
    """Run one GA with given config and seed. Must be at module level."""
    config, seed = args
    try:
        return run_ga(config, seed)
    except Exception as e:
        logger.error(f"GA run crashed (seed={seed}): {type(e).__name__}: {e}")
        return None


def _run_single_random(args):
    """Run one random search with given config and seed."""
    config, seed = args
    try:
        return random_search(config, seed)
    except Exception as e:
        logger.error(f"Random search crashed (seed={seed}): {type(e).__name__}: {e}")
        return None


# ---------------------------------------------------------------------------
# Core runner
# ---------------------------------------------------------------------------

def run_experiment(experiment_name, config, n_workers=1, log_file=None):
    """Run a single experiment: 30 independent runs with checkpointing.

    Args:
        experiment_name: str key from EXPERIMENTS dict.
        config: dict of experiment hyperparameters.
        n_workers: int — number of parallel workers.
        log_file: open file handle for logging (or None).

    Returns:
        list of result dicts (length ≤ num_runs; None entries filtered out).
    """
    num_runs = config.get("num_runs", 30)
    seed_start = config.get("seed_start", 42)
    is_random = config.get("method", "ga") == "random"

    checkpoint_path = str(RESULTS_DIR / f"{experiment_name}_checkpoint.pkl")
    final_path = str(RESULTS_DIR / f"{experiment_name}.pkl")

    # --- Skip if final results already exist ---
    if os.path.exists(final_path):
        try:
            with open(final_path, "rb") as f:
                existing = pickle.load(f)
            if len(existing) >= num_runs:
                summary = f"  {experiment_name}: already complete ({len(existing)} runs in .pkl)"
                print(summary)
                _log(summary, log_file)
                return existing
        except Exception:
            pass  # Corrupted .pkl — re-run

    # --- Resume from checkpoint ---
    completed_runs = load_checkpoint_safe(checkpoint_path) \
        if os.path.exists(checkpoint_path) else []
    start_run = len(completed_runs)

    if start_run >= num_runs:
        _log(f"  {experiment_name}: already complete ({start_run}/{num_runs} runs)", log_file)
        return [r for r in completed_runs if r is not None]

    if start_run > 0:
        _log(f"  {experiment_name}: resuming from run {start_run}/{num_runs}", log_file)

    # --- Build work list ---
    seeds = [seed_start + i for i in range(start_run, num_runs)]
    worker_fn = _run_single_random if is_random else _run_single_ga
    work = [(config, s) for s in seeds]

    # --- Run with multiprocessing or sequential ---
    t0 = time.time()

    if n_workers > 1 and len(work) > 1:
        # Parallel execution
        actual_workers = min(n_workers, len(work))
        with multiprocessing.Pool(actual_workers) as pool:
            # Use imap_unordered for progress tracking + checkpoint batching
            results_iter = pool.imap_unordered(worker_fn, work)
            batch_results = []
            pbar = tqdm(total=len(work),
                        desc=f"  {experiment_name}",
                        unit="run",
                        leave=True)
            for result in results_iter:
                batch_results.append(result)
                pbar.update(1)

                # Checkpoint every 5 completions
                if len(batch_results) % 5 == 0:
                    completed_runs.extend(batch_results)
                    batch_results = []
                    save_checkpoint(completed_runs, checkpoint_path)

            pbar.close()

            # Flush remaining
            if batch_results:
                completed_runs.extend(batch_results)
                save_checkpoint(completed_runs, checkpoint_path)
    else:
        # Sequential execution
        pbar = tqdm(seeds, desc=f"  {experiment_name}", unit="run", leave=True)
        for seed in pbar:
            try:
                result = worker_fn((config, seed))
                completed_runs.append(result)
            except Exception as e:
                logger.error(f"  Run seed={seed} failed: {e}")
                completed_runs.append(None)

            # Checkpoint every 5 runs
            if len(completed_runs) % 5 == 0:
                save_checkpoint(completed_runs, checkpoint_path)

        pbar.close()
        # Final checkpoint
        save_checkpoint(completed_runs, checkpoint_path)

    elapsed = time.time() - t0

    # --- Save final results (filter out None) ---
    valid_runs = [r for r in completed_runs if r is not None]
    with open(final_path, "wb") as f:
        pickle.dump(valid_runs, f)

    # --- Clean up checkpoint ---
    if os.path.exists(checkpoint_path):
        os.remove(checkpoint_path)
    bak = checkpoint_path + ".bak"
    if os.path.exists(bak):
        os.remove(bak)

    # --- Summary line ---
    n_valid = len(valid_runs)
    if n_valid > 0:
        fitnesses = [r["best_fitness"] for r in valid_runs]
        mean_f = np.mean(fitnesses)
        std_f = np.std(fitnesses)
        best_f = max(fitnesses)
        worst_f = min(fitnesses)
        summary = (
            f"  {experiment_name}: {n_valid}/{num_runs} runs OK | "
            f"mean={mean_f:.2f} ± {std_f:.2f} | "
            f"best={best_f:.2f} worst={worst_f:.2f} | "
            f"{elapsed:.0f}s"
        )
    else:
        summary = f"  {experiment_name}: ALL RUNS FAILED | {elapsed:.0f}s"

    print(summary)
    _log(summary, log_file)

    return valid_runs


# ---------------------------------------------------------------------------
# Batch runner
# ---------------------------------------------------------------------------

def run_priority_group(priority_names, n_workers=1):
    """Run a list of experiments by name.

    Args:
        priority_names: list of str — experiment keys.
        n_workers: int — parallel workers per experiment.

    Returns:
        dict mapping experiment_name -> list of result dicts.
    """
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Set up logging
    log_path = RESULTS_DIR / "experiment_log.txt"
    log_file = open(log_path, "a", encoding="utf-8")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _log(f"\n{'='*60}", log_file)
    _log(f"Experiment run started: {timestamp}", log_file)
    _log(f"Priority group: {priority_names}", log_file)
    _log(f"Workers: {n_workers}", log_file)
    _log(f"{'='*60}", log_file)

    all_results = {}
    total_t0 = time.time()

    for i, name in enumerate(priority_names):
        if name not in EXPERIMENTS:
            msg = f"  SKIP: '{name}' not in EXPERIMENTS dict"
            print(msg)
            _log(msg, log_file)
            continue

        config = EXPERIMENTS[name]
        header = f"\n[{i+1}/{len(priority_names)}] Running: {name}"
        print(header)
        _log(header, log_file)
        _log(f"  Config: pop={config['population_size']}, "
             f"gen={config['max_generations']}, "
             f"sel={config.get('selection_method', 'N/A')}, "
             f"mut={config.get('mutation_rate', 'N/A')}", log_file)

        results = run_experiment(name, config, n_workers=n_workers,
                                 log_file=log_file)
        all_results[name] = results

    total_elapsed = time.time() - total_t0
    footer = (
        f"\n{'='*60}\n"
        f"All experiments complete: {len(all_results)} experiments, "
        f"{total_elapsed:.0f}s ({total_elapsed/3600:.1f}h)\n"
        f"{'='*60}"
    )
    print(footer)
    _log(footer, log_file)
    log_file.close()

    return all_results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg, log_file=None):
    """Print and optionally write to log file."""
    if log_file:
        log_file.write(msg + "\n")
        log_file.flush()


def get_experiment_names(priority):
    """Resolve priority label to list of experiment names."""
    if priority == "p0":
        return list(PRIORITY_P0)
    elif priority == "p1":
        return list(PRIORITY_P1)
    elif priority == "p2":
        return list(PRIORITY_P2)
    elif priority == "all":
        return list(PRIORITY_P0) + list(PRIORITY_P1) + list(PRIORITY_P2)
    else:
        raise ValueError(f"Unknown priority: {priority}. Use p0, p1, p2, or all.")


def summarize_results(results_dir=None):
    """Print a summary table of all completed experiments."""
    rdir = Path(results_dir) if results_dir else RESULTS_DIR
    pkl_files = sorted(rdir.glob("*.pkl"))

    if not pkl_files:
        print("No result files found.")
        return

    print(f"\n{'='*70}")
    print(f"{'Experiment':<25} {'Runs':>5} {'Mean':>8} {'Std':>7} "
          f"{'Best':>8} {'Worst':>8}")
    print(f"{'-'*70}")

    for pkl in pkl_files:
        name = pkl.stem
        if name.endswith("_checkpoint"):
            continue
        try:
            with open(pkl, "rb") as f:
                runs = pickle.load(f)
            if not runs:
                continue
            fits = [r["best_fitness"] for r in runs if r is not None]
            if not fits:
                continue
            print(f"{name:<25} {len(fits):>5} {np.mean(fits):>8.2f} "
                  f"{np.std(fits):>7.2f} {max(fits):>8.2f} {min(fits):>8.2f}")
        except Exception as e:
            print(f"{name:<25} ERROR: {e}")

    print(f"{'='*70}\n")
