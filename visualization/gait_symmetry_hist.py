"""Figure 21: Gait Symmetry Histogram.

Histogram of mean phase difference (0 to π) for each controller.
3 overlaid histograms: sine (blue), CPG (green), CPG+NN (amber).
Vertical dashed lines at π (walking) and 0 (hopping).
Text annotation for excluded sine creatures (incommensurate frequencies).

Loads from: experiments/results/gait_results.pkl
Saves to:   report/figures/gait_symmetry_histogram.png
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

    with open(RESULTS_DIR / "gait_results.pkl", "rb") as f:
        data = pickle.load(f)

    controller_cfg = {
        "sine":       {"color": "#1565C0", "label": "Sine", "alpha": 0.5},
        "cpg":        {"color": "#43A047", "label": "CPG", "alpha": 0.5},
        "cpgnn_flat": {"color": "#FF9800", "label": "CPG+NN", "alpha": 0.5},
    }

    fig, ax = plt.subplots(figsize=(9, 5.5))

    n_excluded_sine = 0
    n_total_sine = 0

    for ctrl_name, cfg in controller_cfg.items():
        if ctrl_name not in data["results"]:
            continue

        symmetry_data = data["results"][ctrl_name]["symmetry"]
        phase_diffs = []

        for s in symmetry_data:
            if ctrl_name == "sine":
                n_total_sine += 1
                if s.get("is_incommensurate", False):
                    n_excluded_sine += 1
                    continue
            mpd = s.get("mean_phase_diff")
            if mpd is not None and np.isfinite(mpd):
                phase_diffs.append(mpd)

        if phase_diffs:
            ax.hist(phase_diffs, bins=15, range=(0, np.pi),
                    color=cfg["color"], alpha=cfg["alpha"],
                    label=f'{cfg["label"]} (n={len(phase_diffs)})',
                    edgecolor="white", linewidth=0.5)

    # Reference lines
    ax.axvline(x=np.pi, color="black", linewidth=1.5, linestyle="--",
               label="π (walking)")
    ax.axvline(x=0, color="gray", linewidth=1.5, linestyle="--",
               label="0 (hopping)")

    # Annotation for excluded sine creatures
    if n_excluded_sine > 0:
        ax.text(0.98, 0.95,
                f"{n_excluded_sine}/{n_total_sine} sine creatures excluded\n"
                "(incommensurate hip frequencies)",
                transform=ax.transAxes, fontsize=8, va="top", ha="right",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow",
                          edgecolor="gray", alpha=0.9))

    ax.set_xlabel("Mean Phase Difference (radians)", fontsize=11)
    ax.set_ylabel("Count", fontsize=11)
    ax.set_title("Gait Symmetry Distribution by Controller",
                 fontsize=13, fontweight="bold")
    ax.legend(loc="upper left", fontsize=9)
    ax.grid(True, axis="y", alpha=0.3)

    # Set x-axis labels with π notation
    ax.set_xticks([0, np.pi/4, np.pi/2, 3*np.pi/4, np.pi])
    ax.set_xticklabels(["0", "π/4", "π/2", "3π/4", "π"], fontsize=10)

    fig.tight_layout()
    out_path = FIGURES_DIR / "gait_symmetry_histogram.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
