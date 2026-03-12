"""Figure 18: NN Output Time-Series.

4 stacked subplots sharing x-axis (time 0-5s):
  - Subplot 1: 6 sensor inputs over time
  - Subplot 2: 6 NN modulation outputs (tanh values, [-1, 1])
  - Subplot 3: 6 CPG target angles
  - Subplot 4: 6 final target angles (CPG × modulation)
Uses one representative CPG+NN creature.

Loads from: experiments/results/nn_output_recordings.pkl
Saves to:   report/figures/nn_output_timeseries.png
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

# Reduced sensor names (6 dims)
REDUCED_NAMES = [
    "Hip L Angle", "Hip R Angle",
    "Hip L AngVel", "Hip R AngVel",
    "Torso Angle", "Foot L Contact",
]

JOINT_NAMES = [
    "Hip L", "Hip R", "Knee L", "Knee R", "Shldr L", "Shldr R",
]

# Colors for 6 channels
COLORS_6 = ["#E53935", "#1565C0", "#43A047", "#FF9800", "#9C27B0", "#00BCD4"]


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "nn_output_recordings.pkl", "rb") as f:
        data = pickle.load(f)

    # Pick the best cpgnn_flat creature (highest train_fitness)
    recs = data["recordings"]
    source = "cpgnn_flat"
    if source not in recs or not recs[source]:
        source = list(recs.keys())[0]

    creatures = recs[source]
    best = max(creatures, key=lambda c: c.get("train_fitness", 0))

    time = np.array(best["time"])
    sensors_reduced = np.array(best["sensors_reduced"])  # (steps, 6)
    nn_mod = np.array(best["nn_modulation"])              # (steps, 6)
    cpg_out = np.array(best["cpg_output"])                # (steps, 6)
    final = np.array(best["final_targets"])               # (steps, 6)

    # Limit to 5 seconds (300 steps at 60 Hz)
    max_steps = min(300, len(time))
    time = time[:max_steps]
    sensors_reduced = sensors_reduced[:max_steps]
    nn_mod = nn_mod[:max_steps]
    cpg_out = cpg_out[:max_steps]
    final = final[:max_steps]

    fig, axes = plt.subplots(4, 1, figsize=(12, 10), sharex=True)

    # --- Subplot 1: Sensor inputs ---
    ax = axes[0]
    for i in range(min(6, sensors_reduced.shape[1])):
        ax.plot(time, sensors_reduced[:, i], color=COLORS_6[i],
                linewidth=0.8, label=REDUCED_NAMES[i], alpha=0.9)
    ax.set_ylabel("Sensor Value", fontsize=10)
    ax.set_title("Reduced Sensor Inputs (6 dims)", fontsize=11,
                 fontweight="bold")
    ax.legend(loc="upper right", fontsize=7, ncol=3)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(-1.2, 1.2)

    # --- Subplot 2: NN modulation outputs ---
    ax = axes[1]
    for i in range(min(6, nn_mod.shape[1])):
        ax.plot(time, nn_mod[:, i], color=COLORS_6[i],
                linewidth=0.8, label=JOINT_NAMES[i], alpha=0.9)
    ax.set_ylabel("Modulation (tanh)", fontsize=10)
    ax.set_title("NN Modulation Outputs (tanh, [-1, 1])", fontsize=11,
                 fontweight="bold")
    ax.legend(loc="upper right", fontsize=7, ncol=3)
    ax.grid(True, alpha=0.3)
    ax.set_ylim(-1.2, 1.2)
    ax.axhline(y=0, color="black", linewidth=0.5, linestyle=":")

    # --- Subplot 3: CPG target angles ---
    ax = axes[2]
    for i in range(min(6, cpg_out.shape[1])):
        ax.plot(time, cpg_out[:, i], color=COLORS_6[i],
                linewidth=0.8, label=JOINT_NAMES[i], alpha=0.9)
    ax.set_ylabel("Angle (rad)", fontsize=10)
    ax.set_title("CPG Target Angles", fontsize=11, fontweight="bold")
    ax.legend(loc="upper right", fontsize=7, ncol=3)
    ax.grid(True, alpha=0.3)

    # --- Subplot 4: Final target angles ---
    ax = axes[3]
    for i in range(min(6, final.shape[1])):
        ax.plot(time, final[:, i], color=COLORS_6[i],
                linewidth=0.8, label=JOINT_NAMES[i], alpha=0.9)
    ax.set_ylabel("Angle (rad)", fontsize=10)
    ax.set_xlabel("Time (s)", fontsize=11)
    ax.set_title("Final Target Angles (CPG × Modulation)", fontsize=11,
                 fontweight="bold")
    ax.legend(loc="upper right", fontsize=7, ncol=3)
    ax.grid(True, alpha=0.3)

    fig.suptitle(f"Neural Network Output Time-Series — {source}",
                 fontsize=14, fontweight="bold", y=1.01)
    fig.tight_layout()
    out_path = FIGURES_DIR / "nn_output_timeseries.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
