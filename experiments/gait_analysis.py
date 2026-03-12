"""Experiment 10 — Gait Analysis (Table 6).

Three sub-analyses of creature walking patterns:
  a) Gait symmetry — phase difference between left/right hip oscillators
  b) Behavioral fingerprinting — multi-metric gait characterization
  c) Cost of Transport — metabolic efficiency

Protocol (from stride_v3.md Section 9):
  - 30 best chromosomes x 3 controllers (sine, CPG, CPG+NN)
  - Gait symmetry: CPG phase diff pi=walking, 0=hopping
  - Handle incommensurate sine frequencies (>10% difference)
  - Behavioral fingerprint: run 3x (for consistency measurement)
  - CoT: concentric/eccentric metabolic model

Additions:
  - 3x repetition of behavioral fingerprint for consistency
  - Foot contact helpers (count_foot_strikes, duty_factor, etc.)
  - Fixed RNG seed for reproducibility
  - Metadata in output

Usage:
    python experiments/gait_analysis.py
    python experiments/gait_analysis.py --controllers sine cpg

Estimated time: ~5-10 minutes
"""

import logging
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

from src.config import BASELINE_CONFIG, V2_EXPERIMENTS
from src.creature import Creature
from src.terrain import create_terrain
from src.encoding import decode_direct
from src.fitness import compute_fitness, compute_fitness_v2, compute_cost_of_transport
from src.physics_sim import simulate, simulate_v2
from src.sensors import (
    SENSOR_NAMES, REDUCED_SENSOR_INDICES,
    get_sensors, setup_foot_contact_tracking,
)

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Fixed seed
RNG_SEED = 42

# Controller definitions: name -> (pkl_file, controller_type, encoding)
CONTROLLER_DEFS = {
    "sine":         ("baseline",      "sine",   "direct"),
    "cpg":          ("cpg_baseline",  "cpg",    "cpg"),
    "cpgnn_flat":   ("cpgnn_flat",    "cpg_nn", "cpg_nn"),
}

# Number of behavioral fingerprint repetitions (addition)
BFP_REPETITIONS = 3


# =========================================================================
# Foot contact helper functions (Errata Fix 13)
# =========================================================================

def count_foot_strikes(foot_contact_history):
    """Count False->True transitions (heel strikes).

    A heel strike occurs when the foot transitions from airborne to
    ground contact. This is more robust than counting contact frames.
    """
    strikes = 0
    for i in range(1, len(foot_contact_history)):
        if foot_contact_history[i] and not foot_contact_history[i - 1]:
            strikes += 1
    return strikes


def fraction_with_foot_on_ground(left_history, right_history):
    """Fraction of timesteps where at least one foot is on ground."""
    if not left_history:
        return 0.0
    return float(np.mean([l or r for l, r in zip(left_history, right_history)]))


def fraction_both_feet_down(left_history, right_history):
    """Fraction of timesteps where both feet are on ground (double support)."""
    if not left_history:
        return 0.0
    return float(np.mean([l and r for l, r in zip(left_history, right_history)]))


# =========================================================================
# Gait symmetry
# =========================================================================

def load_best_chromosomes(pkl_name, n=30):
    """Load best chromosomes from a completed experiment."""
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


def compute_gait_symmetry_sine(chromosome):
    """Compute gait symmetry for a sine controller.

    Decodes frequencies and checks for incommensurate hip frequencies.
    If |f_L - f_R| / max(f_L, f_R) > 0.10, phase difference sweeps
    through all values — a mathematical artifact, not a gait characteristic.
    """
    params = decode_direct(chromosome)
    hip_L_amp, hip_L_freq, hip_L_phase = params[0]
    hip_R_amp, hip_R_freq, hip_R_phase = params[1]

    freq_ratio = abs(hip_L_freq - hip_R_freq) / max(hip_L_freq, hip_R_freq, 0.01)

    if freq_ratio > 0.10:
        return {
            "mean_phase_diff": None,
            "std_phase_diff": None,
            "is_incommensurate": True,
            "freq_ratio": float(freq_ratio),
            "phase_stability": 0.0,
            "is_walking": False,
            "is_hopping": False,
        }

    # Compute analytical phase difference (constant for matched frequencies)
    phase_diff = abs(hip_L_phase - hip_R_phase) % (2 * math.pi)
    if phase_diff > math.pi:
        phase_diff = 2 * math.pi - phase_diff

    return {
        "mean_phase_diff": float(phase_diff),
        "std_phase_diff": 0.0,  # constant for matched freqs
        "is_incommensurate": False,
        "freq_ratio": float(freq_ratio),
        "phase_stability": float("inf"),
        "is_walking": abs(phase_diff - math.pi) < 0.5,
        "is_hopping": phase_diff < 0.5,
    }


def compute_gait_symmetry_cpg(chromosome, controller_type, config):
    """Compute gait symmetry for CPG or CPG+NN controller.

    Runs a full 15s simulation and records the phase difference
    between left and right hip CPG oscillators after the initial
    3s transient period.
    """
    from src.cpg_controller import CPGController
    from src.cpgnn_controller import CPGNNController

    # Create controller to access phases
    if controller_type == "cpg":
        controller = CPGController(chromosome)
    else:
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
    sim_time = config["simulation_time"]
    total_steps = int(sim_time * fps)
    v_max = config["max_velocity"]

    phase_diffs = []

    # Initial sensor reading (rest pose, no contacts) for first step
    sensors = get_sensors(creature, foot_contacts)

    for step in range(total_steps):
        t = step * dt

        # Reset contacts before step; pre_solve callback sets them
        # back to True during space.step() for active contacts.
        foot_contacts["foot_L"] = False
        foot_contacts["foot_R"] = False

        # Get targets and advance phases
        if controller_type == "cpg":
            targets = controller.get_targets(t, dt)
            phases = controller.phases
        else:
            targets, _ = controller.get_targets(t, dt, sensors)
            phases = controller.cpg.phases

        creature.set_motor_targets(targets)
        space.step(dt)
        creature.clamp_velocities(v_max)

        # Read sensors AFTER physics step (foot contacts now correct)
        sensors = get_sensors(creature, foot_contacts)

        # Record phase difference after transient (t > 3s)
        if t > 3.0:
            left_phase = phases[0]
            right_phase = phases[1]
            diff = abs(left_phase - right_phase) % (2 * math.pi)
            if diff > math.pi:
                diff = 2 * math.pi - diff
            phase_diffs.append(diff)

        # NaN check
        tx, ty = creature.get_torso_position()
        if math.isnan(tx) or math.isnan(ty):
            break

    if not phase_diffs:
        return {
            "mean_phase_diff": None,
            "std_phase_diff": None,
            "is_incommensurate": False,
            "freq_ratio": 0.0,
            "phase_stability": 0.0,
            "is_walking": False,
            "is_hopping": False,
        }

    mean_diff = float(np.mean(phase_diffs))
    std_diff = float(np.std(phase_diffs))

    return {
        "mean_phase_diff": mean_diff,
        "std_phase_diff": std_diff,
        "is_incommensurate": False,
        "freq_ratio": 0.0,
        "phase_stability": float(1.0 / (std_diff + 0.01)),
        "is_walking": abs(mean_diff - math.pi) < 0.5,
        "is_hopping": mean_diff < 0.5,
    }


# =========================================================================
# Behavioral fingerprint
# =========================================================================

def compute_behavioral_fingerprint(chromosome, controller_type, config):
    """Compute multi-metric gait characterization from a single simulation.

    Extracts ALL metrics from one simulation run (Errata Fix 6 — no
    double-simulating). Uses simulate_v2 with record_sensors=True to
    capture foot contact history from sensor log.

    Returns:
        dict with gait metrics (distance, speed, step_frequency, etc.)
    """
    if controller_type == "sine":
        # Sine uses v1 simulator
        joint_params = decode_direct(chromosome)
        sim_result = simulate(joint_params, "flat", config)
        fitness = compute_fitness(sim_result, config, joint_params=joint_params)
        cot = compute_cost_of_transport(sim_result)

        # For sine, we don't have per-step foot contact data from v1 sim,
        # so we return what we can
        duration = sim_result.steps_completed / config["simulation_fps"]
        if sim_result.torso_positions:
            distance = sim_result.torso_positions[-1][0] - sim_result.torso_positions[0][0]
        else:
            distance = 0.0

        return {
            "distance": float(distance),
            "avg_speed": float(distance / max(duration, 0.01)),
            "step_frequency": None,  # not available for v1 sine
            "duty_factor": None,
            "double_support": None,
            "avg_torso_angle": float(np.mean(np.abs(sim_result.torso_angles)))
                if sim_result.torso_angles else 0.0,
            "torso_stability": float(1.0 / (np.std(sim_result.torso_angles) + 0.01))
                if sim_result.torso_angles else 0.0,
            "cost_of_transport": float(cot),
            "fitness": float(fitness),
        }

    # V2 controllers: use simulate_v2 with sensor recording
    sim_result = simulate_v2(
        chromosome, controller_type, "flat", config,
        record_sensors=True,
    )
    fitness = compute_fitness_v2(sim_result, config, controller_type)
    cot = compute_cost_of_transport(sim_result)

    duration = sim_result.steps_completed / config["simulation_fps"]
    if sim_result.torso_positions:
        distance = sim_result.torso_positions[-1][0] - sim_result.torso_positions[0][0]
    else:
        distance = 0.0

    # Extract foot contact history from sensor log
    # sensor indices 16 (foot_L) and 17 (foot_R)
    foot_L_history = []
    foot_R_history = []
    for s in sim_result.sensor_log:
        foot_L_history.append(s[16] > 0.5)  # binary threshold
        foot_R_history.append(s[17] > 0.5)

    step_freq = None
    duty_factor = None
    double_support = None

    if foot_L_history:
        left_strikes = count_foot_strikes(foot_L_history)
        right_strikes = count_foot_strikes(foot_R_history)
        total_strikes = left_strikes + right_strikes
        step_freq = total_strikes / max(duration, 0.01)
        duty_factor = fraction_with_foot_on_ground(foot_L_history, foot_R_history)
        double_support = fraction_both_feet_down(foot_L_history, foot_R_history)

    return {
        "distance": float(distance),
        "avg_speed": float(distance / max(duration, 0.01)),
        "step_frequency": float(step_freq) if step_freq is not None else None,
        "duty_factor": float(duty_factor) if duty_factor is not None else None,
        "double_support": float(double_support) if double_support is not None else None,
        "avg_torso_angle": float(np.mean(np.abs(sim_result.torso_angles)))
            if sim_result.torso_angles else 0.0,
        "torso_stability": float(1.0 / (np.std(sim_result.torso_angles) + 0.01))
            if sim_result.torso_angles else 0.0,
        "cost_of_transport": float(cot),
        "fitness": float(fitness),
    }


# =========================================================================
# Main analysis
# =========================================================================

def run_gait_analysis(controller_names=None):
    """Run full gait analysis for all controller types.

    Returns:
        dict with symmetry, fingerprint, and summary data per controller.
    """
    np.random.seed(RNG_SEED)

    if controller_names is None:
        controller_names = list(CONTROLLER_DEFS.keys())

    config = {**BASELINE_CONFIG}
    all_results = {}

    for ctrl_name in controller_names:
        if ctrl_name not in CONTROLLER_DEFS:
            print(f"  SKIP: Unknown controller '{ctrl_name}'")
            continue

        pkl_name, ctrl_type, encoding = CONTROLLER_DEFS[ctrl_name]
        print(f"\n  Analyzing: {ctrl_name} (from {pkl_name}.pkl)")

        chromosomes = load_best_chromosomes(pkl_name)
        if chromosomes is None:
            continue

        print(f"    Loaded {len(chromosomes)} chromosomes")

        # --- Gait Symmetry ---
        print(f"    Gait symmetry ...", end="", flush=True)
        t0 = time.time()

        symmetry_results = []
        for chromo, _ in chromosomes:
            if ctrl_type == "sine":
                sym = compute_gait_symmetry_sine(chromo)
            else:
                sym = compute_gait_symmetry_cpg(chromo, ctrl_type, config)
            symmetry_results.append(sym)

        n_incom = sum(1 for s in symmetry_results if s.get("is_incommensurate"))
        n_walking = sum(1 for s in symmetry_results if s.get("is_walking"))
        n_hopping = sum(1 for s in symmetry_results if s.get("is_hopping"))
        print(f" walk={n_walking} hop={n_hopping} incom={n_incom} "
              f"({time.time()-t0:.1f}s)")

        # --- Behavioral Fingerprint (3x repetition) ---
        print(f"    Behavioral fingerprint (x{BFP_REPETITIONS}) ...",
              end="", flush=True)
        t0 = time.time()

        fingerprint_results = []
        for ci, (chromo, _) in enumerate(chromosomes):
            trials = []
            for rep in range(BFP_REPETITIONS):
                fp = compute_behavioral_fingerprint(chromo, ctrl_type, config)
                trials.append(fp)

            # Compute mean and std across repetitions
            mean_fp = {}
            std_fp = {}
            for key in trials[0]:
                vals = [t[key] for t in trials if t[key] is not None]
                if vals:
                    mean_fp[key] = float(np.mean(vals))
                    std_fp[key] = float(np.std(vals))
                else:
                    mean_fp[key] = None
                    std_fp[key] = None

            fingerprint_results.append({
                "mean": mean_fp,
                "std": std_fp,
                "trials": trials,
            })

        mean_speed = np.mean([f["mean"]["avg_speed"]
                              for f in fingerprint_results
                              if f["mean"]["avg_speed"] is not None])
        print(f" avg_speed={mean_speed:.1f} ({time.time()-t0:.1f}s)")

        all_results[ctrl_name] = {
            "symmetry": symmetry_results,
            "fingerprint": fingerprint_results,
        }

    return all_results


def print_results_table(results):
    """Print Table 6 format."""
    print(f"\n{'='*90}")
    print("  TABLE 6: Gait Analysis")
    print(f"{'='*90}")

    # Gait Symmetry Summary
    print(f"\n  Gait Symmetry:")
    print(f"  {'Controller':<15} {'Walking':>8} {'Hopping':>8} {'Incom.':>8} "
          f"{'Phase diff':>12} {'Stability':>10}")
    print("  " + "-" * 75)

    for ctrl_name, data in results.items():
        sym = data["symmetry"]
        n_walk = sum(1 for s in sym if s.get("is_walking"))
        n_hop = sum(1 for s in sym if s.get("is_hopping"))
        n_incom = sum(1 for s in sym if s.get("is_incommensurate"))
        valid_diffs = [s["mean_phase_diff"] for s in sym
                       if s["mean_phase_diff"] is not None]
        mean_diff = np.mean(valid_diffs) if valid_diffs else float("nan")
        stabs = [s["phase_stability"] for s in sym
                 if s["phase_stability"] is not None
                 and s["phase_stability"] < float("inf")]
        mean_stab = np.mean(stabs) if stabs else float("nan")

        print(f"  {ctrl_name:<15} {n_walk:>8} {n_hop:>8} {n_incom:>8} "
              f"{mean_diff:>10.3f}  {mean_stab:>10.1f}")

    # Behavioral Fingerprint Summary
    print(f"\n  Behavioral Fingerprint (mean across 30 best):")
    metrics = ["avg_speed", "step_frequency", "duty_factor",
               "double_support", "cost_of_transport", "avg_torso_angle"]
    print(f"  {'Controller':<15}", end="")
    for m in metrics:
        print(f" {m[:10]:>12}", end="")
    print()
    print("  " + "-" * 90)

    for ctrl_name, data in results.items():
        print(f"  {ctrl_name:<15}", end="")
        for metric in metrics:
            vals = [f["mean"][metric] for f in data["fingerprint"]
                    if f["mean"][metric] is not None]
            if vals:
                print(f" {np.mean(vals):>12.3f}", end="")
            else:
                print(f" {'N/A':>12}", end="")
        print()

    print(f"{'='*90}\n")


def save_results(results):
    """Save gait analysis results with metadata."""
    out_data = {
        "results": results,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "rng_seed": RNG_SEED,
            "bfp_repetitions": BFP_REPETITIONS,
            "n_controllers": len(results),
            "controllers": list(results.keys()),
        },
    }

    out_path = RESULTS_DIR / "gait_results.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path}")

    # CSV: symmetry
    csv_path = RESULTS_DIR / "table_gait_symmetry.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("controller,creature_idx,mean_phase_diff,std_phase_diff,"
                "is_walking,is_hopping,is_incommensurate,phase_stability\n")
        for ctrl_name, data in results.items():
            for ci, sym in enumerate(data["symmetry"]):
                pd = sym.get("mean_phase_diff")
                sd = sym.get("std_phase_diff")
                f.write(f"{ctrl_name},{ci},"
                        f"{pd if pd is not None else 'N/A'},"
                        f"{sd if sd is not None else 'N/A'},"
                        f"{sym.get('is_walking', False)},"
                        f"{sym.get('is_hopping', False)},"
                        f"{sym.get('is_incommensurate', False)},"
                        f"{sym.get('phase_stability', 0.0)}\n")
    print(f"  Saved: {csv_path}")

    # CSV: fingerprint means
    csv_path2 = RESULTS_DIR / "table_behavioral_fingerprint.csv"
    with open(csv_path2, "w", encoding="utf-8") as f:
        f.write("controller,creature_idx,distance,avg_speed,step_frequency,"
                "duty_factor,double_support,avg_torso_angle,torso_stability,"
                "cost_of_transport,fitness\n")
        for ctrl_name, data in results.items():
            for ci, fp in enumerate(data["fingerprint"]):
                m = fp["mean"]
                f.write(f"{ctrl_name},{ci},"
                        f"{m.get('distance', 'N/A')},"
                        f"{m.get('avg_speed', 'N/A')},"
                        f"{m.get('step_frequency', 'N/A')},"
                        f"{m.get('duty_factor', 'N/A')},"
                        f"{m.get('double_support', 'N/A')},"
                        f"{m.get('avg_torso_angle', 'N/A')},"
                        f"{m.get('torso_stability', 'N/A')},"
                        f"{m.get('cost_of_transport', 'N/A')},"
                        f"{m.get('fitness', 'N/A')}\n")
    print(f"  Saved: {csv_path2}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="STRIDE Experiment 10 -- Gait Analysis (Table 6)")
    parser.add_argument(
        "--controllers", nargs="+", type=str, default=None,
        help="Controllers to analyze (default: all available)")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  STRIDE -- Gait Analysis (Experiment 10)")
    print("=" * 60)

    t0 = time.time()
    results = run_gait_analysis(args.controllers)

    if not results:
        print("\n  No results! Run GA experiments first.")
        return

    print_results_table(results)
    save_results(results)

    elapsed = time.time() - t0
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
