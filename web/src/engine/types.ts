/* ─── Core engine types shared between Worker and Main thread ─── */

/** Single joint's motor parameters */
export interface JointParams {
  amplitude: number  // [0, π/2]
  frequency: number  // [0.5, 5.0] Hz
  phase: number      // [0, 2π]
}

/** A creature's full gene set */
export interface Chromosome {
  genes: number[]  // 18 floats in [0,1] (direct) or 9 (indirect)
}

/** Position of all body parts at a single physics frame */
export interface CreatureFrame {
  torsoX: number
  torsoY: number
  torsoAngle: number
  joints: Record<string, { x: number; y: number; angle: number }>
}

/** Fitness breakdown */
export interface FitnessBreakdown {
  total: number
  distance: number
  energy: number
  falls: number
  uprightness: number
}

/** A single mutation event */
export interface MutationEvent {
  geneIndex: number
  oldValue: number
  newValue: number
}

/** Record of one creature in one generation */
export interface CreatureRecord {
  id: number
  genes: number[]
  fitness: number
  fitnessBreakdown: FitnessBreakdown
  parentIds: [number, number] | null  // null for gen 0
  crossoverPoints: number[]
  mutations: MutationEvent[]
  walkFrames: CreatureFrame[]
}

/** Full snapshot of one generation */
export interface GenerationSnapshot {
  generation: number
  population: CreatureRecord[]
  stats: {
    bestFitness: number
    avgFitness: number
    worstFitness: number
    diversity: number
    bestCreatureId: number
  }
}

/** Messages from Main thread → Worker */
export type WorkerCommand =
  | { type: 'start'; params: import('@/stores/simulationStore').SimParams; seed?: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'step' }
  | { type: 'evaluate-single'; genes: number[] }

/** Messages from Worker → Main thread */
export type WorkerMessage =
  | { type: 'generation-complete'; snapshot: GenerationSnapshot }
  | { type: 'evolution-complete'; totalGenerations: number }
  | { type: 'step-paused'; generation: number }
  | { type: 'single-evaluation'; walkFrames: CreatureFrame[]; fitness: FitnessBreakdown }
  | { type: 'error'; message: string }

/** Terrain point for custom terrains */
export interface TerrainPoint {
  x: number
  y: number
}

/** Saved terrain data */
export interface TerrainData {
  id: string
  name: string
  points: TerrainPoint[]
  type: 'custom'
  difficulty: number
}
