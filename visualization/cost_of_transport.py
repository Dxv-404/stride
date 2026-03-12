"""Figure 16: Cost of Transport Bar Chart.

Grouped bar chart: sine, CPG, CPG+NN (flat), CPG+NN (mixed).
Error bars (std across 30 creatures). Lower CoT = more efficient.

Loads from: experiments/results/gait_results.pkl
Saves to:   report/figures/cost_of_transport.png
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

    controllers = list(data["results"].keys())
    controller_labels = {
        "sine": "Sine",
        "cpg": "CPG",
        "cpgnn_flat": "CPG+NN\n(Flat)",
        "cpgnn_mixed": "CPG+NN\n(Mixed)",
    }

    colors = {
        "sine": "#1565C0",
        "cpg": "#43A047",
        "cpgnn_flat": "#FF9800",
        "cpgnn_mixed": "#E53935",
    }

    means = []
    stds = []
    labels = []
    bar_colors = []

    for ctrl in controllers:
        fingerprints = data["results"][ctrl]["fingerprint"]
        cot_values = []
        for fp in fingerprints:
            cot = fp["mean"].get("cost_of_transport")
            if cot is not None and np.isfinite(cot) and cot > 0:
                cot_values.append(cot)

        if cot_values:
            means.append(np.mean(cot_values))
            stds.append(np.std(cot_values))
        else:
            means.append(0)
            stds.append(0)

        labels.append(controller_labels.get(ctrl, ctrl))
        bar_colors.append(colors.get(ctrl, "#9E9E9E"))

    fig, ax = plt.subplots(figsize=(8, 5))

    x_pos = np.arange(len(labels))
    bars = ax.bar(x_pos, means, yerr=stds, color=bar_colors, alpha=0.8,
                  edgecolor="gray", linewidth=0.5, capsize=5, width=0.6)

    ax.set_xticks(x_pos)
    ax.set_xticklabels(labels, fontsize=10)
    ax.set_ylabel("Cost of Transport (lower = more efficient)", fontsize=11)
    ax.set_title("Cost of Transport by Controller Type",
                 fontsize=13, fontweight="bold")
    ax.grid(True, axis="y", alpha=0.3)

    # Annotate values above bars
    for i, (m, s) in enumerate(zip(means, stds)):
        ax.text(i, m + s + 0.01, f"{m:.3f}", ha="center", va="bottom",
                fontsize=9, fontweight="bold")

    fig.tight_layout()
    out_path = FIGURES_DIR / "cost_of_transport.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
