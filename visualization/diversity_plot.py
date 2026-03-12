"""Diversity plots — population diversity over generations.

Shows how genetic diversity changes across generations for GA experiments.
Same overlay style as convergence plots: 30 thin lines + bold mean + std band.

Note: random_search has no diversity_per_gen key — skipped gracefully.
"""

import os
import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"


def load_experiment(name):
    """Load experiment results."""
    path = RESULTS_DIR / f"{name}.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def gather_diversity_curves(runs):
    """Extract diversity_per_gen from all valid GA runs.

    Returns:
        np.array of shape (n_runs, n_gen) or None if no diversity data.
    """
    curves = []
    for r in runs:
        if r is None:
            continue
        div = r.get("diversity_per_gen")
        if div is not None and len(div) > 0:
            curves.append(div)

    if not curves:
        return None

    min_len = min(len(c) for c in curves)
    return np.array([c[:min_len] for c in curves])


# Display names
DISPLAY_NAMES = {
    "baseline": "Baseline (Tournament, pm=0.05, E=5%)",
    "roulette_selection": "Roulette Selection",
    "rank_selection": "Rank Selection",
    "mutation_low": "Mutation Rate 0.01",
    "mutation_high": "Mutation Rate 0.10",
    "mutation_adaptive": "Adaptive Mutation",
    "no_elitism": "No Elitism (E=0%)",
    "high_elitism": "High Elitism (E=10%)",
    "indirect_encoding": "Indirect Encoding",
    "hill_terrain": "Hill Terrain",
    "mixed_terrain": "Mixed Terrain",
    "crossover_low": "Crossover Rate 0.6",
    "crossover_high": "Crossover Rate 0.9",
}


def plot_single_diversity(name, runs, save_dir):
    """Plot diversity for a single experiment."""
    curves = gather_diversity_curves(runs)
    if curves is None:
        print(f"  SKIP {name}: no diversity data")
        return

    n_runs, n_gen = curves.shape
    gens = np.arange(1, n_gen + 1)
    mean_curve = np.mean(curves, axis=0)
    std_curve = np.std(curves, axis=0)

    fig, ax = plt.subplots(figsize=(8, 5))

    for i in range(n_runs):
        ax.plot(gens, curves[i], color="#66BB6A", alpha=0.15, linewidth=0.7)

    ax.fill_between(gens,
                    mean_curve - std_curve,
                    mean_curve + std_curve,
                    color="#66BB6A", alpha=0.2, label="Mean +/- 1 Std")

    ax.plot(gens, mean_curve, color="#2E7D32", linewidth=2.0,
            label=f"Mean (n={n_runs})")

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Population Diversity (avg distance to centroid)", fontsize=11)
    ax.set_title(f"Diversity: {name}", fontsize=13, fontweight="bold")
    ax.legend(loc="upper right", fontsize=9)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = save_dir / f"diversity_{name}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


# Comparison groups for diversity
DIVERSITY_COMPARISONS = {
    "selection": {
        "title": "Diversity: Selection Methods",
        "experiments": ["baseline", "roulette_selection", "rank_selection"],
        "colors": ["#1565C0", "#E53935", "#43A047"],
    },
    "mutation": {
        "title": "Diversity: Mutation Rates",
        "experiments": ["baseline", "mutation_low", "mutation_high",
                        "mutation_adaptive"],
        "colors": ["#1565C0", "#E53935", "#43A047", "#FF9800"],
    },
    "elitism": {
        "title": "Diversity: Elitism Levels",
        "experiments": ["no_elitism", "baseline", "high_elitism"],
        "colors": ["#E53935", "#1565C0", "#43A047"],
    },
}


def plot_diversity_comparison(group_key, group_info, all_data, save_dir):
    """Plot diversity comparison overlay."""
    fig, ax = plt.subplots(figsize=(9, 5.5))

    for exp_name, color in zip(group_info["experiments"],
                               group_info["colors"]):
        if exp_name not in all_data:
            continue
        curves = gather_diversity_curves(all_data[exp_name])
        if curves is None:
            continue

        n_runs, n_gen = curves.shape
        gens = np.arange(1, n_gen + 1)
        mean_curve = np.mean(curves, axis=0)
        std_curve = np.std(curves, axis=0)

        label = DISPLAY_NAMES.get(exp_name, exp_name)

        ax.fill_between(gens,
                        mean_curve - std_curve,
                        mean_curve + std_curve,
                        color=color, alpha=0.12)
        ax.plot(gens, mean_curve, color=color, linewidth=2.0, label=label)

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Population Diversity", fontsize=11)
    ax.set_title(group_info["title"], fontsize=13, fontweight="bold")
    ax.legend(loc="upper right", fontsize=8)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = save_dir / f"diversity_comparison_{group_key}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Diversity Plots]")

    # Load all data
    all_data = {}
    for pkl in sorted(RESULTS_DIR.glob("*.pkl")):
        name = pkl.stem
        if name.endswith("_checkpoint"):
            continue
        try:
            with open(pkl, "rb") as f:
                runs = pickle.load(f)
            all_data[name] = runs
        except Exception as e:
            print(f"  ERROR loading {name}: {e}")

    # Per-experiment
    print("Generating per-experiment diversity plots...")
    for name, runs in all_data.items():
        plot_single_diversity(name, runs, FIGURES_DIR)

    # Comparison overlays
    print("\nGenerating diversity comparison plots...")
    for group_key, group_info in DIVERSITY_COMPARISONS.items():
        plot_diversity_comparison(group_key, group_info, all_data, FIGURES_DIR)

    print(f"\nAll diversity plots saved to {FIGURES_DIR}")


if __name__ == "__main__":
    main()
