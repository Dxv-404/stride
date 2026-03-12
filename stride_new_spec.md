# STRIDE — COMPLETE PROJECT SPECIFICATION
## Evolving 2D Walkers Using Genetic Algorithms + Interactive Web Experience

---

**Student**: Dev Krishna, 3rd Year Data Science, CHRIST University Pune
**Registration**: 23112015
**Output**: Python codebase + PDF report (20-25 pages) + Interactive React website
**Core Thesis**: Can a GA evolve walking? Does sensory feedback help? Does training diversity enable generalization?

---

## TABLE OF CONTENTS

1. [Project Overview & Thesis](#1-project-overview--thesis)
2. [Architecture](#2-architecture)
3. [Phase 1: Physics Foundation](#3-phase-1-physics-foundation)
4. [Phase 2: GA Engine](#4-phase-2-ga-engine)
5. [Phase 3: Experiment Pipeline](#5-phase-3-experiment-pipeline)
6. [Phase 4: Analysis & Visualization](#6-phase-4-analysis--visualization)
7. [Phase 5: PDF Report](#7-phase-5-pdf-report)
8. [V2 Additions — CPG, CPG+NN, Sensors](#8-v2-additions)
9. [Transfer Testing & Perturbation Recovery](#9-transfer-testing--perturbation-recovery)
10. [Fitness Landscape & Interpretability](#10-fitness-landscape--interpretability)
11. [Experiment Plan & Results Tables](#11-experiment-plan--results-tables)
12. [Interactive Website — Overview & Architecture](#12-interactive-website)
13. [Website Tabs 1-6](#13-website-tabs)
14. [Website Visual Features (50+)](#14-website-visual-features)
15. [Chromosome Editor — The Gene Lab](#15-chromosome-editor)
16. [Terrain Editor — World Builder](#16-terrain-editor)
17. [Mathematical Formulas](#17-mathematical-formulas)
18. [Pseudocode Blocks](#18-pseudocode-blocks)
19. [Literature Review & Citations](#19-literature-review--citations)
20. [Edge Cases](#20-edge-cases)
21. [Report Structure (Detailed Subsections)](#21-report-structure)
22. [Build Schedule & Dependencies](#22-build-schedule)
23. [Errata — 13 Critical Fixes](#23-errata)
24. [Visual Impact Ideas for Report](#24-visual-impact-ideas)
25. [Viva Preparation](#25-viva-preparation)
26. [Key Principles](#26-key-principles)
27. [Website Implementation Code](#27-website-implementation-code)

---

## 1. PROJECT OVERVIEW & THESIS

### What's Already Done (v1)
- Pymunk physics with stick figure (torso, 4 limbs, 6 motorized joints, 2 passive elbows, feet)
- Sinusoidal controller: θ_j(t) = A_j × sin(2π × ω_j × t + φ_j), 18 genes
- Direct + indirect (9-gene symmetric) encoding
- GA: tournament/roulette/rank selection, single-point crossover, Gaussian mutation, elitism
- CMA-ES, PSO, DE, Random Search baselines (7,500 evals each)
- 30 runs × multiple experiments (selection, mutation rate, crossover rate, elitism, encoding)
- Flat terrain simulation, 15 seconds @ 60 FPS
- Fitness: distance − energy − falls + uprightness + gait bonus + velocity bonus
- Statistical analysis: Mann-Whitney U, Cohen's d, convergence plots, box plots
- PDF report (v1)
- Hill, mixed, gap terrain generators (built but only flat was used for evolution)

### V2 Core Thesis — Three Deeper Questions

v1 answered: "Can a GA evolve walking?" — Yes.

v2 answers:

1. **Does sensory feedback help?** (Sine → CPG → CPG+NN controller comparison)
2. **Did the creature learn to walk, or learn to walk on THIS terrain?** (Transfer testing — flat-only vs mixed-terrain training)
3. **Why does the GA succeed?** (Fitness landscape analysis — FDC + epistasis)

Plus interpretability:
4. **What did the NN actually learn?** (Sensor ablation, NN output visualization, behavioral fingerprinting)
5. **How robust is the evolved walking?** (Perturbation recovery — push the creature mid-walk)
6. **What matters most in the genome?** (Gene sensitivity analysis)
7. **Does evolution discover biologically realistic gaits?** (Gait symmetry analysis)

Plus: **Cost of Transport** — a relative efficiency metric comparing controllers.

---

## 2. ARCHITECTURE

### Python Backend

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
│   ├── sensors.py           # Sensor system for CPG+NN (v2)
│   ├── cpg_controller.py    # CPG controller (v2)
│   ├── cpgnn_controller.py  # CPG+NN controller (v2)
│   └── utils.py             # Helper functions + error handling
├── experiments/
│   ├── run_experiments.py   # Master experiment runner (30 runs × variants)
│   ├── analyze_results.py   # Statistical analysis + tables + plots
│   ├── transfer_test.py     # Transfer testing across terrains (v2)
│   ├── perturbation_test.py # Push recovery testing (v2)
│   ├── landscape_analysis.py # FDC + epistasis (v2)
│   ├── sensor_ablation.py   # Sensor ablation study (v2)
│   ├── gait_analysis.py     # Symmetry + behavioral fingerprinting (v2)
│   ├── export_for_web.py    # Export results as JSON for website (v2)
│   └── results/             # Output directory for experiment data
├── visualization/
│   ├── generation_replay.py
│   ├── skeleton_trail.py
│   ├── side_by_side.py
│   ├── family_tree.py
│   ├── convergence_plot.py
│   ├── diversity_plot.py
│   ├── box_plots.py
│   ├── heatmap.py
│   ├── creature_diagram.py
│   ├── flowchart.py
│   ├── encoding_diagram.py
│   ├── controller_architecture.py  # v2
│   ├── transfer_heatmap.py         # v2
│   ├── push_filmstrip.py           # v2
│   ├── nn_output_viz.py            # v2
│   ├── epistasis_matrix.py         # v2
│   ├── gait_symmetry_hist.py       # v2
│   ├── behavioral_radar.py         # v2
│   ├── push_survival_curve.py      # v2
│   └── save_frames.py
├── report/
│   ├── generate_report.py
│   └── figures/
├── website/                 # React website (single .jsx artifact)
│   └── stride_website.jsx
├── main.py
├── requirements.txt
└── README.md
```

### Website (Single React JSX Artifact)

Single-page React application with live 2D physics simulation running in the browser.

**Tech Stack**:
- React (JSX artifact)
- Matter.js (CDN: `https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js`) — 2D physics
- Three.js (r128) — 3D fitness landscape, chromosome helix
- Recharts — interactive charts
- Tailwind CSS — styling
- Web Workers — run GA evolution off main thread
- Tone.js — generative soundtrack
- Persistent Storage API — leaderboard, analytics, user data

---

## 3. PHASE 1: PHYSICS FOUNDATION

**Files**: `src/creature.py`, `src/physics_sim.py`, `src/terrain.py`, `src/fitness.py`

### Stick Figure Specification
- **Body**: Central torso (rectangle, ~60px × 20px)
- **Limbs**: 4 limbs (2 legs, 2 arms), each with 2 segments (upper + lower)
- **Joints**: 6 motorized joints (2 hip, 2 knee, 2 shoulder) + 2 passive elbows
- **Feet**: Small rectangles with high friction for ground contact
- **Each joint** has: Oscillation amplitude [0, π/2], Frequency [0.5, 5.0] Hz, Phase offset [0, 2π]
- **Total genes per creature**: 18 (direct encoding), 9 (indirect encoding)

### Physics Setup (pymunk)
- Gravity: (0, -981) pixels/sec²
- Ground: Static segment at y=50
- Limb segments: Dynamic bodies with mass proportional to length
- Joints: PivotJoint + RotaryLimitJoint for angle constraints
- Joint motors: SimpleMotor driven by sinusoidal pattern from genes
- Motor equation: `target_angle = amplitude * sin(2π * frequency * t + phase_offset)`
- Simulation time: 15 seconds at 60 FPS = 900 steps
- Collision handling: Creature parts should NOT collide with each other (use collision filtering)

### Stability Safeguards
- Clamp all velocities to prevent explosion (max linear velocity: 1000)
- If torso y-position < 0 or > 500, terminate simulation early
- If creature hasn't moved >5px in last 2 seconds, terminate early (stuck)

### Terrain System

**Flat**: h(x) = 50 for all x

**Hill**:
```
h(x) = 50                                    if x < 300 or x > 500
h(x) = 50 + 50 * sin(π * (x - 300) / 200)   if 300 ≤ x ≤ 500
```

**Mixed**: Alternating flat and hill sections every 300px

**Gap** (stretch goal): No ground from x=300 to x=350

### Fitness Function

**Primary**: f(x) = x_torso(T_sim) - x_torso(0)

**Extended**:
```
F(x) = Δx_torso - α·E(x) - β·C(x) + γ·U(x)
```
Where α=0.1 (energy penalty), β=0.5 (fall penalty), γ=10.0 (uprightness bonus)

### Validation Checkpoint
- 5 random creatures simulate without crashing
- All fitness values are finite (no NaN, no Inf)
- At least 1 creature has fitness > 0
- All-zero and all-one gene creatures don't crash
- Terrain height functions return correct values

---

## 4. PHASE 2: GA ENGINE

**Files**: `src/encoding.py`, `src/ga_core.py`, `src/config.py`, `src/random_search.py`, `src/utils.py`

### Chromosome Encoding

**Direct**: 18 floats, each gene directly maps to one joint parameter, normalized [0,1]

**Indirect (Symmetry-Based)**: 9 floats, left-side mirrored to right with π phase offset

### Selection Methods (all three)

**Tournament**: k=3 (also test 5, 7), select best from random subset

**Roulette Wheel**: Probability proportional to fitness, ε=1e-6 for stability, shift by f_min

**Rank-Based**: Selection pressure s=1.5, P(i) = (2-s)/N + 2·i·(s-1)/(N·(N-1))

### Crossover Operators
- **Single-Point**: Random crossover point k ∈ {1,...,n-1}
- **Two-Point**: Random points k1 < k2
- **Uniform**: Each gene independently swaps with 50% probability
- Default: Single-point for sine/CPG, Uniform for CPG+NN (96 genes)
- Crossover rates to test: 0.6, 0.8, 0.9

### Mutation Operators

**Fixed Gaussian**: gene' = gene + N(0, σ²), clamp to [0,1], σ=0.1, rates: 0.01, 0.05, 0.1

**Adaptive**: p_m(g) = max(p_min, p_m0 · (1 - g/G)), p_m0=0.2, p_min=0.01

### Elitism
- Top ⌈E × N⌉ individuals survive unchanged (deep copy)
- Test: E=0.0, 0.05, 0.10
- Cap elite count at N-2

### Island Model
- K=4 sub-populations, migration every M=20 generations
- Ring topology: island_i sends top 2 to island_{(i+1) % K}

### Fitness Sharing
- sh(d) = 1 - (d/σ_share)^α if d < σ_share, else 0
- α=1.0, σ_share=0.3

### Configuration

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
    "simulation_time": 15.0,
    "simulation_fps": 60,
    "num_runs": 30,
    "seed_start": 42,
    "fitness_weights": {"alpha": 0.1, "beta": 0.5, "gamma": 10.0},
}
```

### Experiment Priority

**P0**: baseline, random_search, roulette_selection, rank_selection, mutation_low, mutation_high, mutation_adaptive, no_elitism, high_elitism

**P1**: indirect_encoding, hill_terrain, mixed_terrain, crossover_low, crossover_high

**P2**: pop_small, pop_large, island_model, fitness_sharing

### Validation Checkpoint
- Best fitness increases over 30 generations
- All 3 selection methods work
- Both encodings work
- Random search runs and returns results
- GA beats random search
- Edge cases handled without crashes

---

## 5. PHASE 3: EXPERIMENT PIPELINE

**Files**: `experiments/run_experiments.py`, `main.py`

### Requirements
- Accept --priority flag (p0, p1, p2, all) and --validate flag
- 30 independent runs with seeds 42-71 per experiment
- Checkpoint every 5 runs, resume from checkpoint if interrupted
- Log everything to experiment_log.txt
- Handle crashed runs gracefully (log error, assign None, continue)
- Use multiprocessing.Pool (cpu_count - 1 workers)
- tqdm progress bar with estimated time remaining

### Error Recovery
- Checkpoint corruption recovery (try backup file)
- If experiment takes >2 hours, reduce generations to 100
- Validation function for quick sanity check before running

---

## 6. PHASE 4: ANALYSIS & VISUALIZATION

**Files**: `experiments/analyze_results.py`, all `visualization/*.py` files

### Statistical Analysis
- Per-experiment: mean, median, best, worst, std dev (ddof=1)
- Wilcoxon rank-sum tests between baseline and each variant
- Cohen's d effect sizes
- Rank-biserial correlation
- Convergence speed G_80 (generation to reach 80% of final fitness)
- Significance markers: *** (p<0.001), ** (p<0.01), * (p<0.05), ns

### Visualization Files (24 total for report)

**From v1** (11):
1. Creature diagram (labeled anatomy)
2. Encoding diagram (direct vs indirect)
3. GA flowchart
4. Convergence plots (30 runs overlaid)
5. Box plots (grouped comparisons)
6. Diversity plots
7. Gene value heatmap
8. Skeleton trail
9. Generation replay
10. Side-by-side race
11. Family tree

**From v2** (13):
12. Controller architecture diagram (sine/CPG/CPG+NN)
13. Transfer testing heatmap (4×5 grid)
14. Epistasis matrix + consistency
15. CPG phase convergence
16. Cost of Transport bar chart
17. Push recovery filmstrip
18. NN output time-series (4 stacked subplots)
19. Sensor ablation bar chart
20. Gene sensitivity bar chart
21. Gait symmetry histogram
22. Seeded vs random convergence
23. Behavioral fingerprint radar chart
24. Perturbation survival curve

All figures: 300 DPI PNG to `report/figures/`

---

## 7. PHASE 5: PDF REPORT

Target: 28-33 pages using reportlab.

### Report Structure
- Title Page (1 page)
- Table of Contents (1 page)
- Section 1: Introduction (1.5-2 pages)
- Section 2: Literature Review (2-3 pages)
- Section 3: Methodology (4-5 pages) — notation table, creature diagram, encoding diagram, GA flowchart, all pseudocode, all formulas, controller architectures, CPG dynamics, sensor system, fitness function
- Section 4: Implementation & Parameters (3-4 pages)
- Section 5: Results (8-10 pages) — all tables and figures
- Section 6: Discussion (2-3 pages) — feedback, robustness, NN interpretation, landscape, threats to validity, future work
- Section 7: Conclusion (1 page)
- References (1-2 pages)

### Styling
- Body: Times-Roman 11pt, 1.15 line spacing
- Headers: 14pt bold, subheaders: 12pt bold
- Pseudocode: Courier 9pt, gray background (#F0F0F0)
- Margins: 1 inch (72pt) all sides
- CRITICAL: No Unicode subscripts — use reportlab `<sub>` and `<super>` tags

---

## 8. V2 ADDITIONS — CPG, CPG+NN, SENSORS

### Addition 1: Sensor System

18-dimensional sensor vector extracted every timestep:
- Joint angles (6 values, normalized to [-1,1])
- Joint angular velocities (6 values, normalized)
- Torso state: angle, angular velocity, height, horizontal velocity (4 values)
- Foot contacts: left, right (2 binary values)

```python
# Normalization constants — derived from v1 simulation ranges.
# Run best v1 creature for 15 seconds, record min/max, set these
# so typical values map to [-1, 1]. Extremes clamped to [-3, 3].

SENSOR_NORMS = {
    "joint_angle":       {"min": -1.57, "max": 1.57},    # [-π/2, π/2] rad
    "joint_velocity":    {"min": -15.0, "max": 15.0},    # rad/s typical range
    "torso_angle":       {"min": -1.57, "max": 1.57},    # [-π/2, π/2] rad
    "torso_angular_vel": {"min": -10.0, "max": 10.0},    # rad/s
    "torso_height":      {"min": 50.0,  "max": 200.0},   # pixels above ground
    "torso_horiz_vel":   {"min": -200.0, "max": 200.0},  # pixels/s
    # foot contacts are binary 0/1 — no normalization needed
}

# Named indices to avoid magic numbers in CPG+NN code
SENSOR_IDX = {
    "joint_angles_start": 0,      # indices 0-5
    "joint_vels_start": 6,        # indices 6-11
    "torso_angle": 12,
    "torso_angular_vel": 13,
    "torso_height": 14,
    "torso_horiz_vel": 15,
    "left_foot_contact": 16,
    "right_foot_contact": 17,
}

def normalize_sensor(value, sensor_name):
    """Normalize to [-1, 1] range, clamp to [-3, 3] for safety."""
    norms = SENSOR_NORMS[sensor_name]
    mid = (norms["max"] + norms["min"]) / 2
    half_range = (norms["max"] - norms["min"]) / 2
    if half_range < 1e-8:
        return 0.0
    normalized = (value - mid) / half_range
    return max(-3.0, min(3.0, normalized))  # hard clamp

def get_sensors(creature, space):
    """Extract 18-dimensional sensor vector from physics state."""
    sensors = []
    for joint in creature.motorized_joints:
        angle = joint.body_a.angle - joint.body_b.angle
        sensors.append(normalize_sensor(angle, "joint_angle"))
    for joint in creature.motorized_joints:
        ang_vel = joint.body_a.angular_velocity - joint.body_b.angular_velocity
        sensors.append(normalize_sensor(ang_vel, "joint_velocity"))
    sensors.append(normalize_sensor(creature.torso.angle, "torso_angle"))
    sensors.append(normalize_sensor(creature.torso.angular_velocity, "torso_angular_vel"))
    sensors.append(normalize_sensor(creature.torso.position.y, "torso_height"))
    sensors.append(normalize_sensor(creature.torso.velocity.x, "torso_horiz_vel"))
    sensors.append(1.0 if creature.left_foot_touching else 0.0)
    sensors.append(1.0 if creature.right_foot_touching else 0.0)
    return np.array(sensors, dtype=np.float64)  # shape: (18,)
```

**Foot contact detection** (pymunk-specific):

```python
FOOT_TYPE = 2
GROUND_TYPE = 1
foot_contacts = {"left": False, "right": False}

handler = space.add_collision_handler(FOOT_TYPE, GROUND_TYPE)

def begin_contact(arbiter, space, data):
    shapes = arbiter.shapes
    for shape in shapes:
        if shape == creature.left_foot_shape:
            foot_contacts["left"] = True
        elif shape == creature.right_foot_shape:
            foot_contacts["right"] = True
    return True

def separate_contact(arbiter, space, data):
    shapes = arbiter.shapes
    for shape in shapes:
        if shape == creature.left_foot_shape:
            foot_contacts["left"] = False
        elif shape == creature.right_foot_shape:
            foot_contacts["right"] = False

handler.begin = begin_contact
handler.separate = separate_contact
```

**Sensor Validation**:
1. Run best v1 creature, print sensor values at t=1s, 5s, 10s, 15s
2. Verify foot contacts alternate (left→right→left) for a walking creature
3. Verify NO sensor value exceeds ±3.0 (clamp is working)
4. Record actual min/max — update SENSOR_NORMS if initial guesses are wrong

### Addition 2: CPG Controller

**38 genes total**: 18 oscillator params + 20 coupling params

Phase dynamics (Kuramoto-style):
```python
d_phase_i = 2π * f_i + Σ_j w_ij * sin(phase_j - phase_i + φ_ij)
```

10 directed coupling connections:
- Ipsilateral: hip_L↔knee_L, hip_R↔knee_R (4 connections)
- Contralateral: hip_L↔hip_R, knee_L↔knee_R, shoulder_L↔shoulder_R (6 connections)

**Why coupling range [-2, 2] not [-5, 5]**: The intrinsic frequency term is 2π × f_i, ranging from ~1.9 to ~18.8 rad/s. With up to 4 connections per oscillator, coupling at ±5 adds up to ±20 rad/s — overwhelming the intrinsic frequency for slow oscillators. At ±2, max coupling contribution is ~8 rad/s, which influences but doesn't dominate the phase dynamics.

```python
def cpg_step(phases, params, dt):
    """Update CPG oscillator phases for one timestep."""
    new_phases = phases.copy()
    for i in range(6):
        # Intrinsic frequency drive
        d_phase = 2 * math.pi * params.frequencies[i]

        # Coupling from connected oscillators
        for j, w_ij, phi_ij in params.connections_from[i]:
            d_phase += w_ij * math.sin(phases[j] - phases[i] + phi_ij)

        # Clamp phase rate to prevent divergence
        d_phase = max(-62.8, min(62.8, d_phase))  # ±10 full cycles/sec max
        new_phases[i] = phases[i] + d_phase * dt

    targets = [params.amplitudes[i] * math.sin(new_phases[i]) for i in range(6)]
    return new_phases, targets
```

**Key difference from sine**: Sine phase relationships are fixed by genes. CPG phases are dynamic — they adapt during simulation based on coupling. This means CPG can recover from perturbations (a foot landing early shifts the phase, and coupling pulls the other leg back into rhythm).

**CPG Sanity Test (Day 1 — MUST PASS before proceeding)**: Run 10-generation mini-evolution. Verify best fitness > 200 by gen 10. If not: (1) reduce coupling weight range to [-1, 1], (2) initialize coupling weights near zero, (3) increase population to 150.

### Addition 3: CPG+NN Controller

**96 genes total**: 38 CPG + 58 NN

Architecture: 6 reduced sensors → 4 hidden (tanh) → 6 outputs (tanh)

**Why 6 sensors, not 18**: The GA needs to search a 96-dimensional space. With 18 inputs → 8 hidden → 6 output, you'd have 206 NN genes, totaling 244 genes. That's too many for 7,500 evaluations. Keep the NN small and let the CPG do the heavy lifting.

Reduced sensors: torso_angle, torso_angular_vel, left_foot_contact, right_foot_contact, torso_height, torso_horiz_vel

NN genes: (6×4) + 4 + (4×6) + 6 = 24 + 4 + 24 + 6 = 58 genes

```python
class CPGNNController:
    def __init__(self, genes):
        self.cpg = CPGController(genes[:38])
        nn_genes = genes[38:]
        self.W1 = np.array(nn_genes[0:24]).reshape(4, 6)
        self.b1 = np.array(nn_genes[24:28])
        self.W2 = np.array(nn_genes[28:52]).reshape(6, 4)
        self.b2 = np.array(nn_genes[52:58])
        # Scale from [0,1] gene space to [-2, 2] weight space
        self.W1 = self.W1 * 4 - 2
        self.b1 = self.b1 * 4 - 2
        self.W2 = self.W2 * 4 - 2
        self.b2 = self.b2 * 4 - 2

    def get_targets(self, t, sensors):
        cpg_targets = self.cpg.get_targets(t)
        reduced = np.array([
            sensors[SENSOR_IDX["torso_angle"]],
            sensors[SENSOR_IDX["torso_angular_vel"]],
            sensors[SENSOR_IDX["left_foot_contact"]],
            sensors[SENSOR_IDX["right_foot_contact"]],
            sensors[SENSOR_IDX["torso_height"]],
            sensors[SENSOR_IDX["torso_horiz_vel"]],
        ])
        h = np.tanh(self.W1 @ reduced + self.b1)
        m = np.tanh(self.W2 @ h + self.b2)
        # Modulate CPG output (±50% adjustment, can't flip sign)
        final_targets = [cpg * (1.0 + 0.5 * mod) for cpg, mod in zip(cpg_targets, m)]
        return final_targets
```

Modulation: `final_target = CPG_output × (1 + 0.5 × NN_modulation)`

**CPG-Seeded Initialization** (CRITICAL for CPG+NN to work):

```python
def initialize_cpgnn_population(pop_size, best_cpg_chromosome):
    """Initialize CPG+NN with CPG genes seeded from pre-evolved CPG."""
    population = []
    for i in range(pop_size):
        chromosome = np.zeros(96)
        # CPG genes: copy from best CPG with ±5% perturbation
        chromosome[:38] = best_cpg_chromosome.copy()
        noise = np.random.normal(0, 0.05, 38)
        chromosome[:38] = np.clip(chromosome[:38] + noise, 0, 1)
        # NN genes: near 0.5 (maps to weight ≈ 0, neutral modulation)
        chromosome[38:] = np.random.normal(0.5, 0.05, 58)
        chromosome[38:] = np.clip(chromosome[38:], 0, 1)
        population.append(chromosome)
    return population
```

**Frozen-NN Control** (isolates search-space dimensionality from sensory feedback):

```python
def evaluate_frozen_nn(chromosome, terrain, config):
    """Evaluate CPG+NN with NN genes forced to 0.5 (zero modulation)."""
    frozen = chromosome.copy()
    frozen[38:] = 0.5
    return evaluate(frozen, terrain, config)
```

**Crossover note for 96-gene chromosomes**: Use **uniform crossover** (not single-point). Single-point on 96 genes mostly recombines within-type genes and rarely crosses the CPG/NN boundary. Uniform allows testing whether parent A's CPG works better with parent B's NN.

### Two Simulation Modes

```python
def simulate(chromosome, controller_type, config, record=False):
    """
    record=False: returns fitness only (used during evolution)
    record=True: returns full per-timestep data (used for analysis)
    """
```

---

## 9. TRANSFER TESTING & PERTURBATION RECOVERY

### Transfer Testing Protocol

**Training phase**: 30 runs each for sine (flat), CPG (flat), CPG+NN flat-trained, CPG+NN mixed-trained

**Test phase**: Best chromosome from each of 30 runs tested on flat, hill, mixed, motor noise 5%, motor noise 10% (3 evaluations per terrain, take mean)

**Metrics**: Absolute fitness (primary), Retention rate = test_fitness / flat_test_fitness (secondary)

**IMPORTANT — retention rate denominator fix**: Use flat TEST fitness as the denominator for ALL controllers (not training fitness). Mixed-trained controllers were optimized for harder average conditions, so their training fitness is artificially suppressed.

**Motor noise implementation**:

```python
def apply_motor_noise(target_torque, noise_level):
    """Add Gaussian noise to motor torques. Clamp to prevent explosion."""
    noisy = target_torque * (1.0 + noise_level * np.random.randn())
    return max(-MAX_TORQUE, min(MAX_TORQUE, noisy))
```

**Mixed-terrain training implementation**:

```python
def evaluate_mixed_terrain(chromosome, config):
    """Evaluate on a randomly selected terrain for varied training."""
    terrain_options = ["flat", "hill", "mixed", "flat_noise_5"]
    terrain = random.choice(terrain_options)
    if terrain == "flat_noise_5":
        return evaluate(chromosome, "flat", config, motor_noise=0.05)
    return evaluate(chromosome, terrain, config)
```

**Note on mixed-terrain noise**: Random terrain selection makes fitness noisy. If run-to-run variance is very high, average 2 evaluations per chromosome per generation (doubles compute but halves noise).

#### Three Scenarios to Prepare For

**Scenario A**: CPG+NN mixed-trained >> CPG+NN flat-trained >> sine → Feedback + diverse training enables generalization

**Scenario B**: All transfer equally poorly → Terrain-specific evolution necessary regardless of architecture

**Scenario C**: CPG+NN flat-trained worse than sine → NN overfits to flat-terrain sensor patterns

**All three are valid findings.** Don't debug if you get B or C — report honestly.

### Perturbation Recovery Test

At t=7.5 seconds, apply **BACKWARD** horizontal impulse to torso (not forward — see Errata Fix 1).

Push strengths: 500 (gentle), 1500 (moderate), 3000 (strong), 5000 (violent)

```python
def perturbation_test(chromosome, controller_type, config, impulse_magnitude):
    """Test creature's ability to recover from a push mid-walk."""
    sim = setup_simulation(chromosome, controller_type, config)
    pre_push_vels = []
    post_push_vels = []
    recovery_time = None
    fell = False

    for step in range(900):  # 15 seconds × 60 FPS
        t = step / 60.0

        # Apply BACKWARD push at t=7.5 seconds
        if step == 450:
            sim.creature.torso.apply_impulse_at_local_point(
                (-impulse_magnitude, 0), (0, 0)  # BACKWARD push
            )

        sim.step()
        vel = sim.creature.torso.velocity.x

        if 300 <= step < 450:  # t=5 to t=7.5
            pre_push_vels.append(vel)

        if step > 450:
            post_push_vels.append(vel)
            mean_pre = np.mean(pre_push_vels)
            if recovery_time is None and vel > 0.5 * mean_pre:
                recovery_time = t - 7.5

        # Check fall ONLY AFTER push (not during normal walking)
        if step > 450 and sim.creature.torso.position.y < ground_height + 10:
            fell = True

    return {
        "pre_push_velocity": np.mean(pre_push_vels),
        "post_push_velocity": np.mean(post_push_vels[-180:]),
        "recovery_time": recovery_time,
        "fell": fell,
        "final_distance": sim.creature.torso.position.x - sim.initial_x,
    }
```

**Test matrix**: 30 best chromosomes × **4** controllers × 4 push strengths = **480** evals ≈ 13 min

Metrics: pre/post push velocity, recovery time, fell (boolean), final distance

**Key output**: Maximum survivable push per controller (highest impulse where >50% of 30 chromosomes don't fall)

**Statistical test for push results** — use Fisher's exact test (binary outcomes, not Mann-Whitney):

```python
from scipy.stats import fisher_exact

def compare_push_survival(sine_survived, cpgnn_survived, total=30):
    """Fisher's exact test for 2×2 contingency table."""
    table = [[sine_survived, total - sine_survived],
             [cpgnn_survived, total - cpgnn_survived]]
    odds_ratio, p_value = fisher_exact(table)
    return odds_ratio, p_value
```

Report in Table 3 as additional column: "p (Fisher's exact)".

---

## 10. FITNESS LANDSCAPE & INTERPRETABILITY

### Fitness Distance Correlation (FDC)

```python
def compute_fdc_robust(evaluate_fn, best_chromosomes_30, n_samples=2000, n_genes=18):
    """
    FDC relative to multiple reference points.
    FDC < -0.15: funneling | FDC ≈ 0: neutral | FDC > 0.15: deceptive
    Jones & Forrest (1995)
    """
    random_chromosomes = [np.random.uniform(0, 1, n_genes) for _ in range(n_samples)]
    fitnesses = [evaluate_fn(c) for c in random_chromosomes]

    fdc_values = []
    for best_known in best_chromosomes_30:
        distances = [np.linalg.norm(c - best_known) for c in random_chromosomes]
        fdc = np.corrcoef(fitnesses, distances)[0, 1]
        fdc_values.append(fdc)

    return {
        "mean_fdc": np.mean(fdc_values),
        "std_fdc": np.std(fdc_values),
        "min_fdc": np.min(fdc_values),
        "max_fdc": np.max(fdc_values),
        "all_fdc": fdc_values,
    }
```

Cost: 2,000 sims at 5-sec each ≈ 7 min. Note: 5-sec sims may produce structurally different landscape than 15-sec. Validate with Spearman rank correlation on 100 random creatures at both durations. If ρ < 0.9, note in Threats to Validity.

### Epistasis Matrix (sine only — 18 genes)

```python
def compute_epistasis_robust(evaluate_fn, best_chromosomes, n_genes=18, delta=0.05, n_refs=5):
    """Epistasis at multiple reference points with consistency metric."""
    matrices = []
    for ref in best_chromosomes[:n_refs]:
        matrix = compute_epistasis(evaluate_fn, ref, n_genes, delta)
        matrices.append(matrix)

    mean_matrix = np.mean(matrices, axis=0)
    std_matrix = np.std(matrices, axis=0)
    consistency = np.where(np.abs(mean_matrix) > 1e-6,
                           np.abs(mean_matrix) / (std_matrix + 1e-8), 0)

    return mean_matrix, std_matrix, consistency
```

CPG+NN excluded (C(96,2) = 4,560 pairs — too expensive). Note in Threats to Validity.

Cost: 5 refs × 172 evals = 860 sims at 5-sec each ≈ 70 minutes.

### Gene Sensitivity Analysis

**IMPORTANT**: Cannot reuse epistasis data (different δ: epistasis uses 0.05, sensitivity uses 0.10). Run independently.

```python
def compute_gene_sensitivity(evaluate_fn, reference, n_genes=18, delta=0.10):
    """Central difference approximation of fitness gradient per gene."""
    sensitivities = []
    for i in range(n_genes):
        x_plus = reference.copy()
        x_minus = reference.copy()
        x_plus[i] = min(1.0, reference[i] + delta)
        x_minus[i] = max(0.0, reference[i] - delta)
        f_plus = evaluate_fn(x_plus)
        f_minus = evaluate_fn(x_minus)
        sensitivity = abs(f_plus - f_minus) / (2 * delta)
        sensitivities.append(sensitivity)
    return sensitivities
```

Cost: 36 evals per ref, 5 refs = 180 evals ≈ 5 min.

**Also compute for CPG** (38 genes): 76 evals per ref × 5 refs = 380 evals ≈ 10 min. Report: "In the CPG landscape, coupling weight genes between hips are most sensitive — validating that inter-limb coordination is the key evolved feature."

### Sensor Ablation Study

**CRITICAL**: Replace each ablated sensor with its **running mean** from an unablated simulation — NOT zero. Zero injects false information (zero foot_contact = "airborne"; zero torso_angle = "perfectly upright"). The running mean gives plausible but uninformative values.

```python
def sensor_ablation(chromosome, controller_type, config, n_trials=3):
    # Step 1: Run unablated sim, record mean sensor values
    baseline_history = simulate(chromosome, controller_type, config, record=True)
    mean_sensor_values = np.mean(baseline_history["sensors"], axis=0)

    # Step 2: Baseline fitness
    baseline = np.mean([evaluate(chromosome, "flat", config) for _ in range(n_trials)])

    # Step 3: Ablate each sensor by replacing with its mean
    results = {}
    for i, name in enumerate(SENSOR_NAMES):
        ablated = np.mean([
            evaluate_with_replaced_sensor(chromosome, "flat", config, i, mean_sensor_values[i])
            for _ in range(n_trials)
        ])
        results[name] = {
            "fitness": ablated,
            "drop": baseline - ablated,
            "drop_pct": 100 * (baseline - ablated) / max(baseline, 0.01),
        }

    # Pair ablation: replace both foot contacts with their means
    pair_ablated = np.mean([
        evaluate_with_replaced_sensor(chromosome, "flat", config, [2, 3],
                                       [mean_sensor_values[2], mean_sensor_values[3]])
        for _ in range(n_trials)
    ])
    results["both_foot_contacts"] = {
        "fitness": pair_ablated,
        "drop": baseline - pair_ablated,
        "drop_pct": 100 * (baseline - pair_ablated) / max(baseline, 0.01),
    }
    return baseline, results
```

Run on top 10 CPG+NN chromosomes (both flat-trained and mixed-trained). Cost: 10 × 8 conditions × 3 trials = 240 evals ≈ 5 min.

### NN Output Visualization

**CRITICAL**: Do NOT recover modulation from `(final - cpg) / (0.5 * cpg)` — divides by near-zero when CPG output crosses zero. Plot the NN's tanh output `m` directly.

```python
def record_nn_outputs(chromosome, controller_type, config, duration=5.0):
    sim = setup_simulation(chromosome, controller_type, config)
    history = {"time": [], "nn_modulation": [], "cpg_output": [],
               "final_torque": [], "sensors": []}

    for step in range(int(duration * 60)):
        t = step / 60.0
        sensors = get_sensors(sim.creature, sim.space)
        cpg_targets = sim.controller.cpg.get_targets(t)

        # Get NN modulation DIRECTLY from forward pass
        reduced = extract_reduced_sensors(sensors)
        h = np.tanh(sim.controller.W1 @ reduced + sim.controller.b1)
        m = np.tanh(sim.controller.W2 @ h + sim.controller.b2)  # Plot THIS

        final_targets = [cpg * (1.0 + 0.5 * mod) for cpg, mod in zip(cpg_targets, m)]

        history["nn_modulation"].append(m.copy())
        history["cpg_output"].append(cpg_targets)
        history["final_torque"].append(final_targets)
        history["sensors"].append(sensors.copy())
        history["time"].append(t)
        sim.step()
    return history
```

### Gait Symmetry Analysis

Phase difference between left and right hip oscillators: π (180°) = walking, 0° = hopping.

**CRITICAL**: Handle incommensurate frequencies (sine controller). If left and right hip frequencies differ by >10%, phase difference sweeps through all values — a mathematical artifact, not a gait characteristic.

```python
def compute_gait_symmetry(chromosome, controller_type, config):
    if controller_type == "sine":
        freq_L = decode_frequency(chromosome, joint_idx=0)
        freq_R = decode_frequency(chromosome, joint_idx=1)
        freq_ratio = abs(freq_L - freq_R) / max(freq_L, freq_R)
        if freq_ratio > 0.10:
            return {
                "mean_phase_diff": None,
                "is_incommensurate": True,
                "freq_ratio": freq_ratio,
                "phase_stability": 0.0,
            }

    sim = setup_simulation(chromosome, controller_type, config)
    phase_diffs = []
    for step in range(900):
        t = step / 60.0
        sim.step()
        if t > 3.0:  # skip transient
            if controller_type in ("cpg", "cpg_nn"):
                left_phase = sim.controller.cpg.phases[0]
                right_phase = sim.controller.cpg.phases[1]
            else:
                left_phase = 2 * np.pi * sim.controller.frequencies[0] * t + sim.controller.phases[0]
                right_phase = 2 * np.pi * sim.controller.frequencies[1] * t + sim.controller.phases[1]
            diff = abs(left_phase - right_phase) % (2 * np.pi)
            if diff > np.pi:
                diff = 2 * np.pi - diff
            phase_diffs.append(diff)
    return {
        "mean_phase_diff": np.mean(phase_diffs),
        "std_phase_diff": np.std(phase_diffs),
        "is_walking": abs(np.mean(phase_diffs) - np.pi) < 0.5,
        "is_hopping": np.mean(phase_diffs) < 0.5,
        "phase_stability": 1.0 / (np.std(phase_diffs) + 0.01),
    }
```

Report: "X/30 sine creatures had incommensurate hip frequencies and were excluded. This demonstrates that sine evolution does not naturally discover matched frequencies, while CPG coupling enforces frequency synchronization."

### Behavioral Fingerprinting

**CRITICAL**: Extract all metrics from a SINGLE simulation run (not double-simulating for gait symmetry).

```python
def compute_behavioral_fingerprint(chromosome, controller_type, config):
    sim = run_full_simulation_with_recording(chromosome, controller_type, config)
    return {
        "distance": sim.final_x - sim.initial_x,
        "avg_speed": (sim.final_x - sim.initial_x) / sim.duration,
        "step_frequency": count_foot_strikes(sim.left_foot_history) / sim.duration,
        "duty_factor": fraction_with_foot_on_ground(sim.left_foot_history, sim.right_foot_history),
        "double_support": fraction_both_feet_down(sim.left_foot_history, sim.right_foot_history),
        "avg_torso_angle": np.mean(np.abs(sim.torso_angle_history)),
        "torso_stability": 1.0 / (np.std(sim.torso_angle_history) + 0.01),
        "cost_of_transport": compute_cost_of_transport(sim),
        "gait_symmetry": compute_gait_symmetry_from_history(sim.phase_history),
    }
```

**Foot contact helper functions** (required by behavioral fingerprinting):

```python
def count_foot_strikes(foot_contact_history):
    """Count False→True transitions (heel strikes)."""
    strikes = 0
    for i in range(1, len(foot_contact_history)):
        if foot_contact_history[i] and not foot_contact_history[i-1]:
            strikes += 1
    return strikes

def fraction_with_foot_on_ground(left_history, right_history):
    """Fraction of timesteps where at least one foot is on ground."""
    return np.mean([l or r for l, r in zip(left_history, right_history)])

def fraction_both_feet_down(left_history, right_history):
    """Fraction of timesteps where both feet are on ground (double support)."""
    return np.mean([l and r for l, r in zip(left_history, right_history)])
```

### Cost of Transport

```python
def compute_cost_of_transport(sim_result):
    """CoT = total_energy / (mass × distance × gravity). Simulation units only."""
    total_energy = 0.0
    dt = 1.0 / sim_result.fps
    for torques, ang_vels in zip(sim_result.torque_history, sim_result.ang_vel_history):
        for torque, ang_vel in zip(torques, ang_vels):
            power = torque * ang_vel
            if power > 0:
                total_energy += power * dt * 1.0       # concentric
            elif power < 0:
                total_energy += abs(power) * dt * 0.3  # eccentric
            else:
                total_energy += abs(torque) * dt * 0.5  # isometric
    mass = sim_result.creature_mass
    distance = max(abs(sim_result.final_x - sim_result.initial_x), 0.01)
    gravity = 981.0
    return total_energy / (mass * distance * gravity)
```

### Landscape Flyover (P2 — if ahead of schedule)

2D slice of fitness landscape through PCA of best chromosomes:

```python
def landscape_slice_2d(evaluate_fn, best_chromosomes, resolution=50):
    from sklearn.decomposition import PCA
    pca = PCA(n_components=2)
    pca.fit(best_chromosomes)
    centroid = np.mean(best_chromosomes, axis=0)
    pc1, pc2 = pca.components_[0], pca.components_[1]
    scale1 = np.std(pca.transform(best_chromosomes)[:, 0]) * 3
    scale2 = np.std(pca.transform(best_chromosomes)[:, 1]) * 3
    grid_x = np.linspace(-scale1, scale1, resolution)
    grid_y = np.linspace(-scale2, scale2, resolution)
    fitness_map = np.zeros((resolution, resolution))
    for i, x in enumerate(grid_x):
        for j, y in enumerate(grid_y):
            point = centroid + x * pc1 + y * pc2
            point = np.clip(point, 0, 1)
            fitness_map[j, i] = evaluate_fn(point)
    return grid_x, grid_y, fitness_map, pca.transform(best_chromosomes)
```

Cost: 2,500 sims at 5-sec each ≈ 3.5 hours.

---

## 11. EXPERIMENT PLAN & RESULTS TABLES

### New Experiments (v2)

| # | Experiment | Runs/Evals | Est. Time |
|---|-----------|-----------|-----------|
| 1 | CPG baseline (38 genes, flat) | 30 runs | ~30 min |
| 2 | CPG+NN flat-trained (96 genes, CPG-seeded) | 30 runs | ~45 min |
| 3 | CPG+NN mixed-trained (random terrain per eval) | 30 runs | ~60 min |
| 4 | CPG+NN frozen-NN (NN genes locked at 0.5) | 30 runs | ~45 min |
| 5 | CPG+NN high mutation (rate=0.10) | 30 runs | ~45 min |
| 6 | CPG+NN random init (no CPG seeding) | 30 runs | ~45 min |
| 7 | Transfer testing (best × 5 terrains × 3 trials) | ~2700 evals | ~30 min |
| 8 | Perturbation recovery (30 × 3 × 4 push strengths) | 360 evals | ~10 min |
| 9 | FDC sine (2000 random, 5-sec sims) | 2000 evals | ~7 min |
| 10 | FDC CPG+NN (2000 random, 5-sec sims) | 2000 evals | ~7 min |
| 11 | Epistasis sine (5 refs × 172 perturbations) | 860 evals | ~70 min |
| 12 | Gene sensitivity (5 refs × 36 perturbations) | 180 evals | ~5 min |
| 13 | Sensor ablation (10 × 8 × 3) | 240 evals | ~5 min |
| 14 | NN output recording (6 best × 15-sec) | 6 sims | ~2 min |
| 15 | Gait symmetry (30 × 3 controllers) | 90 sims | ~3 min |
| 16 | Behavioral fingerprinting (30 creatures) | 30 sims | ~2 min |

### Results Tables

**Table 1**: Controller Comparison — Flat Terrain

| Controller | Genes | Mean Fitness | Std Dev | Best | Worst | CoT | G_80 |
|-----------|-------|-------------|---------|------|-------|-----|------|
| Sine (v1) | 18 | 746.78 | 135.22 | 1093.82 | 472.52 | — | — |
| CPG | 38 | — | — | — | — | — | — |
| CPG+NN (flat) | 96 | — | — | — | — | — | — |
| CPG+NN (frozen-NN) | 96 | — | — | — | — | — | — |
| CPG+NN (mixed) | 96 | — | — | — | — | — | — |
| CPG+NN (random init) | 96 | — | — | — | — | — | — |
| Random search | 18 | 613.76 | — | — | — | — | — |

**Table 2**: Transfer Testing — Absolute Fitness

| Controller | Flat | Hill | Mixed | Noise 5% | Noise 10% |
|-----------|------|------|-------|----------|-----------|
| Sine (flat) | X ± Y | X ± Y | X ± Y | X ± Y | X ± Y |
| CPG (flat) | X ± Y | X ± Y | X ± Y | X ± Y | X ± Y |
| CPG+NN (flat) | X ± Y | X ± Y | X ± Y | X ± Y | X ± Y |
| CPG+NN (mixed) | X ± Y | X ± Y | X ± Y | X ± Y | X ± Y |

**Table 3**: Perturbation Recovery

| Controller | Gentle (500) | Moderate (1500) | Strong (3000) | Violent (5000) | p (Fisher) |
|-----------|-------------|----------------|--------------|---------------|------------|
| Sine | X/30 survive | X/30 | X/30 | X/30 | — |
| CPG | X/30 survive | X/30 | X/30 | X/30 | — |
| CPG+NN (flat) | X/30 survive | X/30 | X/30 | X/30 | — |
| CPG+NN (mixed) | X/30 survive | X/30 | X/30 | X/30 | — |

**Table 4**: Sensor Ablation — Fitness Drop (%)

| Ablated Sensor | CPG+NN flat | CPG+NN mixed | Interpretation |
|---------------|------------|-------------|----------------|
| torso_angle | — | — | balance sensing |
| torso_angular_vel | — | — | fall prediction |
| left_foot_contact | — | — | gait phase (left) |
| right_foot_contact | — | — | gait phase (right) |
| torso_height | — | — | posture |
| horizontal_vel | — | — | speed regulation |
| both_feet (pair) | — | — | gait phase detection |

**Table 5**: Fitness Landscape Metrics

| Metric | Sine (18 genes) | Interpretation |
|--------|----------------|----------------|
| FDC (mean ± std across 30 refs) | — | <-0.15 = funneling |
| FDC range | — | Large range = multi-basin |
| Mean |epistasis| | — | Gene interaction strength |
| Max epistasis pair | — | Most coupled genes |
| Epistasis consistency | — | >3 = robust pattern |

**Table 6**: Gait Characteristics

| Controller | Walking rate | Mean phase diff | Phase stability | Mean CoT |
|-----------|-------------|----------------|----------------|----------|
| Sine | X/30 | — ± — | — | — |
| CPG | X/30 | — ± — | — | — |
| CPG+NN (flat) | X/30 | — ± — | — | — |
| CPG+NN (mixed) | X/30 | — ± — | — | — |

**Table 7**: Seeded vs Random Initialization

| Metric | CPG-Seeded | Random Init | Difference |
|--------|-----------|-------------|------------|
| Gen 1 best fitness | — | — | — |
| G_80 | — | — | evaluations saved |
| Final best fitness | — | — | — |
| Final mean fitness | — | — | — |

**Tables 8-12**: Keep from v1 (selection, mutation, elitism, algorithm, encoding)

---

## 12. INTERACTIVE WEBSITE — OVERVIEW & ARCHITECTURE

### Overview

A single-page React application with live 2D physics simulation. The website serves as both a project showcase and an interactive research tool. Dark gaming aesthetic throughout.

### Tech Stack
- **React** (JSX artifact)
- **Matter.js** — 2D rigid body physics (browser equivalent of pymunk)
- **Three.js** (r128) — 3D fitness landscape, chromosome helix
- **Recharts** — interactive charts
- **Tone.js** — generative soundtrack
- **Tailwind CSS** — styling
- **Web Workers** — GA evolution off main thread
- **Persistent Storage API** — leaderboard, analytics, speedrun records

### Data Pipeline: Python → Website

```python
# export_for_web.py — run after all experiments complete
web_data = {
    "best_chromosomes": {
        "sine": {"genes": [...], "fitness": float},
        "cpg": {"genes": [...], "fitness": float},
        "cpgnn_flat": {"genes": [...], "fitness": float},
        "cpgnn_mixed": {"genes": [...], "fitness": float},
    },
    "convergence": {...},    # per-gen best fitness, mean/std across 30 runs
    "transfer": {...},       # 4 controllers × 5 terrains
    "push_test": {...},      # survival rates per push strength
    "fitness_distributions": {...},  # 30 values per experiment
    "parameter_comparisons": {...},  # from v1
    "fdc": {...},
    "epistasis_top_pairs": [...],
    "stat_tests": [...],
    "landscape_slices": {...},  # for 3D fitness landscape
}
```

### Color Palette
- Background: `#0F172A` (dark navy)
- Cards: `#1E293B` (slate-800) with `#334155` borders
- Sine accent: `#3B82F6` (blue-500)
- CPG accent: `#10B981` (emerald-500)
- CPG+NN accent: `#F59E0B` (amber-500)
- Text: `#F1F5F9` primary, `#94A3B8` secondary
- Canvas: `#111827` background, `#4ADE80` ground line

### Typography
- Title: "STRIDE" in bold monospace, walking animation on the 'I'
- Headers: clean sans-serif, uppercase tracking
- Data: monospace for all numbers and gene values

### Physics Fidelity Note
Matter.js creature will be qualitatively similar but quantitatively different from pymunk. Live simulations (Tabs 1-4) use approximate Matter.js physics. Statistical results (Tab 5) show REAL pymunk experiment data.

---

## 13. WEBSITE TABS

### Tab 1: HERO — "Watch Evolution Happen"

Large canvas showing stick figure creature on flat ground. Below: fitness-over-generations line chart updating in real time.

Controls: Play/Pause, Speed (1×/2×/5×/10×), Reset, Population Size slider (20-100).

Full GA runs in Web Worker. Each generation: all creatures simulated (3-second sims for speed), best creature rendered on main canvas, fitness chart updates.

**Technical implementation**: Worker runs simplified forward kinematics (no Matter.js in workers). Main thread creates Matter.js creature with best chromosome for visual rendering. Camera follows creature.

**Estimated complexity**: ~400-500 lines. Hardest tab.

### Tab 2: CONTROLLER COMPARISON — "Side by Side Race"

Three side-by-side canvases: Sine, CPG, CPG+NN walking simultaneously. Terrain selector (Flat/Hill/Mixed). Timer, distance markers. Pre-loaded with best chromosomes.

```javascript
function ControllerRace() {
  const [terrain, setTerrain] = useState("flat");
  const sineWorld = useMatterWorld(BEST_CHROMOSOMES.sine, "sine", terrain);
  const cpgWorld = useMatterWorld(BEST_CHROMOSOMES.cpg, "cpg", terrain);
  const cpgnnWorld = useMatterWorld(BEST_CHROMOSOMES.cpgnn_flat, "cpgnn", terrain);
  return (
    <div className="grid grid-cols-3 gap-4">
      <CreatureCanvas world={sineWorld} label="Sine (18 genes)" color="#3B82F6" />
      <CreatureCanvas world={cpgWorld} label="CPG (38 genes)" color="#10B981" />
      <CreatureCanvas world={cpgnnWorld} label="CPG+NN (96 genes)" color="#F59E0B" />
      <TerrainSelector value={terrain} onChange={setTerrain} />
    </div>
  );
}
```

**Estimated complexity**: ~200-300 lines. Reuses creature module from Tab 1.

### Tab 3: PUSH TEST — "Test Robustness"

One large canvas with creature walking. PUSH button (or spacebar). Push strength slider (500/1000/1500/2000). Controller selector. Verdict display: "RECOVERED" (green) or "FELL" (red) with recovery time.

This is the single most impressive demo. Push sine → falls. Push CPG+NN → recovers.

```javascript
function PushTest() {
  const [controller, setController] = useState("cpgnn_flat");
  const [pushStrength, setPushStrength] = useState(1000);
  const [result, setResult] = useState(null);

  const handlePush = () => {
    const torso = worldRef.current.creature.torso;
    Matter.Body.applyForce(torso, torso.position, {
      x: -pushStrength * 0.001,  // BACKWARD (Errata Fix #1)
      y: 0
    });
    setTimeout(() => {
      const speed = torso.velocity.x;
      const upright = Math.abs(torso.angle) < Math.PI / 4;
      setResult(speed > 0.5 && upright ? "RECOVERED" : "FELL");
    }, 3000);
  };

  return (
    <div>
      <CreatureCanvas world={world} showPushIndicator={true} />
      <div className="flex gap-4 mt-4">
        <ControllerSelector value={controller} onChange={setController} />
        <PushStrengthSlider value={pushStrength} onChange={setPushStrength} />
        <button onClick={handlePush}
          className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-lg
                     hover:bg-red-600 active:scale-95 transition-all">
          PUSH (or press Space)
        </button>
      </div>
      {result && (
        <div className={`text-2xl font-bold mt-4 ${
          result === "RECOVERED" ? "text-green-500" : "text-red-500"
        }`}>
          {result === "RECOVERED" ? "✓ RECOVERED" : "✗ FELL"}
        </div>
      )}
    </div>
  );
}
```

**Estimated complexity**: ~150-200 lines.

### Tab 4: GENE PLAYGROUND — "Design Your Own Walker"

Creature walking on left. 18 sliders on right grouped by joint. Real-time gait changes. Fitness readout. Color-coded sliders (hip=blue, knee=green, shoulder=orange).

Presets: Best Evolved Walker, Hopping Gait, Crawling Gait, Moonwalk, Random, All Zero, Symmetric.

"Challenge: Can you beat the GA?" display.

```javascript
function GenePlayground() {
  const [genes, setGenes] = useState(BEST_CHROMOSOMES.sine.genes);
  const JOINT_GROUPS = [
    { name: "Hip L", color: "blue", indices: [0, 1, 2] },
    { name: "Knee L", color: "green", indices: [3, 4, 5] },
    { name: "Shoulder L", color: "orange", indices: [6, 7, 8] },
    { name: "Hip R", color: "blue", indices: [9, 10, 11] },
    { name: "Knee R", color: "green", indices: [12, 13, 14] },
    { name: "Shoulder R", color: "orange", indices: [15, 16, 17] },
  ];
  const PARAM_LABELS = ["Amplitude", "Frequency", "Phase"];

  const updateGene = (idx, value) => {
    const newGenes = [...genes];
    newGenes[idx] = value;
    setGenes(newGenes);
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <CreatureCanvas genes={genes} controller="sine" />
      <div className="space-y-4 overflow-y-auto max-h-[600px]">
        {JOINT_GROUPS.map(group => (
          <div key={group.name} className={`border-l-4 border-${group.color}-500 pl-3`}>
            <h3 className="font-bold">{group.name}</h3>
            {group.indices.map((idx, i) => (
              <div key={idx} className="flex items-center gap-2">
                <label className="w-24 text-sm">{PARAM_LABELS[i]}</label>
                <input type="range" min="0" max="1" step="0.01"
                  value={genes[idx]}
                  onChange={e => updateGene(idx, parseFloat(e.target.value))}
                  className="flex-1" />
                <span className="w-12 text-sm text-right">{genes[idx].toFixed(2)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Estimated complexity**: ~200 lines.

### Tab 5: RESULTS DASHBOARD — "The Science"

Interactive Recharts versions of all key report figures:
1. Convergence Plots (toggleable series, shaded std dev bands)
2. Transfer Heatmap (4×5 colored grid)
3. Push Test Results (grouped bar chart)
4. Fitness Distributions (box/violin plots)
5. Statistical Significance Table (p-values, Cohen's d, significance stars)
6. FDC Scatter Plot (2000 points, interactive hover)
7. Epistasis Matrix Heatmap (18×18, gene labels)

```javascript
function ResultsDashboard() {
  return (
    <div className="space-y-12">
      <ConvergencePlot data={WEB_DATA.convergence} />
      <TransferHeatmap data={WEB_DATA.transfer} />
      <PushTestChart data={WEB_DATA.push_test} />
      <FitnessBoxPlots data={WEB_DATA.fitness_distributions} />
      <StatTable data={WEB_DATA.stat_tests} />
      <FDCScatter data={WEB_DATA.fdc} />
      <EpistasisHeatmap data={WEB_DATA.epistasis_top_pairs} />
    </div>
  );
}
```

**Estimated complexity**: ~400 lines (many small chart components).

### Tab 6: ABOUT — "How It Works"

Project info, problem description, controller architecture diagram (SVG/React), GA flowchart, notation table, PDF download link, GitHub link, citations.

Small note at bottom: "Live simulations use Matter.js (approximate). Statistical results are from pymunk (exact)."

**Estimated complexity**: ~150 lines.

---

## 14. WEBSITE VISUAL FEATURES

### Core Visual System

#### Feature 1: Creature DNA Sharing via URL

Encode chromosome + controller + tab state into URL hash (base64). Share buttons on every tab. Toast notification on copy.

```
stride.dev/#eyJnIjpbMC40MiwwLjc4Li4uXSwiYyI6InMiLCJ0IjoicGxheWdyb3VuZCJ9
```

Buttons: "Share This Walker" (playground), "Share This Moment" (push test), "Share This Race" (A/B mode)

#### Feature 2: Live Neural Network Visualization

Animated node-link diagram when CPG+NN is selected. 6 input nodes → 4 hidden → 6 output. Nodes pulse with activation values (green=positive, red=negative). Connection lines: cyan=positive weight, magenta=negative. Thickness proportional to weight. Pulse dots travel along active connections.

For sine/CPG: show CPG Phasor Diagram instead — 6 circles with rotating phase lines, coupling lines between connected oscillators.

Key moment: When pushed, torso_angle sensor flares red, signal propagates visibly through network, outputs respond.

#### Feature 3: Ghost Trail / Afterimage Mode

Toggle (keyboard `G`). Fading semi-transparent creature copies every 5 frames. Max 20 ghosts (~1.7 seconds). Color: cyan with decreasing alpha. Auto-enable for 3 seconds after push.

#### Feature 4: Creature Hall of Fame / Leaderboard

Shared persistent storage leaderboard. Submit from Gene Playground with name + genes + fitness. Sorted by fitness, max 50 entries. GA benchmark shown as gold line. "BEAT THE GA" badge for entries above it. "Watch" button loads any entry's genes.

#### Feature 5: Guided Narrative Tour

Self-running interactive story (8 steps, ~2 minutes):
1. Random creature spawns (flops)
2. Explain the problem
3. Quick evolution (50 gens, fast)
4. Show evolved walker
5. Change to hill terrain (stumbles)
6. Introduce CPG+NN (adapts)
7. Push test demo (auto-push)
8. Hand off to user

Spotlight overlay with dark dimming + transparent cutout. Step counter dots. Skip button.

#### Feature 6: Particle Effects + Visual Polish

**Particle System** with effects catalog:
- `footDust`: 6 gray particles on foot contact
- `pushImpact`: 25 red particles on push
- `crashDebris`: 30 amber particles on fall
- `fitnessRecord`: 50 green confetti on new record
- `ambientDust`: floating background particles
- `speedLine`: blue streaks behind fast creatures

**Screen Shake**: On push — intensity 10, duration 300ms, exponential decay.

**Additional polish**: Canvas vignette, subtle scanlines toggle, creature glow, pulsing ground line, canvas reflection beneath ground.

#### Feature 7: 3D Fitness Landscape Flyover (Three.js)

Interactive 3D surface plot. Fitness as height, color gradient (deep blue → cyan → green → gold). Population dots animate across surface over generations.

Controls: Generation slider with Play button, Gene X/Y axis selectors, mouse orbit rotation.

Pre-computed landscape data: 10 interesting gene pairs × 60×60 grid.

#### Feature 8: A/B Comparison Mode

Two dropdown selectors (left/right creature). 8 presets combining controller + terrain. Split-screen canvases with center divider. Timer, distance bars, "WINNER" overlay. Start Race / Reset buttons.

#### Feature 9: Export Creature as GIF

Camera icon button. 3-second countdown → recording (red border pulse) → progress bar → auto-download. 20fps, 3-5 seconds. "STRIDE — Dev Krishna" watermark.

Fallback if gif.js workers don't work in artifact sandbox: export as filmstrip PNG.

#### Feature 10: Impact Shockwave on Push

Circular distortion ring emanating from push point. Canvas CSS shake. If creature falls: crack pattern on ground. If recovers: golden glow pulse.

#### Feature 11: Evolution Timelapse Cinema Mode

Full-screen cinematic playback. Creature evolves from generation 1 to 150 in 30 seconds. Background shifts color (red→orange→yellow→green) as fitness improves. Fitness graph traces itself in bottom-right like stock ticker. Generation counter ticks up. Ends with "EVOLVED" flash + final fitness score. Auto-plays as landing hero.

#### Feature 12: Skeleton X-Ray Mode

Toggle strips body fills, shows only glowing neon wireframe. Joint circles pulse with torque magnitude. Connections glow with angular velocity. Bioluminescent deep-sea creature aesthetic on dark background. Combine with ghost trail for long-exposure photography effect.

#### Feature 13: Split-Screen Replay with Time Scrubbing

After any simulation: timeline scrubber at bottom. Drag to any point for exact creature pose. Frame-by-frame control. For push test: scrub to exact impact moment.

#### Feature 14: Gene Space Warp Visualization

During live evolution (Tab 1): 2D PCA/t-SNE projection of population as colored dots. Dots cluster, drift, converge. Color by fitness (blue=low, red=high). Lines briefly connect parents to children during crossover. "Watching a galaxy form."

#### Feature 15: Controller Architecture Animated Diagram

Animated (not static) diagrams:
- Sine: sine wave oscillates → drives joint rotation
- CPG: spinning circles connected by springs that pull into sync
- CPG+NN: CPG circles feed into NN, activations flow through connections, outputs modify CPG

Interactive: hover over any component to see current value.

#### Feature 16: Photo Mode

Camera icon freezes frame. Composition tool: camera zoom, background color, ghost trail density, grid overlay, labels. "Capture" saves high-res PNG. "Made with STRIDE" watermark.

#### Feature 17: Chromosome Visualizer Bar

Persistent horizontal bar at bottom of simulation canvases. Each gene = colored rectangle (blue=0 → red=1). Grouped by joint for sine (18 segments), by CPG/coupling/NN sections for CPG+NN (96 segments). During live evolution: bar morphs between generations.

#### Feature 18: Creature Morphing Transition

When switching controller types: smooth interpolation between old and new gait over 1 second. Lerp between motor target sets. Creature "learns" new walking style in real-time.

#### Feature 19: Evolutionary Family Tree / Phylogenetic Viewer

Interactive tree. Each node = small creature thumbnail. Root = gen 1 best. Branches = parent→child crossover. Nodes sized by fitness, colored by generation. Click any node to see ancestor walk in mini-canvas. Zoom in: see which genes came from which parent.

#### Feature 20: Heatmap Floor

Terrain surface shows density of creature walkover positions. Bright = heavily trafficked, dark = only best creatures reached here. Updates in real-time during evolution. "Frontier of exploration" pushes further right.

#### Feature 21: Slow Motion Replay with Motion Blur

After push/fall/race finish: auto-trigger 3× slow motion. Motion blur via drawing previous 3 frames at decreasing opacity. "REPLAY" watermark. Sports broadcast feel.

#### Feature 22: Creature Customization Studio

Beyond gene sliders: drag to resize limbs, pick colors for each body part, add accessories (hat, cape, shoes — cosmetic SVG overlays), name your creature. Cosmetic only (no physics effect). Save customized creatures to leaderboard with custom appearance.

#### Feature 23: Environmental Storytelling Background

Parallax layers: distant mountains (slow), midground trees (medium), foreground grass (fast). Different environments per terrain: flat=grassland+sunset, hill=mountain pass+clouds, mixed=alien planet+floating rocks. Simple layered SVG/CSS gradients.

#### Feature 24: Real-Time Mutation Visualizer

During live evolution: when mutation hits a gene, flash on chromosome bar (#17). Gold flash = improved fitness. Red = worsened. White = neutral. Build intuition about "hot" vs "cold" genes.

#### Feature 25: Creature Blueprint / Technical Drawing Mode

Toggle: white lines on blue background. Dimension lines. Angle arcs with degree labels. Force vectors at joints. Center of mass crosshair. Engineering textbook aesthetic.

#### Feature 26: Population Swarm View

Show ALL creatures (50-100) walking simultaneously. Fittest = brighter/larger, worst = faded/small. Watch swarm spread out. Some fall, some waddle, best ones stride ahead. Click any individual to zoom in.

#### Feature 27: Comparative Anatomy Panel

Side panel comparing creature gait to real animals. Diagrams: human walk, horse trot, spider crawl, penguin waddle. Panel highlights closest match based on phase relationships, duty factor, symmetry. Small animated silhouettes.

#### Feature 28: Time Travel Slider

Global slider controlling "evolutionary time" across ALL tabs. Drag to gen 1: creatures revert to flailing. Drag to gen 150: fully evolved. Works on race, push test, everything simultaneously. Tick marks at key milestones.

#### Feature 29: Particle System Creature Dissolution

On creature "death": body parts dissolve into 20-30 colored particles that scatter with physics, then fade. On "birth": particles coalesce FROM scattered positions INTO creature shape. Reverse dissolution.

#### Feature 30: Neural Network Surgery Mode

For CPG+NN: interactive NN editor. Click connection weight → drag to change. Creature gait updates in real-time. Ablate neurons (click to disable). Add noise to connections. "Reset to Evolved" button. Fitness delta indicator.

#### Feature 31: Cinematic Camera System

Multiple angles: Side view (default), Follow cam (slight lag), Tracking shot (smooth pan ahead), Worm's eye (low angle), Overhead (top-down), Fixed (creature walks off-screen).

Smooth dolly transitions with easing. For push test: auto-switch to close-up at impact, pull back during recovery.

#### Feature 32: Data Artifact Constellation

About/methodology as glowing constellation map. "GA" at center → "Selection", "Crossover", "Mutation". Hover = tooltip + highlight connections. Slowly rotates, nodes pulse. Click opens detail panel.

#### Feature 33: Speedrun Mode

Challenge: evolve walking in under 60 seconds. GA at max speed, countdown timer, population 30. Persistent leaderboard via storage. Difficulties: Easy (flat, 90s), Medium (flat, 60s), Hard (hill, 60s), Insane (mixed, 45s).

#### Feature 34: CSS-Only Parallax Depth on Scroll

Results Dashboard: charts/figures have parallax depth. Titles arrive first, chart slides up, caption appears. Staggered reveal via intersection observer. Cards lift with box-shadow on viewport entry.

#### Feature 35: Creature Emotion Expressions

Tiny face on torso (two dot eyes + line mouth). Expressions: neutral (walking), determined (climbing), shocked (push moment), happy (moving fast), sad (low fitness), dizzy (falling). Simple canvas drawing, instant emotional connection.

#### Feature 36: Interactive Fitness Function Decomposition

Four stacked bars updating each frame: green=distance, red=energy penalty, orange=fall penalty, blue=uprightness bonus. Total = green − red − orange + blue. Toggle individual components to see effects.

#### Feature 37: Trail of Breadcrumbs Analytics

Heatmap overlay (toggle) showing visitor interaction patterns. Click density, time per tab, first gene tweaked, first push strength tried. Anonymous data via shared persistent storage.

#### Feature 38: Breathing Chromosome Helix (Three.js)

3D rotating double helix. Each gene = colored rung. Slowly rotates and "breathes" (expand/contract). During crossover: two parent helixes approach, split, recombine. During mutation: rung flashes and changes color. DNA metaphor.

#### Feature 39: Footprint Trail on the Ground

Left foot prints one color, right another. Spacing reveals gait: even=smooth, clustered=stuttering, one-sided=limping. For controller race: three parallel trails. Prints fade over 30 seconds.

#### Feature 40: Evolution as Music — Generative Soundtrack

Ambient soundtrack evolving with GA. Gen 1: dissonant, sparse. As fitness improves: harmony emerges, rhythm stabilizes. Gen 150: full confident piece.

Average fitness → key (minor→major). Diversity → number of voices. Best fitness → tempo. Mutation rate → unexpected notes.

Toggle: "raw sonification" vs "beat-quantized" mode.

#### Feature 41: Living Background Ecosystem

Small flocking particles, triangle birds, swaying grass blades, drifting clouds, day/night cycle (60-second). Purely atmospheric. Creature walks through a living world.

#### Feature 42: The Weight of Generations — Visual Time Pressure

Background shifts: Gen 1-50 dawn (purple→orange), 50-100 daylight, 100-150 sunset (golden→red). Creature lighting changes: cool blue → warm gold → dramatic orange. Unconscious sense of time passing.

#### Feature 43: Comparative Timeline Strip

Horizontal filmstrip: 5 columns (Gen 1, 25, 75, 125, 150) × 4 rows (Sine, CPG, CPG+NN flat, CPG+NN mixed). 20 cells, all looping animations. Hover enlarges, click opens full-screen. Entire results section in one visual.

#### Feature 44: The Membrane — Population Boundary Visualization

Translucent organic membrane shape = convex hull of PCA-projected population, rendered as smooth blobby bezier curves. Contracts when diversity decreases, expands after migration. Multiple membranes form during niching.

#### Feature 45: The Last Walk — Final Showcase

Curtain call sequence. Screen goes dark. Spotlight fades in. Best creature walks. Statistics float as epitaphs: "Distance: 847px", "Ancestors Sacrificed: 22,500". Three runners-up join from behind, fall behind naturally. Champion continues alone. Fade to project title.

#### Feature 46: Microscope Zoom Levels

Zoom slider changes information density:
- Level 1 (far): creature as dot on minimap with distance markers
- Level 2 (medium): standard stick figure view
- Level 3 (close): joint mechanics, torque arrows, angle arcs
- Level 4 (microscopic): chromosome bar, sensor values, NN activations

#### Feature 47: Evolution Rings — Tree Ring Visualization

Concentric rings like tree cross-section. Center = gen 1. Ring width = fitness improvement (thick=big jump, thin=plateau). Ring color = population diversity. Knots = big mutation events. Click any ring to see that generation's best creature.

#### Feature 48: Creature Mirror — Real-Time Bilateral Symmetry Display

Vertical mirror line through torso center. Left half = actual creature. Right half = mirrored ideal (perfectly symmetric). Gap highlighted in red. Sine: mirror half diverges wildly. CPG: closely tracks. Indirect encoding: perfect match.

#### Feature 49: Ink Wash / Sumi-e Render Mode

Art style toggle: Japanese ink wash painting. Black brush strokes on cream/parchment background. Limb movements leave ink trails. Ground = single horizontal stroke. Ghost trails = layered wash effects. "Download as Print" button for high-res.

#### Feature 50: Muscle Heatmap Overlay

Each limb segment glows with color intensity proportional to the torque at its joint. Blue = relaxed, yellow = medium, red = high effort. Toggle with keyboard `M`.

```javascript
function drawCreatureWithMuscles(ctx, creature, torques, cameraX) {
  const maxTorque = 0.05;
  creature.allBodies.forEach((body, i) => {
    const { vertices } = body;
    const jointIdx = getJointForBody(i);
    const torqueMagnitude = jointIdx >= 0 ? Math.abs(torques[jointIdx]) / maxTorque : 0;
    const clampedIntensity = Math.min(1, torqueMagnitude);
    ctx.beginPath();
    ctx.moveTo(vertices[0].x - cameraX + 400, vertices[0].y);
    for (let v = 1; v < vertices.length; v++) {
      ctx.lineTo(vertices[v].x - cameraX + 400, vertices[v].y);
    }
    ctx.closePath();
    const r = Math.floor(clampedIntensity * 255);
    const g = Math.floor((1 - Math.abs(clampedIntensity - 0.5) * 2) * 180);
    const b = Math.floor((1 - clampedIntensity) * 200);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    // Glow for high-torque limbs
    if (clampedIntensity > 0.5) {
      const glowAlpha = (clampedIntensity - 0.5) * 0.6;
      const cx = (vertices[0].x + vertices[2].x) / 2 - cameraX + 400;
      const cy = (vertices[0].y + vertices[2].y) / 2;
      const gradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
      gradient.addColorStop(0, `rgba(255, ${100 - clampedIntensity * 100}, 0, ${glowAlpha})`);
      gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);
    }
  });
}

function getJointForBody(bodyIndex) {
  const map = { 1: 0, 2: 2, 3: 1, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5 };
  return map[bodyIndex] ?? -1;
}
```

#### Feature 51: Matrix Rain Background

Columns of falling gene values behind all content. Faint green monospace numbers cascade like the Matrix. During evolution, numbers matching current best chromosome glow brighter.

```javascript
function MatrixRain({ bestGenes }) {
  const canvasRef = useRef(null);
  const columnsRef = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const fontSize = 12;
    const columns = Math.floor(canvas.width / (fontSize * 3));
    if (columnsRef.current.length === 0) {
      columnsRef.current = Array.from({ length: columns }, () => ({
        y: Math.random() * -canvas.height,
        speed: 0.3 + Math.random() * 0.7,
        geneIdx: Math.floor(Math.random() * 18),
        values: Array.from({ length: 30 }, () => Math.random().toFixed(2)),
      }));
    }
    const draw = () => {
      ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      columnsRef.current.forEach((col, i) => {
        const x = i * fontSize * 3 + fontSize;
        col.values.forEach((val, j) => {
          const y = col.y + j * (fontSize + 2);
          if (y < 0 || y > canvas.height) return;
          const geneVal = bestGenes ? bestGenes[col.geneIdx]?.toFixed(2) : null;
          const isMatch = geneVal === val;
          const fadeFactor = j / col.values.length;
          if (isMatch) {
            ctx.fillStyle = `rgba(0, 255, 128, ${0.3 + fadeFactor * 0.7})`;
            ctx.shadowColor = "#00FF80";
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = `rgba(0, 180, 80, ${0.03 + fadeFactor * 0.08})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(val, x, y);
          ctx.shadowBlur = 0;
        });
        col.y += col.speed;
        if (col.y > canvas.height + 100) {
          col.y = -col.values.length * (fontSize + 2);
          col.geneIdx = Math.floor(Math.random() * 18);
          col.values = Array.from({ length: 30 }, () => Math.random().toFixed(2));
        }
      });
      requestAnimationFrame(draw);
    };
    draw();
  }, [bestGenes]);
  return (
    <canvas ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.4 }} />
  );
}
```

Placement: Fixed behind all content, z-index 0. Uses trail effect (semi-transparent fill) for natural fade-out. ~30fps via requestAnimationFrame.

---

## 15. CHROMOSOME EDITOR — "THE GENE LAB"

A full visual programming environment for creature behavior. Not just sliders — a multi-layered editor.

### Layer 1: Raw Gene Editor
Spreadsheet-like grid. Every gene as a cell. Click to type exact value. Drag up/down to scrub. Color intensity maps to value.

### Layer 2: Visual Joint Timeline Editor (DAW-style)
Timeline like GarageBand/Ableton. X-axis = time (one gait cycle, 0-2 seconds). Y-axis = joint angle. Each joint gets a "track" lane. Sine wave drawn as visible curve.

Users grab control points: amplitude (drag peaks up/down), frequency (compress/stretch horizontally), phase (drag wave left/right). Creature updates in real-time.

**CPG mode**: Tracks show visible coupling springs (dotted lines between hip_L and hip_R). Dragging one track's phase shows coupling force pulling the other.

**CPG+NN mode**: Neural network panel opens below timeline. Sensor inputs left, hidden middle, outputs right. Click connections to see weights. Modulation outputs connect back as "modifier lanes" on top of CPG curves.

### Layer 3: Preset Library & Blending
Sidebar with categorized presets: "Walkers", "Hoppers", "Crawlers", "Weird", "User Saved". Each shows tiny looping preview. Click to load.

**Blending**: Drag TWO presets onto a slider. 0%=A, 100%=B, 50%=crossover blend. Uses actual GA crossover operator.

### Layer 4: Constraint Editor
Toggle-able: "Force symmetry", "Lock shoulders", "Lock frequency", "Energy budget" (increasing one joint's amplitude automatically decreases others).

### Layer 5: Macro Recorder
Record sequence of gene changes over time. Playback = creature gait morphs. Export as JSON animation script.

### Layer 6: Diff View
Two chromosomes side by side. Gene differences highlighted. Magnitude controls highlight intensity. "Morph" slider interpolates between them. Split-screen canvas.

### Editor Features
- **Undo/Redo**: Ctrl+Z / Ctrl+Y, full history stack
- **Keyboard Shortcuts**: Space=play/pause, R=reset, S=save, Tab=switch editors, 1-6=select joint
- **Zoom & Pan**: Mouse wheel + drag
- **Snap & Align**: Grid snapping, phase snap to π/4, frequency snap to integer Hz
- **Copy/Paste**: Select gene regions, Ctrl+C/V
- **Autosave**: Every 10 seconds to persistent storage

---

## 16. TERRAIN EDITOR — "WORLD BUILDER"

A full terrain sculpting tool.

### Layer 1: Drawing Canvas
Wide horizontal scrollable canvas showing terrain profile as editable spline curve. X = distance (0-5000px), Y = ground height. Click to place control points. Bezier curve connection. Drag to reshape. Double-click to add, right-click to delete. Grid overlay with snap-to-grid.

### Layer 2: Terrain Tools (Toolbar)

- **Pencil Tool**: Freehand drawing with smoothing
- **Hill Stamp**: Click to place bell-curve hill. Drag for width/height. Shift for mesa.
- **Valley Tool**: Click to carve dip. Drag for width/depth.
- **Gap Tool**: Click to create no-ground section. Drag for gap width.
- **Staircase Tool**: Ascending/descending stairs. Drag for step count/height/width.
- **Noise Brush**: Paint random roughness. Amplitude slider.
- **Flatten Tool**: Drag to flatten to consistent height.
- **Smooth Tool**: Gaussian blur on height values.
- **Eraser**: Reset to flat ground (y=50).

### Layer 3: Terrain Presets
- Flat Plains, Rolling Hills, Mountain Pass, Stairway to Heaven, The Gauntlet (gaps+hills+valleys), Earthquake (sharp spikes), Ski Slope, Amphitheater (U-shaped valley), Sine Wave

### Layer 4: Terrain Properties Panel

- **Surface Friction**: Slider 0-1. Paint different friction values (ice patches).
- **Gravity Zones**: Draw rectangles with different gravity (moon walking, high-G, zero-G). Colored overlay.
- **Wind**: Directional force. Intensity + direction slider. Animated arrow particles.
- **Moving Platforms**: Horizontal segments oscillating on timer. Width, range, speed.
- **Conveyor Belts**: Ground sections with surface velocity. Forward=boost, backward=treadmill.
- **Breakable Ground**: Sections crumble after X seconds of standing. Cracked texture.

### Layer 5: Terrain Layers & Compositing
- Layer 1: Base terrain (height curve)
- Layer 2: Obstacles (walls, ramps, seesaws)
- Layer 3: Environmental effects (wind/gravity/friction zones)
- Visibility + opacity toggles per layer

### Layer 6: Challenge Builder
Combine terrain + constraints into named challenge. Define success criteria (reach x=3000, maintain uprightness >80%, energy budget). Save to shared leaderboard. Others attempt with their creatures or GA.

### Terrain Serialization
Every terrain = compact JSON. Encoded into URL alongside chromosome. `stride.dev/#terrain=...&genes=...&controller=cpgnn`

### Combined Editor Experience
Split workspace: terrain editor (top), creature on custom terrain (bottom-left), chromosome editor (bottom-right). Changes reflect immediately.

- "Test Run" button: clean 10-second sim, official fitness score
- "Evolve on This Terrain": launches GA using custom terrain
- "Challenge a Friend": packages terrain + target fitness into shareable link

---

## 17. MATHEMATICAL FORMULAS

### Motor Control
```
θ_j(t) = A_j · sin(2π · ω_j · t + φ_j)
```

### CPG Phase Dynamics
```
dφ_i/dt = 2π · f_i + Σ_j w_ij · sin(φ_j - φ_i + Φ_ij)
```

### CPG+NN Modulation
```
final_target_i = CPG_output_i × (1 + 0.5 × tanh(W2 · tanh(W1 · sensors + b1) + b2)_i)
```

### Fitness
```
f(x) = x_torso(T_sim) - x_torso(0)
F(x) = f(x) - α·E(x) - β·C(x) + γ·U(x)
E(x) = (1/S) · Σ_{t=0}^{S-1} Σ_{j=1}^{6} |τ_j(t·Δt)|
U(x) = (1/S) · Σ_{t=0}^{S-1} max(0, cos(θ_torso(t·Δt)))
C(x) = |{t : y_torso(t·Δt) < y_ground + h/2 + ε}|
```

### Selection

**Tournament**: P(x_i) = 1 - ((N - rank_i)/N)^k

**Roulette**: f'(x_i) = f(x_i) - min_j(f(x_j)) + ε; P(x_i) = f'(x_i) / Σ f'(x_j)

**Rank**: P(x_i) = (2-s)/N + 2·rank_i·(s-1)/(N·(N-1)), s=1.5

### Crossover
**Single-point**: c1 = p1[0:k] || p2[k:n]
**Two-point**: c1 = p1[0:k1] || p2[k1:k2] || p1[k2:n]
**Uniform**: per gene, swap with 50% probability

### Mutation
**Fixed**: x'_i = x_i + N(0, σ²) if rand() < p_m, clamp to [0,1]
**Adaptive**: p_m(g) = max(p_min, p_m0·(1 - g/G))

### Fitness Sharing
```
d(x_i, x_j) = ||x_i - x_j||_2
sh(d) = 1 - (d/σ_share)^α if d < σ_share, else 0
f_shared(x_i) = f(x_i) / Σ_j sh(d(x_i, x_j))
```

### Cost of Transport
```
CoT = total_energy / (mass × distance × gravity)
```

### Convergence Speed
```
G_80 = min{g : f_best(g) ≥ 0.8 · f_best(G)}
```

### Statistical Tests
- Wilcoxon rank-sum: H_0: median(A) = median(B), α=0.05
- Cohen's d = (mean(B) - mean(A)) / s_pooled
- Rank-biserial r = 1 - 2U/(n1·n2)

---

## 18. PSEUDOCODE BLOCKS

### Main GA

```
ALGORITHM: Genetic Algorithm for Locomotion Optimization
INPUT:  N, G, p_c, p_m, E
OUTPUT: Best chromosome x* and fitness f(x*)

1. INITIALIZE population P = {x_1, ..., x_N}, each x_i ∈ [0,1]^n
2. EVALUATE fitness f(x_i) for all x_i using physics simulation
3. FOR generation g = 1 TO G:
   3a. RECORD: best_g, avg_g, diversity_g
   3b. ELITISM: Copy top ceil(E·N) to P_next
   3c. WHILE |P_next| < N:
       i.   SELECT parents (p1, p2)
       ii.  IF rand() < p_c: (c1,c2) = CROSSOVER(p1,p2)
            ELSE: (c1,c2) = (copy(p1), copy(p2))
       iii. MUTATE c1, c2 with probability p_m per gene
       iv.  ADD c1, c2 to P_next
   3d. EVALUATE fitness for all new in P_next
   3e. P = P_next
   3f. IF adaptive: p_m = max(0.01, p_m0·(1-g/G))
4. RETURN argmax f(x_i) over all generations
```

### Tournament Selection
```
INPUT: P, k (tournament size)
1. S = randomly sample k from P (without replacement)
2. RETURN argmax f(x_i) for x_i in S
```

### Roulette Wheel Selection
```
1. f'(x_i) = f(x_i) - min(f) + ε for all x_i
2. r = rand() × sum(f')
3. cumulative = 0
4. FOR each x_i: cumulative += f'(x_i); IF cumulative ≥ r: RETURN x_i
```

### Adaptive Gaussian Mutation
```
1. p_m = max(0.01, p_m0 · (1 - g/G))
2. FOR each gene x_i:
   IF rand() < p_m: x_i = clamp(x_i + N(0, σ), 0, 1)
```

---

## 19. LITERATURE REVIEW & CITATIONS

1. Sims, K. (1994). "Evolving Virtual Creatures." SIGGRAPH '94. DOI: 10.1145/192161.192167
2. Lipson, H. & Pollack, J.B. (2000). "Automatic Design and Manufacture of Robotic Lifeforms." Nature 406. DOI: 10.1038/35023115
3. Cheney, N. et al. (2014). "Unshackling Evolution." GECCO '14. DOI: 10.1145/2576768.2598353
4. Stanley, K.O. & Miikkulainen, R. (2002). "Evolving Neural Networks through Augmenting Topologies." Evolutionary Computation 10(2). DOI: 10.1162/106365602320169811
5. Salimans, T. et al. (2017). "Evolution Strategies as a Scalable Alternative to RL." arXiv:1703.03864
6. Lehman, J. & Stanley, K.O. (2011). "Abandoning Objectives." Evolutionary Computation 19(2). DOI: 10.1162/EVCO_a_00025
7. Geijtenbeek, T. et al. (2013). "Flexible Muscle-Based Locomotion." ACM TOG 32(6). DOI: 10.1145/2508363.2508399
8. Ha, D. (2019). "Reinforcement Learning for Improving Agent Design." Artificial Life 25(4). DOI: 10.1162/artl_a_00301
9. Ijspeert, A. J. (2008). "Central Pattern Generators for Locomotion Control in Animals and Robots: A Review." Neural Networks 21(4), 642-653. DOI: 10.1016/j.neunet.2008.03.014
10. Jones, T. & Forrest, S. (1995). "Fitness Distance Correlation as a Measure of Problem Difficulty for Genetic Algorithms." Proceedings of ICGA '95, pp. 184-192.
11. Mouret, J.-B. & Clune, J. (2015). "Illuminating Search Spaces by Mapping Elites." arXiv:1504.04909

Software: pymunk, matplotlib, scipy, numpy, reportlab, Matter.js, Three.js, React, Recharts, Tone.js

---

## 20. EDGE CASES

### Physics/Creature (10)
1. Creature spawns underground → set y = ground + torso_height + 50
2. Joint angle exceeds limits → RotaryLimitJoint [-π/2, π/2]
3. Velocity explosion → clamp all bodies to v_max=1000
4. Creature flies off screen → early termination, return current distance
5. Falls through ground → small timestep 1/60, collision handler
6. Self-collision → ShapeFilter same group
7. All-zero chromosome → stands still, fitness=0, don't crash
8. All-one chromosome → may spasm, velocity clamping prevents explosion
9. NaN fitness → check with math.isnan(), return PENALTY_FITNESS=-1000
10. Simulation too long → timeout at 2× expected time

### GA (10)
11. All zero fitness → add ε=1e-6 to shifted values
12. All identical fitness → uniform selection acceptable
13. All negative fitness → near-uniform selection after shifting
14. Population converges → log diversity < 0.01 warning
15. Identical parents in crossover → valid, mutation adds variation
16. Elitism overflow → cap at N-2
17. Odd population size → truncate P_next to N
18. Adaptive rate hits zero → floor at p_min=0.01
19. Crossover at boundary → select k from {1,...,n-1} exclusively
20. Gene outside [0,1] → clamp

### Experiment (6)
21. Run crashes → catch, log, record None, continue
22. Checkpoint corrupted → try backup, else restart
23. All 30 runs crash → log critical, skip in analysis
24. <30 successful runs → use available, note count
25. All 30 same result (std=0) → skip Wilcoxon, note
26. >2 hour experiment → reduce to 100 generations

### Terrain (4)
27-28. Out of bounds query → clamp x to [-1000, 10000]
29. Backward movement → allow negative fitness
30. Falls in gap → simulation terminates, fitness = distance to edge

### Report (5)
31. Unicode subscripts → NEVER use, use `<sub>`/`<super>` tags
32. Missing figure → placeholder text
33. NaN in table → replace with "N/A"
34. Long experiment name → truncate to 20 chars
35. Report exceeds 25 pages → reduce figure sizes

### Island Model (3)
36. Population not divisible by K → uneven sizes
37. Migration duplicates → allow, natural selection handles
38. Island size < k → k = min(tournament_size, island_size)

### Fitness Sharing (3)
39. All identical → f_shared = f(x)/N
40. Radius too small → no sharing, valid
41. Radius too large → near-random selection

### V2-Specific (18)
42. CPG phase divergence → clamp dPhase to ±62.8 rad/s
43. CPG phases never converge → valid — degenerates to sine. Report it.
44. NN inputs outside range → sensors clamped to [-3, 3] by normalize_sensor()
45. NN weights produce NaN → tanh can't NaN with finite inputs. Fix sensor bug if NaN appears.
46. NN modulation overwhelming → max 1.5×, min 0.5× CPG output. Can't flip sign.
47. CPG-seeded init: low diversity → ±5% noise on CPG + random NN ensures diversity. Increase to ±10% if needed.
48. CPG+NN sanity test fails → check: (1) sensor norms (2) CPG seeding (3) weight range [-1,1] (4) larger population
49. Transfer fitness negative → valid. Record as-is.
50. FDC zero variance → report as "N/A — degenerate landscape."
51. FDC varies wildly across refs → valid — multi-basin landscape. Report distribution.
52. Epistasis near zero everywhere → valid — additive landscape.
53. Push causes physics explosion → clamp velocities after impulse. Same v1 safeguards.
54. All creatures fail push test → lower push magnitudes. Test 100, 200, 500 first.
55. Sensor ablation: no fitness drop → NN learned constant modulation (not using sensors). Valid finding.
56. Gait symmetry: bimodal distribution → some walk, some hop. Report both modes.
57. Mixed-terrain high variance → average 2 evals per chromosome if variance too high.
58. CPG+NN random-init never catches up → valid — seeding provides qualitative advantage.
59. Behavioral fingerprint: all creatures similar → evolution converged to one strategy. Report low behavioral diversity.
60. Sine incommensurate frequencies → exclude from symmetry analysis if >10% frequency difference

---

## 21. REPORT STRUCTURE (28-33 pages)

### Section 1: Introduction (1.5-2 pages)
- Optimization problem, formal statement, Karl Sims motivation

### Section 2: Literature Review (2-3 pages)
- Full citations with DOIs, grouped by theme, literature summary table, research gap

### Section 3: Methodology (4-5 pages)
- 3.1 Notation table (all symbols defined upfront)
- 3.2 Creature morphology + creature diagram figure
- 3.3 Chromosome encoding + encoding diagram figure
- 3.4 Sine controller (motor equation, 18 genes)
- 3.5 CPG controller (Kuramoto dynamics, coupling topology, 38 genes) + CPG architecture figure
- 3.6 CPG+NN controller (sensor system, NN architecture, modulation, 96 genes) + architecture figure
- 3.7 GA operators (selection formulas, crossover, mutation, elitism) + GA flowchart figure
- 3.8 Fitness function (all formulas, penalty terms, optimization statement)
- 3.9 Terrain system (height functions, visualization)
- 3.10 Gait analysis metrics (symmetry, CoT, behavioral fingerprint definitions)
- All pseudocode blocks from Section 18

### Section 4: Implementation & Parameters (3-4 pages)
- Parameter tables for all 3 controllers
- CPG coupling topology, sensor normalization constants
- GA hyperparameters
- Tech stack, experiment configurations

### Section 5: Results (8-10 pages)
- 5.1 Controller comparison (Table 1) + convergence plots + G_80 + Figure: convergence overlay
- 5.2 Frozen-NN control + seeded vs random init (Table 7) + Figure: seeded vs random convergence
- 5.3 Transfer testing (Table 2) + Figure: transfer heatmap
- 5.4 Perturbation recovery (Table 3) + Fisher's exact test + Figure: push filmstrip + survival curve
- 5.5 NN interpretability (Table 4) + Figure: sensor ablation bars + NN output time-series
- 5.6 Fitness landscape (Table 5) + Figure: FDC scatter + epistasis matrix + gene sensitivity bars
- 5.7 Gait analysis (Table 6) + Figure: gait symmetry histogram + behavioral radar chart
- 5.8 Algorithm comparison (GA vs CMA-ES vs PSO vs DE) — from v1
- 5.9 GA parameter sensitivity (selection, mutation, elitism) — from v1

### Section 6: Discussion (2-3 pages)
- 6.1 Sensory feedback improves locomotion
- 6.2 Training diversity enables generalization
- 6.3 Robustness: reactive vs open-loop
- 6.4 What the NN learned (ablation + output interpretation)
- 6.5 Fitness landscape structure
- 6.6 Evolution discovers biologically realistic gaits
- 6.7 CPG seeding: warm start vs co-evolution
- 6.8 Threats to validity (9 items — see Section 23)
- 6.9 Future work

### Section 7: Conclusion (1 page)
### References (1-2 pages)

---

## 22. BUILD SCHEDULE

### Python Backend (Days 1-5)

**Day 1** (6-8h): Sensors + CPG controller + CPG sanity test
**Day 2** (8-10h): CPG+NN controller + seeded init + transfer testing + perturbation test
**Day 3** (8-10h): Landscape analysis + interpretability + all v2 experiments. **Afternoon**: 5 simple visualizations (sensor ablation bars, gene sensitivity bars, gait symmetry histogram, seeded vs random convergence, push survival curve — ~15 min each)
**Day 4** (7-9h): 8 complex visualizations interleaved with report writing (push filmstrip, NN output time-series, behavioral radar, dashboard composite, controller architecture diagram — ~40 min each). This prevents creating figures that don't match the report narrative.
**Day 5** (3-4h): Polish, proofread, submit

### Website (Days 3-7, parallel with report polish)

**Day 1** (8h): Matter.js creature + 3 controllers + basic canvas renderer. Tab 4 (Playground) with sliders. Tab 3 (Push Test) with impulse. Core is playable.
**Day 2** (8h): Particle system + screen shake + foot dust. Ghost trail. Muscle heatmap. X-Ray mode. Camera modes. These all attach to the existing creature canvas. Every tab now looks polished.
**Day 3** (8h): Tab 1 (Live Evolution) with web worker GA + population cloud. A/B comparison mode. Guided narrative tour. NN visualization. The site tells a story.
**Day 4** (6h): Results dashboard with Recharts. DNA sharing. Generational morph. Leaderboard. GIF export. Matrix rain. About page. Polish.
**Day 5** (2-4h): 3D fitness landscape (if time permits). Slow-motion replay. Final responsive design pass. Bug fixes.

### Minimum Viable "Wow" (If Only 2 Days for Website)
Matter.js creature → Tab 3 (Push Test) with particles + screen shake + ghost trail → Tab 4 (Playground) → A/B comparison. ~16 hours.

### Priority Order (Website Features)
**P0**: Core tabs (1-6), particles, ghost trail, push test, gene playground
**P1**: DNA sharing, NN viz, guided tour, A/B mode, camera modes, X-ray mode, chromosome visualizer bar, muscle heatmap
**P2**: 3D landscape, leaderboard, GIF export, slow-motion replay, chromosome editor, terrain editor, matrix rain
**P3**: Evolution cinema, speedrun mode, creature emotions, footprint trail, environmental backgrounds, timeline strip, evolution rings, ink wash mode, generative soundtrack, population swarm, living ecosystem, membrane viz, last walk, microscope zoom, symmetry mirror, blueprint mode, family tree viewer, heatmap floor, dissolution particles, time travel slider, customization studio, anatomy panel, mutation visualizer, constellation map, scroll parallax, analytics, chromosome helix, weight of generations

### Revised Website Build Schedule

| Task | Time | Priority |
|------|------|----------|
| Matter.js creature + controllers | 4-5h | P0 |
| Tab 4: Gene Playground | 2-3h | P0 |
| Tab 3: Push Test | 1-2h | P0 |
| Tab 2: Controller Race / A/B Mode (merged) | 2-3h | P0 |
| Particle effects + screen shake | 2-3h | P0 |
| Ghost trail / afterimage | 1-2h | P0 |
| Muscle heatmap overlay | 1-2h | P1 |
| X-Ray / blueprint mode | 1-2h | P1 |
| Cinematic camera modes | 1-2h | P1 |
| Tab 1: Live Evolution + population cloud | 3-4h | P1 |
| Guided narrative tour | 3-4h | P1 |
| Live NN visualization + phasor diagram | 3-4h | P1 |
| Tab 5: Results dashboard (Recharts) | 3-4h | P1 |
| DNA sharing via URL | 1h | P1 |
| Generational morph timeline | 1-2h | P2 |
| 3D fitness landscape (Three.js) | 4-5h | P2 |
| Leaderboard (persistent storage) | 2-3h | P2 |
| GIF export | 1-2h | P2 |
| Slow-motion push replay | 2-3h | P2 |
| Matrix rain background | 1h | P2 |
| Tab 6: About + final polish | 2-3h | P2 |
| **Total** | **~40-55h** | |

### Dependencies (requirements.txt)
```
# Core
pymunk>=6.6.0
numpy>=1.24.0
matplotlib>=3.7.0
scipy>=1.10.0
reportlab>=4.0.0
Pillow>=9.5.0
tqdm>=4.65.0

# Optional
imageio>=2.31.0          # GIF export for visual ideas
scikit-learn>=1.3.0      # PCA for landscape flyover
```

---

## NOTATION TABLE

| Symbol | Description | Default |
|--------|-------------|---------|
| N | Population size | 100 |
| G | Max generations | 150 |
| n | Chromosome length | 18/38/96 |
| x_i | Individual chromosome | — |
| f(x) | Primary fitness (distance) | — |
| F(x) | Extended fitness with penalties | — |
| p_c | Crossover probability | 0.8 |
| p_m | Mutation probability (per gene) | 0.05 |
| σ | Mutation step size | 0.1 |
| E | Elitism rate | 0.05 |
| k | Tournament size | 3 |
| s | Selection pressure (rank) | 1.5 |
| T_sim | Simulation duration | 15.0s |
| S | Total simulation steps | 900 |
| α | Energy penalty weight | 0.1 |
| β | Fall penalty weight | 0.5 |
| γ | Uprightness bonus weight | 10.0 |
| A_j | Joint amplitude | [0, π/2] |
| ω_j | Joint frequency | [0.5, 5.0] Hz |
| φ_j | Joint phase offset | [0, 2π] |
| w_ij | CPG coupling weight | [-2, 2] |
| Φ_ij | CPG coupling phase offset | [0, 2π] |
| σ_share | Fitness sharing radius | 0.3 |
| K | Number of islands | 4 |
| M | Migration interval | 20 |
| G_80 | Convergence speed | — |
| D(g) | Population diversity at gen g | — |
| ε | Numerical stability constant | 1e-6 |
| CoT | Cost of Transport | — |

---

## THREATS TO VALIDITY

1. **Search space confound**: 18 vs 38 vs 96 genes with same evaluation budget. Frozen-NN partially addresses.
2. **FDC locality**: Computed relative to local optima. Multi-reference (30 points) mitigates.
3. **Epistasis scope**: Only computed for sine (18 genes). CPG+NN uncharacterized.
4. **5-second sim for landscape**: May reward fast starters. Validate with rank correlation.
5. **Simulation fidelity**: Pymunk 2D simplified physics. Not transferable to real robots.
6. **CoT units**: Simulation units only. Not comparable to biological literature.
7. **Transfer testing scope**: Limited to 4 terrain types and 2 noise levels.
8. **NN training on flat**: Limited sensor variation. Mixed-terrain partially addresses.
9. **Perturbation specificity**: Only horizontal pushes. Vertical/sustained/asymmetric not tested.

---

## 23. ERRATA — 13 CRITICAL FIXES

These fixes correct bugs and ambiguities found during detailed review of the v2 spec. Each MUST be applied during implementation.

### Fix 1: Perturbation Push Direction
**Bug**: Push was specified as positive x-impulse (FORWARD), which accelerates the creature rather than challenging it.
**Fix**: Push must be BACKWARD (negative x-impulse). Also: count falls only AFTER the push (t > 7.5s), not during normal walking. See Section 9 for corrected code.

### Fix 2: Sensor Ablation — Use Running Mean, Not Zero
**Bug**: Zeroing a sensor injects false information (zero foot_contact = "airborne", zero torso_angle = "perfectly upright").
**Fix**: Replace ablated sensor with its running mean from an unablated simulation. See Section 10 for corrected code.

### Fix 3: NN Output Visualization — Division by Zero
**Bug**: Modulation extraction `(final - cpg) / (0.5 * cpg)` divides by near-zero when CPG output crosses zero (twice per cycle). Guard `if abs(c) > 1e-6 else 0` misses values like 0.001, producing modulation spikes of 500×.
**Fix**: Plot the NN's tanh output `m` directly — it IS the modulation signal. Don't try to recover modulation from the combined output.

### Fix 4: Gait Symmetry — Incommensurate Frequencies
**Bug**: If left hip frequency = 1.5 Hz and right hip = 2.3 Hz, time-averaged phase difference converges to ~π/2 regardless — a mathematical artifact.
**Fix**: Check frequency commensurability for sine controllers. If >10% difference, classify as "incommensurate" and exclude from histogram. See Section 10 for code.

### Fix 5: Gene Sensitivity Cannot Reuse Epistasis Data
**Bug**: Spec says "Can reuse single-gene perturbations from epistasis." But epistasis uses δ=0.05, sensitivity uses δ=0.10. Different evaluations.
**Fix**: Run 180 evaluations separately (~5 min). Don't claim reuse.

### Fix 6: Behavioral Fingerprinting Double-Simulates
**Bug**: `compute_behavioral_fingerprint()` calls `run_full_simulation()` then `compute_gait_symmetry()` runs its own independent 15-second sim. 2× cost.
**Fix**: Extract gait symmetry from the SAME simulation's recorded data. See Section 10 for corrected code.

### Fix 7: Two Simulation Modes Required
**Bug**: Multiple analyses need per-timestep data, but evolution (7,500 sims/run) only needs scalar fitness. Storing 17 values × 900 steps × 7,500 sims = 115M floats/run.
**Fix**: `simulate(chromosome, controller_type, config, record=False)` — `record=False` returns fitness only, `record=True` returns full history. Evolution uses False, post-hoc analysis uses True. See Section 8 for code.

### Fix 8: Push Test Experiment Count
**Bug**: Plan says "30 × 3 controllers × 4 push strengths = 360 evals." But Table 3 has 4 controller variants.
**Fix**: 30 × 4 × 4 = 480 evals ≈ 13 min, not 360/~10 min.

### Fix 9: Seeded vs Random Init Diversity Confound
**Bug**: Seeded init gives 100 creatures with near-identical CPG genes (±5% noise). Uniform crossover can't create CPG values outside this window. Only mutation (σ=0.1) explores outside.
**Fix**: Acknowledge in interpretation: "If random-init reaches higher final fitness despite slower convergence, this suggests the optimal CPG+NN solution lies outside the basin of the pre-evolved CPG champion." Add to Threats to Validity.

### Fix 10: Gene Sensitivity Also for CPG
**Bug**: Sensitivity only computed for sine (18 genes), but the insight about variable-rate mutation matters most for CPG+NN (96 genes, where GA struggles).
**Fix**: Also compute for CPG's 38 genes. Cost: 380 evals ≈ 10 min. Report: "Coupling weight genes between hips are most sensitive — validating inter-limb coordination."

### Fix 11: Day 3 Visualization Schedule Unrealistic
**Bug**: 13 visualizations in 4-5 hours averages ~20 min each. Complex figures take 40-60 min of matplotlib wrestling.
**Fix**: Move 5 simple visualizations to Day 3 afternoon (~75 min). Move 8 complex to Day 4 morning, interleaved with report writing. See updated Build Schedule.

### Fix 12: No Statistical Test for Perturbation Recovery
**Bug**: Tables 1-2 use Mann-Whitney with Cohen's d. Table 3 reports raw survival counts with no test. Binary outcomes need Fisher's exact test.
**Fix**: Add Fisher's exact test per push strength. Report as "p (Fisher's exact)" column. See Section 9 for code.

### Fix 13: Foot Contact Helper Functions Undefined
**Bug**: `count_foot_strikes()`, `fraction_with_foot_on_ground()`, `fraction_both_feet_down()` called in behavioral fingerprinting but never implemented.
**Fix**: Defined explicitly in Section 10. Require foot contact boolean time-series from `record=True` simulation mode (Fix 7).

---

## 24. VISUAL IMPACT IDEAS FOR REPORT

### Idea A: Evolution Filmstrip (Title Page / Figure 1)
Horizontal strip showing Gen 1, 25, 50, 100, 150 creature poses left-to-right. Fitness curve below. Red→green color gradient as fitness improves. Use for title page or Introduction figure.

### Idea B: Push Test Comparison Strip
Sine vs CPG+NN side-by-side filmstrip. Timestamped frames at t=7.4s (before push), t=7.6s (impact), t=8.0s (stumbling), t=9.0s (recovered/fallen). Most memorable figure in the report.

### Idea C: DNA-to-Walking Pipeline Infographic
Full flow: chromosome vector → controller (sine/CPG/CPG+NN) → physics simulation → behavioral output → GA feedback loop. Single wide figure connecting all concepts.

### Idea D: Animated GIF Gallery
5 GIFs exported using matplotlib.animation or imageio:
1. Evolution progress (gen 1 → 150)
2. Sine vs CPG+NN comparison
3. Push recovery (best CPG+NN)
4. Transfer across terrains
5. CPG phase convergence animation

### Idea E: Creature X-Ray Torque Visualization
Color-code limbs by torque magnitude: blue (resting) → red (max effort). Pulsing heat-mapped motion. Shows energy flow through the creature during walking.

### Idea F: Landscape Flyover (P2)
2D PCA slice of fitness landscape as 50×50 heatmap. 30 best chromosomes plotted as white dots. 2,500 sims ≈ 3.5 hours. Only if ahead of schedule.

### Idea G: Dashboard Composite Figure
6 mini-panels in one figure:
1. Controller box plot (fitness distributions)
2. Transfer heatmap (4×5)
3. Push survival curve
4. Epistasis matrix (18×18)
5. NN time-series (4 stacked)
6. Gait histogram
"The entire story in one figure."

---

## 25. VIVA PREPARATION

5 likely questions and prepared answers:

**Q: Why CPG and CPG+NN rather than just a bigger NN?**
A: Biological architecture argument. Real locomotion uses CPGs in the spinal cord with cortical modulation. Three-tier comparison (open-loop → coupled-oscillator → feedback-modulated) tests whether each layer of biological complexity actually helps. The frozen-NN control isolates dimensionality from feedback.

**Q: How do you know the improvement isn't just more parameters?**
A: The frozen-NN experiment (96 genes, NN locked at 0.5 = zero modulation) answers this directly. If CPG+NN beats frozen-NN, the improvement is from sensory feedback, not search space size.

**Q: What did the neural network actually learn?**
A: Sensor ablation shows which inputs the NN relies on. NN output time-series shows reactive patterns: when torso tilts, hip modulation increases; when foot contacts, knee stiffness changes. It learned a balance-correction policy, not a walking policy (the CPG handles walking).

**Q: The push test is dramatic. What does it prove quantitatively?**
A: Sine survives X N pushes, CPG+NN survives Y N pushes, a Z% improvement (Fisher's exact test, p = W). The mechanism is visible in the NN time-series: after push, torso_angle sensor spikes → NN modulation increases hip extension → creature catches itself.

**Q: What are the main limitations?**
A: Search space confound (18 vs 96 genes), epistasis not computed for CPG+NN (too expensive), CoT in simulation units not biological, perturbation only horizontal pushes, Pymunk 2D simplified physics. All acknowledged in Threats to Validity.

---

## 26. KEY PRINCIPLES

7 guiding principles for building STRIDE:

1. **Finish > Perfect**: A complete project with honest results beats a half-finished project with ambitious scope.
2. **Every addition tells a story**: Each v2 feature answers a specific research question. No additions "just because."
3. **Build on v1, don't rebuild**: v2 extends v1's codebase. Refactoring is not building.
4. **The report sells the project**: Beautiful figures and clear tables matter more than clever code.
5. **Controls matter more than features**: Frozen-NN and random-init experiments make results credible.
6. **Acknowledge limitations honestly**: Threats to validity section shows scientific maturity.
7. **Visual impact wins**: One push-test filmstrip is worth more than 10 tables of p-values.

---

## 27. WEBSITE IMPLEMENTATION CODE

### Matter.js Creature Module

```javascript
function createCreature(engine, x, y, genes, controllerType) {
  const Bodies = Matter.Bodies;
  const Composite = Matter.Composite;
  const Constraint = Matter.Constraint;

  // Body parts
  const torso = Bodies.rectangle(x, y, 60, 20, { label: "torso", collisionFilter: { group: -1 } });
  const thighL = Bodies.rectangle(x - 15, y + 30, 12, 35, { label: "thighL", collisionFilter: { group: -1 } });
  const shinL = Bodies.rectangle(x - 15, y + 65, 10, 30, { label: "shinL", collisionFilter: { group: -1 } });
  const thighR = Bodies.rectangle(x + 15, y + 30, 12, 35, { label: "thighR", collisionFilter: { group: -1 } });
  const shinR = Bodies.rectangle(x + 15, y + 65, 10, 30, { label: "shinR", collisionFilter: { group: -1 } });
  const upperArmL = Bodies.rectangle(x - 35, y - 5, 10, 25, { label: "upperArmL", collisionFilter: { group: -1 } });
  const forearmL = Bodies.rectangle(x - 35, y + 20, 8, 20, { label: "forearmL", collisionFilter: { group: -1 } });
  const upperArmR = Bodies.rectangle(x + 35, y - 5, 10, 25, { label: "upperArmR", collisionFilter: { group: -1 } });
  const forearmR = Bodies.rectangle(x + 35, y + 20, 8, 20, { label: "forearmR", collisionFilter: { group: -1 } });
  const footL = Bodies.rectangle(x - 15, y + 82, 18, 6, { label: "footL", friction: 0.9, collisionFilter: { group: -1 } });
  const footR = Bodies.rectangle(x + 15, y + 82, 18, 6, { label: "footR", friction: 0.9, collisionFilter: { group: -1 } });

  const allBodies = [torso, thighL, shinL, thighR, shinR, upperArmL, forearmL, upperArmR, forearmR, footL, footR];

  // Motorized joints (6)
  const hipL = Constraint.create({ bodyA: torso, bodyB: thighL, pointA: { x: -15, y: 10 }, pointB: { x: 0, y: -17 }, stiffness: 0.9 });
  const kneeL = Constraint.create({ bodyA: thighL, bodyB: shinL, pointA: { x: 0, y: 17 }, pointB: { x: 0, y: -15 }, stiffness: 0.9 });
  const hipR = Constraint.create({ bodyA: torso, bodyB: thighR, pointA: { x: 15, y: 10 }, pointB: { x: 0, y: -17 }, stiffness: 0.9 });
  const kneeR = Constraint.create({ bodyA: thighR, bodyB: shinR, pointA: { x: 0, y: 17 }, pointB: { x: 0, y: -15 }, stiffness: 0.9 });
  const shoulderL = Constraint.create({ bodyA: torso, bodyB: upperArmL, pointA: { x: -30, y: -5 }, pointB: { x: 0, y: -12 }, stiffness: 0.9 });
  const shoulderR = Constraint.create({ bodyA: torso, bodyB: upperArmR, pointA: { x: 30, y: -5 }, pointB: { x: 0, y: -12 }, stiffness: 0.9 });

  // Passive joints (elbows + ankles)
  const elbowL = Constraint.create({ bodyA: upperArmL, bodyB: forearmL, pointA: { x: 0, y: 12 }, pointB: { x: 0, y: -10 }, stiffness: 0.6 });
  const elbowR = Constraint.create({ bodyA: upperArmR, bodyB: forearmR, pointA: { x: 0, y: 12 }, pointB: { x: 0, y: -10 }, stiffness: 0.6 });
  const ankleL = Constraint.create({ bodyA: shinL, bodyB: footL, pointA: { x: 0, y: 15 }, pointB: { x: -3, y: 0 }, stiffness: 0.8 });
  const ankleR = Constraint.create({ bodyA: shinR, bodyB: footR, pointA: { x: 0, y: 15 }, pointB: { x: -3, y: 0 }, stiffness: 0.8 });

  const allConstraints = [hipL, kneeL, hipR, kneeR, shoulderL, shoulderR, elbowL, elbowR, ankleL, ankleR];

  Composite.add(engine.world, [...allBodies, ...allConstraints]);

  // Create controller
  let controller;
  if (controllerType === "sine") controller = new SineController(genes);
  else if (controllerType === "cpg") controller = new CPGController(genes);
  else controller = new CPGNNController(genes);

  return {
    torso, allBodies, allConstraints, controller,
    motorJoints: [
      { constraint: hipL, bodyA: torso, bodyB: thighL },
      { constraint: hipR, bodyA: torso, bodyB: thighR },
      { constraint: kneeL, bodyA: thighL, bodyB: shinL },
      { constraint: kneeR, bodyA: thighR, bodyB: shinR },
      { constraint: shoulderL, bodyA: torso, bodyB: upperArmL },
      { constraint: shoulderR, bodyA: torso, bodyB: upperArmR },
    ],
    getDistance: () => torso.position.x - x,
    getSensors: () => {
      const torsoAngle = torso.angle;
      const torsoAngVel = torso.angularVelocity;
      const footLDown = footL.position.y > 390;
      const footRDown = footR.position.y > 390;
      const height = 400 - torso.position.y;
      const hVel = torso.velocity.x;
      return [torsoAngle, torsoAngVel, footLDown ? 1 : 0, footRDown ? 1 : 0, height / 150, hVel / 200];
    },
  };
}
```

### JS Controller Classes

```javascript
class SineController {
  constructor(genes) {
    this.params = [];
    for (let i = 0; i < 6; i++) {
      this.params.push({
        amplitude: genes[i * 3] * (Math.PI / 2),
        frequency: genes[i * 3 + 1] * 4.5 + 0.5,
        phase: genes[i * 3 + 2] * Math.PI * 2,
      });
    }
  }
  getTargets(t) {
    return this.params.map(p => p.amplitude * Math.sin(2 * Math.PI * p.frequency * t + p.phase));
  }
}

class CPGController {
  constructor(genes) {
    this.amplitudes = []; this.frequencies = []; this.phases = [];
    for (let i = 0; i < 6; i++) {
      this.amplitudes.push(genes[i * 3] * (Math.PI / 2));
      this.frequencies.push(genes[i * 3 + 1] * 2.7 + 0.3);
      this.phases.push(genes[i * 3 + 2] * Math.PI * 2);
    }
    this.connections = [];
    const CONNECTIONS = [[0,2],[2,0],[1,3],[3,1],[0,1],[1,0],[2,3],[3,2],[4,5],[5,4]];
    for (let c = 0; c < 10; c++) {
      this.connections.push({
        from: CONNECTIONS[c][0], to: CONNECTIONS[c][1],
        weight: (genes[18 + c * 2] - 0.5) * 4,
        phaseOffset: genes[19 + c * 2] * Math.PI * 2,
      });
    }
  }
  step(dt) {
    const newPhases = [...this.phases];
    for (let i = 0; i < 6; i++) {
      let dPhase = 2 * Math.PI * this.frequencies[i];
      for (const conn of this.connections) {
        if (conn.to === i) {
          dPhase += conn.weight * Math.sin(this.phases[conn.from] - this.phases[i] + conn.phaseOffset);
        }
      }
      dPhase = Math.max(-62.8, Math.min(62.8, dPhase));
      newPhases[i] = this.phases[i] + dPhase * dt;
    }
    this.phases = newPhases;
    return this.amplitudes.map((a, i) => a * Math.sin(this.phases[i]));
  }
  getTargets(t) { return this.step(1/60); }
}

class CPGNNController {
  constructor(genes) {
    this.cpg = new CPGController(genes.slice(0, 38));
    const nn = genes.slice(38);
    this.W1 = []; this.b1 = []; this.W2 = []; this.b2 = [];
    for (let i = 0; i < 4; i++) {
      this.W1.push(nn.slice(i * 6, (i + 1) * 6).map(v => v * 4 - 2));
      this.b1.push(nn[24 + i] * 4 - 2);
    }
    for (let i = 0; i < 6; i++) {
      this.W2.push(nn.slice(28 + i * 4, 28 + (i + 1) * 4).map(v => v * 4 - 2));
      this.b2.push(nn[52 + i] * 4 - 2);
    }
  }
  getTargets(t, sensors) {
    const cpgTargets = this.cpg.getTargets(t);
    // NN forward pass
    const hidden = this.W1.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * sensors[j], 0) + this.b1[i]));
    const modulation = this.W2.map((row, i) => Math.tanh(row.reduce((s, w, j) => s + w * hidden[j], 0) + this.b2[i]));
    return cpgTargets.map((c, i) => c * (1 + 0.5 * modulation[i]));
  }
}
```

### Terrain Rendering (Matter.js)

```javascript
function createTerrain(engine, type, width = 5000) {
  const Bodies = Matter.Bodies;
  const Composite = Matter.Composite;
  if (type === "flat") {
    const ground = Bodies.rectangle(width / 2, 400, width, 20, { isStatic: true, friction: 0.8 });
    Composite.add(engine.world, ground);
    return [ground];
  }
  if (type === "hill") {
    const segments = [];
    for (let i = 0; i < 20; i++) {
      const x = 300 + i * 10;
      const y = 400 - 50 * Math.sin(Math.PI * (x - 300) / 200);
      const angle = Math.atan2(50 * Math.PI / 200 * Math.cos(Math.PI * (x - 300) / 200), 1);
      segments.push(Bodies.rectangle(x, y, 12, 8, { isStatic: true, angle, friction: 0.8 }));
    }
    Composite.add(engine.world, segments);
    return segments;
  }
  // Mixed: alternating flat + hill sections
  return createTerrain(engine, "flat", width);
}
```

### Custom Canvas Renderer

```javascript
function drawCreature(ctx, creature, cameraX, width, height) {
  ctx.clearRect(0, 0, width, height);
  // Background
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);
  // Ground line
  ctx.strokeStyle = "#4ADE80";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 400);
  ctx.lineTo(width, 400);
  ctx.stroke();
  // Distance markers
  ctx.fillStyle = "#64748B";
  ctx.font = "10px monospace";
  for (let d = 0; d < 5000; d += 100) {
    const screenX = d - cameraX + width / 2;
    if (screenX > 0 && screenX < width) {
      ctx.fillText(`${d}px`, screenX, 415);
      ctx.beginPath();
      ctx.moveTo(screenX, 398);
      ctx.lineTo(screenX, 402);
      ctx.stroke();
    }
  }
  // Body parts — color coded
  const COLORS = {
    torso: "#3B82F6",
    thighL: "#10B981", shinL: "#10B981", thighR: "#10B981", shinR: "#10B981",
    upperArmL: "#F59E0B", forearmL: "#F59E0B", upperArmR: "#F59E0B", forearmR: "#F59E0B",
    footL: "#EF4444", footR: "#EF4444",
  };
  creature.allBodies.forEach(body => {
    const { vertices, label } = body;
    ctx.fillStyle = COLORS[label] || "#94A3B8";
    ctx.beginPath();
    ctx.moveTo(vertices[0].x - cameraX + width / 2, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i].x - cameraX + width / 2, vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();
  });
  // Joint circles
  creature.motorJoints.forEach(joint => {
    const pos = joint.constraint.pointA;
    const bodyPos = joint.bodyA.position;
    ctx.beginPath();
    ctx.arc(bodyPos.x + pos.x - cameraX + width / 2, bodyPos.y + pos.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#EF4444";
    ctx.fill();
  });
}
```

---

*End of STRIDE Complete Specification*
