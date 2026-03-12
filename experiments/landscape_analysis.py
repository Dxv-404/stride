"""Experiment 9-12 — Fitness Landscape Analysis (Table 5).

Three sub-analyses:
  a) Fitness Distance Correlation (FDC) — Jones & Forrest (1995)
  b) Epistasis Matrix (sine only, 18 genes)
  c) Gene Sensitivity (sine 18 + CPG 38 genes)

Protocol (from stride_v3.md Section 10):
  - FDC: 2000 random chromosomes, 30 best as reference, 5-sec sims
  - Epistasis: 5 reference points, delta=0.05, C(18,2)=153 pairs
  - Sensitivity: 5 reference points, delta=0.10 (different from epistasis!)

Additions over spec:
  - Checkpointing after each sub-analysis (epistasis is ~70 min)
  - Fixed seeds for reproducibility
  - 5-sec vs 15-sec validation for FDC (Spearman rho)
  - Metadata in output pkl

Usage:
    python experiments/landscape_analysis.py
    python experiments/landscape_analysis.py --skip-epistasis
    python experiments/landscape_analysis.py --resume  # resume from checkpoint
"""

import argparse
import logging
import math
import os
import pickle
import sys
import time
from datetime import datetime
from itertools import combinations
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import BASELINE_CONFIG
from src.fitness import evaluate_creature, evaluate_creature_v2, PENALTY_FITNESS
from src.encoding import decode_direct

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
CHECKPOINT_PATH = RESULTS_DIR / "landscape_checkpoint.pkl"

# Fixed seed for reproducibility
RNG_SEED = 42


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

    return [np.array(r["best_chromosome"]) for r in top]


def make_evaluate_fn(controller_type, terrain, config, sim_duration=5.0):
    """Create an evaluation function for the given controller type.

    Uses 5-second sims by default for speed (landscape has many evals).
    """
    short_config = {**config, "simulation_duration": sim_duration}

    def evaluate(chromosome):
        try:
            if controller_type == "sine":
                joint_params = decode_direct(chromosome)
                from src.physics_sim import simulate
                from src.fitness import compute_fitness
                sim_result = simulate(joint_params, terrain, short_config)
                fitness = compute_fitness(sim_result, short_config)
            else:
                fitness, _ = evaluate_creature_v2(
                    chromosome, controller_type, terrain, short_config)

            if math.isnan(fitness) or math.isinf(fitness):
                return PENALTY_FITNESS
            return fitness
        except Exception:
            return PENALTY_FITNESS

    return evaluate


# =========================================================================
# FDC — Fitness Distance Correlation
# =========================================================================

def compute_fdc_robust(evaluate_fn, best_chromosomes, n_samples=2000,
                       n_genes=18, rng=None):
    """Compute FDC relative to multiple reference points.

    FDC < -0.15: funneling (good for GAs)
    FDC ~ 0: neutral
    FDC > 0.15: deceptive (bad for GAs)

    Uses 30 best chromosomes as reference points for robustness.
    """
    if rng is None:
        rng = np.random.default_rng(RNG_SEED)

    print(f"    Generating {n_samples} random chromosomes ({n_genes} genes)...")
    random_chromosomes = [rng.uniform(0, 1, n_genes) for _ in range(n_samples)]

    print(f"    Evaluating {n_samples} random chromosomes...")
    t0 = time.time()
    fitnesses = []
    for i, c in enumerate(random_chromosomes):
        f = evaluate_fn(c)
        fitnesses.append(f)
        if (i + 1) % 500 == 0:
            elapsed = time.time() - t0
            print(f"      {i+1}/{n_samples} done ({elapsed:.0f}s)")

    fitnesses = np.array(fitnesses)
    elapsed = time.time() - t0
    print(f"    All {n_samples} evaluated in {elapsed:.0f}s")

    # Compute FDC to each reference
    n_refs = min(len(best_chromosomes), 30)
    fdc_values = []
    for ref in best_chromosomes[:n_refs]:
        distances = np.array([np.linalg.norm(c - ref) for c in random_chromosomes])
        # Pearson correlation
        fdc = np.corrcoef(fitnesses, distances)[0, 1]
        if not np.isnan(fdc):
            fdc_values.append(fdc)

    result = {
        "mean_fdc": float(np.mean(fdc_values)),
        "std_fdc": float(np.std(fdc_values)),
        "min_fdc": float(np.min(fdc_values)),
        "max_fdc": float(np.max(fdc_values)),
        "all_fdc": [float(f) for f in fdc_values],
        "n_samples": n_samples,
        "n_refs": n_refs,
        # Store scatter data for plotting
        "scatter_fitnesses": fitnesses.tolist(),
        "scatter_distances": [float(np.linalg.norm(c - best_chromosomes[0]))
                              for c in random_chromosomes],
    }

    interpretation = "funneling" if result["mean_fdc"] < -0.15 else \
                     "deceptive" if result["mean_fdc"] > 0.15 else "neutral"
    print(f"    FDC = {result['mean_fdc']:.4f} +/- {result['std_fdc']:.4f} "
          f"({interpretation})")

    return result


def validate_fdc_duration(evaluate_fn_5s, evaluate_fn_15s, n_genes, n_check=100,
                          rng=None):
    """Validate that 5-sec FDC is consistent with 15-sec FDC.

    Spec requirement: Spearman rho > 0.9, otherwise note in Threats.
    """
    if rng is None:
        rng = np.random.default_rng(RNG_SEED + 100)

    random_chromos = [rng.uniform(0, 1, n_genes) for _ in range(n_check)]

    print(f"    Validating 5s vs 15s on {n_check} random chromosomes...")
    fits_5s = [evaluate_fn_5s(c) for c in random_chromos]
    fits_15s = [evaluate_fn_15s(c) for c in random_chromos]

    rho, p_value = spearmanr(fits_5s, fits_15s)
    print(f"    Spearman rho (5s vs 15s) = {rho:.4f} (p={p_value:.6f})")

    if rho < 0.9:
        print("    WARNING: Low correlation between 5s and 15s sims!")
        print("    -> Note in Threats to Validity")

    return {"rho": float(rho), "p_value": float(p_value)}


# =========================================================================
# Epistasis
# =========================================================================

def compute_epistasis_single(evaluate_fn, reference, n_genes, delta=0.05):
    """Compute epistasis matrix at a single reference point.

    Epistasis(i,j) = f(ref + d_i + d_j) - f(ref + d_i) - f(ref + d_j) + f(ref)
    """
    f_ref = evaluate_fn(reference)
    matrix = np.zeros((n_genes, n_genes))

    # Single-gene perturbations
    f_single = []
    for i in range(n_genes):
        x_plus = reference.copy()
        x_plus[i] = min(1.0, reference[i] + delta)
        f_single.append(evaluate_fn(x_plus))

    # Pairwise perturbations
    for i, j in combinations(range(n_genes), 2):
        x_both = reference.copy()
        x_both[i] = min(1.0, reference[i] + delta)
        x_both[j] = min(1.0, reference[j] + delta)
        f_both = evaluate_fn(x_both)

        epi = f_both - f_single[i] - f_single[j] + f_ref
        matrix[i, j] = epi
        matrix[j, i] = epi

    return matrix


def compute_epistasis_robust(evaluate_fn, best_chromosomes, n_genes=18,
                             delta=0.05, n_refs=5):
    """Epistasis at multiple reference points with consistency metric.

    Consistency = |mean| / (std + eps) — values > 3 indicate robust epistasis.
    """
    matrices = []
    for k, ref in enumerate(best_chromosomes[:n_refs]):
        print(f"      Reference {k+1}/{n_refs}...", end="", flush=True)
        t0 = time.time()
        matrix = compute_epistasis_single(evaluate_fn, ref, n_genes, delta)
        elapsed = time.time() - t0
        print(f" done ({elapsed:.0f}s)")
        matrices.append(matrix)

    mean_matrix = np.mean(matrices, axis=0)
    std_matrix = np.std(matrices, axis=0)
    eps = 1e-8
    consistency = np.where(np.abs(mean_matrix) > 1e-6,
                           np.abs(mean_matrix) / (std_matrix + eps), 0)

    return {
        "mean_matrix": mean_matrix.tolist(),
        "std_matrix": std_matrix.tolist(),
        "consistency_matrix": consistency.tolist(),
        "n_refs": n_refs,
        "delta": delta,
        "n_genes": n_genes,
    }


# =========================================================================
# Gene Sensitivity
# =========================================================================

def compute_gene_sensitivity(evaluate_fn, reference, n_genes=18, delta=0.10):
    """Central difference approximation of fitness gradient per gene.

    IMPORTANT: Uses delta=0.10, different from epistasis (delta=0.05).
    Cannot reuse epistasis data.
    """
    sensitivities = []
    for i in range(n_genes):
        x_plus = reference.copy()
        x_minus = reference.copy()
        x_plus[i] = min(1.0, reference[i] + delta)
        x_minus[i] = max(0.0, reference[i] - delta)
        f_plus = evaluate_fn(x_plus)
        f_minus = evaluate_fn(x_minus)
        sensitivity = abs(f_plus - f_minus) / (2 * delta)
        sensitivities.append(sensitivity)
    return sensitivities


def compute_gene_sensitivity_robust(evaluate_fn, best_chromosomes, n_genes=18,
                                    delta=0.10, n_refs=5):
    """Gene sensitivity at multiple reference points."""
    all_sensitivities = []
    for k, ref in enumerate(best_chromosomes[:n_refs]):
        print(f"      Reference {k+1}/{n_refs}...", end="", flush=True)
        t0 = time.time()
        sens = compute_gene_sensitivity(evaluate_fn, ref, n_genes, delta)
        elapsed = time.time() - t0
        print(f" done ({elapsed:.0f}s)")
        all_sensitivities.append(sens)

    mean_sens = np.mean(all_sensitivities, axis=0).tolist()
    std_sens = np.std(all_sensitivities, axis=0).tolist()

    return {
        "mean_sensitivity": mean_sens,
        "std_sensitivity": std_sens,
        "all_sensitivities": [s for s in all_sensitivities],
        "n_refs": n_refs,
        "delta": delta,
        "n_genes": n_genes,
    }


# =========================================================================
# Checkpointing
# =========================================================================

def save_checkpoint(results, stage):
    """Save intermediate results for crash recovery."""
    checkpoint = {"results": results, "stage": stage,
                  "timestamp": datetime.now().isoformat()}
    with open(CHECKPOINT_PATH, "wb") as f:
        pickle.dump(checkpoint, f)
    print(f"  [Checkpoint saved: stage={stage}]")


def load_checkpoint():
    """Load checkpoint if it exists."""
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH, "rb") as f:
            checkpoint = pickle.load(f)
        print(f"  [Checkpoint loaded: stage={checkpoint['stage']}, "
              f"time={checkpoint['timestamp']}]")
        return checkpoint
    return None


# =========================================================================
# Main
# =========================================================================

def run_landscape_analysis(skip_epistasis=False, resume=False):
    """Run complete fitness landscape analysis."""
    rng = np.random.default_rng(RNG_SEED)
    config = {**BASELINE_CONFIG}

    results = {}
    start_stage = 0

    # Resume from checkpoint?
    if resume:
        checkpoint = load_checkpoint()
        if checkpoint:
            results = checkpoint["results"]
            start_stage = checkpoint["stage"] + 1
            print(f"  Resuming from stage {start_stage}")

    # Load best chromosomes
    sine_best = load_best_chromosomes("baseline")
    cpg_best = load_best_chromosomes("cpg_baseline")

    if sine_best is None:
        print("  ERROR: baseline.pkl not found!")
        return None

    # Stage 0: FDC for sine (18 genes)
    if start_stage <= 0:
        print("\n  [Stage 0] FDC — Sine Controller (18 genes)")
        eval_sine_5s = make_evaluate_fn("sine", "flat", config, sim_duration=5.0)
        eval_sine_15s = make_evaluate_fn("sine", "flat", config, sim_duration=15.0)

        # Validate 5s vs 15s
        fdc_validation = validate_fdc_duration(
            eval_sine_5s, eval_sine_15s, 18, n_check=100, rng=rng)
        results["fdc_validation_sine"] = fdc_validation

        # Compute FDC
        fdc_sine = compute_fdc_robust(
            eval_sine_5s, sine_best, n_samples=2000, n_genes=18, rng=rng)
        results["fdc_sine"] = fdc_sine
        save_checkpoint(results, 0)

    # Stage 1: FDC for CPG+NN (96 genes) — if data available
    if start_stage <= 1:
        cpgnn_best = load_best_chromosomes("cpgnn_flat")
        if cpgnn_best is not None:
            print("\n  [Stage 1] FDC — CPG+NN Controller (96 genes)")
            eval_cpgnn_5s = make_evaluate_fn("cpg_nn", "flat", config,
                                             sim_duration=5.0)

            fdc_cpgnn = compute_fdc_robust(
                eval_cpgnn_5s, cpgnn_best, n_samples=2000, n_genes=96, rng=rng)
            results["fdc_cpgnn"] = fdc_cpgnn
            save_checkpoint(results, 1)
        else:
            print("\n  [Stage 1] SKIP FDC CPG+NN: no cpgnn_flat.pkl")

    # Stage 2: Epistasis (sine only, 18 genes)
    if start_stage <= 2 and not skip_epistasis:
        print("\n  [Stage 2] Epistasis — Sine Controller (18 genes)")
        print(f"    C(18,2) = 153 pairs x 5 refs = ~860 evals (~70 min)")
        eval_sine_5s = make_evaluate_fn("sine", "flat", config, sim_duration=5.0)

        epistasis = compute_epistasis_robust(
            eval_sine_5s, sine_best, n_genes=18, delta=0.05, n_refs=5)
        results["epistasis_sine"] = epistasis
        save_checkpoint(results, 2)
    elif skip_epistasis:
        print("\n  [Stage 2] SKIP Epistasis (--skip-epistasis)")

    # Stage 3: Gene Sensitivity — Sine (18 genes)
    if start_stage <= 3:
        print("\n  [Stage 3] Gene Sensitivity — Sine (18 genes)")
        eval_sine_5s = make_evaluate_fn("sine", "flat", config, sim_duration=5.0)

        sensitivity_sine = compute_gene_sensitivity_robust(
            eval_sine_5s, sine_best, n_genes=18, delta=0.10, n_refs=5)
        results["sensitivity_sine"] = sensitivity_sine
        save_checkpoint(results, 3)

    # Stage 4: Gene Sensitivity — CPG (38 genes)
    if start_stage <= 4 and cpg_best is not None:
        print("\n  [Stage 4] Gene Sensitivity — CPG (38 genes)")
        eval_cpg_5s = make_evaluate_fn("cpg", "flat", config, sim_duration=5.0)

        sensitivity_cpg = compute_gene_sensitivity_robust(
            eval_cpg_5s, cpg_best, n_genes=38, delta=0.10, n_refs=5)
        results["sensitivity_cpg"] = sensitivity_cpg
        save_checkpoint(results, 4)
    elif cpg_best is None:
        print("\n  [Stage 4] SKIP CPG Sensitivity: no cpg_baseline.pkl")

    # Add metadata
    results["metadata"] = {
        "timestamp": datetime.now().isoformat(),
        "rng_seed": RNG_SEED,
        "config_snapshot": {
            "simulation_duration_landscape": 5.0,
            "epistasis_delta": 0.05,
            "sensitivity_delta": 0.10,
        },
    }

    # Save final results
    out_path = RESULTS_DIR / "landscape_results.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(results, f)
    print(f"\n  Saved: {out_path}")

    # Clean up checkpoint
    if CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()
        print("  Checkpoint cleaned up")

    # Summary
    print(f"\n  {'='*60}")
    print("  Landscape Analysis Summary:")
    if "fdc_sine" in results:
        fdc = results["fdc_sine"]
        print(f"    FDC Sine: {fdc['mean_fdc']:.4f} +/- {fdc['std_fdc']:.4f}")
    if "fdc_cpgnn" in results:
        fdc = results["fdc_cpgnn"]
        print(f"    FDC CPG+NN: {fdc['mean_fdc']:.4f} +/- {fdc['std_fdc']:.4f}")
    if "epistasis_sine" in results:
        epi = results["epistasis_sine"]
        matrix = np.array(epi["mean_matrix"])
        print(f"    Epistasis: max={np.max(np.abs(matrix)):.2f}, "
              f"mean_abs={np.mean(np.abs(matrix)):.2f}")
    if "sensitivity_sine" in results:
        sens = results["sensitivity_sine"]
        print(f"    Sensitivity Sine: max={max(sens['mean_sensitivity']):.2f}, "
              f"min={min(sens['mean_sensitivity']):.2f}")
    if "sensitivity_cpg" in results:
        sens = results["sensitivity_cpg"]
        print(f"    Sensitivity CPG: max={max(sens['mean_sensitivity']):.2f}, "
              f"min={min(sens['mean_sensitivity']):.2f}")
    print(f"  {'='*60}")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="STRIDE Landscape Analysis (Table 5)")
    parser.add_argument("--skip-epistasis", action="store_true",
                        help="Skip epistasis computation (~70 min)")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from checkpoint")
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  STRIDE -- Fitness Landscape Analysis")
    print("=" * 60)

    t0 = time.time()
    results = run_landscape_analysis(
        skip_epistasis=args.skip_epistasis,
        resume=args.resume)

    elapsed = time.time() - t0
    print(f"\n  Total time: {elapsed:.0f}s ({elapsed/60:.1f}m)")


if __name__ == "__main__":
    main()
