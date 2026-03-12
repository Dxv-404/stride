"""All hyperparameters and experiment configurations for STRIDE."""

import math

BASELINE_CONFIG = {
    "population_size": 100,
    "max_generations": 75,
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
    "fitness_weights": {"alpha": 0.1, "beta": 0.5, "gamma": 10.0,
                        "gait_bonus_weight": 5.0, "velocity_bonus_weight": 3.0},
    "island_model": False,
    "fitness_sharing": False,
    # Creature physics
    "gravity": (0, -981),
    "max_velocity": 1000,
    "torso_width": 60,
    "torso_height": 20,
    "upper_limb_length": 30,
    "lower_limb_length": 25,
    "ground_base_height": 50,
    "spawn_margin": 7,            # small clearance above ground (was 50)
    "foot_width": 20,             # wide feet for ground stability
    "foot_height": 5,
    # Early termination
    "y_min": 0,
    "y_max": 500,
    "stuck_threshold": 0,        # 0 = disabled (was 3 px, too aggressive)
    "stuck_window": 3.0,         # seconds
    # Spring elbow params
    "elbow_stiffness": 5000,
    "elbow_damping": 70,         # reduced from 100 for less resistance
    "elbow_rest_angle": 0.0,
}

# ---------------------------------------------------------------------------
# Experiment configurations
# ---------------------------------------------------------------------------

EXPERIMENTS = {
    # --- Baseline + Random Search ---
    "baseline": {**BASELINE_CONFIG},
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
    "island_model": {**BASELINE_CONFIG, "island_model": True,
                     "num_islands": 4, "migration_interval": 20},
    "fitness_sharing": {**BASELINE_CONFIG, "fitness_sharing": True,
                        "sharing_radius": 0.3},
}

# Priority groups for experiment scheduling
PRIORITY_P0 = [
    "baseline", "random_search",
    "roulette_selection", "rank_selection",
    "mutation_low", "mutation_high", "mutation_adaptive",
    "no_elitism", "high_elitism",
]

PRIORITY_P1 = [
    "indirect_encoding",
    "hill_terrain", "mixed_terrain",
    "crossover_low", "crossover_high",
]

PRIORITY_P2 = [
    "pop_small", "pop_large",
    "island_model", "fitness_sharing",
]


# =========================================================================
# V2 — CPG and CPG+NN experiment configurations
# =========================================================================

V2_BASELINE_CONFIG = {
    **BASELINE_CONFIG,
    "controller_type": "cpg",
    "encoding": "cpg",
    # Conservative start; spec says 150 gens for larger search spaces.
    # Extend if CPG fitness < 200 by gen 10 in sanity tests.
    "max_generations": 75,
    "mutation_rate": 0.05,
    "mutation_sigma": 0.1,
    # V2 fitness weights (adds CoT and reactivity)
    "fitness_weights": {
        **BASELINE_CONFIG["fitness_weights"],
        "cot_weight": 2.0,
        "reactivity_weight": 5.0,
    },
}

V2_EXPERIMENTS = {
    # --- CPG tier (38 genes, Kuramoto coupling) ---
    # Cascade: sine baseline -> CPG.  The experiment runner must load
    # best sine chromosomes from v1 results and call
    # initialize_cpg_population() before passing to run_ga_v2().
    "cpg_baseline": {
        **V2_BASELINE_CONFIG,
        "terrain": "flat",
        "seed_from": "baseline",    # cascade: sine -> CPG
    },
    "cpg_hill": {
        **V2_BASELINE_CONFIG,
        "terrain": "hill",
        "seed_from": "baseline",
    },
    "cpg_mixed": {
        **V2_BASELINE_CONFIG,
        "terrain": "mixed",
        "seed_from": "baseline",
    },

    # --- CPG+NN tier (96 genes, closed-loop) ---
    # Cascade: CPG -> CPG+NN.  The experiment runner must load
    # best CPG chromosomes and call initialize_cpgnn_population().
    #
    # CRITICAL: All CPG+NN experiments use UNIFORM crossover (not single-point).
    # Spec stride_v3.md line 618: single-point on 96 genes usually cuts within
    # one gene group.  Uniform crossover mixes parent A's CPG genes with
    # parent B's NN genes, testing whether one parent's walking style works
    # with the other's balance reflexes.
    "cpgnn_flat": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",  # spec requires uniform for 96-gene chromosomes
        "terrain": "flat",
        "seed_from": "cpg_baseline",   # cascade: CPG -> CPG+NN
    },
    "cpgnn_mixed": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",
        "terrain": "mixed",
        "seed_from": "cpg_baseline",
    },

    # --- Control experiments ---
    "cpgnn_frozen": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",
        "terrain": "flat",
        "frozen_nn": True,              # NN genes locked at 0.5 (zero modulation)
        "seed_from": "cpg_baseline",
    },
    "cpgnn_high_mutation": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",
        "terrain": "flat",
        "seed_from": "cpg_baseline",
        "gene_group_mutation": {
            "oscillator_pm": 0.05, "oscillator_sigma": 0.08,
            "coupling_pm": 0.08, "coupling_sigma": 0.15,
            "nn_pm": 0.12, "nn_sigma": 0.20,
        },
    },
    # Risk 3A: 2x evaluation budget for 96-gene search space.
    # Spec Section 28.3: 150 pop x 200 gen = 30,000 evals (vs 7,500 baseline).
    # Gives ~312 evals/dimension instead of ~78.
    "cpgnn_2x_budget": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",
        "terrain": "flat",
        "population_size": 150,         # 50% larger population
        "max_generations": 200,         # 33% more generations → 2x total evals
        "seed_from": "cpg_baseline",
    },

    # --- Seeded vs Random Init comparison (Table 7) ---
    # NO seed_from key — starts from fully random 96-gene chromosomes.
    # Tests what happens when CPG+NN evolves from scratch without cascade
    # seeding.  Expected: much slower convergence (Risk 3 validation).
    "cpgnn_random_init": {
        **V2_BASELINE_CONFIG,
        "controller_type": "cpg_nn",
        "encoding": "cpg_nn",
        "crossover_method": "uniform",
        "terrain": "flat",
        # No seed_from — random init, no cascade seeding
    },
}

# V2 priority groups
V2_PRIORITY_P0 = [
    "cpg_baseline",
    "cpgnn_flat",
    "cpgnn_frozen",         # control experiment — must run alongside cpgnn_flat
]

V2_PRIORITY_P1 = [
    "cpg_hill", "cpg_mixed",
    "cpgnn_mixed",
    "cpgnn_2x_budget",
    "cpgnn_random_init",    # Table 7: Seeded vs Random Init comparison
]

V2_PRIORITY_P2 = [
    "cpgnn_high_mutation",
]
