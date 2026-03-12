"""Bonus Figure: FDC Scatter Plot.

Scatter: x=distance to best known, y=fitness.
Two subplots: sine (18 genes) and CPG+NN (96 genes).
2,000 points each, colored by density. Best-fit regression line,
FDC value annotated.

Loads from: experiments/results/landscape_results.pkl
Saves to:   report/figures/fdc_scatter.png
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


def plot_fdc(ax, fdc_data, title):
    """Plot FDC scatter with regression line."""
    fitnesses = np.array(fdc_data["scatter_fitnesses"])
    distances = np.array(fdc_data["scatter_distances"])
    fdc_val = fdc_data["mean_fdc"]

    # Remove any NaN/Inf
    mask = np.isfinite(fitnesses) & np.isfinite(distances)
    fitnesses = fitnesses[mask]
    distances = distances[mask]

    if len(fitnesses) == 0:
        ax.text(0.5, 0.5, "No data", ha="center", va="center",
                transform=ax.transAxes)
        return

    # Density-based coloring using 2D histogram
    from matplotlib.colors import LogNorm
    hb = ax.hexbin(distances, fitnesses, gridsize=40, cmap="YlOrRd",
                   mincnt=1, linewidths=0.2)

    # Best-fit regression line
    if len(distances) > 2:
        coeffs = np.polyfit(distances, fitnesses, 1)
        x_line = np.linspace(distances.min(), distances.max(), 100)
        y_line = np.polyval(coeffs, x_line)
        ax.plot(x_line, y_line, color="black", linewidth=2.0,
                linestyle="--", label="Linear fit")

    # FDC annotation
    ax.text(0.02, 0.98, f"FDC = {fdc_val:.3f}", transform=ax.transAxes,
            fontsize=11, fontweight="bold", va="top", ha="left",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="white",
                      edgecolor="gray", alpha=0.9))

    ax.set_xlabel("Distance to Best Known", fontsize=10)
    ax.set_ylabel("Fitness", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.grid(True, alpha=0.3)

    return hb


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "landscape_results.pkl", "rb") as f:
        data = pickle.load(f)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))

    # Sine FDC
    hb1 = plot_fdc(ax1, data["fdc_sine"], "FDC — Sine (18 genes)")

    # CPG+NN FDC
    hb2 = plot_fdc(ax2, data["fdc_cpgnn"], "FDC — CPG+NN (96 genes)")

    # Colorbars
    if hb1 is not None:
        fig.colorbar(hb1, ax=ax1, shrink=0.8, label="Point Density")
    if hb2 is not None:
        fig.colorbar(hb2, ax=ax2, shrink=0.8, label="Point Density")

    fig.suptitle("Fitness Distance Correlation (FDC) Analysis",
                 fontsize=14, fontweight="bold", y=1.02)
    fig.tight_layout()
    out_path = FIGURES_DIR / "fdc_scatter.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
