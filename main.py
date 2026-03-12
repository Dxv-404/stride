"""STRIDE — Evolving 2D Walkers Using Genetic Algorithms.

Main entry point for running experiments (v1 sine + v2 CPG/CPG+NN).

Usage:
    # --- V1 (sine controller) ---
    python main.py --validate              # Quick sanity check
    python main.py --priority p0           # Run P0 experiments (9 experiments × 30 runs)
    python main.py --priority all          # Run all v1 experiments
    python main.py --summary               # Print results summary table

    # --- V2 (CPG / CPG+NN controllers) ---
    python main.py --v2 --priority p0      # Run V2 P0 experiments (cascade seeded)
    python main.py --v2 --priority all     # Run all V2 experiments
    python main.py --v2 --summary          # Print V2 results summary
    python main.py --v2 --experiments cpg_baseline cpgnn_flat

    # --- Options ---
    python main.py --priority p0 --sequential  # Run without multiprocessing
    python main.py --full-pipeline             # Validate + run all + analyze + report
"""

import argparse
import logging
import multiprocessing
import sys
import os

# Ensure project root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.utils import validate_setup
from experiments.run_experiments import (
    get_experiment_names,
    run_priority_group,
    summarize_results,
)
from experiments.run_v2_experiments import (
    get_v2_experiment_names,
    run_v2_priority_group,
    summarize_v2_results,
)


def setup_logging():
    """Configure root logger."""
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def main():
    parser = argparse.ArgumentParser(
        description="STRIDE — Evolving 2D Walkers Using Genetic Algorithms"
    )
    parser.add_argument(
        "--validate", action="store_true",
        help="Run quick validation checks before experiments"
    )
    parser.add_argument(
        "--priority", type=str, choices=["p0", "p1", "p2", "all"],
        help="Which priority group of experiments to run"
    )
    parser.add_argument(
        "--summary", action="store_true",
        help="Print summary of all completed experiments"
    )
    parser.add_argument(
        "--sequential", action="store_true",
        help="Disable multiprocessing (run sequentially)"
    )
    parser.add_argument(
        "--workers", type=int, default=0,
        help="Number of workers (0 = cpu_count - 1)"
    )
    parser.add_argument(
        "--full-pipeline", action="store_true",
        help="Run full pipeline: validate -> experiments -> analysis -> report"
    )
    parser.add_argument(
        "--v2", action="store_true",
        help="Run V2 experiments (CPG/CPG+NN) instead of V1 (sine)"
    )
    parser.add_argument(
        "--experiments", nargs="+", type=str,
        help="Specific experiment names to run (use with --v2)"
    )

    args = parser.parse_args()

    setup_logging()

    # --- Validate ---
    if args.validate:
        print("\n" + "=" * 60)
        print("  STRIDE — Validation Check")
        print("=" * 60 + "\n")
        try:
            validate_setup()
            print("\n[PASS] All validation checks passed!\n")
        except Exception as e:
            print(f"\n[FAIL] Validation FAILED: {e}\n")
            sys.exit(1)

    # --- Summary ---
    if args.summary:
        if args.v2:
            summarize_v2_results()
        else:
            summarize_results()

    # --- Run experiments ---
    if args.v2 and (args.priority or args.experiments):
        # V2 mode: CPG / CPG+NN experiments
        if args.experiments:
            names = args.experiments
        else:
            names = get_v2_experiment_names(args.priority)

        # V2 default: 1 worker (heavier sims)
        if args.sequential or args.workers == 0:
            n_workers = 1
        else:
            n_workers = args.workers

        print(f"\n{'='*60}")
        print(f"  STRIDE V2 — CPG/CPG+NN Experiments")
        print(f"  {len(names)} experiments, 30 runs each")
        print(f"  Workers: {n_workers}")
        print(f"{'='*60}\n")

        results = run_v2_priority_group(names, n_workers=n_workers)

        # Print final summary
        summarize_v2_results()

    elif args.priority and not args.v2:
        # V1 mode: sine experiments
        names = get_experiment_names(args.priority)

        if args.sequential:
            n_workers = 1
        elif args.workers > 0:
            n_workers = args.workers
        else:
            n_workers = max(1, multiprocessing.cpu_count() - 1)

        print(f"\n{'='*60}")
        print(f"  STRIDE — Running {args.priority.upper()} Experiments")
        print(f"  {len(names)} experiments, 30 runs each")
        print(f"  Workers: {n_workers}")
        print(f"{'='*60}\n")

        results = run_priority_group(names, n_workers=n_workers)

        # Print final summary
        summarize_results()

    # --- Full pipeline ---
    if args.full_pipeline:
        print("\n" + "=" * 60)
        print("  STRIDE — Full Pipeline")
        print("=" * 60 + "\n")

        # Step 1: Validate
        print("[1/4] Validation...")
        try:
            validate_setup()
            print("  [PASS] Validation OK\n")
        except Exception as e:
            print(f"  [FAIL] Validation failed: {e}")
            sys.exit(1)

        # Step 2: Run all experiments
        n_workers = max(1, multiprocessing.cpu_count() - 1)
        all_names = get_experiment_names("all")
        print(f"[2/4] Running all experiments ({len(all_names)} experiments, "
              f"{n_workers} workers)...")
        run_priority_group(all_names, n_workers=n_workers)

        # Step 3: Analysis (Phase 4 — will be built later)
        analyze_script = os.path.join(
            os.path.dirname(__file__), "experiments", "analyze_results.py")
        if os.path.exists(analyze_script):
            print("[3/4] Running analysis...")
            os.system(f'"{sys.executable}" "{analyze_script}"')
        else:
            print("[3/4] Analysis script not yet built — skipping")

        # Step 4: Report generation (Phase 5 — will be built later)
        report_script = os.path.join(
            os.path.dirname(__file__), "report", "generate_report.py")
        if os.path.exists(report_script):
            print("[4/4] Generating report...")
            os.system(f'"{sys.executable}" "{report_script}"')
        else:
            print("[4/4] Report script not yet built — skipping")

        print("\n" + "=" * 60)
        print("  Pipeline complete!")
        print("=" * 60)
        summarize_results()

    # If no action specified, show help
    has_action = (args.validate or args.summary or args.priority
                  or args.full_pipeline or args.experiments)
    if not has_action:
        parser.print_help()


if __name__ == "__main__":
    # Required for Windows multiprocessing (spawn mode)
    multiprocessing.freeze_support()
    main()
