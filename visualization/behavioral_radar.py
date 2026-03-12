"""Figure 23: Behavioral Fingerprint Radar Chart.

Spider/radar chart with 8 axes: distance, avg_speed, step_frequency,
duty_factor, double_support, torso_stability, CoT_inverted (1/CoT),
gait_symmetry. 3 overlaid polygons: sine (blue), CPG (green),
CPG+NN (amber). Values normalized to [0, 1] across all controllers.

Loads from: experiments/results/gait_results.pkl
Saves to:   report/figures/behavioral_radar.png
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


# Metrics to show on radar (keys from fingerprint['mean'])
RADAR_METRICS = [
    "distance", "avg_speed", "step_frequency", "duty_factor",
    "double_support", "torso_stability",
]
# Derived metrics
RADAR_LABELS = [
    "Distance", "Avg Speed", "Step Freq", "Duty Factor",
    "Double Support", "Torso Stability", "1/CoT\n(Efficiency)", "Gait\nSymmetry",
]


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "gait_results.pkl", "rb") as f:
        data = pickle.load(f)

    controller_cfg = {
        "sine":       {"color": "#1565C0", "label": "Sine"},
        "cpg":        {"color": "#43A047", "label": "CPG"},
        "cpgnn_flat": {"color": "#FF9800", "label": "CPG+NN"},
    }

    # Collect mean values for each controller across all metrics
    raw_values = {}
    for ctrl_name in controller_cfg:
        if ctrl_name not in data["results"]:
            continue

        fps = data["results"][ctrl_name]["fingerprint"]
        syms = data["results"][ctrl_name]["symmetry"]

        # Average across creatures
        metric_means = {}
        for metric in RADAR_METRICS:
            vals = [fp["mean"].get(metric) for fp in fps
                    if fp["mean"].get(metric) is not None
                    and np.isfinite(fp["mean"].get(metric, float('nan')))]
            metric_means[metric] = np.mean(vals) if vals else 0.0

        # CoT inverted (1/CoT, higher = more efficient)
        cots = [fp["mean"].get("cost_of_transport") for fp in fps
                if fp["mean"].get("cost_of_transport") is not None
                and fp["mean"].get("cost_of_transport", 0) > 0]
        metric_means["cot_inv"] = (1.0 / np.mean(cots)) if cots else 0.0

        # Gait symmetry (mean phase diff, closer to π = better walking)
        phase_diffs = [s["mean_phase_diff"] for s in syms
                       if s.get("mean_phase_diff") is not None
                       and np.isfinite(s.get("mean_phase_diff", float('nan')))
                       and not s.get("is_incommensurate", False)]
        metric_means["gait_sym"] = (np.mean(phase_diffs) / np.pi
                                    if phase_diffs else 0.0)

        raw_values[ctrl_name] = metric_means

    if not raw_values:
        print("No data available for radar chart")
        return

    # All metric keys in order
    all_metrics = RADAR_METRICS + ["cot_inv", "gait_sym"]

    # Min-max normalize across all controllers
    normalized = {}
    for ctrl_name, metrics in raw_values.items():
        normalized[ctrl_name] = {}

    for metric in all_metrics:
        vals = [raw_values[c].get(metric, 0) for c in raw_values]
        vmin, vmax = min(vals), max(vals)
        rng = vmax - vmin if vmax != vmin else 1.0
        for ctrl_name in raw_values:
            v = raw_values[ctrl_name].get(metric, 0)
            # Use absolute value for distance/speed (negative = bad)
            if metric in ("distance", "avg_speed"):
                v = abs(v)
                abs_vals = [abs(raw_values[c].get(metric, 0))
                            for c in raw_values]
                vmin, vmax = min(abs_vals), max(abs_vals)
                rng = vmax - vmin if vmax != vmin else 1.0
            normalized[ctrl_name][metric] = (v - vmin) / rng

    # Build radar chart
    n_metrics = len(all_metrics)
    angles = np.linspace(0, 2 * np.pi, n_metrics, endpoint=False).tolist()
    angles += angles[:1]  # close the polygon

    fig, ax = plt.subplots(figsize=(8, 8),
                           subplot_kw=dict(projection="polar"))

    for ctrl_name, cfg in controller_cfg.items():
        if ctrl_name not in normalized:
            continue
        values = [normalized[ctrl_name].get(m, 0) for m in all_metrics]
        values += values[:1]  # close
        ax.plot(angles, values, color=cfg["color"], linewidth=2.0,
                label=cfg["label"])
        ax.fill(angles, values, color=cfg["color"], alpha=0.15)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(RADAR_LABELS, fontsize=9)
    ax.set_ylim(0, 1.1)
    ax.set_yticks([0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(["0.25", "0.50", "0.75", "1.00"], fontsize=7,
                       color="gray")
    ax.set_title("Behavioral Fingerprint — Controller Comparison",
                 fontsize=13, fontweight="bold", pad=20)
    ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1), fontsize=10)

    fig.tight_layout()
    out_path = FIGURES_DIR / "behavioral_radar.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
