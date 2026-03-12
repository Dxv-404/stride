"""Core Genetic Algorithm engine for STRIDE.

Implements:
  - 3 selection methods: tournament, roulette wheel, rank-based
  - 3 crossover operators: single-point, two-point, uniform
  - 2 mutation types: fixed Gaussian, adaptive
  - Elitism with deep copy
  - Island model with ring-topology migration
  - Fitness sharing / niching
  - Main GA loop with per-generation statistics

V2 additions:
  - run_ga_v2(): evolution loop for CPG/CPG+NN with cascade seeding
  - cpgnn_mutation(): gene-group-specific mutation rates
  - Frozen gene support for control experiments
"""

import copy
import math
import os
import random
import logging
from concurrent.futures import ProcessPoolExecutor

import numpy as np

from src.encoding import get_gene_count
from src.utils import safe_simulate

logger = logging.getLogger(__name__)

# Number of parallel workers for fitness evaluation.
# Use ~60% of cores to balance speed vs thermal throttling.
# On the i7-12650H (6P+4E cores), 6 workers uses the P-cores
# without overloading and causing thermal throttling.
_N_EVAL_WORKERS = max(1, min(6, (os.cpu_count() or 1) - 2))

# Global executor — reused across generations to avoid process spawn overhead.
_executor = None


def _eval_one_v2(chromosome, controller_type, terrain, config):
    """Evaluate a single chromosome — top-level function for ProcessPoolExecutor.

    Args:
        chromosome: numpy array of gene values.
        controller_type: "cpg" or "cpg_nn".
        terrain: str terrain type.
        config: experiment config dict.

    Returns:
        float — fitness value.
    """
    from src.utils import safe_simulate_v2
    return safe_simulate_v2(chromosome, controller_type, terrain, config)


def _parallel_evaluate_v2(population, controller_type, terrain, config,
                          n_workers=None):
    """Evaluate an entire population in parallel using ProcessPoolExecutor.

    Falls back to sequential evaluation if n_workers=1 or executor fails.

    Args:
        population: list of chromosome arrays.
        controller_type: "cpg" or "cpg_nn".
        terrain: str terrain type.
        config: experiment config dict.
        n_workers: number of parallel workers (default: _N_EVAL_WORKERS).

    Returns:
        list of fitness values, same order as population.
    """
    if n_workers is None:
        n_workers = _N_EVAL_WORKERS

    if n_workers <= 1:
        from src.utils import safe_simulate_v2
        return [safe_simulate_v2(ind, controller_type, terrain, config)
                for ind in population]

    try:
        global _executor
        if _executor is None:
            _executor = ProcessPoolExecutor(max_workers=n_workers)

        futures = [
            _executor.submit(_eval_one_v2, ind, controller_type, terrain, config)
            for ind in population
        ]
        fitnesses = [f.result() for f in futures]
        return fitnesses
    except Exception as e:
        logger.warning(f"Parallel eval failed ({e}), falling back to sequential")
        from src.utils import safe_simulate_v2
        return [safe_simulate_v2(ind, controller_type, terrain, config)
                for ind in population]


# ---------------------------------------------------------------------------
# Selection
# ---------------------------------------------------------------------------

def tournament_selection(population, fitnesses, k=3):
    """Select one individual via tournament of size k.

    Picks k random individuals, returns the one with highest fitness.
    """
    n = len(population)
    k = min(k, n)  # Edge case #38: island smaller than tournament size
    indices = random.sample(range(n), k)
    best_idx = max(indices, key=lambda i: fitnesses[i])
    return population[best_idx].copy()


def _tournament_select_idx(fitnesses, k=3):
    """Tournament selection returning the chosen INDEX (not a copy)."""
    n = len(fitnesses)
    k = min(k, n)
    indices = random.sample(range(n), k)
    return max(indices, key=lambda i: fitnesses[i])


def roulette_selection(population, fitnesses):
    """Fitness-proportionate (roulette wheel) selection.

    Shifts fitnesses so all values are positive, adds epsilon for stability.
    Handles edge cases #11-13: zero, identical, and negative fitnesses.
    """
    eps = 1e-6
    f_min = min(fitnesses)
    shifted = [f - f_min + eps for f in fitnesses]
    total = sum(shifted)

    r = random.random() * total
    cumulative = 0.0
    for i, f in enumerate(shifted):
        cumulative += f
        if cumulative >= r:
            return population[i].copy()
    # Fallback (floating point edge case)
    return population[-1].copy()


def _roulette_select_idx(fitnesses):
    """Roulette selection returning the chosen INDEX."""
    eps = 1e-6
    f_min = min(fitnesses)
    shifted = [f - f_min + eps for f in fitnesses]
    total = sum(shifted)

    r = random.random() * total
    cumulative = 0.0
    for i, f in enumerate(shifted):
        cumulative += f
        if cumulative >= r:
            return i
    return len(fitnesses) - 1


def rank_selection(population, fitnesses, s=1.5):
    """Rank-based selection with configurable selection pressure.

    P(rank_i) = (2-s)/N + 2*rank_i*(s-1) / (N*(N-1))
    rank: worst=1, best=N
    """
    n = len(population)
    # Sort indices by fitness ascending (worst=rank 1, best=rank N)
    sorted_indices = sorted(range(n), key=lambda i: fitnesses[i])

    # Build probability array — rank_i is 1-indexed
    probs = np.empty(n)
    for rank_pos, idx in enumerate(sorted_indices):
        rank_i = rank_pos + 1  # 1-indexed: worst=1, best=N
        probs[idx] = (2 - s) / n + 2 * rank_i * (s - 1) / (n * (n - 1))

    # Normalize (should already sum to ~1, but float safety)
    probs /= probs.sum()

    chosen = np.random.choice(n, p=probs)
    return population[chosen].copy()


def _rank_select_idx(fitnesses, s=1.5):
    """Rank selection returning the chosen INDEX."""
    n = len(fitnesses)
    sorted_indices = sorted(range(n), key=lambda i: fitnesses[i])
    probs = np.empty(n)
    for rank_pos, idx in enumerate(sorted_indices):
        rank_i = rank_pos + 1
        probs[idx] = (2 - s) / n + 2 * rank_i * (s - 1) / (n * (n - 1))
    probs /= probs.sum()
    return int(np.random.choice(n, p=probs))


def select_parents(population, fitnesses, method, config):
    """Select two parents using the specified method."""
    if method == "tournament":
        k = config.get("tournament_size", 3)
        p1 = tournament_selection(population, fitnesses, k)
        p2 = tournament_selection(population, fitnesses, k)
    elif method == "roulette":
        p1 = roulette_selection(population, fitnesses)
        p2 = roulette_selection(population, fitnesses)
    elif method == "rank":
        p1 = rank_selection(population, fitnesses)
        p2 = rank_selection(population, fitnesses)
    else:
        raise ValueError(f"Unknown selection method: {method}")
    return p1, p2


def _select_parent_indices(fitnesses, method, config):
    """Select two parent INDICES using the specified method."""
    if method == "tournament":
        k = config.get("tournament_size", 3)
        return _tournament_select_idx(fitnesses, k), \
               _tournament_select_idx(fitnesses, k)
    elif method == "roulette":
        return _roulette_select_idx(fitnesses), \
               _roulette_select_idx(fitnesses)
    elif method == "rank":
        return _rank_select_idx(fitnesses), \
               _rank_select_idx(fitnesses)
    else:
        raise ValueError(f"Unknown selection method: {method}")


# ---------------------------------------------------------------------------
# Crossover
# ---------------------------------------------------------------------------

def single_point_crossover(p1, p2):
    """Single-point crossover. Returns two children."""
    n = len(p1)
    k = random.randint(1, n - 1)  # Edge case #19: never at boundary
    c1 = np.concatenate([p1[:k], p2[k:]])
    c2 = np.concatenate([p2[:k], p1[k:]])
    return c1, c2


def two_point_crossover(p1, p2):
    """Two-point crossover. Returns two children."""
    n = len(p1)
    points = sorted(random.sample(range(1, n), 2))
    k1, k2 = points
    c1 = np.concatenate([p1[:k1], p2[k1:k2], p1[k2:]])
    c2 = np.concatenate([p2[:k1], p1[k1:k2], p2[k2:]])
    return c1, c2


def uniform_crossover(p1, p2):
    """Uniform crossover — each gene has 50% chance from either parent."""
    mask = np.random.random(len(p1)) < 0.5
    c1 = np.where(mask, p1, p2)
    c2 = np.where(mask, p2, p1)
    return c1, c2


def crossover(p1, p2, method="single_point"):
    """Apply crossover using the specified method."""
    if method == "single_point":
        return single_point_crossover(p1, p2)
    elif method == "two_point":
        return two_point_crossover(p1, p2)
    elif method == "uniform":
        return uniform_crossover(p1, p2)
    else:
        raise ValueError(f"Unknown crossover method: {method}")


# ---------------------------------------------------------------------------
# Mutation
# ---------------------------------------------------------------------------

def gaussian_mutation(chromosome, p_m, sigma=0.1):
    """Fixed Gaussian mutation. Each gene mutated with probability p_m.

    Mutated gene: gene' = clamp(gene + N(0, sigma^2), 0, 1)
    """
    mutated = chromosome.copy()
    mask = np.random.random(len(mutated)) < p_m
    noise = np.random.normal(0, sigma, len(mutated))
    mutated[mask] += noise[mask]
    np.clip(mutated, 0, 1, out=mutated)  # Edge case #20
    return mutated


def get_adaptive_mutation_rate(generation, max_generations, p_m0=0.2, p_min=0.01):
    """Compute adaptive mutation rate that decays over generations.

    p_m(g) = max(p_min, p_m0 * (1 - g/G))
    Edge case #18: floor at p_min prevents zero rate.
    """
    rate = p_m0 * (1 - generation / max_generations)
    return max(p_min, rate)


# ---------------------------------------------------------------------------
# Fitness sharing
# ---------------------------------------------------------------------------

def apply_fitness_sharing(population, fitnesses, sigma_share=0.3, alpha=1.0):
    """Apply fitness sharing to promote diversity.

    f_shared(x_i) = f(x_i) / sum_j sh(d(x_i, x_j))
    where sh(d) = 1 - (d/sigma_share)^alpha if d < sigma_share, else 0
    """
    n = len(population)
    shared = np.empty(n)

    for i in range(n):
        niche_count = 0.0
        for j in range(n):
            d = np.linalg.norm(population[i] - population[j])
            if d < sigma_share:
                niche_count += 1 - (d / sigma_share) ** alpha
            # Note: when i==j, d=0, sh=1, so niche_count >= 1 always
        shared[i] = fitnesses[i] / niche_count

    return shared.tolist()


# ---------------------------------------------------------------------------
# Diversity metric
# ---------------------------------------------------------------------------

def compute_diversity(population):
    """Average distance from each individual to the population centroid.

    D(g) = (1/N) * sum ||x_i - x_bar||
    """
    if len(population) < 2:
        return 0.0
    pop_array = np.array(population)
    centroid = pop_array.mean(axis=0)
    return np.mean(np.linalg.norm(pop_array - centroid, axis=1))


# ---------------------------------------------------------------------------
# Island model helpers
# ---------------------------------------------------------------------------

def _split_into_islands(population, fitnesses, num_islands):
    """Split population into islands. Edge case #36: uneven sizes."""
    n = len(population)
    base = n // num_islands
    extra = n % num_islands

    islands_pop = []
    islands_fit = []
    idx = 0
    for i in range(num_islands):
        size = base + (1 if i < extra else 0)
        islands_pop.append(list(population[idx:idx + size]))
        islands_fit.append(list(fitnesses[idx:idx + size]))
        idx += size

    return islands_pop, islands_fit


def _migrate(islands_pop, islands_fit, n_migrants=2):
    """Ring-topology migration: island i sends top n_migrants to island (i+1) % K.

    Migrants replace worst individuals in the receiving island.
    """
    k = len(islands_pop)
    # Collect migrants from each island
    migrants = []
    for i in range(k):
        sorted_idx = sorted(range(len(islands_pop[i])),
                            key=lambda j: islands_fit[i][j], reverse=True)
        top = [(islands_pop[i][j].copy(), islands_fit[i][j])
               for j in sorted_idx[:n_migrants]]
        migrants.append(top)

    # Send to next island (ring)
    for i in range(k):
        recv = (i + 1) % k
        # Find worst indices in receiving island
        worst_idx = sorted(range(len(islands_pop[recv])),
                           key=lambda j: islands_fit[recv][j])[:n_migrants]
        for mi, wi in enumerate(worst_idx):
            islands_pop[recv][wi] = migrants[i][mi][0]
            islands_fit[recv][wi] = migrants[i][mi][1]


# ---------------------------------------------------------------------------
# Main GA loop
# ---------------------------------------------------------------------------

def run_ga(config, seed):
    """Run a complete GA evolution and return results.

    Args:
        config: experiment configuration dict.
        seed: random seed for reproducibility.

    Returns:
        dict with keys:
            best_fitness: float — best fitness found across all generations
            best_chromosome: np.array — the best chromosome
            convergence: list of float — best fitness per generation
            avg_convergence: list of float — mean fitness per generation
            diversity: list of float — diversity per generation
            all_best_per_gen: list of np.array — best chromosome per gen
            parent_log: list — (gen, child_idx, p1_idx, p2_idx) tuples
    """
    np.random.seed(seed)
    random.seed(seed)

    n_genes = get_gene_count(config["encoding"])
    pop_size = config["population_size"]
    max_gen = config["max_generations"]
    pc = config["crossover_rate"]
    pm = config["mutation_rate"]
    sigma = config["mutation_sigma"]
    elitism_rate = config["elitism_rate"]
    selection_method = config["selection_method"]
    crossover_method = config["crossover_method"]
    terrain = config["terrain"]
    use_island = config.get("island_model", False)
    use_sharing = config.get("fitness_sharing", False)
    sharing_radius = config.get("sharing_radius", 0.3)

    # --- Initialize population ---
    population = [np.random.uniform(0, 1, n_genes) for _ in range(pop_size)]

    # --- Evaluate initial population ---
    fitnesses = [safe_simulate(ind, terrain, config) for ind in population]

    # Tracking
    convergence = []
    avg_convergence = []
    diversity_history = []
    all_best_per_gen = []
    parent_log = []

    global_best_fitness = max(fitnesses)
    global_best_chromo = population[fitnesses.index(global_best_fitness)].copy()

    # Island setup
    if use_island:
        num_islands = config.get("num_islands", 4)
        migration_interval = config.get("migration_interval", 20)

    for gen in range(max_gen):
        # --- Record stats ---
        best_fit = max(fitnesses)
        avg_fit = sum(fitnesses) / len(fitnesses)
        div = compute_diversity(population)

        convergence.append(best_fit)
        avg_convergence.append(avg_fit)
        diversity_history.append(div)
        best_idx = fitnesses.index(best_fit)
        all_best_per_gen.append(population[best_idx].copy())

        if best_fit > global_best_fitness:
            global_best_fitness = best_fit
            global_best_chromo = population[best_idx].copy()

        # --- Adaptive mutation ---
        if pm == "adaptive":
            current_pm = get_adaptive_mutation_rate(gen, max_gen)
        else:
            current_pm = pm

        # --- Fitness sharing ---
        selection_fitnesses = fitnesses
        if use_sharing:
            selection_fitnesses = apply_fitness_sharing(
                population, fitnesses, sigma_share=sharing_radius)

        # --- Island model ---
        if use_island:
            islands_pop, islands_fit = _split_into_islands(
                population, selection_fitnesses, num_islands)

            # Migrate every migration_interval generations
            if gen > 0 and gen % migration_interval == 0:
                _migrate(islands_pop, islands_fit, n_migrants=2)

            # Evolve each island independently
            new_population = []
            new_fitnesses = []
            for isle_pop, isle_fit in zip(islands_pop, islands_fit):
                isle_new = _evolve_population(
                    isle_pop, isle_fit, config, selection_method,
                    crossover_method, pc, current_pm, sigma,
                    elitism_rate, terrain, parent_log, gen)
                isle_new_fit = [safe_simulate(ind, terrain, config)
                                for ind in isle_new]
                new_population.extend(isle_new)
                new_fitnesses.extend(isle_new_fit)

            population = new_population
            fitnesses = new_fitnesses

        else:
            # Standard (non-island) evolution
            new_population = _evolve_population(
                population, selection_fitnesses, config, selection_method,
                crossover_method, pc, current_pm, sigma,
                elitism_rate, terrain, parent_log, gen)

            # Evaluate new population
            fitnesses = [safe_simulate(ind, terrain, config)
                         for ind in new_population]
            population = new_population

        # Warn if diversity collapses — edge case #14
        if div < 0.01 and gen > 10:
            logger.warning(f"Gen {gen}: diversity collapsed to {div:.4f}")

    # Final generation stats (the loop body recorded up to gen max_gen-1,
    # which is pre-evolution state of gen max_gen-1.  Now record the
    # post-evolution state of the final generation.)
    best_fit = max(fitnesses)
    best_idx = fitnesses.index(best_fit)
    if best_fit > global_best_fitness:
        global_best_fitness = best_fit
        global_best_chromo = population[best_idx].copy()

    # At this point convergence has max_gen entries (0 … max_gen-1).
    # That is exactly what we want: one entry per generation.

    return {
        # --- Scalars ---
        "best_fitness": global_best_fitness,
        "best_chromosome": global_best_chromo,
        # --- Per-generation arrays (length = max_generations) ---
        "convergence_history": convergence,      # best fitness per gen
        "best_fitness_per_gen": convergence,      # alias (same list)
        "avg_fitness_per_gen": avg_convergence,   # mean fitness per gen
        "diversity_per_gen": diversity_history,    # diversity per gen
        "all_best_per_gen": all_best_per_gen,     # best chromosome per gen
        # --- Lineage ---
        "parent_log": parent_log,  # (gen, child_idx, p1_idx, p2_idx) tuples
        # --- Final population snapshot ---
        "final_population": population,
        "final_fitnesses": fitnesses,
    }


def _evolve_population(population, fitnesses, config, selection_method,
                       crossover_method, pc, pm, sigma,
                       elitism_rate, terrain, parent_log, gen):
    """Create the next generation from the current one.

    Handles elitism, selection, crossover, mutation.
    Logs parent indices to parent_log for family tree visualization.
    """
    n = len(population)

    # --- Elitism ---
    n_elite = min(math.ceil(elitism_rate * n), n - 2)  # Edge case #16
    if n_elite > 0:
        elite_indices = sorted(range(n), key=lambda i: fitnesses[i],
                               reverse=True)[:n_elite]
        elites = [population[i].copy() for i in elite_indices]  # Deep copy
    else:
        elite_indices = []
        elites = []

    new_pop = list(elites)

    # Log elites as self-parents (survived unchanged)
    for ci, ei in enumerate(elite_indices):
        parent_log.append((gen, ci, ei, ei))

    # --- Fill rest with crossover + mutation ---
    child_idx = len(elites)
    while len(new_pop) < n:
        p1_idx, p2_idx = _select_parent_indices(
            fitnesses, selection_method, config)
        p1 = population[p1_idx].copy()
        p2 = population[p2_idx].copy()

        if random.random() < pc:
            c1, c2 = crossover(p1, p2, crossover_method)
        else:
            c1, c2 = p1.copy(), p2.copy()

        c1 = gaussian_mutation(c1, pm, sigma)
        c2 = gaussian_mutation(c2, pm, sigma)

        new_pop.append(c1)
        parent_log.append((gen, child_idx, p1_idx, p2_idx))
        child_idx += 1

        if len(new_pop) < n:  # Edge case #17: odd population size
            new_pop.append(c2)
            parent_log.append((gen, child_idx, p1_idx, p2_idx))
            child_idx += 1

    # Truncate if overshot — edge case #17
    new_pop = new_pop[:n]

    return new_pop


# =========================================================================
# V2 — Gene-group mutation and GA loop for CPG / CPG+NN
# =========================================================================

def cpgnn_mutation(chromosome, config):
    """Gene-group-specific Gaussian mutation for CPG+NN chromosomes.

    Different gene groups have different mutation rates and sigma values,
    reflecting their roles:
      - Oscillator genes (0-17): low mutation — inherited from working gaits,
        too much noise destroys the gait.
      - Coupling genes (18-37): moderate mutation — these are the new
        degrees of freedom the GA needs to explore.
      - NN genes (38-95): higher mutation — NN weights need more exploration,
        and the multiplicative modulation architecture is forgiving.

    Default rates (from spec Section 28):
      Oscillator: p_m=0.03, sigma=0.05
      Coupling:   p_m=0.05, sigma=0.10
      NN:         p_m=0.08, sigma=0.15

    Args:
        chromosome: np.ndarray of [0,1] genes (38 or 96).
        config: dict with optional "gene_group_mutation" overrides.

    Returns:
        np.ndarray — mutated chromosome (new copy).
    """
    mutated = chromosome.copy()
    n_genes = len(mutated)

    # Get mutation params from config or use defaults
    ggm = config.get("gene_group_mutation", {})

    # Define gene groups and their mutation parameters
    groups = []

    # Oscillator genes (0-17) — always present in cpg and cpg_nn
    groups.append({
        "start": 0,
        "end": min(18, n_genes),
        "p_m": ggm.get("oscillator_pm", 0.03),
        "sigma": ggm.get("oscillator_sigma", 0.05),
    })

    # Coupling genes (18-37) — present in cpg and cpg_nn
    if n_genes > 18:
        groups.append({
            "start": 18,
            "end": min(38, n_genes),
            "p_m": ggm.get("coupling_pm", 0.05),
            "sigma": ggm.get("coupling_sigma", 0.10),
        })

    # NN genes (38-95) — only present in cpg_nn
    if n_genes > 38:
        groups.append({
            "start": 38,
            "end": n_genes,
            "p_m": ggm.get("nn_pm", 0.08),
            "sigma": ggm.get("nn_sigma", 0.15),
        })

    # Apply per-group mutation
    for group in groups:
        s, e = group["start"], group["end"]
        mask = np.random.random(e - s) < group["p_m"]
        noise = np.random.normal(0, group["sigma"], e - s)
        mutated[s:e][mask] += noise[mask]

    # Clamp to [0, 1]
    np.clip(mutated, 0, 1, out=mutated)

    return mutated


def _apply_frozen_genes(child, parent, frozen_indices):
    """Restore frozen gene values after crossover/mutation.

    Args:
        child: np.ndarray — the mutated child chromosome.
        parent: np.ndarray — the original parent (pre-crossover).
        frozen_indices: list of int — gene indices to freeze.

    Returns:
        np.ndarray — child with frozen genes restored.
    """
    result = child.copy()
    for idx in frozen_indices:
        if idx < len(result) and idx < len(parent):
            result[idx] = parent[idx]
    return result


def run_ga_v2(config, seed):
    """Run v2 GA evolution for CPG/CPG+NN controllers.

    Key differences from run_ga():
      - Supports cascade seeding via config["seed_from"]
      - Uses safe_simulate_v2() for fitness evaluation
      - Uses cpgnn_mutation() for gene-group mutation (cpg_nn encoding)
      - Supports frozen genes via config["frozen_genes"]

    Args:
        config: experiment configuration dict.
        seed: random seed for reproducibility.

    Returns:
        dict with same keys as run_ga() plus v2-specific fields.
    """
    from src.utils import safe_simulate_v2

    np.random.seed(seed)
    random.seed(seed)

    n_genes = get_gene_count(config["encoding"])
    pop_size = config["population_size"]
    max_gen = config["max_generations"]
    pc = config["crossover_rate"]
    pm = config["mutation_rate"]
    sigma = config["mutation_sigma"]
    elitism_rate = config["elitism_rate"]
    selection_method = config["selection_method"]
    crossover_method = config["crossover_method"]
    terrain = config["terrain"]
    controller_type = config["controller_type"]
    encoding = config["encoding"]
    # Frozen genes: either explicitly listed, or translated from frozen_nn flag.
    # frozen_nn: True → lock NN genes (38-95) at 0.5 (zero modulation),
    # so the CPG+NN controller behaves identically to a pure CPG controller.
    # This is the control experiment that isolates NN contribution.
    frozen_genes = config.get("frozen_genes", [])
    if not frozen_genes and config.get("frozen_nn", False):
        frozen_genes = list(range(38, 96))
    use_gene_group_mutation = encoding == "cpg_nn"

    # --- Initialize population ---
    initial_pop = config.get("initial_population", None)
    if initial_pop is not None:
        # Pre-built population (e.g., from cascade seeding)
        population = [np.array(ind, dtype=np.float64) for ind in initial_pop]
        # Pad or truncate to pop_size
        while len(population) < pop_size:
            population.append(np.random.uniform(0, 1, n_genes))
        population = population[:pop_size]
    else:
        # Random initialization
        population = [np.random.uniform(0, 1, n_genes) for _ in range(pop_size)]

    # --- Evaluate initial population (parallel) ---
    n_workers = config.get("n_eval_workers", _N_EVAL_WORKERS)
    fitnesses = _parallel_evaluate_v2(
        population, controller_type, terrain, config, n_workers)

    # Tracking
    convergence = []
    avg_convergence = []
    diversity_history = []
    all_best_per_gen = []
    parent_log = []

    global_best_fitness = max(fitnesses)
    global_best_chromo = population[fitnesses.index(global_best_fitness)].copy()

    for gen in range(max_gen):
        # --- Record stats ---
        best_fit = max(fitnesses)
        avg_fit = sum(fitnesses) / len(fitnesses)
        div = compute_diversity(population)

        convergence.append(best_fit)
        avg_convergence.append(avg_fit)
        diversity_history.append(div)
        best_idx = fitnesses.index(best_fit)
        all_best_per_gen.append(population[best_idx].copy())

        if best_fit > global_best_fitness:
            global_best_fitness = best_fit
            global_best_chromo = population[best_idx].copy()

        # --- Adaptive mutation ---
        if pm == "adaptive":
            current_pm = get_adaptive_mutation_rate(gen, max_gen)
        else:
            current_pm = pm

        # --- Evolve next generation ---
        n = len(population)
        n_elite = min(math.ceil(elitism_rate * n), n - 2)

        # Elitism
        if n_elite > 0:
            elite_indices = sorted(range(n), key=lambda i: fitnesses[i],
                                   reverse=True)[:n_elite]
            elites = [population[i].copy() for i in elite_indices]
        else:
            elite_indices = []
            elites = []

        new_pop = list(elites)
        for ci, ei in enumerate(elite_indices):
            parent_log.append((gen, ci, ei, ei))

        # Fill with crossover + mutation
        child_idx = len(elites)
        while len(new_pop) < n:
            p1_idx, p2_idx = _select_parent_indices(
                fitnesses, selection_method, config)
            p1 = population[p1_idx].copy()
            p2 = population[p2_idx].copy()

            if random.random() < pc:
                c1, c2 = crossover(p1, p2, crossover_method)
            else:
                c1, c2 = p1.copy(), p2.copy()

            # Mutation
            if use_gene_group_mutation:
                c1 = cpgnn_mutation(c1, config)
                c2 = cpgnn_mutation(c2, config)
            else:
                c1 = gaussian_mutation(c1, current_pm, sigma)
                c2 = gaussian_mutation(c2, current_pm, sigma)

            # Frozen gene enforcement
            if frozen_genes:
                c1 = _apply_frozen_genes(c1, population[p1_idx], frozen_genes)
                c2 = _apply_frozen_genes(c2, population[p2_idx], frozen_genes)

            new_pop.append(c1)
            parent_log.append((gen, child_idx, p1_idx, p2_idx))
            child_idx += 1

            if len(new_pop) < n:
                new_pop.append(c2)
                parent_log.append((gen, child_idx, p1_idx, p2_idx))
                child_idx += 1

        new_pop = new_pop[:n]

        # Evaluate new population (parallel)
        fitnesses = _parallel_evaluate_v2(
            new_pop, controller_type, terrain, config, n_workers)
        population = new_pop

        # Diversity warning
        if div < 0.01 and gen > 10:
            logger.warning(f"V2 Gen {gen}: diversity collapsed to {div:.4f}")

    # Final stats
    best_fit = max(fitnesses)
    best_idx = fitnesses.index(best_fit)
    if best_fit > global_best_fitness:
        global_best_fitness = best_fit
        global_best_chromo = population[best_idx].copy()

    return {
        "best_fitness": global_best_fitness,
        "best_chromosome": global_best_chromo,
        "convergence_history": convergence,
        "best_fitness_per_gen": convergence,
        "avg_fitness_per_gen": avg_convergence,
        "diversity_per_gen": diversity_history,
        "all_best_per_gen": all_best_per_gen,
        "parent_log": parent_log,
        "final_population": population,
        "final_fitnesses": fitnesses,
        # V2-specific
        "controller_type": controller_type,
        "encoding": encoding,
    }
