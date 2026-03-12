# PHASE D: Update PDF Report with V2 Content

**Give this entire file to Claude Code. Run AFTER Phase C completes.**

## Context

Everything needed for the report now exists:
- All experiment .pkl files (v1 + v2)
- All post-hoc analysis results (transfer, perturbation, landscape, ablation, gait, NN recordings)
- Statistical analysis: v2_stats.csv, v2_stat_tests.csv (from Phase B Step 0)
- All 24+ figures in report/figures/ (11 v1 + 13 v2 + FDC scatter)
- V1 report already exists (report/generate_report.py generates the PDF)

The v1 report is ~20-25 pages. The v2 report should be 28-33 pages. Read stride_v3.md Sections 7, 17, 18, 19, 20, 21, 23, 25 for full specifications.

## What To Do

### Update report/generate_report.py

The existing v1 report generator needs significant expansion.

---

### NEW Methodology Sections (3.4-3.10)

- **3.4** Sine controller (motor equation, already in v1 but needs formalization)
- **3.5** CPG controller: Kuramoto dynamics formula, coupling topology diagram, 38-gene layout
  - Phase dynamics: dφ_i/dt = 2π·f_i + Σ_j(w_ij · sin(φ_j - φ_i + Φ_ij))
  - Embed: controller_architecture.png (CPG panel)
- **3.6** CPG+NN controller: sensor system (18D → 6D reduced), NN architecture (6→4→6), modulation formula
  - Modulation: final_i = cpg_i × (1 + 0.5 × m_i)
  - 96-gene layout breakdown
  - Embed: controller_architecture.png (CPG+NN panel)
- **3.7** GA operators (keep from v1, add pseudocode blocks from stride_v3.md Section 18)
- **3.8** Fitness function (keep from v1, add CoT formula)
- **3.9** Terrain system (keep from v1)
- **3.10** Gait analysis metrics: symmetry formula, CoT formula, behavioral fingerprint definition

---

### NEW Results Sections (5.1-5.9)

- **5.1** Controller comparison
  - Table 1 (from v2_stats.csv): mean, std, best, worst, CoT, G_80 for all controllers
  - Embed: convergence_v2_controllers.png, boxplot_controllers.png
  
- **5.2** Frozen-NN control + seeded vs random init
  - Table 7 (from v2_stats.csv): gen 1 fitness, G_80, final fitness for seeded vs random
  - Embed: seeded_vs_random_convergence.png
  - Discussion: frozen-NN isolates dimensionality from feedback; seeded init validates cascade

- **5.3** Transfer testing
  - Table 2 (from transfer_results.pkl): 4×5 grid with mean ± std
  - Embed: transfer_heatmap.png

- **5.4** Perturbation recovery
  - Table 3 (from perturbation_results.pkl): X/30 survive + Fisher's exact p-values
  - Embed: push_filmstrip.png, push_survival_curve.png

- **5.5** NN interpretability
  - Table 4 (from ablation_results.pkl): % fitness drop per sensor
  - Embed: sensor_ablation_bars.png, nn_output_timeseries.png

- **5.6** Fitness landscape
  - Table 5 (from landscape_results.pkl): FDC, epistasis, sensitivity values
  - Embed: fdc_scatter.png, epistasis_matrix.png, gene_sensitivity_bars.png

- **5.7** Gait analysis
  - Table 6 (from gait_results.pkl): walking rate, phase diff, stability, CoT
  - Embed: gait_symmetry_histogram.png, behavioral_radar.png, cost_of_transport.png
  - Also embed cpg_phase_convergence.png if available

- **5.8** Algorithm comparison (KEEP from v1 — GA vs CMA-ES vs PSO vs DE)
  - Tables 8-12 from v1 (selection, mutation, elitism, algorithm, encoding comparisons)
  - Keep existing v1 figures

- **5.9** GA parameter sensitivity (KEEP from v1)
  - Keep existing v1 tables and figures

**IMPORTANT**: Tables 8-12 are the v1 tables. They must be kept in the report. The spec says "Tables 8-12: Keep from v1."

---

### NEW Discussion Sections (6.1-6.9)

- **6.1** Does sensory feedback improve locomotion? (CPG+NN vs CPG vs sine)
- **6.2** Does training diversity enable generalization? (mixed vs flat transfer results)
- **6.3** Robustness: reactive vs open-loop control (push test interpretation)
- **6.4** What the NN learned (ablation + output interpretation)
- **6.5** Fitness landscape structure (FDC interpretation, epistasis patterns)
- **6.6** Evolution discovers biologically realistic gaits (symmetry, duty factor)
- **6.7** CPG seeding: warm start advantage (seeded vs random convergence speed)
- **6.8** Threats to validity — ALL 9 items from stride_v3.md "THREATS TO VALIDITY" section:
  1. Search space confound: 18 vs 38 vs 96 genes with same eval budget
  2. FDC locality: computed relative to local optima
  3. Epistasis scope: only sine (18 genes), CPG+NN uncharacterized
  4. 5-second sim for landscape: may reward fast starters
  5. Simulation fidelity: pymunk 2D simplified physics
  6. CoT units: simulation units only, not comparable to biology
  7. Transfer testing scope: limited terrain types and noise levels
  8. NN training on flat: limited sensor variation
  9. Perturbation specificity: only horizontal pushes
  - Also add: **Errata Fix 9** — Seeded vs random init diversity confound: "If random-init reaches higher final fitness despite slower convergence, the optimal CPG+NN solution may lie outside the basin of the pre-evolved CPG champion."
- **6.9** Future work (3D simulation, larger NN, NEAT, novelty search, sim-to-real)

---

### NEW Figures to Embed (15 total)

Insert at correct report locations:
1. controller_architecture.png — Section 3.5/3.6
2. convergence_v2_controllers.png — Section 5.1
3. boxplot_controllers.png — Section 5.1
4. seeded_vs_random_convergence.png — Section 5.2
5. transfer_heatmap.png — Section 5.3
6. push_filmstrip.png — Section 5.4
7. push_survival_curve.png — Section 5.4
8. sensor_ablation_bars.png — Section 5.5
9. nn_output_timeseries.png — Section 5.5
10. fdc_scatter.png — Section 5.6
11. epistasis_matrix.png — Section 5.6
12. gene_sensitivity_bars.png — Section 5.6
13. gait_symmetry_histogram.png — Section 5.7
14. behavioral_radar.png — Section 5.7
15. cost_of_transport.png — Section 5.7
16. cpg_phase_convergence.png — Section 5.7 (if available)

Handle missing figures gracefully: check if file exists before embedding, use placeholder text if missing.

---

### NEW Tables (7) + Keep V1 Tables (5)

**New v2 tables** (populate from .pkl files and .csv files):
- Table 1: Controller Comparison (mean, std, best, worst, CoT, G_80)
- Table 2: Transfer Testing (4×5 grid with mean ± std)
- Table 3: Perturbation Recovery (X/30 survive + Fisher p-values)
- Table 4: Sensor Ablation (% fitness drop per sensor)
- Table 5: Fitness Landscape Metrics (FDC, epistasis, sensitivity)
- Table 6: Gait Characteristics (walking rate, phase diff, stability, CoT)
- Table 7: Seeded vs Random Init (gen 1 fitness, G_80, final fitness)

**Keep v1 tables** (already generated):
- Table 8: Selection method comparison
- Table 9: Mutation rate comparison
- Table 10: Elitism comparison
- Table 11: Algorithm comparison (GA vs CMA-ES vs PSO vs DE)
- Table 12: Encoding comparison (direct vs indirect)

---

### Updated Notation Table

Keep v1 symbols and add v2 symbols from stride_v3.md "NOTATION TABLE" section:
- w_ij: coupling weight between oscillators i and j
- Φ_ij: coupling phase offset
- φ_i: oscillator phase
- f_i: oscillator intrinsic frequency
- m_i: NN modulation output for joint i
- W1, b1: NN hidden layer weights and biases
- W2, b2: NN output layer weights and biases
- CoT: cost of transport
- D(g): population diversity at generation g

---

### Updated Citations

Keep v1 references 1-8 and add from stride_v3.md Section 19:
- [9] Ijspeert, A. J. (2008). "Central Pattern Generators for Locomotion Control in Animals and Robots." Neural Networks 21(4). DOI: 10.1016/j.neunet.2008.03.014
- [10] Jones, T. & Forrest, S. (1995). "Fitness Distance Correlation as a Measure of Problem Difficulty for GAs." ICGA '95.
- [11] Mouret, J.-B. & Clune, J. (2015). "Illuminating Search Spaces by Mapping Elites." arXiv:1504.04909

Software citations: pymunk, matplotlib, scipy, numpy, reportlab, p2.js, React, Recharts

---

### Mathematical Formulas (from stride_v3.md Section 17)

Include ALL formulas in methodology:
- Motor control: θ_j(t) = A_j · sin(2π · ω_j · t + φ_j)
- CPG: dφ_i/dt = 2π·f_i + Σ_j(w_ij · sin(φ_j - φ_i + Φ_ij))
- Modulation: final_i = cpg_i × (1 + 0.5 × m_i)
- Fitness: F(x) = Δx - α·E(x) - β·C(x) + γ·U(x)
- Energy: E(x) = (1/S) · Σ Σ |τ_j|
- Uprightness: U(x) = (1/S) · Σ max(0, cos(θ_torso))
- CoT: total_energy / (mass × distance × gravity)
- Selection: tournament, roulette (with shift), rank-based (with s=1.5)
- Crossover: single-point, two-point, uniform
- Mutation: fixed Gaussian, adaptive p_m(g) = max(0.01, p_m0·(1-g/G))
- Sharing: f_shared(x_i) = f(x_i) / Σ_j sh(d(x_i, x_j))
- Statistics: Wilcoxon, Cohen's d, rank-biserial r, G_80, Fisher's exact

---

### Pseudocode Blocks (from stride_v3.md Section 18)

Include all 4 pseudocode blocks in monospace Courier 9pt with gray background (#F0F0F0):
1. Main GA algorithm
2. Tournament Selection
3. Roulette Wheel Selection
4. Adaptive Gaussian Mutation

---

### Styling Rules (from stride_v3.md Section 7)

- Body: Times-Roman 11pt, 1.15 line spacing
- Section headers: 14pt bold, subsection: 12pt bold
- Pseudocode: Courier 9pt, gray background (#F0F0F0)
- Margins: 1 inch (72pt) all sides
- Page numbers: bottom center, starting from page 2
- Figure captions below: "Figure X: description"
- Table captions above: "Table X: description"
- **CRITICAL**: No Unicode subscripts (₀₁₂). Use reportlab `<sub>` and `<super>` tags.

---

### Output

```bash
python report/generate_report.py
cp report/stride_report.pdf /mnt/user-data/outputs/
```

## Success Criteria
- [ ] PDF generates without errors
- [ ] PDF is 28-33 pages
- [ ] All 7 new v2 tables populated with real data (no "—" placeholders)
- [ ] All 5 v1 tables (8-12) still present with data
- [ ] All 15+ v2 figures embedded at correct locations
- [ ] All 11 v1 figures still present
- [ ] All formulas rendered correctly (no black boxes from Unicode subscripts)
- [ ] All 4 pseudocode blocks in monospace with gray background
- [ ] Notation table includes v2 symbols
- [ ] References 1-11 complete with DOIs
- [ ] Threats to validity: all 9 items + Errata Fix 9 diversity confound
- [ ] Discussion sections 6.1-6.9 present with substantive content
- [ ] Page numbers work (starting from page 2)

## Estimated Time
~4-6 hours implementation.

---

## Appendix: Viva Preparation (from stride_v3.md Section 25)

After the report is generated, also prepare these 5 Q&A for your viva defense:

**Q1: Why CPG and CPG+NN rather than just a bigger NN?**
A: Biological architecture argument. Real locomotion uses CPGs in the spinal cord with cortical modulation. Three-tier comparison tests whether each layer of complexity helps. Frozen-NN isolates dimensionality from feedback.

**Q2: How do you know the improvement isn't just more parameters?**
A: The frozen-NN experiment (96 genes, NN locked at 0.5 = zero modulation). If CPG+NN beats frozen-NN, improvement is from sensory feedback, not search space size.

**Q3: What did the neural network actually learn?**
A: Sensor ablation shows which inputs matter. NN output time-series shows reactive patterns (torso tilts → hip modulation increases). It learned balance-correction, not walking (CPG handles walking).

**Q4: The push test is dramatic. What does it prove quantitatively?**
A: Fisher's exact test p-values. The mechanism is visible in NN time-series: after push, torso_angle sensor spikes → NN modulation increases hip extension → creature catches itself.

**Q5: What are the main limitations?**
A: Search space confound (18 vs 96 genes), epistasis not computed for CPG+NN, CoT in simulation units, only horizontal pushes, pymunk 2D simplified. All in Threats to Validity.
