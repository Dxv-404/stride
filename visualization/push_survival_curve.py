"""Figure 24: Perturbation Survival Curve.

X-axis: push strength (gentle, moderate, strong, violent).
Y-axis: survival rate (0-100%).
4 lines: sine (blue), CPG (green), CPG+NN flat (amber), CPG+NN mixed (red).
Significance stars from Fisher's exact test at each strength level.

Loads from: experiments/results/perturbation_results.pkl
Saves to:   report/figures/push_survival_curve.png
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

    with open(RESULTS_DIR / "perturbation_results.pkl", "rb") as f:
        data = pickle.load(f)

    results = data["results"]
    fisher = data["fisher"]
    strengths_map = data["metadata"]["push_strengths"]

    strength_names = ["gentle", "moderate", "strong", "violent"]
    strength_values = [strengths_map[s] for s in strength_names]

    controller_cfg = {
        "sine":       {"color": "#1565C0", "label": "Sine", "marker": "o"},
        "cpg":        {"color": "#43A047", "label": "CPG", "marker": "s"},
        "cpgnn_flat": {"color": "#FF9800", "label": "CPG+NN (Flat)",
                       "marker": "^"},
        "cpgnn_mixed":{"color": "#E53935", "label": "CPG+NN (Mixed)",
                       "marker": "D"},
    }

    fig, ax = plt.subplots(figsize=(9, 5.5))

    for ctrl_name, cfg in controller_cfg.items():
        if ctrl_name not in results:
            continue

        survival_rates = []
        for strength in strength_names:
            trials = results[ctrl_name][strength]
            n_survived = sum(1 for t in trials if not t["fell"])
            survival_rates.append(100.0 * n_survived / len(trials))

        ax.plot(strength_values, survival_rates,
                color=cfg["color"], marker=cfg["marker"],
                linewidth=2.0, markersize=8, label=cfg["label"])

    # Add significance stars for Fisher tests
    # Compare each controller against sine at each strength level
    y_star_offset = 3
    for ctrl_name in ["cpg", "cpgnn_flat", "cpgnn_mixed"]:
        if ctrl_name not in fisher:
            continue
        for i, strength in enumerate(strength_names):
            if strength in fisher[ctrl_name]:
                f_data = fisher[ctrl_name][strength]
                # Handle both tuple (odds_ratio, p_value) and dict formats
                if isinstance(f_data, tuple):
                    p_val = f_data[1]
                elif isinstance(f_data, dict):
                    p_val = f_data.get("p_value", f_data.get("p", 1.0))
                else:
                    p_val = 1.0
                if np.isnan(p_val):
                    continue
                if p_val < 0.001:
                    star = "***"
                elif p_val < 0.01:
                    star = "**"
                elif p_val < 0.05:
                    star = "*"
                else:
                    continue

                # Place star above the max survival at this strength
                max_surv = 0
                for cn in controller_cfg:
                    if cn in results:
                        trials = results[cn][strength]
                        s_rate = 100.0 * sum(1 for t in trials
                                             if not t["fell"]) / len(trials)
                        max_surv = max(max_surv, s_rate)
                ax.text(strength_values[i], min(105, max_surv + y_star_offset),
                        star, ha="center", va="bottom", fontsize=10,
                        color=controller_cfg[ctrl_name]["color"],
                        fontweight="bold")

    ax.set_xlabel("Push Strength (N·impulse)", fontsize=11)
    ax.set_ylabel("Survival Rate (%)", fontsize=11)
    ax.set_title("Perturbation Survival by Controller and Push Strength",
                 fontsize=13, fontweight="bold")
    ax.set_ylim(-5, 115)
    ax.set_xticks(strength_values)
    ax.set_xticklabels([f"{s}\n({v})" for s, v in
                        zip(strength_names, strength_values)], fontsize=9)
    ax.legend(loc="lower left", fontsize=9)
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    out_path = FIGURES_DIR / "push_survival_curve.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
