# PHASE A: Run V2 GA Experiments

**Give this entire file to Claude Code.**

## Context

V1 is complete: 17 experiments, 510 runs, baseline.pkl exists (sine mean fitness = 746.78).

V2 core code is complete and tested:
- src/sensors.py, src/cpg_controller.py, src/cpgnn_controller.py
- simulate_v2(), compute_fitness_v2(), run_ga_v2(), safe_simulate_v2()
- V2_BASELINE_CONFIG and V2_EXPERIMENTS in config.py
- experiments/run_v2_experiments.py with cascade seeding + dependency ordering
- frozen_nn → frozen_genes translation bug is fixed

CPG sanity test passed: fitness 323 from random init in 5 gens.

## What To Do

### Step 1: Add missing experiment to src/config.py

Read stride_v3.md Section 11, experiment #6. `cpgnn_random_init` is needed for Table 7 (Seeded vs Random Init comparison) but is NOT in V2_EXPERIMENTS. Add it:

```python
"cpgnn_random_init": {
    **V2_BASELINE_CONFIG,
    "controller_type": "cpg_nn",
    "encoding": "cpg_nn",
    "terrain": "flat",
    # NO seed_from key — starts from fully random 96-gene chromosomes
},
```

This must NOT have a `seed_from` key. It tests what happens when CPG+NN evolves from scratch without cascade seeding.

### Step 2: Run experiments in cascade order

The dependency chain is: baseline.pkl (v1, already exists) → cpg_baseline → all cpgnn_* experiments.

```bash
# 2a. CPG baseline first (~30 min)
python main.py --v2 --experiments cpg_baseline

# 2b. CPG terrain variants (~30 min each)
python main.py --v2 --experiments cpg_hill cpg_mixed

# 2c. All CPG+NN P0 experiments (~4 hours total)
python main.py --v2 --priority p0

# 2d. Random init experiment for Table 7 (~45 min)
python main.py --v2 --experiments cpgnn_random_init
```

### Step 3: Risk checks and conditional experiment 6c

After cpgnn_flat and cpgnn_frozen complete, compare their results:

**Risk 1 check**: If CPG baseline mean fitness < sine baseline (746.78), apply sine-seeded initialization with phased evolution — freeze coupling genes for first 50 gens. See stride_v3.md Section 28 Risk 1.

**Risk 2 check**: Compare cpgnn_flat vs cpgnn_frozen. If their mean fitness and convergence curves are statistically indistinguishable (Mann-Whitney p > 0.05), the NN learned nothing on flat terrain.
- This is VALID if cpgnn_mixed still beats cpgnn_flat — the NN needs diverse terrain to learn anything.
- If BOTH cpgnn_mixed ≈ cpgnn_frozen too, Risk 2 has fully triggered. In that case, add experiment 6c:

```python
# Add to V2_EXPERIMENTS in config.py ONLY if Risk 2 triggers:
"cpgnn_perturbation_trained": {
    **V2_BASELINE_CONFIG,
    "controller_type": "cpg_nn",
    "encoding": "cpg_nn",
    "terrain": "flat",
    "seed_from": "cpg_baseline",
    "perturbation_during_training": True,  # Random pushes during fitness evaluation
    "perturbation_range": [200, 600],       # Lower range than test pushes
},
```
See stride_v3.md Section 28 Risk 2 for full mitigations.

**Risk 3 check**: If cpgnn_random_init never converges (mean fitness < 100), this is expected and validates cascade seeding.

### Step 4: Validate results

After all experiments complete, run a validation script that:
1. Checks all 9 .pkl files exist: cpg_baseline, cpg_hill, cpg_mixed, cpgnn_flat, cpgnn_mixed, cpgnn_frozen, cpgnn_high_mutation, cpgnn_2x_budget, cpgnn_random_init
2. Each has ≥25 valid runs out of 30
3. Prints mean/best/worst fitness for each
4. cpg_baseline mean > 300
5. cpgnn_frozen mean ≈ cpg_baseline mean (NN frozen = pure CPG passthrough)
6. cpgnn_flat gen 1 fitness >> cpgnn_random_init gen 1 fitness (cascade seeding works)
7. No NaN/Inf values
8. Print convergence data summary: does each experiment save best_chromosome per generation? (Needed for Phase C CPG phase convergence figure)

## Estimated Time
~6-8 hours total computation. Run overnight.
