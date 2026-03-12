"""Experiment 11 — NN Output Recording.

Records what the neural network outputs during walking.
Needed for the NN modulation time-series figure (Figure 11).

Protocol (from stride_v3.md Section 9):
  - 6 best CPG+NN creatures: 3 from flat-trained, 3 from mixed-trained
  - Record per-step for 15s simulation (900 steps at 60fps):
      * time
      * 6 NN modulation values (tanh output m — recorded DIRECTLY)
      * 6 CPG base targets (before modulation)
      * 6 final motor targets (after modulation)
      * 18 full sensor values
      * 6 reduced sensor values (NN input)
  - CRITICAL: Record tanh output m directly from forward_nn(),
    do NOT recover via (final - cpg) / (0.5 * cpg) — divides by
    near-zero when CPG output crosses zero (Errata Fix 3).

Usage:
    python experiments/nn_output_recording.py

Estimated time: ~1-2 minutes
"""

import math
import os
import pickle
import sys
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import pymunk

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.creature import Creature
from src.terrain import create_terrain
from src.cpg_controller import CPGController
from src.cpgnn_controller import CPGNNController
from src.sensors import (
    SENSOR_NAMES, REDUCED_SENSOR_INDICES,
    get_sensors, get_reduced_sensors, setup_foot_contact_tracking,
)

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Fixed seed
RNG_SEED = 42


def load_best_chromosomes(pkl_name, n=3):
    """Load top-n best chromosomes from a completed experiment."""
    pkl_path = RESULTS_DIR / f"{pkl_name}.pkl"
    if not pkl_path.exists():
        print(f"  SKIP: {pkl_path} not found")
        return None

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid = [r for r in runs if r is not None and "best_chromosome" in r]
    valid.sort(key=lambda r: r["best_fitness"], reverse=True)
    top = valid[:n]

    return [(np.array(r["best_chromosome"]), r["best_fitness"]) for r in top]


def record_nn_outputs(chromosome, config, duration=15.0):
    """Record full NN output trace during a walking simulation.

    Uses a custom simulation loop to capture CPG targets SEPARATELY
    from the final modulated targets. This avoids the division-by-zero
    issue of recovering modulation from (final - cpg) / (0.5 * cpg).

    Args:
        chromosome: np.ndarray of shape (96,) — CPG+NN chromosome.
        config: experiment config dict.
        duration: simulation duration in seconds.

    Returns:
        dict with time-series data for plotting.
    """
    controller = CPGNNController(chromosome)

    # Set up physics environment
    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("flat")
    terrain.add_to_space(space)

    creature = Creature(space, joint_params=None, config=config, spawn_x=100)
    foot_contacts = setup_foot_contact_tracking(space, creature)

    fps = config["simulation_fps"]
    dt = 1.0 / fps
    total_steps = int(duration * fps)
    v_max = config["max_velocity"]

    history = {
        "time": [],
        "nn_modulation": [],     # 6 tanh outputs (DIRECTLY recorded)
        "cpg_output": [],        # 6 CPG base targets (before modulation)
        "final_targets": [],     # 6 final motor targets (after modulation)
        "sensors_full": [],      # 18-dim full sensor vector
        "sensors_reduced": [],   # 6-dim NN input
        "torso_x": [],
        "torso_y": [],
        "torso_angle": [],
    }

    # Initial sensor reading (rest pose, no contacts) for first step
    sensors = get_sensors(creature, foot_contacts)
    reduced = get_reduced_sensors(sensors)

    for step in range(total_steps):
        t = step * dt

        # Reset contacts before step; pre_solve callback sets them
        # back to True during space.step() for active contacts.
        foot_contacts["foot_L"] = False
        foot_contacts["foot_R"] = False

        # === KEY: Get CPG targets and NN modulation SEPARATELY ===
        # Step the CPG to get base targets
        cpg_targets = controller.cpg.step(dt)

        # Run NN forward pass directly to get modulation
        modulation = controller.forward_nn(reduced)

        # Compute final targets with modulation
        final_targets = [
            cpg_targets[i] * (1.0 + 0.5 * modulation[i])
            for i in range(6)
        ]

        # Apply targets to creature
        creature.set_motor_targets(final_targets)

        # Step physics
        space.step(dt)
        creature.clamp_velocities(v_max)

        # Read sensors AFTER physics step (foot contacts now correct)
        sensors = get_sensors(creature, foot_contacts)
        reduced = get_reduced_sensors(sensors)

        # Record state
        tx, ty = creature.get_torso_position()
        angle = creature.get_torso_angle()

        # NaN check — stop if physics explodes
        if math.isnan(tx) or math.isnan(ty) or math.isnan(angle):
            break

        history["time"].append(float(t))
        history["nn_modulation"].append(modulation.copy())
        history["cpg_output"].append(list(cpg_targets))
        history["final_targets"].append(final_targets)
        history["sensors_full"].append(sensors.copy())
        history["sensors_reduced"].append(reduced.copy())
        history["torso_x"].append(float(tx))
        history["torso_y"].append(float(ty))
        history["torso_angle"].append(float(angle))

    # Convert lists to numpy arrays for easier analysis
    for key in ["nn_modulation", "cpg_output", "final_targets",
                "sensors_full", "sensors_reduced"]:
        if history[key]:
            history[key] = np.array(history[key])
        else:
            history[key] = np.array([])

    return history


def run_nn_recording():
    """Run NN output recording for top creatures.

    Returns:
        dict with recordings keyed by source experiment.
    """
    np.random.seed(RNG_SEED)
    config = {**BASELINE_CONFIG}

    recordings = {}

    # 3 best from flat-trained CPG+NN
    flat_chromos = load_best_chromosomes("cpgnn_flat", n=3)
    if flat_chromos:
        print(f"\n  Recording flat-trained CPG+NN ({len(flat_chromos)} creatures)")
        flat_recordings = []
        for ci, (chromo, train_fit) in enumerate(flat_chromos):
            print(f"    Creature {ci+1} (fitness={train_fit:.1f}) ...",
                  end="", flush=True)
            t0 = time.time()
            rec = record_nn_outputs(chromo, config)
            n_steps = len(rec["time"])
            print(f" {n_steps} steps ({time.time()-t0:.1f}s)")
            rec["train_fitness"] = float(train_fit)
            rec["source"] = "cpgnn_flat"
            flat_recordings.append(rec)
        recordings["cpgnn_flat"] = flat_recordings
    else:
        print("  SKIP: No cpgnn_flat.pkl")

    # 3 best from mixed-trained CPG+NN
    mixed_chromos = load_best_chromosomes("cpgnn_mixed", n=3)
    if mixed_chromos:
        print(f"\n  Recording mixed-trained CPG+NN ({len(mixed_chromos)} creatures)")
        mixed_recordings = []
        for ci, (chromo, train_fit) in enumerate(mixed_chromos):
            print(f"    Creature {ci+1} (fitness={train_fit:.1f}) ...",
                  end="", flush=True)
            t0 = time.time()
            rec = record_nn_outputs(chromo, config)
            n_steps = len(rec["time"])
            print(f" {n_steps} steps ({time.time()-t0:.1f}s)")
            rec["train_fitness"] = float(train_fit)
            rec["source"] = "cpgnn_mixed"
            mixed_recordings.append(rec)
        recordings["cpgnn_mixed"] = mixed_recordings
    else:
        print("  SKIP: No cpgnn_mixed.pkl")

    return recordings


def print_recording_summary(recordings):
    """Print summary of NN output recordings."""
    print(f"\n{'='*70}")
    print("  NN Output Recording Summary")
    print(f"{'='*70}")

    for source, recs in recordings.items():
        print(f"\n  {source}:")
        for ci, rec in enumerate(recs):
            n_steps = len(rec["time"])
            if n_steps == 0:
                print(f"    Creature {ci+1}: No data (sim failed)")
                continue

            mod = rec["nn_modulation"]
            mean_mod = np.mean(np.abs(mod), axis=0)
            max_mod = np.max(np.abs(mod), axis=0)

            print(f"    Creature {ci+1} (fitness={rec['train_fitness']:.1f}): "
                  f"{n_steps} steps")
            print(f"      Mean |modulation|: [{', '.join(f'{m:.3f}' for m in mean_mod)}]")
            print(f"      Max  |modulation|: [{', '.join(f'{m:.3f}' for m in max_mod)}]")

    print(f"{'='*70}\n")


def save_results(recordings):
    """Save NN recordings with metadata."""
    # Convert numpy arrays to lists for pickle compatibility
    serializable = {}
    for source, recs in recordings.items():
        s_recs = []
        for rec in recs:
            s_rec = {}
            for key, val in rec.items():
                if isinstance(val, np.ndarray):
                    s_rec[key] = val.tolist()
                else:
                    s_rec[key] = val
            s_recs.append(s_rec)
        serializable[source] = s_recs

    out_data = {
        "recordings": serializable,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "rng_seed": RNG_SEED,
            "sensor_names": SENSOR_NAMES,
            "reduced_sensor_indices": REDUCED_SENSOR_INDICES,
            "joint_names": [
                "hip_L", "hip_R", "knee_L", "knee_R",
                "shoulder_L", "shoulder_R"
            ],
            "n_recordings": sum(len(v) for v in recordings.values()),
        },
    }

    out_path = RESULTS_DIR / "nn_output_recordings.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path}")


def main():
    print("\n" + "=" * 60)
    print("  STRIDE -- NN Output Recording (Experiment 11)")
    print("=" * 60)

    t0 = time.time()
    recordings = run_nn_recording()

    if not recordings:
        print("\n  No recordings! Run CPG+NN experiments first.")
        return

    print_recording_summary(recordings)
    save_results(recordings)

    elapsed = time.time() - t0
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
