"""Generate all figures for the STRIDE report.

Runs all visualization scripts in sequence:
  1. Convergence plots (per-experiment + comparison overlays)
  2. Box plots (per-group + all-experiments overview)
  3. Diversity plots (per-experiment + comparison overlays)
  4. Algorithm comparison convergence + box plots

Outputs to report/figures/ at 300 DPI.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

# Use non-interactive backend
import matplotlib
matplotlib.use("Agg")


def main():
    print("=" * 60)
    print("  STRIDE — Generating All Report Figures")
    print("=" * 60)

    figures_dir = PROJECT_ROOT / "report" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)

    # 1. Convergence plots
    print("\n[1/4] Convergence Plots")
    try:
        from visualization.convergence_plot import main as conv_main
        conv_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 2. Box plots
    print("\n[2/4] Box Plots")
    try:
        from visualization.box_plots import main as box_main
        box_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 3. Diversity plots
    print("\n[3/4] Diversity Plots")
    try:
        from visualization.diversity_plot import main as div_main
        div_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 4. Heatmaps (gene evolution over generations)
    print("\n[4/5] Parameter Heatmaps")
    try:
        from visualization.heatmap import main as heatmap_main
        heatmap_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 5. Algorithm comparison (separate analysis)
    print("\n[5/9] Algorithm Comparison Analysis + Plots")
    try:
        from analyze_algorithms import main as algo_main
        algo_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 6. Evolution snapshots (generation replay)
    print("\n[6/9] Evolution Snapshots")
    try:
        from visualization.generation_replay import main as replay_main
        replay_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 7. Skeleton trail (motion-capture afterimage)
    print("\n[7/9] Skeleton Trail")
    try:
        from visualization.skeleton_trail import main as trail_main
        trail_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 8. Side-by-side race
    print("\n[8/9] Side-by-Side Race")
    try:
        from visualization.side_by_side import main as race_main
        race_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # 9. Family tree
    print("\n[9/9] Family Tree")
    try:
        from visualization.family_tree import main as tree_main
        tree_main()
    except Exception as e:
        print(f"  ERROR: {e}")

    # Summary
    n_figs = len(list(figures_dir.glob("*.png")))
    algo_figs = len(list((PROJECT_ROOT / "figures").glob("*.png")))
    print(f"\n{'='*60}")
    print(f"  Done! {n_figs} figures in report/figures/")
    if algo_figs:
        print(f"  + {algo_figs} figures in figures/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
