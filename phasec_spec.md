# PHASE C: Visualizations — All 24 Report Figures

**Give this entire file to Claude Code. Run AFTER Phase B completes.**

## Context

All experiment data exists in experiments/results/:
- V1: baseline.pkl + 16 other experiment .pkl files
- V2 GA: cpg_baseline.pkl, cpgnn_flat.pkl, cpgnn_mixed.pkl, cpgnn_frozen.pkl, cpgnn_random_init.pkl, etc.
- V2 Stats: v2_stats.csv, v2_stat_tests.csv
- Post-hoc: transfer_results.pkl, perturbation_results.pkl, landscape_results.pkl, ablation_results.pkl, gait_results.pkl, nn_output_recordings.pkl

V1 visualization scripts already exist in visualization/ (11 files). Now create 13 new v2 scripts and update 2 existing v1 scripts. That makes all 24 figures from stride_v3.md Section 6.

All figures: 300 DPI PNG saved to report/figures/. Clear labels, readable fonts, no overlapping text.

## Complete Figure Checklist (24 total)

### V1 Figures (11) — Already Exist, But Update #4 and #5

These v1 scripts already exist in visualization/:
1. creature_diagram.py → creature_diagram.png ✓ (no changes needed)
2. encoding_diagram.py → encoding_diagram.png ✓ (no changes needed)
3. flowchart.py → ga_flowchart.png ✓ (no changes needed)
4. convergence_plot.py → **UPDATE for v2** (see #22 below)
5. box_plots.py → **UPDATE for v2** (see #23 below)
6. diversity_plot.py → diversity_*.png ✓ (no changes needed)
7. heatmap.py → heatmap_*.png ✓ (no changes needed)
8. skeleton_trail.py → skeleton_trail.png ✓ (no changes needed)
9. generation_replay.py → evolution_snapshots.png ✓ (no changes needed)
10. side_by_side.py → race_comparison.png ✓ (no changes needed)
11. family_tree.py → family_tree.png ✓ (no changes needed)

### V2 Figures (13) — All Must Be Created

---

**Figure 12: Controller Architecture Diagram**
File: visualization/controller_architecture.py → report/figures/controller_architecture.png

3-panel diagram showing:
- Sine: genes → sin(2πft + φ) → motor targets → PD controller
- CPG: genes → Kuramoto oscillators (with coupling arrows between oscillators) → motor targets → PD
- CPG+NN: genes → CPG + (sensors → NN → modulation) → final targets → PD

Use matplotlib patches/arrows, not images. Color-code: oscillators=blue, coupling=green, NN=amber, sensors=red.

---

**Figure 13: Transfer Testing Heatmap**
File: visualization/transfer_heatmap.py → report/figures/transfer_heatmap.png

- 4 rows (controllers: sine, CPG, CPG+NN flat, CPG+NN mixed) × 5 columns (flat, hill, mixed, noise 5%, noise 10%)
- Color = absolute fitness (diverging colormap: red=low, green=high)
- Annotate each cell with mean ± std
- Load from: transfer_results.pkl

---

**Figure 14: Epistasis Matrix**
File: visualization/epistasis_matrix.py → report/figures/epistasis_matrix.png

- 18×18 heatmap (sine genes only)
- Color: diverging (blue=negative, white=zero, red=positive epistasis)
- Gene labels on axes (hip_L_amp, hip_L_freq, hip_L_phase, knee_L_amp, ...)
- Second subplot: consistency matrix (mean/std across 5 reference points, values >3 = robust)
- Load from: landscape_results.pkl

---

**Figure 15: CPG Phase Convergence** ⚠️
File: visualization/cpg_phase_convergence.py → report/figures/cpg_phase_convergence.png

**This figure shows how CPG oscillator coupling phases evolve over generations.**

- X-axis: generation (0 to 75)
- Y-axis: phase values (0 to 2π) of the 6 oscillators from the best individual
- Extract from cpg_baseline.pkl convergence data: each generation's best_chromosome → decode CPG coupling phases
- Overlay 5-10 representative runs (thin lines) + mean trajectory (bold)
- Highlight: do hip phases converge to ~π anti-phase? (walking = left-right alternation)
- If convergence data doesn't save best_chromosome per generation, reconstruct by running the best final chromosome backward isn't possible — instead, load the per-generation best chromosome from the GA run history. If run_ga_v2 only saves best_fitness per generation and not best_chromosome, this figure needs the convergence_history to include chromosomes. **Check if this data exists first.** If not, run 5 short CPG evolutions (pop=50, gen=75) saving full chromosomes, just for this figure.
- Load from: cpg_baseline.pkl (check for convergence[gen]["best_chromosome"])

---

**Figure 16: Cost of Transport Bar Chart**
File: visualization/cost_of_transport.py → report/figures/cost_of_transport.png

- Grouped bar chart: sine, CPG, CPG+NN (flat), CPG+NN (mixed)
- Error bars (std across 30 creatures)
- Lower CoT = more efficient
- Load from: gait_results.pkl

---

**Figure 17: Push Recovery Filmstrip**
File: visualization/push_filmstrip.py → report/figures/push_filmstrip.png

**Most memorable figure in the report** (stride_v3.md Section 24 Idea B).

- 2 rows: Sine (top), CPG+NN (bottom)
- 4 columns: t=7.4s (before push), t=7.6s (impact), t=8.0s (stumbling), t=9.0s (result)
- Render stick figures at each timestamp from recorded simulation
- Arrow showing push direction at t=7.6s
- "FELL" / "RECOVERED" label on last column
- Need to run record=True simulations for the best sine and best CPG+NN creature with push at t=7.5s (moderate push strength, e.g. 1500)

---

**Figure 18: NN Output Time-Series**
File: visualization/nn_output_viz.py → report/figures/nn_output_timeseries.png

- 4 stacked subplots sharing x-axis (time 0-5s):
  - Subplot 1: 6 sensor inputs over time (different colors per sensor)
  - Subplot 2: 6 NN modulation outputs (tanh values, [-1, 1]) — plot tanh directly, NOT recovered ratio (Errata Fix 3)
  - Subplot 3: 6 CPG target angles
  - Subplot 4: 6 final target angles (CPG × modulation)
- Use one representative CPG+NN creature
- Load from: nn_output_recordings.pkl

---

**Figure 19: Sensor Ablation Bar Chart**
File: visualization/sensor_ablation_bars.py → report/figures/sensor_ablation_bars.png

- Horizontal bars: % fitness drop per ablated sensor
- Two groups side-by-side or two subplots: CPG+NN flat-trained, CPG+NN mixed-trained
- Error bars (std across 10 creatures)
- Sorted by drop magnitude
- Load from: ablation_results.pkl

---

**Figure 20: Gene Sensitivity Bar Chart**
File: visualization/gene_sensitivity_bars.py → report/figures/gene_sensitivity_bars.png

- Two subplots: sine (18 bars) and CPG (38 bars)
- Horizontal bar chart of mean sensitivity values (averaged across 5 refs)
- Color-code by gene type: amplitude=blue, frequency=green, phase=orange, coupling=red (CPG only)
- Load from: landscape_results.pkl

---

**Figure 21: Gait Symmetry Histogram**
File: visualization/gait_symmetry_hist.py → report/figures/gait_symmetry_histogram.png

- Histogram of mean phase difference (0 to π) for each controller
- 3 overlaid histograms: sine (blue), CPG (green), CPG+NN (amber)
- Vertical dashed lines at π (walking) and 0 (hopping)
- Note excluded sine creatures (incommensurate frequencies) as text annotation
- Load from: gait_results.pkl

---

**Figure 22: Seeded vs Random Convergence**
File: visualization/seeded_vs_random_convergence.py → report/figures/seeded_vs_random_convergence.png

- Two convergence curves: cpgnn_flat (seeded, amber) vs cpgnn_random_init (gray)
- 30 runs overlaid (thin semi-transparent lines) + bold mean line + shaded std band
- X-axis: generation, Y-axis: best fitness
- Annotate G_80 for each with vertical dashed line
- Load from: cpgnn_flat.pkl and cpgnn_random_init.pkl convergence histories

---

**Figure 23: Behavioral Fingerprint Radar Chart**
File: visualization/behavioral_radar.py → report/figures/behavioral_radar.png

- Spider/radar chart with 8 axes: distance, avg_speed, step_frequency, duty_factor, double_support, torso_stability, CoT_inverted (1/CoT normalized), gait_symmetry
- 3 overlaid polygons: sine (blue), CPG (green), CPG+NN (amber)
- Values normalized to [0, 1] range across all controllers (min-max normalization)
- Load from: gait_results.pkl

---

**Figure 24: Perturbation Survival Curve**
File: visualization/push_survival_curve.py → report/figures/push_survival_curve.png

- X-axis: push strength (500, 1500, 3000, 5000)
- Y-axis: survival rate (0-100%)
- 4 lines: sine (blue), CPG (green), CPG+NN flat (amber), CPG+NN mixed (red)
- Add significance stars from Fisher's exact test at each strength level
- Load from: perturbation_results.pkl

---

### V1 Figure Updates (2)

**Update #4: Convergence Plot for V2 Controllers**
File: visualization/convergence_plot.py (update existing) → report/figures/convergence_v2_controllers.png

- NEW figure showing v2 controller convergence alongside v1 sine
- Curves: sine baseline (blue), CPG (green), CPG+NN flat (amber), CPG+NN mixed (red), CPG+NN frozen (gray dashed)
- 30 runs overlaid per controller, bold mean lines, shaded std bands
- Keep original v1 convergence figures too (don't delete them)

**Update #5: Box Plots for V2 Controllers**
File: visualization/box_plots.py (update existing) → report/figures/boxplot_controllers.png

- NEW figure: "Controller Comparison" box plot
- Boxes: sine, CPG, CPG+NN flat, CPG+NN mixed, CPG+NN frozen, CPG+NN random_init
- Color-code by controller type
- Keep original v1 box plot figures too

---

**Also generate (bonus, from Section 24 Idea A):**

**FDC Scatter Plot** (not numbered in the 24, but needed for Section 5.6):
File: visualization/fdc_scatter.py → report/figures/fdc_scatter.png

- Scatter: x=distance to best known, y=fitness
- Two subplots: sine (18 genes) and CPG+NN (96 genes)
- 2,000 points each, colored by density
- Best-fit regression line, FDC value annotated
- Load from: landscape_results.pkl

---

## Run All

```bash
# New v2 scripts (13)
python visualization/controller_architecture.py
python visualization/transfer_heatmap.py
python visualization/epistasis_matrix.py
python visualization/cpg_phase_convergence.py
python visualization/cost_of_transport.py
python visualization/push_filmstrip.py
python visualization/nn_output_viz.py
python visualization/sensor_ablation_bars.py
python visualization/gene_sensitivity_bars.py
python visualization/gait_symmetry_hist.py
python visualization/seeded_vs_random_convergence.py
python visualization/behavioral_radar.py
python visualization/push_survival_curve.py

# Bonus
python visualization/fdc_scatter.py

# Updated v1 scripts
python visualization/convergence_plot.py
python visualization/box_plots.py
```

## Success Criteria
- [ ] All 13 new v2 PNG files exist in report/figures/ at 300 DPI
- [ ] 2 updated v1 PNG files exist (convergence_v2_controllers, boxplot_controllers)
- [ ] FDC scatter PNG exists
- [ ] CPG phase convergence shows oscillator phases over generations (if data available)
- [ ] Push filmstrip clearly shows sine falling and CPG+NN recovering
- [ ] NN output time-series shows reactive modulation (not flat lines)
- [ ] Behavioral radar has 3 distinct polygon shapes
- [ ] All labels readable, no overlapping text
- [ ] Total: at least 16 new/updated PNGs in report/figures/

## Estimated Time
~5-6 hours implementation.
