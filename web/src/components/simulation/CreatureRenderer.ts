/**
 * Creature renderer — draws a stick-figure biped from CreatureFrame data.
 *
 * Draws in WORLD coordinates (Y-up). The parent worldContainer handles
 * the camera transform with scale.y = -zoom to flip Y automatically.
 *
 * Body plan (from creature.ts):
 *   torso (60x20) → hips → upper legs → lower legs → feet
 *                  → shoulders → upper arms → lower arms
 *
 * CreatureFrame.joints stores body-part CENTER positions:
 *   hip_L/R     = upper leg center
 *   knee_L/R    = lower leg center
 *   ankle_L/R   = foot center
 *   shoulder_L/R = upper arm center
 *   elbow_L/R   = lower arm center
 */

import { Graphics, Container } from 'pixi.js'
import type { CreatureFrame } from '@/engine/types.ts'
import { TORSO_WIDTH, TORSO_HEIGHT } from '@/engine/config.ts'

/* ─── Fitness → color gradient ─── */

/** Convert HSL (h: 0-360, s/l: 0-100) to hex number */
function hslToHex(h: number, s: number, l: number): number {
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let r: number, g: number, b: number
  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else               { r = c; g = 0; b = x }
  return (
    (Math.round((r + m) * 255) << 16) |
    (Math.round((g + m) * 255) << 8) |
    Math.round((b + m) * 255)
  )
}

/**
 * Map a fitness value to a muted monochromatic color.
 * Uses relative ranking: worst = dim gray, best = warm accent.
 * Desaturated to match the monochromatic design language.
 */
export function fitnessToColor(
  fitness: number,
  worstFitness: number,
  bestFitness: number,
): number {
  const range = bestFitness - worstFitness
  const t = range > 0
    ? Math.max(0, Math.min(1, (fitness - worstFitness) / range))
    : 0.5
  // Muted: worst = cool gray (hue 220, sat 10), best = warm tone (hue 30, sat 40)
  const hue = 220 - t * 190   // 220 → 30
  const sat = 10 + t * 30     // 10% → 40%
  const lit = 40 + t * 20     // 40% → 60%
  return hslToHex(hue, sat, lit)
}

/* ─── Rotate a local point by an angle ─── */

function rotatePoint(
  localX: number,
  localY: number,
  angle: number,
): { x: number; y: number } {
  const ca = Math.cos(angle)
  const sa = Math.sin(angle)
  return {
    x: localX * ca - localY * sa,
    y: localX * sa + localY * ca,
  }
}

/* ─── Creature Renderer ─── */

const HEAD_RADIUS = 5
const HEAD_OFFSET = TORSO_HEIGHT / 2 + 7

/** Line widths in world units (scaled by container zoom) */
const TORSO_LINE_WIDTH = 2.0
const LIMB_LINE_WIDTH = 1.2
const JOINT_RADIUS = 1.5
const GLOW_RADIUS = 15

export class CreatureRenderer {
  readonly container: Container

  /** Main body graphics */
  private bodyGfx: Graphics

  /** Glow effect graphics (behind body) */
  private glowGfx: Graphics

  /** Creature ID for click detection */
  id = -1

  /** Whether this is the current best creature */
  isBest = false

  constructor() {
    this.container = new Container()

    this.glowGfx = new Graphics()
    this.bodyGfx = new Graphics()

    this.container.addChild(this.glowGfx)
    this.container.addChild(this.bodyGfx)

    // Enable interactivity for click detection
    this.container.eventMode = 'static'
    this.container.cursor = 'pointer'
  }

  /**
   * Draw the creature at a specific frame.
   *
   * @param frame   CreatureFrame with body-part positions
   * @param color   Hex color based on fitness
   * @param alpha   Opacity (1.0 for best, 0.4 for worst)
   * @param isBest  Whether to draw glow + highlights
   */
  draw(
    frame: CreatureFrame,
    color: number,
    alpha: number = 1.0,
    isBest: boolean = false,
  ): void {
    this.isBest = isBest
    const { torsoX: tx, torsoY: ty, torsoAngle: ta, joints } = frame

    const halfW = TORSO_WIDTH / 2
    const halfH = TORSO_HEIGHT / 2

    // --- Compute torso edge attachment points ---
    const tl = rotatePoint(-halfW, 0, ta)
    const tr = rotatePoint(halfW, 0, ta)
    const hipAttachL = rotatePoint(-halfW * 0.3, -halfH, ta)
    const hipAttachR = rotatePoint(halfW * 0.3, -halfH, ta)
    const shoulderAttachL = rotatePoint(-halfW * 0.45, halfH * 0.5, ta)
    const shoulderAttachR = rotatePoint(halfW * 0.45, halfH * 0.5, ta)
    const headPos = rotatePoint(0, HEAD_OFFSET, ta)

    // --- Glow effect for best creature ---
    this.glowGfx.clear()
    if (isBest) {
      this.glowGfx
        .circle(tx, ty, GLOW_RADIUS)
        .fill({ color, alpha: 0.12 })
      this.glowGfx
        .circle(tx, ty, GLOW_RADIUS * 0.6)
        .fill({ color, alpha: 0.08 })
    }

    // --- Draw body ---
    this.bodyGfx.clear()
    this.container.alpha = alpha

    // Torso bar (wide horizontal line)
    this.bodyGfx
      .moveTo(tx + tl.x, ty + tl.y)
      .lineTo(tx + tr.x, ty + tr.y)
      .stroke({ width: TORSO_LINE_WIDTH, color })

    // Head circle
    this.bodyGfx
      .circle(tx + headPos.x, ty + headPos.y, HEAD_RADIUS)
      .fill({ color })

    // --- Legs (chained path per leg) ---
    for (const side of ['L', 'R'] as const) {
      const attach = side === 'L' ? hipAttachL : hipAttachR
      const hip = joints[`hip_${side}`]
      const knee = joints[`knee_${side}`]
      const ankle = joints[`ankle_${side}`]
      if (!hip || !knee || !ankle) continue

      // Attachment → upper leg → lower leg → foot
      this.bodyGfx
        .moveTo(tx + attach.x, ty + attach.y)
        .lineTo(hip.x, hip.y)
        .lineTo(knee.x, knee.y)
        .lineTo(ankle.x, ankle.y)
        .stroke({ width: LIMB_LINE_WIDTH, color })

      // Joint dots
      this.bodyGfx.circle(hip.x, hip.y, JOINT_RADIUS).fill({ color: 0xcccccc, alpha: 0.5 })
      this.bodyGfx.circle(knee.x, knee.y, JOINT_RADIUS).fill({ color: 0xcccccc, alpha: 0.5 })
    }

    // --- Arms (chained path per arm) ---
    for (const side of ['L', 'R'] as const) {
      const attach = side === 'L' ? shoulderAttachL : shoulderAttachR
      const shoulder = joints[`shoulder_${side}`]
      const elbow = joints[`elbow_${side}`]
      if (!shoulder || !elbow) continue

      // Attachment → upper arm → lower arm
      this.bodyGfx
        .moveTo(tx + attach.x, ty + attach.y)
        .lineTo(shoulder.x, shoulder.y)
        .lineTo(elbow.x, elbow.y)
        .stroke({ width: LIMB_LINE_WIDTH * 0.8, color })

      // Joint dot at shoulder
      this.bodyGfx
        .circle(shoulder.x, shoulder.y, JOINT_RADIUS * 0.8)
        .fill({ color: 0xbbbbbb, alpha: 0.35 })
    }

    // --- Hip/shoulder connection dots ---
    this.bodyGfx
      .circle(tx + hipAttachL.x, ty + hipAttachL.y, JOINT_RADIUS)
      .fill({ color: 0xcccccc, alpha: 0.4 })
    this.bodyGfx
      .circle(tx + hipAttachR.x, ty + hipAttachR.y, JOINT_RADIUS)
      .fill({ color: 0xcccccc, alpha: 0.4 })

    // Update hit area for click detection
    this.container.hitArea = {
      contains: (px: number, py: number) => {
        const dx = px - tx
        const dy = py - ty
        return dx * dx + dy * dy < 40 * 40
      },
    }
  }

  /** Set visibility */
  setVisible(visible: boolean): void {
    this.container.visible = visible
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}

/* ─── Motion Trail Renderer ─── */

/** Max trail positions to store */
const MAX_TRAIL = 25

export class MotionTrailRenderer {
  readonly graphics: Graphics
  private positions: { x: number; y: number }[] = []
  private color: number = 0x8b62d8

  constructor() {
    this.graphics = new Graphics()
  }

  /** Set the trail color (matches best creature) */
  setColor(color: number): void {
    this.color = color
  }

  /** Add a new position to the trail */
  push(x: number, y: number): void {
    this.positions.push({ x, y })
    if (this.positions.length > MAX_TRAIL) {
      this.positions.shift()
    }
  }

  /** Clear all trail positions */
  clear(): void {
    this.positions = []
    this.graphics.clear()
  }

  /** Redraw the trail (call each frame) */
  draw(): void {
    this.graphics.clear()
    if (this.positions.length < 2) return

    for (let i = 1; i < this.positions.length; i++) {
      const prev = this.positions[i - 1]
      const curr = this.positions[i]
      // Fade: older positions are more transparent
      const alpha = (i / this.positions.length) * 0.4
      this.graphics
        .moveTo(prev.x, prev.y)
        .lineTo(curr.x, curr.y)
        .stroke({ width: 1.5, color: this.color, alpha })
    }
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
