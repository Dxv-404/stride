"""Figure 14: Epistasis Matrix.

18×18 heatmap of pairwise gene interactions for sine controller.
Diverging colormap: blue=negative, white=zero, red=positive epistasis.
Second subplot: consistency matrix (mean/std ratio).

Loads from: experiments/results/landscape_results.pkl
Saves to:   report/figures/epistasis_matrix.png
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

# 18 sine genes: 6 joints × 3 params each
GENE_LABELS = []
for joint in ["hip_L", "hip_R", "knee_L", "knee_R", "shldr_L", "shldr_R"]:
    for param in ["amp", "freq", "phase"]:
        GENE_LABELS.append(f"{joint}_{param}")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "landscape_results.pkl", "rb") as f:
        data = pickle.load(f)

    # Get epistasis data
    epi_key = "epistasis_sine" if "epistasis_sine" in data else "epistasis"
    epi = data[epi_key]

    mean_matrix = np.array(epi["mean_matrix"])
    std_matrix = np.array(epi["std_matrix"])
    consistency = np.array(epi["consistency_matrix"])

    n_genes = mean_matrix.shape[0]
    labels = GENE_LABELS[:n_genes]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))

    # --- Subplot 1: Epistasis strength ---
    vmax = np.max(np.abs(mean_matrix))
    im1 = ax1.imshow(mean_matrix, cmap="RdBu_r", aspect="equal",
                     vmin=-vmax, vmax=vmax)
    ax1.set_xticks(range(n_genes))
    ax1.set_xticklabels(labels, rotation=90, fontsize=6.5)
    ax1.set_yticks(range(n_genes))
    ax1.set_yticklabels(labels, fontsize=6.5)
    ax1.set_title("Epistasis Strength (Mean)", fontsize=12, fontweight="bold")
    cbar1 = fig.colorbar(im1, ax=ax1, shrink=0.8, pad=0.02)
    cbar1.set_label("Epistatic Effect", fontsize=9)

    # --- Subplot 2: Consistency (mean/std ratio) ---
    # Values > 3 = robust interaction
    im2 = ax2.imshow(consistency, cmap="YlOrRd", aspect="equal",
                     vmin=0, vmax=max(5, np.nanmax(consistency)))
    ax2.set_xticks(range(n_genes))
    ax2.set_xticklabels(labels, rotation=90, fontsize=6.5)
    ax2.set_yticks(range(n_genes))
    ax2.set_yticklabels(labels, fontsize=6.5)
    ax2.set_title("Consistency (|mean|/std, >3 = robust)",
                  fontsize=12, fontweight="bold")
    cbar2 = fig.colorbar(im2, ax=ax2, shrink=0.8, pad=0.02)
    cbar2.set_label("Consistency Ratio", fontsize=9)

    fig.suptitle("Gene Interaction (Epistasis) — Sine Controller (18 genes)",
                 fontsize=14, fontweight="bold", y=1.02)
    fig.tight_layout()
    out_path = FIGURES_DIR / "epistasis_matrix.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
