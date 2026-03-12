# PROJECT SPEC: STRIDE — Evolving 2D Walkers Using Genetic Algorithms

## Project Overview
Build a complete Genetic Algorithm system that evolves 2D stick-figure creatures to learn to walk. The project includes the GA implementation, physics simulation, visualization suite, statistical analysis, and a PDF report for a CIA-3 university submission.

**Student**: Dev Krishna, 3rd Year Data Science, CHRIST University Pune (Reg: 23112015)
**Deadline**: This week
**Output**: Python codebase + PDF report
**Target Report Length**: 20-25 pages (including figures and tables)

---

## Architecture

```
stride/
├── src/
│   ├── __init__.py
│   ├── creature.py          # Stick figure body definition + joint physics
│   ├── physics_sim.py       # Pymunk simulation environment
│   ├── encoding.py          # Direct & indirect chromosome encoding
│   ├── ga_core.py           # Core GA engine (selection, crossover, mutation)
│   ├── fitness.py           # Fitness evaluation (distance traveled)
│   ├── terrain.py           # Terrain generators (flat, hill, mixed)
│   ├── config.py            # All hyperparameters and experiment configs
│   ├── random_search.py     # Random search baseline for comparison
│   └── utils.py             # Helper functions + error handling
├── experiments/
│   ├── run_experiments.py   # Master experiment runner (30 runs × variants)
│   ├── analyze_results.py   # Statistical analysis + tables + plots
│   └── results/             # Output directory for experiment data
├── visualization/
│   ├── generation_replay.py # Show best creature per generation walking
│   ├── skeleton_trail.py    # Motion-capture style afterimage trails
│   ├── side_by_side.py      # Race best walkers from different runs
│   ├── family_tree.py       # Lineage/genealogy visualization
│   ├── convergence_plot.py  # Fitness over generations (all 30 runs overlaid)
│   ├── diversity_plot.py    # Population diversity over generations
│   ├── box_plots.py         # Box plots for 30-run distributions
│   ├── heatmap.py           # Joint parameter evolution heatmap
│   ├── creature_diagram.py  # Labeled stick figure diagram for report
│   ├── flowchart.py         # GA pipeline flowchart for report
│   ├── encoding_diagram.py  # Visual diagram of direct vs indirect encoding
│   └── save_frames.py       # Export frames/GIFs for the report
├── report/
│   ├── generate_report.py   # Builds the PDF report using reportlab
│   └── figures/             # Generated figures for the report
├── main.py                  # Entry point
├── requirements.txt
└── README.md
```

---

## BUILD PHASES

This project MUST be built in 5 phases. Each phase has a validation checkpoint that MUST pass before moving to the next phase. Do NOT skip phases or combine them.

### PHASE 1: Physics Foundation
**Files**: `src/creature.py`, `src/physics_sim.py`, `src/terrain.py`, `src/fitness.py`
**Goal**: Get ONE creature to exist in a physics world, move, and return a fitness value.

**Claude Code Prompt**:
```
Read SPEC.md sections 1, 4, 5, and the Edge Cases section.
Build Phase 1: creature.py, physics_sim.py, terrain.py, fitness.py.
Also create src/__init__.py.

Create a test script test_phase1.py that:
1. Creates flat, hill, and mixed terrains — prints terrain height at x=0, 300, 400
2. Spawns 5 random creatures on flat terrain
3. Simulates each for 10 seconds
4. Prints distance traveled for each
5. Verifies: no NaN fitness, no negative distances from stuck creatures, 
   at least 1 creature moved >0 distance
6. Tests edge case: creature with all-zero genes (should not crash)
7. Tests edge case: creature with all-one genes (should not crash)

Expected output: 5 fitness values, all finite numbers. At least some > 0.
If creatures explode or return NaN, fix the physics before proceeding.
```

**Validation Checkpoint**:
- [ ] 5 random creatures simulate without crashing
- [ ] All fitness values are finite (no NaN, no Inf)
- [ ] At least 1 creature has fitness > 0
- [ ] All-zero and all-one gene creatures don't crash
- [ ] Terrain height functions return correct values

---

### PHASE 2: GA Engine
**Files**: `src/encoding.py`, `src/ga_core.py`, `src/config.py`, `src/random_search.py`, `src/utils.py`
**Goal**: Full GA that evolves creatures. Verify fitness increases over generations.

**Claude Code Prompt**:
```
Read SPEC.md sections 2, 3, 6, 7, 13, and the Edge Cases section.
Build Phase 2: encoding.py, ga_core.py, config.py, random_search.py, utils.py.

Use the creature/physics from Phase 1 (import from src/).

Create test_phase2.py that:
1. Runs a QUICK GA: population=20, generations=30, flat terrain, tournament selection
2. Prints best fitness per generation (should generally increase)
3. Runs the same with indirect encoding — verify it works
4. Runs random search with same budget (20×30=600 evaluations)
5. Compares: GA best > random search best (GA should win)
6. Tests edge case: all creatures get zero fitness in gen 1 (roulette should not crash)
7. Tests edge case: two identical parents in crossover (should produce valid children)
8. Tests adaptive mutation: verify rate decreases over generations
9. Tests elitism: verify best individual survives to next generation unchanged

Expected: fitness should increase from gen 1 to gen 30. GA should beat random.
If fitness is flat or decreasing, there's a bug in selection/crossover/mutation.
```

**Validation Checkpoint**:
- [ ] Best fitness increases over 30 generations
- [ ] All 3 selection methods work (tournament, roulette, rank)
- [ ] Both encodings work (direct, indirect)
- [ ] Random search runs and returns results
- [ ] GA beats random search
- [ ] Edge cases handled without crashes
- [ ] Adaptive mutation rate decreases correctly
- [ ] Elitism preserves best individual

---

### PHASE 3: Experiment Pipeline
**Files**: `experiments/run_experiments.py`, `main.py`
**Goal**: Run all P0 experiments (30 runs each) with checkpointing and error recovery.

**Claude Code Prompt**:
```
Read SPEC.md sections 7, 12, 13, and the Edge Cases section.
Build Phase 3: experiments/run_experiments.py and main.py.

Use GA engine from Phase 2 (import from src/).

Create experiments/results/ directory.

The experiment runner must:
1. Accept --priority flag (p0, p1, p2, all)
2. Accept --validate flag (quick sanity check before running)
3. For each experiment config, run 30 independent runs with seeds 42-71
4. Save results to experiments/results/{experiment_name}.pkl
5. Checkpoint every 5 runs
6. Resume from checkpoint if interrupted
7. Log everything to experiments/results/experiment_log.txt
8. Handle crashed runs gracefully (log error, assign None, continue)
9. Print progress bar with tqdm
10. Print estimated time remaining
11. Use multiprocessing.Pool for parallelization (use cpu_count - 1 workers)

Run P0 experiments first. If any experiment takes >2 hours, reduce generations to 100.

Test by running: python main.py --validate
Then: python main.py --priority p0
```

**Validation Checkpoint**:
- [ ] --validate passes (quick sanity check)
- [ ] Baseline experiment completes 30 runs
- [ ] Results saved to .pkl files
- [ ] Checkpointing works (kill and resume test)
- [ ] Log file contains run details
- [ ] At least P0 experiments complete

---

### PHASE 4: Analysis & Visualization
**Files**: `experiments/analyze_results.py`, all `visualization/*.py` files
**Goal**: Generate all statistical tables, plots, and figures for the report.

**Claude Code Prompt**:
```
Read SPEC.md sections 9, 10, 14, 15, 17, and the Edge Cases section.
Build Phase 4: analyze_results.py and all visualization files.

Load experiment results from experiments/results/*.pkl (from Phase 3).

analyze_results.py must:
1. Load all completed experiment results
2. Generate per-experiment stats: mean, median, best, worst, std dev
3. Generate comparison tables (selection, mutation, elitism, encoding, terrain)
4. Run Wilcoxon rank-sum tests between baseline and each variant
5. Calculate effect sizes (Cohen's d)
6. Calculate convergence speed (G_80) for each experiment
7. Save all tables as CSV files in experiments/results/
8. Print summary to console

Visualization files must generate:
1. creature_diagram.py → report/figures/creature_diagram.png
2. encoding_diagram.py → report/figures/encoding_diagram.png
3. flowchart.py → report/figures/ga_flowchart.png
4. convergence_plot.py → report/figures/convergence_*.png (one per experiment + comparison)
5. box_plots.py → report/figures/boxplot_*.png (grouped by comparison type)
6. diversity_plot.py → report/figures/diversity_*.png
7. heatmap.py → report/figures/heatmap_*.png
8. skeleton_trail.py → report/figures/skeleton_trail.png
9. generation_replay.py → report/figures/evolution_snapshots.png
10. side_by_side.py → report/figures/race_comparison.png

All figures: 300 DPI, clear labels, readable fonts, no overlapping text.
Handle edge case: if an experiment has <30 successful runs, use what's available.
Handle edge case: if std dev = 0, note in the output rather than crashing.
```

**Validation Checkpoint**:
- [ ] All CSV stat tables generated
- [ ] Wilcoxon p-values computed
- [ ] All PNG figures generated at 300 DPI
- [ ] Creature diagram has labeled joints and gene mappings
- [ ] Convergence plots show 30 overlaid runs with mean line
- [ ] Box plots have readable labels
- [ ] No NaN values in any table

---

### PHASE 5: PDF Report
**Files**: `report/generate_report.py`
**Goal**: Generate the complete 20-25 page PDF report.

**Claude Code Prompt**:
```
Read SPEC.md sections 8, 10, 11, 16, 17, and the Edge Cases section.
Build Phase 5: report/generate_report.py.

Use reportlab to generate the PDF. Load figures from report/figures/ and
tables from experiments/results/.

The report must:
1. Be 20-25 pages total
2. Follow the exact section structure from SPEC.md Section 16
3. Include title page with student info
4. Include table of contents with page numbers
5. Include notation table at start of Section 3
6. Include all pseudocode blocks from SPEC.md Section 8 (monospace, gray background)
7. Include all mathematical formulas from SPEC.md Section 17
8. Include all figures from report/figures/ at appropriate locations
9. Include all data tables with proper formatting
10. Include full academic citations from SPEC.md Section 11
11. Use consistent fonts: Times-Roman for body, Courier for pseudocode
12. Margins: 1 inch all sides
13. Page numbers on every page except title page
14. Section headers: 14pt bold, subsections: 12pt bold
15. Body text: 11pt, 1.15 line spacing
16. Figure captions below each figure: "Figure X: description"
17. Table captions above each table: "Table X: description"

CRITICAL: Do NOT use Unicode subscript/superscript characters (₀₁₂ etc).
Use reportlab <sub> and <super> tags instead. Unicode subscripts render as
black boxes in reportlab's built-in fonts.

Generate to: report/stride_report.pdf
Then copy to: /mnt/user-data/outputs/stride_report.pdf
```

**Validation Checkpoint**:
- [ ] PDF generates without errors
- [ ] PDF is 20-25 pages
- [ ] All 5 rubric sections present
- [ ] Notation table present
- [ ] Pseudocode blocks rendered in monospace
- [ ] Formulas rendered correctly (no black boxes)
- [ ] All figures embedded
- [ ] All tables populated with real data
- [ ] References section complete
- [ ] Page numbers work

---

## 1. Creature Design (creature.py)

### Stick Figure Specification
- **Body**: Central torso (rectangle, ~60px × 20px)
- **Limbs**: 4 limbs (2 legs, 2 arms), each with 2 segments (upper + lower)
- **Joints**: 6 joints total (2 hip, 2 knee, 2 shoulder)
- **Each joint** has:
  - Oscillation amplitude (range: 0 to π/2)
  - Oscillation frequency (range: 0.5 to 5.0 Hz)
  - Phase offset (range: 0 to 2π)
- **Total genes per creature**: 6 joints × 3 params = 18 genes (direct encoding)

### Creature Diagram Specification (visualization/creature_diagram.py)
Generate a labeled diagram of the stick figure for the report. The diagram MUST include:
- Torso rectangle with dimensions labeled
- All 4 limbs drawn with upper and lower segments
- All 6 joints marked with circles and labeled (hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R)
- Arrows showing oscillation direction at each joint
- Annotations showing gene mapping: e.g., "Gene 0-2: hip_L (amplitude, frequency, phase)"
- Ground line shown below creature
- Color coding: torso=blue, upper limbs=green, lower limbs=orange, joints=red circles
- Title: "Creature Morphology and Gene Mapping"
- Save as: `report/figures/creature_diagram.png` at 300 DPI

### Physics Setup (pymunk)
- Gravity: (0, -981) pixels/sec²
- Ground: Static segment at y=50
- Limb segments: Dynamic bodies with mass proportional to length
- Joints: PivotJoint + RotaryLimitJoint for angle constraints
- Joint motors: SimpleMotor driven by sinusoidal pattern from genes
- Motor equation: `target_angle = amplitude * sin(2π * frequency * t + phase_offset)`
- Simulation time per creature: 10 seconds at 60 FPS = 600 steps
- Collision handling: Creature parts should NOT collide with each other (use collision filtering)

### Stability Safeguards
- Clamp all velocities to prevent explosion (max linear velocity: 1000)
- If torso y-position < 0 or > 500, terminate simulation early (creature fell or flew)
- If creature hasn't moved >5px in last 2 seconds, terminate early (stuck)

---

## 2. Chromosome Encoding (encoding.py)

### Direct Encoding
- Chromosome: array of 18 floats
- Each gene directly maps to one joint parameter
- Gene order: [hip1_amp, hip1_freq, hip1_phase, knee1_amp, ..., shoulder2_phase]
- Each gene normalized to [0, 1], decoded to actual range during simulation

### Indirect (Symmetry-Based) Encoding
- Chromosome: array of 9 floats (half the direct encoding)
- Left-side parameters are mirrored to right side with phase offset of π
- This enforces bilateral symmetry (like real organisms)
- Gene order: [hip_amp, hip_freq, hip_phase, knee_amp, knee_freq, knee_phase, shoulder_amp, shoulder_freq, shoulder_phase]

### Decoding Functions
```python
def decode_direct(chromosome):
    """Decode 18 normalized [0,1] genes to actual parameter ranges."""
    params = []
    for i in range(6):  # 6 joints
        amp = chromosome[i*3 + 0] * (math.pi / 2)        # [0, π/2]
        freq = chromosome[i*3 + 1] * 4.5 + 0.5            # [0.5, 5.0]
        phase = chromosome[i*3 + 2] * (2 * math.pi)        # [0, 2π]
        params.append((amp, freq, phase))
    return params

def decode_indirect(chromosome):
    """Decode 9 normalized [0,1] genes, mirror left to right with π phase shift."""
    params = []
    for i in range(3):  # 3 joint types (hip, knee, shoulder)
        amp = chromosome[i*3 + 0] * (math.pi / 2)
        freq = chromosome[i*3 + 1] * 4.5 + 0.5
        phase = chromosome[i*3 + 2] * (2 * math.pi)
        # Left side
        params.append((amp, freq, phase))
        # Right side: same amp and freq, phase offset by π
        right_phase = (phase + math.pi) % (2 * math.pi)
        params.append((amp, freq, right_phase))
    return params
```

### Phase Wrapping (Edge Case)
When mutating phase genes in indirect encoding, the phase offset for the right side must wrap correctly:
```python
right_phase = (left_phase + math.pi) % (2 * math.pi)
```
This ensures no discontinuity in gene space. The modulo operation prevents phase values from growing unbounded.

### Encoding Diagram (visualization/encoding_diagram.py)
Generate a visual comparison diagram for the report showing:
- Direct encoding: full 18-gene chromosome with color-coded gene-to-joint mapping
- Indirect encoding: 9-gene chromosome with arrows showing how left-side mirrors to right-side
- Side-by-side layout
- Title: "Direct vs Indirect Chromosome Encoding"
- Save as: `report/figures/encoding_diagram.png` at 300 DPI

---

## 3. GA Core Engine (ga_core.py)

### Population Initialization
- Random initialization within gene bounds [0, 1]
- Population sizes to test: 50, 100, 200

### Selection Methods (implement all three)

#### Tournament Selection
- Tournament size: k = 3 (also test 5 and 7)
- Select best from random tournament subset
- Repeat until mating pool is full

#### Roulette Wheel Selection
- Probability proportional to fitness
- Handle negative/zero fitness by shifting (see Edge Cases)
- ε = 1e-6 for numerical stability

#### Rank-Based Selection
- Sort by fitness, assign rank (worst=1, best=N)
- Selection pressure parameter: s = 1.5 (range [1.0, 2.0])
- Selection probability for rank i: P(i) = (2-s)/N + 2·i·(s-1) / (N·(N-1))

### Crossover Operators

#### Single-Point Crossover
Given parents p1 and p2 of length n:
```
Select random crossover point k ∈ {1, 2, ..., n-1}
child1 = p1[0:k] + p2[k:n]
child2 = p2[0:k] + p1[k:n]
```

#### Two-Point Crossover
```
Select random points k1, k2 where 1 ≤ k1 < k2 ≤ n-1
child1 = p1[0:k1] + p2[k1:k2] + p1[k2:n]
child2 = p2[0:k1] + p1[k1:k2] + p2[k2:n]
```

#### Uniform Crossover
```
For each gene i in range(n):
    if random() < 0.5:
        child1[i] = p1[i], child2[i] = p2[i]
    else:
        child1[i] = p2[i], child2[i] = p1[i]
```

- Default crossover operator: Single-point
- Crossover rates to test: 0.6, 0.8, 0.9

### Mutation Operators

#### Fixed Gaussian Mutation
- Each gene has probability p_m of being mutated
- Mutation: gene_i' = gene_i + N(0, σ²)
- Clamp: gene_i' = max(0, min(1, gene_i'))
- Mutation rates to test: 0.01, 0.05, 0.1
- σ = 0.1

#### Adaptive Mutation
- Decay formula: p_m(g) = max(p_min, p_m0 · (1 - g/G))
- p_m0 = 0.2 (initial rate)
- p_min = 0.01 (floor)
- G = max_generations
- σ remains constant at 0.1

### Elitism
- Top ⌈E × N⌉ individuals survive unchanged to next generation
- Test with E=0.0 (no elitism), E=0.05 (5%), E=0.10 (10%)
- Elite individuals are COPIED (deep copy), not referenced

### Island Model (Advanced)
- Split population into K=4 sub-populations (islands) of size N/K each
- Each island evolves independently with its own selection/crossover/mutation
- Migration: every M=20 generations, top 2 individuals from each island migrate to the next island (ring topology)
- Migration formula: island_i sends top 2 to island_{(i+1) % K}
- Immigrants replace worst 2 individuals in receiving island

### Fitness Sharing / Niching
- Genotype distance: d(x_i, x_j) = ||x_i - x_j||₂ (Euclidean distance in normalized gene space)
- Sharing function: sh(d) = 1 - (d / σ_share)^α if d < σ_share, else 0
- α = 1.0 (linear sharing)
- σ_share = 0.3 (sharing radius in normalized [0,1]^n space)
- Shared fitness: f'(x_i) = f(x_i) / Σ_{j=1}^{N} sh(d(x_i, x_j))
- Note: the sum always includes sh(d(x_i, x_i)) = 1, so denominator ≥ 1

---

## 4. Fitness Function (fitness.py)

### Primary Fitness (Mathematical Formulation)

The fitness function is defined as:

```
f(x) = Δx_torso = x_torso(T_sim) - x_torso(0)
```

Where:
- x = chromosome vector ∈ [0,1]^n (n=18 for direct, n=9 for indirect)
- x_torso(t) = horizontal position of torso center of mass at time t
- T_sim = 10 seconds (simulation duration)

### Extended Fitness with Penalties

```
F(x) = Δx_torso - α · E(x) - β · C(x) + γ · U(x)
```

Where:

**Energy penalty** (discrete time sum over S simulation steps):
```
E(x) = (1/S) · Σ_{t=0}^{S-1} Σ_{j=1}^{6} |τ_j(t · Δt)|
```
- τ_j(t) = torque applied at joint j at time t
- S = T_sim × FPS = 10 × 60 = 600 steps
- Δt = 1/FPS = 1/60 seconds
- Normalized by S to make it scale-independent

**Fall count**:
```
C(x) = number of simulation steps where y_torso < y_ground + torso_height/2 + ε
```
- ε = 5 pixels (contact threshold)
- This counts frames where the torso is touching or below ground

**Uprightness bonus** (discrete time sum):
```
U(x) = (1/S) · Σ_{t=0}^{S-1} max(0, cos(θ_torso(t · Δt)))
```
- θ_torso(t) = angle of torso body relative to horizontal (radians)
- cos(0) = 1 when perfectly upright, cos(π/2) = 0 when sideways
- max(0, ...) ensures no negative contribution when upside down

**Penalty weights**:
- α = 0.1 (energy penalty weight)
- β = 0.5 (fall penalty weight)
- γ = 10.0 (uprightness bonus weight)

### Optimization Problem Statement
```
Maximize F(x)
Subject to:
    x_i ∈ [0, 1]  for all i ∈ {1, ..., n}
    ||v_body(t)|| ≤ v_max = 1000  for all bodies, for all t ∈ [0, T_sim]
    y_torso(t) ∈ [0, 500]  for all t ∈ [0, T_sim]  (early termination bounds)
```

---

## 5. Terrain System (terrain.py)

### Flat Terrain
- Ground height function: h(x) = 50 for all x
- Implemented as a single static line segment from x=-1000 to x=10000

### Hill Terrain
- Ground height function:
```
h(x) = 50                                              if x < 300 or x > 500
h(x) = 50 + 50 · sin(π · (x - 300) / 200)            if 300 ≤ x ≤ 500
```
- Implemented as a series of line segments approximating the curve (use 50 segments for smoothness)

### Mixed Terrain
- Alternating flat and hill sections every 300px:
```
h(x) = 50 + 50 · sin(π · ((x mod 300) / 200))   if (x mod 600) ∈ [300, 500]
h(x) = 50                                          otherwise
```

### Gap Terrain (stretch goal)
- No ground from x=300 to x=350:
```
h(x) = 50        if x < 300 or x > 350
h(x) = -1000     if 300 ≤ x ≤ 350  (effectively no ground)
```

### Terrain Bounds (Edge Case)
For any terrain query where x is beyond the defined range:
```python
def get_height(self, x):
    """Return terrain height at position x. Clamp to defined bounds."""
    x = max(-1000, min(10000, x))  # Clamp to terrain bounds
    return self._height_function(x)
```

---

## 6. Random Search Baseline (src/random_search.py)

### Purpose
Provide a non-evolutionary baseline to demonstrate that GA actually outperforms random sampling.

### Implementation
```python
def random_search(config, seed):
    """Random search baseline using same evaluation budget as GA."""
    np.random.seed(seed)
    random.seed(seed)
    
    n_genes = 18 if config["encoding"] == "direct" else 9
    total_evaluations = config["population_size"] * config["max_generations"]
    
    best_fitness = -float('inf')
    best_chromosome = None
    
    # Track convergence (best found so far at each "generation equivalent")
    convergence = []
    evals_per_gen = config["population_size"]
    
    for i in range(total_evaluations):
        chromosome = np.random.uniform(0, 1, n_genes)
        fitness = safe_simulate(chromosome, config["terrain"], config)
        
        if fitness > best_fitness:
            best_fitness = fitness
            best_chromosome = chromosome.copy()
        
        # Record at generation-equivalent intervals
        if (i + 1) % evals_per_gen == 0:
            convergence.append(best_fitness)
    
    return {
        "best_fitness": best_fitness,
        "best_chromosome": best_chromosome,
        "convergence": convergence
    }
```

---

## 7. Experiment Configuration (config.py)

```python
BASELINE_CONFIG = {
    "population_size": 100,
    "max_generations": 150,
    "crossover_rate": 0.8,
    "mutation_rate": 0.05,
    "mutation_sigma": 0.1,
    "tournament_size": 3,
    "elitism_rate": 0.05,
    "selection_method": "tournament",
    "crossover_method": "single_point",
    "encoding": "direct",
    "terrain": "flat",
    "simulation_time": 10.0,
    "simulation_fps": 60,
    "num_runs": 30,
    "seed_start": 42,
    "fitness_weights": {"alpha": 0.1, "beta": 0.5, "gamma": 10.0},
    "island_model": False,
    "fitness_sharing": False,
}

EXPERIMENTS = {
    # --- Baseline + Random Search ---
    "baseline": BASELINE_CONFIG,
    "random_search": {**BASELINE_CONFIG, "method": "random"},

    # --- Encoding Comparison ---
    "indirect_encoding": {**BASELINE_CONFIG, "encoding": "indirect"},

    # --- Selection Method Comparison ---
    "roulette_selection": {**BASELINE_CONFIG, "selection_method": "roulette"},
    "rank_selection": {**BASELINE_CONFIG, "selection_method": "rank"},

    # --- Mutation Rate Comparison ---
    "mutation_low": {**BASELINE_CONFIG, "mutation_rate": 0.01},
    "mutation_high": {**BASELINE_CONFIG, "mutation_rate": 0.1},
    "mutation_adaptive": {**BASELINE_CONFIG, "mutation_rate": "adaptive"},

    # --- Crossover Rate Comparison ---
    "crossover_low": {**BASELINE_CONFIG, "crossover_rate": 0.6},
    "crossover_high": {**BASELINE_CONFIG, "crossover_rate": 0.9},

    # --- Population Size Comparison ---
    "pop_small": {**BASELINE_CONFIG, "population_size": 50},
    "pop_large": {**BASELINE_CONFIG, "population_size": 200},

    # --- Elitism Comparison ---
    "no_elitism": {**BASELINE_CONFIG, "elitism_rate": 0.0},
    "high_elitism": {**BASELINE_CONFIG, "elitism_rate": 0.10},

    # --- Terrain Generalization ---
    "hill_terrain": {**BASELINE_CONFIG, "terrain": "hill"},
    "mixed_terrain": {**BASELINE_CONFIG, "terrain": "mixed"},

    # --- Advanced ---
    "island_model": {**BASELINE_CONFIG, "island_model": True, "num_islands": 4, "migration_interval": 20},
    "fitness_sharing": {**BASELINE_CONFIG, "fitness_sharing": True, "sharing_radius": 0.3},
}
```

### Priority Order
**P0 (must have)**: baseline, random_search, roulette_selection, rank_selection, mutation_low, mutation_high, mutation_adaptive, no_elitism, high_elitism
**P1 (should have)**: indirect_encoding, hill_terrain, mixed_terrain, crossover_low, crossover_high
**P2 (nice to have)**: pop_small, pop_large, island_model, fitness_sharing

---

## 8. GA Pseudocode (for Report Section 3)

The report MUST include these pseudocode blocks. Generate them as styled text in the PDF using monospace font (Courier) with a light gray background box (#F0F0F0).

### Main GA Pseudocode

```
ALGORITHM: Genetic Algorithm for Locomotion Optimization
────────────────────────────────────────────────────────
INPUT:  N (population size), G (max generations),
        p_c (crossover rate), p_m (mutation rate),
        E (elitism rate)
OUTPUT: Best chromosome x* and fitness f(x*)

1.  INITIALIZE population P = {x_1, x_2, ..., x_N}
    where each x_i is a random vector in [0,1]^n

2.  EVALUATE fitness f(x_i) for all x_i in P
    using physics simulation

3.  FOR generation g = 1 TO G:

    3a. RECORD statistics:
        best_g = max(f(x_i)), avg_g = mean(f(x_i))
        diversity_g = mean pairwise genotype distance

    3b. ELITISM: Copy top ceil(E * N) individuals to P_next

    3c. WHILE |P_next| < N:
        i.   SELECT parents (p1, p2) using selection method
        ii.  IF random() < p_c:
                 (c1, c2) = CROSSOVER(p1, p2)
             ELSE:
                 (c1, c2) = (copy(p1), copy(p2))
        iii. MUTATE c1 with probability p_m per gene
        iv.  MUTATE c2 with probability p_m per gene
        v.   ADD c1, c2 to P_next

    3d. EVALUATE fitness f(x_i) for all new x_i in P_next

    3e. P = P_next

    3f. IF adaptive mutation:
            p_m = max(0.01, p_m_initial * (1 - g/G))

4.  RETURN x* = argmax f(x_i) over all generations
```

### Tournament Selection Pseudocode

```
ALGORITHM: Tournament Selection
────────────────────────────────
INPUT:  P (population), k (tournament size)
OUTPUT: Selected individual x*

1. S = randomly sample k individuals from P (without replacement)
2. x* = argmax f(x_i) for x_i in S
3. RETURN x*
```

### Roulette Wheel Selection Pseudocode

```
ALGORITHM: Roulette Wheel Selection
─────────────────────────────────────
INPUT:  P (population with fitness values)
OUTPUT: Selected individual x*

1. f_min = min(f(x_i)) for all x_i in P
2. f'(x_i) = f(x_i) - f_min + epsilon  for all x_i
3. F_total = sum of f'(x_i)
4. r = random() * F_total
5. cumulative = 0
6. FOR each x_i in P:
       cumulative += f'(x_i)
       IF cumulative >= r:
           RETURN x_i
```

### Adaptive Mutation Pseudocode

```
ALGORITHM: Adaptive Gaussian Mutation
──────────────────────────────────────
INPUT:  x (chromosome), g (current gen), G (max gen),
        p_m0 (initial rate), sigma (mutation strength)
OUTPUT: x' (mutated chromosome)

1. p_m = max(0.01, p_m0 * (1 - g/G))
2. FOR each gene x_i in x:
       IF random() < p_m:
           x_i = x_i + Normal(0, sigma)
           x_i = clamp(x_i, 0, 1)
3. RETURN x'
```

---

## 9. GA Pipeline Flowchart (visualization/flowchart.py)

Generate a flowchart diagram using matplotlib for the report.

### Flowchart Structure
```
[Start]
   |
[Initialize Random Population (N individuals)]
   |
[Evaluate Fitness (Physics Simulation)]
   |
[Record Statistics (best, avg, diversity)]
   |
[Generation < G?] --No--> [Return Best Solution] --> [End]
   | Yes
[Elitism: Copy top E% to next generation]
   |
[Selection (Tournament / Roulette / Rank)]
   |
[Crossover (Single-point / Two-point / Uniform)]
   |
[Mutation (Fixed / Adaptive Gaussian)]
   |
[Form New Population]
   |
[Loop back to Evaluate Fitness]
```

### Flowchart Style
- Rounded rectangles for process steps
- Diamond for decision point
- Color coding: blue=initialization, green=evaluation, orange=genetic operators, red=termination
- Save as: `report/figures/ga_flowchart.png` at 300 DPI

---

## 10. Notation Table (for Report)

| Symbol | Description | Default Value |
|--------|-------------|---------------|
| N | Population size | 100 |
| G | Maximum number of generations | 150 |
| n | Chromosome length (number of genes) | 18 (direct) / 9 (indirect) |
| x_i | i-th individual (chromosome vector) | — |
| f(x) | Primary fitness function (distance traveled) | — |
| F(x) | Extended fitness with penalties | — |
| p_c | Crossover probability | 0.8 |
| p_m | Mutation probability (per gene) | 0.05 |
| sigma | Mutation step size (Gaussian std dev) | 0.1 |
| E | Elitism rate (fraction preserved) | 0.05 |
| k | Tournament size | 3 |
| s | Selection pressure (rank-based) | 1.5 |
| T_sim | Simulation duration (seconds) | 10.0 |
| S | Total simulation steps (T_sim x FPS) | 600 |
| alpha | Energy penalty weight | 0.1 |
| beta | Fall penalty weight | 0.5 |
| gamma | Uprightness bonus weight | 10.0 |
| A_j | Oscillation amplitude of joint j | [0, pi/2] |
| omega_j | Oscillation frequency of joint j | [0.5, 5.0] Hz |
| phi_j | Phase offset of joint j | [0, 2*pi] |
| sigma_share | Fitness sharing radius | 0.3 |
| K | Number of islands (island model) | 4 |
| M | Migration interval (generations) | 20 |
| G_80 | Convergence speed (gen to reach 80% of final fitness) | — |
| D(g) | Population diversity at generation g | — |
| epsilon | Numerical stability constant | 1e-6 |

---

## 11. Literature Review — Full Citations (for Report Section 2)

### Required Papers

1. **Sims, K. (1994)**. "Evolving Virtual Creatures." *Proceedings of the 21st Annual Conference on Computer Graphics and Interactive Techniques (SIGGRAPH '94)*, pp. 15–22. ACM Press. DOI: 10.1145/192161.192167
   - First demonstration of evolving both morphology and neural network controllers for 3D virtual creatures.

2. **Lipson, H., & Pollack, J. B. (2000)**. "Automatic Design and Manufacture of Robotic Lifeforms." *Nature*, 406(6799), 974–978. DOI: 10.1038/35023115
   - Evolved robot morphologies in simulation, then 3D-printed and tested in reality.

3. **Cheney, N., MacCurdy, R., Clune, J., & Lipson, H. (2014)**. "Unshackling Evolution: Evolving Soft Robots with Multiple Materials and a Powerful Generative Encoding." *Proceedings of GECCO '14*, pp. 167–174. DOI: 10.1145/2576768.2598353
   - Used CPPNs as indirect encodings for soft robot evolution. Showed indirect encodings produce more complex designs.

4. **Stanley, K. O., & Miikkulainen, R. (2002)**. "Evolving Neural Networks through Augmenting Topologies." *Evolutionary Computation*, 10(2), 99–127. DOI: 10.1162/106365602320169811
   - NEAT algorithm evolving both topology and weights of neural networks.

5. **Salimans, T., Ho, J., Chen, X., Szymon, S., & Sutskever, I. (2017)**. "Evolution Strategies as a Scalable Alternative to Reinforcement Learning." *arXiv:1703.03864*.
   - Evolution strategies matching RL performance on MuJoCo locomotion tasks.

6. **Lehman, J., & Stanley, K. O. (2011)**. "Abandoning Objectives: Evolution Through the Search for Novelty Alone." *Evolutionary Computation*, 19(2), 189–223. DOI: 10.1162/EVCO_a_00025
   - Novelty search outperforming objective-based search in deceptive fitness landscapes.

7. **Geijtenbeek, T., van de Panne, M., & van der Stappen, A. F. (2013)**. "Flexible Muscle-Based Locomotion for Bipedal Creatures." *ACM Transactions on Graphics*, 32(6), Article 206. DOI: 10.1145/2508363.2508399
   - Optimized muscle-based bipedal locomotion controllers using CMA-ES.

8. **Ha, D. (2019)**. "Reinforcement Learning for Improving Agent Design." *Artificial Life*, 25(4), 352–365. DOI: 10.1162/artl_a_00301
   - Co-optimized agent morphology and policy simultaneously.

### Additional Papers: Search Google Scholar for 2-3 recent papers (2020-2025) using:
- "genetic algorithm bipedal locomotion optimization"
- "evolutionary optimization walking robot 2D"

### Literature Summary Table
| Author(s) | Year | Method | Encoding | Key Finding |
|-----------|------|--------|----------|-------------|
| Sims | 1994 | GA + NN | Direct graph | First evolved virtual creatures |
| Lipson & Pollack | 2000 | GA | Direct | Sim-to-real transfer |
| Cheney et al. | 2014 | GA + CPPN | Indirect | Indirect encoding superiority |
| Stanley & Miikkulainen | 2002 | NEAT | Augmenting topology | Topology + weight evolution |
| Salimans et al. | 2017 | ES | Direct | ES competitive with RL |
| Lehman & Stanley | 2011 | Novelty Search | Various | Diversity > objectives |
| Geijtenbeek et al. | 2013 | CMA-ES | Direct | Muscle-based locomotion |
| Ha | 2019 | RL + Evolution | Co-optimization | Morphology-policy interaction |

---

## 12. Experiment Runner (experiments/run_experiments.py)

### Per Experiment
- For each of 30 runs:
  - Set unique random seed: `seed_start + run_index`
  - Initialize population
  - Run GA for max_generations
  - Track per generation: best_fitness, avg_fitness, worst_fitness, population_diversity
  - Save best individual's chromosome
  - Save full convergence history
  - Save parent tracking for family tree
- Save all 30 runs to pickle file per experiment

### Diversity Metric (per generation)
```python
def compute_diversity(population):
    """Average pairwise Euclidean distance in normalized gene space."""
    n = len(population)
    if n < 2:
        return 0.0
    centroid = np.mean(population, axis=0)
    return np.mean([np.linalg.norm(ind - centroid) for ind in population])
```

### Timing
- Estimate ~30-60 seconds per run (100 pop × 150 gen × 600 sim steps)
- Total for 30 runs of baseline: ~15-30 minutes
- Use `multiprocessing.Pool` with `cpu_count() - 1` workers

---

## 13. Error Handling & Recovery (src/utils.py)

### Physics Simulation Errors
```python
import math
import logging

PENALTY_FITNESS = -1000.0

def safe_simulate(creature_chromosome, terrain, config):
    """Run simulation with comprehensive error handling."""
    try:
        fitness = simulate(creature_chromosome, terrain, config)

        # Check for NaN/Inf
        if math.isnan(fitness) or math.isinf(fitness):
            logging.warning(f"NaN/Inf fitness detected, assigning penalty")
            return PENALTY_FITNESS

        # Check for unreasonably large fitness (physics explosion)
        if abs(fitness) > 100000:
            logging.warning(f"Unreasonable fitness {fitness}, likely physics explosion")
            return PENALTY_FITNESS

        return fitness

    except Exception as e:
        logging.error(f"Simulation crashed: {type(e).__name__}: {e}")
        return PENALTY_FITNESS
```

### Experiment Run Recovery
```python
def run_experiment_with_checkpoints(config, experiment_name):
    """Run 30 experiments with checkpoint recovery."""
    checkpoint_file = f"experiments/results/{experiment_name}_checkpoint.pkl"

    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'rb') as f:
            completed_runs = pickle.load(f)
        start_run = len(completed_runs)
        logging.info(f"Resuming {experiment_name} from run {start_run}")
    else:
        completed_runs = []
        start_run = 0

    for run_idx in range(start_run, config["num_runs"]):
        try:
            result = run_single_ga(config, seed=config["seed_start"] + run_idx)
            completed_runs.append(result)

            if (run_idx + 1) % 5 == 0:
                with open(checkpoint_file, 'wb') as f:
                    pickle.dump(completed_runs, f)
                logging.info(f"Checkpoint: {experiment_name} run {run_idx + 1}/30")

        except Exception as e:
            logging.error(f"Run {run_idx} failed: {e}")
            with open(checkpoint_file, 'wb') as f:
                pickle.dump(completed_runs, f)
            completed_runs.append(None)

    # Save final results (without None entries)
    valid_runs = [r for r in completed_runs if r is not None]
    final_file = f"experiments/results/{experiment_name}.pkl"
    with open(final_file, 'wb') as f:
        pickle.dump(valid_runs, f)

    if len(valid_runs) < 30:
        logging.warning(f"{experiment_name}: only {len(valid_runs)}/30 runs succeeded")

    return valid_runs
```

### Checkpoint Corruption Recovery
```python
def load_checkpoint_safe(filepath):
    """Load checkpoint with corruption recovery."""
    try:
        with open(filepath, 'rb') as f:
            return pickle.load(f)
    except (pickle.UnpicklingError, EOFError, Exception) as e:
        logging.error(f"Checkpoint corrupted: {e}. Starting fresh.")
        # Try backup
        backup = filepath + ".bak"
        if os.path.exists(backup):
            try:
                with open(backup, 'rb') as f:
                    return pickle.load(f)
            except:
                pass
        return []
```

### Validation Function
```python
def validate_setup():
    """Quick sanity check before running experiments."""
    print("Validating setup...")

    # 1. Test pymunk
    import pymunk
    space = pymunk.Space()
    space.gravity = (0, -981)
    body = pymunk.Body(1, 1)
    body.position = (100, 200)
    space.add(body)
    for _ in range(100):
        space.step(1/60)
    assert not math.isnan(body.position.y), "Pymunk NaN detected"
    print("  [OK] Pymunk working")

    # 2. Test creature simulation
    chromosome = np.random.uniform(0, 1, 18)
    fitness = safe_simulate(chromosome, "flat", BASELINE_CONFIG)
    assert fitness != PENALTY_FITNESS, "Random creature crashed"
    assert not math.isnan(fitness), "NaN fitness"
    print(f"  [OK] Creature simulation working (fitness={fitness:.2f})")

    # 3. Test edge cases
    zero_chromo = np.zeros(18)
    f_zero = safe_simulate(zero_chromo, "flat", BASELINE_CONFIG)
    assert f_zero != PENALTY_FITNESS, "Zero chromosome crashed"
    print(f"  [OK] Zero chromosome handled (fitness={f_zero:.2f})")

    one_chromo = np.ones(18)
    f_one = safe_simulate(one_chromo, "flat", BASELINE_CONFIG)
    assert f_one != PENALTY_FITNESS, "Ones chromosome crashed"
    print(f"  [OK] Ones chromosome handled (fitness={f_one:.2f})")

    # 4. Test terrain
    from src.terrain import FlatTerrain, HillTerrain, MixedTerrain
    assert FlatTerrain().get_height(0) == 50
    assert FlatTerrain().get_height(99999) == 50  # Out of bounds
    assert HillTerrain().get_height(400) > 50  # Hill peak
    print("  [OK] Terrains working")

    print("All validations passed!")
```

---

## 14. Statistical Analysis (experiments/analyze_results.py)

### Per Experiment Stats
For each experiment, compute from the 30 final-best-fitness values:
- Best: `max(values)`
- Worst: `min(values)`
- Mean: `np.mean(values)`
- Median: `np.median(values)`
- Std Dev: `np.std(values, ddof=1)` (sample std dev, not population)

### Statistical Tests

#### Wilcoxon Rank-Sum Test
```python
from scipy.stats import ranksums, mannwhitneyu

def compare_experiments(baseline_values, variant_values, name):
    """Compare variant against baseline with Wilcoxon rank-sum test."""
    stat, p_value = ranksums(baseline_values, variant_values)

    # Effect size: rank-biserial correlation
    u_stat, _ = mannwhitneyu(baseline_values, variant_values, alternative='two-sided')
    n1, n2 = len(baseline_values), len(variant_values)
    effect_size = 1 - (2 * u_stat) / (n1 * n2)  # rank-biserial r

    # Cohen's d
    pooled_std = np.sqrt((np.std(baseline_values, ddof=1)**2 + np.std(variant_values, ddof=1)**2) / 2)
    cohens_d = (np.mean(variant_values) - np.mean(baseline_values)) / pooled_std if pooled_std > 0 else 0

    significance = "***" if p_value < 0.001 else "**" if p_value < 0.01 else "*" if p_value < 0.05 else "ns"

    return {
        "name": name,
        "W_statistic": stat,
        "p_value": p_value,
        "significance": significance,
        "cohens_d": cohens_d,
        "rank_biserial_r": effect_size
    }
```

#### Edge Case: Zero Standard Deviation
```python
if np.std(values, ddof=1) == 0:
    logging.warning(f"{experiment_name}: all 30 runs produced identical results (std=0)")
    # Skip Wilcoxon test (meaningless), report as "N/A" in table
```

#### Edge Case: Fewer Than 30 Runs
```python
if len(values) < 30:
    logging.warning(f"{experiment_name}: only {len(values)} valid runs (expected 30)")
    # Proceed with available data, note in report
if len(values) < 5:
    logging.error(f"{experiment_name}: too few runs for meaningful statistics")
    # Skip statistical tests, mark as "insufficient data"
```

### Convergence Speed
```python
def compute_convergence_speed(convergence_history, threshold=0.8):
    """Find generation where fitness first reaches 80% of final value."""
    final_fitness = convergence_history[-1]
    if final_fitness <= 0:
        return len(convergence_history)  # Never converged meaningfully
    target = threshold * final_fitness
    for g, fitness in enumerate(convergence_history):
        if fitness >= target:
            return g
    return len(convergence_history)  # Never reached threshold
```

---

## 15. Visualization Suite

### 15.1 Generation Replay (visualization/generation_replay.py)
- Render best creature from generation 1, 25, 50, 100, 150
- Save key frames as PNG for report

### 15.2 Skeleton Trail (visualization/skeleton_trail.py)
- Fading afterimages every 10 frames, alpha decreasing for older positions
- Save as composite image

### 15.3 Side-by-Side Race (visualization/side_by_side.py)
- Best walkers from 5 different runs racing simultaneously
- Save key frame as image

### 15.4 Family Tree (visualization/family_tree.py)
- Lineage of best individual, generation on y-axis, nodes colored by fitness

### 15.5 Convergence Plot (visualization/convergence_plot.py)
- 30 runs overlaid (thin semi-transparent lines), bold mean line, shaded std dev band
- One per experiment + comparison overlay

### 15.6 Diversity Plot (visualization/diversity_plot.py)
- Population diversity over generations, same overlay style

### 15.7 Box Plots (visualization/box_plots.py)
- Grouped by comparison type (selection, mutation, elitism, etc.)

### 15.8 Parameter Heatmap (visualization/heatmap.py)
- X=generation, Y=gene index, Color=gene value of best individual

### All visualizations: 300 DPI PNG to `report/figures/`

---

## 16. PDF Report (report/generate_report.py)

### Target: 20-25 pages. Use reportlab.

### Report Structure

**Title Page (1 page)**
- Title: "STRIDE: Evolving 2D Walkers Using Genetic Algorithms"
- Student: Dev Krishna
- Registration: 23112015
- Course: [FILL IN COURSE NAME]
- University: CHRIST University, Pune
- Date: [Current date]

**Table of Contents (1 page)**

**Section 1: Introduction (1.5-2 pages)**
- Optimization problem: evolving locomotion
- Why hard: high-dimensional, deceptive landscape
- Formal problem statement with math notation
- Karl Sims motivation
- Report structure outline

**Section 2: Literature Review (2-3 pages)**
- Full citations with DOIs from Section 11
- Grouped by theme
- Literature summary table
- Research gap statement

**Section 3: Methodology (3-4 pages)**
- Notation table (Section 10)
- Creature diagram figure
- Encoding diagram figure
- GA flowchart figure
- All pseudocode blocks (Section 8)
- Selection formulas with math
- Crossover definitions
- Mutation formulas
- Fitness function formulation
- Terrain system

**Section 4: Implementation & Control Parameters (3-4 pages)**
- Tech stack
- Parameter table with ranges
- Parameter sensitivity results
- Encoding comparison
- Terrain generalization
- Exploration vs exploitation discussion

**Section 5: Experiment Results (4-5 pages)**
- Table 0: GA vs Random Search
- Table 1: Main results (30 runs)
- Table 2: Selection comparison
- Table 3: Mutation comparison
- Table 4: Elitism comparison
- Table 5: Encoding comparison
- Table 6: Terrain comparison
- Table 7: Convergence speed
- Table 8: Statistical significance (p-values)
- All figures
- Discussion

**Section 6: Conclusion (0.5-1 page)**

**References (1-2 pages)**
- Numbered style [1], [2], etc.
- Full academic citations
- Software citations for pymunk, matplotlib, scipy, numpy

### PDF Styling
- Body font: Times-Roman, 11pt, 1.15 line spacing
- Section headers: 14pt bold
- Subsection headers: 12pt bold
- Pseudocode: Courier, 9pt, gray background (#F0F0F0)
- Margins: 1 inch (72pt) all sides
- Page numbers: bottom center, starting from page 2
- Figures: centered, caption below ("Figure X: description")
- Tables: centered, caption above ("Table X: description")
- CRITICAL: Do NOT use Unicode subscript/superscript characters. Use reportlab `<sub>` and `<super>` tags.

---

## 17. Complete Mathematical Formulas for Report

### Motor Control
```
theta_j(t) = A_j * sin(2*pi * omega_j * t + phi_j)
```

### Fitness
```
f(x) = x_torso(T_sim) - x_torso(0)
F(x) = f(x) - alpha*E(x) - beta*C(x) + gamma*U(x)
E(x) = (1/S) * sum_{t=0}^{S-1} sum_{j=1}^{6} |tau_j(t*dt)|
U(x) = (1/S) * sum_{t=0}^{S-1} max(0, cos(theta_torso(t*dt)))
C(x) = |{t : y_torso(t*dt) < y_ground + h_torso/2 + epsilon}|
```

### Selection

**Tournament**:
```
P(x_i selected) = 1 - ((N - rank_i) / N)^k
```
where rank_i is the rank of individual i (best=N, worst=1)

**Roulette**:
```
f'(x_i) = f(x_i) - min_{j}(f(x_j)) + epsilon,  epsilon = 1e-6
P(x_i) = f'(x_i) / sum_{j=1}^{N} f'(x_j)
```

**Rank-based**:
```
P(x_i) = (2 - s)/N + 2*rank_i*(s - 1) / (N*(N - 1))
s = 1.5  (selection pressure, range [1.0, 2.0])
rank_i in {1, 2, ..., N}  (worst=1, best=N)
```

### Crossover

**Single-point**: randomly select k in {1,...,n-1}
```
c1 = p1[0:k] || p2[k:n]
c2 = p2[0:k] || p1[k:n]
```

**Two-point**: randomly select k1 < k2 in {1,...,n-1}
```
c1 = p1[0:k1] || p2[k1:k2] || p1[k2:n]
c2 = p2[0:k1] || p1[k1:k2] || p2[k2:n]
```

**Uniform**: for each gene i independently
```
c1[i], c2[i] = (p1[i], p2[i]) if rand() < 0.5 else (p2[i], p1[i])
```

### Mutation

**Fixed**:
```
x'_i = x_i + N(0, sigma^2)   if rand() < p_m
x'_i = clamp(x'_i, 0, 1)
```

**Adaptive**:
```
p_m(g) = max(p_min, p_m0 * (1 - g/G))
p_m0 = 0.2, p_min = 0.01
```

### Fitness Sharing
```
d(x_i, x_j) = ||x_i - x_j||_2  (Euclidean distance in [0,1]^n)
sh(d) = 1 - (d / sigma_share)^alpha   if d < sigma_share
sh(d) = 0                              if d >= sigma_share
alpha = 1.0, sigma_share = 0.3
f_shared(x_i) = f(x_i) / sum_{j=1}^{N} sh(d(x_i, x_j))
```

### Diversity Metric
```
D(g) = (1/N) * sum_{i=1}^{N} ||x_i - x_bar||_2
x_bar = (1/N) * sum_{i=1}^{N} x_i  (population centroid)
```

### Statistical Tests

**Wilcoxon rank-sum test**:
```
H_0: median(A) = median(B)
Significance: alpha = 0.05
Markers: * (p<0.05), ** (p<0.01), *** (p<0.001), ns (not significant)
```

**Cohen's d** (effect size):
```
d = (mean(B) - mean(A)) / s_pooled
s_pooled = sqrt((s_A^2 + s_B^2) / 2)
Interpretation: |d| < 0.2 negligible, 0.2-0.5 small, 0.5-0.8 medium, >0.8 large
```

**Rank-biserial correlation**:
```
r = 1 - (2*U) / (n1*n2)
where U = Mann-Whitney U statistic
```

### Convergence Speed
```
G_80 = min{g : f_best(g) >= 0.8 * f_best(G)}
```

---

## 18. EDGE CASES — COMPREHENSIVE LIST

Every edge case below MUST be handled in the code. Test each explicitly.

### Physics / Creature Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 1 | Creature spawns underground | Torso initial y < ground height | Set initial y = ground_height + torso_height + 50 (safe margin) |
| 2 | Joint angle exceeds limits | Motor overshoots, body parts flip | Use RotaryLimitJoint with hard angle limits [-pi/2, pi/2]. Clamp motor target angle. |
| 3 | Velocity explosion | Bodies accelerate to infinity | Clamp all body velocities every step: `body.velocity = clamp(body.velocity, -v_max, v_max)` where v_max=1000 |
| 4 | Creature flies off screen | Torso y > 500 | Terminate simulation early, return current distance as fitness |
| 5 | Creature falls through ground | Collision detection missed | Use small simulation timestep (1/60). Add collision handler callback to detect and log. |
| 6 | Creature parts overlap | Self-collision | Use ShapeFilter with same group id to disable self-collision |
| 7 | All-zero chromosome | All joints have zero amplitude | Creature stands still. Fitness = 0. Valid result, don't crash. |
| 8 | All-one chromosome | Maximum amplitude, frequency, phase | Creature may spasm violently. Velocity clamping should prevent explosion. |
| 9 | Simulation produces NaN | Numerical instability in physics | Check with `math.isnan()` after simulation. Return PENALTY_FITNESS (-1000). |
| 10 | Simulation takes too long | Stuck in physics loop | Add timeout: if sim exceeds 2x expected time, terminate and return current fitness. |

### GA Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 11 | All creatures have zero fitness | Roulette wheel: division by zero | Add epsilon=1e-6 to all shifted fitness values. This makes sum > 0 always. |
| 12 | All creatures have identical fitness | Roulette wheel: uniform selection (fine). Rank: all same rank. | For rank: break ties randomly. For roulette: uniform selection is acceptable. |
| 13 | All creatures have negative fitness | After shifting: all values are epsilon | Selection becomes near-uniform. This is acceptable for early generations. |
| 14 | Population converges to identical chromosomes | Crossover produces clones, diversity = 0 | Diversity metric will show this. Fitness sharing prevents it. Log warning if diversity < 0.01. |
| 15 | Two identical parents selected for crossover | Crossover produces identical children | Valid behavior. Mutation will introduce variation. |
| 16 | Elitism copies more than population allows | ceil(E * N) > N | Cap elite count at N-2 (need at least 2 new individuals per generation). |
| 17 | Odd population size with 2-child crossover | P_next might overshoot by 1 | If |P_next| > N after adding children, truncate to N (remove last added). |
| 18 | Adaptive mutation rate hits zero | (1 - g/G) = 0 at g = G | Floor at p_min = 0.01. The max() in formula guarantees this. |
| 19 | Crossover point at boundary | k=0 or k=n | Select k from {1, ..., n-1} exclusively. Never allow boundary crossover. |
| 20 | Mutation pushes gene outside [0,1] | gene + noise > 1 or < 0 | Clamp: `gene = max(0, min(1, gene))` |

### Experiment Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 21 | Run crashes mid-experiment | Exception in any run | Catch exception, log it, record None for that run, continue with next run. |
| 22 | Checkpoint file corrupted | pickle.load() fails | Try backup file. If no backup, start from scratch. Log error. |
| 23 | All 30 runs crash | No valid data | Log critical error. Skip this experiment in analysis. Report as "failed" in table. |
| 24 | Fewer than 30 successful runs | Some runs crashed | Use available data. Note count in report. Skip Wilcoxon if < 5 runs. |
| 25 | All 30 runs produce same result | std = 0 | Report std = 0.0. Skip Wilcoxon test (meaningless). Note in report. |
| 26 | Experiment takes >2 hours | Too many evaluations | Reduce generations to 100. Log adjustment. |

### Terrain Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 27 | Query terrain height at x < -1000 | Out of terrain bounds | Clamp x to [-1000, 10000], return height at clamped position. |
| 28 | Query terrain height at x > 10000 | Out of terrain bounds | Same as above. |
| 29 | Creature on hill terrain moves backward | Goes to x < 0 | Allow negative distance (negative fitness). Don't crash. |
| 30 | Gap terrain: creature falls in gap | No ground contact | Creature falls, y goes below 0, simulation terminates. Fitness = distance to gap edge. |

### Report/PDF Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 31 | Unicode subscripts in reportlab | Renders as black boxes | NEVER use Unicode subscripts (₀₁₂). Use `<sub>` and `<super>` tags. |
| 32 | Figure file missing | Report generation crashes | Check if file exists before embedding. Use placeholder text if missing. |
| 33 | Table data has NaN | NaN displayed in PDF table | Replace NaN with "N/A" string before rendering. |
| 34 | Very long experiment name | Table column overflow | Truncate to 20 characters or use abbreviations. |
| 35 | Report exceeds 25 pages | Too much content | Reduce figure sizes, move extra tables to appendix. |

### Island Model Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 36 | Population not divisible by num_islands | Uneven island sizes | Give first K islands ceil(N/K) individuals, rest get floor(N/K). |
| 37 | Migration immigrants duplicate existing | Same individual on two islands | Allow duplicates. Natural selection will handle. |
| 38 | Island has only 2 individuals | Can't do tournament with k=3 | Use k = min(tournament_size, island_size). |

### Fitness Sharing Edge Cases

| # | Edge Case | What Happens | How to Handle |
|---|-----------|--------------|---------------|
| 39 | All individuals identical | sh(d)=1 for all pairs, denominator=N | Shared fitness = f(x)/N. All fitness reduced equally. Valid. |
| 40 | sharing_radius too small | No sharing happens | sh(d)=0 for all pairs except self. f_shared = f(x)/1 = f(x). No effect. Valid. |
| 41 | sharing_radius too large | Everyone shares with everyone | Effectively uniform fitness reduction. Selection becomes near-random. Valid but bad. |

---

## 19. Dependencies (requirements.txt)

```
pymunk>=6.6.0
numpy>=1.24.0
matplotlib>=3.7.0
scipy>=1.10.0
reportlab>=4.0.0
Pillow>=9.5.0
tqdm>=4.65.0
```

---

## 20. Build & Run Instructions

```bash
# Install
pip install -r requirements.txt --break-system-packages

# Validate
python main.py --validate

# Run experiments
python main.py --priority p0      # Must-have experiments
python main.py --priority p1      # Should-have experiments
python main.py --priority all     # Everything

# Analysis & visualization
python experiments/analyze_results.py
python visualization/save_frames.py

# Generate report
python report/generate_report.py

# Full pipeline
python main.py --full-pipeline
```

---

## 21. Time Budget

| Day | Task | Phase | Hours |
|-----|------|-------|-------|
| Day 1 | Creature + physics + terrain + fitness + testing | Phase 1 | 4-5 |
| Day 2 | GA engine + encoding + config + random search + error handling + testing | Phase 2 | 3-4 |
| Day 3 | Experiment runner + run P0 experiments (overnight) | Phase 3 | 3-4 |
| Day 4 | Analysis + all visualizations + diagrams | Phase 4 | 3-4 |
| Day 5 | PDF report + polish + submission | Phase 5 | 4-5 |
| **Total** | | | **~17-22 hrs** |

### If Behind Schedule
- Drop P2 experiments
- Simplify to convergence plots + box plots + creature diagram only
- Skip family tree, skeleton trail
- Reduce generations to 100

### If Ahead of Schedule
- Add P2 experiments
- Add animated GIF exports
- Add gap terrain
- Polish report with appendix

---

## 22. Key Success Criteria

### Phase 1 ✓
- [ ] Creatures simulate without crashing
- [ ] All fitness values are finite
- [ ] Edge case creatures (all-zero, all-one) don't crash

### Phase 2 ✓
- [ ] Fitness increases over generations
- [ ] All 3 selection methods work
- [ ] Both encodings work
- [ ] GA beats random search
- [ ] Roulette handles zero/negative fitness

### Phase 3 ✓
- [ ] 30 runs complete per P0 experiment
- [ ] Checkpointing and recovery works
- [ ] Logging captures all events

### Phase 4 ✓
- [ ] All stat tables generated (no NaN)
- [ ] Wilcoxon tests computed with p-values
- [ ] All PNG figures at 300 DPI
- [ ] Creature diagram has labeled joints

### Phase 5 ✓
- [ ] PDF is 20-25 pages
- [ ] All 5 rubric sections present
- [ ] No black boxes from Unicode subscripts
- [ ] All figures and tables embedded
- [ ] References complete
