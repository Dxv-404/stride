"""Side-by-side walker race — compare top 5 creatures.

Simulates the best creature from 5 different GA runs and renders them
in vertically stacked lanes, all captured at the same timestep (t=5s).
Shows the diversity of evolved walking strategies across independent runs.

Saves to: report/figures/race_comparison.png at 300 DPI.
"""

import math
import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import pymunk

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.creature import Creature
from src.encoding import decode_chromosome
from src.terrain import create_terrain

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

# Number of creatures to race
N_RACERS = 5
CAPTURE_TIME = 5.0   # seconds into simulation to capture


# ---------- skeleton extraction ----------

def _local_to_world(body, local_pt):
    cx, cy = body.position
    angle = body.angle
    lx, ly = local_pt
    wx = cx + lx * math.cos(angle) - ly * math.sin(angle)
    wy = cy + lx * math.sin(angle) + ly * math.cos(angle)
    return (wx, wy)


def _segment_endpoints(body, half_length):
    bottom = _local_to_world(body, (0, -half_length))
    top = _local_to_world(body, (0, half_length))
    return bottom, top


def extract_skeleton(creature, config):
    tw = config["torso_width"]
    th = config["torso_height"]
    ul = config["upper_limb_length"]
    ll = config["lower_limb_length"]

    skel = {}
    skel["torso_center"] = tuple(creature.torso.position)
    skel["torso_angle"] = creature.torso.angle
    skel["hip_L"] = _local_to_world(creature.torso, (-tw / 4, -th / 2))
    skel["hip_R"] = _local_to_world(creature.torso, (tw / 4, -th / 2))
    skel["knee_L"] = _segment_endpoints(creature.upper_leg_l, ul / 2)[0]
    skel["knee_R"] = _segment_endpoints(creature.upper_leg_r, ul / 2)[0]
    skel["ankle_L"] = _segment_endpoints(creature.lower_leg_l, ll / 2)[0]
    skel["ankle_R"] = _segment_endpoints(creature.lower_leg_r, ll / 2)[0]
    skel["foot_L"] = tuple(creature.foot_l.position)
    skel["foot_L_angle"] = creature.foot_l.angle
    skel["foot_R"] = tuple(creature.foot_r.position)
    skel["foot_R_angle"] = creature.foot_r.angle
    skel["shoulder_L"] = _local_to_world(creature.torso, (-tw / 3, th / 2))
    skel["shoulder_R"] = _local_to_world(creature.torso, (tw / 3, th / 2))
    skel["elbow_L"] = _segment_endpoints(creature.upper_arm_l, ul / 2)[1]
    skel["elbow_R"] = _segment_endpoints(creature.upper_arm_r, ul / 2)[1]
    skel["hand_L"] = _segment_endpoints(creature.lower_arm_l, ll / 2)[1]
    skel["hand_R"] = _segment_endpoints(creature.lower_arm_r, ll / 2)[1]
    return skel


def simulate_and_capture(chromosome, config, capture_t=5.0):
    """Run simulation and return (skeleton, torso_x_distance)."""
    encoding = config.get("encoding", "direct")
    joint_params = decode_chromosome(chromosome, encoding)

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain(config.get("terrain", "flat"))
    terrain.add_to_space(space)

    creature = Creature(space, joint_params, config, spawn_x=100)
    initial_x = creature.initial_x

    fps = config["simulation_fps"]
    dt = 1.0 / fps
    capture_step = int(capture_t * fps)
    total_steps = int(config["simulation_time"] * fps)
    v_max = config["max_velocity"]

    for step in range(min(capture_step + 1, total_steps)):
        t = step * dt
        creature.update_motors(t)
        space.step(dt)
        creature.clamp_velocities(v_max)

        tx, ty = creature.torso.position
        if math.isnan(tx) or math.isnan(ty):
            return None, 0

        if step == capture_step:
            skel = extract_skeleton(creature, config)
            distance = tx - initial_x
            return skel, distance

    return None, 0


def draw_skeleton(ax, skel, config, y_offset=0, color="#2196F3", lw=3):
    """Draw skeleton shifted vertically by y_offset."""
    if skel is None:
        return

    tw = config["torso_width"]
    th = config["torso_height"]
    foot_w = config.get("foot_width", 20)

    def shift(pt):
        return (pt[0], pt[1] + y_offset)

    def limb(p1, p2, c, linewidth=lw):
        s1, s2 = shift(p1), shift(p2)
        ax.plot([s1[0], s2[0]], [s1[1], s2[1]], color=c,
                linewidth=linewidth, solid_capstyle="round", zorder=3)

    # Torso
    cx, cy = skel["torso_center"]
    cy += y_offset
    angle = skel["torso_angle"]
    corners = [(-tw / 2, -th / 2), (tw / 2, -th / 2),
               (tw / 2, th / 2), (-tw / 2, th / 2)]
    world_corners = []
    for lx, ly in corners:
        wx = cx + lx * math.cos(angle) - ly * math.sin(angle)
        wy = cy + lx * math.sin(angle) + ly * math.cos(angle)
        world_corners.append((wx, wy))
    patch = plt.Polygon(world_corners, closed=True, facecolor=color,
                        edgecolor="black", linewidth=0.8, alpha=0.8, zorder=4)
    ax.add_patch(patch)

    # Legs
    limb(skel["hip_L"], skel["knee_L"], "#66BB6A")
    limb(skel["knee_L"], skel["ankle_L"], "#FF9800")
    limb(skel["hip_R"], skel["knee_R"], "#66BB6A")
    limb(skel["knee_R"], skel["ankle_R"], "#FF9800")

    # Feet
    for side in ["L", "R"]:
        fx, fy = skel[f"foot_{side}"]
        fy += y_offset
        fa = skel[f"foot_{side}_angle"]
        lx_f = fx - (foot_w / 2) * math.cos(fa)
        ly_f = fy - (foot_w / 2) * math.sin(fa)
        rx_f = fx + (foot_w / 2) * math.cos(fa)
        ry_f = fy + (foot_w / 2) * math.sin(fa)
        ax.plot([lx_f, rx_f], [ly_f, ry_f], color="#795548",
                linewidth=lw + 1, solid_capstyle="butt", zorder=2)

    # Arms
    limb(skel["shoulder_L"], skel["elbow_L"], "#66BB6A", lw - 1)
    limb(skel["elbow_L"], skel["hand_L"], "#FF9800", lw - 1)
    limb(skel["shoulder_R"], skel["elbow_R"], "#66BB6A", lw - 1)
    limb(skel["elbow_R"], skel["hand_R"], "#FF9800", lw - 1)

    # Joint dots
    for jp in ["hip_L", "hip_R", "knee_L", "knee_R",
               "shoulder_L", "shoulder_R", "elbow_L", "elbow_R"]:
        jx, jy = shift(skel[jp])
        ax.plot(jx, jy, "o", color="#E53935", markersize=3, zorder=5)


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Side-by-Side Race]")

    pkl_path = RESULTS_DIR / "baseline.pkl"
    if not pkl_path.exists():
        print("  ERROR: baseline.pkl not found")
        return

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    # Select 5 runs with diverse fitness values
    fitnesses = [(i, float(r["best_fitness"])) for i, r in enumerate(runs)]
    fitnesses.sort(key=lambda x: x[1], reverse=True)

    # Take top 5
    selected = fitnesses[:N_RACERS]
    config = {**BASELINE_CONFIG}

    colors = ["#2196F3", "#E53935", "#4CAF50", "#FF9800", "#9C27B0"]
    lane_height = 180   # vertical spacing between lanes
    ground_h = config["ground_base_height"]

    # Simulate all racers
    racers = []
    for rank, (run_idx, fit) in enumerate(selected):
        chrom = runs[run_idx]["best_chromosome"]
        print(f"  Simulating Run #{run_idx} (fitness={fit:.1f})...")
        skel, dist = simulate_and_capture(chrom, config, CAPTURE_TIME)
        racers.append((run_idx, fit, skel, dist, colors[rank]))

    # Compute viewport from actual creature positions
    all_torso_x = []
    for _, _, skel, dist, _ in racers:
        if skel is not None:
            all_torso_x.append(skel["torso_center"][0])
    if all_torso_x:
        x_min = min(min(all_torso_x) - 80, 30)
        x_max = max(max(all_torso_x) + 80, 200)
    else:
        x_min, x_max = 30, 350

    # Draw
    fig, ax = plt.subplots(figsize=(max(10, (x_max - x_min) / 30), 2.5 * N_RACERS))

    for rank, (run_idx, fit, skel, dist, color) in enumerate(racers):
        y_offset = rank * lane_height

        # Ground line for this lane
        gy = ground_h + y_offset
        ax.axhline(y=gy, color="#8D6E63", linewidth=1.5,
                   xmin=0, xmax=1, zorder=1, alpha=0.5)
        ax.fill_between([x_min - 40, x_max + 40],
                        y_offset, gy,
                        color="#8D6E63", alpha=0.05, zorder=0)

        # Lane label
        ax.text(x_min - 15, gy + 55, f"#{rank + 1}",
                fontsize=14, fontweight="bold", color=color,
                ha="right", va="center")
        ax.text(x_min - 15, gy + 35,
                f"Fit: {fit:.0f}\nDist: {dist:.0f}px",
                fontsize=7, color="#666666", ha="right", va="center")

        # Start line
        ax.axvline(x=100, ymin=0, ymax=1, color="#CCCCCC",
                   linewidth=0.5, linestyle="--", zorder=0)

        # Draw creature
        draw_skeleton(ax, skel, config, y_offset=y_offset,
                      color=color, lw=3)

    ax.set_xlim(x_min - 20, x_max + 20)
    ax.set_ylim(-20, N_RACERS * lane_height + 20)
    ax.set_aspect("equal")
    ax.set_xlabel("x position (pixels)", fontsize=10)
    ax.set_title(f"Walker Race — Top {N_RACERS} Creatures at t={CAPTURE_TIME:.0f}s",
                 fontsize=13, fontweight="bold")
    ax.set_yticks([])
    ax.tick_params(labelsize=8)

    fig.tight_layout()
    out_path = FIGURES_DIR / "race_comparison.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


if __name__ == "__main__":
    main()
