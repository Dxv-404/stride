/**
 * Genetic Algorithm engine -- selection, crossover, mutation, elitism.
 *
 * Ported from Python ga_core.py.
 *
 * Operates on number[] chromosomes (genes in [0, 1]).
 * NO p2.js dependency, NO numpy -- uses plain arrays and seeded PRNG.
 *
 * Supports:
 *   - Tournament, roulette, and rank selection
 *   - Single-point, two-point, and uniform crossover
 *   - Gaussian mutation with clamping to [0, 1]
 *   - Adaptive mutation rate decay
 *   - Elitism (preserve top E%)
 *   - Fitness sharing (niching)
 *   - Diversity measurement
 *
 * Tracks mutation and crossover events for the mutation map visualization.
 */

import type {
  MutationEvent,
  CreatureRecord,
  FitnessBreakdown,
  CreatureFrame,
  GenerationSnapshot,
} from './types.ts'
import { mulberry32, gaussianRandom, DEFAULT_SIGMA_SHARE } from './config.ts'

/* ─── Types ─── */

export type SelectionMethod = 'tournament' | 'roulette' | 'rank'

export interface GAConfig {
  populationSize: number
  geneCount: number
  mutationRate: number
  crossoverRate: number
  elitismRate: number
  selectionMethod: SelectionMethod
  maxGenerations: number
  /** Tournament size (default 3) */
  tournamentK?: number
  /** Rank selection pressure parameter (default 1.5) */
  rankS?: number
  /** Sigma share for fitness sharing (0 to disable) */
  sigmaShare?: number
  /** Enable adaptive mutation rate decay */
  adaptiveMutation?: boolean
}

export interface Individual {
  genes: number[]
  fitness: number
  fitnessBreakdown: FitnessBreakdown
  walkFrames: CreatureFrame[]
  id: number
  parentIds: [number, number] | null
  crossoverPoints: number[]
  mutations: MutationEvent[]
}

/* ─── GA Engine ─── */

export class GeneticAlgorithm {
  config: GAConfig
  population: Individual[] = []
  generation = 0
  private rng: () => number
  private nextId = 0

  constructor(config: GAConfig, seed: number = 42) {
    this.config = config
    this.rng = mulberry32(seed)
  }

  /* ─── Population initialization ─── */

  /**
   * Create the initial random population (generation 0).
   * Genes are uniformly sampled in [0, 1].
   */
  initializePopulation(): void {
    this.population = []
    this.generation = 0
    for (let i = 0; i < this.config.populationSize; i++) {
      const genes: number[] = []
      for (let g = 0; g < this.config.geneCount; g++) {
        genes.push(this.rng())
      }
      this.population.push({
        genes,
        fitness: 0,
        fitnessBreakdown: { total: 0, distance: 0, energy: 0, falls: 0, uprightness: 0 },
        walkFrames: [],
        id: this.nextId++,
        parentIds: null,
        crossoverPoints: [],
        mutations: [],
      })
    }
  }

  /**
   * Assign fitness values to the current population.
   * Called by the worker after simulating all individuals.
   */
  assignFitness(
    results: Array<{
      fitness: FitnessBreakdown
      frames: CreatureFrame[]
    }>,
  ): void {
    for (let i = 0; i < this.population.length; i++) {
      this.population[i].fitness = results[i].fitness.total
      this.population[i].fitnessBreakdown = results[i].fitness
      this.population[i].walkFrames = results[i].frames
    }
  }

  /* ─── Selection ─── */

  /**
   * Select one individual from the population using the configured method.
   */
  private select(): Individual {
    switch (this.config.selectionMethod) {
      case 'tournament':
        return this.tournamentSelect()
      case 'roulette':
        return this.rouletteSelect()
      case 'rank':
        return this.rankSelect()
      default:
        return this.tournamentSelect()
    }
  }

  /**
   * Tournament selection: pick k random individuals, return the best.
   */
  private tournamentSelect(): Individual {
    const k = this.config.tournamentK ?? 3
    let best: Individual | null = null
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(this.rng() * this.population.length)
      const candidate = this.population[idx]
      if (best === null || candidate.fitness > best.fitness) {
        best = candidate
      }
    }
    return best!
  }

  /**
   * Roulette wheel selection with shift (handle negative fitness).
   */
  private rouletteSelect(): Individual {
    const minFitness = Math.min(...this.population.map((ind) => ind.fitness))
    const shift = minFitness < 0 ? -minFitness + 1 : 0

    const totalFitness = this.population.reduce(
      (sum, ind) => sum + ind.fitness + shift,
      0,
    )

    if (totalFitness <= 0) {
      // Fallback to random if all fitness is zero
      return this.population[Math.floor(this.rng() * this.population.length)]
    }

    let spin = this.rng() * totalFitness
    for (const ind of this.population) {
      spin -= ind.fitness + shift
      if (spin <= 0) return ind
    }

    return this.population[this.population.length - 1]
  }

  /**
   * Rank-based selection (linear ranking with parameter s).
   * P(rank_i) = (2 - s) / N + 2 * (rank_i - 1) * (s - 1) / (N * (N - 1))
   * where rank 1 = worst, rank N = best.
   */
  private rankSelect(): Individual {
    const s = this.config.rankS ?? 1.5
    const n = this.population.length

    // Sort ascending by fitness (rank 1 = worst)
    const sorted = [...this.population].sort((a, b) => a.fitness - b.fitness)

    // Compute cumulative probabilities
    const probs: number[] = []
    let cumulative = 0
    for (let i = 0; i < n; i++) {
      const rank = i + 1 // 1-indexed, 1=worst, n=best
      const prob = (2 - s) / n + (2 * (rank - 1) * (s - 1)) / (n * (n - 1))
      cumulative += prob
      probs.push(cumulative)
    }

    const spin = this.rng() * cumulative
    for (let i = 0; i < n; i++) {
      if (spin <= probs[i]) return sorted[i]
    }

    return sorted[n - 1]
  }

  /* ─── Crossover ─── */

  /**
   * Perform crossover on two parent gene arrays.
   * Returns two children and the crossover point indices.
   */
  private crossover(
    parent1: number[],
    parent2: number[],
  ): { child1: number[]; child2: number[]; points: number[] } {
    const len = parent1.length

    if (this.rng() > this.config.crossoverRate) {
      // No crossover -- children are copies of parents
      return {
        child1: [...parent1],
        child2: [...parent2],
        points: [],
      }
    }

    // Use two-point crossover by default
    let p1 = Math.floor(this.rng() * len)
    let p2x = Math.floor(this.rng() * len)
    if (p1 > p2x) {
      const tmp = p1
      p1 = p2x
      p2x = tmp
    }
    if (p1 === p2x) {
      // Degenerate to single-point
      p2x = len
    }

    const child1 = [...parent1]
    const child2 = [...parent2]

    for (let i = p1; i < p2x; i++) {
      child1[i] = parent2[i]
      child2[i] = parent1[i]
    }

    const points = p2x < len ? [p1, p2x] : [p1]
    return { child1, child2, points }
  }

  /* ─── Mutation ─── */

  /**
   * Mutate a gene array in place using Gaussian perturbation.
   * Returns the list of mutation events.
   *
   * @param genes         The chromosome to mutate (modified in place)
   * @param mutationRate  Current mutation rate per gene
   */
  private mutate(genes: number[], mutationRate: number): MutationEvent[] {
    const events: MutationEvent[] = []

    for (let i = 0; i < genes.length; i++) {
      if (this.rng() < mutationRate) {
        const oldValue = genes[i]
        const perturbation = gaussianRandom(this.rng) * 0.1 // sigma = 0.1
        let newValue = oldValue + perturbation
        // Clamp to [0, 1]
        newValue = Math.max(0, Math.min(1, newValue))
        genes[i] = newValue
        events.push({ geneIndex: i, oldValue, newValue })
      }
    }

    return events
  }

  /* ─── Adaptive mutation rate ─── */

  /**
   * Compute the mutation rate for the current generation.
   * p_m(g) = max(p_min, p_m0 * (1 - g / G))
   */
  getCurrentMutationRate(): number {
    if (!this.config.adaptiveMutation) return this.config.mutationRate

    const pMin = 0.005
    const decay = 1 - this.generation / this.config.maxGenerations
    return Math.max(pMin, this.config.mutationRate * decay)
  }

  /* ─── Elitism ─── */

  /**
   * Get the top E% individuals to preserve unchanged.
   */
  private getElites(): Individual[] {
    const eliteCount = Math.max(
      1,
      Math.floor(this.config.populationSize * this.config.elitismRate),
    )
    const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness)
    return sorted.slice(0, eliteCount)
  }

  /* ─── Fitness sharing ─── */

  /**
   * Apply fitness sharing (niching) to reduce crowding.
   * Shared fitness = fitness / niche_count
   */
  applyFitnessSharing(): void {
    const sigma = this.config.sigmaShare ?? DEFAULT_SIGMA_SHARE
    if (sigma <= 0) return

    for (let i = 0; i < this.population.length; i++) {
      let nicheCount = 0
      for (let j = 0; j < this.population.length; j++) {
        const dist = this.euclideanDistance(
          this.population[i].genes,
          this.population[j].genes,
        )
        if (dist < sigma) {
          nicheCount += 1 - (dist / sigma)
        }
      }
      if (nicheCount > 0) {
        this.population[i].fitness /= nicheCount
      }
    }
  }

  /* ─── Diversity ─── */

  /**
   * Compute population diversity as the average Euclidean distance
   * from each individual to the population centroid.
   */
  computeDiversity(): number {
    if (this.population.length === 0) return 0

    const geneCount = this.config.geneCount
    const centroid = new Array<number>(geneCount).fill(0)

    for (const ind of this.population) {
      for (let g = 0; g < geneCount; g++) {
        centroid[g] += ind.genes[g]
      }
    }
    for (let g = 0; g < geneCount; g++) {
      centroid[g] /= this.population.length
    }

    let totalDist = 0
    for (const ind of this.population) {
      totalDist += this.euclideanDistance(ind.genes, centroid)
    }

    return totalDist / this.population.length
  }

  /**
   * Euclidean distance between two gene vectors.
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - (b[i] ?? 0)
      sum += d * d
    }
    return Math.sqrt(sum)
  }

  /* ─── Create next generation ─── */

  /**
   * Evolve the population by one generation.
   *
   * Steps:
   *   1. Preserve elites
   *   2. Select parents and produce offspring via crossover
   *   3. Mutate offspring
   *   4. Replace population
   *
   * IMPORTANT: This only creates the new gene arrays.
   * The caller must still evaluate fitness (simulate) for each new individual
   * and call assignFitness() before the next call to evolve().
   *
   * @returns The new population (with fitness = 0, walkFrames = [])
   */
  evolve(): Individual[] {
    const mutationRate = this.getCurrentMutationRate()
    const elites = this.getElites()
    const newPopulation: Individual[] = []

    // 1. Add elites (preserve unchanged, with new IDs)
    for (const elite of elites) {
      newPopulation.push({
        genes: [...elite.genes],
        fitness: 0,
        fitnessBreakdown: { total: 0, distance: 0, energy: 0, falls: 0, uprightness: 0 },
        walkFrames: [],
        id: this.nextId++,
        parentIds: null, // Elites don't have "parents" in the crossover sense
        crossoverPoints: [],
        mutations: [],
      })
    }

    // 2. Fill rest via selection + crossover + mutation
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.select()
      const parent2 = this.select()

      const { child1, child2, points } = this.crossover(
        parent1.genes,
        parent2.genes,
      )

      // Mutate
      const mutations1 = this.mutate(child1, mutationRate)
      const mutations2 = this.mutate(child2, mutationRate)

      // Add first child
      if (newPopulation.length < this.config.populationSize) {
        newPopulation.push({
          genes: child1,
          fitness: 0,
          fitnessBreakdown: { total: 0, distance: 0, energy: 0, falls: 0, uprightness: 0 },
          walkFrames: [],
          id: this.nextId++,
          parentIds: [parent1.id, parent2.id],
          crossoverPoints: points,
          mutations: mutations1,
        })
      }

      // Add second child
      if (newPopulation.length < this.config.populationSize) {
        newPopulation.push({
          genes: child2,
          fitness: 0,
          fitnessBreakdown: { total: 0, distance: 0, energy: 0, falls: 0, uprightness: 0 },
          walkFrames: [],
          id: this.nextId++,
          parentIds: [parent2.id, parent1.id],
          crossoverPoints: points,
          mutations: mutations2,
        })
      }
    }

    this.generation++
    this.population = newPopulation
    return newPopulation
  }

  /* ─── Snapshot ─── */

  /**
   * Create a GenerationSnapshot from the current population state.
   */
  createSnapshot(): GenerationSnapshot {
    const fitnesses = this.population.map((ind) => ind.fitness)
    const bestIdx = fitnesses.indexOf(Math.max(...fitnesses))
    const diversity = this.computeDiversity()

    const populationRecords: CreatureRecord[] = this.population.map((ind) => ({
      id: ind.id,
      genes: [...ind.genes],
      fitness: ind.fitness,
      fitnessBreakdown: { ...ind.fitnessBreakdown },
      parentIds: ind.parentIds,
      crossoverPoints: [...ind.crossoverPoints],
      mutations: [...ind.mutations],
      walkFrames: ind.walkFrames,
    }))

    return {
      generation: this.generation,
      population: populationRecords,
      stats: {
        bestFitness: Math.max(...fitnesses),
        avgFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
        worstFitness: Math.min(...fitnesses),
        diversity,
        bestCreatureId: this.population[bestIdx].id,
      },
    }
  }
}
