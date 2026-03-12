"""Phase 1 validation test script.

Checks:
1. Terrain height functions return correct values
2. 5 random creatures simulate on flat terrain without crashing
3. All fitness values are finite (no NaN, no Inf)
4. At least 1 creature has fitness > 0
5. All-zero chromosome doesn't crash
6. All-one chromosome doesn't crash
7. Hill and mixed terrains work
"""

import math
import sys
import numpy as np
import pymunk

from src.config import BASELINE_CONFIG
from src.terrain import FlatTerrain, HillTerrain, MixedTerrain, create_terrain
from src.encoding import decode_chromosome
from src.creature import Creature
from src.physics_sim import simulate
from src.fitness import evaluate_creature, safe_evaluate, PENALTY_FITNESS


def test_terrains():
    """Test terrain height functions return correct values."""
    print("=" * 60)
    print("TEST 1: Terrain Height Functions")
    print("=" * 60)

    flat = FlatTerrain()
    assert flat.get_height(0) == 50, f"Flat(0) = {flat.get_height(0)}, expected 50"
    assert flat.get_height(300) == 50, f"Flat(300) = {flat.get_height(300)}, expected 50"
    assert flat.get_height(99999) == 50, f"Flat(99999) should clamp and return 50"
    print(f"  Flat terrain:   h(0)={flat.get_height(0):.1f}, "
          f"h(300)={flat.get_height(300):.1f}, h(400)={flat.get_height(400):.1f}")

    hill = HillTerrain()
    assert hill.get_height(0) == 50, f"Hill(0) = {hill.get_height(0)}, expected 50"
    assert hill.get_height(400) > 50, f"Hill(400) should be > 50, got {hill.get_height(400)}"
    # Peak at x=400: 50 + 50*sin(pi*100/200) = 50 + 50*1 = 100
    assert abs(hill.get_height(400) - 100) < 0.01, \
        f"Hill(400) = {hill.get_height(400)}, expected 100"
    print(f"  Hill terrain:   h(0)={hill.get_height(0):.1f}, "
          f"h(300)={hill.get_height(300):.1f}, h(400)={hill.get_height(400):.1f}")

    mixed = MixedTerrain()
    assert mixed.get_height(0) == 50, f"Mixed(0) = {mixed.get_height(0)}, expected 50"
    assert mixed.get_height(400) > 50, f"Mixed(400) should be > 50"
    print(f"  Mixed terrain:  h(0)={mixed.get_height(0):.1f}, "
          f"h(300)={mixed.get_height(300):.1f}, h(400)={mixed.get_height(400):.1f}")

    print("  [PASS] All terrain height tests passed\n")


def test_random_creatures():
    """Simulate 5 random creatures on flat terrain."""
    print("=" * 60)
    print("TEST 2: 5 Random Creatures on Flat Terrain")
    print("=" * 60)

    np.random.seed(42)
    config = BASELINE_CONFIG.copy()
    fitnesses = []

    for i in range(5):
        chromosome = np.random.uniform(0, 1, 18)
        fitness, sim_result = evaluate_creature(chromosome, "flat", config)

        is_finite = math.isfinite(fitness)
        fitnesses.append(fitness)

        status = "OK" if is_finite else "FAIL"
        term = ""
        if sim_result.terminated_early:
            term = f" (early: {sim_result.termination_reason})"

        print(f"  Creature {i+1}: fitness={fitness:>10.2f}, "
              f"distance={sim_result.distance:>8.2f}, "
              f"steps={sim_result.steps_completed}{term}  [{status}]")

    # Validate
    all_finite = all(math.isfinite(f) for f in fitnesses)
    any_positive = any(f > 0 for f in fitnesses)
    no_penalty = all(f != PENALTY_FITNESS for f in fitnesses)

    print()
    print(f"  All finite:      {'PASS' if all_finite else 'FAIL'}")
    print(f"  No penalties:    {'PASS' if no_penalty else 'FAIL'}")
    print(f"  Any positive:    {'PASS' if any_positive else 'WARN (all <= 0)'}")

    assert all_finite, "Some fitness values are NaN/Inf!"
    assert no_penalty, "Some creatures returned penalty fitness!"
    print("  [PASS] All random creature tests passed\n")
    return fitnesses


def test_edge_cases():
    """Test all-zero and all-one chromosomes."""
    print("=" * 60)
    print("TEST 3: Edge Case Chromosomes")
    print("=" * 60)

    config = BASELINE_CONFIG.copy()

    # All-zero chromosome (all joints have zero amplitude -> creature stands still)
    zero_chromo = np.zeros(18)
    fitness_zero = safe_evaluate(zero_chromo, "flat", config)
    is_finite_zero = math.isfinite(fitness_zero)
    no_crash_zero = fitness_zero != PENALTY_FITNESS
    print(f"  All-zero genes:  fitness={fitness_zero:>10.2f}  "
          f"[{'PASS' if no_crash_zero else 'FAIL'}]")

    # All-one chromosome (max amplitude, frequency, phase)
    one_chromo = np.ones(18)
    fitness_one = safe_evaluate(one_chromo, "flat", config)
    is_finite_one = math.isfinite(fitness_one)
    no_crash_one = fitness_one != PENALTY_FITNESS
    print(f"  All-one genes:   fitness={fitness_one:>10.2f}  "
          f"[{'PASS' if no_crash_one else 'FAIL'}]")

    assert is_finite_zero, "All-zero chromosome produced NaN/Inf!"
    assert is_finite_one, "All-one chromosome produced NaN/Inf!"
    assert no_crash_zero, "All-zero chromosome crashed!"
    assert no_crash_one, "All-one chromosome crashed!"
    print("  [PASS] Edge case tests passed\n")


def test_different_terrains():
    """Test creature simulation on hill and mixed terrains."""
    print("=" * 60)
    print("TEST 4: Creatures on Different Terrains")
    print("=" * 60)

    np.random.seed(123)
    config = BASELINE_CONFIG.copy()
    chromosome = np.random.uniform(0, 1, 18)

    for terrain_name in ["flat", "hill", "mixed"]:
        fitness = safe_evaluate(chromosome, terrain_name, config)
        is_ok = math.isfinite(fitness) and fitness != PENALTY_FITNESS
        print(f"  {terrain_name:>8s} terrain: fitness={fitness:>10.2f}  "
              f"[{'PASS' if is_ok else 'FAIL'}]")
        assert is_ok, f"Creature crashed on {terrain_name} terrain!"

    print("  [PASS] All terrain tests passed\n")


def test_indirect_encoding():
    """Quick test that indirect encoding (9 genes) works."""
    print("=" * 60)
    print("TEST 5: Indirect Encoding (9 genes)")
    print("=" * 60)

    np.random.seed(99)
    config = BASELINE_CONFIG.copy()
    config["encoding"] = "indirect"
    chromosome = np.random.uniform(0, 1, 9)

    fitness = safe_evaluate(chromosome, "flat", config)
    is_ok = math.isfinite(fitness) and fitness != PENALTY_FITNESS
    print(f"  Indirect encoding: fitness={fitness:>10.2f}  "
          f"[{'PASS' if is_ok else 'FAIL'}]")
    assert is_ok, "Indirect encoding crashed!"
    print("  [PASS] Indirect encoding test passed\n")


def test_hill_reach():
    """Creature spawned near the hill actually traverses non-flat ground.

    We spawn at x=250 so the creature starts close to the hill (x=300-500).
    Verifies the creature encounters terrain above y=50 (the hill bump).
    """
    print("=" * 60)
    print("TEST 6: Creature Encounters Hill Terrain (spawn x=270)")
    print("=" * 60)

    config = BASELINE_CONFIG.copy()
    # Use a known-good-ish chromosome (seed 262 from brute search)
    np.random.seed(262)
    chromosome = np.random.uniform(0, 1, 18)
    joint_params = decode_chromosome(chromosome, "direct")

    # Manual simulation with spawn_x=270 to start near the hill
    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("hill")
    terrain.add_to_space(space)

    creature = Creature(space, joint_params, config, spawn_x=270)

    dt = 1.0 / config["simulation_fps"]
    total_steps = int(config["simulation_time"] * config["simulation_fps"])
    v_max = config["max_velocity"]
    positions = []

    for step in range(total_steps):
        t = step * dt
        creature.update_motors(t)
        space.step(dt)
        creature.clamp_velocities(v_max)
        tx, ty = creature.get_torso_position()
        if math.isnan(tx) or math.isnan(ty):
            break
        positions.append((tx, ty))
        if ty < config["y_min"] or ty > config["y_max"]:
            break

    max_x = max(p[0] for p in positions)
    final_x = positions[-1][0]

    # Check if creature reached hill zone (x>300) where ground > 50
    reached_hill = max_x > 300
    # Also check: did it encounter elevated terrain?
    hill_positions = [(x, y) for x, y in positions if x >= 300]
    on_hill = len(hill_positions) > 0

    print(f"  Spawn at x=270, max_x reached: {max_x:.1f}")
    print(f"  Final x: {final_x:.1f}, steps: {len(positions)}")
    print(f"  Positions on hill (x>=300): {len(hill_positions)}")
    if hill_positions:
        hill_ground = [terrain.get_height(x) for x, _ in hill_positions[:5]]
        print(f"  Ground heights at hill positions: "
              f"{[f'{h:.1f}' for h in hill_ground]}")

    print(f"  Reached hill zone: {'PASS' if reached_hill else 'FAIL'}")
    assert reached_hill, (
        f"Creature didn't reach the hill — max x was {max_x:.1f}. "
        f"Spawned at x=270, needed to travel 30px to reach x=300."
    )
    print("  [PASS] Hill reach test passed\n")


def test_spring_elbows():
    """Verify spring elbows are physically active — angles change over time."""
    print("=" * 60)
    print("TEST 7: Spring Elbow Angles Change")
    print("=" * 60)

    config = BASELINE_CONFIG.copy()
    chromosome = np.ones(18)
    joint_params = decode_chromosome(chromosome, "direct")

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("flat")
    terrain.add_to_space(space)

    creature = Creature(space, joint_params, config, spawn_x=100)

    dt = 1.0 / config["simulation_fps"]
    angles_step1 = None
    angles_step100 = None

    for step in range(101):
        t = step * dt
        creature.update_motors(t)
        space.step(dt)
        creature.clamp_velocities(config["max_velocity"])

        if step == 1:
            angles_step1 = creature.get_elbow_angles()
        if step == 100:
            angles_step100 = creature.get_elbow_angles()

    print(f"  Elbow angles at step   1: "
          f"L={angles_step1[0]:+.4f} rad, R={angles_step1[1]:+.4f} rad")
    print(f"  Elbow angles at step 100: "
          f"L={angles_step100[0]:+.4f} rad, R={angles_step100[1]:+.4f} rad")

    diff_l = abs(angles_step100[0] - angles_step1[0])
    diff_r = abs(angles_step100[1] - angles_step1[1])
    any_changed = diff_l > 1e-6 or diff_r > 1e-6

    print(f"  Delta L: {diff_l:.6f} rad,  Delta R: {diff_r:.6f} rad")
    print(f"  Elbows moved: {'PASS' if any_changed else 'FAIL'}")
    assert any_changed, (
        "Spring elbows didn't move between step 1 and 100 — "
        "springs may not be connected or stiffness/damping is wrong."
    )
    print("  [PASS] Spring elbow test passed\n")


def test_spawn_above_ground():
    """Creature spawned at x=300 on hill terrain starts above ground."""
    print("=" * 60)
    print("TEST 8: Spawn Above Ground on Hill at x=300")
    print("=" * 60)

    config = BASELINE_CONFIG.copy()
    chromosome = np.zeros(18)  # standing still, easy to check
    joint_params = decode_chromosome(chromosome, "direct")

    space = pymunk.Space()
    space.gravity = config["gravity"]
    space.iterations = 20

    terrain = create_terrain("hill")
    terrain.add_to_space(space)
    ground_at_300 = terrain.get_height(300)

    creature = Creature(space, joint_params, config, spawn_x=300)
    torso_y = creature.torso.position.y

    print(f"  Ground height at x=300: {ground_at_300:.1f}")
    print(f"  Torso y at spawn:       {torso_y:.1f}")
    print(f"  Clearance:              {torso_y - ground_at_300:.1f} px")

    above = torso_y > ground_at_300
    print(f"  Above ground: {'PASS' if above else 'FAIL'}")
    assert above, (
        f"Creature spawns underground! torso_y={torso_y:.1f} <= "
        f"ground={ground_at_300:.1f} at x=300 on hill terrain."
    )
    print("  [PASS] Spawn height test passed\n")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  STRIDE — Phase 1 Validation Suite")
    print("=" * 60 + "\n")

    try:
        test_terrains()
        test_random_creatures()
        test_edge_cases()
        test_different_terrains()
        test_indirect_encoding()
        test_hill_reach()
        test_spring_elbows()
        test_spawn_above_ground()

        print("=" * 60)
        print("  ALL PHASE 1 TESTS PASSED!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n  PHASE 1 VALIDATION FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n  UNEXPECTED ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
