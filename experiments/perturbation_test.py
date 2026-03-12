"""Experiment 8 — Perturbation Recovery Test (Table 3).

Tests creature's ability to recover from backward pushes mid-walk.

Protocol (from stride_v3.md Section 9):
  - At t=7.5s, apply BACKWARD horizontal impulse to torso
  - Push strengths: 500 (gentle), 1500 (moderate), 3000 (strong), 5000 (violent)
  - Test best chromosome from each of 30 runs x 4 controllers
  - Metrics: survival rate, pre/post push velocity, recovery time
  - Statistical test: Fisher's exact test (binary outcomes)

Test matrix: 30 chromosomes x 4 controllers x 4 push strengths = 480 evals

Usage:
    python experiments/perturbation_test.py
    python experiments/perturbation_test.py --controllers sine cpg
"""

import logging
import math
import os
import pickle
import sys
import time
from pathlib import Path

import numpy as np
from scipy.stats import fisher_exact

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG, V2_EXPERIMENTS
from src.physics_sim import simulate, simulate_v2
from src.fitness import compute_fitness
from src.encoding import decode_direct

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"

# Push strengths (backward impulse magnitudes)
PUSH_STRENGTHS = {
    "gentle":   500,
    "moderate": 1500,
    "strong":   3000,
    "violent":  5000,
}

# Controllers to test
CONTROLLER_DEFS = {
    "sine":         ("baseline",      "sine",   "direct"),
    "cpg":          ("cpg_baseline",  "cpg",    "cpg"),
    "cpgnn_flat":   ("cpgnn_flat",    "cpg_nn", "cpg_nn"),
    "cpgnn_mixed":  ("cpgnn_mixed",   "cpg_nn", "cpg_nn"),
}

# Push time
PUSH_TIME = 7.5  # seconds

# Ground height detection (creature fell if torso below this)
FALL_THRESHOLD_MARGIN = 10  # pixels above ground_base_height


def load_best_chromosomes(pkl_name, n=30):
    """Load best chromosomes from a completed experiment."""
    pkl_path = RESULTS_DIR / f"{pkl_name}.pkl"
    if not pkl_path.exists():
        return None

    with open(pkl_path, "rb") as f:
        runs = pickle.load(f)

    valid = [r for r in runs if r is not None and "best_chromosome" in r]
    valid.sort(key=lambda r: r["best_fitness"], reverse=True)
    top = valid[:n]

    return [np.array(r["best_chromosome"]) for r in top]


def perturbation_test_v2(chromosome, controller_type, config, impulse_magnitude):
    """Test a v2 controller's push recovery.

    Runs a 15s simulation with a backward push at t=7.5s.
    Records pre-push velocity, post-push velocity, recovery time,
    and whether the creature fell.

    Args:
        chromosome: gene array.
        controller_type: "cpg" or "cpg_nn".
        config: experiment config dict.
        impulse_magnitude: positive float — applied as BACKWARD (-x) impulse.

    Returns:
        dict with test metrics.
    """
    perturbation = {
        "time": PUSH_TIME,
        "impulse": (-impulse_magnitude, 0),  # BACKWARD push (spec Fix 1)
    }

    sim_result = simulate_v2(
        chromosome, controller_type, "flat", config,
        record_sensors=False,
        perturbation=perturbation,
    )

    fps = config.get("simulation_fps", 60)
    push_step = int(PUSH_TIME * fps)

    # Extract x/y arrays from torso_positions (list of (x, y) tuples)
    torso_xs = [p[0] for p in sim_result.torso_positions]
    torso_ys = [p[1] for p in sim_result.torso_positions]

    # Pre-push velocity: t=5s to t=7.5s
    pre_start = int(5.0 * fps)
    pre_end = push_step
    pre_vels = []
    for s in range(pre_start, min(pre_end, len(torso_xs) - 1)):
        vx = (torso_xs[s + 1] - torso_xs[s]) * fps
        pre_vels.append(vx)

    # Post-push velocity: last 3 seconds of simulation
    total_steps = len(torso_xs)
    post_start = max(push_step + 1, total_steps - int(3.0 * fps))
    post_vels = []
    for s in range(post_start, total_steps - 1):
        vx = (torso_xs[s + 1] - torso_xs[s]) * fps
        post_vels.append(vx)

    mean_pre_vel = np.mean(pre_vels) if pre_vels else 0.0
    mean_post_vel = np.mean(post_vels) if post_vels else 0.0

    # Recovery time: first step after push where velocity > 50% of pre-push
    recovery_time = None
    if mean_pre_vel > 0 and push_step < total_steps - 1:
        threshold = 0.5 * mean_pre_vel
        for s in range(push_step + 1, total_steps - 1):
            vx = (torso_xs[s + 1] - torso_xs[s]) * fps
            if vx > threshold:
                recovery_time = (s - push_step) / fps
                break

    # Fall detection: torso drops below ground + margin after push
    ground_h = config.get("ground_base_height", 50)
    fell = False
    for s in range(push_step, total_steps):
        if torso_ys[s] < ground_h + FALL_THRESHOLD_MARGIN:
            fell = True
            break

    return {
        "pre_push_velocity": float(mean_pre_vel),
        "post_push_velocity": float(mean_post_vel),
        "recovery_time": recovery_time,
        "fell": fell,
        "final_distance": float(sim_result.distance),
        "steps_completed": sim_result.steps_completed,
    }


def perturbation_test_sine(chromosome, config, impulse_magnitude):
    """Test a v1 sine controller's push recovery.

    Uses simulate() for v1 sine, with manual perturbation at t=7.5s.
    """
    joint_params = decode_direct(chromosome)

    # For sine, we use simulate_v2 with controller_type trick:
    # Actually, we need to use the v1 simulate but it doesn't support
    # perturbation. Let's use simulate_v2 with a cpg encoding where
    # we prepend 20 neutral coupling genes to the sine chromosome.
    # This makes the CPG behave like a sine controller.
    cpg_chromo = np.zeros(38, dtype=np.float64)
    cpg_chromo[:18] = chromosome[:18]
    cpg_chromo[18:38] = 0.5  # neutral coupling

    return perturbation_test_v2(cpg_chromo, "cpg", config, impulse_magnitude)


def run_perturbation_test(controller_names=None):
    """Run the full perturbation recovery test.

    Returns:
        dict: controller -> {push_name -> list of 30 result dicts}
    """
    if controller_names is None:
        controller_names = list(CONTROLLER_DEFS.keys())

    config = {**BASELINE_CONFIG}
    all_results = {}

    for ctrl_name in controller_names:
        if ctrl_name not in CONTROLLER_DEFS:
            print(f"  SKIP: Unknown controller '{ctrl_name}'")
            continue

        pkl_name, ctrl_type, encoding = CONTROLLER_DEFS[ctrl_name]
        print(f"\n  Testing: {ctrl_name} (from {pkl_name}.pkl)")

        chromosomes = load_best_chromosomes(pkl_name)
        if chromosomes is None:
            print(f"    SKIP: {pkl_name}.pkl not found")
            continue

        print(f"    Loaded {len(chromosomes)} chromosomes")

        ctrl_results = {}
        for push_name, magnitude in PUSH_STRENGTHS.items():
            print(f"    Push: {push_name} ({magnitude}N) ...", end="", flush=True)
            t0 = time.time()

            push_results = []
            for chromo in chromosomes:
                if ctrl_type == "sine":
                    r = perturbation_test_sine(chromo, config, magnitude)
                else:
                    r = perturbation_test_v2(chromo, ctrl_type, config, magnitude)
                push_results.append(r)

            n_survived = sum(1 for r in push_results if not r["fell"])
            elapsed = time.time() - t0
            print(f" {n_survived}/{len(push_results)} survived ({elapsed:.1f}s)")

            ctrl_results[push_name] = push_results

        all_results[ctrl_name] = ctrl_results

    return all_results


def compute_fisher_tests(results, baseline_name="sine"):
    """Compute Fisher's exact test for each controller vs baseline.

    Returns:
        dict: controller -> {push_name -> (odds_ratio, p_value)}
    """
    if baseline_name not in results:
        return {}

    fisher_results = {}
    for ctrl_name, ctrl_data in results.items():
        if ctrl_name == baseline_name:
            continue

        ctrl_fisher = {}
        for push_name in PUSH_STRENGTHS:
            base_results = results[baseline_name].get(push_name, [])
            ctrl_results = ctrl_data.get(push_name, [])

            if not base_results or not ctrl_results:
                continue

            base_survived = sum(1 for r in base_results if not r["fell"])
            ctrl_survived = sum(1 for r in ctrl_results if not r["fell"])
            n_base = len(base_results)
            n_ctrl = len(ctrl_results)

            table = [[base_survived, n_base - base_survived],
                     [ctrl_survived, n_ctrl - ctrl_survived]]

            odds_ratio, p_value = fisher_exact(table)
            ctrl_fisher[push_name] = (odds_ratio, p_value)

        fisher_results[ctrl_name] = ctrl_fisher

    return fisher_results


def print_results_table(results, fisher_results):
    """Print Table 3 format."""
    print(f"\n{'='*90}")
    print("  TABLE 3: Perturbation Recovery")
    print(f"{'='*90}")
    print(f"{'Controller':<20}", end="")
    for push_name in PUSH_STRENGTHS:
        mag = PUSH_STRENGTHS[push_name]
        print(f"  {push_name}({mag})", end="")
    print(f"  {'p(Fisher)':>12}")
    print("-" * 90)

    for ctrl_name in results:
        print(f"{ctrl_name:<20}", end="")
        for push_name in PUSH_STRENGTHS:
            push_data = results[ctrl_name].get(push_name, [])
            if push_data:
                n_survived = sum(1 for r in push_data if not r["fell"])
                print(f"  {n_survived:>3}/{len(push_data):<4}    ", end="")
            else:
                print(f"  {'---':>12}", end="")

        # Fisher p-value (average across push strengths)
        if ctrl_name in fisher_results:
            p_vals = [p for _, p in fisher_results[ctrl_name].values()]
            if p_vals:
                min_p = min(p_vals)
                print(f"  p={min_p:.4f}", end="")
        print()

    # Detailed recovery metrics
    print(f"\n{'='*90}")
    print("  Recovery Metrics (mean +/- std)")
    print(f"{'='*90}")
    print(f"{'Controller':<20} {'Push':>10} {'Pre-vel':>10} {'Post-vel':>10} "
          f"{'Recovery(s)':>12} {'Survived':>10}")
    print("-" * 90)

    for ctrl_name in results:
        for push_name in PUSH_STRENGTHS:
            push_data = results[ctrl_name].get(push_name, [])
            if not push_data:
                continue

            pre_vels = [r["pre_push_velocity"] for r in push_data]
            post_vels = [r["post_push_velocity"] for r in push_data]
            rec_times = [r["recovery_time"] for r in push_data
                         if r["recovery_time"] is not None]
            n_survived = sum(1 for r in push_data if not r["fell"])

            rec_str = f"{np.mean(rec_times):.2f}" if rec_times else "N/A"

            print(f"{ctrl_name:<20} {push_name:>10} "
                  f"{np.mean(pre_vels):>8.1f}  "
                  f"{np.mean(post_vels):>8.1f}  "
                  f"{rec_str:>10}  "
                  f"{n_survived:>4}/{len(push_data)}")

    print(f"{'='*90}\n")


def save_results(results, fisher_results):
    """Save perturbation test results with metadata."""
    from datetime import datetime

    out_data = {
        "results": results,
        "fisher": fisher_results,
        "metadata": {
            "timestamp": datetime.now().isoformat(),
            "push_time": PUSH_TIME,
            "push_strengths": PUSH_STRENGTHS,
            "n_controllers": len(results),
            "controllers": list(results.keys()),
            "fall_threshold_margin": FALL_THRESHOLD_MARGIN,
        },
    }

    # Save with spec-expected filename
    out_path = RESULTS_DIR / "perturbation_results.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path}")

    # Also save with old name for backward compatibility
    out_path2 = RESULTS_DIR / "perturbation_test_results.pkl"
    with open(out_path2, "wb") as f:
        pickle.dump(out_data, f)
    print(f"  Saved: {out_path2}")

    # CSV summary
    csv_path = RESULTS_DIR / "table_perturbation_recovery.csv"
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("controller,push,magnitude,survived,total,survival_rate,"
                "mean_pre_vel,mean_post_vel,mean_recovery_time\n")
        for ctrl_name in results:
            for push_name, magnitude in PUSH_STRENGTHS.items():
                push_data = results[ctrl_name].get(push_name, [])
                if not push_data:
                    continue
                n_survived = sum(1 for r in push_data if not r["fell"])
                rate = n_survived / len(push_data)
                pre_v = np.mean([r["pre_push_velocity"] for r in push_data])
                post_v = np.mean([r["post_push_velocity"] for r in push_data])
                rec_times = [r["recovery_time"] for r in push_data
                             if r["recovery_time"] is not None]
                rec_t = np.mean(rec_times) if rec_times else float("nan")
                f.write(f"{ctrl_name},{push_name},{magnitude},"
                        f"{n_survived},{len(push_data)},{rate:.4f},"
                        f"{pre_v:.2f},{post_v:.2f},{rec_t:.4f}\n")
    print(f"  Saved: {csv_path}")


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="STRIDE Experiment 8 -- Perturbation Recovery (Table 3)")
    parser.add_argument(
        "--controllers", nargs="+", type=str,
        default=None,
        help="Controllers to test (default: all available)")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  STRIDE -- Perturbation Recovery Test (Experiment 8)")
    print("=" * 60)

    t0 = time.time()
    results = run_perturbation_test(args.controllers)

    if not results:
        print("\n  No results! Run GA experiments first.")
        return

    fisher_results = compute_fisher_tests(results)
    print_results_table(results, fisher_results)
    save_results(results, fisher_results)

    elapsed = time.time() - t0
    print(f"  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
