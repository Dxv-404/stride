"""Quick smoke test: run each baseline algorithm for a few generations."""

import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.baselines import run_de, run_pso, run_cmaes


def test_algorithm(name, run_fn):
    config = {**BASELINE_CONFIG}
    config["population_size"] = 20
    config["max_generations"] = 10

    print(f"\n  Testing {name} (pop=20, gen=10)...")
    t0 = time.time()
    result = run_fn(config, seed=42)
    elapsed = time.time() - t0

    print(f"    Time: {elapsed:.1f}s")
    print(f"    Best fitness: {result['best_fitness']:.2f}")
    print(f"    Convergence length: {len(result['convergence_history'])}")
    print(f"    Has best_chromosome: {result['best_chromosome'] is not None}")
    print(f"    Has diversity: {len(result.get('diversity_per_gen', []))}")

    # Sanity checks
    assert result["best_fitness"] > -1000, f"{name}: fitness is penalty value"
    assert len(result["convergence_history"]) == 10, f"{name}: wrong convergence length"
    assert result["best_chromosome"] is not None, f"{name}: no chromosome"

    print(f"    >>> {name} PASSED")
    return result


if __name__ == "__main__":
    print("=" * 60)
    print("  Baseline Algorithm Smoke Tests")
    print("=" * 60)

    results = {}
    for name, fn in [("DE", run_de), ("PSO", run_pso), ("CMA-ES", run_cmaes)]:
        try:
            results[name] = test_algorithm(name, fn)
        except Exception as e:
            print(f"    >>> {name} FAILED: {e}")

    print("\n" + "=" * 60)
    print("  Summary")
    print("=" * 60)
    for name, r in results.items():
        print(f"  {name:<8}: fitness = {r['best_fitness']:.2f}")
    print("=" * 60)
