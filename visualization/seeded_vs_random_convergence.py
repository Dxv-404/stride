"""Figure 22: Seeded vs Random Convergence.

Two convergence curves: cpgnn_flat (seeded, amber) vs cpgnn_random_init (gray).
30 runs overlaid (thin semi-transparent lines) + bold mean line + shaded std band.
Annotate G_80 for each with vertical dashed line.

Loads from: experiments/results/cpgnn_flat.pkl, cpgnn_random_init.pkl
Saves to:   report/figures/seeded_vs_random_convergence.png
"""

import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"


def load_convergence(pkl_path):
    """Load convergence curves from experiment pkl."""
    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    curves = []
    for r in runs:
        if r is None:
            continue
        conv = r.get("convergence_history", r.get("convergence"))
        if conv is not None and len(conv) > 0:
            curves.append(conv)

    if not curves:
        return None

    min_len = min(len(c) for c in curves)
    return np.array([c[:min_len] for c in curves])


def find_g80(mean_curve):
    """Find generation where 80% of final fitness is reached."""
    final = mean_curve[-1]
    if final <= 0:
        return None
    threshold = 0.8 * final
    for i, val in enumerate(mean_curve):
        if val >= threshold:
            return i + 1  # 1-indexed generations
    return None


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    configs = {
        "cpgnn_flat": {
            "path": RESULTS_DIR / "cpgnn_flat.pkl",
            "color": "#FF9800",
            "label": "CPG+NN Seeded (from CPG)",
        },
        "cpgnn_random_init": {
            "path": RESULTS_DIR / "cpgnn_random_init.pkl",
            "color": "#757575",
            "label": "CPG+NN Random Init",
        },
    }

    fig, ax = plt.subplots(figsize=(9, 5.5))

    for name, cfg in configs.items():
        if not cfg["path"].exists():
            print(f"  SKIP {name}: file not found")
            continue

        curves = load_convergence(cfg["path"])
        if curves is None:
            print(f"  SKIP {name}: no convergence data")
            continue

        n_runs, n_gen = curves.shape
        gens = np.arange(1, n_gen + 1)
        mean_curve = np.mean(curves, axis=0)
        std_curve = np.std(curves, axis=0)

        # Individual runs
        for i in range(n_runs):
            ax.plot(gens, curves[i], color=cfg["color"], alpha=0.1,
                    linewidth=0.6)

        # Std band
        ax.fill_between(gens, mean_curve - std_curve,
                        mean_curve + std_curve,
                        color=cfg["color"], alpha=0.15)

        # Mean line
        ax.plot(gens, mean_curve, color=cfg["color"], linewidth=2.5,
                label=f'{cfg["label"]} (n={n_runs})')

        # G_80 line
        g80 = find_g80(mean_curve)
        if g80 is not None and g80 < n_gen:
            ax.axvline(x=g80, color=cfg["color"], linewidth=1.2,
                       linestyle="--", alpha=0.7)
            ax.text(g80 + 0.5, ax.get_ylim()[1] * 0.02,
                    f"G₈₀={g80}", fontsize=8, color=cfg["color"],
                    fontweight="bold", rotation=90, va="bottom")

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Best Fitness", fontsize=11)
    ax.set_title("Seeded vs Random Initialization — CPG+NN Convergence",
                 fontsize=13, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = FIGURES_DIR / "seeded_vs_random_convergence.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
