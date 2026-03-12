"""Quick test: Can the creature stand upright with new feet + spawn height?

Tests zero-amplitude (standing still) and ideal walking chromosome.
"""

import math
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.encoding import decode_direct
from src.physics_sim import simulate
from src.fitness import compute_fitness
from src.creature import JOINT_NAMES


def test_standing():
    """Zero amplitude — creature should stand still and upright."""
    print("=" * 60)
    print("  TEST 1: Standing test (zero amplitude)")
    print("=" * 60)

    config = {**BASELINE_CONFIG}
    config["simulation_time"] = 5.0  # quick test

    # All zeros = zero amplitude, any freq/phase = no movement
    chromosome = np.zeros(18)
    params = decode_direct(chromosome)

    print(f"\n  Joint params (all zero amplitude):")
    for i, (amp, freq, phase) in enumerate(params):
        print(f"    {JOINT_NAMES[i]:<12} amp={amp:.3f} freq={freq:.3f}")

    sim = simulate(params, "flat", config)
    S = sim.steps_completed
    total = int(config["simulation_time"] * config["simulation_fps"])

    print(f"\n  Steps: {S}/{total}")
    print(f"  Terminated: {sim.terminated_early} ({sim.termination_reason})")

    if sim.torso_positions:
        pos = sim.torso_positions
        angles = sim.torso_angles

        # Sample positions over time
        checkpoints = [0, 10, 30, 60, 120, 299]
        print(f"\n  Position samples:")
        for c in checkpoints:
            if c < len(pos):
                x, y = pos[c]
                a = math.degrees(angles[c])
                print(f"    Step {c:>4}: x={x:.1f} y={y:.1f} angle={a:.1f} deg")

        # Final state
        fx, fy = pos[-1]
        fa = math.degrees(angles[-1])
        print(f"\n  Final: x={fx:.1f} y={fy:.1f} angle={fa:.1f} deg")
        print(f"  Distance: {sim.distance:.2f} px")

        # Check if standing
        avg_angle = sum(abs(a) for a in angles) / len(angles)
        print(f"  Avg |angle|: {math.degrees(avg_angle):.1f} deg")

        if abs(fa) < math.radians(10) and abs(sim.distance) < 20:
            print(f"\n  >>> STANDING TEST PASSED! Creature stays upright.")
            return True
        else:
            print(f"\n  >>> STANDING TEST FAILED. Creature toppled.")
            return False
    return False


def test_ideal_walking():
    """Hand-crafted ideal walking chromosome."""
    print("\n" + "=" * 60)
    print("  TEST 2: Ideal walking chromosome")
    print("=" * 60)

    config = {**BASELINE_CONFIG}

    # Create ideal walking chromosome
    genes = np.zeros(18)
    targets = [
        (0.8, 1.5, 0.0),                        # hip_L
        (0.8, 1.5, math.pi),                     # hip_R
        (0.4, 1.5, math.pi / 4),                 # knee_L
        (0.4, 1.5, math.pi + math.pi / 4),       # knee_R
        (0.3, 1.5, math.pi / 2),                 # shoulder_L
        (0.3, 1.5, 3 * math.pi / 2),             # shoulder_R
    ]
    for i, (amp, freq, phase) in enumerate(targets):
        genes[i * 3 + 0] = amp / (math.pi / 2)
        genes[i * 3 + 1] = (freq - 0.3) / 2.7
        genes[i * 3 + 2] = phase / (2 * math.pi)
    genes = np.clip(genes, 0.0, 1.0)

    params = decode_direct(genes)
    print(f"\n  Joint params:")
    for i, (amp, freq, phase) in enumerate(params):
        print(f"    {JOINT_NAMES[i]:<12} amp={amp:.3f} freq={freq:.3f} phase={math.degrees(phase):.1f}")

    sim = simulate(params, "flat", config)
    fitness = compute_fitness(sim, config, joint_params=params)
    S = sim.steps_completed
    total = int(config["simulation_time"] * config["simulation_fps"])

    print(f"\n  Steps: {S}/{total} ({S/total*100:.1f}%)")
    print(f"  Terminated: {sim.terminated_early} ({sim.termination_reason})")

    if sim.torso_positions:
        pos = sim.torso_positions
        angles = sim.torso_angles

        print(f"  Distance: {sim.distance:.2f} px")

        avg_y = sum(y for x, y in pos) / len(pos)
        avg_angle = sum(abs(a) for a in angles) / len(angles)
        print(f"  Avg Y: {avg_y:.1f}")
        print(f"  Avg |angle|: {math.degrees(avg_angle):.1f} deg")

        # Forward velocity
        forward = sum(1 for i in range(1, len(pos))
                      if pos[i][0] - pos[i - 1][0] > 0.1)
        print(f"  Forward frames: {forward}/{len(pos) - 1} ({forward / (len(pos) - 1) * 100:.1f}%)")

        if S > 0:
            avg_vx = sim.distance / (S / config["simulation_fps"])
            print(f"  Avg velocity: {avg_vx:.1f} px/s")

    print(f"  FITNESS: {fitness:.2f}")

    if fitness > 50:
        print(f"\n  >>> WALKING! fitness={fitness:.2f}")
    elif fitness > 10:
        print(f"\n  >>> MARGINAL. fitness={fitness:.2f}")
    else:
        print(f"\n  >>> NOT WALKING. fitness={fitness:.2f}")

    return fitness


if __name__ == "__main__":
    standing_ok = test_standing()
    ideal_fitness = test_ideal_walking()

    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"  Standing test: {'PASS' if standing_ok else 'FAIL'}")
    print(f"  Ideal walking fitness: {ideal_fitness:.2f}")
    if standing_ok and ideal_fitness > 10:
        print(f"\n  Physics foundation is WORKING — ready for GA validation")
    else:
        print(f"\n  Need more physics fixes")
    print("=" * 60)
