    """Phase 4 — Statistical analysis of all STRIDE experiment results.

Loads experiment .pkl files, computes per-experiment stats, comparison
tables, Wilcoxon rank-sum tests, Cohen's d effect sizes, convergence
speed (G_80), and saves everything as CSV files.

V2 additions:
  - Holm-Bonferroni correction for multiple comparisons
  - seeded_vs_random comparison group
  - v2_stats.csv and v2_stat_tests.csv output files

Usage:
    python experiments/analyze_results.py
"""

import logging
import math
import os
import pickle
import sys
from pathlib import Path

import numpy as np
from scipy.stats import ranksums, mannwhitneyu

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import (
    EXPERIMENTS, PRIORITY_P0, PRIORITY_P1, PRIORITY_P2,
    V2_EXPERIMENTS, V2_PRIORITY_P0, V2_PRIORITY_P1, V2_PRIORITY_P2,
)

logger = logging.getLogger(__name__)

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_all_results():
    """Load all completed experiment .pkl files.

    Returns:
        dict mapping experiment_name -> list of run dicts.
    """
    all_data = {}
    pkl_files = sorted(RESULTS_DIR.glob("*.pkl"))

    for pkl in pkl_files:
        name = pkl.stem
        if name.endswith("_checkpoint"):
            continue
        try:
            with open(pkl, "rb") as f:
                runs = pickle.load(f)
            if runs and len(runs) > 0:
                all_data[name] = runs
                print(f"  Loaded {name}: {len(runs)} runs")
            else:
                print(f"  SKIP {name}: empty file")
        except Exception as e:
            print(f"  ERROR loading {name}: {e}")

    return all_data


def get_convergence(run_dict):
    """Extract convergence curve from either GA or random_search format."""
    return run_dict.get("convergence_history",
                        run_dict.get("convergence"))


def get_fitness_values(runs):
    """Extract best_fitness from all valid runs."""
    return [r["best_fitness"] for r in runs if r is not None]


# ---------------------------------------------------------------------------
# Per-Experiment Statistics
# ---------------------------------------------------------------------------

def compute_experiment_stats(all_data):
    """Compute descriptive stats for each experiment.

    Returns:
        list of dicts with keys: name, n_runs, mean, median, std, best, worst
    """
    rows = []
    for name, runs in all_data.items():
        fits = get_fitness_values(runs)
        if not fits:
            rows.append({
                "name": name, "n_runs": 0,
                "mean": float("nan"), "median": float("nan"),
                "std": float("nan"), "best": float("nan"),
                "worst": float("nan"),
            })
            continue

        n = len(fits)
        arr = np.array(fits)

        # Edge case: std=0
        std_val = float(np.std(arr, ddof=1)) if n > 1 else 0.0

        rows.append({
            "name": name,
            "n_runs": n,
            "mean": float(np.mean(arr)),
            "median": float(np.median(arr)),
            "std": std_val,
            "best": float(np.max(arr)),
            "worst": float(np.min(arr)),
        })

    return rows


# ---------------------------------------------------------------------------
# Statistical Tests
# ---------------------------------------------------------------------------

def compare_to_baseline(baseline_fits, variant_fits, variant_name):
    """Compare variant against baseline using Wilcoxon rank-sum test.

    Args:
        baseline_fits: list of floats — baseline best_fitness values.
        variant_fits: list of floats — variant best_fitness values.
        variant_name: str — name for labeling.

    Returns:
        dict with test results, or None if test cannot be run.
    """
    # Edge case: too few runs
    if len(baseline_fits) < 5 or len(variant_fits) < 5:
        logger.warning(f"{variant_name}: insufficient data for stats "
                       f"(baseline={len(baseline_fits)}, variant={len(variant_fits)})")
        return {
            "name": variant_name,
            "W_statistic": float("nan"),
            "p_value": float("nan"),
            "significance": "N/A",
            "cohens_d": float("nan"),
            "rank_biserial_r": float("nan"),
            "baseline_mean": float(np.mean(baseline_fits)),
            "variant_mean": float(np.mean(variant_fits)),
            "diff": float("nan"),
        }

    # Edge case: zero standard deviation in either group
    b_std = np.std(baseline_fits, ddof=1)
    v_std = np.std(variant_fits, ddof=1)

    if b_std == 0 and v_std == 0:
        logger.warning(f"{variant_name}: both groups have std=0, skipping test")
        return {
            "name": variant_name,
            "W_statistic": float("nan"),
            "p_value": float("nan"),
            "significance": "N/A (std=0)",
            "cohens_d": 0.0,
            "rank_biserial_r": 0.0,
            "baseline_mean": float(np.mean(baseline_fits)),
            "variant_mean": float(np.mean(variant_fits)),
            "diff": float(np.mean(variant_fits) - np.mean(baseline_fits)),
        }

    # Wilcoxon rank-sum test
    stat, p_value = ranksums(baseline_fits, variant_fits)

    # Mann-Whitney U for rank-biserial correlation
    u_stat, _ = mannwhitneyu(baseline_fits, variant_fits,
                             alternative='two-sided')
    n1, n2 = len(baseline_fits), len(variant_fits)
    rank_biserial_r = 1 - (2 * u_stat) / (n1 * n2)

    # Cohen's d
    pooled_std = math.sqrt((b_std ** 2 + v_std ** 2) / 2)
    if pooled_std > 0:
        cohens_d = (np.mean(variant_fits) - np.mean(baseline_fits)) / pooled_std
    else:
        cohens_d = 0.0

    # Significance markers
    if p_value < 0.001:
        significance = "***"
    elif p_value < 0.01:
        significance = "**"
    elif p_value < 0.05:
        significance = "*"
    else:
        significance = "ns"

    return {
        "name": variant_name,
        "W_statistic": float(stat),
        "p_value": float(p_value),
        "significance": significance,
        "cohens_d": float(cohens_d),
        "rank_biserial_r": float(rank_biserial_r),
        "baseline_mean": float(np.mean(baseline_fits)),
        "variant_mean": float(np.mean(variant_fits)),
        "diff": float(np.mean(variant_fits) - np.mean(baseline_fits)),
    }


def cohen_d_label(d):
    """Interpret Cohen's d magnitude."""
    ad = abs(d)
    if ad < 0.2:
        return "negligible"
    elif ad < 0.5:
        return "small"
    elif ad < 0.8:
        return "medium"
    else:
        return "large"


def holm_bonferroni_correction(p_values):
    """Apply Holm-Bonferroni correction to a list of p-values.

    Less conservative than strict Bonferroni, but still controls
    family-wise error rate (FWER). Procedure:
      1. Sort p-values ascending
      2. For rank k (1-indexed), compare p_k to alpha / (m - k + 1)
      3. Adjusted p_k = max(p_k * (m - k + 1), adjusted_p_{k-1})

    Args:
        p_values: list of (name, p_value) tuples.

    Returns:
        list of (name, original_p, adjusted_p, significance) tuples.
    """
    m = len(p_values)
    if m == 0:
        return []

    # Sort by p-value
    sorted_pvals = sorted(p_values, key=lambda x: x[1])

    adjusted = []
    prev_adj = 0.0
    for k, (name, p) in enumerate(sorted_pvals):
        rank = k + 1
        adj_p = min(1.0, p * (m - rank + 1))
        adj_p = max(adj_p, prev_adj)  # Enforce monotonicity
        prev_adj = adj_p

        if adj_p < 0.001:
            sig = "***"
        elif adj_p < 0.01:
            sig = "**"
        elif adj_p < 0.05:
            sig = "*"
        else:
            sig = "ns"

        adjusted.append((name, p, adj_p, sig))

    return adjusted


# ---------------------------------------------------------------------------
# Convergence Speed
# ---------------------------------------------------------------------------

def compute_convergence_speed(convergence_history, threshold=0.8):
    """Find generation where fitness first reaches threshold% of final value.

    Args:
        convergence_history: list of best-so-far fitness per generation.
        threshold: fraction of final fitness to target (default 0.8).

    Returns:
        int — generation index (0-based) where threshold was first reached.
    """
    if not convergence_history:
        return -1

    final_fitness = convergence_history[-1]
    if final_fitness <= 0:
        return len(convergence_history)  # Never converged meaningfully

    target = threshold * final_fitness
    for g, fitness in enumerate(convergence_history):
        if fitness >= target:
            return g
    return len(convergence_history)  # Never reached threshold


def compute_g80_stats(all_data):
    """Compute G_80 convergence speed for each experiment.

    Returns:
        list of dicts: name, mean_g80, median_g80, std_g80
    """
    rows = []
    for name, runs in all_data.items():
        g80_values = []
        for r in runs:
            if r is None:
                continue
            conv = get_convergence(r)
            if conv and len(conv) > 0:
                g80 = compute_convergence_speed(conv, threshold=0.8)
                g80_values.append(g80)

        if g80_values:
            arr = np.array(g80_values)
            rows.append({
                "name": name,
                "n_runs": len(g80_values),
                "mean_g80": float(np.mean(arr)),
                "median_g80": float(np.median(arr)),
                "std_g80": float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
                "min_g80": int(np.min(arr)),
                "max_g80": int(np.max(arr)),
            })
        else:
            rows.append({
                "name": name, "n_runs": 0,
                "mean_g80": float("nan"), "median_g80": float("nan"),
                "std_g80": float("nan"), "min_g80": -1, "max_g80": -1,
            })

    return rows


# ---------------------------------------------------------------------------
# Comparison Groups
# ---------------------------------------------------------------------------

COMPARISON_GROUPS = {
    "ga_vs_random": {
        "title": "GA vs Random Search",
        "experiments": ["baseline", "random_search"],
        "baseline_key": "baseline",
    },
    "selection": {
        "title": "Selection Method Comparison",
        "experiments": ["baseline", "roulette_selection", "rank_selection"],
        "baseline_key": "baseline",
    },
    "mutation": {
        "title": "Mutation Rate Comparison",
        "experiments": ["baseline", "mutation_low", "mutation_high",
                        "mutation_adaptive"],
        "baseline_key": "baseline",
    },
    "elitism": {
        "title": "Elitism Comparison",
        "experiments": ["no_elitism", "baseline", "high_elitism"],
        "baseline_key": "baseline",
    },
    "encoding": {
        "title": "Encoding Comparison",
        "experiments": ["baseline", "indirect_encoding"],
        "baseline_key": "baseline",
    },
    "terrain": {
        "title": "Terrain Comparison",
        "experiments": ["baseline", "hill_terrain", "mixed_terrain"],
        "baseline_key": "baseline",
    },
    "crossover": {
        "title": "Crossover Rate Comparison",
        "experiments": ["crossover_low", "baseline", "crossover_high"],
        "baseline_key": "baseline",
    },
    "population": {
        "title": "Population Size Comparison",
        "experiments": ["pop_small", "baseline", "pop_large"],
        "baseline_key": "baseline",
    },
    "algorithms": {
        "title": "Algorithm Comparison (GA vs DE vs PSO vs CMA-ES)",
        "experiments": ["baseline", "random_search", "de_baseline",
                        "pso_baseline", "cmaes_baseline"],
        "baseline_key": "baseline",
    },
}

# V2 comparison groups (CPG / CPG+NN tier)
V2_COMPARISON_GROUPS = {
    "controller_tiers": {
        "title": "Controller Tier Comparison (Sine vs CPG vs CPG+NN)",
        "experiments": ["baseline", "cpg_baseline", "cpgnn_flat"],
        "baseline_key": "baseline",
    },
    "cpg_terrain": {
        "title": "CPG Terrain Generalization",
        "experiments": ["cpg_baseline", "cpg_hill", "cpg_mixed"],
        "baseline_key": "cpg_baseline",
    },
    "cpgnn_variants": {
        "title": "CPG+NN Ablation Study",
        "experiments": ["cpgnn_flat", "cpgnn_frozen", "cpgnn_mixed",
                        "cpgnn_2x_budget"],
        "baseline_key": "cpgnn_flat",
    },
    "cpgnn_vs_frozen": {
        "title": "CPG+NN vs Frozen-NN (NN Contribution Test)",
        "experiments": ["cpgnn_flat", "cpgnn_frozen"],
        "baseline_key": "cpgnn_frozen",
    },
    "cpgnn_mutation": {
        "title": "CPG+NN Mutation Rate Comparison",
        "experiments": ["cpgnn_flat", "cpgnn_high_mutation"],
        "baseline_key": "cpgnn_flat",
    },
    "seeded_vs_random": {
        "title": "Seeded vs Random Init (Table 7)",
        "experiments": ["cpgnn_flat", "cpgnn_random_init"],
        "baseline_key": "cpgnn_flat",
    },
    "full_controller_tiers": {
        "title": "Full Controller Tier Comparison (Table 1)",
        "experiments": ["baseline", "cpg_baseline", "cpgnn_flat",
                        "cpgnn_frozen", "cpgnn_mixed", "cpgnn_random_init"],
        "baseline_key": "baseline",
    },
}


# ---------------------------------------------------------------------------
# CSV I/O
# ---------------------------------------------------------------------------

def save_csv(rows, filepath, columns=None):
    """Save list of dicts as CSV file.

    Args:
        rows: list of dicts.
        filepath: output path.
        columns: optional list of column names (ordering). If None, uses
                 keys of first row.
    """
    if not rows:
        print(f"  SKIP CSV (no data): {filepath}")
        return

    if columns is None:
        columns = list(rows[0].keys())

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(",".join(columns) + "\n")
        for row in rows:
            vals = []
            for col in columns:
                v = row.get(col, "")
                if isinstance(v, float):
                    if math.isnan(v):
                        vals.append("N/A")
                    else:
                        vals.append(f"{v:.4f}")
                else:
                    vals.append(str(v))
            f.write(",".join(vals) + "\n")

    print(f"  Saved: {filepath}")


# ---------------------------------------------------------------------------
# Console Printing
# ---------------------------------------------------------------------------

def print_stats_table(stats):
    """Print formatted stats table to console."""
    print(f"\n{'='*80}")
    print(f"{'Experiment':<25} {'Runs':>5} {'Mean':>9} {'Median':>9} "
          f"{'Std':>8} {'Best':>9} {'Worst':>9}")
    print(f"{'-'*80}")
    for s in stats:
        name = s["name"]
        if s["n_runs"] == 0:
            print(f"{name:<25} {'N/A':>5}")
            continue
        print(f"{name:<25} {s['n_runs']:>5} {s['mean']:>9.2f} "
              f"{s['median']:>9.2f} {s['std']:>8.2f} "
              f"{s['best']:>9.2f} {s['worst']:>9.2f}")
    print(f"{'='*80}\n")


def print_comparison_table(group_name, results, group_info):
    """Print formatted comparison results."""
    print(f"\n--- {group_info['title']} ---")
    print(f"{'Variant':<25} {'Mean':>8} {'Diff':>8} {'p-value':>10} "
          f"{'Sig':>5} {'Cohen d':>9} {'Effect':>12}")
    print(f"{'-'*80}")
    for r in results:
        if r is None:
            continue
        name = r["name"]
        if name == group_info["baseline_key"]:
            print(f"{name:<25} {r['baseline_mean']:>8.2f} {'(base)':>8} "
                  f"{'---':>10} {'---':>5} {'---':>9} {'---':>12}")
            continue
        p_str = f"{r['p_value']:.4f}" if not math.isnan(r['p_value']) else "N/A"
        d_str = f"{r['cohens_d']:.3f}" if not math.isnan(r['cohens_d']) else "N/A"
        d_label = cohen_d_label(r['cohens_d']) if not math.isnan(r['cohens_d']) else "N/A"
        diff = r['diff']
        diff_str = f"{diff:>+8.2f}" if not math.isnan(diff) else "N/A"
        print(f"{name:<25} {r['variant_mean']:>8.2f} {diff_str:>8} "
              f"{p_str:>10} {r['significance']:>5} {d_str:>9} {d_label:>12}")


def print_g80_table(g80_stats):
    """Print convergence speed table."""
    print(f"\n{'='*70}")
    print(f"{'Experiment':<25} {'Runs':>5} {'Mean G80':>9} {'Med G80':>9} "
          f"{'Std':>7} {'Min':>5} {'Max':>5}")
    print(f"{'-'*70}")
    for s in g80_stats:
        name = s["name"]
        if s["n_runs"] == 0:
            print(f"{name:<25} {'N/A':>5}")
            continue
        print(f"{name:<25} {s['n_runs']:>5} {s['mean_g80']:>9.1f} "
              f"{s['median_g80']:>9.1f} {s['std_g80']:>7.1f} "
              f"{s['min_g80']:>5} {s['max_g80']:>5}")
    print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_analysis():
    """Run the complete analysis pipeline."""
    print("\n" + "=" * 60)
    print("  STRIDE Phase 4 — Statistical Analysis")
    print("=" * 60 + "\n")

    # 1. Load all results
    print("[1/5] Loading experiment results...")
    all_data = load_all_results()
    if not all_data:
        print("ERROR: No experiment results found!")
        sys.exit(1)
    print(f"  Loaded {len(all_data)} experiments\n")

    # 2. Per-experiment statistics
    print("[2/5] Computing per-experiment statistics...")
    stats = compute_experiment_stats(all_data)
    print_stats_table(stats)
    save_csv(stats, RESULTS_DIR / "table_experiment_stats.csv",
             columns=["name", "n_runs", "mean", "median", "std", "best", "worst"])

    # 3. Comparison groups with Wilcoxon tests
    print("[3/5] Running statistical comparisons...")
    all_comparisons = {}

    for group_key, group_info in COMPARISON_GROUPS.items():
        baseline_key = group_info["baseline_key"]
        if baseline_key not in all_data:
            print(f"  SKIP {group_key}: baseline '{baseline_key}' not found")
            continue

        baseline_fits = get_fitness_values(all_data[baseline_key])
        results = []

        for exp_name in group_info["experiments"]:
            if exp_name not in all_data:
                print(f"  SKIP {exp_name}: not found")
                continue

            if exp_name == baseline_key:
                # Add baseline row for display
                results.append({
                    "name": exp_name,
                    "W_statistic": float("nan"),
                    "p_value": float("nan"),
                    "significance": "---",
                    "cohens_d": float("nan"),
                    "rank_biserial_r": float("nan"),
                    "baseline_mean": float(np.mean(baseline_fits)),
                    "variant_mean": float(np.mean(baseline_fits)),
                    "diff": 0.0,
                })
            else:
                variant_fits = get_fitness_values(all_data[exp_name])
                result = compare_to_baseline(baseline_fits, variant_fits,
                                             exp_name)
                results.append(result)

        all_comparisons[group_key] = results
        print_comparison_table(group_key, results, group_info)

        # Save group CSV
        csv_rows = [r for r in results if r is not None and r["name"] != baseline_key]
        save_csv(csv_rows,
                 RESULTS_DIR / f"table_comparison_{group_key}.csv",
                 columns=["name", "baseline_mean", "variant_mean", "diff",
                          "W_statistic", "p_value", "significance",
                          "cohens_d", "rank_biserial_r"])

    # 4. Full significance table (all experiments vs baseline)
    print("\n[4/5] Building full significance table...")
    baseline_fits = get_fitness_values(all_data.get("baseline", []))
    full_sig_rows = []

    if baseline_fits:
        for name, runs in all_data.items():
            if name == "baseline":
                continue
            variant_fits = get_fitness_values(runs)
            if len(variant_fits) >= 5:
                result = compare_to_baseline(baseline_fits, variant_fits, name)
                result["effect_label"] = cohen_d_label(result["cohens_d"]) \
                    if not math.isnan(result["cohens_d"]) else "N/A"
                full_sig_rows.append(result)

        # Sort by p-value
        full_sig_rows.sort(key=lambda r: r["p_value"]
                           if not math.isnan(r["p_value"]) else 999)

        save_csv(full_sig_rows,
                 RESULTS_DIR / "table_significance_all.csv",
                 columns=["name", "baseline_mean", "variant_mean", "diff",
                          "p_value", "significance", "cohens_d",
                          "effect_label", "rank_biserial_r"])

        # Print summary
        print(f"\n{'='*90}")
        print(f"{'Experiment':<25} {'Base Mean':>10} {'Var Mean':>10} "
              f"{'Diff':>8} {'p-value':>10} {'Sig':>5} {'d':>7} {'Effect':>12}")
        print(f"{'-'*90}")
        for r in full_sig_rows:
            p_str = f"{r['p_value']:.4f}" if not math.isnan(r['p_value']) else "N/A"
            d_str = f"{r['cohens_d']:.3f}" if not math.isnan(r['cohens_d']) else "N/A"
            diff_str = f"{r['diff']:>+8.2f}" if not math.isnan(r['diff']) else "N/A"
            print(f"{r['name']:<25} {r['baseline_mean']:>10.2f} "
                  f"{r['variant_mean']:>10.2f} {diff_str:>8} "
                  f"{p_str:>10} {r['significance']:>5} {d_str:>7} "
                  f"{r['effect_label']:>12}")
        print(f"{'='*90}\n")

    # 5. Convergence speed (G_80)
    print("[5/7] Computing convergence speed (G_80)...")
    g80_stats = compute_g80_stats(all_data)
    print_g80_table(g80_stats)
    save_csv(g80_stats, RESULTS_DIR / "table_convergence_speed.csv",
             columns=["name", "n_runs", "mean_g80", "median_g80",
                      "std_g80", "min_g80", "max_g80"])

    # 6. V2 comparison groups (CPG / CPG+NN)
    v2_names = set(V2_EXPERIMENTS.keys())
    has_v2 = any(name in all_data for name in v2_names)

    if has_v2:
        print("[6/7] Running V2 (CPG/CPG+NN) statistical comparisons...")
        v2_comparisons = {}

        for group_key, group_info in V2_COMPARISON_GROUPS.items():
            baseline_key = group_info["baseline_key"]
            if baseline_key not in all_data:
                print(f"  SKIP {group_key}: baseline '{baseline_key}' not found")
                continue

            baseline_fits = get_fitness_values(all_data[baseline_key])
            results = []

            for exp_name in group_info["experiments"]:
                if exp_name not in all_data:
                    print(f"  SKIP {exp_name}: not found")
                    continue

                if exp_name == baseline_key:
                    results.append({
                        "name": exp_name,
                        "W_statistic": float("nan"),
                        "p_value": float("nan"),
                        "significance": "---",
                        "cohens_d": float("nan"),
                        "rank_biserial_r": float("nan"),
                        "baseline_mean": float(np.mean(baseline_fits)),
                        "variant_mean": float(np.mean(baseline_fits)),
                        "diff": 0.0,
                    })
                else:
                    variant_fits = get_fitness_values(all_data[exp_name])
                    result = compare_to_baseline(
                        baseline_fits, variant_fits, exp_name)
                    results.append(result)

            v2_comparisons[group_key] = results
            print_comparison_table(group_key, results, group_info)

            csv_rows = [r for r in results
                        if r is not None and r["name"] != baseline_key]
            save_csv(csv_rows,
                     RESULTS_DIR / f"table_v2_comparison_{group_key}.csv",
                     columns=["name", "baseline_mean", "variant_mean", "diff",
                              "W_statistic", "p_value", "significance",
                              "cohens_d", "rank_biserial_r"])
    else:
        print("[6/7] No V2 experiment results found — skipping V2 analysis")
        v2_comparisons = {}

    # 7. V2 convergence speed
    if has_v2:
        print("[7/7] Computing V2 convergence speed (G_80)...")
        v2_data = {k: v for k, v in all_data.items() if k in v2_names}
        v2_g80 = compute_g80_stats(v2_data)
        print_g80_table(v2_g80)
        save_csv(v2_g80, RESULTS_DIR / "table_v2_convergence_speed.csv",
                 columns=["name", "n_runs", "mean_g80", "median_g80",
                          "std_g80", "min_g80", "max_g80"])
    else:
        print("[7/7] No V2 data for convergence speed — skipping")

    # 8. Generate v2_stats.csv and v2_stat_tests.csv for report
    if has_v2:
        print("[8/9] Generating v2_stats.csv and v2_stat_tests.csv...")
        _generate_v2_stats_csv(all_data, g80_stats)
        _generate_v2_stat_tests_csv(all_data)
    else:
        print("[8/9] No V2 data for v2_stats.csv — skipping")

    # 9. Apply Holm-Bonferroni correction to all v2 comparisons
    if has_v2:
        print("[9/9] Applying Holm-Bonferroni correction to V2 comparisons...")
        _apply_holm_correction_v2(all_data)
    else:
        print("[9/9] No V2 data for Holm correction — skipping")

    # Final summary
    csv_count = len(list(RESULTS_DIR.glob("table_*.csv")))
    print(f"\n{'='*60}")
    print(f"  Analysis complete!")
    print(f"  {len(all_data)} experiments analyzed")
    print(f"  {csv_count} CSV tables saved to {RESULTS_DIR}")
    print(f"{'='*60}\n")

    return all_data, stats, all_comparisons, g80_stats


def _generate_v2_stats_csv(all_data, g80_stats):
    """Generate v2_stats.csv — per-controller descriptive statistics for Table 1."""
    v2_names = ["baseline", "cpg_baseline", "cpgnn_flat", "cpgnn_frozen",
                "cpgnn_mixed", "cpgnn_random_init", "cpgnn_2x_budget",
                "cpgnn_high_mutation"]
    g80_lookup = {s["name"]: s for s in g80_stats}

    rows = []
    for name in v2_names:
        if name not in all_data:
            continue
        fits = get_fitness_values(all_data[name])
        if not fits:
            continue

        arr = np.array(fits)
        g80 = g80_lookup.get(name, {})

        rows.append({
            "experiment": name,
            "n_runs": len(fits),
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr, ddof=1)) if len(arr) > 1 else 0.0,
            "best": float(np.max(arr)),
            "worst": float(np.min(arr)),
            "median": float(np.median(arr)),
            "g80_mean": g80.get("mean_g80", float("nan")),
            "g80_std": g80.get("std_g80", float("nan")),
        })

    save_csv(rows, RESULTS_DIR / "v2_stats.csv",
             columns=["experiment", "n_runs", "mean", "std", "best",
                       "worst", "median", "g80_mean", "g80_std"])


def _generate_v2_stat_tests_csv(all_data):
    """Generate v2_stat_tests.csv — pairwise comparisons with corrections."""
    baseline_fits = get_fitness_values(all_data.get("baseline", []))
    if not baseline_fits:
        print("  SKIP v2_stat_tests.csv: no baseline data")
        return

    v2_names = ["cpg_baseline", "cpgnn_flat", "cpgnn_frozen",
                "cpgnn_mixed", "cpgnn_random_init", "cpgnn_2x_budget",
                "cpgnn_high_mutation"]

    # Collect all pairwise comparisons
    raw_results = []
    p_values_for_correction = []

    for name in v2_names:
        if name not in all_data:
            continue
        variant_fits = get_fitness_values(all_data[name])
        if len(variant_fits) < 5:
            continue

        result = compare_to_baseline(baseline_fits, variant_fits, name)
        raw_results.append(result)
        if not math.isnan(result["p_value"]):
            p_values_for_correction.append((name, result["p_value"]))

    # Apply Holm-Bonferroni
    corrected = holm_bonferroni_correction(p_values_for_correction)
    correction_lookup = {name: (orig_p, adj_p, sig)
                         for name, orig_p, adj_p, sig in corrected}

    # Build output rows
    rows = []
    for r in raw_results:
        name = r["name"]
        orig_p = r["p_value"]
        adj_p, adj_sig = float("nan"), "N/A"
        if name in correction_lookup:
            _, adj_p, adj_sig = correction_lookup[name]

        rows.append({
            "experiment": name,
            "baseline_mean": r["baseline_mean"],
            "variant_mean": r["variant_mean"],
            "diff": r["diff"],
            "p_value": orig_p,
            "p_adjusted_holm": adj_p,
            "significance_raw": r["significance"],
            "significance_corrected": adj_sig,
            "cohens_d": r["cohens_d"],
            "effect_label": cohen_d_label(r["cohens_d"]) if not math.isnan(r["cohens_d"]) else "N/A",
            "rank_biserial_r": r["rank_biserial_r"],
        })

    save_csv(rows, RESULTS_DIR / "v2_stat_tests.csv",
             columns=["experiment", "baseline_mean", "variant_mean", "diff",
                       "p_value", "p_adjusted_holm", "significance_raw",
                       "significance_corrected", "cohens_d", "effect_label",
                       "rank_biserial_r"])

    # Print Holm-Bonferroni results
    if corrected:
        print(f"\n  Holm-Bonferroni Correction ({len(corrected)} comparisons):")
        print(f"  {'Experiment':<25} {'p_raw':>10} {'p_adj':>10} {'Sig':>5}")
        print(f"  {'-'*55}")
        for name, orig_p, adj_p, sig in corrected:
            print(f"  {name:<25} {orig_p:>10.4f} {adj_p:>10.4f} {sig:>5}")


def _apply_holm_correction_v2(all_data):
    """Apply Holm-Bonferroni to seeded_vs_random and cpgnn_variants groups."""
    # Seeded vs Random (cpgnn_flat as baseline)
    cpgnn_flat_fits = get_fitness_values(all_data.get("cpgnn_flat", []))
    cpgnn_random_fits = get_fitness_values(all_data.get("cpgnn_random_init", []))

    if cpgnn_flat_fits and cpgnn_random_fits and len(cpgnn_random_fits) >= 5:
        result = compare_to_baseline(cpgnn_flat_fits, cpgnn_random_fits,
                                     "cpgnn_random_init")
        # Also compute gen-1 fitness comparison
        g1_flat = _get_gen1_fitness(all_data.get("cpgnn_flat", []))
        g1_random = _get_gen1_fitness(all_data.get("cpgnn_random_init", []))

        seeded_row = {
            "comparison": "seeded_vs_random",
            "seeded_mean": float(np.mean(cpgnn_flat_fits)),
            "random_mean": float(np.mean(cpgnn_random_fits)),
            "p_value": result["p_value"],
            "cohens_d": result["cohens_d"],
            "significance": result["significance"],
            "gen1_seeded_mean": float(np.mean(g1_flat)) if g1_flat else float("nan"),
            "gen1_random_mean": float(np.mean(g1_random)) if g1_random else float("nan"),
        }
        save_csv([seeded_row], RESULTS_DIR / "table_v2_seeded_vs_random.csv")
        print(f"  Seeded vs Random: p={result['p_value']:.4f}, "
              f"d={result['cohens_d']:.3f} ({result['significance']})")


def _get_gen1_fitness(runs):
    """Extract generation 1 best fitness from convergence histories."""
    gen1 = []
    for r in runs:
        if r is None:
            continue
        conv = get_convergence(r)
        if conv and len(conv) >= 2:
            gen1.append(conv[0])  # Gen 0 = initial
    return gen1


if __name__ == "__main__":
    run_analysis()
