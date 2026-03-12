"""Figure 20: Gene Sensitivity Bar Chart.

Two subplots: sine (18 bars) and CPG (38 bars).
Horizontal bar chart of mean sensitivity values (averaged across 5 refs).
Color-coded by gene type: amplitude=blue, frequency=green, phase=orange,
coupling=red (CPG only).

Loads from: experiments/results/landscape_results.pkl
Saves to:   report/figures/gene_sensitivity_bars.png
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

# Gene labels for sine (18 genes)
JOINT_NAMES = ["hip_L", "hip_R", "knee_L", "knee_R", "shldr_L", "shldr_R"]
SINE_LABELS = []
for j in JOINT_NAMES:
    for p in ["amp", "freq", "phase"]:
        SINE_LABELS.append(f"{j}_{p}")

# Gene labels for CPG (38 genes)
CPG_LABELS = list(SINE_LABELS)  # first 18 are oscillator genes
CONNECTIONS = [
    ("hL-kL", "w"), ("hL-kL", "φ"),
    ("hR-kR", "w"), ("hR-kR", "φ"),
    ("hL-hR", "w"), ("hL-hR", "φ"),
    ("kL-kR", "w"), ("kL-kR", "φ"),
    ("sL-sR", "w"), ("sL-sR", "φ"),
    ("kL-hL", "w"), ("kL-hL", "φ"),
    ("kR-hR", "w"), ("kR-hR", "φ"),
    ("hR-hL", "w"), ("hR-hL", "φ"),
    ("kR-kL", "w"), ("kR-kL", "φ"),
    ("sR-sL", "w"), ("sR-sL", "φ"),
]
for conn_name, param in CONNECTIONS:
    CPG_LABELS.append(f"c_{conn_name}_{param}")

# Color by gene type
def get_color(label):
    if label.startswith("c_"):
        return "#E53935"    # coupling = red
    if "_amp" in label:
        return "#1565C0"    # amplitude = blue
    if "_freq" in label:
        return "#43A047"    # frequency = green
    if "_phase" in label:
        return "#FF9800"    # phase = orange
    return "#9E9E9E"


def plot_sensitivity(ax, sens_data, labels, title):
    """Plot horizontal bar chart of gene sensitivities."""
    if isinstance(sens_data, dict):
        # Format: {"mean_sensitivity": [values], "std_sensitivity": [values]}
        if "mean_sensitivity" in sens_data:
            means = np.array(sens_data["mean_sensitivity"])
        elif "sensitivities" in sens_data:
            means = np.array(sens_data["sensitivities"])
        else:
            # Try treating keys as gene indices
            n_genes = len(labels)
            means = np.zeros(n_genes)
            for k, v in sens_data.items():
                try:
                    idx = int(k)
                    if idx < n_genes:
                        means[idx] = v if isinstance(v, (int, float)) else 0
                except (ValueError, TypeError):
                    continue
        n_genes = len(means)
        labels = labels[:n_genes]
    elif isinstance(sens_data, (list, np.ndarray)):
        means = np.array(sens_data)
        n_genes = len(means)
        labels = labels[:n_genes]
    else:
        print(f"  Unexpected sensitivity format: {type(sens_data)}")
        return

    # Sort by sensitivity magnitude
    sorted_idx = np.argsort(np.abs(means))[::-1]

    sorted_labels = [labels[i] for i in sorted_idx]
    sorted_means = means[sorted_idx]
    colors = [get_color(l) for l in sorted_labels]

    y_pos = np.arange(len(sorted_labels))
    ax.barh(y_pos, sorted_means, color=colors, alpha=0.8,
            edgecolor="gray", linewidth=0.3)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(sorted_labels, fontsize=6)
    ax.set_xlabel("Mean Sensitivity", fontsize=10)
    ax.set_title(title, fontsize=11, fontweight="bold")
    ax.grid(True, axis="x", alpha=0.3)
    ax.invert_yaxis()


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "landscape_results.pkl", "rb") as f:
        data = pickle.load(f)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 8))

    # Sine sensitivity
    sens_sine = data.get("sensitivity_sine", data.get("sensitivity", {}))
    if isinstance(sens_sine, dict) and "sensitivities" in sens_sine:
        sens_sine = sens_sine["sensitivities"]
    plot_sensitivity(ax1, sens_sine, SINE_LABELS,
                     "Gene Sensitivity — Sine (18 genes)")

    # CPG sensitivity
    sens_cpg = data.get("sensitivity_cpg", {})
    if isinstance(sens_cpg, dict) and "sensitivities" in sens_cpg:
        sens_cpg = sens_cpg["sensitivities"]
    plot_sensitivity(ax2, sens_cpg, CPG_LABELS,
                     "Gene Sensitivity — CPG (38 genes)")

    # Add legend
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor="#1565C0", label="Amplitude"),
        Patch(facecolor="#43A047", label="Frequency"),
        Patch(facecolor="#FF9800", label="Phase"),
        Patch(facecolor="#E53935", label="Coupling"),
    ]
    fig.legend(handles=legend_elements, loc="upper center", ncol=4,
               fontsize=9, bbox_to_anchor=(0.5, 1.02))

    fig.suptitle("Gene Sensitivity Analysis", fontsize=14,
                 fontweight="bold", y=1.05)
    fig.tight_layout()
    out_path = FIGURES_DIR / "gene_sensitivity_bars.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
