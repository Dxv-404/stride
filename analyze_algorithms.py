"""Analyze and compare all algorithm results (GA, DE, PSO, CMA-ES).

Performs:
  1. Descriptive statistics (mean, std, median, best, worst)
  2. Mann-Whitney U / Wilcoxon rank-sum tests (all pairs)
  3. Cohen's d effect sizes
  4. Convergence comparison plot
  5. Box plot comparison
  6. Save tables as CSV
"""

import os
import pickle
import sys
from pathlib import Path
from itertools import combinations

import numpy as np
from scipy.stats import mannwhitneyu

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

ALGORITHM_NAMES = {
    "baseline": "GA (Baseline)",
    "ga_baseline": "GA",
    "random_search": "Random Search",
    "de_baseline": "DE",
    "pso_baseline": "PSO",
    "cmaes_baseline": "CMA-ES",
}


def load_results():
    """Load all algorithm results from .pkl files."""
    results = {}
    for key, label in ALGORITHM_NAMES.items():
        path = RESULTS_DIR / f"{key}.pkl"
        if path.exists():
            try:
                with open(path, "rb") as f:
                    runs = pickle.load(f)
                fits = [r["best_fitness"] for r in runs if r is not None]
                if fits:
                    results[key] = {
                        "label": label,
                        "runs": runs,
                        "fitnesses": fits,
                        "convergence": [
                            r.get("convergence_history",
                                  r.get("best_fitness_per_gen",
                                        r.get("convergence", [])))
                            for r in runs if r is not None
                        ],
                    }
            except Exception as e:
                print(f"  Warning: Could not load {key}: {e}")
    return results


def cohens_d(group1, group2):
    """Compute Cohen's d effect size."""
    n1, n2 = len(group1), len(group2)
    var1, var2 = np.var(group1, ddof=1), np.var(group2, ddof=1)
    pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
    if pooled_std == 0:
        return 0.0
    return (np.mean(group1) - np.mean(group2)) / pooled_std


def interpret_effect(d):
    """Interpret Cohen's d magnitude."""
    d = abs(d)
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"


def print_stats_table(results):
    """Print descriptive statistics for all algorithms."""
    print("\n" + "=" * 85)
    print("  DESCRIPTIVE STATISTICS")
    print("=" * 85)
    print(f"  {'Algorithm':<18} {'N':>4} {'Mean':>10} {'Std':>8} "
          f"{'Median':>10} {'Best':>10} {'Worst':>10}")
    print(f"  {'-'*80}")

    rows = []
    for key, data in sorted(results.items()):
        fits = np.array(data["fitnesses"])
        row = {
            "Algorithm": data["label"],
            "N": len(fits),
            "Mean": np.mean(fits),
            "Std": np.std(fits),
            "Median": np.median(fits),
            "Best": np.max(fits),
            "Worst": np.min(fits),
        }
        rows.append(row)
        print(f"  {row['Algorithm']:<18} {row['N']:>4} {row['Mean']:>10.2f} "
              f"{row['Std']:>8.2f} {row['Median']:>10.2f} "
              f"{row['Best']:>10.2f} {row['Worst']:>10.2f}")

    print("=" * 85)

    # Save CSV
    csv_path = RESULTS_DIR / "table_algorithm_stats.csv"
    with open(csv_path, "w") as f:
        f.write("Algorithm,N,Mean,Std,Median,Best,Worst\n")
        for r in rows:
            f.write(f"{r['Algorithm']},{r['N']},{r['Mean']:.2f},"
                    f"{r['Std']:.2f},{r['Median']:.2f},"
                    f"{r['Best']:.2f},{r['Worst']:.2f}\n")
    print(f"\n  Saved: {csv_path}")


def print_significance_table(results):
    """Pairwise Mann-Whitney U tests + Cohen's d."""
    keys = sorted(results.keys())
    if len(keys) < 2:
        print("  Not enough algorithms for pairwise comparison")
        return

    print("\n" + "=" * 90)
    print("  PAIRWISE STATISTICAL COMPARISONS (Mann-Whitney U)")
    print("=" * 90)
    print(f"  {'Comparison':<35} {'U-stat':>10} {'p-value':>10} "
          f"{'Cohen d':>10} {'Effect':>12} {'Winner':>10}")
    print(f"  {'-'*87}")

    rows = []
    for k1, k2 in combinations(keys, 2):
        fits1 = np.array(results[k1]["fitnesses"])
        fits2 = np.array(results[k2]["fitnesses"])
        label1 = results[k1]["label"]
        label2 = results[k2]["label"]

        try:
            u_stat, p_val = mannwhitneyu(fits1, fits2, alternative="two-sided")
        except Exception:
            u_stat, p_val = 0, 1.0

        d = cohens_d(fits1, fits2)
        effect = interpret_effect(d)
        winner = label1 if np.mean(fits1) > np.mean(fits2) else label2
        sig = "*" if p_val < 0.05 else ""
        sig += "*" if p_val < 0.01 else ""
        sig += "*" if p_val < 0.001 else ""

        comparison = f"{label1} vs {label2}"
        row = {
            "Comparison": comparison,
            "U_stat": u_stat,
            "p_value": p_val,
            "Cohen_d": d,
            "Effect": effect,
            "Winner": winner,
            "Sig": sig,
        }
        rows.append(row)
        print(f"  {comparison:<35} {u_stat:>10.0f} {p_val:>10.4f} "
              f"{d:>+10.3f} {effect:>12} {winner:>10} {sig}")

    print("=" * 90)
    print("  Significance: * p<0.05, ** p<0.01, *** p<0.001")

    # Save CSV
    csv_path = RESULTS_DIR / "table_algorithm_significance.csv"
    with open(csv_path, "w") as f:
        f.write("Comparison,U_stat,p_value,Cohen_d,Effect,Winner\n")
        for r in rows:
            f.write(f"{r['Comparison']},{r['U_stat']:.0f},{r['p_value']:.6f},"
                    f"{r['Cohen_d']:.4f},{r['Effect']},{r['Winner']}\n")
    print(f"\n  Saved: {csv_path}")


def plot_convergence_comparison(results):
    """Plot convergence curves for all algorithms."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(10, 6))

    colors = {"baseline": "#2196F3", "ga_baseline": "#2196F3",
              "random_search": "#9E9E9E",
              "de_baseline": "#FF9800", "pso_baseline": "#4CAF50",
              "cmaes_baseline": "#E91E63"}

    for key, data in sorted(results.items()):
        curves = data["convergence"]
        if not curves or not curves[0]:
            continue

        # Align curves to minimum length
        min_len = min(len(c) for c in curves if c)
        aligned = np.array([c[:min_len] for c in curves if c and len(c) >= min_len])

        if len(aligned) == 0:
            continue

        mean_curve = aligned.mean(axis=0)
        std_curve = aligned.std(axis=0)
        gens = np.arange(1, len(mean_curve) + 1)

        color = colors.get(key, "#000000")
        ax.plot(gens, mean_curve, label=data["label"], color=color, linewidth=2)
        ax.fill_between(gens, mean_curve - std_curve, mean_curve + std_curve,
                         alpha=0.15, color=color)

    ax.set_xlabel("Generation / Iteration", fontsize=12)
    ax.set_ylabel("Best Fitness", fontsize=12)
    ax.set_title("Algorithm Convergence Comparison (mean ± std, 30 runs)",
                 fontsize=14)
    ax.legend(fontsize=11, loc="lower right")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()

    path = FIGURES_DIR / "algorithm_convergence_comparison.png"
    fig.savefig(path, dpi=300)
    plt.close(fig)
    print(f"\n  Saved: {path}")


def plot_box_comparison(results):
    """Box plot comparing all algorithms."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(10, 6))

    labels = []
    data_arrays = []
    colors = []
    color_map = {"baseline": "#2196F3", "ga_baseline": "#2196F3",
                 "random_search": "#9E9E9E",
                 "de_baseline": "#FF9800", "pso_baseline": "#4CAF50",
                 "cmaes_baseline": "#E91E63"}

    for key in sorted(results.keys()):
        d = results[key]
        labels.append(d["label"])
        data_arrays.append(d["fitnesses"])
        colors.append(color_map.get(key, "#000000"))

    bp = ax.boxplot(data_arrays, labels=labels, patch_artist=True,
                    widths=0.6, showmeans=True,
                    meanprops=dict(marker="D", markerfacecolor="red",
                                   markeredgecolor="red", markersize=6))

    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.6)

    # Jittered individual points
    for i, fits in enumerate(data_arrays):
        x = np.random.normal(i + 1, 0.06, size=len(fits))
        ax.scatter(x, fits, alpha=0.4, s=15, color=colors[i], zorder=3)

    ax.set_ylabel("Best Fitness (30 runs)", fontsize=12)
    ax.set_title("Algorithm Comparison — Best Fitness Distribution", fontsize=14)
    ax.grid(True, axis="y", alpha=0.3)
    plt.tight_layout()

    path = FIGURES_DIR / "algorithm_box_comparison.png"
    fig.savefig(path, dpi=300)
    plt.close(fig)
    print(f"  Saved: {path}")


def main():
    print("=" * 70)
    print("  STRIDE Algorithm Comparison Analysis")
    print("=" * 70)

    results = load_results()

    if not results:
        print("  No results found! Run experiments first.")
        return

    print(f"  Loaded {len(results)} algorithms: "
          f"{', '.join(d['label'] for d in results.values())}")

    # 1. Descriptive stats
    print_stats_table(results)

    # 2. Pairwise significance tests
    print_significance_table(results)

    # 3. Plots
    try:
        plot_convergence_comparison(results)
        plot_box_comparison(results)
    except Exception as e:
        print(f"  Warning: Plotting failed: {e}")

    print("\n  Analysis complete!")


if __name__ == "__main__":
    main()
