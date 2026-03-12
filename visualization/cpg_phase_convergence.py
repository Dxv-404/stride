"""Figure 15: CPG Phase Convergence.

Shows how CPG oscillator phases evolve over generations.
- X-axis: generation (0 to 75)
- Y-axis: phase values (0 to 2π) of the 6 oscillators
- Extract from cpg_baseline.pkl: each generation's best_chromosome
- Overlay 5-10 representative runs (thin lines) + mean trajectory (bold)
- Highlight: do hip phases converge to ~π anti-phase?

Loads from: experiments/results/cpg_baseline.pkl
Saves to:   report/figures/cpg_phase_convergence.png
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

# CPG gene layout: 6 oscillators × 3 params (amp, freq, phase) = 18 genes
# Then 10 connections × 2 params (weight, phase_offset) = 20 genes
OSCILLATOR_NAMES = ["Hip L", "Hip R", "Knee L", "Knee R",
                    "Shoulder L", "Shoulder R"]
COLORS = ["#E53935", "#1565C0", "#43A047", "#FF9800", "#9C27B0", "#00BCD4"]

# Key coupling connections and their gene indices
# Connections: (from, to) stored at gene indices 18+conn_idx*2 (weight),
#              18+conn_idx*2+1 (phase_offset)
# Connection 4: hip_L→hip_R (index 18+4*2=26 weight, 27 phase_offset)
# Connection 5: hip_R→hip_L (index 18+5*2=28 weight, 29 phase_offset)
HIP_COUPLING_PHASE_INDICES = [27, 29]  # phase_offset genes for hip L↔R


def decode_initial_phases(chromosome):
    """Extract the 6 initial oscillator phases from a 38-gene chromosome.

    Each oscillator has 3 genes: [amp, freq, phase] at indices i*3, i*3+1, i*3+2.
    phase = gene * 2π.
    """
    phases = np.zeros(6)
    for i in range(6):
        phases[i] = chromosome[i*3 + 2] * 2 * np.pi  # phase gene
    return phases


def decode_hip_coupling_phase(chromosome):
    """Extract hip L↔R coupling phase offsets."""
    return [chromosome[idx] * 2 * np.pi for idx in HIP_COUPLING_PHASE_INDICES]


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    with open(RESULTS_DIR / "cpg_baseline.pkl", "rb") as f:
        runs = pickle.load(f)

    # Filter valid runs with all_best_per_gen
    valid_runs = [r for r in runs if r is not None
                  and "all_best_per_gen" in r
                  and len(r["all_best_per_gen"]) > 0]

    if not valid_runs:
        print("No valid CPG runs found with per-generation chromosomes")
        return

    n_gens = min(len(r["all_best_per_gen"]) for r in valid_runs)
    gens = np.arange(n_gens)

    # Select up to 10 representative runs
    n_show = min(10, len(valid_runs))

    fig, axes = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

    # --- Panel 1: Initial oscillator phases over generations ---
    ax = axes[0]

    # Collect all runs' phase trajectories for averaging
    all_phase_trajs = np.zeros((len(valid_runs), n_gens, 6))

    for run_idx, run in enumerate(valid_runs):
        chromosomes = run["all_best_per_gen"][:n_gens]
        for gen_idx, chromo in enumerate(chromosomes):
            all_phase_trajs[run_idx, gen_idx] = decode_initial_phases(chromo)

    # Plot individual runs (thin, transparent)
    for run_idx in range(n_show):
        for osc_idx in range(6):
            ax.plot(gens, all_phase_trajs[run_idx, :, osc_idx],
                    color=COLORS[osc_idx], alpha=0.15, linewidth=0.6)

    # Plot mean trajectory (bold)
    mean_phases = np.mean(all_phase_trajs, axis=0)  # (n_gens, 6)
    for osc_idx in range(6):
        ax.plot(gens, mean_phases[:, osc_idx], color=COLORS[osc_idx],
                linewidth=2.0, label=OSCILLATOR_NAMES[osc_idx])

    ax.set_ylabel("Initial Phase (rad)", fontsize=11)
    ax.set_ylim(-0.2, 2 * np.pi + 0.2)
    ax.set_yticks([0, np.pi/2, np.pi, 3*np.pi/2, 2*np.pi])
    ax.set_yticklabels(["0", "π/2", "π", "3π/2", "2π"], fontsize=9)
    ax.set_title("Oscillator Initial Phases Over Generations",
                 fontsize=12, fontweight="bold")
    ax.legend(loc="upper right", fontsize=8, ncol=3)
    ax.grid(True, alpha=0.3)

    # Reference line at π (anti-phase)
    ax.axhline(y=np.pi, color="gray", linewidth=1.0, linestyle=":",
               alpha=0.5)
    ax.text(n_gens * 0.02, np.pi + 0.15, "π (anti-phase)", fontsize=7,
            color="gray")

    # --- Panel 2: Hip L↔R phase difference over generations ---
    ax = axes[1]

    # Compute hip_L - hip_R initial phase difference
    all_hip_diffs = np.zeros((len(valid_runs), n_gens))
    for run_idx in range(len(valid_runs)):
        hip_l = all_phase_trajs[run_idx, :, 0]  # hip_L
        hip_r = all_phase_trajs[run_idx, :, 1]  # hip_R
        diff = np.abs(hip_l - hip_r)
        # Wrap to [0, π] (phase difference modulo π)
        all_hip_diffs[run_idx] = np.minimum(diff, 2*np.pi - diff)

    # Individual runs
    for run_idx in range(n_show):
        ax.plot(gens, all_hip_diffs[run_idx], color="#E53935",
                alpha=0.15, linewidth=0.6)

    # Mean + std
    mean_diff = np.mean(all_hip_diffs, axis=0)
    std_diff = np.std(all_hip_diffs, axis=0)
    ax.fill_between(gens, mean_diff - std_diff, mean_diff + std_diff,
                    color="#E53935", alpha=0.15)
    ax.plot(gens, mean_diff, color="#E53935", linewidth=2.5,
            label=f"Hip L↔R Phase Diff (n={len(valid_runs)})")

    # Reference line at π (expected walking anti-phase)
    ax.axhline(y=np.pi, color="black", linewidth=1.5, linestyle="--",
               label="π (walking anti-phase)")

    ax.set_xlabel("Generation", fontsize=11)
    ax.set_ylabel("Phase Difference (rad)", fontsize=11)
    ax.set_ylim(-0.2, np.pi + 0.5)
    ax.set_yticks([0, np.pi/4, np.pi/2, 3*np.pi/4, np.pi])
    ax.set_yticklabels(["0", "π/4", "π/2", "3π/4", "π"], fontsize=9)
    ax.set_title("Hip L↔R Phase Difference Convergence",
                 fontsize=12, fontweight="bold")
    ax.legend(loc="lower right", fontsize=9)
    ax.grid(True, alpha=0.3)

    # Annotate final value
    final_diff = mean_diff[-1]
    ax.annotate(f"Final: {final_diff:.2f} rad\n({final_diff/np.pi:.2f}π)",
                xy=(n_gens-1, final_diff),
                xytext=(n_gens*0.7, final_diff + 0.3),
                arrowprops=dict(arrowstyle="->", color="black"),
                fontsize=9, fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.3", facecolor="lightyellow",
                          edgecolor="gray"))

    fig.suptitle("CPG Phase Convergence", fontsize=14, fontweight="bold",
                 y=1.01)
    fig.tight_layout()
    out_path = FIGURES_DIR / "cpg_phase_convergence.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
