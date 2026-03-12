"""Parameter heatmap — gene values of best individual over generations.

X-axis = generation, Y-axis = gene index, Color = gene value [0,1].
Shows how the best individual's genome evolves across generations.

Uses all_best_per_gen from GA runs (stores best chromosome per generation).
"""

import os
import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Gene labels for direct encoding (18 genes)
GENE_LABELS_DIRECT = [
    "hip_L amp", "hip_L freq", "hip_L phase",
    "hip_R amp", "hip_R freq", "hip_R phase",
    "knee_L amp", "knee_L freq", "knee_L phase",
    "knee_R amp", "knee_R freq", "knee_R phase",
    "shldr_L amp", "shldr_L freq", "shldr_L phase",
    "shldr_R amp", "shldr_R freq", "shldr_R phase",
]

# Gene labels for indirect encoding (9 genes)
GENE_LABELS_INDIRECT = [
    "hip amp", "hip freq", "hip phase",
    "knee amp", "knee freq", "knee phase",
    "shldr amp", "shldr freq", "shldr phase",
]


def load_experiment(name):
    """Load experiment results."""
    path = RESULTS_DIR / f"{name}.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def plot_heatmap(name, runs, save_dir):
    """Plot gene-value heatmap for the best run of an experiment.

    Uses all_best_per_gen which stores the best chromosome each generation.
    Falls back to showing just the final best chromosome if per-gen data missing.
    """
    # Find best run
    best_run = None
    best_fitness = -float("inf")
    for r in runs:
        if r is None:
            continue
        if r["best_fitness"] > best_fitness:
            best_fitness = r["best_fitness"]
            best_run = r

    if best_run is None:
        print(f"  SKIP {name}: no valid runs")
        return

    # Get per-generation best chromosomes
    all_best = best_run.get("all_best_per_gen")
    if all_best is None or len(all_best) == 0:
        print(f"  SKIP {name}: no all_best_per_gen data")
        return

    # Build matrix: rows=genes, columns=generations
    n_gen = len(all_best)
    n_genes = len(all_best[0])
    matrix = np.zeros((n_genes, n_gen))

    for g, chromo in enumerate(all_best):
        matrix[:, g] = chromo[:n_genes]

    # Choose labels
    if n_genes == 18:
        gene_labels = GENE_LABELS_DIRECT
    elif n_genes == 9:
        gene_labels = GENE_LABELS_INDIRECT
    else:
        gene_labels = [f"Gene {i}" for i in range(n_genes)]

    fig, ax = plt.subplots(figsize=(10, max(4, n_genes * 0.35)))

    im = ax.imshow(matrix, aspect="auto", cmap="viridis",
                   interpolation="nearest", vmin=0, vmax=1)

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Gene", fontsize=11)
    ax.set_title(f"Best Individual Gene Values: {name}\n(fitness={best_fitness:.2f})",
                 fontsize=12, fontweight="bold")

    ax.set_yticks(range(n_genes))
    ax.set_yticklabels(gene_labels, fontsize=7)

    # Only show a few x-tick labels
    xtick_step = max(1, n_gen // 10)
    ax.set_xticks(range(0, n_gen, xtick_step))
    ax.set_xticklabels(range(1, n_gen + 1, xtick_step), fontsize=8)

    cbar = fig.colorbar(im, ax=ax, label="Gene Value [0, 1]",
                        fraction=0.03, pad=0.02)

    fig.tight_layout()
    out_path = save_dir / f"heatmap_{name}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Parameter Heatmaps]")

    # Generate for key experiments
    key_experiments = ["baseline", "mutation_adaptive", "indirect_encoding",
                       "high_elitism", "no_elitism",
                       "de_baseline", "pso_baseline", "cmaes_baseline"]

    for name in key_experiments:
        runs = load_experiment(name)
        if runs is None:
            print(f"  SKIP {name}: not found")
            continue
        plot_heatmap(name, runs, FIGURES_DIR)

    print(f"\nAll heatmaps saved to {FIGURES_DIR}")


if __name__ == "__main__":
    main()
