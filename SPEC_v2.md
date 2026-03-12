# PROJECT SPEC v2: STRIDE — Evolving Adaptive 2D Walkers with Neuroevolution

## Project Overview
Build a comprehensive evolutionary robotics system that evolves 2D stick-figure creatures to walk using layered control architectures (sinusoidal, CPG, CPG+NN), advanced GA variants (novelty search, MAP-Elites, NSGA-II), and deep fitness landscape analysis. The project includes the full optimization pipeline, interactive web visualization, and a PDF report.

**Student**: Dev Krishna, 3rd Year Data Science, CHRIST University Pune (Reg: 23112015)
**Course**: Optimisation Techniques (CIA-3 submission)
**Output**: Python codebase + Web application + PDF report (25-35 pages)
**Tech Stack**: Python (pymunk, numpy, scipy, matplotlib, reportlab) + TypeScript/React (p2.js, PixiJS, Recharts)

---

## Architecture

```
stride/
├── src/
│   ├── __init__.py
│   ├── creature.py              # Stick figure body + joint physics + morphology genes
│   ├── physics_sim.py           # Pymunk simulation environment + sensor readouts
│   ├── encoding.py              # Direct, indirect, CPG, CPG+NN, morphology encodings
│   ├── controllers/
│   │   ├── __init__.py
│   │   ├── sine_controller.py   # Original sinusoidal open-loop controller
│   │   ├── cpg_controller.py    # Coupled oscillator network controller
│   │   └── cpg_nn_controller.py # CPG + neural network hybrid controller
│   ├── ga_core.py               # Core GA engine (selection, crossover, mutation)
│   ├── algorithms/
│   │   ├── __init__.py
│   │   ├── standard_ga.py       # Standard generational GA
│   │   ├── novelty_search.py    # Novelty search (behavioral diversity optimization)
│   │   ├── map_elites.py        # MAP-Elites quality-diversity algorithm
│   │   ├── nsga2.py             # NSGA-II multi-objective optimization
│   │   ├── coevolution.py       # Competitive co-evolution (walker vs terrain)
│   │   └── baselines.py         # PSO, DE, CMA-ES, random search
│   ├── fitness.py               # Fitness evaluation (multi-component + CoT)
│   ├── terrain.py               # Terrain generators (flat, hill, mixed, gap, evolved)
│   ├── config.py                # All hyperparameters and experiment configs
│   ├── utils.py                 # Checkpointing, error handling, validation
│   └── analysis/
│       ├── __init__.py
│       ├── landscape.py         # Fitness landscape analysis (FDC, autocorrelation, neutrality)
│       ├── epistasis.py         # Gene-gene interaction analysis
│       ├── schema.py            # Schema analysis (Holland's building blocks)
│       ├── behavioral.py        # Behavioral diversity metrics + gait clustering
│       └── sensitivity.py       # Parameter sensitivity analysis
├── experiments/
│   ├── run_experiments.py       # Master experiment runner (30 runs x variants)
│   ├── analyze_results.py       # Statistical analysis + tables + plots
│   ├── transfer_test.py         # Transfer testing (evolve flat → test hill/mixed/noise)
│   ├── convergence_budget.py    # Run-until-convergence analysis
│   └── results/                 # Output directory for experiment data
├── visualization/
│   ├── generation_replay.py     # Show best creature per generation walking
│   ├── skeleton_trail.py        # Motion-capture style afterimage trails
│   ├── side_by_side.py          # Race best walkers from different runs
│   ├── family_tree.py           # Lineage/genealogy visualization
│   ├── convergence_plot.py      # Fitness over generations (all 30 runs overlaid)
│   ├── diversity_plot.py        # Population diversity over generations
│   ├── box_plots.py             # Box plots for 30-run distributions
│   ├── heatmap.py               # Joint parameter evolution heatmap
│   ├── creature_diagram.py      # Labeled stick figure diagram for report
│   ├── flowchart.py             # GA pipeline flowchart for report
│   ├── encoding_diagram.py      # Visual diagram of encodings
│   ├── controller_diagram.py    # Visual diagram of Sine vs CPG vs CPG+NN architecture
│   ├── phylogenetic_tree.py     # Full evolutionary lineage tree (animated-ready)
│   ├── population_cloud.py      # UMAP/t-SNE population trajectory animation
│   ├── gene_flow_river.py       # Muller-plot style gene cluster flow over generations
│   ├── fitness_landscape_3d.py  # PCA-reduced 3D fitness surface with population path
│   ├── selection_pressure.py    # Heatmap of selection frequency per individual
│   ├── crossover_viz.py         # Animated crossover operation visualization
│   ├── mutation_impact.py       # Gene sensitivity map (which mutations help/hurt)
│   ├── morphospace_map.py       # UMAP of all best-of-run chromosomes, colored by fitness
│   ├── gait_cycle.py            # Biomechanics-style gait phase diagrams
│   ├── failure_gallery.py       # Curated gallery of worst/funniest evolved creatures
│   ├── map_elites_grid.py       # MAP-Elites behavioral grid heatmap
│   ├── pareto_front.py          # NSGA-II Pareto front visualization
│   ├── grf_plot.py              # Ground reaction force curves
│   ├── phase_portrait.py        # Joint angle vs angular velocity limit cycles
│   ├── operator_adaptation.py   # Stacked area chart of operator probability over time
│   ├── epistasis_matrix.py      # Gene-gene interaction heatmap
│   └── parameter_sensitivity.py # 2D parameter sweep heatmaps
├── report/
│   ├── generate_report.py       # Builds the PDF report using reportlab
│   └── figures/                 # Generated figures for the report
├── web/                         # React + TypeScript + Vite web application
│   └── (see Web Application section)
├── main.py                      # Entry point
├── requirements.txt
└── README.md
```

---

## BUILD PHASES

This project is built in 7 phases. Each phase has a validation checkpoint. Do NOT skip phases.

### PHASE 1: Physics Foundation + Sensors
**Files**: `src/creature.py`, `src/physics_sim.py`, `src/terrain.py`, `src/fitness.py`
**Goal**: Creature exists in physics world, can sense its own state, and returns a fitness value.

**What's new from v1**: Creature now exposes a full sensor vector every simulation step. Morphology parameters are configurable (not yet evolvable — that comes in Phase 4).

**Creature Specification**:
- **Torso**: Central rectangle (~60px x 20px), configurable width/height
- **Limbs**: 4 limbs (2 legs, 2 arms), each with 2 segments (upper + lower)
- **Segments**: Configurable lengths via morphology parameters (default: upper_leg=40, lower_leg=35, upper_arm=30, lower_arm=25)
- **Joints**: 6 motorized joints (hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R) + 2 spring elbows (DampedRotarySpring, passive, not motorized)
- **Collision**: Self-collision disabled via ShapeFilter. Ground collision enabled for all segments.

**Sensor Vector** (18 dimensions, read every simulation step):
```
sensors[0:6]   = joint angles (6 motorized joints, normalized to [-1, 1])
sensors[6:12]  = joint angular velocities (6 joints, normalized)
sensors[12]    = torso angle relative to vertical (normalized to [-1, 1])
sensors[13]    = torso angular velocity (normalized)
sensors[14]    = left foot ground contact (0.0 or 1.0)
sensors[15]    = right foot ground contact (0.0 or 1.0)
sensors[16]    = torso height above ground (normalized)
sensors[17]    = torso horizontal velocity (normalized)
```

**Ground Contact Detection**:
```python
# Use pymunk collision handler to track foot-ground contacts
def setup_contact_tracking(space, creature):
    """Register collision handlers for foot segments with ground."""
    handler = space.add_collision_handler(FOOT_COLLISION_TYPE, GROUND_COLLISION_TYPE)
    handler.begin = lambda arbiter, space, data: on_foot_contact(arbiter, True)
    handler.separate = lambda arbiter, space, data: on_foot_contact(arbiter, False)
```

**Ground Reaction Force Recording**:
```python
def record_grf(arbiter):
    """Record vertical ground reaction force from foot-ground contact."""
    # arbiter.total_impulse gives the impulse applied during this step
    # Divide by dt to get force
    force = arbiter.total_impulse / dt
    return force.y  # vertical component
```

**Morphology Parameters** (fixed defaults for Phase 1, evolvable in Phase 4):
```python
DEFAULT_MORPHOLOGY = {
    "torso_width": 60.0,      # pixels
    "torso_height": 20.0,     # pixels
    "upper_leg_length": 40.0, # pixels
    "lower_leg_length": 35.0, # pixels
    "upper_arm_length": 30.0, # pixels
    "lower_arm_length": 25.0, # pixels
    "leg_width": 8.0,         # pixels
    "arm_width": 6.0,         # pixels
    "joint_limit_hip": math.pi/3,     # radians, symmetric
    "joint_limit_knee": math.pi/4,
    "joint_limit_shoulder": math.pi/3,
}
```

**Stability Safeguards** (same as v1):
- Clamp all velocities to max 1000 px/s
- Terminate early if torso y < 0 or y > 500
- Terminate early if creature hasn't moved >5px in last 2 seconds
- NaN/Inf detection returns PENALTY_FITNESS = -1000.0

**Validation Checkpoint**:
- [ ] 5 random creatures simulate without crashing
- [ ] All fitness values are finite (no NaN, no Inf)
- [ ] Sensor vector has correct dimensions (18,) every step
- [ ] Ground contact sensors fire correctly (1.0 when touching, 0.0 when not)
- [ ] All-zero and all-one gene creatures don't crash
- [ ] Ground reaction forces are recorded and finite
- [ ] Terrain height functions return correct values for all 4 terrain types
- [ ] Morphology parameters correctly change creature dimensions

---

### PHASE 2: Controller Architecture
**Files**: `src/controllers/sine_controller.py`, `src/controllers/cpg_controller.py`, `src/controllers/cpg_nn_controller.py`, `src/encoding.py`
**Goal**: Three controller tiers working, each producing joint torques from different representations.

#### Tier 1: Sinusoidal Controller (Open-Loop)
Unchanged from v1. Each joint follows a sine wave:
```
torque_j(t) = A_j * sin(2*pi * omega_j * t + phi_j)
```
- **Chromosome**: 18 genes (6 joints x 3 params: amplitude, frequency, phase)
- **No sensor input** — purely time-driven
- **Strengths**: Simple, fast convergence, easy to analyze
- **Weaknesses**: Cannot react to perturbations, cannot adapt to terrain

#### Tier 2: CPG Controller (Coupled Oscillators)
Central Pattern Generator with inter-joint coupling:
```python
class CPGController:
    """Coupled oscillator network for rhythmic locomotion."""

    def __init__(self, genes):
        """
        genes layout (35 total):
          [0:6]   = intrinsic frequencies (one per joint)
          [6:12]  = intrinsic amplitudes (one per joint)
          [12:18] = intrinsic phases (one per joint)
          [18:24] = coupling weights to ipsilateral neighbor
                    (hip→knee, knee→hip, shoulder→hip for each side)
          [24:30] = coupling weights to contralateral counterpart
                    (hip_L↔hip_R, knee_L↔knee_R, shoulder_L↔shoulder_R)
          [30:35] = reserved (phase coupling offsets)
        """
        self.n_joints = 6
        self.frequencies = decode_range(genes[0:6], 0.5, 5.0)
        self.amplitudes = decode_range(genes[6:12], 0.0, math.pi/2)
        self.phases = decode_range(genes[12:18], 0.0, 2*math.pi)
        self.ipsi_weights = decode_range(genes[18:24], -1.0, 1.0)
        self.contra_weights = decode_range(genes[24:30], -1.0, 1.0)
        self.phase_offsets = decode_range(genes[30:35], -math.pi, math.pi)

        # Internal oscillator states
        self.theta = np.array(self.phases)  # current phase of each oscillator

    def step(self, dt):
        """Advance all oscillators by one timestep with coupling."""
        # Phase update: d(theta_i)/dt = 2*pi*freq_i + sum_j(w_ij * sin(theta_j - theta_i))
        for i in range(self.n_joints):
            coupling = 0.0
            for j, w in self._get_coupled_joints(i):
                coupling += w * math.sin(self.theta[j] - self.theta[i])
            self.theta[i] += (2 * math.pi * self.frequencies[i] + coupling) * dt

        # Output torques
        torques = self.amplitudes * np.sin(self.theta)
        return torques
```

**Coupling topology**:
```
hip_L ←→ hip_R          (contralateral: antiphase for walking)
knee_L ←→ knee_R        (contralateral: antiphase)
shoulder_L ←→ shoulder_R (contralateral: antiphase for arm swing)
hip_L ←→ knee_L         (ipsilateral: knee follows hip)
hip_R ←→ knee_R         (ipsilateral)
hip_L ←→ shoulder_L     (ipsilateral: arm-leg coordination)
hip_R ←→ shoulder_R     (ipsilateral)
```

- **Chromosome**: 35 genes
- **No sensor input** — still open-loop, but with emergent inter-joint coordination
- **Strengths**: Biologically plausible, emergent coordination patterns, medium search space
- **Weaknesses**: Still cannot react to perturbations

#### Tier 3: CPG + Neural Network Hybrid (Closed-Loop)
CPG provides rhythmic base pattern; small NN modulates based on sensory feedback:

```python
class CPGNNController:
    """CPG base rhythm modulated by neural network sensory feedback."""

    def __init__(self, genes):
        """
        genes layout (~75 total):
          [0:35]   = CPG parameters (same as Tier 2)
          [35:75]  = NN weights (feedforward: 18 inputs → 8 hidden → 6 outputs)
                     18*8 = 144... too many. Use smaller:

        Revised NN architecture:
          Input: 8 compressed sensors (torso angle, torso angvel,
                 2 foot contacts, 2 hip angles, 2 knee angles)
          Hidden: 6 neurons (tanh activation)
          Output: 6 modulation signals (one per joint, tanh → [-1, 1])

          Weights: 8*6 + 6 biases + 6*6 + 6 biases = 48 + 6 + 36 + 6 = 96

        Total genes: 35 (CPG) + 96 (NN) = 131

        Compromise: use 6 direct sensor inputs to reduce NN size:
          Input: 6 sensors (torso_angle, torso_angvel, foot_L, foot_R,
                 hip_L_angle, hip_R_angle)
          Hidden: 4 neurons (tanh)
          Output: 6 modulation signals

          Weights: 6*4 + 4 + 4*6 + 6 = 24 + 4 + 24 + 6 = 58

        Total genes: 35 (CPG) + 58 (NN) = 93
        """
        # CPG component
        self.cpg = CPGController(genes[0:35])

        # NN component
        nn_genes = genes[35:]
        self.W1 = nn_genes[0:24].reshape(6, 4)    # input→hidden
        self.b1 = nn_genes[24:28]                   # hidden biases
        self.W2 = nn_genes[28:52].reshape(4, 6)    # hidden→output
        self.b2 = nn_genes[52:58]                   # output biases

    def step(self, dt, sensors):
        """
        Compute joint torques from CPG base + NN modulation.

        sensors_compressed: [torso_angle, torso_angvel,
                           foot_L, foot_R, hip_L_angle, hip_R_angle]
        """
        # CPG base rhythm
        base_torques = self.cpg.step(dt)

        # Compress sensors
        s = np.array([
            sensors[12],  # torso angle
            sensors[13],  # torso angular velocity
            sensors[14],  # left foot contact
            sensors[15],  # right foot contact
            sensors[0],   # hip_L angle
            sensors[1],   # hip_R angle
        ])

        # NN forward pass
        hidden = np.tanh(s @ self.W1 + self.b1)
        modulation = np.tanh(hidden @ self.W2 + self.b2)  # [-1, 1]

        # Modulated output: base * (1 + 0.5 * modulation)
        # This lets NN amplify or dampen each joint's CPG signal by up to 50%
        final_torques = base_torques * (1.0 + 0.5 * modulation)

        return final_torques
```

- **Chromosome**: 93 genes (35 CPG + 58 NN)
- **Uses sensor input** — closed-loop, can react to falls, terrain changes
- **Strengths**: Reactive control, robustness to perturbation, biologically layered
- **Weaknesses**: Larger search space, slower convergence, harder to analyze

#### Controller Comparison Summary

| Property | Sine | CPG | CPG+NN |
|----------|------|-----|--------|
| Genes | 18 | 35 | 93 |
| Sensor input | No | No | Yes |
| Inter-joint coupling | No | Yes | Yes |
| Perturbation recovery | No | No | Yes |
| Convergence speed | Fast | Medium | Slow |
| Biological plausibility | Low | High | Highest |
| Analysis difficulty | Easy | Medium | Hard |

**Validation Checkpoint**:
- [ ] Sine controller produces oscillating torques (same as v1)
- [ ] CPG controller shows emergent phase locking between coupled joints
- [ ] CPG+NN controller responds differently to different sensor inputs
- [ ] All three controllers produce finite torques (no NaN/Inf)
- [ ] CPG+NN with all-zero NN weights degrades gracefully to pure CPG behavior
- [ ] Creature walks using each controller tier (fitness > 0)

---

### PHASE 3: GA Engine + Advanced Algorithms
**Files**: `src/ga_core.py`, `src/algorithms/*.py`, `src/config.py`, `src/utils.py`
**Goal**: Full GA engine with standard and advanced algorithm variants.

#### 3A: Standard GA (updated from v1)

**Population Initialization**: Random in [0, 1]^n where n depends on controller tier.

**Selection Methods** (implement all four):

##### Tournament Selection (same as v1)
```
Select k random individuals, return the best.
k = 3 (default), also test 5 and 7.
```

##### Roulette Wheel Selection (same as v1)
```
P(x_i) = f'(x_i) / sum(f'(x_j))
where f'(x_i) = f(x_i) - min(f) + epsilon
```

##### Rank-Based Selection (same as v1)
```
P(x_i) = (2-s)/N + 2*rank_i*(s-1) / (N*(N-1))
s = 1.5
```

##### Lexicase Selection (NEW)
```python
def lexicase_select(population, test_cases):
    """
    Lexicase selection: filter population through shuffled test cases.

    test_cases: list of evaluation conditions, each returning a fitness.
    For STRIDE, test cases are different evaluation scenarios:
      - Flat terrain, 15s simulation
      - Hill terrain, 10s simulation
      - Flat terrain with 5% motor noise, 15s simulation
      - Flat terrain, 5s sprint test
      - Flat terrain, 30s endurance test

    Each individual has a fitness vector (one value per test case).
    """
    candidates = list(range(len(population)))
    cases = list(range(len(test_cases)))
    random.shuffle(cases)

    for case_idx in cases:
        if len(candidates) == 1:
            break
        # Find best fitness on this test case among remaining candidates
        best_fitness = max(population[i].fitness_vector[case_idx] for i in candidates)
        # Keep only individuals within epsilon of the best
        epsilon = 0.01 * abs(best_fitness) if best_fitness != 0 else 0.01
        candidates = [i for i in candidates
                     if population[i].fitness_vector[case_idx] >= best_fitness - epsilon]

    return random.choice(candidates)
```

**Crossover Operators** (same as v1):
- Single-point crossover (default)
- Two-point crossover
- Uniform crossover
- Crossover rates to test: 0.6, 0.8, 0.9

**Mutation Operators**:

##### Fixed Gaussian Mutation (same as v1)
```
gene_i' = clamp(gene_i + N(0, sigma^2), 0, 1) with probability p_m
```

##### Adaptive Mutation (same as v1)
```
p_m(g) = max(p_min, p_m0 * (1 - g/G))
```

##### Self-Adaptive Mutation (NEW)
```python
def self_adaptive_mutate(chromosome, sigma_gene_idx=-1):
    """
    Each chromosome carries its own mutation rate as the last gene.

    chromosome[-1] encodes the individual's mutation rate (decoded to [0.001, 0.3]).
    The mutation rate gene is itself subject to mutation (meta-evolution).
    """
    # Decode mutation rate from last gene
    p_m = chromosome[sigma_gene_idx] * 0.299 + 0.001  # [0.001, 0.3]

    # Mutate the mutation rate gene itself (log-normal perturbation)
    tau = 1.0 / math.sqrt(len(chromosome))
    chromosome[sigma_gene_idx] *= math.exp(tau * random.gauss(0, 1))
    chromosome[sigma_gene_idx] = clamp(chromosome[sigma_gene_idx], 0, 1)

    # Mutate other genes using this individual's rate
    for i in range(len(chromosome) - 1):
        if random.random() < p_m:
            chromosome[i] += random.gauss(0, 0.1)
            chromosome[i] = clamp(chromosome[i], 0, 1)

    return chromosome
```

**Elitism** (same as v1):
- Top ceil(E * N) individuals survive unchanged
- E = 0.0, 0.05, 0.10 tested
- Capped at N-2

**Adaptive Operator Selection (NEW)**:
```python
class AdaptiveOperatorSelector:
    """
    Track success rates of crossover/mutation operators.
    Adjust probabilities based on recent offspring quality.

    Uses Adaptive Pursuit strategy:
    - After each generation, score each operator by how many offspring
      it produced that exceeded their parents' fitness.
    - Increase probability of successful operators, decrease others.
    """

    def __init__(self, operators, p_min=0.05, alpha=0.3):
        self.operators = operators  # list of operator names
        self.n = len(operators)
        self.probs = np.ones(self.n) / self.n  # uniform start
        self.p_min = p_min
        self.alpha = alpha  # learning rate
        self.history = []  # track probabilities over generations

    def select(self):
        """Select an operator based on current probabilities."""
        return np.random.choice(self.operators, p=self.probs)

    def update(self, rewards):
        """
        Update probabilities based on operator rewards.
        rewards: dict mapping operator_name → success_count
        """
        total = sum(rewards.values()) + 1e-8
        for i, op in enumerate(self.operators):
            target = rewards.get(op, 0) / total
            self.probs[i] = self.probs[i] + self.alpha * (target - self.probs[i])

        # Enforce minimum probability
        self.probs = np.maximum(self.probs, self.p_min)
        self.probs /= self.probs.sum()  # renormalize

        self.history.append(self.probs.copy())
```

**Island Model** (same as v1):
- K=4 sub-populations, ring topology
- Migration every M=20 generations, top 2 individuals

**Fitness Sharing / Niching** (same as v1):
```
f_shared(x_i) = f(x_i) / sum_j sh(d(x_i, x_j))
sh(d) = 1 - (d/sigma_share)^alpha if d < sigma_share, else 0
```

**Crowding (NEW)**:
```python
def deterministic_crowding(population, offspring):
    """
    Deterministic crowding: each offspring competes against
    the most similar individual in the population.
    Maintains diversity by localizing competition.
    """
    new_pop = list(population)
    for child in offspring:
        # Find most similar individual
        distances = [np.linalg.norm(child.genes - ind.genes) for ind in new_pop]
        most_similar_idx = np.argmin(distances)
        # Child replaces most similar if fitter
        if child.fitness > new_pop[most_similar_idx].fitness:
            new_pop[most_similar_idx] = child
    return new_pop
```

#### 3B: Novelty Search (NEW)

```python
class NoveltySearch:
    """
    Optimize for behavioral uniqueness instead of fitness.

    Behavior descriptor for STRIDE:
      b(x) = [final_x_position, mean_torso_angle, gait_frequency,
              mean_foot_contact_ratio, mean_hip_amplitude, energy_consumed]

    Novelty score = mean distance to k nearest neighbors in behavior space.
    Archive stores novel behaviors discovered during evolution.
    """

    def __init__(self, k_neighbors=15, archive_threshold=0.1, behavior_dim=6):
        self.k = k_neighbors
        self.threshold = archive_threshold
        self.archive = []  # list of behavior descriptors
        self.behavior_dim = behavior_dim

    def compute_behavior_descriptor(self, sim_result):
        """Extract behavior descriptor from simulation result."""
        return np.array([
            sim_result.final_x,
            sim_result.mean_torso_angle,
            sim_result.gait_frequency,        # dominant frequency via FFT on foot contacts
            sim_result.foot_contact_ratio,     # fraction of time at least one foot on ground
            sim_result.mean_hip_amplitude,     # average hip joint excursion
            sim_result.total_energy,
        ])

    def novelty_score(self, behavior, population_behaviors):
        """Compute novelty as mean distance to k-nearest neighbors."""
        all_behaviors = population_behaviors + [b for b, _ in self.archive]
        if len(all_behaviors) < self.k:
            return float('inf')

        distances = [np.linalg.norm(behavior - b) for b in all_behaviors]
        distances.sort()
        return np.mean(distances[1:self.k+1])  # skip self (distance=0)

    def maybe_add_to_archive(self, behavior, chromosome):
        """Add to archive if sufficiently novel."""
        if len(self.archive) == 0:
            self.archive.append((behavior, chromosome.copy()))
            return True

        min_dist = min(np.linalg.norm(behavior - b) for b, _ in self.archive)
        if min_dist > self.threshold:
            self.archive.append((behavior, chromosome.copy()))
            return True
        return False

    def run_generation(self, population, evaluate_fn, ga_operators):
        """
        One generation of novelty search:
        1. Evaluate all individuals to get behavior descriptors
        2. Compute novelty scores
        3. Select based on novelty (not fitness)
        4. Apply standard crossover + mutation
        5. Optionally add novel individuals to archive
        """
        # Evaluate
        behaviors = []
        fitnesses = []
        for ind in population:
            result = evaluate_fn(ind.genes)
            ind.behavior = self.compute_behavior_descriptor(result)
            ind.fitness = result.fitness  # track fitness but don't select on it
            behaviors.append(ind.behavior)
            fitnesses.append(ind.fitness)

        # Compute novelty
        for i, ind in enumerate(population):
            ind.novelty = self.novelty_score(ind.behavior, behaviors)
            self.maybe_add_to_archive(ind.behavior, ind.genes)

        # Select based on novelty score
        # (use tournament selection but compare novelty instead of fitness)
        parents = tournament_select_by_novelty(population, k=3)

        # Standard crossover + mutation
        offspring = ga_operators.breed(parents)

        return offspring
```

**Novelty + Fitness hybrid** (weighted combination):
```python
def hybrid_score(fitness, novelty, weight_fitness=0.5):
    """
    Combined fitness-novelty score.
    weight_fitness=1.0 → pure fitness (standard GA)
    weight_fitness=0.0 → pure novelty (novelty search)
    weight_fitness=0.5 → balanced hybrid
    """
    # Normalize both to [0, 1] within current population
    return weight_fitness * norm_fitness + (1 - weight_fitness) * norm_novelty
```

#### 3C: MAP-Elites (NEW)

```python
class MAPElites:
    """
    Quality-Diversity algorithm.

    Maintains a grid of behavioral niches.
    Each cell stores the single best individual for that behavior combination.

    Behavioral dimensions for STRIDE:
      Dim 1 (x-axis): Average speed (0 to max_speed, 10 bins)
      Dim 2 (y-axis): Energy efficiency / Cost of Transport (0 to max_cot, 10 bins)

    Grid: 10x10 = 100 cells. Each cell holds the best individual for that
    speed-efficiency combination.
    """

    def __init__(self, dims, bins_per_dim=10):
        """
        dims: list of (name, min_val, max_val) for each behavioral dimension
        """
        self.dims = dims
        self.bins = bins_per_dim
        self.grid = {}  # (bin_x, bin_y, ...) → Individual
        self.history = []  # grid snapshots per generation

    def get_bin(self, behavior):
        """Map continuous behavior to discrete grid cell."""
        cell = []
        for i, (name, lo, hi) in enumerate(self.dims):
            val = behavior[i]
            bin_idx = int((val - lo) / (hi - lo + 1e-8) * self.bins)
            bin_idx = max(0, min(self.bins - 1, bin_idx))
            cell.append(bin_idx)
        return tuple(cell)

    def add(self, individual, behavior, fitness):
        """Add individual to grid if it's the best in its cell."""
        cell = self.get_bin(behavior)
        if cell not in self.grid or fitness > self.grid[cell]['fitness']:
            self.grid[cell] = {
                'genes': individual.copy(),
                'behavior': behavior.copy(),
                'fitness': fitness,
            }
            return True  # new or improved
        return False

    def run(self, n_iterations, evaluate_fn, gene_length,
            initial_random=1000, batch_size=100):
        """
        MAP-Elites main loop:
        1. Seed grid with random individuals
        2. Repeat:
           a. Select random occupied cell
           b. Mutate its inhabitant (Gaussian + occasionally crossover with another cell)
           c. Evaluate offspring
           d. Place in appropriate cell if best for that cell
        """
        # Phase 1: Random initialization
        for _ in range(initial_random):
            genes = np.random.uniform(0, 1, gene_length)
            result = evaluate_fn(genes)
            behavior = self.extract_behavior(result)
            self.add(genes, behavior, result.fitness)

        # Phase 2: Improvement
        for iteration in range(n_iterations):
            for _ in range(batch_size):
                # Select random occupied cell
                cells = list(self.grid.keys())
                if not cells:
                    continue
                parent_cell = random.choice(cells)
                parent = self.grid[parent_cell]['genes'].copy()

                # Mutation (70%) or crossover (30%)
                if random.random() < 0.7 or len(cells) < 2:
                    child = gaussian_mutate(parent, p_m=0.1, sigma=0.1)
                else:
                    other_cell = random.choice(cells)
                    other = self.grid[other_cell]['genes']
                    child, _ = single_point_crossover(parent, other)
                    child = gaussian_mutate(child, p_m=0.05, sigma=0.05)

                # Evaluate and place
                result = evaluate_fn(child)
                behavior = self.extract_behavior(result)
                self.add(child, behavior, result.fitness)

            self.history.append(self.snapshot())

    def extract_behavior(self, sim_result):
        """Extract behavioral descriptor for grid placement."""
        speed = sim_result.final_x / sim_result.sim_time
        cot = sim_result.total_energy / (sim_result.creature_mass * max(sim_result.final_x, 0.01))
        return np.array([speed, cot])

    def coverage(self):
        """Fraction of grid cells that are occupied."""
        return len(self.grid) / (self.bins ** len(self.dims))

    def snapshot(self):
        """Return current grid state for history tracking."""
        return {cell: entry['fitness'] for cell, entry in self.grid.items()}
```

#### 3D: NSGA-II Multi-Objective (NEW)

```python
class NSGA2:
    """
    Non-dominated Sorting Genetic Algorithm II.

    Objectives for STRIDE (all to be MAXIMIZED):
      1. Distance traveled (maximize)
      2. Energy efficiency = -total_energy (maximize, i.e., minimize energy)
      3. Uprightness score (maximize)

    Instead of combining into one scalar, find the Pareto front of tradeoffs.
    """

    def __init__(self, n_objectives=3, population_size=100):
        self.n_obj = n_objectives
        self.pop_size = population_size

    def dominates(self, a, b):
        """Does individual a dominate individual b?"""
        # a dominates b if a is >= b in all objectives and > in at least one
        at_least_one_better = False
        for i in range(self.n_obj):
            if a.objectives[i] < b.objectives[i]:
                return False
            if a.objectives[i] > b.objectives[i]:
                at_least_one_better = True
        return at_least_one_better

    def fast_nondominated_sort(self, population):
        """Assign each individual to a Pareto front (rank)."""
        fronts = [[]]
        S = {i: [] for i in range(len(population))}  # dominated set
        n = {i: 0 for i in range(len(population))}    # domination count

        for p_idx in range(len(population)):
            for q_idx in range(len(population)):
                if p_idx == q_idx:
                    continue
                if self.dominates(population[p_idx], population[q_idx]):
                    S[p_idx].append(q_idx)
                elif self.dominates(population[q_idx], population[p_idx]):
                    n[p_idx] += 1

            if n[p_idx] == 0:
                population[p_idx].rank = 0
                fronts[0].append(p_idx)

        i = 0
        while fronts[i]:
            next_front = []
            for p_idx in fronts[i]:
                for q_idx in S[p_idx]:
                    n[q_idx] -= 1
                    if n[q_idx] == 0:
                        population[q_idx].rank = i + 1
                        next_front.append(q_idx)
            i += 1
            fronts.append(next_front)

        return fronts[:-1]  # remove empty last front

    def crowding_distance(self, front, population):
        """Compute crowding distance for diversity preservation."""
        n = len(front)
        if n <= 2:
            for idx in front:
                population[idx].crowding = float('inf')
            return

        for idx in front:
            population[idx].crowding = 0.0

        for obj_i in range(self.n_obj):
            sorted_front = sorted(front, key=lambda idx: population[idx].objectives[obj_i])
            population[sorted_front[0]].crowding = float('inf')
            population[sorted_front[-1]].crowding = float('inf')

            obj_range = (population[sorted_front[-1]].objectives[obj_i] -
                        population[sorted_front[0]].objectives[obj_i])
            if obj_range == 0:
                continue

            for i in range(1, n - 1):
                population[sorted_front[i]].crowding += (
                    population[sorted_front[i+1]].objectives[obj_i] -
                    population[sorted_front[i-1]].objectives[obj_i]
                ) / obj_range

    def select(self, population):
        """Binary tournament using (rank, crowding distance)."""
        a, b = random.sample(range(len(population)), 2)
        # Prefer lower rank (closer to Pareto front)
        if population[a].rank < population[b].rank:
            return a
        elif population[b].rank < population[a].rank:
            return b
        # Same rank: prefer higher crowding distance (more isolated)
        elif population[a].crowding > population[b].crowding:
            return a
        else:
            return b
```

**NSGA-II Objectives**:
```python
def evaluate_multi_objective(chromosome, terrain, config):
    """Evaluate creature on multiple objectives simultaneously."""
    result = simulate(chromosome, terrain, config)
    return {
        'distance': result.final_x - result.initial_x,
        'efficiency': -result.total_energy,  # negate to maximize
        'uprightness': result.mean_uprightness,
    }
```

#### 3E: Competitive Co-Evolution (NEW)

```python
class CoEvolution:
    """
    Two populations evolving against each other:
    - Population A: walkers (evolve to walk on any terrain)
    - Population B: terrains (evolve to be hard for walkers)

    Every swap_interval generations:
      A is evaluated on B's hardest terrain
      B generates terrain that challenges A's best walkers
    """

    def __init__(self, walker_pop_size=50, terrain_pop_size=20, swap_interval=10):
        self.walker_pop_size = walker_pop_size
        self.terrain_pop_size = terrain_pop_size
        self.swap_interval = swap_interval

    # Terrain genome: [n_hills, hill_amplitude_range, hill_frequency,
    #                  n_gaps, gap_width_range, surface_roughness]
    # ~10 genes encoding a parameterized terrain function

    def terrain_from_genes(self, genes):
        """Decode terrain genes into a terrain function."""
        n_hills = int(genes[0] * 5) + 1           # 1-5 hills
        amplitude = genes[1] * 80 + 20             # 20-100 pixels
        frequency = genes[2] * 0.02 + 0.005        # hill frequency
        n_gaps = int(genes[3] * 3)                  # 0-3 gaps
        gap_width = genes[4] * 40 + 10              # 10-50 pixels
        roughness = genes[5] * 5                    # surface noise
        # ... more parameters

        def height_fn(x):
            h = 50.0  # base height
            # Add hills
            h += amplitude * math.sin(frequency * x)
            # Add smaller perturbations
            h += roughness * math.sin(0.1 * x) * math.cos(0.07 * x)
            # Gaps handled separately in pymunk
            return max(h, 0)

        return height_fn

    def walker_fitness(self, walker_genes, terrain_genes_list):
        """Walker fitness: minimum fitness across all terrains in B."""
        fitnesses = []
        for t_genes in terrain_genes_list:
            terrain = self.terrain_from_genes(t_genes)
            f = simulate(walker_genes, terrain)
            fitnesses.append(f)
        return min(fitnesses)  # worst-case performance

    def terrain_fitness(self, terrain_genes, walker_genes_list):
        """Terrain fitness: how much it reduces best walkers' performance."""
        terrain = self.terrain_from_genes(terrain_genes)
        fitnesses = []
        for w_genes in walker_genes_list:
            f = simulate(w_genes, terrain)
            fitnesses.append(f)
        return -np.mean(fitnesses)  # negate: harder terrain = higher terrain fitness
```

**Validation Checkpoint**:
- [ ] Standard GA: fitness increases over 30 generations (all selection methods)
- [ ] Lexicase selection: different test cases select different specialists
- [ ] Self-adaptive mutation: mutation rate gene converges to reasonable range
- [ ] Adaptive operator selection: probabilities shift over generations
- [ ] Crowding: population maintains higher diversity than standard GA
- [ ] Novelty search: archive grows, population stays behaviorally diverse
- [ ] MAP-Elites: grid coverage increases over iterations
- [ ] NSGA-II: Pareto front forms with clear tradeoffs between objectives
- [ ] Co-evolution: walker fitness improves AND terrain difficulty increases
- [ ] All algorithms handle edge cases (zero fitness, identical individuals, etc.)

---

### PHASE 4: Morphology Co-Evolution
**Files**: `src/creature.py` (update), `src/encoding.py` (update)
**Goal**: Evolve body shape alongside control parameters.

**Morphology Genes** (12 genes, appended to controller chromosome):
```python
MORPHOLOGY_GENES = {
    # Limb lengths (4 genes)
    "upper_leg_length": (25.0, 55.0),    # pixels
    "lower_leg_length": (20.0, 50.0),
    "upper_arm_length": (20.0, 45.0),
    "lower_arm_length": (15.0, 40.0),

    # Body proportions (2 genes)
    "torso_width": (40.0, 80.0),
    "torso_height": (12.0, 30.0),

    # Joint angle limits (6 genes)
    "joint_limit_hip": (math.pi/6, math.pi/2),
    "joint_limit_knee": (math.pi/8, math.pi/3),
    "joint_limit_shoulder": (math.pi/6, math.pi/2),
    "joint_limit_hip_asymmetry": (-0.2, 0.2),   # allow slight L/R asymmetry
    "joint_limit_knee_asymmetry": (-0.2, 0.2),
    "joint_limit_shoulder_asymmetry": (-0.2, 0.2),
}
```

**Total Chromosome Sizes**:

| Controller | Control Genes | + Morphology | + Self-Adaptive | Total |
|-----------|--------------|-------------|-----------------|-------|
| Sine | 18 | 30 | 31 | 31 |
| CPG | 35 | 47 | 48 | 48 |
| CPG+NN | 93 | 105 | 106 | 106 |

**Creature Construction with Morphology**:
```python
def build_creature(chromosome, config):
    """Build creature from chromosome, using morphology genes if present."""
    if config.get("evolve_morphology", False):
        # Last 12 genes are morphology
        control_genes = chromosome[:-12]
        morph_genes = chromosome[-12:]
        morphology = decode_morphology(morph_genes)
    else:
        control_genes = chromosome
        morphology = DEFAULT_MORPHOLOGY

    controller = create_controller(control_genes, config["controller_type"])
    body = create_body(morphology)

    return Creature(body, controller, morphology)
```

**Validation Checkpoint**:
- [ ] Morphology genes correctly change creature dimensions
- [ ] Short-legged and long-legged creatures both simulate without crash
- [ ] Wide torso and narrow torso creatures both work
- [ ] Joint limits are respected during simulation
- [ ] Morphology changes don't break collision geometry
- [ ] Evolution with morphology genes shows body shape variation across population

---

### PHASE 5: Experiment Pipeline
**Files**: `experiments/run_experiments.py`, `experiments/transfer_test.py`, `experiments/convergence_budget.py`, `main.py`
**Goal**: Run all experiments with checkpointing, transfer testing, and convergence analysis.

#### Experiment Configuration (expanded)

```python
BASELINE_CONFIG = {
    "population_size": 100,
    "max_generations": 100,
    "crossover_rate": 0.8,
    "mutation_rate": 0.05,
    "mutation_sigma": 0.1,
    "tournament_size": 3,
    "elitism_rate": 0.05,
    "selection_method": "tournament",
    "crossover_method": "single_point",
    "mutation_method": "fixed",        # "fixed", "adaptive", "self_adaptive"
    "controller_type": "sine",          # "sine", "cpg", "cpg_nn"
    "encoding": "direct",
    "terrain": "flat",
    "evolve_morphology": False,
    "simulation_time": 15.0,
    "simulation_fps": 60,
    "num_runs": 30,
    "seed_start": 42,
    "fitness_weights": {"alpha": 0.1, "beta": 0.5, "gamma": 10.0},
    "motor_noise": 0.0,                # 0.0 = no noise, 0.05 = 5% noise
    "island_model": False,
    "fitness_sharing": False,
    "diversity_mechanism": "none",      # "none", "sharing", "crowding"
    "operator_adaptation": False,
    "algorithm": "standard_ga",         # "standard_ga", "novelty", "map_elites", "nsga2", "coevolution"
    "novelty_weight": 0.0,             # 0.0 = pure fitness, 1.0 = pure novelty

    # Recording settings
    "record_all_chromosomes": False,    # for landscape analysis (memory intensive)
    "record_parent_tracking": True,     # for family tree / phylogenetic tree
    "record_behavior_descriptors": True,# for behavioral analysis
    "record_grf": False,                # ground reaction forces (slow)
    "record_operator_usage": True,      # which operators produced which offspring

    # Lexicase test cases (only used when selection_method="lexicase")
    "lexicase_cases": [
        {"terrain": "flat", "sim_time": 15.0, "motor_noise": 0.0},
        {"terrain": "hill", "sim_time": 10.0, "motor_noise": 0.0},
        {"terrain": "flat", "sim_time": 15.0, "motor_noise": 0.05},
        {"terrain": "flat", "sim_time": 5.0, "motor_noise": 0.0},
        {"terrain": "flat", "sim_time": 30.0, "motor_noise": 0.0},
    ],
}
```

#### Experiment Groups

**P0 — Core Comparisons** (must have):
```python
EXPERIMENTS_P0 = {
    # Baseline + random search
    "baseline_sine":     {**BASELINE, "controller_type": "sine"},
    "random_search":     {**BASELINE, "algorithm": "random"},

    # Controller tier comparison (THE key comparison)
    "baseline_cpg":      {**BASELINE, "controller_type": "cpg"},
    "baseline_cpg_nn":   {**BASELINE, "controller_type": "cpg_nn"},

    # Selection method comparison (all on sine controller)
    "roulette_selection": {**BASELINE, "selection_method": "roulette"},
    "rank_selection":     {**BASELINE, "selection_method": "rank"},

    # Mutation comparison
    "mutation_low":      {**BASELINE, "mutation_rate": 0.01},
    "mutation_high":     {**BASELINE, "mutation_rate": 0.1},
    "mutation_adaptive": {**BASELINE, "mutation_method": "adaptive"},

    # Elitism comparison
    "no_elitism":        {**BASELINE, "elitism_rate": 0.0},
    "high_elitism":      {**BASELINE, "elitism_rate": 0.10},
}
```

**P1 — Advanced GA Features** (should have):
```python
EXPERIMENTS_P1 = {
    # Encoding
    "indirect_encoding":    {**BASELINE, "encoding": "indirect"},

    # Terrain
    "hill_terrain":         {**BASELINE, "terrain": "hill"},
    "mixed_terrain":        {**BASELINE, "terrain": "mixed"},

    # Crossover
    "crossover_low":        {**BASELINE, "crossover_rate": 0.6},
    "crossover_high":       {**BASELINE, "crossover_rate": 0.9},

    # Advanced selection
    "lexicase_selection":   {**BASELINE, "selection_method": "lexicase"},

    # Diversity mechanisms
    "fitness_sharing":      {**BASELINE, "diversity_mechanism": "sharing"},
    "crowding":             {**BASELINE, "diversity_mechanism": "crowding"},

    # Self-adaptive mutation
    "self_adaptive_mutation": {**BASELINE, "mutation_method": "self_adaptive"},

    # Adaptive operators
    "adaptive_operators":   {**BASELINE, "operator_adaptation": True},

    # Motor noise robustness
    "noisy_motors":         {**BASELINE, "motor_noise": 0.05},
}
```

**P2 — Quality-Diversity & Multi-Objective** (nice to have):
```python
EXPERIMENTS_P2 = {
    # Novelty search variants
    "novelty_pure":         {**BASELINE, "algorithm": "novelty", "novelty_weight": 1.0},
    "novelty_hybrid":       {**BASELINE, "algorithm": "novelty", "novelty_weight": 0.5},

    # MAP-Elites
    "map_elites_sine":      {**BASELINE, "algorithm": "map_elites", "controller_type": "sine"},
    "map_elites_cpg":       {**BASELINE, "algorithm": "map_elites", "controller_type": "cpg"},

    # NSGA-II
    "nsga2_sine":           {**BASELINE, "algorithm": "nsga2", "controller_type": "sine"},

    # Morphology co-evolution
    "morphology_sine":      {**BASELINE, "evolve_morphology": True, "controller_type": "sine"},
    "morphology_cpg_nn":    {**BASELINE, "evolve_morphology": True, "controller_type": "cpg_nn"},

    # Population size
    "pop_small":            {**BASELINE, "population_size": 50},
    "pop_large":            {**BASELINE, "population_size": 200},

    # Island model
    "island_model":         {**BASELINE, "island_model": True},
}
```

**P3 — Ambitious Extensions** (stretch goals):
```python
EXPERIMENTS_P3 = {
    # Co-evolution
    "coevolution":          {**BASELINE, "algorithm": "coevolution", "controller_type": "cpg_nn"},

    # CPG+NN on all terrains
    "cpg_nn_hill":          {**BASELINE, "controller_type": "cpg_nn", "terrain": "hill"},
    "cpg_nn_mixed":         {**BASELINE, "controller_type": "cpg_nn", "terrain": "mixed"},
    "cpg_nn_noisy":         {**BASELINE, "controller_type": "cpg_nn", "motor_noise": 0.05},

    # Full morphology + CPG+NN + novelty (the grand experiment)
    "full_stack":           {**BASELINE, "controller_type": "cpg_nn", "evolve_morphology": True,
                             "algorithm": "novelty", "novelty_weight": 0.3},
}
```

#### Transfer Testing

```python
def run_transfer_tests(results_dir):
    """
    Take best chromosome from each flat-terrain experiment.
    Evaluate on hill, mixed, gap terrain WITHOUT re-evolution.
    Also test with motor noise.

    Produces a transfer matrix:

                    | Flat  | Hill  | Mixed | Gap  | Noisy(5%) |
    baseline_sine   | 746.8 | ??    | ??    | ??   | ??        |
    baseline_cpg    | ...   | ...   | ...   | ...  | ...       |
    baseline_cpg_nn | ...   | ...   | ...   | ...  | ...       |

    Report: fitness retention rate = test_fitness / train_fitness
    """
    transfer_terrains = ["flat", "hill", "mixed", "gap"]
    transfer_noise = [0.0, 0.05, 0.10]

    for experiment_name in ["baseline_sine", "baseline_cpg", "baseline_cpg_nn"]:
        best_chromosome = load_best(results_dir, experiment_name)

        for terrain in transfer_terrains:
            for noise in transfer_noise:
                config = {**BASELINE, "terrain": terrain, "motor_noise": noise}
                # Run 10 evaluations (for stochastic noise) and average
                fitnesses = [evaluate(best_chromosome, config) for _ in range(10)]
                record(experiment_name, terrain, noise, np.mean(fitnesses))
```

#### Convergence Budget Analysis

```python
def run_convergence_budget(results_dir):
    """
    For each algorithm/experiment, determine when convergence occurred.

    Convergence criterion: best fitness doesn't improve by >1% for 15
    consecutive generations.

    Output: table of (algorithm, generations_to_converge, evaluations_consumed,
            final_fitness, efficiency = fitness / evaluations)
    """
    def find_convergence_gen(fitness_history, patience=15, threshold=0.01):
        best_so_far = fitness_history[0]
        stale_count = 0
        for g, f in enumerate(fitness_history):
            if f > best_so_far * (1 + threshold):
                best_so_far = f
                stale_count = 0
            else:
                stale_count += 1
            if stale_count >= patience:
                return g - patience  # converged this many gens ago
        return len(fitness_history)  # never converged in budget
```

**Validation Checkpoint**:
- [ ] All P0 experiments complete 30 runs each
- [ ] Transfer test matrix populated for all controller tiers
- [ ] Convergence budget table computed
- [ ] Checkpointing works (kill and resume test)
- [ ] Motor noise experiments run without crash
- [ ] Results saved to .pkl files with correct schema

---

### PHASE 6: Analysis & Deep Visualization
**Files**: `experiments/analyze_results.py`, `src/analysis/*.py`, all `visualization/*.py`
**Goal**: Generate all statistical analysis, landscape analysis, and visualization figures.

#### 6A: Statistical Analysis (expanded from v1)

Same as v1 but with additional tables:
- Per-experiment stats (mean, median, std, best, worst)
- Comparison tables (selection, mutation, elitism, encoding, terrain, controller, algorithm)
- Wilcoxon rank-sum tests with effect sizes
- Convergence speed (G_80)
- **NEW**: Controller comparison table (sine vs CPG vs CPG+NN)
- **NEW**: Transfer testing matrix
- **NEW**: Convergence budget table
- **NEW**: MAP-Elites coverage and quality statistics
- **NEW**: NSGA-II Pareto front statistics (hypervolume, spread)

#### 6B: Fitness Landscape Analysis (NEW)

```python
# src/analysis/landscape.py

def fitness_distance_correlation(evaluate_fn, best_known, n_samples=5000, gene_length=18):
    """
    Fitness-Distance Correlation (FDC).

    Sample random chromosomes. For each, compute fitness and distance to
    the known global best. Compute Pearson correlation.

    FDC < -0.15: landscape is funneling (gradient points toward optimum)
    FDC ≈ 0: no correlation (deceptive or neutral)
    FDC > 0.15: anti-correlated (deceptive — farther = fitter in some regions)
    """
    fitnesses = []
    distances = []
    for _ in range(n_samples):
        genes = np.random.uniform(0, 1, gene_length)
        f = evaluate_fn(genes)
        d = np.linalg.norm(genes - best_known)
        fitnesses.append(f)
        distances.append(d)

    fdc = np.corrcoef(fitnesses, distances)[0, 1]
    return fdc, fitnesses, distances


def random_walk_autocorrelation(evaluate_fn, start, n_steps=1000, step_size=0.01):
    """
    Random walk autocorrelation.

    Start from a random point. Take small random steps.
    Compute autocorrelation of fitness along the walk.

    High autocorrelation (slow decay) = smooth landscape
    Low autocorrelation (fast decay) = rugged landscape

    Correlation length (lag where autocorr drops below 1/e) indicates
    the scale of landscape features.
    """
    current = start.copy()
    fitnesses = []
    for _ in range(n_steps):
        f = evaluate_fn(current)
        fitnesses.append(f)
        # Small random step
        direction = np.random.randn(len(current))
        direction /= np.linalg.norm(direction)
        current = np.clip(current + step_size * direction, 0, 1)

    # Compute autocorrelation
    f_array = np.array(fitnesses) - np.mean(fitnesses)
    autocorr = np.correlate(f_array, f_array, mode='full')
    autocorr = autocorr[len(autocorr)//2:]
    autocorr /= autocorr[0]

    # Correlation length
    corr_length = np.argmax(autocorr < 1/np.e) if np.any(autocorr < 1/np.e) else n_steps

    return autocorr, corr_length


def neutrality_analysis(evaluate_fn, reference, n_mutations=1000, sigma=0.01, epsilon=0.01):
    """
    Neutral network analysis.

    From a reference point, make small random mutations.
    What fraction produce fitness change < epsilon?

    High neutrality = large plateaus in landscape (GA can drift neutrally)
    Low neutrality = every mutation matters (sharp landscape)
    """
    ref_fitness = evaluate_fn(reference)
    neutral_count = 0

    for _ in range(n_mutations):
        mutant = reference.copy()
        # Mutate one random gene
        gene_idx = random.randint(0, len(reference) - 1)
        mutant[gene_idx] = np.clip(mutant[gene_idx] + random.gauss(0, sigma), 0, 1)

        mutant_fitness = evaluate_fn(mutant)
        if abs(mutant_fitness - ref_fitness) < epsilon * abs(ref_fitness + 1e-8):
            neutral_count += 1

    return neutral_count / n_mutations  # neutrality ratio
```

#### 6C: Epistasis Analysis (NEW)

```python
# src/analysis/epistasis.py

def compute_epistasis_matrix(evaluate_fn, reference, gene_length, delta=0.05):
    """
    Epistasis matrix: measure gene-gene interactions.

    For each pair (i, j):
      f_ref     = f(x)
      f_i       = f(x with gene i += delta)
      f_j       = f(x with gene j += delta)
      f_ij      = f(x with both gene i and j += delta)

      epistasis(i,j) = f_ij - f_i - f_j + f_ref

    If epistasis ≈ 0: genes are independent (additive)
    If epistasis ≠ 0: genes interact (non-additive)
    """
    f_ref = evaluate_fn(reference)
    n = gene_length
    matrix = np.zeros((n, n))

    for i in range(n):
        xi = reference.copy()
        xi[i] = np.clip(xi[i] + delta, 0, 1)
        f_i = evaluate_fn(xi)

        for j in range(i+1, n):
            xj = reference.copy()
            xj[j] = np.clip(xj[j] + delta, 0, 1)
            f_j = evaluate_fn(xj)

            xij = reference.copy()
            xij[i] = np.clip(xij[i] + delta, 0, 1)
            xij[j] = np.clip(xij[j] + delta, 0, 1)
            f_ij = evaluate_fn(xij)

            epistasis = f_ij - f_i - f_j + f_ref
            matrix[i, j] = epistasis
            matrix[j, i] = epistasis

    return matrix
```

#### 6D: Schema Analysis (NEW)

```python
# src/analysis/schema.py

def schema_analysis(population_history, n_bins=5):
    """
    Holland's Schema Theorem empirical test.

    Identify gene patterns (schemas) in the top performers.
    Track schema frequency across generations.

    For each gene, discretize into n_bins.
    A schema is a partial specification: e.g., gene_3 ∈ bin_2 AND gene_7 ∈ bin_4.

    Find schemas shared by top 10% of final population.
    Track their frequency across all generations.
    Successful schemas should increase in frequency (Building Block Hypothesis).
    """
    final_gen = population_history[-1]
    n_pop = len(final_gen)
    top_k = int(0.1 * n_pop)

    # Sort by fitness, take top 10%
    sorted_pop = sorted(final_gen, key=lambda x: x.fitness, reverse=True)
    top_individuals = sorted_pop[:top_k]

    # For each gene, find the dominant bin among top individuals
    gene_length = len(top_individuals[0].genes)
    schemas = {}

    for g in range(gene_length):
        values = [ind.genes[g] for ind in top_individuals]
        bins = np.digitize(values, np.linspace(0, 1, n_bins + 1)[1:-1])
        dominant_bin = np.argmax(np.bincount(bins, minlength=n_bins))

        # If >70% of top individuals share this bin, it's a schema
        freq = np.sum(bins == dominant_bin) / top_k
        if freq > 0.7:
            schemas[g] = (dominant_bin, freq)

    # Track schema frequency across generations
    schema_history = {g: [] for g in schemas}
    for gen_pop in population_history:
        for g, (target_bin, _) in schemas.items():
            values = [ind.genes[g] for ind in gen_pop]
            bins = np.digitize(values, np.linspace(0, 1, n_bins + 1)[1:-1])
            freq = np.sum(bins == target_bin) / len(gen_pop)
            schema_history[g].append(freq)

    return schemas, schema_history
```

#### 6E: Behavioral Diversity Analysis (NEW)

```python
# src/analysis/behavioral.py

def classify_gaits(population_results, n_clusters=5):
    """
    Cluster creatures by gait type using behavioral descriptors.

    Behavior features:
    - Foot contact sequence (FFT of L/R contact signals)
    - Gait frequency (dominant frequency)
    - Duty factor (fraction of cycle with foot on ground)
    - Phase difference between left and right legs
    - Symmetry score

    Clustering: k-means or DBSCAN on behavior feature vectors.

    Expected gait families:
    - Walking: alternating L/R, ~1-2 Hz
    - Hopping: synchronized L/R, ~2-3 Hz
    - Running: brief flight phase between contacts
    - Dragging: no clear rhythm, torso-driven
    - Standing: minimal movement
    """
    features = []
    for result in population_results:
        contact_L = np.array(result.foot_contact_L_history)
        contact_R = np.array(result.foot_contact_R_history)

        # Gait frequency via FFT
        fft_L = np.abs(np.fft.rfft(contact_L))
        fft_R = np.abs(np.fft.rfft(contact_R))
        dominant_freq_L = np.argmax(fft_L[1:]) + 1
        dominant_freq_R = np.argmax(fft_R[1:]) + 1

        # Phase difference
        cross_corr = np.correlate(contact_L, contact_R, mode='full')
        phase_diff = (np.argmax(cross_corr) - len(contact_L)) / result.fps

        # Duty factor
        duty_L = np.mean(contact_L)
        duty_R = np.mean(contact_R)

        # Symmetry
        symmetry = 1.0 - abs(duty_L - duty_R) / max(duty_L + duty_R, 1e-8)

        features.append([
            dominant_freq_L, dominant_freq_R,
            phase_diff, duty_L, duty_R, symmetry,
            result.mean_hip_amplitude,
            result.final_x / result.sim_time,  # speed
        ])

    # Cluster
    from sklearn.cluster import KMeans
    features_array = np.array(features)
    features_normalized = (features_array - features_array.mean(0)) / (features_array.std(0) + 1e-8)

    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    labels = kmeans.fit_predict(features_normalized)

    return labels, features_array, kmeans


def compute_cost_of_transport(result):
    """
    Cost of Transport (CoT) = energy / (mass * distance * g)

    Standard biomechanics metric.
    Human walking: CoT ≈ 0.2
    Running: CoT ≈ 0.4
    Most evolved 2D walkers: CoT ≈ 1.0-5.0
    """
    distance = max(abs(result.final_x - result.initial_x), 0.01)
    mass = result.creature_mass
    gravity = 981.0  # pixels/s^2

    cot = result.total_energy / (mass * distance * gravity)
    return cot


def compute_phase_portrait(result, joint_idx=0):
    """
    Phase portrait: joint angle vs angular velocity.

    For periodic gaits, this forms a closed loop (limit cycle).
    The shape of the limit cycle characterizes the gait.
    Different gaits produce different shapes.
    """
    angles = np.array(result.joint_angle_history[joint_idx])
    velocities = np.array(result.joint_velocity_history[joint_idx])
    return angles, velocities
```

#### 6F: Visualization Suite

All visualizations output to `report/figures/` at 300 DPI.

**Carried from v1** (updated where noted):
1. `creature_diagram.py` — Labeled anatomy (updated with sensor annotations)
2. `encoding_diagram.py` — Direct vs indirect vs CPG vs CPG+NN encoding
3. `flowchart.py` — GA pipeline (updated with novelty/MAP-Elites/NSGA-II branches)
4. `convergence_plot.py` — 30 runs overlaid with mean ± std
5. `box_plots.py` — Grouped distributions
6. `diversity_plot.py` — Population diversity over generations
7. `heatmap.py` — Gene value evolution of best individual
8. `skeleton_trail.py` — Motion-capture afterimage trails
9. `generation_replay.py` — Best creature at key generations
10. `side_by_side.py` — Race comparison
11. `family_tree.py` — Lineage of best individual

**New visualizations**:

12. **`controller_diagram.py`** — Architecture diagram showing Sine vs CPG vs CPG+NN with data flow arrows, sensor inputs, oscillator networks, NN layers.

13. **`phylogenetic_tree.py`** — Full evolutionary lineage tree.
    - Every individual in every generation as a node
    - Edges from parent to child
    - Branch color = gait cluster ID
    - Branch thickness = fitness
    - X-axis = generation, Y-axis = genetic distance from root
    - Highlight lineage of final champion
    - Show speciation events (branch color changes)

14. **`population_cloud.py`** — UMAP dimensionality reduction of population trajectory.
    - Every individual from every generation, reduced to 2D
    - Animated scatter plot (one frame per generation)
    - Color = fitness (blue→red gradient)
    - Watch population converge, split, explore
    - Compare: standard GA (collapses to point) vs novelty (stays spread) vs MAP-Elites (fills space)

15. **`gene_flow_river.py`** — Muller plot of genetic variation.
    - X-axis = generation
    - Stacked colored bands = gene cluster frequencies
    - k-means on chromosomes per generation (k=5 clusters)
    - Band width = fraction of population in that cluster
    - New colors appear when novel clusters emerge
    - Colors merge when clusters recombine

16. **`fitness_landscape_3d.py`** — PCA-reduced 3D fitness surface.
    - PCA on all sampled chromosomes, take PC1 and PC2
    - Create grid over PC1 × PC2 space
    - Evaluate fitness at each grid point
    - Render as 3D surface (matplotlib surface plot)
    - Overlay population trajectory as animated dots climbing the surface
    - Report explained variance of PC1+PC2

17. **`selection_pressure.py`** — Selection frequency heatmap.
    - X-axis = generation
    - Y-axis = individuals ranked by fitness
    - Color intensity = number of times selected as parent
    - Compare tournament (moderate spread) vs roulette (extreme skew) vs lexicase (scattered)

18. **`crossover_viz.py`** — Animated crossover operation.
    - Two parent chromosome bars (colored by gene value)
    - Crossover point animation (cut line, swap)
    - Child chromosome assembly
    - Fitness comparison (green pulse if better, red if worse)
    - Use for Learn page on web app

19. **`mutation_impact.py`** — Gene sensitivity map.
    - For every mutation event in a run:
      - X-axis = gene index
      - Y-axis = mutation magnitude
      - Color = fitness change (green = improved, red = worse, gray = neutral)
    - Reveals sensitive vs robust genes

20. **`morphospace_map.py`** — UMAP of all best-of-run chromosomes.
    - All 510+ best chromosomes reduced to 2D
    - Color = fitness
    - Shape = experiment type / controller tier
    - Cluster analysis reveals strategy families

21. **`gait_cycle.py`** — Biomechanics-style gait phase diagram.
    - For top 5 walkers, show one complete gait cycle
    - Sequence of stick figures (8-12 frames per cycle)
    - Annotate: stance phase, swing phase, double support
    - Foot contact events marked
    - Similar to clinical gait analysis reports

22. **`failure_gallery.py`** — Curated worst/funniest creatures.
    - Categories: Faceplanter, Moonwalker, Hopper, Worm, Spinner, Seizure
    - Skeleton trail visualization for each
    - Caption explaining the local optimum it represents
    - Scientifically: each failure mode = a basin of attraction in fitness landscape

23. **`map_elites_grid.py`** — MAP-Elites grid visualization.
    - 2D heatmap: X = speed, Y = energy efficiency
    - Color = fitness of cell occupant
    - Empty cells shown in gray
    - Animate grid filling over iterations
    - Show final grid with clickable cells (web version)

24. **`pareto_front.py`** — NSGA-II Pareto front.
    - Scatter plot in objective space (2D or 3D)
    - Pareto front highlighted (connected line, colored by crowding distance)
    - Dominated solutions shown as faded dots
    - Animate front evolution over generations
    - Compare final front to single-objective optimum

25. **`grf_plot.py`** — Ground reaction force curves.
    - Vertical GRF vs time for one gait cycle
    - Human GRF reference curve overlaid for comparison
    - Compare sine vs CPG vs CPG+NN controller GRF patterns

26. **`phase_portrait.py`** — Joint angle vs angular velocity limit cycles.
    - One subplot per joint (6 total, 2×3 grid)
    - Overlay multiple gait types in different colors
    - Clear limit cycles indicate stable periodic gaits
    - Chaotic trajectories indicate unstable gaits

27. **`operator_adaptation.py`** — Operator probability evolution.
    - Stacked area chart: X = generation, Y = probability
    - Each color = one operator (e.g., single-point xover, two-point xover, uniform xover)
    - Shows which operators the GA learns to prefer

28. **`epistasis_matrix.py`** — Gene-gene interaction heatmap.
    - N×N heatmap where N = number of genes
    - Color = epistasis coefficient
    - Annotate gene groups (hip genes, knee genes, shoulder genes, etc.)
    - Block structure reveals modular gene interactions

29. **`parameter_sensitivity.py`** — 2D parameter sweep heatmaps.
    - Multiple heatmaps: mutation_rate × pop_size, crossover_rate × elitism, etc.
    - Color = mean fitness from experiments
    - Shows interaction effects between GA parameters

**Validation Checkpoint**:
- [ ] All statistical tables generated (no NaN)
- [ ] Fitness landscape analysis produces FDC, autocorrelation, neutrality
- [ ] Epistasis matrix shows clear structure (leg genes coupled, arm genes independent)
- [ ] Behavioral clustering identifies ≥3 distinct gait families
- [ ] Cost of Transport computed for all experiments
- [ ] All PNG figures generated at 300 DPI
- [ ] UMAP/t-SNE visualizations produce meaningful clusters
- [ ] MAP-Elites grid shows cell filling over time
- [ ] Pareto front is well-defined with clear tradeoffs

---

### PHASE 7: Report + Web Application
**Files**: `report/generate_report.py`, `web/src/**`
**Goal**: Generate the PDF report and complete the web application.

#### 7A: PDF Report

**Target**: 25-35 pages.

**Report Structure**:

**Title Page (1 page)**
- Title: "STRIDE: Evolving Adaptive 2D Walkers with Neuroevolution and Quality-Diversity Algorithms"
- Student: Dev Krishna (23112015)
- Course: Optimisation Techniques, CHRIST University, Pune

**Table of Contents (1 page)**

**Section 1: Introduction (2 pages)**
- Problem: evolving locomotion controllers for 2D bipedal creatures
- Formal optimization problem statement
- Why GA? (population-based, derivative-free, handles non-convex landscapes)
- Contributions: layered controller architecture, quality-diversity comparison, fitness landscape analysis
- Report structure outline

**Section 2: Literature Review (2-3 pages)**
- Sims (1994) — evolved virtual creatures
- Lipson & Pollack (2000) — sim-to-real transfer
- Stanley & Miikkulainen (2002) — NEAT
- Lehman & Stanley (2011) — novelty search
- Mouret & Clune (2015) — MAP-Elites
- Geijtenbeek et al. (2013) — muscle-based locomotion with CMA-ES
- Salimans et al. (2017) — evolution strategies vs RL
- Deb et al. (2002) — NSGA-II
- Ha (2019) — co-optimizing morphology and control
- Ijspeert (2008) — CPG-based locomotion
- Additional 2-3 recent papers (2020-2025)

**Section 3: Methodology (5-6 pages)**
- Notation table
- Creature anatomy diagram + sensor vector specification
- Controller architecture comparison (Sine vs CPG vs CPG+NN) with architecture diagrams
- Encoding schemes (direct, indirect, CPG, CPG+NN, morphology)
- GA pseudocode (main loop, selection, crossover, mutation)
- Novelty search pseudocode
- MAP-Elites pseudocode
- NSGA-II pseudocode
- Fitness function formulation (scalar + multi-objective + CoT)
- Terrain system
- Diversity mechanisms (fitness sharing, crowding, lexicase)

**Section 4: Experiment Design (3-4 pages)**
- Full experiment configuration table (all P0-P3 experiments)
- Parameter sensitivity sweep design
- Transfer testing protocol
- Convergence budget analysis methodology
- Fitness landscape analysis methodology
- Statistical test specifications (Wilcoxon, Cohen's d)

**Section 5: Results (6-8 pages)**
- Table: Controller comparison (sine vs CPG vs CPG+NN)
- Table: Selection method comparison
- Table: Mutation strategy comparison
- Table: Algorithm comparison (GA vs novelty vs MAP-Elites vs NSGA-II vs PSO vs CMA-ES)
- Table: Transfer testing matrix
- Table: Convergence budget
- Table: Statistical significance (p-values and effect sizes)
- Convergence plots, box plots, diversity plots
- MAP-Elites grid visualization
- Pareto front figure
- Fitness landscape analysis (FDC, autocorrelation, neutrality)
- Epistasis matrix
- Behavioral diversity results (gait families)
- Cost of Transport comparison
- Ground reaction force analysis
- Morphospace map
- Failure mode gallery

**Section 6: Discussion (2-3 pages)**
- What the GA discovered (emergent coordination, gait families)
- Controller hierarchy: does feedback help? (sine vs CPG vs CPG+NN)
- Quality vs diversity: MAP-Elites and novelty search insights
- Fitness landscape character: rugged, deceptive, or smooth?
- Morphology-control interaction (epistasis between body and gait genes)
- Limitations: 2D, simulation fidelity, computational budget
- Robustness analysis (motor noise, transfer testing)

**Section 7: Conclusion (1 page)**
- Key findings
- Contributions
- Future work (3D, RL comparison, real robot transfer)

**References (2 pages)**

**Appendix (optional)**
- Full parameter tables
- Additional figures
- Code architecture diagram

#### 7B: Web Application

**Existing pages (functional)**:
- **Lab** — Main evolution lab (update with controller tier selection)
- **Playground** — Gene slider control (update with CPG/NN gene visualization)

**Pages to complete**:

- **Results Dashboard** — Load pre-computed experiment data. Interactive charts. Controller comparison. Statistical tables. Filter by experiment group.

- **Hall of Fame** — Creature cards with: fitness score, gene heatmap, terrain badge, controller type, gait animation replay, CoT metric. Sort/filter by various criteria.

- **Compare** — Side-by-side evolution with different settings. Two independent workers. E.g., "Sine vs CPG+NN" or "Tournament vs Lexicase."

- **Learn** — Interactive GA walkthrough. 7 steps:
  1. What is a Chromosome? (interactive gene bar)
  2. How does Selection work? (animated tournament bracket)
  3. Crossover in action (drag and drop gene swap)
  4. Mutation visualized (gene perturbation with fitness feedback)
  5. Putting it together (mini 5-gen evolution, watch convergence)
  6. Why diversity matters (novelty search demo)
  7. The full picture (links to Lab page)

- **MAP-Elites Explorer** — Interactive grid. Click any cell to see creature. Color by fitness. Animate filling over iterations.

- **Landscape Viewer** — 3D fitness surface (using Three.js or PixiJS). Rotate/zoom. Population trajectory overlaid.

- **Terrain Editor** — Draw custom terrain. Test evolved walkers on it.

**Web Engine Updates**:
- Add CPG controller to `engine/` (port from Python)
- Add CPG+NN controller (with NN forward pass in TypeScript)
- Add sensor readout from p2.js physics
- Add novelty score computation in worker
- Add MAP-Elites grid logic in worker

**Validation Checkpoint**:
- [ ] PDF generates without errors, 25-35 pages
- [ ] All figures and tables embedded in report
- [ ] No black boxes from Unicode subscripts
- [ ] Web Lab page supports all three controller tiers
- [ ] Results Dashboard loads and displays experiment data
- [ ] Hall of Fame shows creature cards with replay
- [ ] Learn page has interactive widgets
- [ ] MAP-Elites Explorer shows clickable grid

---

## FITNESS FUNCTION (Complete Specification)

### Scalar Fitness (single-objective)
```
F(x) = w_dist * Delta_x - alpha * E(x) - beta * C(x) + gamma * U(x) + delta * V(x) + zeta * G(x)
```

**Components**:

| Symbol | Formula | Description | Weight |
|--------|---------|-------------|--------|
| Delta_x | x_torso(T) - x_torso(0) | Distance traveled | w_dist = 1.0 |
| E(x) | (1/S) * sum |tau_j(t)| | Average energy consumption | alpha = 0.1 |
| C(x) | count(torso near ground) | Fall count | beta = 0.5 |
| U(x) | (1/S) * sum max(0, cos(theta)) | Uprightness bonus | gamma = 10.0 |
| V(x) | std(v_x over last 50%) | Velocity consistency | delta = 2.0 |
| G(x) | gait_symmetry_score | Gait coordination bonus | zeta = 5.0 |

### Metabolic Cost Model (improved energy calculation)
```python
def metabolic_energy(torque, angular_velocity, dt):
    """
    Biologically-inspired energy model.

    Concentric contraction (positive work): high cost
    Eccentric contraction (negative work): lower cost (muscles more efficient)
    Isometric holding: moderate cost
    """
    power = torque * angular_velocity  # mechanical power

    if power > 0:
        # Concentric: muscle shortening under load
        energy = power * dt * 1.0  # full cost
    elif power < 0:
        # Eccentric: muscle lengthening under load (braking)
        energy = abs(power) * dt * 0.3  # 30% cost (eccentric efficiency)
    else:
        # Isometric: holding position
        energy = abs(torque) * dt * 0.5  # 50% cost

    return energy
```

### Cost of Transport
```
CoT = total_metabolic_energy / (creature_mass * distance * gravity)
```

### Multi-Objective (NSGA-II mode)
Three separate objectives, NOT combined:
```
Objective 1: Maximize distance traveled
Objective 2: Maximize energy efficiency (minimize total energy)
Objective 3: Maximize uprightness score
```

### Motor Noise (for robustness testing)
```python
def apply_motor_noise(torque, noise_level=0.05):
    """Add Gaussian noise to joint torques each frame."""
    return torque * (1.0 + noise_level * np.random.randn())
```

---

## TERRAIN SYSTEM

### Standard Terrains (same as v1)
- **Flat**: h(x) = 50 for all x
- **Hill**: h(x) = 50 + 50*sin(pi*(x-300)/200) for x in [300, 500]
- **Mixed**: Alternating flat and hill sections every 300px
- **Gap**: No ground from x=300 to x=350

### Evolved Terrain (for co-evolution)
Parameterized by terrain genome (10 genes):
```python
def evolved_terrain(genes):
    """Generate terrain from gene parameters."""
    base_height = 50
    n_features = int(genes[0] * 5) + 1
    amplitudes = genes[1:1+n_features] * 80 + 20
    frequencies = genes[1+n_features:1+2*n_features] * 0.02 + 0.005
    roughness = genes[-1] * 5

    def height(x):
        h = base_height
        for i in range(n_features):
            h += amplitudes[i] * math.sin(frequencies[i] * x + i * 1.3)
        h += roughness * math.sin(0.1 * x)
        return max(h, 0)

    return height
```

---

## MATHEMATICAL FORMULAS (Complete for Report)

### Motor Control

**Sinusoidal**:
```
theta_j(t) = A_j * sin(2*pi * omega_j * t + phi_j)
```

**CPG phase dynamics**:
```
d(theta_i)/dt = 2*pi*f_i + sum_j(w_ij * sin(theta_j - theta_i + phi_ij))
output_i(t) = A_i * sin(theta_i(t))
```

**CPG+NN**:
```
h = tanh(W_1 * s + b_1)           (hidden layer)
m = tanh(W_2 * h + b_2)           (modulation output)
tau_i(t) = cpg_i(t) * (1 + 0.5 * m_i)   (modulated torque)
```

### Novelty Score
```
rho(x) = (1/k) * sum_{i=1}^{k} ||b(x) - b(mu_i)||
where mu_1, ..., mu_k are the k nearest neighbors in behavior space
```

### MAP-Elites Quality
```
QD-score = sum_{c in occupied_cells} fitness(c)
Coverage = |occupied_cells| / |total_cells|
```

### NSGA-II Dominance
```
a dominates b iff:
  f_i(a) >= f_i(b) for all i in {1,...,M}
  AND exists j: f_j(a) > f_j(b)
```

### Cost of Transport
```
CoT = E_total / (m * d * g)
where E_total = total metabolic energy
      m = creature mass
      d = distance traveled
      g = gravitational acceleration
```

### Fitness Distance Correlation
```
FDC = corr(f(x_1),...,f(x_n) ; d(x_1,x*),...,d(x_n,x*))
where x* = best known solution
```

### Epistasis
```
epsilon(i,j) = f(x + delta_i + delta_j) - f(x + delta_i) - f(x + delta_j) + f(x)
```

### Self-Adaptive Mutation Rate
```
sigma'_i = sigma_i * exp(tau * N(0,1))
tau = 1 / sqrt(n)
x'_i = x_i + sigma'_i * N(0,1)
```

### Crowding Distance
```
CD(i) = sum_{m=1}^{M} (f_m(i+1) - f_m(i-1)) / (f_m_max - f_m_min)
```

(All other formulas from v1 Section 17 are retained: selection, crossover, mutation, fitness sharing, diversity, statistical tests.)

---

## NOTATION TABLE (Updated)

| Symbol | Description | Default Value |
|--------|-------------|---------------|
| N | Population size | 100 |
| G | Maximum generations | 100 |
| n | Chromosome length | 18 / 35 / 93 / +12 (varies by controller+morphology) |
| x_i | i-th individual (chromosome vector) | — |
| f(x) | Fitness function (scalar) | — |
| F(x) | Extended fitness with all components | — |
| b(x) | Behavior descriptor vector | 6-dimensional |
| rho(x) | Novelty score | — |
| p_c | Crossover probability | 0.8 |
| p_m | Mutation probability (per gene) | 0.05 |
| sigma | Mutation step size | 0.1 |
| E | Elitism rate | 0.05 |
| k | Tournament size | 3 |
| s | Selection pressure (rank-based) | 1.5 |
| T_sim | Simulation duration | 15.0 seconds |
| S | Total simulation steps (T_sim x FPS) | 900 |
| alpha | Energy penalty weight | 0.1 |
| beta | Fall penalty weight | 0.5 |
| gamma | Uprightness bonus weight | 10.0 |
| delta | Velocity consistency weight | 2.0 |
| zeta | Gait coordination weight | 5.0 |
| CoT | Cost of Transport | — |
| FDC | Fitness Distance Correlation | — |
| w_ij | CPG coupling weight (oscillator i to j) | evolved |
| W_1, W_2 | NN weight matrices | evolved |
| b_1, b_2 | NN bias vectors | evolved |
| m_i | NN modulation signal for joint i | [-1, 1] |
| sigma_share | Fitness sharing radius | 0.3 |
| K | Number of islands | 4 |
| M_obj | Number of NSGA-II objectives | 3 |
| QD-score | MAP-Elites quality-diversity score | — |
| epsilon | Epistasis coefficient | — |
| tau | Self-adaptation learning rate | 1/sqrt(n) |

---

## LITERATURE CITATIONS (Updated)

### Core Papers

1. **Sims, K. (1994)**. "Evolving Virtual Creatures." *SIGGRAPH '94*, pp. 15-22. — First evolved virtual creatures (morphology + control).

2. **Lipson, H., & Pollack, J. B. (2000)**. "Automatic Design and Manufacture of Robotic Lifeforms." *Nature*, 406, 974-978. — Sim-to-real evolutionary robotics.

3. **Stanley, K. O., & Miikkulainen, R. (2002)**. "Evolving Neural Networks through Augmenting Topologies." *Evolutionary Computation*, 10(2), 99-127. — NEAT algorithm.

4. **Deb, K., Pratap, A., Agarwal, S., & Meyarivan, T. (2002)**. "A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II." *IEEE Transactions on Evolutionary Computation*, 6(2), 182-197. — NSGA-II multi-objective.

5. **Lehman, J., & Stanley, K. O. (2011)**. "Abandoning Objectives: Evolution Through the Search for Novelty Alone." *Evolutionary Computation*, 19(2), 189-223. — Novelty search.

6. **Mouret, J.-B., & Clune, J. (2015)**. "Illuminating Search Spaces by Mapping Elites." *arXiv:1504.04909*. — MAP-Elites quality-diversity algorithm.

7. **Ijspeert, A. J. (2008)**. "Central Pattern Generators for Locomotion Control in Animals and Robots: A Review." *Neural Networks*, 21(4), 642-653. — CPG-based locomotion.

8. **Geijtenbeek, T., van de Panne, M., & van der Stappen, A. F. (2013)**. "Flexible Muscle-Based Locomotion for Bipedal Creatures." *ACM TOG*, 32(6), Article 206. — CMA-ES for locomotion.

9. **Salimans, T., et al. (2017)**. "Evolution Strategies as a Scalable Alternative to Reinforcement Learning." *arXiv:1703.03864*. — ES vs RL on locomotion.

10. **Ha, D. (2019)**. "Reinforcement Learning for Improving Agent Design." *Artificial Life*, 25(4), 352-365. — Co-optimizing morphology and control.

11. **Cheney, N., et al. (2014)**. "Unshackling Evolution." *GECCO '14*, pp. 167-174. — Indirect encodings for soft robots.

12. **Spector, L. (2012)**. "Assessment of Problem Modality by Differential Performance of Lexicase Selection in Genetic Programming." *GECCO '12 Companion*, pp. 401-408. — Lexicase selection.

13. **Holland, J. H. (1975)**. *Adaptation in Natural and Artificial Systems*. U of Michigan Press. — Schema Theorem, Building Block Hypothesis.

14. **Jones, T., & Forrest, S. (1995)**. "Fitness Distance Correlation as a Measure of Problem Difficulty for Genetic Algorithms." *ICGA '95*, pp. 184-192. — Fitness landscape analysis.

### Additional (search for 2-3 more from 2020-2025):
- "quality-diversity evolutionary robotics 2024"
- "CPG neural network locomotion optimization"
- "neuroevolution bipedal walking"

---

## EDGE CASES (Complete List)

### Physics / Creature / Sensor Edge Cases

| # | Edge Case | How to Handle |
|---|-----------|---------------|
| 1 | Creature spawns underground | Set y = ground_height + torso_height + 50 |
| 2 | Joint angle exceeds limits | RotaryLimitJoint with hard limits. Clamp motor target. |
| 3 | Velocity explosion | Clamp all body velocities to ±1000 px/s |
| 4 | Creature flies off screen | Terminate early, return current distance |
| 5 | Creature falls through ground | Small timestep (1/60). Collision handler logging. |
| 6 | Self-collision | ShapeFilter same group |
| 7 | All-zero chromosome | Creature stands still. fitness ≈ 0. Valid. |
| 8 | All-one chromosome | May spasm. Velocity clamping prevents explosion. |
| 9 | NaN from physics | Check isnan(). Return PENALTY_FITNESS. |
| 10 | Simulation too slow | Timeout at 2x expected time. |
| 11 | Sensor returns NaN | Replace with 0.0. Log warning. |
| 12 | No foot contact entire sim | foot_contact stays 0.0. Valid (creature airborne/dragging). |
| 13 | Morphology genes produce degenerate creature | Min limb length 10px. Min torso 20x8. |
| 14 | NN weights produce NaN | Clamp NN output to [-1, 1]. Use tanh (bounded). |
| 15 | GRF recording overflow | Cap at 10000 N. Clamp. |

### GA / Algorithm Edge Cases

| # | Edge Case | How to Handle |
|---|-----------|---------------|
| 16 | All creatures zero fitness | Roulette: add epsilon=1e-6 |
| 17 | All identical fitness | Rank: break ties randomly |
| 18 | All negative fitness | Shift by min + epsilon |
| 19 | Population fully converged | Log warning. Diversity metric → 0. |
| 20 | Identical parents crossover | Valid. Mutation adds variation. |
| 21 | Elitism > population | Cap at N-2 |
| 22 | Odd pop size with 2-child crossover | Truncate to N |
| 23 | Adaptive mutation hits zero | Floor at p_min=0.01 |
| 24 | Crossover at boundary | k from {1,...,n-1} exclusively |
| 25 | Mutation outside [0,1] | Clamp |
| 26 | Self-adaptive mutation rate explodes | Clamp decoded rate to [0.001, 0.3] |
| 27 | Lexicase: all candidates tie on all cases | Random selection. Valid. |
| 28 | Novelty archive grows unbounded | Cap at 10000 entries. Remove oldest. |
| 29 | MAP-Elites: behavior outside grid bounds | Clamp to grid edges |
| 30 | NSGA-II: all individuals non-dominated | All in front 0. Use crowding distance. |
| 31 | Co-evolution: terrain kills all walkers | Terrain fitness = max possible. Valid. |
| 32 | Operator adaptation: one operator probability → 0 | p_min = 0.05 floor |

### Experiment Edge Cases

| # | Edge Case | How to Handle |
|---|-----------|---------------|
| 33 | Run crashes mid-experiment | Catch, log, record None, continue |
| 34 | Checkpoint corrupted | Try backup. If no backup, start fresh. |
| 35 | All 30 runs crash | Log critical. Skip in analysis. |
| 36 | <30 successful runs | Use available data. Note count. |
| 37 | std = 0 across all runs | Skip Wilcoxon. Note in report. |
| 38 | Transfer test terrain missing | Use default flat. Log warning. |
| 39 | Convergence never reached | Report max_generations as convergence point. |

### Landscape Analysis Edge Cases

| # | Edge Case | How to Handle |
|---|-----------|---------------|
| 40 | FDC: all samples have same fitness | FDC undefined. Report as "flat landscape". |
| 41 | Autocorrelation: walk escapes [0,1]^n | Clamp each step to bounds |
| 42 | Epistasis: evaluation at mutated point fails | Return 0 epistasis for that pair |
| 43 | Schema: no gene shared by >70% of top | Report "no strong schemas found" |
| 44 | UMAP: too few samples for embedding | Fall back to PCA |

### Report / Web Edge Cases

| # | Edge Case | How to Handle |
|---|-----------|---------------|
| 45 | Unicode subscripts in reportlab | Use <sub>/<super> tags ONLY |
| 46 | Figure file missing | Placeholder text in PDF |
| 47 | Table data has NaN | Replace with "N/A" |
| 48 | Report exceeds 35 pages | Reduce figure sizes, move to appendix |
| 49 | Web worker OOM with CPG+NN | Reduce population to 50 in web |
| 50 | NN forward pass too slow in browser | Use typed arrays, avoid allocation |

---

## DEPENDENCIES

### Python (requirements.txt)
```
pymunk>=6.6.0
numpy>=1.24.0
matplotlib>=3.7.0
scipy>=1.10.0
reportlab>=4.0.0
Pillow>=9.5.0
tqdm>=4.65.0
scikit-learn>=1.3.0     # for UMAP, k-means, PCA
umap-learn>=0.5.0       # for UMAP dimensionality reduction
```

### Web (package.json — existing, no new deps needed except maybe)
```
three.js (optional, for 3D fitness landscape viewer)
```

---

## BUILD & RUN

```bash
# Install
pip install -r requirements.txt

# Validate
python main.py --validate

# Run experiments by priority
python main.py --priority p0
python main.py --priority p1
python main.py --priority p2
python main.py --priority p3
python main.py --priority all

# Transfer testing
python experiments/transfer_test.py

# Convergence budget analysis
python experiments/convergence_budget.py

# Landscape analysis
python -m src.analysis.landscape

# Full analysis + visualization
python experiments/analyze_results.py
python generate_all_figures.py

# Generate report
python report/generate_report.py

# Full pipeline
python main.py --full-pipeline
```

---

## KEY SUCCESS CRITERIA

### Phase 1 ✓
- [ ] Creatures simulate with sensor vector output
- [ ] Ground contact detection works
- [ ] GRF recording works
- [ ] Morphology parameters change creature dimensions

### Phase 2 ✓
- [ ] All three controller tiers produce walking (fitness > 0)
- [ ] CPG shows phase locking
- [ ] CPG+NN responds to sensor input

### Phase 3 ✓
- [ ] Standard GA: fitness increases over generations
- [ ] Novelty search: behavioral diversity stays high
- [ ] MAP-Elites: grid fills progressively
- [ ] NSGA-II: Pareto front emerges
- [ ] Lexicase selection works
- [ ] Self-adaptive mutation rate converges

### Phase 4 ✓
- [ ] Morphology genes change creature shape
- [ ] Evolution discovers varied body plans

### Phase 5 ✓
- [ ] All P0 experiments complete (30 runs each)
- [ ] Transfer testing matrix populated
- [ ] Convergence budget computed

### Phase 6 ✓
- [ ] Fitness landscape analysis (FDC, autocorrelation, neutrality)
- [ ] Epistasis matrix shows structure
- [ ] Behavioral clustering finds ≥3 gait families
- [ ] All 29 visualization types generated
- [ ] CoT computed and compared to biological values

### Phase 7 ✓
- [ ] PDF report 25-35 pages, complete
- [ ] Web app: Lab, Results, Hall of Fame, Learn pages functional
- [ ] MAP-Elites Explorer on web
- [ ] No NaN in any table, no black boxes in PDF
