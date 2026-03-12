"""Evolution snapshots — best creature at key generations.

Shows the progressive improvement of the best creature across evolution,
with snapshots at generations 1, 19, 38, 57, and 75 (the final gen).
Each panel simulates the corresponding chromosome and captures the
walking skeleton at t=5.0s (mid-simulation).

Saves to: report/figures/evolution_snapshots.png at 300 DPI.
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

# Generations to snapshot (evenly spaced across 75 gens, 0-indexed)
SNAPSHOT_GENS = [0, 18, 37, 56, 74]
SNAPSHOT_LABELS = ["Gen 1", "Gen 19", "Gen 38", "Gen 57", "Gen 75"]

# Capture time during simulation (seconds)
CAPTURE_TIME = 5.0


# ---------- skeleton extraction helpers ----------

def _local_to_world(body, local_pt):
    """Convert a local-frame point to world coordinates."""
    cx, cy = body.position
    angle = body.angle
    lx, ly = local_pt
    wx = cx + lx * math.cos(angle) - ly * math.sin(angle)
    wy = cy + lx * math.sin(angle) + ly * math.cos(angle)
    return (wx, wy)


def _segment_endpoints(body, half_length):
    """Return (bottom, top) world endpoints of a vertical segment body."""
    bottom = _local_to_world(body, (0, -half_length))
    top = _local_to_world(body, (0, half_length))
    return bottom, top


def extract_skeleton(creature, config):
    """Extract all joint positions for rendering the stick figure.

    Returns a dict of named points: torso_center, hip_L, knee_L, ankle_L,
    foot_L, hip_R, knee_R, ankle_R, foot_R, shoulder_L, elbow_L, hand_L,
    shoulder_R, elbow_R, hand_R.
    """
    tw = config["torso_width"]
    th = config["torso_height"]
    ul = config["upper_limb_length"]
    ll = config["lower_limb_length"]
    foot_w = config.get("foot_width", 20)
    foot_h = config.get("foot_height", 5)

    torso = creature.torso
    half_ul = ul / 2
    half_ll = ll / 2
    half_fw = foot_w / 2
    half_fh = foot_h / 2

    skel = {}
    skel["torso_center"] = tuple(torso.position)
    skel["torso_angle"] = torso.angle

    # Hips (bottom of torso)
    skel["hip_L"] = _local_to_world(torso, (-tw / 4, -th / 2))
    skel["hip_R"] = _local_to_world(torso, (tw / 4, -th / 2))

    # Knees (bottom of upper legs)
    skel["knee_L"] = _segment_endpoints(creature.upper_leg_l, half_ul)[0]
    skel["knee_R"] = _segment_endpoints(creature.upper_leg_r, half_ul)[0]

    # Ankles (bottom of lower legs)
    skel["ankle_L"] = _segment_endpoints(creature.lower_leg_l, half_ll)[0]
    skel["ankle_R"] = _segment_endpoints(creature.lower_leg_r, half_ll)[0]

    # Feet (center + width)
    skel["foot_L"] = tuple(creature.foot_l.position)
    skel["foot_L_angle"] = creature.foot_l.angle
    skel["foot_R"] = tuple(creature.foot_r.position)
    skel["foot_R_angle"] = creature.foot_r.angle

    # Shoulders (top of torso)
    skel["shoulder_L"] = _local_to_world(torso, (-tw / 3, th / 2))
    skel["shoulder_R"] = _local_to_world(torso, (tw / 3, th / 2))

    # Elbows (top of upper arms — the end away from shoulder)
    skel["elbow_L"] = _segment_endpoints(creature.upper_arm_l, half_ul)[1]
    skel["elbow_R"] = _segment_endpoints(creature.upper_arm_r, half_ul)[1]

    # Hands (top of lower arms — the end away from elbow)
    skel["hand_L"] = _segment_endpoints(creature.lower_arm_l, half_ll)[1]
    skel["hand_R"] = _segment_endpoints(creature.lower_arm_r, half_ll)[1]

    return skel


def simulate_and_capture(chromosome, config, capture_t=5.0):
    """Run a simulation and capture the skeleton at time capture_t.

    Returns (skeleton_dict, torso_x_at_capture).
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
    capture_step = int(capture_t * fps)
    total_steps = int(config["simulation_time"] * fps)
    v_max = config["max_velocity"]

    skeleton = None
    for step in range(min(capture_step + 1, total_steps)):
        t = step * dt
        creature.update_motors(t)
        space.step(dt)
        creature.clamp_velocities(v_max)

        tx, ty = creature.torso.position
        if math.isnan(tx) or math.isnan(ty):
            return None

        if step == capture_step:
            skeleton = extract_skeleton(creature, config)
            break

    return skeleton


def draw_skeleton(ax, skel, config, color="#2196F3", alpha=1.0, lw=3):
    """Draw a stick-figure skeleton on the given axes."""
    if skel is None:
        return

    C_TORSO = color
    C_UPPER = "#66BB6A"
    C_LOWER = "#FF9800"
    C_JOINT = "#E53935"
    C_FOOT = "#795548"

    # Apply alpha to all colors
    def draw_limb(p1, p2, c, linewidth=lw):
        ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=c,
                linewidth=linewidth, solid_capstyle="round",
                alpha=alpha, zorder=3)

    # Torso
    tw = config["torso_width"]
    th = config["torso_height"]
    cx, cy = skel["torso_center"]
    angle = skel["torso_angle"]
    # Draw torso as rotated rectangle
    corners_local = [(-tw/2, -th/2), (tw/2, -th/2),
                     (tw/2, th/2), (-tw/2, th/2)]
    corners_world = []
    for lx, ly in corners_local:
        wx = cx + lx * math.cos(angle) - ly * math.sin(angle)
        wy = cy + lx * math.sin(angle) + ly * math.cos(angle)
        corners_world.append((wx, wy))
    torso_patch = plt.Polygon(corners_world, closed=True,
                              facecolor=C_TORSO, edgecolor="black",
                              linewidth=1, alpha=alpha * 0.8, zorder=4)
    ax.add_patch(torso_patch)

    # Legs
    draw_limb(skel["hip_L"], skel["knee_L"], C_UPPER)
    draw_limb(skel["knee_L"], skel["ankle_L"], C_LOWER)
    draw_limb(skel["hip_R"], skel["knee_R"], C_UPPER)
    draw_limb(skel["knee_R"], skel["ankle_R"], C_LOWER)

    # Feet (short thick line)
    foot_w = config.get("foot_width", 20)
    for side in ["L", "R"]:
        fx, fy = skel[f"foot_{side}"]
        fa = skel[f"foot_{side}_angle"]
        left_x = fx - (foot_w / 2) * math.cos(fa)
        left_y = fy - (foot_w / 2) * math.sin(fa)
        right_x = fx + (foot_w / 2) * math.cos(fa)
        right_y = fy + (foot_w / 2) * math.sin(fa)
        ax.plot([left_x, right_x], [left_y, right_y], color=C_FOOT,
                linewidth=lw + 2, solid_capstyle="butt",
                alpha=alpha, zorder=3)

    # Arms
    draw_limb(skel["shoulder_L"], skel["elbow_L"], C_UPPER, lw - 1)
    draw_limb(skel["elbow_L"], skel["hand_L"], C_LOWER, lw - 1)
    draw_limb(skel["shoulder_R"], skel["elbow_R"], C_UPPER, lw - 1)
    draw_limb(skel["elbow_R"], skel["hand_R"], C_LOWER, lw - 1)

    # Joints (dots)
    joint_pts = ["hip_L", "hip_R", "knee_L", "knee_R",
                 "shoulder_L", "shoulder_R", "elbow_L", "elbow_R"]
    for jp in joint_pts:
        jx, jy = skel[jp]
        ax.plot(jx, jy, "o", color=C_JOINT, markersize=4,
                alpha=alpha, zorder=5)


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    print("\n[Generation Replay]")

    # Load baseline run 0
    pkl_path = RESULTS_DIR / "baseline.pkl"
    if not pkl_path.exists():
        print("  ERROR: baseline.pkl not found")
        return

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    # Use run with best fitness
    best_idx = max(range(len(runs)), key=lambda i: runs[i]["best_fitness"])
    run = runs[best_idx]
    all_best = run["all_best_per_gen"]
    convergence = run.get("convergence_history",
                          run.get("best_fitness_per_gen", []))

    config = {**BASELINE_CONFIG}
    ground_h = config["ground_base_height"]

    n_panels = len(SNAPSHOT_GENS)
    fig, axes = plt.subplots(1, n_panels, figsize=(4 * n_panels, 5))

    for i, (gen_idx, label) in enumerate(zip(SNAPSHOT_GENS, SNAPSHOT_LABELS)):
        ax = axes[i]
        chromosome = all_best[gen_idx]
        fitness = convergence[gen_idx] if gen_idx < len(convergence) else 0

        print(f"  Simulating {label} (fitness={fitness:.1f})...")
        skel = simulate_and_capture(chromosome, config, capture_t=CAPTURE_TIME)

        # Draw ground
        ax.axhline(y=ground_h, color="#8D6E63", linewidth=2, zorder=1)
        ax.fill_between([0, 500], 0, ground_h,
                        color="#8D6E63", alpha=0.1, zorder=0)

        # Draw skeleton
        draw_skeleton(ax, skel, config, lw=3)

        # Dynamically center viewport on the creature's actual position
        if skel is not None:
            torso_x = skel["torso_center"][0]
            view_half = 100  # show 200px window centered on creature
            ax.set_xlim(torso_x - view_half, torso_x + view_half)
        else:
            ax.set_xlim(50, 250)

        # Formatting
        ax.set_title(f"{label}\nFitness: {fitness:.0f}",
                     fontsize=11, fontweight="bold")
        ax.set_ylim(0, 200)
        ax.set_aspect("equal")
        ax.set_xlabel("x (pixels)", fontsize=8)
        if i == 0:
            ax.set_ylabel("y (pixels)", fontsize=8)
        ax.tick_params(labelsize=7)

    fig.suptitle("Evolution of Best Creature Across Generations",
                 fontsize=14, fontweight="bold", y=1.02)
    fig.tight_layout()

    out_path = FIGURES_DIR / "evolution_snapshots.png"
    fig.savefig(out_path, dpi=300, bbox_inches="tight",
                facecolor="white", edgecolor="none")
    plt.close(fig)
    print(f"  Saved: {out_path.name}")


if __name__ == "__main__":
    main()
