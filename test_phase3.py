"""Phase 3 validation tests for STRIDE experiment pipeline.

Verifies:
  1. All pkl files load without error
  2. Each contains exactly 30 run dicts
  3. Each run dict has the expected keys
  4. No None entries (crashed runs)
  5. All fitness values are finite
  6. random_search format handled gracefully
  7. Seeds produce distinct runs (no duplicates)

Run: python test_phase3.py
"""

import math
import os
import pickle
import sys

import numpy as np

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "experiments", "results")

# Expected keys in a GA run result dict
GA_EXPECTED_KEYS = {
    "best_fitness", "best_chromosome",
    "convergence_history", "best_fitness_per_gen",
    "avg_fitness_per_gen", "diversity_per_gen",
    "all_best_per_gen", "parent_log",
    "final_population", "final_fitnesses",
}

# Minimal keys that BOTH GA and random_search share
COMMON_KEYS = {"best_fitness", "best_chromosome"}

# Extra key unique to random_search
RANDOM_SEARCH_CONVERGENCE_KEY = "convergence"

passed = 0
failed = 0
warnings = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  [OK]   {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name}  -- {detail}")
        failed += 1


def warn(name, detail):
    global warnings
    print(f"  [WARN] {name}  -- {detail}")
    warnings += 1


# --------------------------------------------------------------------------
# TEST 1: All expected pkl files exist
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 1: PKL files exist")
print("=" * 60)

pkl_files = sorted(
    f for f in os.listdir(RESULTS_DIR)
    if f.endswith(".pkl") and not f.endswith("_checkpoint.pkl")
)
check("At least 9 pkl files found", len(pkl_files) >= 9,
      f"found {len(pkl_files)}")


# --------------------------------------------------------------------------
# TEST 2-4: Load each file, check structure
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 2-4: Load, count runs, check keys, no None, finite fitness")
print("=" * 60)

all_data = {}
for fname in pkl_files:
    path = os.path.join(RESULTS_DIR, fname)
    name = fname.replace(".pkl", "")

    # Load
    try:
        with open(path, "rb") as f:
            runs = pickle.load(f)
        check(f"{name}: loads without error", True)
    except Exception as e:
        check(f"{name}: loads without error", False, str(e))
        continue

    all_data[name] = runs

    # Count
    check(f"{name}: exactly 30 runs", len(runs) == 30,
          f"got {len(runs)}")

    # No None
    n_none = sum(1 for r in runs if r is None)
    check(f"{name}: no None entries", n_none == 0,
          f"{n_none} crashed runs")

    # Finite fitness
    all_finite = all(
        r is not None and math.isfinite(r.get("best_fitness", float("nan")))
        for r in runs
    )
    check(f"{name}: all best_fitness finite", all_finite)

    # Keys check (GA vs random)
    if runs and runs[0] is not None:
        actual_keys = set(runs[0].keys())
        if name == "random_search":
            # Random search has different key set
            has_common = COMMON_KEYS.issubset(actual_keys)
            check(f"{name}: has common keys (best_fitness, best_chromosome)",
                  has_common, f"missing {COMMON_KEYS - actual_keys}")
            check(f"{name}: has 'convergence' key",
                  RANDOM_SEARCH_CONVERGENCE_KEY in actual_keys)
        else:
            # GA files should have all expected keys
            missing = GA_EXPECTED_KEYS - actual_keys
            check(f"{name}: has all GA keys", len(missing) == 0,
                  f"missing {missing}")


# --------------------------------------------------------------------------
# TEST 5: random_search vs GA format compatibility
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 5: random_search vs GA format compatibility")
print("=" * 60)

if "random_search" in all_data and "baseline" in all_data:
    rs_keys = set(all_data["random_search"][0].keys())
    ga_keys = set(all_data["baseline"][0].keys())

    only_ga = ga_keys - rs_keys
    only_rs = rs_keys - ga_keys

    check("Common keys present in both",
          COMMON_KEYS.issubset(rs_keys) and COMMON_KEYS.issubset(ga_keys))
    check("Random search uses 'convergence' (not 'convergence_history')",
          "convergence" in rs_keys and "convergence_history" not in rs_keys)
    check("GA uses 'convergence_history' (not 'convergence')",
          "convergence_history" in ga_keys)

    # Verify convergence can be extracted uniformly
    def get_convergence(run_dict):
        """Phase 4 helper: extract convergence curve from either format."""
        return run_dict.get("convergence_history",
                            run_dict.get("convergence"))

    ga_conv = get_convergence(all_data["baseline"][0])
    rs_conv = get_convergence(all_data["random_search"][0])
    check("get_convergence() works for GA", ga_conv is not None and len(ga_conv) > 0)
    check("get_convergence() works for random_search", rs_conv is not None and len(rs_conv) > 0)
    check("Both convergence lists same length", len(ga_conv) == len(rs_conv),
          f"GA={len(ga_conv)}, RS={len(rs_conv)}")

    print(f"\n  Format documentation for Phase 4:")
    print(f"    GA keys only ({len(only_ga)}): {sorted(only_ga)}")
    print(f"    Random keys only ({len(only_rs)}): {sorted(only_rs)}")
    print(f"    To get convergence: r.get('convergence_history', r.get('convergence'))")
    print(f"    Guard missing keys with r.get(key, default) for random_search results")
else:
    warn("random_search or baseline not found", "cannot compare formats")


# --------------------------------------------------------------------------
# TEST 6: Seed verification (distinct runs)
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 6: Seed verification (distinct runs)")
print("=" * 60)

for name in ["baseline", "random_search"]:
    if name not in all_data:
        warn(f"{name}: seed check skipped", "file not loaded")
        continue

    runs = all_data[name]
    fits = [r["best_fitness"] for r in runs if r is not None]
    unique_fits = len(set(fits))
    check(f"{name}: 30 distinct best_fitness values",
          unique_fits == 30, f"only {unique_fits} unique")

    # Cross-check chromosomes
    if len(runs) >= 2 and runs[0] is not None and runs[-1] is not None:
        c0 = runs[0]["best_chromosome"]
        c_last = runs[-1]["best_chromosome"]
        dist = np.linalg.norm(c0 - c_last)
        check(f"{name}: first/last chromosomes differ (dist={dist:.4f})",
              dist > 0.01)

    # Verify convergence arrays have correct length (should match max_generations)
    if runs and runs[0] is not None:
        conv = runs[0].get("convergence_history",
                           runs[0].get("convergence", []))
        check(f"{name}: convergence length = 75 (max_gen)",
              len(conv) == 75, f"got {len(conv)}")


# --------------------------------------------------------------------------
# SUMMARY
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
total = passed + failed
print(f"RESULTS: {passed}/{total} passed, {failed} failed, {warnings} warnings")
if failed == 0:
    print("Phase 3 validation: ALL CHECKS PASSED")
else:
    print("Phase 3 validation: SOME CHECKS FAILED")
print("=" * 60)

sys.exit(0 if failed == 0 else 1)
