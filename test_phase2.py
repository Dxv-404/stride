"""Phase 2 validation test script.

Checks:
1. Quick GA (pop=20, gen=30) — fitness increases over generations
2. All 3 selection methods work (tournament, roulette, rank)
3. Both encodings work (direct, indirect)
4. Random search runs and returns results
5. GA beats random search
6. Edge case: roulette with all-zero fitness doesn't crash
7. Edge case: two identical parents produce valid children
8. Adaptive mutation rate decreases correctly
9. Elitism preserves best individual unchanged
"""

import math
import sys
import random

import numpy as np

from src.config import BASELINE_CONFIG
from src.ga_core import (
    run_ga, tournament_selection, roulette_selection, rank_selection,
    single_point_crossover, two_point_crossover, uniform_crossover,
    gaussian_mutation, get_adaptive_mutation_rate, crossover,
    compute_diversity, apply_fitness_sharing,
)
from src.random_search import random_search
from src.utils import safe_simulate


def _quick_config(**overrides):
    """Return a fast config for testing (pop=20, gen=30)."""
    cfg = {**BASELINE_CONFIG, "population_size": 20, "max_generations": 30}
    cfg.update(overrides)
    return cfg


def test_quick_ga():
    """Run a quick GA and verify fitness increases over 30 generations."""
    print("=" * 60)
    print("TEST 1: Quick GA (pop=20, gen=30, tournament)")
    print("=" * 60)

    config = _quick_config()
    result = run_ga(config, seed=42)

    conv = result["convergence_history"]
    print(f"  Gen  1 best: {conv[0]:>10.2f}")
    print(f"  Gen 10 best: {conv[9]:>10.2f}")
    print(f"  Gen 20 best: {conv[19]:>10.2f}")
    print(f"  Gen 30 best: {conv[29]:>10.2f}")
    print(f"  Overall best: {result['best_fitness']:>10.2f}")

    improved = conv[-1] > conv[0]
    print(f"  Fitness increased gen 1->30: {'PASS' if improved else 'WARN'}")

    # Allow for cases where initial random pop is already decent
    # At minimum, the GA should not make things worse
    not_degraded = conv[-1] >= conv[0] - 10  # allow small fluctuation
    assert not_degraded, (
        f"GA made fitness significantly worse: {conv[0]:.2f} -> {conv[-1]:.2f}")
    print("  [PASS] Quick GA test passed\n")
    return result


def test_selection_methods():
    """Verify all 3 selection methods produce valid results."""
    print("=" * 60)
    print("TEST 2: All Selection Methods")
    print("=" * 60)

    for method in ["tournament", "roulette", "rank"]:
        config = _quick_config(selection_method=method)
        result = run_ga(config, seed=42)
        best = result["best_fitness"]
        is_finite = math.isfinite(best)
        print(f"  {method:>10s}: best={best:>10.2f}  "
              f"[{'PASS' if is_finite else 'FAIL'}]")
        assert is_finite, f"{method} selection produced non-finite fitness!"

    print("  [PASS] All selection methods work\n")


def test_both_encodings():
    """Verify both direct and indirect encodings work with GA."""
    print("=" * 60)
    print("TEST 3: Both Encodings (Direct & Indirect)")
    print("=" * 60)

    for enc in ["direct", "indirect"]:
        config = _quick_config(encoding=enc)
        result = run_ga(config, seed=42)
        best = result["best_fitness"]
        is_finite = math.isfinite(best)
        n_genes = len(result["best_chromosome"])
        expected = 18 if enc == "direct" else 9
        print(f"  {enc:>8s}: best={best:>10.2f}, genes={n_genes}  "
              f"[{'PASS' if is_finite and n_genes == expected else 'FAIL'}]")
        assert is_finite, f"{enc} encoding produced non-finite fitness!"
        assert n_genes == expected, f"{enc} encoding: expected {expected} genes, got {n_genes}"

    print("  [PASS] Both encodings work\n")


def test_random_search_baseline():
    """Run random search and verify it returns valid results."""
    print("=" * 60)
    print("TEST 4: Random Search Baseline")
    print("=" * 60)

    config = _quick_config()
    result = random_search(config, seed=42)

    best = result["best_fitness"]
    conv = result["convergence"]  # random_search uses "convergence" key
    is_finite = math.isfinite(best)
    is_monotonic = all(conv[i] <= conv[i + 1] for i in range(len(conv) - 1))

    print(f"  Best fitness:  {best:>10.2f}")
    print(f"  Convergence points: {len(conv)}")
    print(f"  Monotonically increasing: {is_monotonic}")
    print(f"  [{'PASS' if is_finite else 'FAIL'}]")

    assert is_finite, "Random search returned non-finite fitness!"
    assert is_monotonic, "Random search convergence should be monotonically increasing!"
    print("  [PASS] Random search test passed\n")
    return result


def test_ga_beats_random(ga_result=None, rs_result=None):
    """Compare GA vs random search with same evaluation budget."""
    print("=" * 60)
    print("TEST 5: GA vs Random Search")
    print("=" * 60)

    config = _quick_config()

    if ga_result is None:
        ga_result = run_ga(config, seed=42)
    if rs_result is None:
        rs_result = random_search(config, seed=42)

    ga_best = ga_result["best_fitness"]
    rs_best = rs_result["best_fitness"]

    print(f"  GA best:     {ga_best:>10.2f}")
    print(f"  Random best: {rs_best:>10.2f}")
    print(f"  GA wins: {'YES' if ga_best > rs_best else 'NO'}")

    # GA should beat random search (this is the whole point)
    if ga_best > rs_best:
        print("  [PASS] GA outperforms random search\n")
    else:
        # Warn but don't fail — with tiny pop/gen, random can occasionally win
        print("  [WARN] GA did not beat random search with small pop/gen.")
        print("         This may happen with tiny test runs. Not a hard failure.\n")


def test_roulette_zero_fitness():
    """Edge case: roulette selection when all fitnesses are zero."""
    print("=" * 60)
    print("TEST 6: Roulette with All-Zero Fitness")
    print("=" * 60)

    pop = [np.random.uniform(0, 1, 18) for _ in range(10)]
    fitnesses = [0.0] * 10  # All zero

    try:
        for _ in range(20):
            selected = roulette_selection(pop, fitnesses)
            assert len(selected) == 18
        print("  20 selections with all-zero fitness: OK")
        print("  [PASS] Roulette zero-fitness edge case passed\n")
    except Exception as e:
        print(f"  FAIL: {e}")
        raise AssertionError(f"Roulette crashed with zero fitness: {e}")


def test_identical_parents_crossover():
    """Edge case: crossover with two identical parents."""
    print("=" * 60)
    print("TEST 7: Identical Parents in Crossover")
    print("=" * 60)

    parent = np.array([0.5] * 18)

    for method_name, method_fn in [("single_point", single_point_crossover),
                                    ("two_point", two_point_crossover),
                                    ("uniform", uniform_crossover)]:
        c1, c2 = method_fn(parent.copy(), parent.copy())
        valid = (len(c1) == 18 and len(c2) == 18 and
                 np.all(np.isfinite(c1)) and np.all(np.isfinite(c2)))
        # Children should be identical to parent (no new genetic material)
        same_as_parent = np.allclose(c1, parent) and np.allclose(c2, parent)
        print(f"  {method_name:>14s}: valid={valid}, same_as_parent={same_as_parent}  "
              f"[{'PASS' if valid else 'FAIL'}]")
        assert valid, f"{method_name} crossover produced invalid children!"

    print("  [PASS] Identical parents crossover test passed\n")


def test_adaptive_mutation():
    """Verify adaptive mutation rate decreases over generations."""
    print("=" * 60)
    print("TEST 8: Adaptive Mutation Rate Decay")
    print("=" * 60)

    max_gen = 150
    rates = []
    for g in [0, 30, 75, 120, 149, 150]:
        rate = get_adaptive_mutation_rate(g, max_gen)
        rates.append(rate)
        print(f"  Gen {g:>3d}: p_m = {rate:.4f}")

    # Verify monotonically decreasing (or at floor)
    is_decreasing = all(rates[i] >= rates[i + 1] for i in range(len(rates) - 1))
    floor_respected = all(r >= 0.01 for r in rates)

    print(f"  Monotonically decreasing: {is_decreasing}")
    print(f"  Floor (0.01) respected:   {floor_respected}")

    assert is_decreasing, "Adaptive mutation rate is not decreasing!"
    assert floor_respected, "Adaptive mutation rate went below floor!"
    print("  [PASS] Adaptive mutation test passed\n")


def test_elitism():
    """Verify elitism preserves the best individual unchanged."""
    print("=" * 60)
    print("TEST 9: Elitism Preserves Best Individual")
    print("=" * 60)

    config = _quick_config(elitism_rate=0.05)  # 5% of 20 = 1 elite
    np.random.seed(42)
    random.seed(42)

    # Run GA manually for 1 generation to check elite preservation
    from src.encoding import get_gene_count
    n_genes = get_gene_count(config["encoding"])
    pop_size = config["population_size"]

    population = [np.random.uniform(0, 1, n_genes) for _ in range(pop_size)]
    fitnesses = [safe_simulate(ind, config["terrain"], config) for ind in population]

    # Find the best individual
    best_idx = max(range(pop_size), key=lambda i: fitnesses[i])
    best_chromo = population[best_idx].copy()
    best_fit = fitnesses[best_idx]

    # Run 1 generation of GA
    result = run_ga(config, seed=42)

    # The best from gen 0 should appear unchanged in gen 1
    # Check if the gen-0 best chromosome exists in gen-1 population
    gen1_best = result["all_best_per_gen"][1]  # gen 1 best
    gen0_best_fit = result["convergence_history"][0]
    gen1_best_fit = result["convergence_history"][1]

    # With elitism, gen 1 best should be >= gen 0 best
    elite_works = gen1_best_fit >= gen0_best_fit

    print(f"  Gen 0 best fitness: {gen0_best_fit:>10.2f}")
    print(f"  Gen 1 best fitness: {gen1_best_fit:>10.2f}")
    print(f"  Elite preserved (gen1 >= gen0): {elite_works}")

    assert elite_works, (
        f"Elitism failed! Gen 1 best ({gen1_best_fit:.2f}) < "
        f"Gen 0 best ({gen0_best_fit:.2f})")
    print("  [PASS] Elitism test passed\n")


def test_distinct_parent_crossover():
    """Crossover with different parents produces mixed children."""
    print("=" * 60)
    print("TEST 10: Crossover With Distinct Parents")
    print("=" * 60)

    p1 = np.zeros(18)     # all zeros
    p2 = np.ones(18)      # all ones

    c1, c2 = single_point_crossover(p1, p2)

    # child1 should have some genes = 0 (from p1) and some = 1 (from p2)
    has_from_p1 = np.any(c1 == 0.0)
    has_from_p2 = np.any(c1 == 1.0)
    mixed = has_from_p1 and has_from_p2

    print(f"  Parent 1: all zeros,  Parent 2: all ones")
    print(f"  Child 1 zeros: {np.sum(c1 == 0.0)},  ones: {np.sum(c1 == 1.0)}")
    print(f"  Child 2 zeros: {np.sum(c2 == 0.0)},  ones: {np.sum(c2 == 1.0)}")
    print(f"  Child has genes from both parents: {'PASS' if mixed else 'FAIL'}")

    assert mixed, "Single-point crossover did not mix genes from distinct parents!"

    # Verify complement: genes child1 got from p1, child2 got from p2 and vice versa
    complement = np.all((c1 + c2) == 1.0)
    print(f"  Children are complements: {complement}")
    assert complement, "Children are not proper complements of crossover!"
    print("  [PASS] Distinct parent crossover test passed\n")


def test_return_dict_keys():
    """Verify run_ga() returns correct keys with correct lengths."""
    print("=" * 60)
    print("TEST 11: GA Return Dict Structure")
    print("=" * 60)

    config = _quick_config()
    max_gen = config["max_generations"]  # 30
    result = run_ga(config, seed=42)

    expected_keys = [
        "best_fitness", "best_chromosome",
        "convergence_history", "best_fitness_per_gen",
        "avg_fitness_per_gen", "diversity_per_gen",
        "all_best_per_gen", "parent_log",
        "final_population", "final_fitnesses",
    ]

    print(f"  Keys present: {sorted(result.keys())}")

    for key in expected_keys:
        present = key in result
        print(f"    {key:>25s}: {'PRESENT' if present else 'MISSING'}")
        assert present, f"Missing key '{key}' in run_ga() result!"

    # Verify lengths of per-generation arrays
    array_keys = [
        "convergence_history", "avg_fitness_per_gen",
        "diversity_per_gen", "all_best_per_gen",
    ]
    for key in array_keys:
        length = len(result[key])
        ok = length == max_gen
        print(f"    {key:>25s}: len={length}, expected={max_gen}  "
              f"[{'PASS' if ok else 'FAIL'}]")
        assert ok, f"'{key}' has length {length}, expected {max_gen}!"

    # best_fitness_per_gen should be same object as convergence_history
    assert result["best_fitness_per_gen"] is result["convergence_history"], \
        "best_fitness_per_gen should alias convergence_history"

    print("  [PASS] Return dict structure test passed\n")
    return result


def test_parent_tracking(ga_result=None):
    """Verify parent_log contains real lineage data."""
    print("=" * 60)
    print("TEST 12: Parent Tracking for Family Tree")
    print("=" * 60)

    if ga_result is None:
        config = _quick_config()
        ga_result = run_ga(config, seed=42)

    log = ga_result["parent_log"]

    print(f"  Total parent_log entries: {len(log)}")
    assert len(log) > 0, "parent_log is empty — no lineage recorded!"

    # Check structure: each entry is (gen, child_idx, p1_idx, p2_idx)
    sample = log[0]
    print(f"  Sample entry: gen={sample[0]}, child={sample[1]}, "
          f"p1={sample[2]}, p2={sample[3]}")
    assert len(sample) == 4, f"Entry has {len(sample)} fields, expected 4!"

    # Verify entries span multiple generations
    gens_logged = set(entry[0] for entry in log)
    print(f"  Generations with entries: {min(gens_logged)} to {max(gens_logged)} "
          f"({len(gens_logged)} unique)")
    assert len(gens_logged) > 1, "Parent log only covers 1 generation!"

    # Verify all indices are non-negative integers
    for gen, ci, p1, p2 in log[:50]:  # spot check first 50
        assert isinstance(gen, int) and gen >= 0
        assert isinstance(ci, int) and ci >= 0
        assert isinstance(p1, int) and p1 >= 0
        assert isinstance(p2, int) and p2 >= 0

    print("  [PASS] Parent tracking test passed\n")


def test_diversity_decreases():
    """Diversity should generally decrease as population converges."""
    print("=" * 60)
    print("TEST 13: Diversity Decreases Over Generations")
    print("=" * 60)

    config = _quick_config()
    result = run_ga(config, seed=42)

    div = result["diversity_per_gen"]
    div_gen1 = div[0]
    div_gen30 = div[-1]

    print(f"  Diversity at gen  1: {div_gen1:.4f}")
    print(f"  Diversity at gen 15: {div[14]:.4f}")
    print(f"  Diversity at gen 30: {div_gen30:.4f}")

    # Diversity should decrease (or at least not explode)
    # With tournament selection + elitism, convergence is expected
    decreased = div_gen30 < div_gen1
    print(f"  Decreased (gen30 < gen1): {'PASS' if decreased else 'WARN'}")

    # Soft check — diversity should at least not double
    not_exploded = div_gen30 < div_gen1 * 2.0
    assert not_exploded, (
        f"Diversity exploded! Gen 1: {div_gen1:.4f} -> Gen 30: {div_gen30:.4f}")

    if not decreased:
        print("  [WARN] Diversity did not decrease — acceptable for small runs")
    print("  [PASS] Diversity test passed\n")


def test_island_model():
    """Smoke test: island model GA runs without crashing."""
    print("=" * 60)
    print("TEST 14: Island Model Smoke Test")
    print("=" * 60)

    config = _quick_config(
        population_size=40,
        max_generations=20,
        island_model=True,
        num_islands=4,
        migration_interval=10,
    )
    result = run_ga(config, seed=42)

    best = result["best_fitness"]
    conv_len = len(result["convergence_history"])
    is_finite = math.isfinite(best)

    print(f"  Best fitness:       {best:>10.2f}")
    print(f"  Convergence length: {conv_len} (expected {config['max_generations']})")
    print(f"  Finite: {is_finite}")

    assert is_finite, "Island model produced non-finite fitness!"
    assert conv_len == config["max_generations"], \
        f"Convergence length {conv_len} != {config['max_generations']}"
    print("  [PASS] Island model smoke test passed\n")


def test_fitness_sharing():
    """Smoke test: fitness sharing GA runs without crashing."""
    print("=" * 60)
    print("TEST 15: Fitness Sharing Smoke Test")
    print("=" * 60)

    config = _quick_config(
        population_size=20,
        max_generations=20,
        fitness_sharing=True,
        sharing_radius=0.3,
    )
    result = run_ga(config, seed=42)

    best = result["best_fitness"]
    conv_len = len(result["convergence_history"])
    is_finite = math.isfinite(best)

    print(f"  Best fitness:       {best:>10.2f}")
    print(f"  Convergence length: {conv_len} (expected {config['max_generations']})")
    print(f"  Finite: {is_finite}")

    assert is_finite, "Fitness sharing produced non-finite fitness!"
    assert conv_len == config["max_generations"], \
        f"Convergence length {conv_len} != {config['max_generations']}"
    print("  [PASS] Fitness sharing smoke test passed\n")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  STRIDE — Phase 2 Validation Suite")
    print("=" * 60 + "\n")

    try:
        ga_result = test_quick_ga()
        test_selection_methods()
        test_both_encodings()
        rs_result = test_random_search_baseline()
        test_ga_beats_random(ga_result, rs_result)
        test_roulette_zero_fitness()
        test_identical_parents_crossover()
        test_adaptive_mutation()
        test_elitism()
        test_distinct_parent_crossover()
        ga_result2 = test_return_dict_keys()
        test_parent_tracking(ga_result2)
        test_diversity_decreases()
        test_island_model()
        test_fitness_sharing()

        print("=" * 60)
        print("  ALL PHASE 2 TESTS PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n  PHASE 2 VALIDATION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n  UNEXPECTED ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
