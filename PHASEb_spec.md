# PHASE B: Post-Hoc Analysis Scripts

**Give this entire file to Claude Code. Run AFTER Phase A completes.**

## Context

All v2 GA experiments from Phase A are complete. These .pkl files exist in experiments/results/:
- cpg_baseline.pkl, cpg_hill.pkl, cpg_mixed.pkl
- cpgnn_flat.pkl, cpgnn_mixed.pkl, cpgnn_frozen.pkl
- cpgnn_high_mutation.pkl, cpgnn_2x_budget.pkl, cpgnn_random_init.pkl
- baseline.pkl (v1 sine, already existed)

Now create 7 post-hoc analysis scripts + update analyze_results.py. Read stride_v3.md Sections 9 and 10 for full function code.

## What To Do

### Step 0: Update experiments/analyze_results.py for V2 Data

**This is critical — without it, Tables 1 and 7 have no statistical tests.**

The existing analyze_results.py handles v1 experiments. Update it to:

1. Add V2_COMPARISON_GROUPS:
```python
V2_COMPARISON_GROUPS = {
    "controller_tiers": ["baseline", "cpg_baseline", "cpgnn_flat", "cpgnn_frozen", "cpgnn_mixed", "cpgnn_random_init"],
    "cpg_terrain": ["cpg_baseline", "cpg_hill", "cpg_mixed"],
    "cpgnn_variants": ["cpgnn_flat", "cpgnn_mixed", "cpgnn_frozen", "cpgnn_high_mutation", "cpgnn_2x_budget"],
    "seeded_vs_random": ["cpgnn_flat", "cpgnn_random_init"],
}
```

2. For each group, compute:
   - Per-experiment stats: mean, median, best, worst, std (ddof=1)
   - Mann-Whitney U between baseline and each variant (using v1 baseline for controller_tiers, cpgnn_flat for cpgnn_variants)
   - Cohen's d effect sizes
   - Convergence speed G_80 (generation to reach 80% of final fitness)
   - Significance markers: *** (p<0.001), ** (p<0.01), * (p<0.05), ns

3. Save results to experiments/results/v2_stats.csv and v2_stat_tests.csv

4. Run it:
```bash
python experiments/analyze_results.py  # should now handle both v1 and v2
```

This fills the statistical columns in **Tables 1, 7** and produces comparison data for the report.

---

### Script 1: experiments/transfer_test.py

Read stride_v3.md Section 9 "Transfer Testing Protocol".

**Purpose**: Test generalization to unseen terrains and motor noise.
**Protocol**:
- Load 30 best chromosomes from: baseline (sine), cpg_baseline (CPG), cpgnn_flat, cpgnn_mixed
- Test each on 5 conditions: flat, hill, mixed, flat+5% motor noise, flat+10% motor noise
- 3 trials per condition, take mean fitness
- Total: 30 × 4 controllers × 5 conditions × 3 trials = 1,800 evals

**Key rules from spec**:
- Use flat TEST fitness as denominator for retention rate (NOT training fitness — spec errata)
- Motor noise: `target *= (1.0 + noise_level * np.random.randn())`, clamp to prevent explosion
- For sine: use v1 simulate(). For CPG/CPG+NN: use simulate_v2()

**Output**: experiments/results/transfer_results.pkl — fills **Table 2**

---

### Script 2: experiments/perturbation_test.py

Read stride_v3.md Section 9 "Perturbation Recovery Test". Copy the perturbation_test() function directly from the spec.

**Purpose**: Push recovery — the single most impressive v2 demo.
**Protocol**:
- BACKWARD push at t=7.5s (step 450 in 15-sec/60fps sim) — Errata Fix 1
- Push strengths: 500, 1500, 3000, 5000
- 30 best × 4 controllers (sine, CPG, CPG+NN flat, CPG+NN mixed) × 4 strengths = 480 evals — Errata Fix 8
- Check fall ONLY AFTER push (step > 450), not during normal walking

**Per creature record**: pre_push_velocity, post_push_velocity, recovery_time, fell (bool), final_distance

**Statistical test**: Fisher's exact test (Errata Fix 12):
```python
from scipy.stats import fisher_exact
table = [[sine_survived, 30 - sine_survived],
         [cpgnn_survived, 30 - cpgnn_survived]]
odds_ratio, p_value = fisher_exact(table)
```

**Output**: experiments/results/perturbation_results.pkl — fills **Table 3**

---

### Script 3: experiments/landscape_analysis.py

Read stride_v3.md Section 10: FDC, Epistasis, Gene Sensitivity. Copy all three functions from the spec.

**3 sub-analyses**:

**3a. FDC** (spec function: compute_fdc_robust):
- 2,000 random chromosomes for sine (18 genes) and CPG+NN (96 genes)
- 30 best chromosomes as reference points
- Use 5-sec sims for speed (not 15-sec)
- Validate: Spearman ρ between 5-sec and 15-sec on 100 random creatures. If ρ < 0.9, note in report.
- ~7 min per controller type

**3b. Epistasis** (spec function: compute_epistasis_robust):
- Sine ONLY (18 genes) — CPG+NN excluded (C(96,2) = 4,560 pairs, too expensive)
- 5 reference chromosomes, δ=0.05
- 5 × C(18,2) = 5 × 153 paired + 5 × 18 single = ~860 evals, ~70 min

**3c. Gene Sensitivity** (spec function: compute_gene_sensitivity):
- CANNOT reuse epistasis data — different δ (0.05 vs 0.10) — Errata Fix 5
- Sine: 5 refs × 18 genes × 2 = 180 evals, ~5 min
- CPG: 5 refs × 38 genes × 2 = 380 evals, ~10 min — Errata Fix 10

**Output**: experiments/results/landscape_results.pkl — fills **Table 5**

---

### Script 4: experiments/sensor_ablation.py

Read stride_v3.md Section 10 "Sensor Ablation Study". Copy sensor_ablation() from spec.

**Purpose**: Which sensors does the NN actually use?
**Key rule**: Replace ablated sensor with its RUNNING MEAN from unablated sim — NOT zero (Errata Fix 2)

**Protocol**:
- 8 ablation conditions: 6 individual sensors + 2 sensor pairs
- 10 best CPG+NN creatures × 8 conditions × 3 trials = 240 evals
- Report: % fitness drop relative to unablated baseline

**Output**: experiments/results/ablation_results.pkl — fills **Table 4**

---

### Script 5: experiments/gait_analysis.py

Read stride_v3.md Section 10: Gait Symmetry, Behavioral Fingerprinting, Cost of Transport. Copy all functions from spec.

**3 sub-analyses**:

**5a. Gait Symmetry** (spec function: compute_gait_symmetry):
- 30 best × 3 controllers (sine, CPG, CPG+NN)
- For sine: check frequency commensurability FIRST. If |f_L - f_R|/max(f_L,f_R) > 0.10, exclude — Errata Fix 4
- Skip first 3 seconds (transient)

**5b. Behavioral Fingerprinting** (spec function: compute_behavioral_fingerprint):
- Extract ALL metrics from SINGLE simulation — Errata Fix 6
- Foot contact helpers (Errata Fix 13): count_foot_strikes(), fraction_with_foot_on_ground(), fraction_both_feet_down() — copy from spec

**5c. Cost of Transport** (spec function: compute_cost_of_transport):
- Metabolic model: concentric 1.0×, eccentric 0.3×, isometric 0.5×

**Output**: experiments/results/gait_results.pkl — fills **Table 6**

---

### Script 6: experiments/nn_output_recording.py

Read stride_v3.md Section 10 "NN Output Visualization". Copy record_nn_outputs() from spec.

**Purpose**: Record what the NN does during walking — needed for NN output time-series figure.
**Protocol**:
- 6 best CPG+NN creatures (3 flat-trained, 3 mixed-trained)
- Run each for 15 seconds with record=True
- Record per-step: time, 6 NN modulation values (tanh output directly — NOT recovered ratio, Errata Fix 3), 6 CPG outputs, 6 final targets, 6 sensor values

**Output**: experiments/results/nn_output_recordings.pkl

---

### Script 7: experiments/export_for_web.py

Read stride_v3.md Section 12 "Data Pipeline: Python → Website".

**Purpose**: Export all results as JSON for the website dashboard.
**Export**:
- Best chromosomes per controller (genes array + fitness)
- Convergence histories (per-gen best/mean/std across 30 runs)
- Transfer test results (4×5 grid)
- Perturbation survival counts (4 controllers × 4 strengths)
- Statistical summary tables (from v2_stats.csv)
- FDC scatter data (fitness vs distance)
- Epistasis matrix (18×18)
- Gait symmetry histogram data
- Gene sensitivity bar data
- Behavioral fingerprint data

**Output**: experiments/results/web_export/ directory with JSON files

---

## Run Order

```bash
# 0. Update and run statistical analysis FIRST
python experiments/analyze_results.py        # ~1 min (updated for v2)

# 1-6. Post-hoc experiments
python experiments/transfer_test.py          # ~30 min
python experiments/perturbation_test.py      # ~13 min
python experiments/landscape_analysis.py     # ~90 min (epistasis is slow)
python experiments/sensor_ablation.py        # ~5 min
python experiments/gait_analysis.py          # ~5 min
python experiments/nn_output_recording.py    # ~2 min

# 7. Export (runs last — needs all other results)
python experiments/export_for_web.py         # ~1 min
```

## Success Criteria
- [ ] v2_stats.csv and v2_stat_tests.csv exist with Mann-Whitney p-values and Cohen's d
- [ ] transfer_results.pkl has 4 controllers × 5 conditions
- [ ] perturbation_results.pkl has Fisher's exact p-values
- [ ] landscape_results.pkl has FDC values, epistasis 18×18 matrix, gene sensitivity for BOTH sine (18) AND CPG (38)
- [ ] ablation_results.pkl has 8 conditions with % fitness drop
- [ ] gait_results.pkl has symmetry + fingerprints + CoT for 3 controllers
- [ ] nn_output_recordings.pkl has 6 recordings with modulation time-series
- [ ] web_export/ directory has JSON files
- [ ] No NaN values in any result

## Estimated Time
~2.5 hours computation total.
