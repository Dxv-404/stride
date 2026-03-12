"""Phase A validation — verify all V2 experiment results.

Run after all V2 experiments complete.  Checks:
  1. All expected .pkl files exist
  2. Each has >= 25 valid runs out of 30
  3. No NaN/Inf fitness values
  4. CPG baseline mean > 300
  5. Frozen-NN ≈ CPG baseline (NN locked = pure CPG passthrough)
  6. Seeded >> random init at gen 1 (cascade seeding works)
  7. Risk 1/2/3 checks with recommended actions

Also prints a summary table + convergence data availability check.

Usage:
    python experiments/validate_v2.py
    python experiments/validate_v2.py --risk-check   # Also run Risk 1/2/3 analysis
"""

import logging
import math
import os
import pickle
import sys
from pathlib import Path

import numpy as np
from scipy.stats import mannwhitneyu

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import V2_EXPERIMENTS

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# V1 reference values (from completed v1 baseline experiment)
SINE_BASELINE_MEAN = 746.78

# Expected V2 experiments (Phase A scope)
EXPECTED_EXPERIMENTS = [
    "cpg_baseline", "cpg_hill", "cpg_mixed",
    "cpgnn_flat", "cpgnn_mixed", "cpgnn_frozen",
    "cpgnn_high_mutation", "cpgnn_2x_budget", "cpgnn_random_init",
]

MIN_VALID_RUNS = 25
CPG_MIN_MEAN_FITNESS = 300


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_experiment(name):
    """Load a single experiment's .pkl results.

    Returns:
        list of run dicts, or None if file doesn't exist.
    """
    pkl_path = RESULTS_DIR / f"{name}.pkl"
    if not pkl_path.exists():
        return None

    try:
        with open(pkl_path, "rb") as f:
            runs = pickle.load(f)
        return [r for r in runs if r is not None]
    except Exception as e:
        print(f"  ERROR loading {name}: {e}")
        return None


def get_fitnesses(runs):
    """Extract best_fitness from valid runs."""
    return [r["best_fitness"] for r in runs
            if r is not None and "best_fitness" in r]


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

def check_file_exists(name):
    """Check 1: .pkl file exists."""
    pkl_path = RESULTS_DIR / f"{name}.pkl"
    return pkl_path.exists()


def check_run_count(runs, min_runs=MIN_VALID_RUNS):
    """Check 2: Sufficient valid runs."""
    if runs is None:
        return False, 0
    n = len(runs)
    return n >= min_runs, n


def check_no_nan_inf(runs):
    """Check 3: No NaN/Inf fitness values."""
    if runs is None:
        return False, 0
    fits = get_fitnesses(runs)
    bad = sum(1 for f in fits if math.isnan(f) or math.isinf(f))
    return bad == 0, bad


def check_convergence_data(runs):
    """Check 8: Convergence history saved per generation."""
    if not runs:
        return False, "no runs"
    # Check first valid run
    r = runs[0]
    has_conv = "convergence_history" in r and len(r["convergence_history"]) > 0
    has_best_per_gen = ("all_best_per_gen" in r and
                        len(r.get("all_best_per_gen", [])) > 0)
    if has_conv and has_best_per_gen:
        n_gens = len(r["convergence_history"])
        return True, f"{n_gens} gens"
    elif has_conv:
        return True, f"convergence only ({len(r['convergence_history'])} gens)"
    else:
        return False, "missing"


# ---------------------------------------------------------------------------
# Risk Checks (Phase A Step 3)
# ---------------------------------------------------------------------------

def risk_check_1(cpg_data):
    """Risk 1: CPG Sanity Test — is CPG mean fitness > sine baseline?

    If CPG baseline < sine baseline (746.78), coupling may be hurting.
    Mitigations: sine-seeded init (already done), phased evolution,
    reduced coupling topology.
    """
    print("\n" + "=" * 60)
    print("  RISK 1 CHECK: CPG Sanity Test")
    print("=" * 60)

    if cpg_data is None:
        print("  SKIP: cpg_baseline not available")
        return None

    fits = get_fitnesses(cpg_data)
    cpg_mean = np.mean(fits)
    cpg_best = max(fits)
    cpg_worst = min(fits)

    print(f"  Sine baseline mean:  {SINE_BASELINE_MEAN:.2f}")
    print(f"  CPG baseline mean:   {cpg_mean:.2f} ± {np.std(fits):.2f}")
    print(f"  CPG baseline best:   {cpg_best:.2f}")
    print(f"  CPG baseline worst:  {cpg_worst:.2f}")

    if cpg_mean < CPG_MIN_MEAN_FITNESS:
        print(f"\n  [FAIL] CPG mean ({cpg_mean:.2f}) < {CPG_MIN_MEAN_FITNESS}")
        print("  ACTION: Check coupling weights, consider reducing topology")
        return "FAIL"
    elif cpg_mean < SINE_BASELINE_MEAN:
        print(f"\n  [WARN] CPG mean ({cpg_mean:.2f}) < sine mean ({SINE_BASELINE_MEAN:.2f})")
        print("  Coupling may be hurting. Consider phased evolution.")
        print("  However, if CPG mean > 300, the GA found usable walkers.")
        return "WARN"
    else:
        print(f"\n  [PASS] CPG mean ({cpg_mean:.2f}) >= sine mean ({SINE_BASELINE_MEAN:.2f})")
        return "PASS"


def risk_check_2(cpgnn_flat_data, cpgnn_frozen_data, cpgnn_mixed_data):
    """Risk 2: CPG+NN Might Not Use the NN.

    Compare cpgnn_flat vs cpgnn_frozen. If statistically indistinguishable
    (Mann-Whitney p > 0.05), the NN learned nothing on flat terrain.

    If cpgnn_mixed also ≈ cpgnn_frozen, Risk 2 has fully triggered.
    """
    print("\n" + "=" * 60)
    print("  RISK 2 CHECK: Does the NN Learn Anything?")
    print("=" * 60)

    if cpgnn_flat_data is None or cpgnn_frozen_data is None:
        print("  SKIP: cpgnn_flat or cpgnn_frozen not available")
        return None

    flat_fits = get_fitnesses(cpgnn_flat_data)
    frozen_fits = get_fitnesses(cpgnn_frozen_data)

    flat_mean = np.mean(flat_fits)
    frozen_mean = np.mean(frozen_fits)

    print(f"  cpgnn_flat mean:     {flat_mean:.2f} ± {np.std(flat_fits):.2f}")
    print(f"  cpgnn_frozen mean:   {frozen_mean:.2f} ± {np.std(frozen_fits):.2f}")

    # Mann-Whitney U test
    if len(flat_fits) >= 5 and len(frozen_fits) >= 5:
        stat, p_value = mannwhitneyu(flat_fits, frozen_fits,
                                     alternative='two-sided')
        print(f"  Mann-Whitney p-value: {p_value:.4f}")
    else:
        p_value = 1.0
        print("  Mann-Whitney: insufficient data")

    flat_vs_frozen_sig = p_value < 0.05

    if flat_vs_frozen_sig:
        diff = flat_mean - frozen_mean
        print(f"\n  [PASS] cpgnn_flat vs cpgnn_frozen: SIGNIFICANT (p={p_value:.4f})")
        print(f"         Difference: {diff:+.2f} ({'flat better' if diff > 0 else 'frozen better'})")
        print("         The NN learned something useful on flat terrain!")
        return "PASS"
    else:
        print(f"\n  [INFO] cpgnn_flat ~ cpgnn_frozen on flat terrain (p={p_value:.4f})")
        print("         This is EXPECTED on flat terrain — the environment is")
        print("         perfectly predictable, so sensory feedback adds nothing.")

        # Check mixed terrain
        if cpgnn_mixed_data is not None:
            mixed_fits = get_fitnesses(cpgnn_mixed_data)
            mixed_mean = np.mean(mixed_fits)
            print(f"\n  cpgnn_mixed mean:    {mixed_mean:.2f} ± {np.std(mixed_fits):.2f}")

            if len(mixed_fits) >= 5:
                _, p_mixed = mannwhitneyu(mixed_fits, frozen_fits,
                                         alternative='two-sided')
                print(f"  cpgnn_mixed vs cpgnn_frozen p-value: {p_mixed:.4f}")

                if p_mixed < 0.05:
                    diff = mixed_mean - frozen_mean
                    print(f"\n  [PASS] NN learns on MIXED terrain (diff={diff:+.2f})")
                    print("         Flat result is valid: 'NN needs diverse terrain.'")
                    return "PASS_MIXED_ONLY"
                else:
                    print("\n  [FAIL] NN learns NOTHING even on mixed terrain!")
                    print("  ACTION: Run cpgnn_perturbation_trained (experiment 6c)")
                    print("  Add to V2_EXPERIMENTS with perturbation_during_training=True")
                    return "FAIL"
            else:
                print("  cpgnn_mixed: insufficient data")
                return "INCONCLUSIVE"
        else:
            print("\n  cpgnn_mixed not yet available — run it to complete Risk 2 check")
            return "INCONCLUSIVE"


def risk_check_3(cpgnn_flat_data, cpgnn_random_data):
    """Risk 3: Cascade seeding validation.

    cpgnn_random_init should converge much slower. If its mean fitness < 100,
    this is expected and validates cascade seeding.
    """
    print("\n" + "=" * 60)
    print("  RISK 3 CHECK: Cascade Seeding Validation")
    print("=" * 60)

    if cpgnn_random_data is None:
        print("  SKIP: cpgnn_random_init not available")
        return None

    random_fits = get_fitnesses(cpgnn_random_data)
    random_mean = np.mean(random_fits)

    print(f"  cpgnn_random_init mean: {random_mean:.2f} ± {np.std(random_fits):.2f}")

    if cpgnn_flat_data is not None:
        flat_fits = get_fitnesses(cpgnn_flat_data)
        flat_mean = np.mean(flat_fits)
        print(f"  cpgnn_flat (seeded) mean: {flat_mean:.2f}")
        print(f"  Difference: {flat_mean - random_mean:+.2f}")

        # Compare gen 1 fitness
        flat_gen1 = [r["convergence_history"][0] for r in cpgnn_flat_data
                     if r and "convergence_history" in r and r["convergence_history"]]
        rand_gen1 = [r["convergence_history"][0] for r in cpgnn_random_data
                     if r and "convergence_history" in r and r["convergence_history"]]

        if flat_gen1 and rand_gen1:
            print(f"\n  Gen 1 fitness (seeded):  {np.mean(flat_gen1):.2f} ± {np.std(flat_gen1):.2f}")
            print(f"  Gen 1 fitness (random):  {np.mean(rand_gen1):.2f} ± {np.std(rand_gen1):.2f}")
            gen1_ratio = np.mean(flat_gen1) / max(np.mean(rand_gen1), 1.0)
            print(f"  Seeded/Random ratio:     {gen1_ratio:.1f}x")

    if random_mean < 100:
        print(f"\n  [PASS] Random init mean ({random_mean:.2f}) < 100")
        print("         96-gene search space too hard without seeding — expected.")
        return "PASS"
    elif random_mean < 300:
        print(f"\n  [INFO] Random init finds some walkers ({random_mean:.2f})")
        print("         Cascade seeding still helps, but space is navigable.")
        return "PARTIAL"
    else:
        print(f"\n  [INFO] Random init converges well ({random_mean:.2f})")
        print("         Cascade seeding may not be necessary — interesting finding!")
        return "UNNECESSARY"


# ---------------------------------------------------------------------------
# Main validation
# ---------------------------------------------------------------------------

def run_validation(run_risk_checks=False):
    """Run all Phase A validation checks."""
    print("\n" + "=" * 60)
    print("  STRIDE Phase A — V2 Experiment Validation")
    print("=" * 60 + "\n")

    all_data = {}
    all_pass = True

    # Load all experiments
    for name in EXPECTED_EXPERIMENTS:
        all_data[name] = load_experiment(name)

    # --- Check 1-3: File existence, run count, NaN check ---
    print(f"{'Experiment':<25} {'Exists':>7} {'Runs':>6} {'NaN':>5} "
          f"{'Mean':>9} {'Best':>9} {'Worst':>9} {'Conv':>12}")
    print("-" * 90)

    for name in EXPECTED_EXPERIMENTS:
        runs = all_data[name]
        exists = check_file_exists(name)
        ok_runs, n_runs = check_run_count(runs)
        ok_nan, n_bad = check_no_nan_inf(runs)
        ok_conv, conv_info = check_convergence_data(runs)

        exists_str = "OK" if exists else "MISS"
        runs_str = f"{n_runs}/30" if exists else "---"
        nan_str = "OK" if ok_nan else f"{n_bad}!"

        if runs and get_fitnesses(runs):
            fits = get_fitnesses(runs)
            mean_f = np.mean(fits)
            best_f = max(fits)
            worst_f = min(fits)
            mean_str = f"{mean_f:>9.2f}"
            best_str = f"{best_f:>9.2f}"
            worst_str = f"{worst_f:>9.2f}"
        else:
            mean_str = f"{'---':>9}"
            best_str = f"{'---':>9}"
            worst_str = f"{'---':>9}"

        # Mark failures
        status_markers = []
        if not exists:
            status_markers.append("MISSING")
            all_pass = False
        if exists and not ok_runs:
            status_markers.append(f"LOW_RUNS({n_runs})")
            all_pass = False
        if exists and not ok_nan:
            status_markers.append("HAS_NaN")
            all_pass = False

        conv_str = conv_info if ok_conv else f"!{conv_info}"

        print(f"{name:<25} {exists_str:>7} {runs_str:>6} {nan_str:>5} "
              f"{mean_str} {best_str} {worst_str} {conv_str:>12}")

    print("-" * 90)

    # --- Check 4: CPG baseline minimum fitness ---
    print("\n--- Targeted Checks ---")
    cpg_runs = all_data.get("cpg_baseline")
    if cpg_runs:
        cpg_fits = get_fitnesses(cpg_runs)
        cpg_mean = np.mean(cpg_fits)
        if cpg_mean >= CPG_MIN_MEAN_FITNESS:
            print(f"  [OK] CPG baseline mean = {cpg_mean:.2f} >= {CPG_MIN_MEAN_FITNESS}")
        else:
            print(f"  [FAIL] CPG baseline mean = {cpg_mean:.2f} < {CPG_MIN_MEAN_FITNESS}")
            all_pass = False
    else:
        print("  [SKIP] CPG baseline not available")

    # --- Check 5: Frozen-NN ≈ CPG baseline ---
    cpg_runs = all_data.get("cpg_baseline")
    frozen_runs = all_data.get("cpgnn_frozen")
    if cpg_runs and frozen_runs:
        cpg_fits = get_fitnesses(cpg_runs)
        frozen_fits = get_fitnesses(frozen_runs)
        cpg_mean = np.mean(cpg_fits)
        frozen_mean = np.mean(frozen_fits)
        # Frozen-NN should produce similar fitness to CPG (NN is identity)
        rel_diff = abs(frozen_mean - cpg_mean) / max(cpg_mean, 1.0)
        if rel_diff < 0.15:  # within 15%
            print(f"  [OK] Frozen-NN ({frozen_mean:.2f}) ~ CPG ({cpg_mean:.2f}) "
                  f"— diff {rel_diff:.1%}")
        else:
            print(f"  [WARN] Frozen-NN ({frozen_mean:.2f}) differs from CPG "
                  f"({cpg_mean:.2f}) by {rel_diff:.1%}")
    else:
        print("  [SKIP] Frozen-NN comparison not available")

    # --- Check 6: Seeded >> random init at gen 1 ---
    flat_runs = all_data.get("cpgnn_flat")
    random_runs = all_data.get("cpgnn_random_init")
    if flat_runs and random_runs:
        flat_gen1 = [r["convergence_history"][0] for r in flat_runs
                     if r and "convergence_history" in r and r["convergence_history"]]
        rand_gen1 = [r["convergence_history"][0] for r in random_runs
                     if r and "convergence_history" in r and r["convergence_history"]]
        if flat_gen1 and rand_gen1:
            f1 = np.mean(flat_gen1)
            r1 = np.mean(rand_gen1)
            ratio = f1 / max(r1, 1.0)
            print(f"  [{'OK' if ratio > 2.0 else 'WARN'}] Seeded gen-1 ({f1:.2f}) vs "
                  f"random gen-1 ({r1:.2f}) — ratio {ratio:.1f}x")
        else:
            print("  [SKIP] Gen-1 convergence data not available")
    else:
        print("  [SKIP] Seeded vs random comparison not available")

    # --- Summary ---
    print("\n" + "=" * 60)
    available = sum(1 for n in EXPECTED_EXPERIMENTS if all_data[n] is not None)
    print(f"  Experiments: {available}/{len(EXPECTED_EXPERIMENTS)} available")
    if all_pass and available == len(EXPECTED_EXPERIMENTS):
        print("  STATUS: ALL CHECKS PASSED")
    elif available == 0:
        print("  STATUS: NO EXPERIMENTS COMPLETED — run them first!")
    else:
        missing = [n for n in EXPECTED_EXPERIMENTS if all_data[n] is None]
        if missing:
            print(f"  MISSING: {', '.join(missing)}")
        print(f"  STATUS: {'PARTIAL — some checks failed' if not all_pass else 'AVAILABLE CHECKS PASSED'}")
    print("=" * 60)

    # --- Risk checks (optional, only when experiments complete) ---
    if run_risk_checks:
        risk_1 = risk_check_1(all_data.get("cpg_baseline"))
        risk_2 = risk_check_2(
            all_data.get("cpgnn_flat"),
            all_data.get("cpgnn_frozen"),
            all_data.get("cpgnn_mixed"),
        )
        risk_3 = risk_check_3(
            all_data.get("cpgnn_flat"),
            all_data.get("cpgnn_random_init"),
        )

        print("\n" + "=" * 60)
        print("  Risk Summary")
        print("=" * 60)
        print(f"  Risk 1 (CPG sanity):       {risk_1 or 'N/A'}")
        print(f"  Risk 2 (NN learns):        {risk_2 or 'N/A'}")
        print(f"  Risk 3 (cascade seeding):  {risk_3 or 'N/A'}")

        if risk_2 == "FAIL":
            print("\n  *** RISK 2 TRIGGERED ***")
            print("  Run: python main.py --v2 --experiments cpgnn_perturbation_trained")
            print("  (Add the experiment to config.py first — see phasea_spec.md Step 3)")
        print("=" * 60)

    return all_pass


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="STRIDE Phase A — V2 Experiment Validation"
    )
    parser.add_argument(
        "--risk-check", action="store_true",
        help="Also run Risk 1/2/3 analysis"
    )
    args = parser.parse_args()

    run_validation(run_risk_checks=args.risk_check)
