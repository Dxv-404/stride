"""V2 experiment runner for STRIDE — CPG and CPG+NN controllers.

Handles the cascade seeding pipeline:
  sine (v1 baseline) → CPG (38 genes) → CPG+NN (96 genes)

Each v2 experiment config has a "seed_from" key pointing to the experiment
whose best chromosomes should be used to initialize the population.  The
runner automatically:
  1. Loads the seed experiment's .pkl results
  2. Extracts the top N best_chromosome values
  3. Calls initialize_cpg_population() or initialize_cpgnn_population()
  4. Passes the seeded population to run_ga_v2() via config["initial_population"]

Usage:
    python experiments/run_v2_experiments.py --priority p0
    python experiments/run_v2_experiments.py --priority all
    python experiments/run_v2_experiments.py --experiments cpg_baseline cpgnn_flat
    python experiments/run_v2_experiments.py --summary
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

from src.config import (
    V2_EXPERIMENTS,
    V2_PRIORITY_P0, V2_PRIORITY_P1, V2_PRIORITY_P2,
)
from src.ga_core import run_ga_v2
from src.cpg_controller import initialize_cpg_population
from src.cpgnn_controller import initialize_cpgnn_population
from src.utils import load_checkpoint_safe, save_checkpoint

logger = logging.getLogger(__name__)

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"


# ---------------------------------------------------------------------------
# Cascade seeding helpers
# ---------------------------------------------------------------------------

def load_best_chromosomes(experiment_name, top_n=10):
    """Load the best chromosomes from a completed experiment.

    Looks for the final .pkl file in the results directory, extracts the
    best_chromosome from each run, and returns the top N by fitness.

    Args:
        experiment_name: str — key from EXPERIMENTS or V2_EXPERIMENTS.
        top_n: int — number of best chromosomes to extract.

    Returns:
        list of np.ndarray — the top_n best chromosomes sorted by fitness.

    Raises:
        FileNotFoundError: if the experiment results don't exist.
        ValueError: if results are empty or malformed.
    """
    pkl_path = RESULTS_DIR / f"{experiment_name}.pkl"
    if not pkl_path.exists():
        raise FileNotFoundError(
            f"Seed experiment '{experiment_name}' not found at {pkl_path}. "
            f"Run that experiment first before running dependent experiments."
        )

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid_runs = [r for r in runs if r is not None and "best_chromosome" in r]
    if not valid_runs:
        raise ValueError(
            f"Seed experiment '{experiment_name}' has no valid runs with "
            f"best_chromosome. Re-run the experiment."
        )

    # Sort by best_fitness descending, take top_n
    valid_runs.sort(key=lambda r: r["best_fitness"], reverse=True)
    top_runs = valid_runs[:top_n]

    chromosomes = [np.array(r["best_chromosome"], dtype=np.float64)
                   for r in top_runs]

    print(f"  Loaded {len(chromosomes)} best chromosomes from '{experiment_name}' "
          f"(fitness range: {top_runs[-1]['best_fitness']:.2f} – "
          f"{top_runs[0]['best_fitness']:.2f})")

    return chromosomes


def build_seeded_population(config, pop_size):
    """Build a cascade-seeded initial population for a v2 experiment.

    Reads config["seed_from"] to determine which previous experiment to
    load, then calls the appropriate seeding function based on
    config["encoding"].

    Args:
        config: experiment configuration dict (must have "seed_from").
        pop_size: population size.

    Returns:
        list of np.ndarray — the seeded population, or None if no seeding.
    """
    seed_from = config.get("seed_from")
    if not seed_from:
        return None

    encoding = config.get("encoding", "cpg")

    # Load best chromosomes from the seed experiment
    # Use top 10 for diversity in seeding templates
    best_chromos = load_best_chromosomes(seed_from, top_n=10)

    if encoding == "cpg":
        # sine (18 genes) → CPG (38 genes)
        population = initialize_cpg_population(pop_size, best_chromos)
        print(f"  Seeded CPG population ({pop_size} individuals) "
              f"from {len(best_chromos)} sine templates")
    elif encoding == "cpg_nn":
        # CPG (38 genes) → CPG+NN (96 genes)
        population = initialize_cpgnn_population(pop_size, best_chromos)
        print(f"  Seeded CPG+NN population ({pop_size} individuals) "
              f"from {len(best_chromos)} CPG templates")
    else:
        logger.warning(f"Unknown encoding '{encoding}' for seeding, "
                       f"using random initialization")
        return None

    return population


# ---------------------------------------------------------------------------
# Module-level worker for Windows spawn-safe multiprocessing
# ---------------------------------------------------------------------------

def _run_single_v2(args):
    """Run one v2 GA with given config and seed. Must be at module level."""
    config, seed = args
    try:
        return run_ga_v2(config, seed)
    except Exception as e:
        logger.error(f"V2 GA run crashed (seed={seed}): {type(e).__name__}: {e}")
        return None


# ---------------------------------------------------------------------------
# Core runner
# ---------------------------------------------------------------------------

def run_v2_experiment(experiment_name, config, n_workers=1, log_file=None):
    """Run a single v2 experiment: 30 independent runs with checkpointing.

    Handles cascade seeding automatically based on config["seed_from"].

    Args:
        experiment_name: str key from V2_EXPERIMENTS dict.
        config: dict of experiment hyperparameters.
        n_workers: int — number of parallel workers.
        log_file: open file handle for logging (or None).

    Returns:
        list of result dicts (length ≤ num_runs; None entries filtered out).
    """
    num_runs = config.get("num_runs", 30)
    seed_start = config.get("seed_start", 42)
    pop_size = config["population_size"]

    checkpoint_path = str(RESULTS_DIR / f"{experiment_name}_checkpoint.pkl")
    final_path = str(RESULTS_DIR / f"{experiment_name}.pkl")

    # --- Skip if final results already exist ---
    if os.path.exists(final_path):
        try:
            with open(final_path, "rb") as f:
                existing = pickle.load(f)
            if len(existing) >= num_runs:
                summary = (f"  {experiment_name}: already complete "
                           f"({len(existing)} runs in .pkl)")
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
        _log(f"  {experiment_name}: already complete "
             f"({start_run}/{num_runs} runs)", log_file)
        return [r for r in completed_runs if r is not None]

    if start_run > 0:
        _log(f"  {experiment_name}: resuming from run "
             f"{start_run}/{num_runs}", log_file)

    # --- Cascade seeding (build initial population once) ---
    seeded_pop = build_seeded_population(config, pop_size)

    # Create config copy with initial_population baked in
    run_config = dict(config)
    if seeded_pop is not None:
        run_config["initial_population"] = seeded_pop

    # --- Build work list ---
    seeds = [seed_start + i for i in range(start_run, num_runs)]
    work = [(run_config, s) for s in seeds]

    # --- Run sequentially (v2 sims are heavier — multiprocessing optional) ---
    t0 = time.time()

    if n_workers > 1 and len(work) > 1:
        # Parallel execution
        actual_workers = min(n_workers, len(work))
        with multiprocessing.Pool(actual_workers) as pool:
            results_iter = pool.imap_unordered(_run_single_v2, work)
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
        # Sequential execution (default for v2 — easier to debug)
        pbar = tqdm(seeds, desc=f"  {experiment_name}", unit="run", leave=True)
        for seed in pbar:
            try:
                result = _run_single_v2((run_config, seed))
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
# Dependency-aware batch runner
# ---------------------------------------------------------------------------

def resolve_run_order(experiment_names):
    """Sort experiments so dependencies (seed_from) are run first.

    The cascade pipeline has a strict ordering:
      sine (v1) → CPG → CPG+NN

    This function topologically sorts the requested experiments so that
    seed experiments are always completed before their dependents.

    Args:
        experiment_names: list of str — experiment keys to run.

    Returns:
        list of str — topologically sorted experiment names.
    """
    # Build dependency graph
    deps = {}
    for name in experiment_names:
        config = V2_EXPERIMENTS.get(name, {})
        seed_from = config.get("seed_from")
        deps[name] = seed_from

    # Topological sort (simple — at most 2 levels deep)
    ordered = []
    remaining = list(experiment_names)

    # Iteration limit to prevent infinite loops on circular deps
    for _ in range(len(remaining) + 1):
        if not remaining:
            break
        progress = False
        for name in list(remaining):
            dep = deps.get(name)
            if dep is None:
                # No dependency
                ordered.append(name)
                remaining.remove(name)
                progress = True
            elif dep not in experiment_names:
                # Dependency is external (e.g., v1 baseline) — check .pkl exists
                pkl_path = RESULTS_DIR / f"{dep}.pkl"
                if pkl_path.exists():
                    ordered.append(name)
                    remaining.remove(name)
                    progress = True
                else:
                    # Will fail at runtime — add anyway so error is clear
                    ordered.append(name)
                    remaining.remove(name)
                    progress = True
            elif dep in ordered:
                # Dependency already scheduled
                ordered.append(name)
                remaining.remove(name)
                progress = True
        if not progress:
            # Circular dependency or missing dep — add remaining as-is
            ordered.extend(remaining)
            break

    return ordered


def run_v2_priority_group(priority_names, n_workers=1):
    """Run a list of v2 experiments in dependency order.

    Args:
        priority_names: list of str — experiment keys.
        n_workers: int — parallel workers per experiment.

    Returns:
        dict mapping experiment_name -> list of result dicts.
    """
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Sort by dependencies
    ordered = resolve_run_order(priority_names)

    # Set up logging
    log_path = RESULTS_DIR / "v2_experiment_log.txt"
    log_file = open(log_path, "a", encoding="utf-8")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _log(f"\n{'='*60}", log_file)
    _log(f"V2 Experiment run started: {timestamp}", log_file)
    _log(f"Priority group: {ordered}", log_file)
    _log(f"Workers: {n_workers}", log_file)
    _log(f"{'='*60}", log_file)

    all_results = {}
    total_t0 = time.time()

    for i, name in enumerate(ordered):
        if name not in V2_EXPERIMENTS:
            msg = f"  SKIP: '{name}' not in V2_EXPERIMENTS dict"
            print(msg)
            _log(msg, log_file)
            continue

        config = V2_EXPERIMENTS[name]
        header = f"\n[{i+1}/{len(ordered)}] Running: {name}"
        print(header)
        _log(header, log_file)

        ctrl = config.get("controller_type", "cpg")
        enc = config.get("encoding", "cpg")
        terrain = config.get("terrain", "flat")
        seed_from = config.get("seed_from", "none")
        _log(f"  Config: controller={ctrl}, encoding={enc}, "
             f"terrain={terrain}, seed_from={seed_from}, "
             f"pop={config['population_size']}, "
             f"gen={config['max_generations']}", log_file)

        try:
            results = run_v2_experiment(
                name, config, n_workers=n_workers, log_file=log_file)
            all_results[name] = results
        except FileNotFoundError as e:
            msg = f"  FAILED: {e}"
            print(msg)
            _log(msg, log_file)
        except Exception as e:
            msg = f"  FAILED: {type(e).__name__}: {e}"
            print(msg)
            _log(msg, log_file)

    total_elapsed = time.time() - total_t0
    footer = (
        f"\n{'='*60}\n"
        f"V2 experiments complete: {len(all_results)} experiments, "
        f"{total_elapsed:.0f}s ({total_elapsed/3600:.1f}h)\n"
        f"{'='*60}"
    )
    print(footer)
    _log(footer, log_file)
    log_file.close()

    return all_results


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def summarize_v2_results():
    """Print a summary table of all v2 experiment results."""
    v2_names = set(V2_EXPERIMENTS.keys())

    print(f"\n{'='*80}")
    print(f"{'Experiment':<25} {'Ctrl':>6} {'Runs':>5} {'Mean':>8} {'Std':>7} "
          f"{'Best':>8} {'Worst':>8}")
    print(f"{'-'*80}")

    for name in sorted(v2_names):
        pkl_path = RESULTS_DIR / f"{name}.pkl"
        if not pkl_path.exists():
            print(f"{name:<25} {'---':>6} {'N/A':>5}")
            continue

        config = V2_EXPERIMENTS[name]
        ctrl = config.get("controller_type", "cpg")[:6]

        try:
            with open(pkl_path, "rb") as f:
                runs = pickle.load(f)
            if not runs:
                continue
            fits = [r["best_fitness"] for r in runs if r is not None]
            if not fits:
                continue
            print(f"{name:<25} {ctrl:>6} {len(fits):>5} {np.mean(fits):>8.2f} "
                  f"{np.std(fits):>7.2f} {max(fits):>8.2f} {min(fits):>8.2f}")
        except Exception as e:
            print(f"{name:<25} {'---':>6} ERROR: {e}")

    print(f"{'='*80}\n")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log(msg, log_file=None):
    """Print and optionally write to log file."""
    if log_file:
        log_file.write(msg + "\n")
        log_file.flush()


def get_v2_experiment_names(priority):
    """Resolve priority label to list of v2 experiment names."""
    if priority == "p0":
        return list(V2_PRIORITY_P0)
    elif priority == "p1":
        return list(V2_PRIORITY_P1)
    elif priority == "p2":
        return list(V2_PRIORITY_P2)
    elif priority == "all":
        return list(V2_PRIORITY_P0) + list(V2_PRIORITY_P1) + list(V2_PRIORITY_P2)
    else:
        raise ValueError(f"Unknown priority: {priority}. Use p0, p1, p2, or all.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="STRIDE V2 — CPG/CPG+NN Experiment Runner"
    )
    parser.add_argument(
        "--priority", type=str, choices=["p0", "p1", "p2", "all"],
        help="Which v2 priority group to run"
    )
    parser.add_argument(
        "--experiments", nargs="+", type=str,
        help="Specific experiment names to run (e.g. cpg_baseline cpgnn_flat)"
    )
    parser.add_argument(
        "--summary", action="store_true",
        help="Print summary of all v2 experiment results"
    )
    parser.add_argument(
        "--sequential", action="store_true",
        help="Disable multiprocessing (run sequentially)"
    )
    parser.add_argument(
        "--workers", type=int, default=0,
        help="Number of workers (0 = 1 for v2, since sims are heavier)"
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    if args.summary:
        summarize_v2_results()
        return

    if args.experiments:
        names = args.experiments
    elif args.priority:
        names = get_v2_experiment_names(args.priority)
    else:
        parser.print_help()
        return

    # V2 default: sequential (1 worker) since CPG sims are more expensive
    if args.sequential or args.workers == 0:
        n_workers = 1
    else:
        n_workers = args.workers

    print(f"\n{'='*60}")
    print(f"  STRIDE V2 — CPG/CPG+NN Experiments")
    print(f"  {len(names)} experiments, 30 runs each")
    print(f"  Workers: {n_workers}")
    print(f"{'='*60}\n")

    results = run_v2_priority_group(names, n_workers=n_workers)

    # Print final summary
    summarize_v2_results()


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
