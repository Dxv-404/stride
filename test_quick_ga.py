"""Quick GA test to see if evolution can produce walking."""

import time
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.ga_core import run_ga
from src.encoding import decode_direct
from src.physics_sim import simulate
from src.fitness import compute_fitness
from src.creature import JOINT_NAMES
import math


def main():
    config = {**BASELINE_CONFIG}
    config["population_size"] = 40
    config["max_generations"] = 50

    print("=" * 60)
    print("  Quick GA Test (pop=40, gen=50)")
    print("=" * 60)

    t0 = time.time()
    result = run_ga(config, seed=42)
    elapsed = time.time() - t0
    print(f"\n  Completed in {elapsed:.1f}s")
    print(f"  Best fitness: {result['best_fitness']:.2f}")

    # Show convergence
    conv = result.get("convergence_history", result.get("best_fitness_per_gen", []))
    if conv:
        checkpoints = [0, 9, 19, 29, 39, 49]
        print("\n  Convergence:")
        for g in checkpoints:
            if g < len(conv):
                print(f"    Gen {g + 1:>3}: {conv[g]:.2f}")

    # Analyze best chromosome
    best = result["best_chromosome"]
    params = decode_direct(best)
    print(f"\n  Best chromosome joint params:")
    for i, (amp, freq, phase) in enumerate(params):
        print(f"    {JOINT_NAMES[i]:<12} amp={amp:.3f} freq={freq:.3f} phase={math.degrees(phase):.1f}")

    # Gait analysis
    hip_L_phase = params[0][2]
    hip_R_phase = params[1][2]
    phase_diff = abs(hip_L_phase - hip_R_phase) % (2 * math.pi)
    if phase_diff > math.pi:
        phase_diff = 2 * math.pi - phase_diff
    print(f"\n  Hip L-R phase diff: {math.degrees(phase_diff):.1f} deg (ideal=180)")

    # Full sim analysis
    sim = simulate(params, "flat", config)
    fitness = compute_fitness(sim, config, joint_params=params)

    S = sim.steps_completed
    total = int(config["simulation_time"] * config["simulation_fps"])
    print(f"\n  Steps: {S}/{total} ({S / total * 100:.1f}%)")
    print(f"  Distance: {sim.distance:.2f} px")

    if sim.torso_positions:
        pos = sim.torso_positions
        angles = sim.torso_angles
        avg_y = sum(y for x, y in pos) / len(pos)
        avg_angle = sum(abs(a) for a in angles) / len(angles)
        print(f"  Avg Y: {avg_y:.1f}")
        print(f"  Avg |angle|: {math.degrees(avg_angle):.1f} deg")
        forward = sum(1 for i in range(1, len(pos)) if pos[i][0] - pos[i - 1][0] > 0.1)
        print(f"  Forward frames: {forward}/{len(pos) - 1} ({forward / (len(pos) - 1) * 100:.1f}%)")
        if S > 0:
            avg_vx = sim.distance / (S / config["simulation_fps"])
            print(f"  Avg velocity: {avg_vx:.1f} px/s")

    print(f"\n  FITNESS: {fitness:.2f}")

    if fitness > 100:
        print(f"\n  >>> GA PRODUCING WALKING CREATURES!")
    elif fitness > 50:
        print(f"\n  >>> MODERATE WALKING — promising with more generations")
    elif fitness > 20:
        print(f"\n  >>> MARGINAL — some forward movement")
    else:
        print(f"\n  >>> POOR — needs more physics tuning")

    print("=" * 60)


if __name__ == "__main__":
    main()
