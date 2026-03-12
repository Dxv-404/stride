"""Creature diagram — labeled stick figure with gene mappings.

Generates a publication-quality diagram of the STRIDE creature showing:
- Torso rectangle with dimensions
- All 4 limbs (upper + lower segments)
- All 6 motorized joints + 2 spring elbows
- Gene-to-joint mapping annotations
- Color coding: torso=blue, upper=green, lower=orange, joints=red

Saves to: report/figures/creature_diagram.png at 300 DPI.
"""

import math
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyArrowPatch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"


def draw_creature_diagram():
    """Draw the full creature morphology and gene mapping diagram."""
    fig, ax = plt.subplots(figsize=(12, 9))

    # Colors
    C_TORSO = "#4A90D9"
    C_UPPER = "#66BB6A"
    C_LOWER = "#FF9800"
    C_JOINT = "#E53935"
    C_ELBOW = "#9C27B0"
    C_GROUND = "#8D6E63"
    C_ANNOT = "#333333"

    # --- Creature geometry (centered at origin) ---
    # Torso
    torso_w, torso_h = 120, 40
    torso_x, torso_y = 200, 300

    # Ground
    ground_y = 80

    # Joint positions (approximate stick figure)
    # Hips at bottom corners of torso
    hip_L = (torso_x - 30, torso_y - torso_h / 2)
    hip_R = (torso_x + 30, torso_y - torso_h / 2)

    # Shoulders at top corners of torso
    shoulder_L = (torso_x - 40, torso_y + torso_h / 2)
    shoulder_R = (torso_x + 40, torso_y + torso_h / 2)

    # Upper legs
    knee_L = (hip_L[0] - 10, hip_L[1] - 60)
    knee_R = (hip_R[0] + 10, hip_R[1] - 60)

    # Lower legs
    foot_L = (knee_L[0] - 5, ground_y + 5)
    foot_R = (knee_R[0] + 5, ground_y + 5)

    # Upper arms
    elbow_L = (shoulder_L[0] - 40, shoulder_L[1] - 15)
    elbow_R = (shoulder_R[0] + 40, shoulder_R[1] - 15)

    # Lower arms (forearms)
    hand_L = (elbow_L[0] - 25, elbow_L[1] - 20)
    hand_R = (elbow_R[0] + 25, elbow_R[1] - 20)

    # --- Draw ground ---
    ax.plot([-10, 420], [ground_y, ground_y], color=C_GROUND,
            linewidth=3, zorder=1)
    ax.fill_between([-10, 420], [ground_y - 30, ground_y - 30],
                    [ground_y, ground_y], color=C_GROUND, alpha=0.15)
    ax.text(210, ground_y - 20, "Ground (y = 50px)",
            ha="center", fontsize=9, color=C_GROUND, style="italic")

    # --- Draw torso ---
    torso_rect = patches.FancyBboxPatch(
        (torso_x - torso_w / 2, torso_y - torso_h / 2),
        torso_w, torso_h,
        boxstyle="round,pad=3",
        facecolor=C_TORSO, edgecolor="black", linewidth=1.5,
        alpha=0.8, zorder=5)
    ax.add_patch(torso_rect)
    ax.text(torso_x, torso_y, "TORSO\n60 x 20 px",
            ha="center", va="center", fontsize=8, fontweight="bold",
            color="white", zorder=6)

    # --- Draw limb segments ---
    limb_lw = 5

    # Upper legs (green)
    ax.plot([hip_L[0], knee_L[0]], [hip_L[1], knee_L[1]],
            color=C_UPPER, linewidth=limb_lw, solid_capstyle="round", zorder=3)
    ax.plot([hip_R[0], knee_R[0]], [hip_R[1], knee_R[1]],
            color=C_UPPER, linewidth=limb_lw, solid_capstyle="round", zorder=3)

    # Lower legs (orange)
    ax.plot([knee_L[0], foot_L[0]], [knee_L[1], foot_L[1]],
            color=C_LOWER, linewidth=limb_lw, solid_capstyle="round", zorder=3)
    ax.plot([knee_R[0], foot_R[0]], [knee_R[1], foot_R[1]],
            color=C_LOWER, linewidth=limb_lw, solid_capstyle="round", zorder=3)

    # Upper arms (green)
    ax.plot([shoulder_L[0], elbow_L[0]], [shoulder_L[1], elbow_L[1]],
            color=C_UPPER, linewidth=limb_lw, solid_capstyle="round", zorder=3)
    ax.plot([shoulder_R[0], elbow_R[0]], [shoulder_R[1], elbow_R[1]],
            color=C_UPPER, linewidth=limb_lw, solid_capstyle="round", zorder=3)

    # Forearms (orange)
    ax.plot([elbow_L[0], hand_L[0]], [elbow_L[1], hand_L[1]],
            color=C_LOWER, linewidth=limb_lw, solid_capstyle="round", zorder=3)
    ax.plot([elbow_R[0], hand_R[0]], [elbow_R[1], hand_R[1]],
            color=C_LOWER, linewidth=limb_lw, solid_capstyle="round", zorder=3)

    # --- Draw joints ---
    joint_r = 7
    motor_joints = [
        (hip_L, "hip_L"),
        (hip_R, "hip_R"),
        (knee_L, "knee_L"),
        (knee_R, "knee_R"),
        (shoulder_L, "shldr_L"),
        (shoulder_R, "shldr_R"),
    ]

    for (jx, jy), jname in motor_joints:
        circle = plt.Circle((jx, jy), joint_r, color=C_JOINT,
                             ec="black", linewidth=1.0, zorder=7)
        ax.add_patch(circle)
        # Oscillation arrow
        ax.annotate("", xy=(jx + 12, jy + 8),
                    xytext=(jx + 12, jy - 8),
                    arrowprops=dict(arrowstyle="<->", color=C_JOINT,
                                    lw=1.2))

    # Elbow joints (spring — purple)
    for (ex, ey), ename in [(elbow_L, "elbow_L"), (elbow_R, "elbow_R")]:
        circle = plt.Circle((ex, ey), 5, color=C_ELBOW,
                             ec="black", linewidth=1.0, zorder=7)
        ax.add_patch(circle)

    # --- Gene mapping annotations ---
    # Left side annotations
    annotations_left = [
        (hip_L, "Genes 0-2: hip_L\n(A, f, phi)", (-85, -15)),
        (knee_L, "Genes 6-8: knee_L\n(A, f, phi)", (-95, 0)),
        (shoulder_L, "Genes 12-14: shldr_L\n(A, f, phi)", (-110, 20)),
        (elbow_L, "Spring joint\n(passive)", (-75, -35)),
    ]

    for (jx, jy), text, (dx, dy) in annotations_left:
        ax.annotate(text,
                    xy=(jx, jy),
                    xytext=(jx + dx, jy + dy),
                    fontsize=7.5, color=C_ANNOT,
                    ha="center",
                    arrowprops=dict(arrowstyle="->", color="#999999",
                                    connectionstyle="arc3,rad=-0.2",
                                    lw=0.8),
                    bbox=dict(boxstyle="round,pad=0.3", fc="white",
                              ec="#CCCCCC", alpha=0.9),
                    zorder=8)

    # Right side annotations
    annotations_right = [
        (hip_R, "Genes 3-5: hip_R\n(A, f, phi)", (85, -15)),
        (knee_R, "Genes 9-11: knee_R\n(A, f, phi)", (95, 0)),
        (shoulder_R, "Genes 15-17: shldr_R\n(A, f, phi)", (110, 20)),
        (elbow_R, "Spring joint\n(passive)", (75, -35)),
    ]

    for (jx, jy), text, (dx, dy) in annotations_right:
        ax.annotate(text,
                    xy=(jx, jy),
                    xytext=(jx + dx, jy + dy),
                    fontsize=7.5, color=C_ANNOT,
                    ha="center",
                    arrowprops=dict(arrowstyle="->", color="#999999",
                                    connectionstyle="arc3,rad=0.2",
                                    lw=0.8),
                    bbox=dict(boxstyle="round,pad=0.3", fc="white",
                              ec="#CCCCCC", alpha=0.9),
                    zorder=8)

    # --- Motor equation annotation ---
    ax.text(200, 440,
            r"Motor: $\theta_j(t) = A_j \cdot \sin(2\pi \cdot \omega_j \cdot t + \phi_j)$",
            ha="center", fontsize=11, style="italic",
            bbox=dict(boxstyle="round,pad=0.5", fc="#FFF9C4", ec="#FBC02D",
                      alpha=0.9))

    # --- Legend ---
    legend_x, legend_y = 370, 400
    legend_items = [
        (C_TORSO, "Torso (60 x 20 px)"),
        (C_UPPER, "Upper limbs (30 px)"),
        (C_LOWER, "Lower limbs (25 px)"),
        (C_JOINT, "Motorized joints (6)"),
        (C_ELBOW, "Spring elbows (2)"),
    ]
    for i, (color, label) in enumerate(legend_items):
        y = legend_y - i * 22
        ax.add_patch(plt.Rectangle((legend_x - 8, y - 5), 16, 10,
                                    facecolor=color, edgecolor="black",
                                    linewidth=0.5, zorder=8))
        ax.text(legend_x + 15, y, label, va="center", fontsize=8,
                color=C_ANNOT, zorder=8)

    # --- Title ---
    ax.set_title("Creature Morphology and Gene Mapping",
                 fontsize=15, fontweight="bold", pad=15)

    # --- Axes setup ---
    ax.set_xlim(-30, 470)
    ax.set_ylim(30, 470)
    ax.set_aspect("equal")
    ax.axis("off")

    return fig


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Creature Diagram]")

    fig = draw_creature_diagram()
    out_path = FIGURES_DIR / "creature_diagram.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path}")


if __name__ == "__main__":
    main()
