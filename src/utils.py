"""Helper functions, error handling, and safe simulation wrapper.

Provides safe_simulate() which wraps the full evaluate pipeline with
exception handling, NaN/Inf detection, and physics explosion guards.
"""

import math
import os
import logging
import pickle

import numpy as np

from src.fitness import evaluate_creature, evaluate_creature_v2, PENALTY_FITNESS
from src.config import BASELINE_CONFIG

logger = logging.getLogger(__name__)


def safe_simulate(chromosome, terrain_type, config):
    """Run simulation with comprehensive error handling.

    This is the primary entry point for GA fitness evaluation.
    Always returns a finite float — never raises.

    Args:
        chromosome: numpy array of normalized [0,1] gene values.
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: dict with all parameters.

    Returns:
        float — fitness value, or PENALTY_FITNESS on any failure.
    """
    try:
        fitness, sim_result = evaluate_creature(chromosome, terrain_type, config)

        # Check for NaN/Inf
        if math.isnan(fitness) or math.isinf(fitness):
            logger.warning("NaN/Inf fitness detected, assigning penalty")
            return PENALTY_FITNESS

        # Check for unreasonably large fitness (physics explosion)
        if abs(fitness) > 100000:
            logger.warning(
                f"Unreasonable fitness {fitness:.2f}, likely physics explosion")
            return PENALTY_FITNESS

        return fitness

    except Exception as e:
        logger.error(f"Simulation crashed: {type(e).__name__}: {e}")
        return PENALTY_FITNESS


def safe_simulate_v2(chromosome, controller_type, terrain_type, config):
    """V2 safe simulation wrapper for CPG and CPG+NN controllers.

    Same pattern as safe_simulate() — wraps evaluate_creature_v2 with
    NaN/Inf/explosion guards and exception handling.

    Args:
        chromosome: numpy array of [0,1] gene values (38 or 96).
        controller_type: "cpg" or "cpg_nn".
        terrain_type: str — "flat", "hill", "mixed", "gap".
        config: dict with all parameters.

    Returns:
        float — fitness value, or PENALTY_FITNESS on any failure.
    """
    try:
        fitness, sim_result = evaluate_creature_v2(
            chromosome, controller_type, terrain_type, config)

        if math.isnan(fitness) or math.isinf(fitness):
            logger.warning("NaN/Inf fitness in v2 simulation, assigning penalty")
            return PENALTY_FITNESS

        if abs(fitness) > 100000:
            logger.warning(
                f"Unreasonable v2 fitness {fitness:.2f}, likely physics explosion")
            return PENALTY_FITNESS

        return fitness

    except Exception as e:
        logger.error(f"V2 simulation crashed: {type(e).__name__}: {e}")
        return PENALTY_FITNESS


def load_checkpoint_safe(filepath):
    """Load a pickle checkpoint with corruption recovery.

    Tries the main file first, then a .bak backup.
    Returns an empty list on total failure.
    """
    try:
        with open(filepath, "rb") as f:
            return pickle.load(f)
    except (pickle.UnpicklingError, EOFError, Exception) as e:
        logger.error(f"Checkpoint corrupted: {e}. Trying backup.")
        backup = filepath + ".bak"
        if os.path.exists(backup):
            try:
                with open(backup, "rb") as f:
                    return pickle.load(f)
            except Exception:
                pass
        logger.error("Backup also failed. Starting fresh.")
        return []


def save_checkpoint(data, filepath):
    """Save checkpoint with backup rotation.

    Writes to a .tmp file first, then renames.
    Keeps previous checkpoint as .bak.
    Uses retries to handle Windows file locking (antivirus, indexers).
    """
    import time as _time

    tmp_path = filepath + ".tmp"
    bak_path = filepath + ".bak"

    with open(tmp_path, "wb") as f:
        pickle.dump(data, f)

    # Rotate with retries for Windows file locking
    for attempt in range(5):
        try:
            if os.path.exists(filepath):
                # os.replace is atomic even on Windows
                if os.path.exists(bak_path):
                    os.remove(bak_path)
                os.rename(filepath, bak_path)
            os.rename(tmp_path, filepath)
            return  # Success
        except PermissionError:
            if attempt < 4:
                _time.sleep(0.2 * (attempt + 1))
            else:
                # Last resort: just overwrite directly
                try:
                    os.replace(tmp_path, filepath)
                except Exception:
                    logger.error(f"Failed to save checkpoint after 5 retries: {filepath}")
                    raise


def validate_setup():
    """Quick sanity check before running experiments.

    Tests pymunk, creature simulation, edge cases, and terrains.
    Raises AssertionError on failure.
    """
    import pymunk

    print("Validating setup...")

    # 1. Test pymunk basics
    space = pymunk.Space()
    space.gravity = (0, -981)
    body = pymunk.Body(1, 1)
    body.position = (100, 200)
    space.add(body)
    for _ in range(100):
        space.step(1 / 60)
    assert not math.isnan(body.position.y), "Pymunk NaN detected"
    print("  [OK] Pymunk working")

    # 2. Test creature simulation
    chromosome = np.random.uniform(0, 1, 18)
    fitness = safe_simulate(chromosome, "flat", BASELINE_CONFIG)
    assert fitness != PENALTY_FITNESS, "Random creature crashed"
    assert not math.isnan(fitness), "NaN fitness"
    print(f"  [OK] Creature simulation working (fitness={fitness:.2f})")

    # 3. Test edge cases
    zero_chromo = np.zeros(18)
    f_zero = safe_simulate(zero_chromo, "flat", BASELINE_CONFIG)
    assert f_zero != PENALTY_FITNESS, "Zero chromosome crashed"
    print(f"  [OK] Zero chromosome handled (fitness={f_zero:.2f})")

    one_chromo = np.ones(18)
    f_one = safe_simulate(one_chromo, "flat", BASELINE_CONFIG)
    assert f_one != PENALTY_FITNESS, "Ones chromosome crashed"
    print(f"  [OK] Ones chromosome handled (fitness={f_one:.2f})")

    # 4. Test terrains
    from src.terrain import FlatTerrain, HillTerrain, MixedTerrain
    assert FlatTerrain().get_height(0) == 50
    assert FlatTerrain().get_height(99999) == 50
    assert HillTerrain().get_height(400) > 50
    print("  [OK] Terrains working")

    print("All validations passed!")
