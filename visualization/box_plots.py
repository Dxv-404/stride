"""Box plots — grouped by comparison type.

Generates box plots for each comparison group (selection, mutation, etc.)
showing distribution of best_fitness across 30 runs.

All saved to report/figures/ at 300 DPI.
"""

import os
import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"


# ---------------------------------------------------------------------------
# Comparison groups
# ---------------------------------------------------------------------------

COMPARISON_GROUPS = {
    "ga_vs_random": {
        "title": "GA vs Random Search",
        "experiments": ["baseline", "random_search"],
        "labels": ["GA Baseline", "Random Search"],
        "colors": ["#4C9BE8", "#E57373"],
    },
    "selection": {
        "title": "Selection Method Comparison",
        "experiments": ["baseline", "roulette_selection", "rank_selection"],
        "labels": ["Tournament\n(Baseline)", "Roulette", "Rank"],
        "colors": ["#4C9BE8", "#E57373", "#81C784"],
    },
    "mutation": {
        "title": "Mutation Rate Comparison",
        "experiments": ["mutation_low", "baseline", "mutation_high",
                        "mutation_adaptive"],
        "labels": ["pm=0.01", "pm=0.05\n(Baseline)", "pm=0.10",
                   "Adaptive"],
        "colors": ["#E57373", "#4C9BE8", "#81C784", "#FFB74D"],
    },
    "elitism": {
        "title": "Elitism Comparison",
        "experiments": ["no_elitism", "baseline", "high_elitism"],
        "labels": ["No Elitism\n(E=0%)", "Baseline\n(E=5%)",
                   "High Elitism\n(E=10%)"],
        "colors": ["#E57373", "#4C9BE8", "#81C784"],
    },
    "encoding": {
        "title": "Encoding Comparison",
        "experiments": ["baseline", "indirect_encoding"],
        "labels": ["Direct\n(18 genes)", "Indirect\n(9 genes)"],
        "colors": ["#4C9BE8", "#E57373"],
    },
    "terrain": {
        "title": "Terrain Comparison",
        "experiments": ["baseline", "hill_terrain", "mixed_terrain"],
        "labels": ["Flat\n(Baseline)", "Hill", "Mixed"],
        "colors": ["#4C9BE8", "#81C784", "#FFB74D"],
    },
    "crossover": {
        "title": "Crossover Rate Comparison",
        "experiments": ["crossover_low", "baseline", "crossover_high"],
        "labels": ["pc=0.6", "pc=0.8\n(Baseline)", "pc=0.9"],
        "colors": ["#E57373", "#4C9BE8", "#81C784"],
    },
    "population": {
        "title": "Population Size Comparison",
        "experiments": ["pop_small", "baseline", "pop_large"],
        "labels": ["Pop=50", "Pop=100\n(Baseline)", "Pop=200"],
        "colors": ["#E57373", "#4C9BE8", "#81C784"],
    },
    "algorithms": {
        "title": "Algorithm Comparison (GA vs DE vs PSO vs CMA-ES)",
        "experiments": ["baseline", "random_search", "de_baseline",
                        "pso_baseline", "cmaes_baseline"],
        "labels": ["GA\n(Baseline)", "Random\nSearch", "DE", "PSO", "CMA-ES"],
        "colors": ["#4C9BE8", "#9E9E9E", "#FFB74D", "#81C784", "#F48FB1"],
    },
    "controllers": {
        "title": "Controller Comparison",
        "experiments": ["baseline", "cpg_baseline", "cpgnn_flat",
                        "cpgnn_mixed", "cpgnn_frozen", "cpgnn_random_init"],
        "labels": ["Sine\n(Baseline)", "CPG", "CPG+NN\n(Flat)",
                   "CPG+NN\n(Mixed)", "CPG+NN\n(Frozen)", "CPG+NN\n(Random)"],
        "colors": ["#4C9BE8", "#81C784", "#FFB74D", "#E57373",
                   "#9E9E9E", "#CE93D8"],
    },
}


def load_experiment(name):
    """Load experiment results."""
    path = RESULTS_DIR / f"{name}.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def get_fitness_values(runs):
    """Extract best_fitness from all valid runs."""
    return [r["best_fitness"] for r in runs if r is not None]


def plot_comparison_boxplot(group_key, group_info, save_dir):
    """Generate a grouped box plot for one comparison group."""
    data = []
    labels = []
    colors = []

    for exp_name, label, color in zip(group_info["experiments"],
                                       group_info["labels"],
                                       group_info["colors"]):
        runs = load_experiment(exp_name)
        if runs is None:
            print(f"  SKIP {exp_name}: not found")
            continue
        fits = get_fitness_values(runs)
        if not fits:
            continue
        data.append(fits)
        labels.append(label)
        colors.append(color)

    if not data:
        print(f"  SKIP {group_key}: no data")
        return

    fig, ax = plt.subplots(figsize=(max(6, len(data) * 1.8), 5.5))

    bp = ax.boxplot(data, patch_artist=True, widths=0.5,
                    medianprops=dict(color="black", linewidth=1.5),
                    whiskerprops=dict(linewidth=1.0),
                    capprops=dict(linewidth=1.0),
                    flierprops=dict(marker="o", markersize=4,
                                    markerfacecolor="#888888", alpha=0.6))

    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    # Overlay individual points (jittered)
    for i, (d, color) in enumerate(zip(data, colors)):
        x_jitter = np.random.normal(i + 1, 0.06, size=len(d))
        ax.scatter(x_jitter, d, alpha=0.4, s=15, color=color,
                   edgecolors="none", zorder=3)

    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylabel("Best Fitness (30 runs)", fontsize=11)
    ax.set_title(group_info["title"], fontsize=13, fontweight="bold")
    ax.grid(True, axis="y", alpha=0.3)

    # Add n= annotation below each box
    for i, d in enumerate(data):
        ax.text(i + 1, ax.get_ylim()[0] - 2, f"n={len(d)}",
                ha="center", va="top", fontsize=8, color="#666666")

    fig.tight_layout()
    out_path = save_dir / f"boxplot_{group_key}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


def plot_all_experiments_boxplot(save_dir):
    """Generate a single boxplot with ALL experiments side by side."""
    # Ordered list
    order = [
        "baseline", "random_search",
        "de_baseline", "pso_baseline", "cmaes_baseline",
        "roulette_selection", "rank_selection",
        "mutation_low", "mutation_high", "mutation_adaptive",
        "no_elitism", "high_elitism",
        "indirect_encoding",
        "hill_terrain", "mixed_terrain",
        "crossover_low", "crossover_high",
        "pop_small", "pop_large",
        "island_model", "fitness_sharing",
    ]

    data = []
    labels = []

    for name in order:
        runs = load_experiment(name)
        if runs is None:
            continue
        fits = get_fitness_values(runs)
        if fits:
            data.append(fits)
            # Shorten names for readability
            short = name.replace("_selection", "").replace("_terrain", "") \
                        .replace("_encoding", "").replace("mutation_", "mut_") \
                        .replace("crossover_", "xo_").replace("_elitism", "_elit")
            labels.append(short)

    if not data:
        return

    fig, ax = plt.subplots(figsize=(max(12, len(data) * 0.9), 6))

    bp = ax.boxplot(data, patch_artist=True, widths=0.55,
                    medianprops=dict(color="black", linewidth=1.5),
                    whiskerprops=dict(linewidth=0.8),
                    capprops=dict(linewidth=0.8),
                    flierprops=dict(marker="o", markersize=3,
                                    markerfacecolor="#888888", alpha=0.5))

    # Color by category
    algo_names = {"de_baseline", "pso_baseline", "cmaes_baseline"}
    for i, (patch, name) in enumerate(zip(bp["boxes"], labels)):
        if name == "baseline":
            patch.set_facecolor("#4C9BE8")
        elif name == "random_search":
            patch.set_facecolor("#E57373")
        elif name in algo_names:
            patch.set_facecolor("#FFB74D")
        else:
            patch.set_facecolor("#A5D6A7")
        patch.set_alpha(0.7)

    ax.set_xticklabels(labels, fontsize=7.5, rotation=45, ha="right")
    ax.set_ylabel("Best Fitness", fontsize=11)
    ax.set_title("All Experiments — Best Fitness Distribution (30 runs each)",
                 fontsize=12, fontweight="bold")
    ax.grid(True, axis="y", alpha=0.3)

    fig.tight_layout()
    out_path = save_dir / "boxplot_all_experiments.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[Box Plots]")

    for group_key, group_info in COMPARISON_GROUPS.items():
        plot_comparison_boxplot(group_key, group_info, FIGURES_DIR)

    plot_all_experiments_boxplot(FIGURES_DIR)

    print(f"\nAll box plots saved to {FIGURES_DIR}")


if __name__ == "__main__":
    main()
