"""Figure 17: Push Recovery Filmstrip.

2 rows: Sine (top), CPG+NN (bottom).
4 columns: t=7.4s (before push), t=7.6s (impact), t=8.0s (stumbling),
           t=9.0s (result).
Renders stick figures at each timestamp from recorded simulation.
Arrow showing push direction at t=7.6s.
"FELL" / "RECOVERED" label on last column.

Runs live simulations with push at t=7.5s.
Loads best chromosomes from experiments/results/.
Saves to: report/figures/push_filmstrip.png
"""

import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pymunk

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.creature import Creature
from src.terrain import create_terrain
from src.cpgnn_controller import CPGNNController
from src.sensors import get_sensors, setup_foot_contact_tracking

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Timestamps to capture (seconds)
CAPTURE_TIMES = [7.4, 7.6, 8.0, 9.0]
PUSH_TIME = 7.5
PUSH_STRENGTH = 5000  # Strong push for visual contrast
SIM_DURATION = 10.0
DT = 1.0 / 60.0

COLUMN_LABELS = ["Before Push\nt=7.4s", "Impact\nt=7.6s",
                 "Stumbling\nt=8.0s", "Result\nt=9.0s"]


def get_body_snapshot(creature):
    """Get positions of all body parts for stick figure rendering."""
    parts = {}
    for name in ["torso", "upper_leg_l", "lower_leg_l", "foot_l",
                  "upper_leg_r", "lower_leg_r", "foot_r",
                  "upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r"]:
        body = getattr(creature, name, None)
        if body is not None:
            parts[name] = (float(body.position.x), float(body.position.y))
    return parts


def run_sine_sim_with_push(chromosome, push_time, push_strength):
    """Run sine controller simulation with push, recording body snapshots."""
    from src.config import BASELINE_CONFIG

    config = dict(BASELINE_CONFIG)
    config["simulation_duration"] = SIM_DURATION

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("flat")
    terrain.add_to_space(space)

    from src.encoding import decode_direct
    joint_params = decode_direct(chromosome)
    creature = Creature(space, joint_params=joint_params, config=config)

    v_max = config.get("velocity_clamp", 1500)
    total_steps = int(SIM_DURATION / DT)

    snapshots = {}
    capture_steps = {int(t / DT): t for t in CAPTURE_TIMES}
    push_step = int(push_time / DT)
    fell = False

    for step in range(total_steps):
        t = step * DT
        creature.update_motors(t)
        space.step(DT)
        creature.clamp_velocities(v_max)

        # Apply push
        if step == push_step:
            creature.torso.apply_impulse_at_local_point(
                (-push_strength, 0), (0, 0))

        # Capture snapshots
        if step in capture_steps:
            snapshots[capture_steps[step]] = get_body_snapshot(creature)

        # Check for fall
        torso_angle = creature.get_torso_angle()
        if abs(torso_angle) > 1.2 and t > push_time + 0.5:
            fell = True

    # Check final state
    tx, ty = creature.get_torso_position()
    torso_angle = creature.get_torso_angle()
    if abs(torso_angle) > 1.0 or ty < 60:
        fell = True

    return snapshots, fell


def run_cpgnn_sim_with_push(chromosome, push_time, push_strength):
    """Run CPG+NN controller simulation with push, recording body snapshots."""
    from src.config import BASELINE_CONFIG

    config = dict(BASELINE_CONFIG)
    config["simulation_duration"] = SIM_DURATION

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("flat")
    terrain.add_to_space(space)
    creature = Creature(space, joint_params=None, config=config)

    controller = CPGNNController(chromosome)
    foot_contacts = setup_foot_contact_tracking(space, creature)

    v_max = config.get("velocity_clamp", 1500)
    total_steps = int(SIM_DURATION / DT)

    snapshots = {}
    capture_steps = {int(t / DT): t for t in CAPTURE_TIMES}
    push_step = int(push_time / DT)
    fell = False

    sensors = get_sensors(creature, foot_contacts)

    for step in range(total_steps):
        t = step * DT

        foot_contacts["foot_L"] = False
        foot_contacts["foot_R"] = False

        targets, mod = controller.get_targets(t, DT, sensors)
        creature.set_motor_targets(targets)
        space.step(DT)
        creature.clamp_velocities(v_max)

        sensors = get_sensors(creature, foot_contacts)

        # Apply push
        if step == push_step:
            creature.torso.apply_impulse_at_local_point(
                (-push_strength, 0), (0, 0))

        # Capture snapshots
        if step in capture_steps:
            snapshots[capture_steps[step]] = get_body_snapshot(creature)

        # Check for fall
        torso_angle = creature.get_torso_angle()
        if abs(torso_angle) > 1.2 and t > push_time + 0.5:
            fell = True

    tx, ty = creature.get_torso_position()
    torso_angle = creature.get_torso_angle()
    if abs(torso_angle) > 1.0 or ty < 60:
        fell = True

    return snapshots, fell


def draw_stick_figure(ax, snapshot, x_offset=0, color="black", alpha=1.0):
    """Draw a stick figure from body part positions."""
    if not snapshot:
        return

    # Define limb connections (pairs of body parts to connect)
    connections = [
        # Legs
        ("torso", "upper_leg_l"), ("upper_leg_l", "lower_leg_l"),
        ("lower_leg_l", "foot_l"),
        ("torso", "upper_leg_r"), ("upper_leg_r", "lower_leg_r"),
        ("lower_leg_r", "foot_r"),
        # Arms
        ("torso", "upper_arm_l"), ("upper_arm_l", "lower_arm_l"),
        ("torso", "upper_arm_r"), ("upper_arm_r", "lower_arm_r"),
    ]

    for part_a, part_b in connections:
        if part_a in snapshot and part_b in snapshot:
            x1, y1 = snapshot[part_a]
            x2, y2 = snapshot[part_b]
            ax.plot([x1 - x_offset, x2 - x_offset], [y1, y2],
                    color=color, linewidth=2.5, alpha=alpha, solid_capstyle="round")

    # Draw torso as a thicker line / circle
    if "torso" in snapshot:
        tx, ty = snapshot["torso"]
        ax.plot(tx - x_offset, ty, "o", color=color, markersize=8,
                alpha=alpha)

    # Draw feet as small rectangles
    for foot in ["foot_l", "foot_r"]:
        if foot in snapshot:
            fx, fy = snapshot[foot]
            ax.plot(fx - x_offset, fy, "s", color=color, markersize=5,
                    alpha=alpha)


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading best chromosomes...")
    with open(RESULTS_DIR / "baseline.pkl", "rb") as f:
        sine_runs = pickle.load(f)
    best_sine = max(sine_runs, key=lambda r: r["best_fitness"] if r else -999)

    with open(RESULTS_DIR / "cpgnn_flat.pkl", "rb") as f:
        cpgnn_runs = pickle.load(f)
    best_cpgnn = max(cpgnn_runs,
                     key=lambda r: r["best_fitness"] if r else -999)

    print(f"  Sine: fitness={best_sine['best_fitness']:.0f}")
    print(f"  CPG+NN: fitness={best_cpgnn['best_fitness']:.0f}")

    print("Running sine simulation with push...")
    sine_snaps, sine_fell = run_sine_sim_with_push(
        best_sine["best_chromosome"], PUSH_TIME, PUSH_STRENGTH)

    print("Running CPG+NN simulation with push...")
    cpgnn_snaps, cpgnn_fell = run_cpgnn_sim_with_push(
        best_cpgnn["best_chromosome"], PUSH_TIME, PUSH_STRENGTH)

    print(f"  Sine fell: {sine_fell}, CPG+NN fell: {cpgnn_fell}")

    # --- Create filmstrip ---
    fig, axes = plt.subplots(2, 4, figsize=(16, 7))

    controllers = [
        ("Sine Controller", sine_snaps, sine_fell, "#1565C0"),
        ("CPG+NN Controller", cpgnn_snaps, cpgnn_fell, "#FF9800"),
    ]

    for row_idx, (ctrl_name, snaps, fell, color) in enumerate(controllers):
        for col_idx, t in enumerate(CAPTURE_TIMES):
            ax = axes[row_idx, col_idx]
            snap = snaps.get(t, {})

            if snap:
                # Center on torso x
                torso_x = snap.get("torso", (0, 0))[0]
                draw_stick_figure(ax, snap, x_offset=torso_x, color=color)

                # Draw ground line
                ax.axhline(y=30, color="#8D6E63", linewidth=2, alpha=0.5)

                # Set view
                ax.set_xlim(-80, 80)
                ax.set_ylim(0, 180)
            else:
                ax.text(0.5, 0.5, "No data", ha="center", va="center",
                        transform=ax.transAxes, fontsize=10, color="gray")

            ax.set_aspect("equal")
            ax.axis("off")

            # Column headers (top row only)
            if row_idx == 0:
                ax.set_title(COLUMN_LABELS[col_idx], fontsize=10,
                             fontweight="bold")

            # Push arrow at impact column
            if col_idx == 1 and snap:
                ax.annotate("PUSH", xy=(-40, 120), xytext=(-70, 140),
                            fontsize=8, fontweight="bold", color="red",
                            arrowprops=dict(arrowstyle="->", color="red",
                                            lw=2.5))

            # Result label at last column
            if col_idx == 3:
                label = "FELL" if fell else "RECOVERED"
                label_color = "#E53935" if fell else "#43A047"
                ax.text(0.5, 0.05, label, ha="center", va="bottom",
                        transform=ax.transAxes, fontsize=14,
                        fontweight="bold", color=label_color,
                        bbox=dict(boxstyle="round,pad=0.3",
                                  facecolor="white", edgecolor=label_color,
                                  alpha=0.9))

        # Row label
        axes[row_idx, 0].text(-0.15, 0.5, ctrl_name,
                              transform=axes[row_idx, 0].transAxes,
                              fontsize=12, fontweight="bold",
                              rotation=90, va="center", ha="center")

    fig.suptitle("Push Recovery Comparison — Filmstrip",
                 fontsize=15, fontweight="bold", y=1.02)

    fig.tight_layout()
    out_path = FIGURES_DIR / "push_filmstrip.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
