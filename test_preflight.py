"""Pre-flight checks before running full experiments.

Tests multiprocessing, timing, memory, and GA-vs-random at full scale.
"""

import math
import multiprocessing
import os
import sys
import time

import numpy as np

from src.config import BASELINE_CONFIG
from src.ga_core import run_ga
from src.random_search import random_search
from src.utils import safe_simulate


# --- Worker function at module level for Windows spawn-pickling ---
def _run_single_sim(seed):
    """Simulate one random creature. Must be at module top level for pickling."""
    np.random.seed(seed)
    chromo = np.random.uniform(0, 1, 18)
    return safe_simulate(chromo, "flat", BASELINE_CONFIG)


def _run_ga_worker(args):
    """Run a single GA for multiprocess parallelization."""
    config, seed = args
    return run_ga(config, seed)


def preflight_1_timing():
    """Time 1 full baseline run. Decide generation cap."""
    print("=" * 60)
    print("PRE-FLIGHT #1: Timing Full Baseline (pop=100, gen=150)")
    print("=" * 60)

    config = {**BASELINE_CONFIG}
    total_evals = config["population_size"] * config["max_generations"]
    print(f"  Evaluations: {total_evals:,}")

    t0 = time.time()
    result = run_ga(config, seed=42)
    elapsed = time.time() - t0

    per_eval_ms = elapsed / total_evals * 1000
    print(f"  Elapsed: {elapsed:.1f}s ({elapsed / 60:.1f} min)")
    print(f"  Best fitness: {result['best_fitness']:.2f}")
    print(f"  Per-evaluation: {per_eval_ms:.1f}ms")

    # Estimate total time for 9 P0 experiments x 30 runs
    est_p0_sequential = elapsed * 9 * 30
    print(f"  Est P0 sequential (9 exp x 30 runs): {est_p0_sequential / 3600:.1f} hours")

    if elapsed > 180:
        gen_cap = 75
        verdict = ">3 min => reduce to gen=75"
    elif elapsed > 120:
        gen_cap = 100
        verdict = ">2 min => reduce to gen=100"
    else:
        gen_cap = 150
        verdict = "<2 min => keep gen=150"

    print(f"  >> VERDICT: {verdict}")
    print()
    return result, elapsed, gen_cap


def preflight_2_ga_vs_random(ga_result=None):
    """GA must beat random search at full scale."""
    print("=" * 60)
    print("PRE-FLIGHT #2: GA vs Random at Full Scale")
    print("=" * 60)

    config = {**BASELINE_CONFIG}
    total_evals = config["population_size"] * config["max_generations"]
    print(f"  Budget: {total_evals:,} evaluations each")

    if ga_result is None:
        print("  Running GA...")
        t0 = time.time()
        ga_result = run_ga(config, seed=42)
        print(f"  GA done in {time.time() - t0:.1f}s")

    print("  Running random search...")
    t0 = time.time()
    rs_result = random_search(config, seed=42)
    print(f"  Random done in {time.time() - t0:.1f}s")

    ga_best = ga_result["best_fitness"]
    rs_best = rs_result["best_fitness"]

    print(f"  GA best:     {ga_best:>10.2f}")
    print(f"  Random best: {rs_best:>10.2f}")
    print(f"  GA margin:   {ga_best - rs_best:>+10.2f}")

    if ga_best > rs_best:
        print("  >> VERDICT: GA beats random — PASS")
    else:
        print("  >> VERDICT: GA LOST to random — needs debugging!")
        print("  (This may still be okay if margin is small; GA with")
        print("   tournament k=3 and elitism 5% is conservative)")

    print()
    return ga_best > rs_best


def preflight_3_multiprocessing():
    """Test pymunk multiprocessing on Windows (spawn mode)."""
    print("=" * 60)
    print("PRE-FLIGHT #3: Multiprocessing Fork-Safety")
    print("=" * 60)

    cpu = multiprocessing.cpu_count()
    workers = max(1, cpu - 1)
    print(f"  CPU count: {cpu}, workers: {workers}")

    # Test 2 parallel sims
    t0 = time.time()
    with multiprocessing.Pool(2) as pool:
        results_2 = pool.map(_run_single_sim, [100, 200])
    t_2 = time.time() - t0
    ok_2 = all(math.isfinite(r) for r in results_2)
    print(f"  2 parallel sims: elapsed={t_2:.2f}s, all finite={ok_2}")

    # Test with more workers
    n_test = min(10, workers * 2)
    t0 = time.time()
    with multiprocessing.Pool(min(workers, 4)) as pool:
        results_n = pool.map(_run_single_sim, range(n_test))
    t_n = time.time() - t0
    ok_n = all(math.isfinite(r) for r in results_n)
    print(f"  {n_test} sims on {min(workers, 4)} workers: "
          f"elapsed={t_n:.2f}s, all finite={ok_n}")

    # Test full GA runs in parallel (2 runs)
    config = {**BASELINE_CONFIG, "population_size": 20, "max_generations": 10}
    t0 = time.time()
    with multiprocessing.Pool(2) as pool:
        ga_results = pool.map(_run_ga_worker, [(config, 42), (config, 43)])
    t_ga = time.time() - t0
    ok_ga = all(math.isfinite(r["best_fitness"]) for r in ga_results)
    print(f"  2 parallel mini-GAs: elapsed={t_ga:.2f}s, both finite={ok_ga}")

    verdict = ok_2 and ok_n and ok_ga
    print(f"  >> VERDICT: {'multiprocessing SAFE' if verdict else 'FORK UNSAFE — use sequential'}")
    print()
    return verdict, workers


def preflight_4_memory(baseline_elapsed):
    """Check memory usage after 5 GA runs."""
    print("=" * 60)
    print("PRE-FLIGHT #4: Memory Check (5 baseline runs)")
    print("=" * 60)

    import tracemalloc
    tracemalloc.start()

    config = {**BASELINE_CONFIG}
    all_results = []

    for i in range(5):
        result = run_ga(config, seed=42 + i)
        all_results.append(result)

    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    current_mb = current / 1024 / 1024
    peak_mb = peak / 1024 / 1024

    print(f"  Current memory: {current_mb:.1f} MB")
    print(f"  Peak memory:    {peak_mb:.1f} MB")

    # Estimate for 30 runs
    est_30 = peak_mb * 6  # 30/5 = 6x
    print(f"  Estimated for 30 runs: {est_30:.0f} MB")

    # Check what's big
    sample = all_results[0]
    for key in sample:
        obj = sample[key]
        if isinstance(obj, list) and len(obj) > 0:
            print(f"    {key:>25s}: {len(obj)} items")
        elif isinstance(obj, np.ndarray):
            print(f"    {key:>25s}: shape={obj.shape}")

    need_trim = est_30 > 500
    if need_trim:
        print("  >> VERDICT: >500MB projected — TRIM parent_log + final_population for non-baseline")
    else:
        print("  >> VERDICT: memory OK — no trimming needed")
    print()
    return need_trim


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  STRIDE — Pre-Flight Checks")
    print("=" * 60 + "\n")

    # #1: Timing
    ga_result, baseline_time, gen_cap = preflight_1_timing()

    # #2: GA vs Random (reuse the run from #1)
    ga_wins = preflight_2_ga_vs_random(ga_result)

    # #3: Multiprocessing
    mp_safe, n_workers = preflight_3_multiprocessing()

    # #4: Memory
    need_trim = preflight_4_memory(baseline_time)

    # Summary
    print("=" * 60)
    print("  PRE-FLIGHT SUMMARY")
    print("=" * 60)
    print(f"  Baseline time:      {baseline_time:.1f}s")
    print(f"  Generation cap:     {gen_cap}")
    print(f"  GA beats random:    {ga_wins}")
    print(f"  Multiprocessing:    {'safe' if mp_safe else 'UNSAFE'}")
    print(f"  Workers:            {n_workers}")
    print(f"  Memory trim needed: {need_trim}")
    print("=" * 60)
