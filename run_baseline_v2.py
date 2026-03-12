"""Priority 1D: Re-run baseline + random_search with new physics.

Uses 14 workers for parallel runs.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from experiments.run_experiments import run_priority_group, summarize_results

if __name__ == "__main__":
    import multiprocessing
    n_workers = min(14, multiprocessing.cpu_count() - 1)
    print(f"Running baseline_v2 with {n_workers} workers...\n")

    # Run baseline + random_search (the critical comparison pair)
    results = run_priority_group(
        ["baseline", "random_search"],
        n_workers=n_workers,
    )

    print("\n\nFinal summary:")
    summarize_results()
