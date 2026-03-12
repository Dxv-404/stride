"""Competitive algorithm baselines: DE, PSO, CMA-ES.

Each algorithm follows the same interface as run_ga():
  - Takes config dict and seed
  - Returns result dict with best_fitness, best_chromosome, convergence_history
  - Uses the SAME evaluation budget: pop_size * max_generations fitness evals

Algorithms:
  1. DE/rand/1/bin — Differential Evolution (Storn & Price, 1997)
  2. PSO — Particle Swarm Optimization (Kennedy & Eberhart, 1995)
  3. CMA-ES — Covariance Matrix Adaptation (Hansen & Ostermeier, 2001)
"""

import math
import random
import logging

import numpy as np

from src.encoding import get_gene_count
from src.utils import safe_simulate
from src.ga_core import compute_diversity

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Differential Evolution (DE/rand/1/bin)
# ---------------------------------------------------------------------------

def run_de(config, seed):
    """Differential Evolution with rand/1/bin strategy.

    Creates trial vectors through vector difference mutation and
    binomial crossover, keeping whichever is fitter.

    Hyperparameters:
        F  = 0.8  (mutation scale factor)
        CR = 0.9  (crossover probability)
    """
    np.random.seed(seed)
    random.seed(seed)

    n_genes = get_gene_count(config["encoding"])
    pop_size = config["population_size"]
    max_gen = config["max_generations"]
    terrain = config["terrain"]
    F = 0.8    # mutation scale factor — controls exploration
    CR = 0.9   # crossover probability — fraction of genes from mutant

    # --- Initialize population uniformly in [0, 1]^n ---
    population = [np.random.uniform(0, 1, n_genes) for _ in range(pop_size)]
    fitnesses = [safe_simulate(ind, terrain, config) for ind in population]

    # Tracking
    convergence = []
    avg_convergence = []
    diversity_history = []
    all_best_per_gen = []

    global_best_idx = int(np.argmax(fitnesses))
    global_best_fitness = fitnesses[global_best_idx]
    global_best_chromo = population[global_best_idx].copy()

    for gen in range(max_gen):
        # Record stats before this generation's evolution
        best_idx = int(np.argmax(fitnesses))
        convergence.append(max(fitnesses[best_idx], global_best_fitness))
        avg_convergence.append(sum(fitnesses) / len(fitnesses))
        diversity_history.append(compute_diversity(population))
        all_best_per_gen.append(population[best_idx].copy())

        if fitnesses[best_idx] > global_best_fitness:
            global_best_fitness = fitnesses[best_idx]
            global_best_chromo = population[best_idx].copy()

        # --- DE/rand/1/bin: for each target vector, create trial ---
        new_pop = []
        new_fit = []
        for i in range(pop_size):
            # Select 3 distinct random individuals (not i)
            candidates = list(range(pop_size))
            candidates.remove(i)
            r1, r2, r3 = random.sample(candidates, 3)

            # Mutation: v = x_r1 + F * (x_r2 - x_r3)
            v = population[r1] + F * (population[r2] - population[r3])
            v = np.clip(v, 0, 1)

            # Binomial crossover
            trial = population[i].copy()
            j_rand = random.randint(0, n_genes - 1)
            for j in range(n_genes):
                if random.random() < CR or j == j_rand:
                    trial[j] = v[j]

            # Greedy selection: keep the better of target vs trial
            trial_fitness = safe_simulate(trial, terrain, config)
            if trial_fitness >= fitnesses[i]:
                new_pop.append(trial)
                new_fit.append(trial_fitness)
            else:
                new_pop.append(population[i])
                new_fit.append(fitnesses[i])

        population = new_pop
        fitnesses = new_fit

    # Final best update
    best_idx = int(np.argmax(fitnesses))
    if fitnesses[best_idx] > global_best_fitness:
        global_best_fitness = fitnesses[best_idx]
        global_best_chromo = population[best_idx].copy()

    return {
        "best_fitness": global_best_fitness,
        "best_chromosome": global_best_chromo,
        "convergence_history": convergence,
        "best_fitness_per_gen": convergence,
        "avg_fitness_per_gen": avg_convergence,
        "diversity_per_gen": diversity_history,
        "all_best_per_gen": all_best_per_gen,
        "final_population": population,
        "final_fitnesses": fitnesses,
    }


# ---------------------------------------------------------------------------
# 2. Particle Swarm Optimization (PSO)
# ---------------------------------------------------------------------------

def run_pso(config, seed):
    """Standard PSO with linearly decreasing inertia weight.

    Each particle tracks its personal best and the swarm's global best.
    The velocity update combines inertia, cognitive (personal best),
    and social (global best) components.

    Hyperparameters:
        w: 0.9 → 0.4 (inertia weight, linearly decreasing)
        c1 = 2.0  (cognitive coefficient — attraction to personal best)
        c2 = 2.0  (social coefficient — attraction to global best)
        v_max = 0.2  (max velocity per dimension)
    """
    np.random.seed(seed)
    random.seed(seed)

    n_genes = get_gene_count(config["encoding"])
    pop_size = config["population_size"]
    max_gen = config["max_generations"]
    terrain = config["terrain"]

    c1 = 2.0       # cognitive coefficient
    c2 = 2.0       # social coefficient
    w_start = 0.9   # initial inertia
    w_end = 0.4     # final inertia
    v_max = 0.2     # max velocity per dimension

    # --- Initialize swarm ---
    positions = [np.random.uniform(0, 1, n_genes) for _ in range(pop_size)]
    velocities = [np.random.uniform(-v_max, v_max, n_genes)
                  for _ in range(pop_size)]
    fitnesses = [safe_simulate(pos, terrain, config) for pos in positions]

    # Personal bests
    pbest_pos = [pos.copy() for pos in positions]
    pbest_fit = list(fitnesses)

    # Global best
    gbest_idx = int(np.argmax(fitnesses))
    gbest_pos = positions[gbest_idx].copy()
    gbest_fit = fitnesses[gbest_idx]

    # Tracking
    convergence = []
    avg_convergence = []
    diversity_history = []
    all_best_per_gen = []

    for gen in range(max_gen):
        # Record stats
        convergence.append(gbest_fit)
        avg_convergence.append(sum(fitnesses) / len(fitnesses))
        diversity_history.append(compute_diversity(positions))
        all_best_per_gen.append(gbest_pos.copy())

        # Linear inertia weight decay
        w = w_start - (w_start - w_end) * gen / max(max_gen - 1, 1)

        for i in range(pop_size):
            # Random coefficients (per-dimension)
            r1 = np.random.random(n_genes)
            r2 = np.random.random(n_genes)

            # Velocity update
            velocities[i] = (w * velocities[i]
                             + c1 * r1 * (pbest_pos[i] - positions[i])
                             + c2 * r2 * (gbest_pos - positions[i]))

            # Clamp velocity
            velocities[i] = np.clip(velocities[i], -v_max, v_max)

            # Position update
            positions[i] = positions[i] + velocities[i]
            positions[i] = np.clip(positions[i], 0, 1)

            # Evaluate new position
            fitnesses[i] = safe_simulate(positions[i], terrain, config)

            # Update personal best
            if fitnesses[i] > pbest_fit[i]:
                pbest_fit[i] = fitnesses[i]
                pbest_pos[i] = positions[i].copy()

                # Update global best
                if fitnesses[i] > gbest_fit:
                    gbest_fit = fitnesses[i]
                    gbest_pos = positions[i].copy()

    return {
        "best_fitness": gbest_fit,
        "best_chromosome": gbest_pos,
        "convergence_history": convergence,
        "best_fitness_per_gen": convergence,
        "avg_fitness_per_gen": avg_convergence,
        "diversity_per_gen": diversity_history,
        "all_best_per_gen": all_best_per_gen,
        "final_population": positions,
        "final_fitnesses": fitnesses,
    }


# ---------------------------------------------------------------------------
# 3. CMA-ES (Covariance Matrix Adaptation Evolution Strategy)
# ---------------------------------------------------------------------------

def run_cmaes(config, seed):
    """CMA-ES with rank-mu covariance update.

    A state-of-the-art black-box optimizer that adapts a full covariance
    matrix to capture the local fitness landscape. Particularly strong
    on smooth, multimodal problems.

    Key mechanisms:
      1. Samples offspring from N(mean, sigma^2 * C)
      2. Recombines the top-mu offspring (weighted mean)
      3. Adapts step-size sigma via cumulative step-size adaptation (CSA)
      4. Adapts covariance C via rank-one and rank-mu updates

    Reference: Hansen & Ostermeier (2001), Hansen (2006 tutorial)
    """
    np.random.seed(seed)
    random.seed(seed)

    n = get_gene_count(config["encoding"])
    lam = config["population_size"]       # offspring count (lambda)
    max_gen = config["max_generations"]
    terrain = config["terrain"]
    mu = lam // 2                         # parent count

    # --- Recombination weights (log-proportional, normalized) ---
    raw_weights = np.log(mu + 0.5) - np.log(np.arange(1, mu + 1))
    weights = raw_weights / raw_weights.sum()
    mu_eff = 1.0 / np.sum(weights ** 2)   # variance-effective selection mass

    # --- Step-size control parameters ---
    cs = (mu_eff + 2) / (n + mu_eff + 5)
    ds = 1 + 2 * max(0, math.sqrt((mu_eff - 1) / (n + 1)) - 1) + cs

    # --- Covariance matrix adaptation parameters ---
    cc = (4 + mu_eff / n) / (n + 4 + 2 * mu_eff / n)
    c1 = 2 / ((n + 1.3) ** 2 + mu_eff)
    cmu = min(1 - c1,
              2 * (mu_eff - 2 + 1 / mu_eff) / ((n + 2) ** 2 + mu_eff))

    # Expected ||N(0, I)||
    chi_n = math.sqrt(n) * (1 - 1 / (4 * n) + 1 / (21 * n ** 2))

    # --- Initialize CMA state ---
    mean = np.random.uniform(0.3, 0.7, n)  # start in centre of [0,1]^n
    sigma = 0.3                              # initial step size
    C = np.eye(n)                            # covariance matrix
    ps = np.zeros(n)                         # evolution path (step size)
    pc = np.zeros(n)                         # evolution path (covariance)

    # Tracking
    convergence = []
    avg_convergence = []
    diversity_history = []
    all_best_per_gen = []
    global_best_fitness = -1e9
    global_best_chromo = mean.copy()

    for gen in range(max_gen):
        # --- Eigendecomposition of C ---
        try:
            eigenvalues, B = np.linalg.eigh(C)
            eigenvalues = np.maximum(eigenvalues, 1e-20)
            D = np.sqrt(eigenvalues)
            invsqrtC = B @ np.diag(1.0 / D) @ B.T
        except np.linalg.LinAlgError:
            # Reset on singular covariance
            C = np.eye(n)
            eigenvalues = np.ones(n)
            B = np.eye(n)
            D = np.ones(n)
            invsqrtC = np.eye(n)
            logger.warning(f"CMA-ES: Covariance reset at gen {gen}")

        # --- Sample lambda offspring ---
        offspring = []
        offspring_fitness = []
        for _ in range(lam):
            z = np.random.randn(n)
            x = mean + sigma * (B @ (D * z))
            x = np.clip(x, 0, 1)  # bound to gene space

            f = safe_simulate(x, terrain, config)
            offspring.append(x)
            offspring_fitness.append(f)

        # --- Sort by fitness (descending — we maximize) ---
        sorted_idx = np.argsort(offspring_fitness)[::-1]

        # Record stats
        best_gen_fit = offspring_fitness[sorted_idx[0]]
        convergence.append(max(best_gen_fit, global_best_fitness))
        avg_convergence.append(sum(offspring_fitness) / len(offspring_fitness))
        diversity_history.append(compute_diversity(offspring))
        all_best_per_gen.append(offspring[sorted_idx[0]].copy())

        if best_gen_fit > global_best_fitness:
            global_best_fitness = best_gen_fit
            global_best_chromo = offspring[sorted_idx[0]].copy()

        # --- Recombination: weighted mean of top-mu offspring ---
        old_mean = mean.copy()
        mean = np.zeros(n)
        for i in range(mu):
            mean += weights[i] * offspring[sorted_idx[i]]

        # --- Step-size control (CSA) ---
        ps = ((1 - cs) * ps
              + math.sqrt(cs * (2 - cs) * mu_eff)
              * invsqrtC @ (mean - old_mean) / sigma)

        # Heaviside function (stall indicator)
        ps_norm = np.linalg.norm(ps)
        h_sig = int(ps_norm / math.sqrt(1 - (1 - cs) ** (2 * (gen + 1)))
                     < (1.4 + 2 / (n + 1)) * chi_n)

        # --- Covariance path update ---
        pc = ((1 - cc) * pc
              + h_sig * math.sqrt(cc * (2 - cc) * mu_eff)
              * (mean - old_mean) / sigma)

        # --- Covariance matrix update (rank-one + rank-mu) ---
        rank_one = np.outer(pc, pc)
        rank_mu_mat = np.zeros((n, n))
        for i in range(mu):
            y = (offspring[sorted_idx[i]] - old_mean) / sigma
            rank_mu_mat += weights[i] * np.outer(y, y)

        C = ((1 - c1 - cmu) * C
             + c1 * (rank_one + (1 - h_sig) * cc * (2 - cc) * C)
             + cmu * rank_mu_mat)

        # Enforce symmetry (numerical safety)
        C = (C + C.T) / 2

        # --- Step-size update ---
        sigma *= math.exp((cs / ds) * (ps_norm / chi_n - 1))
        sigma = min(sigma, 1.0)  # cap step size to prevent explosion

    return {
        "best_fitness": global_best_fitness,
        "best_chromosome": global_best_chromo,
        "convergence_history": convergence,
        "best_fitness_per_gen": convergence,
        "avg_fitness_per_gen": avg_convergence,
        "diversity_per_gen": diversity_history,
        "all_best_per_gen": all_best_per_gen,
        "final_population": offspring if offspring else [],
        "final_fitnesses": offspring_fitness if offspring_fitness else [],
    }
