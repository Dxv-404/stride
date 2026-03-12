"""Figure 19: Sensor Ablation Bar Chart.

Horizontal bars showing % fitness drop per ablated sensor.
Two subplots: CPG+NN flat-trained vs CPG+NN mixed-trained.
Error bars (std across 10 creatures), sorted by drop magnitude.

Loads from: experiments/results/ablation_results.pkl
Saves to:   report/figures/sensor_ablation_bars.png
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


# Nicer display names for ablation conditions
DISPLAY_NAMES = {
    "hip_L_angle": "Hip L Angle",
    "hip_R_angle": "Hip R Angle",
    "hip_L_angvel": "Hip L AngVel",
    "hip_R_angvel": "Hip R AngVel",
    "torso_angle": "Torso Angle",
    "foot_L_contact": "Foot L Contact",
    "both_hip_angles": "Both Hip Angles",
    "both_foot_contacts": "Both Foot Contacts",
}


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "ablation_results.pkl", "rb") as f:
        data = pickle.load(f)

    results = data["results"]
    conditions = list(data["metadata"]["ablation_conditions"].keys())

    # Collect per-condition % drop across all creatures
    drops_mean = {}
    drops_std = {}

    for cond in conditions:
        pct_drops = []
        for r in results:
            if cond in r["ablations"]:
                pct_drops.append(r["ablations"][cond]["drop_pct"])
        if pct_drops:
            drops_mean[cond] = np.mean(pct_drops)
            drops_std[cond] = np.std(pct_drops)

    # Sort by absolute drop magnitude (most impactful first)
    sorted_conds = sorted(drops_mean.keys(),
                          key=lambda c: abs(drops_mean[c]), reverse=True)

    labels = [DISPLAY_NAMES.get(c, c) for c in sorted_conds]
    means = [drops_mean[c] for c in sorted_conds]
    stds = [drops_std[c] for c in sorted_conds]

    # Color: negative drop = red (fitness decreased), positive = green (improved)
    colors = ["#E53935" if m < 0 else "#43A047" for m in means]

    fig, ax = plt.subplots(figsize=(9, 5.5))

    y_pos = np.arange(len(labels))
    ax.barh(y_pos, means, xerr=stds, color=colors, alpha=0.8,
            edgecolor="gray", linewidth=0.5, capsize=3)

    ax.set_yticks(y_pos)
    ax.set_yticklabels(labels, fontsize=10)
    ax.set_xlabel("Fitness Change (%)", fontsize=11)
    ax.set_title("Sensor Ablation Impact — CPG+NN Controllers",
                 fontsize=13, fontweight="bold")
    ax.axvline(x=0, color="black", linewidth=0.8, linestyle="-")
    ax.grid(True, axis="x", alpha=0.3)

    # Annotate values
    for i, (m, s) in enumerate(zip(means, stds)):
        x_pos = m + s + 1 if m > 0 else m - s - 1
        ha = "left" if m > 0 else "right"
        ax.text(x_pos, i, f"{m:.1f}%", va="center", ha=ha,
                fontsize=8, color="#333333")

    ax.invert_yaxis()  # Most impactful at top
    fig.tight_layout()
    out_path = FIGURES_DIR / "sensor_ablation_bars.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
