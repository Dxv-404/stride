"""Skeleton trail — motion-capture afterimage visualization.

Simulates the best creature and renders ghost-trail afterimages at
regular intervals, with older poses fading to transparent. Creates
a single wide figure showing the creature's walking motion over time.

Saves to: report/figures/skeleton_trail.png at 300 DPI.
"""

import math
import pickle
import sys
from pathlib import Path

import matplotlib.pyplot as plt
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

# Trail settings
TRAIL_DURATION = 8.0      # seconds of simulation to show
TRAIL_INTERVAL = 30       # capture skeleton every N frames (0.5s at 60fps)
MIN_ALPHA = 0.08          # oldest ghost alpha
MAX_ALPHA = 0.95          # newest ghost alpha


# ---------- skeleton extraction (shared with generation_replay) ----------

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
    foot_w = config.get("foot_width", 20)

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


def simulate_and_record(chromosome, config, duration=8.0, interval=30):
    """Run simulation and record skeleton snapshots at regular intervals.

    Returns list of (time, skeleton_dict) tuples.
    """
    encoding = config.get("encoding", "direct")
    joint_params = decode_chromosome(chromosome, encoding)

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain(config.get("terrain", "flat"))
    terrain.add_to_space(space)

    creature = Creature(space, joint_params, config, spawn_x=100)

    fps = config["simulation_fps"]
    dt = 1.0 / fps
    total_steps = int(duration * fps)
    v_max = config["max_velocity"]

    snapshots = []
    for step in range(total_steps):
        t = step * dt
        creature.update_motors(t)
        space.step(dt)
        creature.clamp_velocities(v_max)

        tx, ty = creature.torso.position
        if math.isnan(tx) or math.isnan(ty):
            break

        if step % interval == 0:
            skel = extract_skeleton(creature, config)
            snapshots.append((t, skel))

    return snapshots


def draw_ghost_skeleton(ax, skel, config, alpha=1.0, color_base="#2196F3"):
    """Draw a single skeleton ghost with given alpha."""
    if skel is None:
        return

    tw = config["torso_width"]
    th = config["torso_height"]
    foot_w = config.get("foot_width", 20)
    lw = max(1.0, 3.0 * alpha)

    def limb(p1, p2, c):
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=c,
                linewidth=lw, solid_capstyle="round", alpha=alpha, zorder=2)

    # Torso outline
    cx, cy = skel["torso_center"]
    angle = skel["torso_angle"]
    corners = [(-tw / 2, -th / 2), (tw / 2, -th / 2),
               (tw / 2, th / 2), (-tw / 2, th / 2)]
    world_corners = []
    for lx, ly in corners:
        wx = cx + lx * math.cos(angle) - ly * math.sin(angle)
        wy = cy + lx * math.sin(angle) + ly * math.cos(angle)
        world_corners.append((wx, wy))
    torso_patch = plt.Polygon(world_corners, closed=True,
                              facecolor=color_base, edgecolor="none",
                              alpha=alpha * 0.5, zorder=3)
    ax.add_patch(torso_patch)

    # Legs
    limb(skel["hip_L"], skel["knee_L"], "#66BB6A")
    limb(skel["knee_L"], skel["ankle_L"], "#FF9800")
    limb(skel["hip_R"], skel["knee_R"], "#66BB6A")
    limb(skel["knee_R"], skel["ankle_R"], "#FF9800")

    # Feet
    for side in ["L", "R"]:
        fx, fy = skel[f"foot_{side}"]
        fa = skel[f"foot_{side}_angle"]
        lx = fx - (foot_w / 2) * math.cos(fa)
        ly = fy - (foot_w / 2) * math.sin(fa)
        rx = fx + (foot_w / 2) * math.cos(fa)
        ry = fy + (foot_w / 2) * math.sin(fa)
        ax.plot([lx, rx], [ly, ry], color="#795548",
                linewidth=lw + 1, solid_capstyle="butt", alpha=alpha, zorder=2)

    # Arms
    limb(skel["shoulder_L"], skel["elbow_L"], "#66BB6A")
    limb(skel["elbow_L"], skel["hand_L"], "#FF9800")
    limb(skel["shoulder_R"], skel["elbow_R"], "#66BB6A")
    limb(skel["elbow_R"], skel["hand_R"], "#FF9800")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Skeleton Trail]")

    # Load baseline
    pkl_path = RESULTS_DIR / "baseline.pkl"
    if not pkl_path.exists():
        print("  ERROR: baseline.pkl not found")
        return

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    best_idx = max(range(len(runs)), key=lambda i: runs[i]["best_fitness"])
    chromosome = runs[best_idx]["best_chromosome"]
    fitness = runs[best_idx]["best_fitness"]
    config = {**BASELINE_CONFIG}

    print(f"  Simulating best creature (fitness={float(fitness):.1f})...")
    snapshots = simulate_and_record(
        chromosome, config,
        duration=TRAIL_DURATION, interval=TRAIL_INTERVAL)

    if not snapshots:
        print("  ERROR: No snapshots captured")
        return

    print(f"  Captured {len(snapshots)} snapshots over {TRAIL_DURATION}s")

    # Determine figure bounds
    all_x = []
    for _, skel in snapshots:
        all_x.append(skel["torso_center"][0])
    x_min = min(all_x) - 80
    x_max = max(all_x) + 80

    ground_h = config["ground_base_height"]
    fig_width = max(12, (x_max - x_min) / 30)
    fig, ax = plt.subplots(figsize=(fig_width, 4.5))

    # Ground
    ax.axhline(y=ground_h, color="#8D6E63", linewidth=2, zorder=1)
    ax.fill_between([x_min - 50, x_max + 50], 0, ground_h,
                    color="#8D6E63", alpha=0.1, zorder=0)

    # Draw ghosts from oldest (most transparent) to newest (most opaque)
    n = len(snapshots)
    for i, (t, skel) in enumerate(snapshots):
        # Linear alpha ramp from MIN_ALPHA to MAX_ALPHA
        frac = i / max(1, n - 1)
        alpha = MIN_ALPHA + frac * (MAX_ALPHA - MIN_ALPHA)

        # Color transitions from light blue (old) to dark blue (new)
        r = int(0x42 + (0x0D - 0x42) * frac)
        g = int(0xA5 + (0x47 - 0xA5) * frac)
        b = int(0xF5 + (0xA3 - 0xA3) * frac)
        color = f"#{max(0,r):02x}{max(0,g):02x}{max(0,b):02x}"

        draw_ghost_skeleton(ax, skel, config, alpha=alpha, color_base=color)

    # Time markers
    for i, (t, skel) in enumerate(snapshots):
        if i % 4 == 0:  # label every 4th snapshot
            tx = skel["torso_center"][0]
            ax.text(tx, ground_h - 8, f"{t:.1f}s",
                    ha="center", fontsize=6, color="#666666",
                    rotation=45)

    # Arrow showing direction of motion
    first_x = snapshots[0][1]["torso_center"][0]
    last_x = snapshots[-1][1]["torso_center"][0]
    mid_y = ground_h + 150
    ax.annotate("", xy=(last_x - 20, mid_y),
                xytext=(first_x + 20, mid_y),
                arrowprops=dict(arrowstyle="->", color="#999999",
                                lw=1.5, ls="--"))
    ax.text((first_x + last_x) / 2, mid_y + 8,
            "Direction of travel", ha="center", fontsize=8,
            color="#999999", style="italic")

    ax.set_xlim(x_min, x_max)
    ax.set_ylim(0, 200)
    ax.set_aspect("equal")
    ax.set_xlabel("x (pixels)", fontsize=9)
    ax.set_ylabel("y (pixels)", fontsize=9)
    ax.set_title(f"Walking Motion Trail — Best Creature (Fitness: {float(fitness):.0f})",
                 fontsize=12, fontweight="bold")
    ax.tick_params(labelsize=7)

    fig.tight_layout()
    out_path = FIGURES_DIR / "skeleton_trail.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


if __name__ == "__main__":
    main()
