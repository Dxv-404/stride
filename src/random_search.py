"""Random search baseline for comparison against GA.

Generates random chromosomes with the same total evaluation budget
(population_size * max_generations) and tracks the best-so-far
at generation-equivalent intervals.
"""

import random

import numpy as np

from src.encoding import get_gene_count
from src.utils import safe_simulate


def random_search(config, seed):
    """Run random search baseline using same evaluation budget as GA.

    Args:
        config: experiment configuration dict.
        seed: random seed for reproducibility.

    Returns:
        dict with keys:
            best_fitness: float
            best_chromosome: np.array
            convergence: list of float — best-so-far at each gen-equivalent
    """
    np.random.seed(seed)
    random.seed(seed)

    n_genes = get_gene_count(config.get("encoding", "direct"))
    total_evaluations = config["population_size"] * config["max_generations"]
    terrain = config["terrain"]
    evals_per_gen = config["population_size"]

    best_fitness = -float("inf")
    best_chromosome = None
    convergence = []

    for i in range(total_evaluations):
        chromosome = np.random.uniform(0, 1, n_genes)
        fitness = safe_simulate(chromosome, terrain, config)

        if fitness > best_fitness:
            best_fitness = fitness
            best_chromosome = chromosome.copy()

        # Record at generation-equivalent intervals
        if (i + 1) % evals_per_gen == 0:
            convergence.append(best_fitness)

    return {
        "best_fitness": best_fitness,
        "best_chromosome": best_chromosome,
        "convergence": convergence,
    }
