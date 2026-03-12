/**
 * WorkerBridge -- main-thread helper to communicate with the evolution Web Worker.
 *
 * Wraps postMessage / onmessage in a clean callback and promise-based API.
 *
 * Usage:
 *   const bridge = new WorkerBridge()
 *   bridge.onGeneration((snapshot) => { ... })
 *   bridge.onComplete((totalGens) => { ... })
 *   bridge.onError((msg) => { ... })
 *   bridge.start(simParams, seed)
 *   bridge.pause()
 *   bridge.resume()
 *   bridge.reset()
 *   const { walkFrames, fitness } = await bridge.evaluateSingle(genes)
 *   bridge.terminate()
 */

import type {
  WorkerCommand,
  WorkerMessage,
  GenerationSnapshot,
  CreatureFrame,
  FitnessBreakdown,
} from '@/engine/types.ts'
import type { SimParams } from '@/stores/simulationStore.ts'

/* ─── Callback types ─── */

export type GenerationCallback = (snapshot: GenerationSnapshot) => void
export type CompleteCallback = (totalGenerations: number) => void
export type StepPausedCallback = (generation: number) => void
export type ErrorCallback = (message: string) => void
export type SingleEvalResult = {
  walkFrames: CreatureFrame[]
  fitness: FitnessBreakdown
}

/* ─── WorkerBridge class ─── */

export class WorkerBridge {
  private worker: Worker | null = null
  private generationCallbacks: GenerationCallback[] = []
  private completeCallbacks: CompleteCallback[] = []
  private stepPausedCallbacks: StepPausedCallback[] = []
  private errorCallbacks: ErrorCallback[] = []

  /**
   * Pending promise resolver for evaluate-single requests.
   * Only one single-evaluation can be in-flight at a time.
   */
  private singleEvalResolve: ((result: SingleEvalResult) => void) | null = null
  private singleEvalReject: ((reason: Error) => void) | null = null

  constructor() {
    this.createWorker()
  }

  /* ─── Worker lifecycle ─── */

  private createWorker(): void {
    // Vite handles the ?worker import syntax, but we use the URL constructor
    // pattern for explicit worker creation with ES module format.
    this.worker = new Worker(
      new URL('../engine/worker.ts', import.meta.url),
      { type: 'module' },
    )

    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      this.handleMessage(e.data)
    }

    this.worker.onerror = (e: ErrorEvent) => {
      const msg = e.message || 'Unknown worker error'
      for (const cb of this.errorCallbacks) {
        cb(msg)
      }
    }
  }

  private handleMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case 'generation-complete':
        for (const cb of this.generationCallbacks) {
          cb(msg.snapshot)
        }
        break

      case 'evolution-complete':
        for (const cb of this.completeCallbacks) {
          cb(msg.totalGenerations)
        }
        break

      case 'step-paused':
        for (const cb of this.stepPausedCallbacks) {
          cb(msg.generation)
        }
        break

      case 'single-evaluation':
        if (this.singleEvalResolve) {
          this.singleEvalResolve({
            walkFrames: msg.walkFrames,
            fitness: msg.fitness,
          })
          this.singleEvalResolve = null
          this.singleEvalReject = null
        }
        break

      case 'error':
        for (const cb of this.errorCallbacks) {
          cb(msg.message)
        }
        // Also reject pending single-eval if any
        if (this.singleEvalReject) {
          this.singleEvalReject(new Error(msg.message))
          this.singleEvalResolve = null
          this.singleEvalReject = null
        }
        break
    }
  }

  private send(cmd: WorkerCommand): void {
    if (!this.worker) {
      throw new Error('Worker has been terminated')
    }
    this.worker.postMessage(cmd)
  }

  /* ─── Callback registration ─── */

  /**
   * Register a callback for each completed generation.
   * @returns Unsubscribe function
   */
  onGeneration(callback: GenerationCallback): () => void {
    this.generationCallbacks.push(callback)
    return () => {
      this.generationCallbacks = this.generationCallbacks.filter(
        (cb) => cb !== callback,
      )
    }
  }

  /**
   * Register a callback for when evolution finishes all generations.
   * @returns Unsubscribe function
   */
  onComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.push(callback)
    return () => {
      this.completeCallbacks = this.completeCallbacks.filter(
        (cb) => cb !== callback,
      )
    }
  }

  /**
   * Register a callback for when the worker auto-pauses after a step.
   * @returns Unsubscribe function
   */
  onStepPaused(callback: StepPausedCallback): () => void {
    this.stepPausedCallbacks.push(callback)
    return () => {
      this.stepPausedCallbacks = this.stepPausedCallbacks.filter(
        (cb) => cb !== callback,
      )
    }
  }

  /**
   * Register a callback for worker errors.
   * @returns Unsubscribe function
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback)
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter(
        (cb) => cb !== callback,
      )
    }
  }

  /* ─── Commands ─── */

  /**
   * Start the evolution process with the given parameters.
   *
   * @param params  Simulation parameters from the UI store
   * @param seed    Optional random seed for reproducibility
   */
  start(params: SimParams, seed?: number): void {
    this.send({ type: 'start', params, seed })
  }

  /**
   * Pause evolution after the current generation completes.
   */
  pause(): void {
    this.send({ type: 'pause' })
  }

  /**
   * Resume a paused evolution.
   */
  resume(): void {
    this.send({ type: 'resume' })
  }

  /**
   * Advance exactly one generation, then auto-pause.
   * If paused, resumes for one gen. If not yet started, does nothing
   * (use start() first, then step to advance one at a time).
   */
  step(): void {
    this.send({ type: 'step' })
  }

  /**
   * Reset the worker -- stops evolution and clears all state.
   */
  reset(): void {
    this.send({ type: 'reset' })
  }

  /**
   * Evaluate a single set of genes and return the walk frames + fitness.
   * Returns a promise that resolves when the worker sends the result.
   *
   * @param genes  Raw [0,1] chromosome array
   */
  evaluateSingle(genes: number[]): Promise<SingleEvalResult> {
    return new Promise<SingleEvalResult>((resolve, reject) => {
      this.singleEvalResolve = resolve
      this.singleEvalReject = reject
      this.send({ type: 'evaluate-single', genes })
    })
  }

  /**
   * Terminate the worker entirely. Cannot be used again after this.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.generationCallbacks = []
    this.completeCallbacks = []
    this.stepPausedCallbacks = []
    this.errorCallbacks = []
    this.singleEvalResolve = null
    this.singleEvalReject = null
  }

  /**
   * Check if the worker is still alive.
   */
  get isAlive(): boolean {
    return this.worker !== null
  }
}
