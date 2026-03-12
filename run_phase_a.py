"""Phase A: Run all V2 experiments in cascade order.

This is the overnight runner for Phase A. It:
  1. Runs CPG tier first (cpg_baseline, cpg_hill, cpg_mixed)
  2. Then CPG+NN tier (cpgnn_flat, cpgnn_frozen, cpgnn_mixed, etc.)
  3. Runs cpgnn_random_init (no cascade seeding)
  4. Validates results at the end
  5. Runs risk checks

The dependency-aware runner ensures proper cascade ordering:
  baseline.pkl (v1, must exist) → cpg_baseline → all cpgnn_* experiments

Estimated time: ~6-8 hours. Run overnight.

Usage:
    python run_phase_a.py            # Run all experiments + validate
    python run_phase_a.py --dry-run  # Show run order without executing
"""

import multiprocessing
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from experiments.run_v2_experiments import (
    get_v2_experiment_names,
    run_v2_priority_group,
    resolve_run_order,
    summarize_v2_results,
)
from experiments.validate_v2 import run_validation


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="STRIDE Phase A — Run all V2 experiments"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show run order and estimated times without executing"
    )
    parser.add_argument(
        "--workers", type=int, default=1,
        help="Number of parallel workers (default: 1 for V2)"
    )
    args = parser.parse_args()

    # All v2 experiments in dependency order
    all_names = get_v2_experiment_names("all")
    ordered = resolve_run_order(all_names)

    print("\n" + "=" * 60)
    print("  STRIDE Phase A — V2 Experiment Pipeline")
    print("=" * 60)
    print(f"\n  Experiments: {len(ordered)}")
    print(f"  Run order:   {' -> '.join(ordered)}")
    print(f"  Workers:     {args.workers}")
    print(f"  Estimated:   ~6-8 hours total")
    print()

    if args.dry_run:
        print("  [DRY RUN] No experiments will be executed.\n")
        print(f"  {'#':>3}  {'Experiment':<25} {'Controller':>10} {'Genes':>6} "
              f"{'Seed From':>15}")
        print(f"  {'-'*65}")
        from src.config import V2_EXPERIMENTS
        for i, name in enumerate(ordered):
            cfg = V2_EXPERIMENTS[name]
            ctrl = cfg.get("controller_type", "cpg")
            enc = cfg.get("encoding", "cpg")
            genes = {"cpg": 38, "cpg_nn": 96}.get(enc, "?")
            seed = cfg.get("seed_from", "(random init)")
            print(f"  {i+1:>3}  {name:<25} {ctrl:>10} {genes:>6} {seed:>15}")
        print()
        return

    # Check v1 baseline exists
    from pathlib import Path
    baseline_pkl = Path(__file__).parent / "experiments" / "results" / "baseline.pkl"
    if not baseline_pkl.exists():
        print("  ERROR: experiments/results/baseline.pkl not found!")
        print("  Run v1 baseline first: python main.py --priority p0")
        sys.exit(1)

    print("  Starting experiments...\n")
    t0 = time.time()

    # Run all experiments with dependency ordering
    results = run_v2_priority_group(ordered, n_workers=args.workers)

    elapsed = time.time() - t0
    hours = elapsed / 3600

    # Summary
    print(f"\n  Total time: {elapsed:.0f}s ({hours:.1f}h)")
    summarize_v2_results()

    # Validation + risk checks
    print("\n  Running validation and risk checks...\n")
    run_validation(run_risk_checks=True)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
