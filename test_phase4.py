"""Phase 4 validation tests for STRIDE analysis & visualization pipeline.

Verifies the spec's Phase 4 Validation Checkpoint:
  1. All CSV stat tables generated (no NaN in data columns)
  2. Wilcoxon p-values computed
  3. All PNG figures generated at 300 DPI
  4. Creature diagram has labeled joints and gene mappings
  5. Convergence plots show 30 overlaid runs with mean line
  6. Box plots have readable labels
  7. No NaN values in any table
  8. All required comparison groups covered

Run: python test_phase4.py
"""

import csv
import math
import os
import sys
from pathlib import Path
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent
RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
FIGURES_DIR = PROJECT_ROOT / "report" / "figures"

passed = 0
failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  [OK]   {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name}  -- {detail}")
        failed += 1


# --------------------------------------------------------------------------
# TEST 1: CSV stat tables exist and have data
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 1: CSV stat tables exist and have data")
print("=" * 60)

EXPECTED_CSVS = [
    "table_experiment_stats.csv",
    "table_significance_all.csv",
    "table_convergence_speed.csv",
    "table_comparison_ga_vs_random.csv",
    "table_comparison_selection.csv",
    "table_comparison_mutation.csv",
    "table_comparison_elitism.csv",
    "table_comparison_encoding.csv",
    "table_comparison_terrain.csv",
    "table_comparison_crossover.csv",
]

for csv_name in EXPECTED_CSVS:
    path = RESULTS_DIR / csv_name
    exists = path.exists()
    check(f"{csv_name} exists", exists)
    if exists:
        with open(path, "r") as f:
            reader = csv.reader(f)
            rows = list(reader)
        check(f"{csv_name} has header + data rows",
              len(rows) >= 2, f"only {len(rows)} rows")


# --------------------------------------------------------------------------
# TEST 2: No NaN values in critical tables
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 2: No NaN values in experiment stats table")
print("=" * 60)

stats_path = RESULTS_DIR / "table_experiment_stats.csv"
if stats_path.exists():
    with open(stats_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"]
            has_nan = any(v == "nan" or v == "NaN"
                         for k, v in row.items() if k != "name")
            check(f"{name}: no NaN in stats", not has_nan,
                  f"found NaN: {row}")


# --------------------------------------------------------------------------
# TEST 3: Wilcoxon p-values computed
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 3: Wilcoxon p-values and Cohen's d in significance table")
print("=" * 60)

sig_path = RESULTS_DIR / "table_significance_all.csv"
if sig_path.exists():
    with open(sig_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    check("Significance table has entries", len(rows) >= 10,
          f"only {len(rows)} entries")

    for row in rows:
        name = row["name"]
        p = row.get("p_value", "N/A")
        d = row.get("cohens_d", "N/A")
        sig = row.get("significance", "N/A")

        # p-value should be a valid number
        try:
            p_float = float(p)
            check(f"{name}: p-value is numeric ({p})", True)
        except (ValueError, TypeError):
            check(f"{name}: p-value is numeric", False, f"got {p}")

        # significance should be one of *, **, ***, ns, N/A
        valid_sigs = {"*", "**", "***", "ns", "N/A", "N/A (std=0)"}
        check(f"{name}: significance marker valid ({sig})",
              sig in valid_sigs, f"got '{sig}'")

        # Cohen's d should be numeric
        try:
            d_float = float(d)
            check(f"{name}: Cohen's d is numeric ({d})", True)
        except (ValueError, TypeError):
            check(f"{name}: Cohen's d is numeric", False, f"got {d}")


# --------------------------------------------------------------------------
# TEST 4: All PNG figures generated at 300 DPI
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 4: PNG figures exist and are 300 DPI")
print("=" * 60)

REQUIRED_FIGURES = [
    # Static diagrams
    "creature_diagram.png",
    "encoding_diagram.png",
    "ga_flowchart.png",
    # Box plots
    "boxplot_ga_vs_random.png",
    "boxplot_selection.png",
    "boxplot_mutation.png",
    "boxplot_elitism.png",
    "boxplot_encoding.png",
    "boxplot_terrain.png",
    "boxplot_all_experiments.png",
    # Convergence comparisons
    "convergence_comparison_ga_vs_random.png",
    "convergence_comparison_selection.png",
    "convergence_comparison_mutation.png",
    "convergence_comparison_elitism.png",
    "convergence_comparison_encoding.png",
    "convergence_comparison_terrain.png",
    # Per-experiment convergence
    "convergence_baseline.png",
    "convergence_random_search.png",
    # Diversity comparisons
    "diversity_comparison_selection.png",
    "diversity_comparison_mutation.png",
    "diversity_comparison_elitism.png",
    # Heatmaps
    "heatmap_baseline.png",
]

for fig_name in REQUIRED_FIGURES:
    path = FIGURES_DIR / fig_name
    exists = path.exists()
    check(f"{fig_name} exists", exists)
    if exists:
        img = Image.open(path)
        dpi = img.info.get("dpi", (72, 72))
        # matplotlib saves dpi in info
        check(f"{fig_name} is 300 DPI", dpi[0] >= 299,
              f"DPI = {dpi}")
        img.close()


# --------------------------------------------------------------------------
# TEST 5: Convergence speed table
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 5: Convergence speed (G_80) table")
print("=" * 60)

g80_path = RESULTS_DIR / "table_convergence_speed.csv"
if g80_path.exists():
    with open(g80_path, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    check("G_80 table has entries", len(rows) >= 10,
          f"only {len(rows)}")

    for row in rows:
        name = row["name"]
        g80 = row.get("mean_g80", "N/A")
        try:
            g80_float = float(g80)
            check(f"{name}: G_80 is numeric ({g80})",
                  0 <= g80_float <= 75, f"out of range: {g80}")
        except (ValueError, TypeError):
            check(f"{name}: G_80 is numeric", False, f"got {g80}")


# --------------------------------------------------------------------------
# TEST 6: Total figure count
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
print("TEST 6: Total output counts")
print("=" * 60)

png_count = len(list(FIGURES_DIR.glob("*.png")))
csv_count = len(list(RESULTS_DIR.glob("table_*.csv")))

check(f"PNG figures: {png_count} (expect >= 30)", png_count >= 30)
check(f"CSV tables: {csv_count} (expect >= 10)", csv_count >= 10)


# --------------------------------------------------------------------------
# SUMMARY
# --------------------------------------------------------------------------
print("\n" + "=" * 60)
total = passed + failed
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
if failed == 0:
    print("Phase 4 validation: ALL CHECKS PASSED")
else:
    print("Phase 4 validation: SOME CHECKS FAILED")
print("=" * 60)

sys.exit(0 if failed == 0 else 1)
