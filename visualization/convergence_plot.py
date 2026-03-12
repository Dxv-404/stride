"""Convergence plots — 30 overlaid runs with mean line and std band.

Generates:
  - One convergence plot per experiment
  - Comparison overlay plots per group (selection, mutation, etc.)

All saved to report/figures/ at 300 DPI.
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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_convergence(run_dict):
    """Extract convergence curve from GA or random_search format."""
    return run_dict.get("convergence_history",
                        run_dict.get("convergence"))


def load_experiment(name):
    """Load a single experiment's runs."""
    path = RESULTS_DIR / f"{name}.pkl"
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return pickle.load(f)


def gather_convergence_curves(runs):
    """Extract all convergence curves, aligned to same length.

    Returns:
        np.array of shape (n_runs, n_generations) or None.
    """
    if not isinstance(runs, list):
        return None

    curves = []
    for r in runs:
        if r is None or not isinstance(r, dict):
            continue
        conv = get_convergence(r)
        if conv is not None and len(conv) > 0:
            curves.append(conv)

    if not curves:
        return None

    # Align to minimum length (should all be 75, but be safe)
    min_len = min(len(c) for c in curves)
    aligned = np.array([c[:min_len] for c in curves])
    return aligned


# ---------------------------------------------------------------------------
# Per-Experiment Plot
# ---------------------------------------------------------------------------

def plot_single_experiment(name, runs, save_dir):
    """Plot convergence for a single experiment.

    Shows 30 overlaid semi-transparent lines with bold mean and std band.
    """
    curves = gather_convergence_curves(runs)
    if curves is None:
        print(f"  SKIP {name}: no convergence data")
        return

    n_runs, n_gen = curves.shape
    gens = np.arange(1, n_gen + 1)
    mean_curve = np.mean(curves, axis=0)
    std_curve = np.std(curves, axis=0)

    fig, ax = plt.subplots(figsize=(8, 5))

    # Individual runs
    for i in range(n_runs):
        ax.plot(gens, curves[i], color="#4C9BE8", alpha=0.15, linewidth=0.7)

    # Std band
    ax.fill_between(gens,
                    mean_curve - std_curve,
                    mean_curve + std_curve,
                    color="#4C9BE8", alpha=0.2, label="Mean +/- 1 Std")

    # Mean line
    ax.plot(gens, mean_curve, color="#1565C0", linewidth=2.0,
            label=f"Mean (n={n_runs})")

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Best Fitness", fontsize=11)
    ax.set_title(f"Convergence: {name}", fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = save_dir / f"convergence_{name}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


# ---------------------------------------------------------------------------
# Comparison Overlay Plot
# ---------------------------------------------------------------------------

COMPARISON_GROUPS = {
    "ga_vs_random": {
        "title": "GA vs Random Search",
        "experiments": ["baseline", "random_search"],
        "colors": ["#1565C0", "#E53935"],
    },
    "selection": {
        "title": "Selection Method Comparison",
        "experiments": ["baseline", "roulette_selection", "rank_selection"],
        "colors": ["#1565C0", "#E53935", "#43A047"],
    },
    "mutation": {
        "title": "Mutation Rate Comparison",
        "experiments": ["baseline", "mutation_low", "mutation_high",
                        "mutation_adaptive"],
        "colors": ["#1565C0", "#E53935", "#43A047", "#FF9800"],
    },
    "elitism": {
        "title": "Elitism Comparison",
        "experiments": ["no_elitism", "baseline", "high_elitism"],
        "colors": ["#E53935", "#1565C0", "#43A047"],
    },
    "encoding": {
        "title": "Encoding Comparison",
        "experiments": ["baseline", "indirect_encoding"],
        "colors": ["#1565C0", "#E53935"],
    },
    "terrain": {
        "title": "Terrain Comparison",
        "experiments": ["baseline", "hill_terrain", "mixed_terrain"],
        "colors": ["#1565C0", "#43A047", "#FF9800"],
    },
    "crossover": {
        "title": "Crossover Rate Comparison",
        "experiments": ["crossover_low", "baseline", "crossover_high"],
        "colors": ["#E53935", "#1565C0", "#43A047"],
    },
    "population": {
        "title": "Population Size Comparison",
        "experiments": ["pop_small", "baseline", "pop_large"],
        "colors": ["#E53935", "#1565C0", "#43A047"],
    },
    "algorithms": {
        "title": "Algorithm Comparison (GA vs DE vs PSO vs CMA-ES)",
        "experiments": ["baseline", "random_search", "de_baseline",
                        "pso_baseline", "cmaes_baseline"],
        "colors": ["#2196F3", "#9E9E9E", "#FF9800", "#4CAF50", "#E91E63"],
    },
    "v2_controllers": {
        "title": "V2 Controller Convergence Comparison",
        "experiments": ["baseline", "cpg_baseline", "cpgnn_flat",
                        "cpgnn_mixed", "cpgnn_frozen"],
        "colors": ["#1565C0", "#43A047", "#FF9800", "#E53935", "#9E9E9E"],
    },
}

# Display names for nicer labels
DISPLAY_NAMES = {
    "baseline": "Baseline (Tournament, pm=0.05, E=5%)",
    "random_search": "Random Search",
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
    "pop_small": "Pop=50",
    "pop_large": "Pop=200",
    "island_model": "Island Model",
    "fitness_sharing": "Fitness Sharing",
    "de_baseline": "Differential Evolution",
    "pso_baseline": "Particle Swarm Optimization",
    "cmaes_baseline": "CMA-ES",
    "cpg_baseline": "CPG",
    "cpg_hill": "CPG (Hill)",
    "cpg_mixed": "CPG (Mixed)",
    "cpgnn_flat": "CPG+NN (Flat)",
    "cpgnn_mixed": "CPG+NN (Mixed)",
    "cpgnn_frozen": "CPG+NN (Frozen NN)",
    "cpgnn_random_init": "CPG+NN (Random Init)",
    "cpgnn_high_mutation": "CPG+NN (High Mutation)",
    "cpgnn_2x_budget": "CPG+NN (2× Budget)",
}


def plot_comparison(group_key, group_info, all_data, save_dir):
    """Plot comparison overlay of mean convergence curves."""
    fig, ax = plt.subplots(figsize=(9, 5.5))

    for exp_name, color in zip(group_info["experiments"],
                               group_info["colors"]):
        if exp_name not in all_data:
            continue

        curves = gather_convergence_curves(all_data[exp_name])
        if curves is None:
            continue

        n_runs, n_gen = curves.shape
        gens = np.arange(1, n_gen + 1)
        mean_curve = np.mean(curves, axis=0)
        std_curve = np.std(curves, axis=0)

        label = DISPLAY_NAMES.get(exp_name, exp_name)

        # Std band
        ax.fill_between(gens,
                        mean_curve - std_curve,
                        mean_curve + std_curve,
                        color=color, alpha=0.12)

        # Mean line
        ax.plot(gens, mean_curve, color=color, linewidth=2.0,
                label=label)

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Best Fitness (mean of 30 runs)", fontsize=11)
    ax.set_title(group_info["title"], fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", fontsize=8)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = save_dir / f"convergence_comparison_{group_key}.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[Convergence Plots]")
    print("Loading experiments...")

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

    print(f"  Loaded {len(all_data)} experiments\n")

    # Per-experiment plots
    print("Generating per-experiment convergence plots...")
    for name, runs in all_data.items():
        plot_single_experiment(name, runs, FIGURES_DIR)

    # Comparison plots
    print("\nGenerating comparison overlay plots...")
    for group_key, group_info in COMPARISON_GROUPS.items():
        plot_comparison(group_key, group_info, all_data, FIGURES_DIR)

    # Also save V2 comparison with the spec-required filename
    import shutil
    v2_src = FIGURES_DIR / "convergence_comparison_v2_controllers.png"
    v2_dst = FIGURES_DIR / "convergence_v2_controllers.png"
    if v2_src.exists():
        shutil.copy2(v2_src, v2_dst)
        print(f"  Copied: {v2_dst.name}")

    print(f"\nAll convergence plots saved to {FIGURES_DIR}")


if __name__ == "__main__":
    main()
