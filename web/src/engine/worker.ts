/**
 * Web Worker entry point for the STRIDE evolution engine.
 *
 * Receives commands from the main thread via postMessage and runs the
 * GA loop, posting GenerationSnapshot messages after each generation.
 *
 * Commands handled:
 *   - start:           Begin evolution with given SimParams and optional seed
 *   - pause:           Pause after the current generation completes
 *   - resume:          Resume a paused evolution
 *   - reset:           Stop and discard all state
 *   - evaluate-single: Run one creature through physics, return frames + fitness
 *
 * Vite bundles this as an ES module worker (worker.format = 'es' in vite.config).
 */

import { GeneticAlgorithm } from './ga.ts'
import type { GAConfig } from './ga.ts'
import { createTerrain } from './terrain.ts'
import type { Terrain } from './terrain.ts'
import { decodeChromosome, getGeneCount } from './encoding.ts'
import { runSimulation } from './physics.ts'
import { computeFitness } from './fitness.ts'
import { GenerationHistory } from './history.ts'
import type {
  WorkerCommand,
  WorkerMessage,
  FitnessBreakdown,
  CreatureFrame,
} from './types.ts'

/* ─── Worker state ─── */

let ga: GeneticAlgorithm | null = null
let terrain: Terrain | null = null
let history: GenerationHistory | null = null
let encoding: 'direct' | 'indirect' = 'direct'
let maxGenerations = 75
let paused = false
let running = false
let stepMode = false
let initialized = false  // true once gen 0 has been evaluated and posted

/* ─── Helpers ─── */

function post(msg: WorkerMessage): void {
  self.postMessage(msg)
}

function postError(message: string): void {
  post({ type: 'error', message })
}

/**
 * Evaluate all individuals in the current population.
 * Runs physics simulation and fitness computation for each.
 */
function evaluatePopulation(): void {
  if (!ga || !terrain) return

  const results: Array<{ fitness: FitnessBreakdown; frames: CreatureFrame[] }> = []

  for (const individual of ga.population) {
    try {
      const jointParams = decodeChromosome(individual.genes, encoding)
      const simResult = runSimulation(terrain, jointParams)
      const fitness = computeFitness(simResult, jointParams)
      results.push({ fitness, frames: simResult.frames })
    } catch {
      // If simulation crashes for this individual, assign penalty fitness
      results.push({
        fitness: { total: -1000, distance: 0, energy: 0, falls: 0, uprightness: 0 },
        frames: [],
      })
    }
  }

  ga.assignFitness(results)
}

/**
 * Run the main evolution loop.
 * Yields control between generations to check for pause/reset commands.
 */
async function runEvolutionLoop(): Promise<void> {
  if (!ga || !terrain || !history || running) return

  running = true

  // First-time initialization: evaluate gen 0 and post snapshot
  if (!initialized) {
    evaluatePopulation()

    if (ga.config.sigmaShare && ga.config.sigmaShare > 0) {
      ga.applyFitnessSharing()
    }

    const snapshot0 = ga.createSnapshot()
    history.add(snapshot0)
    post({ type: 'generation-complete', snapshot: snapshot0 })
    initialized = true

    // Step mode: auto-pause after gen 0
    if (stepMode) {
      stepMode = false
      paused = true
      running = false
      post({ type: 'step-paused', generation: ga.generation })
      return
    }
  }

  // Evolution loop (resumes from current ga.generation)
  while (ga.generation < maxGenerations) {
    // Check for pause
    if (paused) {
      running = false
      return
    }

    // Evolve one generation (selection + crossover + mutation)
    ga.evolve()

    // Evaluate new population
    evaluatePopulation()

    // Optional fitness sharing
    if (ga.config.sigmaShare && ga.config.sigmaShare > 0) {
      ga.applyFitnessSharing()
    }

    // Create and store snapshot
    const snapshot = ga.createSnapshot()
    history.add(snapshot)
    post({ type: 'generation-complete', snapshot })

    // Step mode: auto-pause after completing one generation
    if (stepMode) {
      stepMode = false
      paused = true
      running = false
      post({ type: 'step-paused', generation: ga.generation })
      return
    }

    // Yield to the event loop so pause/reset messages can be processed
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  running = false
  post({ type: 'evolution-complete', totalGenerations: ga.generation })
}

/* ─── Command handler ─── */

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const cmd = e.data

  switch (cmd.type) {
    case 'start': {
      const params = cmd.params
      const seed = cmd.seed ?? 42

      encoding = params.encoding
      maxGenerations = params.maxGenerations

      // Create terrain
      terrain = createTerrain(params.terrainType)

      // Configure GA
      const geneCount = getGeneCount(encoding)
      const gaConfig: GAConfig = {
        populationSize: params.populationSize,
        geneCount,
        mutationRate: params.mutationRate,
        crossoverRate: params.crossoverRate,
        elitismRate: params.elitismRate,
        selectionMethod: params.selectionMethod,
        maxGenerations: params.maxGenerations,
        tournamentK: 3,
        rankS: 1.5,
        sigmaShare: 0, // Disabled by default for performance
        adaptiveMutation: true,
      }

      ga = new GeneticAlgorithm(gaConfig, seed)
      ga.initializePopulation()
      history = new GenerationHistory()
      paused = false
      initialized = false

      // Start the evolution loop (async)
      runEvolutionLoop().catch((err) => {
        postError(`Evolution loop error: ${err instanceof Error ? err.message : String(err)}`)
      })
      break
    }

    case 'pause': {
      paused = true
      break
    }

    case 'resume': {
      if (ga && terrain && history && paused) {
        paused = false
        runEvolutionLoop().catch((err) => {
          postError(`Resume error: ${err instanceof Error ? err.message : String(err)}`)
        })
      }
      break
    }

    case 'step': {
      // Step = "run exactly one more generation, then auto-pause"
      stepMode = true
      if (ga && terrain && history && paused) {
        paused = false
        runEvolutionLoop().catch((err) => {
          postError(`Step error: ${err instanceof Error ? err.message : String(err)}`)
        })
      }
      break
    }

    case 'reset': {
      paused = true
      running = false
      stepMode = false
      initialized = false
      ga = null
      terrain = null
      history = null
      break
    }

    case 'evaluate-single': {
      try {
        const singleTerrain = terrain ?? createTerrain('flat')
        const jointParams = decodeChromosome(cmd.genes, encoding)
        const simResult = runSimulation(singleTerrain, jointParams)
        const fitness = computeFitness(simResult, jointParams)
        post({
          type: 'single-evaluation',
          walkFrames: simResult.frames,
          fitness,
        })
      } catch (err) {
        postError(
          `Single evaluation error: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      break
    }

    default:
      postError(`Unknown command: ${(cmd as { type: string }).type}`)
  }
}
