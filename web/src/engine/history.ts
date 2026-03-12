/**
 * GenerationHistory -- memory-efficient storage for generation snapshots.
 *
 * To avoid excessive memory usage:
 *   - Only store walkFrames for the top N creatures per generation.
 *   - Older generations beyond a configurable window drop walkFrames entirely.
 *   - Stats and gene data are always retained for charting.
 *
 * This class is used by the worker to accumulate results, and serializable
 * snapshots are posted to the main thread.
 */

import type { GenerationSnapshot, CreatureRecord } from './types.ts'

/* ─── Configuration ─── */

/** Number of top creatures per generation whose walkFrames are kept */
const TOP_N_FRAMES = 5

/** Number of recent generations that retain full walkFrames */
const FRAME_RETENTION_WINDOW = 10

/* ─── History class ─── */

export class GenerationHistory {
  /** All stored generation snapshots (stats always present) */
  private snapshots: GenerationSnapshot[] = []

  /** Maximum number of top creatures with walkFrames per generation */
  private topN: number

  /** How many recent generations keep full frame data */
  private retentionWindow: number

  constructor(topN = TOP_N_FRAMES, retentionWindow = FRAME_RETENTION_WINDOW) {
    this.topN = topN
    this.retentionWindow = retentionWindow
  }

  /**
   * Add a new generation snapshot.
   * Automatically trims walkFrames for memory efficiency.
   *
   * @param snapshot  The full GenerationSnapshot from the GA engine
   */
  add(snapshot: GenerationSnapshot): void {
    // Trim walkFrames: only keep for top N by fitness
    const trimmed = this.trimFrames(snapshot)
    this.snapshots.push(trimmed)

    // Evict old frame data beyond the retention window
    this.evictOldFrames()
  }

  /**
   * Get the snapshot for a specific generation.
   */
  get(generation: number): GenerationSnapshot | undefined {
    return this.snapshots.find((s) => s.generation === generation)
  }

  /**
   * Get the most recent snapshot.
   */
  getLatest(): GenerationSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1]
  }

  /**
   * Get all snapshots (for serialization to main thread).
   */
  getAll(): GenerationSnapshot[] {
    return this.snapshots
  }

  /**
   * Get the number of stored generations.
   */
  get length(): number {
    return this.snapshots.length
  }

  /**
   * Get a summary of fitness stats across all generations.
   * Useful for the fitness-over-time chart.
   */
  getFitnessHistory(): Array<{
    gen: number
    best: number
    avg: number
    worst: number
    diversity: number
  }> {
    return this.snapshots.map((s) => ({
      gen: s.generation,
      best: s.stats.bestFitness,
      avg: s.stats.avgFitness,
      worst: s.stats.worstFitness,
      diversity: s.stats.diversity,
    }))
  }

  /**
   * Get the best creature across all generations.
   */
  getBestEver(): CreatureRecord | null {
    let best: CreatureRecord | null = null
    for (const snap of this.snapshots) {
      for (const creature of snap.population) {
        if (best === null || creature.fitness > best.fitness) {
          best = creature
        }
      }
    }
    return best
  }

  /**
   * Clear all stored history.
   */
  clear(): void {
    this.snapshots = []
  }

  /* ─── Private helpers ─── */

  /**
   * Trim walkFrames from a snapshot: keep only top N creatures by fitness.
   */
  private trimFrames(snapshot: GenerationSnapshot): GenerationSnapshot {
    // Sort population by fitness descending
    const sorted = [...snapshot.population].sort((a, b) => b.fitness - a.fitness)

    // Keep frames for top N, strip from rest
    const population: CreatureRecord[] = sorted.map((creature, idx) => {
      if (idx < this.topN) {
        return { ...creature }
      }
      return {
        ...creature,
        walkFrames: [], // Strip frames to save memory
      }
    })

    return {
      generation: snapshot.generation,
      population,
      stats: { ...snapshot.stats },
    }
  }

  /**
   * Remove walkFrames from snapshots older than the retention window.
   */
  private evictOldFrames(): void {
    if (this.snapshots.length <= this.retentionWindow) return

    const cutoff = this.snapshots.length - this.retentionWindow
    for (let i = 0; i < cutoff; i++) {
      const snap = this.snapshots[i]
      // Strip all walkFrames from old generations
      snap.population = snap.population.map((creature) => ({
        ...creature,
        walkFrames: [],
      }))
    }
  }
}
