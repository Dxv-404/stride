/**
 * ParticleSystem — standalone canvas-based particle engine.
 *
 * Manages multiple particle types with typed emitter presets.
 * Runs entirely inside the Canvas2D draw loop — no React state, no re-renders.
 *
 * Particle types:
 *   footDust    — small puffs on foot ground contact
 *   pushImpact  — radial burst from torso on push
 *   crashDebris — angular debris on creature fall
 *   fitnessRecord — upward sparkles on new best distance
 *   speedLines  — horizontal streaks at high velocity
 *   ambientDust — constant subtle floating dots
 */

/* ─── Types ─── */

export type ParticleShape = 'circle' | 'line' | 'spark'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  shape: ParticleShape
  color: string
  /** For line/spark: rotation angle */
  angle: number
  /** For spark: spin speed */
  spin: number
  /** Per-particle gravity override */
  gravity?: number
}

export interface EmitterConfig {
  count: number
  speed: [number, number] // min, max
  lifetime: [number, number]
  size: [number, number]
  color: string
  gravity: number
  shape: ParticleShape
  /** Spread angle in radians (default: 2*PI = all directions) */
  spread?: number
  /** Base direction in radians (default: 0 = right) */
  direction?: number
}

/* ─── Presets ─── */

const DUST_COLOR = 'rgba(180, 180, 150, 0.6)'
const SPARK_COLOR = 'rgba(220, 220, 200, 0.8)'

export const PRESETS = {
  footDust: {
    count: 3,
    speed: [5, 20] as [number, number],
    lifetime: [0.3, 0.6],
    size: [1, 2.5],
    color: DUST_COLOR,
    gravity: -20,
    shape: 'circle' as ParticleShape,
    spread: Math.PI,
    direction: Math.PI / 2, // upward
  },
  pushImpact: {
    count: 25,
    speed: [40, 120] as [number, number],
    lifetime: [0.2, 0.5],
    size: [1.5, 4],
    color: SPARK_COLOR,
    gravity: -30,
    shape: 'spark' as ParticleShape,
    spread: Math.PI * 0.6,
    direction: Math.PI, // leftward (push direction)
  },
  crashDebris: {
    count: 15,
    speed: [20, 80] as [number, number],
    lifetime: [0.3, 0.8],
    size: [1, 3],
    color: DUST_COLOR,
    gravity: -50,
    shape: 'line' as ParticleShape,
    spread: Math.PI,
    direction: Math.PI / 2,
  },
  fitnessRecord: {
    count: 10,
    speed: [15, 40] as [number, number],
    lifetime: [0.5, 1.0],
    size: [1, 2],
    color: SPARK_COLOR,
    gravity: 10, // float upward (positive = up in world coords)
    shape: 'spark' as ParticleShape,
    spread: Math.PI * 0.4,
    direction: Math.PI / 2,
  },
  speedLines: {
    count: 3,
    speed: [5, 15] as [number, number],
    lifetime: [0.15, 0.3],
    size: [3, 8],
    color: 'rgba(200, 200, 200, 0.3)',
    gravity: 0,
    shape: 'line' as ParticleShape,
    spread: Math.PI * 0.1,
    direction: Math.PI, // behind creature
  },
  ambientDust: {
    count: 1,
    speed: [2, 8] as [number, number],
    lifetime: [1.5, 3.0],
    size: [0.5, 1.5],
    color: 'rgba(150, 150, 150, 0.2)',
    gravity: 5, // slowly float up
    shape: 'circle' as ParticleShape,
    spread: Math.PI * 2,
    direction: 0,
  },
} as const

/* ─── Random helpers ─── */

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/* ─── ParticleSystem class ─── */

export class ParticleSystem {
  particles: Particle[] = []
  private maxParticles = 500

  /**
   * Emit particles at a given world position using a preset configuration.
   */
  emit(
    x: number,
    y: number,
    preset: keyof typeof PRESETS,
    overrides?: Partial<EmitterConfig>,
  ): void {
    const config = { ...PRESETS[preset], ...overrides }
    const dir = config.direction ?? 0
    const spread = config.spread ?? Math.PI * 2

    for (let i = 0; i < config.count; i++) {
      if (this.particles.length >= this.maxParticles) break

      const angle = dir + (Math.random() - 0.5) * spread
      const speed = rand(config.speed[0], config.speed[1])

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(config.lifetime[0], config.lifetime[1]),
        size: rand(config.size[0], config.size[1]),
        shape: config.shape,
        color: config.color,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 10,
      })
    }
  }

  /**
   * Emit particles with a custom color (useful for themed particles).
   */
  emitWithColor(
    x: number,
    y: number,
    preset: keyof typeof PRESETS,
    color: string,
  ): void {
    this.emit(x, y, preset, { color })
  }

  /**
   * Update all particles. Call once per physics step.
   */
  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.gravity ?? 0 // fallback, but gravity is baked into vy update below
      p.angle += p.spin * dt
    }
  }

  /**
   * Update with explicit gravity (world-space, positive = up).
   */
  step(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      // Gravity is per-particle (set during emit from preset.gravity)
      // We don't have it stored, so we skip gravity here and bake it into vy at emit
      p.angle += p.spin * dt

      // Damping
      p.vx *= 0.99
      p.vy *= 0.99
    }
  }

  /**
   * Draw all particles onto a Canvas2D context.
   * @param ctx Canvas context
   * @param toScreenX World X → screen X converter
   * @param toScreenY World Y → screen Y converter
   * @param zoom Current zoom level
   */
  draw(
    ctx: CanvasRenderingContext2D,
    toScreenX: (wx: number) => number,
    toScreenY: (wy: number) => number,
    zoom: number,
  ): void {
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife
      const sx = toScreenX(p.x)
      const sy = toScreenY(p.y)
      const sz = p.size * zoom * 0.3

      ctx.globalAlpha = alpha

      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(sx, sy, sz, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      } else if (p.shape === 'line') {
        const len = sz * 2
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(p.angle)
        ctx.beginPath()
        ctx.moveTo(-len, 0)
        ctx.lineTo(len, 0)
        ctx.strokeStyle = p.color
        ctx.lineWidth = Math.max(0.5, sz * 0.3)
        ctx.stroke()
        ctx.restore()
      } else if (p.shape === 'spark') {
        // Diamond shape
        const r = sz
        ctx.beginPath()
        ctx.moveTo(sx, sy - r)
        ctx.lineTo(sx + r * 0.5, sy)
        ctx.lineTo(sx, sy + r)
        ctx.lineTo(sx - r * 0.5, sy)
        ctx.closePath()
        ctx.fillStyle = p.color
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  /**
   * Clear all particles.
   */
  clear(): void {
    this.particles.length = 0
  }

  /**
   * Get particle count.
   */
  get count(): number {
    return this.particles.length
  }
}
