"""Finalize all results: run analysis, generate figures, build PDF.

Run this AFTER all experiments have completed.
It chains: check_progress -> analyze -> generate figures -> build PDF.

Usage:
    python finalize_results.py
"""

import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON = sys.executable


def run_script(script_path, description):
    """Run a Python script and print its output."""
    print(f"\n{'='*60}")
    print(f"  {description}")
    print(f"  Running: {script_path}")
    print(f"{'='*60}\n")

    result = subprocess.run(
        [PYTHON, str(script_path)],
        cwd=str(PROJECT_ROOT),
        capture_output=False,
    )

    if result.returncode != 0:
        print(f"\n  WARNING: {script_path.name} exited with code "
              f"{result.returncode}")
    return result.returncode


def main():
    print("\n" + "=" * 60)
    print("  STRIDE — Finalizing All Results")
    print("=" * 60)

    # 1. Check progress
    run_script(
        PROJECT_ROOT / "check_progress.py",
        "Step 1/5: Checking experiment progress"
    )

    # 2. Phase 4 analysis (all experiments)
    run_script(
        PROJECT_ROOT / "experiments" / "analyze_results.py",
        "Step 2/5: Running Phase 4 statistical analysis"
    )

    # 3. Algorithm comparison analysis
    run_script(
        PROJECT_ROOT / "analyze_algorithms.py",
        "Step 3/5: Running algorithm comparison analysis"
    )

    # 4. Generate all figures
    run_script(
        PROJECT_ROOT / "generate_all_figures.py",
        "Step 4/5: Generating all report figures"
    )

    # 5. Build PDF report
    run_script(
        PROJECT_ROOT / "report" / "generate_report.py",
        "Step 5/5: Building PDF report"
    )

    # Final summary
    pdf_path = PROJECT_ROOT / "report" / "stride_report.pdf"
    print(f"\n{'='*60}")
    print(f"  ALL DONE!")
    if pdf_path.exists():
        size_mb = pdf_path.stat().st_size / (1024 * 1024)
        print(f"  Report: {pdf_path} ({size_mb:.1f} MB)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
