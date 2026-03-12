"""Export all experiment results as JSON for the website dashboard.

This script runs LAST after all other Phase B scripts have completed.
It loads all pickle files from experiments/results/ and converts them
to JSON format suitable for the React website (Phase E).

Output directory: experiments/results/web_export/

JSON files produced:
  - best_chromosomes.json    — best genes + fitness per controller
  - convergence.json         — per-gen fitness history (mean/std across 30 runs)
  - transfer.json            — 4 controllers x 5 conditions
  - push_test.json           — survival rates per push strength
  - fitness_distributions.json — raw 30 fitness values per experiment
  - stat_tests.json          — statistical significance data
  - fdc.json                 — FDC scatter data
  - epistasis.json           — 18x18 gene interaction matrix
  - gene_sensitivity.json    — per-gene sensitivity values
  - gait.json                — symmetry + fingerprint data
  - nn_modulation.json       — NN output recordings (subsampled)
  - ablation.json            — sensor ablation results

Usage:
    python experiments/export_for_web.py

Estimated time: <1 minute
"""

import json
import os
import pickle
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

RESULTS_DIR = PROJECT_ROOT / "experiments" / "results"
WEB_DIR = RESULTS_DIR / "web_export"


class NumpyEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        if isinstance(obj, (np.floating, np.float64, np.float32)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)


def save_json(data, filename):
    """Save data as JSON to web_export directory."""
    path = WEB_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, cls=NumpyEncoder, indent=2)
    print(f"  Saved: {path}")


def load_pkl(name):
    """Load a pickle file from results directory."""
    # Try both naming conventions
    for suffix in [f"{name}.pkl", f"{name}_results.pkl"]:
        path = RESULTS_DIR / suffix
        if path.exists():
            with open(path, "rb") as f:
                return pickle.load(f)
    return None


def export_best_chromosomes():
    """Export best chromosome per controller type."""
    controllers = {
        "sine":         "baseline",
        "cpg":          "cpg_baseline",
        "cpgnn_flat":   "cpgnn_flat",
        "cpgnn_mixed":  "cpgnn_mixed",
    }

    data = {}
    for ctrl_name, pkl_name in controllers.items():
        pkl_data = load_pkl(pkl_name)
        if pkl_data is None:
            continue

        valid = [r for r in pkl_data
                 if r is not None and "best_chromosome" in r]
        if not valid:
            continue

        best = max(valid, key=lambda r: r["best_fitness"])
        data[ctrl_name] = {
            "genes": list(best["best_chromosome"]),
            "fitness": float(best["best_fitness"]),
            "n_runs": len(valid),
        }

    save_json(data, "best_chromosomes.json")
    return len(data)


def export_convergence():
    """Export per-generation fitness convergence data."""
    experiments = [
        "baseline", "cpg_baseline", "cpgnn_flat", "cpgnn_frozen",
        "cpgnn_mixed", "cpg_hill", "cpg_mixed",
        "cpgnn_2x_budget", "cpgnn_random_init", "cpgnn_high_mutation",
    ]

    data = {}
    for exp_name in experiments:
        pkl_data = load_pkl(exp_name)
        if pkl_data is None:
            continue

        valid = [r for r in pkl_data
                 if r is not None and "convergence_history" in r]
        if not valid:
            continue

        # Collect per-gen best fitness across runs
        max_gens = max(len(r["convergence_history"]) for r in valid)
        per_gen_best = []
        per_gen_mean = []

        for g in range(max_gens):
            gen_fits = []
            for r in valid:
                if g < len(r["convergence_history"]):
                    gen_fits.append(r["convergence_history"][g])
            if gen_fits:
                per_gen_best.append(float(np.max(gen_fits)))
                per_gen_mean.append(float(np.mean(gen_fits)))

        data[exp_name] = {
            "generations": list(range(max_gens)),
            "best_per_gen": per_gen_best,
            "mean_per_gen": per_gen_mean,
            "n_runs": len(valid),
        }

    save_json(data, "convergence.json")
    return len(data)


def export_transfer():
    """Export transfer test results."""
    pkl_data = load_pkl("transfer")
    if pkl_data is None:
        print("  SKIP: No transfer results found")
        return 0

    absolute = pkl_data.get("absolute", {})
    retention = pkl_data.get("retention", {})

    data = {}
    for ctrl_name in absolute:
        ctrl_data = {"absolute": {}, "retention": {}}
        for cond_name, fits in absolute[ctrl_name].items():
            ctrl_data["absolute"][cond_name] = {
                "mean": float(np.mean(fits)),
                "std": float(np.std(fits)),
                "values": [float(f) for f in fits],
            }
        if ctrl_name in retention:
            for cond_name, rates in retention[ctrl_name].items():
                ctrl_data["retention"][cond_name] = {
                    "mean": float(np.mean(rates)),
                    "std": float(np.std(rates)),
                }
        data[ctrl_name] = ctrl_data

    save_json(data, "transfer.json")
    return len(data)


def export_push_test():
    """Export perturbation test results."""
    pkl_data = load_pkl("perturbation")
    if pkl_data is None:
        print("  SKIP: No perturbation results found")
        return 0

    results = pkl_data.get("results", {})
    fisher = pkl_data.get("fisher", {})

    data = {}
    for ctrl_name, ctrl_data in results.items():
        push_results = {}
        for push_name, push_data in ctrl_data.items():
            n_survived = sum(1 for r in push_data if not r["fell"])
            push_results[push_name] = {
                "survived": n_survived,
                "total": len(push_data),
                "survival_rate": n_survived / max(len(push_data), 1),
            }
        data[ctrl_name] = push_results

    # Add Fisher p-values
    for ctrl_name, ctrl_fisher in fisher.items():
        if ctrl_name in data:
            for push_name, (odds, p) in ctrl_fisher.items():
                if push_name in data[ctrl_name]:
                    data[ctrl_name][push_name]["fisher_p"] = float(p)

    save_json(data, "push_test.json")
    return len(data)


def export_fitness_distributions():
    """Export raw fitness values for box plots."""
    experiments = [
        "baseline", "cpg_baseline", "cpgnn_flat", "cpgnn_frozen",
        "cpgnn_mixed", "cpg_hill", "cpg_mixed",
        "cpgnn_2x_budget", "cpgnn_random_init", "cpgnn_high_mutation",
    ]

    data = {}
    for exp_name in experiments:
        pkl_data = load_pkl(exp_name)
        if pkl_data is None:
            continue

        valid = [r for r in pkl_data
                 if r is not None and "best_fitness" in r]
        if not valid:
            continue

        fitnesses = [float(r["best_fitness"]) for r in valid]
        data[exp_name] = {
            "values": fitnesses,
            "mean": float(np.mean(fitnesses)),
            "std": float(np.std(fitnesses)),
            "median": float(np.median(fitnesses)),
            "min": float(np.min(fitnesses)),
            "max": float(np.max(fitnesses)),
            "n": len(fitnesses),
        }

    save_json(data, "fitness_distributions.json")
    return len(data)


def export_stat_tests():
    """Export statistical test results."""
    # Try to load v2 stat test CSV
    csv_path = RESULTS_DIR / "v2_stat_tests.csv"
    if not csv_path.exists():
        print("  SKIP: No v2_stat_tests.csv found")
        return 0

    data = []
    with open(csv_path, "r", encoding="utf-8") as f:
        header = f.readline().strip().split(",")
        for line in f:
            values = line.strip().split(",")
            if len(values) >= len(header):
                row = dict(zip(header, values))
                data.append(row)

    save_json(data, "stat_tests.json")
    return len(data)


def export_landscape():
    """Export FDC, epistasis, and gene sensitivity data."""
    pkl_data = load_pkl("landscape")
    if pkl_data is None:
        print("  SKIP: No landscape results found")
        return 0

    count = 0

    # FDC scatter data (subsample to 500 points for web)
    # Actual pkl keys: fdc_sine, fdc_cpgnn (with scatter_fitnesses/scatter_distances)
    fdc_data = {}
    for ctrl_name, key in [("sine", "fdc_sine"), ("cpgnn", "fdc_cpgnn")]:
        if key not in pkl_data:
            continue
        fdc = pkl_data[key]
        fitnesses = fdc.get("scatter_fitnesses", fdc.get("fitnesses", []))
        distances = fdc.get("scatter_distances", fdc.get("distances", []))
        if fitnesses and distances:
            # Convert to plain lists if numpy
            fitnesses = list(fitnesses)
            distances = list(distances)
            # Subsample to 500 points
            n = len(fitnesses)
            if n > 500:
                indices = np.random.choice(n, 500, replace=False)
                fitnesses = [fitnesses[i] for i in indices]
                distances = [distances[i] for i in indices]
            fdc_data[ctrl_name] = {
                "fitnesses": [float(f) for f in fitnesses],
                "distances": [float(d) for d in distances],
                "rho": float(fdc.get("mean_fdc", fdc.get("rho", 0))),
            }

    if fdc_data:
        save_json(fdc_data, "fdc.json")
        count += 1

    # FDC validation (5s vs 15s)
    if "fdc_validation_sine" in pkl_data:
        val = pkl_data["fdc_validation_sine"]
        save_json({
            "rho": float(val.get("rho", 0)),
            "p_value": float(val.get("p_value", 1)),
        }, "fdc_validation.json")
        count += 1

    # Epistasis matrix (18x18 for sine) — may not exist if skipped
    # Actual pkl key is "epistasis_sine" (not "epistasis")
    epi_key = "epistasis_sine" if "epistasis_sine" in pkl_data else "epistasis"
    if epi_key in pkl_data:
        epi = pkl_data[epi_key]
        if isinstance(epi, dict) and "mean_matrix" in epi:
            matrix = epi["mean_matrix"]
        elif isinstance(epi, dict) and "matrix" in epi:
            matrix = epi["matrix"]
        elif isinstance(epi, np.ndarray):
            matrix = epi.tolist()
        else:
            matrix = epi

        # Find top pairs
        top_pairs = []
        if isinstance(matrix, (list, np.ndarray)):
            m = np.array(matrix)
            n_genes = m.shape[0]
            for i in range(n_genes):
                for j in range(i + 1, n_genes):
                    top_pairs.append({
                        "gene_i": i, "gene_j": j,
                        "strength": float(abs(m[i][j])),
                    })
            top_pairs.sort(key=lambda x: x["strength"], reverse=True)
            top_pairs = top_pairs[:20]

        save_json({
            "matrix": matrix if isinstance(matrix, list)
                      else np.array(matrix).tolist(),
            "top_pairs": top_pairs,
        }, "epistasis.json")
        count += 1

    # Gene sensitivity — actual keys: sensitivity_sine, sensitivity_cpg
    sens_data = {}
    for ctrl_name, key in [("sine", "sensitivity_sine"),
                            ("cpg", "sensitivity_cpg")]:
        if key not in pkl_data:
            continue
        sens = pkl_data[key]
        sens_data[ctrl_name] = {
            "mean_sensitivity": [float(v) for v in sens["mean_sensitivity"]],
            "std_sensitivity": [float(v) for v in sens["std_sensitivity"]],
            "n_genes": int(sens["n_genes"]),
            "delta": float(sens["delta"]),
        }

    if sens_data:
        save_json(sens_data, "gene_sensitivity.json")
        count += 1

    return max(count, 1) if count > 0 else 0


def export_gait():
    """Export gait analysis results."""
    pkl_data = load_pkl("gait")
    if pkl_data is None:
        print("  SKIP: No gait results found")
        return 0

    results = pkl_data.get("results", {})
    data = {}
    for ctrl_name, ctrl_data in results.items():
        # Symmetry summary
        sym_data = ctrl_data.get("symmetry", [])
        symmetry = {
            "n_walking": sum(1 for s in sym_data if s.get("is_walking")),
            "n_hopping": sum(1 for s in sym_data if s.get("is_hopping")),
            "n_incommensurate": sum(1 for s in sym_data
                                    if s.get("is_incommensurate")),
            "phase_diffs": [s["mean_phase_diff"] for s in sym_data
                           if s.get("mean_phase_diff") is not None],
        }

        # Fingerprint summary
        fp_data = ctrl_data.get("fingerprint", [])
        fingerprint = {}
        if fp_data:
            for metric in ["distance", "avg_speed", "step_frequency",
                          "duty_factor", "double_support",
                          "cost_of_transport", "avg_torso_angle"]:
                vals = [f["mean"][metric] for f in fp_data
                        if f["mean"].get(metric) is not None]
                if vals:
                    fingerprint[metric] = {
                        "mean": float(np.mean(vals)),
                        "std": float(np.std(vals)),
                        "values": [float(v) for v in vals],
                    }

        data[ctrl_name] = {
            "symmetry": symmetry,
            "fingerprint": fingerprint,
        }

    save_json(data, "gait.json")
    return len(data)


def export_nn_modulation():
    """Export NN output recordings (subsampled for web)."""
    pkl_data = load_pkl("nn_output_recordings")
    if pkl_data is None:
        print("  SKIP: No NN recordings found")
        return 0

    recordings = pkl_data.get("recordings", {})
    data = {}

    for source, recs in recordings.items():
        source_data = []
        for rec in recs:
            time_arr = rec.get("time", [])
            mod_arr = rec.get("nn_modulation", [])
            cpg_arr = rec.get("cpg_output", [])

            if not time_arr:
                continue

            # Subsample to every 3rd step (20fps instead of 60fps)
            step = 3
            entry = {
                "train_fitness": rec.get("train_fitness"),
                "time": [time_arr[i] for i in range(0, len(time_arr), step)],
            }

            if isinstance(mod_arr, list) and mod_arr:
                entry["modulation"] = [mod_arr[i] for i in
                                       range(0, len(mod_arr), step)]
            elif hasattr(mod_arr, 'tolist'):
                entry["modulation"] = mod_arr[::step].tolist()

            if isinstance(cpg_arr, list) and cpg_arr:
                entry["cpg"] = [cpg_arr[i] for i in
                               range(0, len(cpg_arr), step)]
            elif hasattr(cpg_arr, 'tolist'):
                entry["cpg"] = cpg_arr[::step].tolist()

            source_data.append(entry)
        data[source] = source_data

    save_json(data, "nn_modulation.json")
    return sum(len(v) for v in data.values())


def export_ablation():
    """Export sensor ablation results."""
    pkl_data = load_pkl("ablation")
    if pkl_data is None:
        print("  SKIP: No ablation results found")
        return 0

    results = pkl_data.get("results", [])

    # Aggregate across creatures
    ablation_summary = {}
    for r in results:
        for abl_name, abl_data in r.get("ablations", {}).items():
            if abl_name not in ablation_summary:
                ablation_summary[abl_name] = {
                    "drops": [], "drop_pcts": [], "fitnesses": [],
                }
            ablation_summary[abl_name]["drops"].append(abl_data["drop"])
            ablation_summary[abl_name]["drop_pcts"].append(abl_data["drop_pct"])
            ablation_summary[abl_name]["fitnesses"].append(abl_data["fitness"])

    data = {}
    for abl_name, agg in ablation_summary.items():
        data[abl_name] = {
            "mean_drop_pct": float(np.mean(agg["drop_pcts"])),
            "std_drop_pct": float(np.std(agg["drop_pcts"])),
            "mean_fitness": float(np.mean(agg["fitnesses"])),
        }

    # Add baseline and frozen info
    baselines = [r["baseline_fitness"] for r in results]
    frozen = [r["frozen_fitness"] for r in results]
    data["_baseline"] = {"mean": float(np.mean(baselines))}
    data["_frozen"] = {"mean": float(np.mean(frozen))}

    save_json(data, "ablation.json")
    return len(data)


def main():
    print("\n" + "=" * 60)
    print("  STRIDE -- Export for Web (Phase E)")
    print("=" * 60)

    # Create output directory
    WEB_DIR.mkdir(parents=True, exist_ok=True)

    counts = {}

    print("\n  Exporting data...")
    counts["chromosomes"] = export_best_chromosomes()
    counts["convergence"] = export_convergence()
    counts["transfer"] = export_transfer()
    counts["push_test"] = export_push_test()
    counts["distributions"] = export_fitness_distributions()
    counts["stat_tests"] = export_stat_tests()
    counts["landscape"] = export_landscape()
    counts["gait"] = export_gait()
    counts["nn_modulation"] = export_nn_modulation()
    counts["ablation"] = export_ablation()

    # Save export metadata
    metadata = {
        "timestamp": datetime.now().isoformat(),
        "export_counts": counts,
        "source_dir": str(RESULTS_DIR),
        "note": "Live sims use p2.js (close to pymunk). "
                "Stats from pymunk (exact).",
    }
    save_json(metadata, "_metadata.json")

    print(f"\n  Export complete: {sum(counts.values())} datasets")
    print(f"  Output: {WEB_DIR}")


if __name__ == "__main__":
    main()
