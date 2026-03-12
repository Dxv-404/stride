/**
 * ReplayBuffer — ring buffer for frame-by-frame replay.
 *
 * Stores the last N frames of simulation state for slow-motion playback.
 * Uses a circular buffer to prevent unbounded memory growth.
 *
 * Each frame captures:
 *   - All body positions and angles
 *   - Simulation time
 *   - Creature fallen state
 *
 * Usage:
 *   const buffer = new ReplayBuffer(300) // 5s at 60fps
 *   // In physics loop:
 *   buffer.record({ bodies, time, fallen })
 *   // For replay:
 *   buffer.playback(0.25, (frame) => drawFrame(frame))
 */

/* ─── Types ─── */

export interface ReplayBodyState {
  x: number
  y: number
  angle: number
  vx: number
  vy: number
}

export interface ReplayFrame {
  time: number
  bodies: ReplayBodyState[]
  fallen: boolean
}

/* ─── ReplayBuffer class ─── */

export class ReplayBuffer {
  private frames: (ReplayFrame | null)[]
  private head = 0
  private count = 0
  private capacity: number

  constructor(capacity = 300) {
    this.capacity = capacity
    this.frames = new Array(capacity).fill(null)
  }

  /**
   * Record a frame. Overwrites oldest frame when buffer is full.
   */
  record(frame: ReplayFrame): void {
    this.frames[this.head] = frame
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  /**
   * Record creature state directly from p2 bodies.
   */
  recordFromBodies(bodies: { position: number[]; angle: number; velocity: number[] }[], time: number, fallen: boolean): void {
    this.record({
      time,
      bodies: bodies.map(b => ({
        x: b.position[0],
        y: b.position[1],
        angle: b.angle,
        vx: b.velocity[0],
        vy: b.velocity[1],
      })),
      fallen,
    })
  }

  /**
   * Get a frame by index (0 = oldest, count-1 = newest).
   */
  getFrame(index: number): ReplayFrame | null {
    if (index < 0 || index >= this.count) return null
    const bufferIndex = (this.head - this.count + index + this.capacity) % this.capacity
    return this.frames[bufferIndex]
  }

  /**
   * Get the most recent N frames as an array (oldest first).
   */
  getRecentFrames(n?: number): ReplayFrame[] {
    const count = Math.min(n ?? this.count, this.count)
    const result: ReplayFrame[] = []
    for (let i = this.count - count; i < this.count; i++) {
      const frame = this.getFrame(i)
      if (frame) result.push(frame)
    }
    return result
  }

  /**
   * Get total recorded frame count (up to capacity).
   */
  get size(): number {
    return this.count
  }

  /**
   * Get buffer capacity.
   */
  get maxSize(): number {
    return this.capacity
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.head = 0
    this.count = 0
    this.frames.fill(null)
  }

  /**
   * Get the newest frame.
   */
  get newest(): ReplayFrame | null {
    if (this.count === 0) return null
    return this.getFrame(this.count - 1)
  }

  /**
   * Get the oldest frame.
   */
  get oldest(): ReplayFrame | null {
    if (this.count === 0) return null
    return this.getFrame(0)
  }

  /**
   * Get duration of recorded content in seconds.
   */
  get duration(): number {
    const first = this.oldest
    const last = this.newest
    if (!first || !last) return 0
    return last.time - first.time
  }
}
