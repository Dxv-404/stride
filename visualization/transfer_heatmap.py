"""Figure 13: Transfer Testing Heatmap.

4 rows (controllers) × 5 columns (terrains) showing absolute fitness
with mean ± std annotations. Diverging colormap: red=low, green=high.

Loads from: experiments/results/transfer_results.pkl
Saves to:   report/figures/transfer_heatmap.png
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


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "transfer_results.pkl", "rb") as f:
        data = pickle.load(f)

    abs_data = data["absolute"]

    controllers = ["sine", "cpg", "cpgnn_flat", "cpgnn_mixed"]
    controller_labels = ["Sine", "CPG", "CPG+NN (Flat)", "CPG+NN (Mixed)"]
    terrains = ["flat", "hill", "mixed", "noise_5", "noise_10"]
    terrain_labels = ["Flat", "Hill", "Mixed", "Noise 5%", "Noise 10%"]

    # Build matrices
    mean_matrix = np.zeros((len(controllers), len(terrains)))
    std_matrix = np.zeros_like(mean_matrix)

    for i, ctrl in enumerate(controllers):
        for j, ter in enumerate(terrains):
            values = np.array(abs_data[ctrl][ter])
            mean_matrix[i, j] = np.mean(values)
            std_matrix[i, j] = np.std(values)

    # Plot
    fig, ax = plt.subplots(figsize=(10, 5))

    # Diverging colormap — center at 0
    vmax = max(abs(mean_matrix.min()), abs(mean_matrix.max()))
    im = ax.imshow(mean_matrix, cmap="RdYlGn", aspect="auto",
                   vmin=-vmax, vmax=vmax)

    # Annotate each cell
    for i in range(len(controllers)):
        for j in range(len(terrains)):
            m = mean_matrix[i, j]
            s = std_matrix[i, j]
            # Choose text color based on background brightness
            text_color = "white" if abs(m) > 0.6 * vmax else "black"
            ax.text(j, i, f"{m:.0f}\n±{s:.0f}",
                    ha="center", va="center", fontsize=9,
                    fontweight="bold", color=text_color)

    ax.set_xticks(range(len(terrains)))
    ax.set_xticklabels(terrain_labels, fontsize=10)
    ax.set_yticks(range(len(controllers)))
    ax.set_yticklabels(controller_labels, fontsize=10)

    ax.set_xlabel("Test Terrain", fontsize=11)
    ax.set_ylabel("Controller", fontsize=11)
    ax.set_title("Transfer Testing: Absolute Fitness by Controller × Terrain",
                 fontsize=13, fontweight="bold")

    cbar = fig.colorbar(im, ax=ax, shrink=0.8, pad=0.02)
    cbar.set_label("Fitness", fontsize=10)

    fig.tight_layout()
    out_path = FIGURES_DIR / "transfer_heatmap.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
