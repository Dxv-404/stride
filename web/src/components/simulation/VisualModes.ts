/**
 * VisualModes — rendering overlay system for LiveCanvas.
 *
 * Five visual modes that change how the creature is rendered
 * without affecting physics:
 *
 *   normal    — default stick figure rendering
 *   xray      — wireframe + joint angle labels
 *   heatmap   — limbs colored by motor torque intensity
 *   blueprint — blue wireframe on grid, with dimension labels
 *   inkwash   — brush-stroke style with velocity-based line width
 *
 * Keyboard shortcuts:
 *   V — cycle through all modes
 *   M — toggle heatmap on/off (independent)
 *   X — toggle x-ray on/off (independent)
 */

import type { Creature } from '@/engine/creature.ts'
import {
  TORSO_WIDTH, TORSO_HEIGHT,
  UPPER_LEG_LENGTH, LOWER_LEG_LENGTH,
  UPPER_ARM_LENGTH, LOWER_ARM_LENGTH,
} from '@/engine/config.ts'

/* ─── Types ─── */

export type VisualMode = 'normal' | 'xray' | 'heatmap' | 'blueprint' | 'inkwash'

export const VISUAL_MODES: VisualMode[] = ['normal', 'xray', 'heatmap', 'blueprint', 'inkwash']

export const VISUAL_MODE_LABELS: Record<VisualMode, string> = {
  normal: 'NORMAL',
  xray: 'X-RAY',
  heatmap: 'HEATMAP',
  blueprint: 'BLUEPRINT',
  inkwash: 'INK WASH',
}

/* ─── Heatmap color helper ─── */

/**
 * Map a normalized intensity [0,1] to a monochromatic heat color.
 * 0 = dim/cold (dark), 1 = bright/hot (accent).
 */
function heatColor(intensity: number, accent: string): string {
  const t = Math.max(0, Math.min(1, intensity))
  // Parse accent hex to RGB
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)
  // Interpolate from dim (30% opacity) to full
  const alpha = 0.3 + t * 0.7
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Get motor torque intensities for all joints.
 * Returns a Map<jointName, normalizedIntensity>.
 */
export function getMotorIntensities(creature: Creature): Map<string, number> {
  const intensities = new Map<string, number>()
  let maxSpeed = 0

  // First pass: find max motor speed for normalization
  for (const joint of creature.motors.values()) {
    const speed = Math.abs(joint.constraint.getMotorSpeed())
    if (speed > maxSpeed) maxSpeed = speed
  }

  // Second pass: normalize
  for (const joint of creature.motors.values()) {
    const speed = Math.abs(joint.constraint.getMotorSpeed())
    intensities.set(joint.name, maxSpeed > 0 ? speed / maxSpeed : 0)
  }

  return intensities
}

/* ─── Drawing functions for each mode ─── */

/**
 * Draw creature in X-Ray mode: wireframe with joint angle labels.
 */
export function drawXRay(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  toScreenX: (wx: number) => number,
  toScreenY: (wy: number) => number,
  zoom: number,
  color: string,
) {
  const bodies = creature.bodies
  const tx = creature.torso.position[0]
  const ty = creature.torso.position[1]
  const ta = creature.torso.angle
  const halfW = TORSO_WIDTH / 2
  const halfH = TORSO_HEIGHT / 2

  // Wireframe style
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  ctx.lineCap = 'round'

  // Torso outline (rotated rectangle)
  const rot = (lx: number, ly: number) => ({
    x: tx + lx * Math.cos(ta) - ly * Math.sin(ta),
    y: ty + lx * Math.sin(ta) + ly * Math.cos(ta),
  })
  const corners = [
    rot(-halfW, -halfH), rot(halfW, -halfH),
    rot(halfW, halfH), rot(-halfW, halfH),
  ]
  ctx.beginPath()
  ctx.moveTo(toScreenX(corners[0].x), toScreenY(corners[0].y))
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(toScreenX(corners[i].x), toScreenY(corners[i].y))
  }
  ctx.closePath()
  ctx.stroke()

  // Limb wireframes
  for (let i = 1; i < Math.min(bodies.length, 11); i++) {
    const b = bodies[i]
    const bx = b.position[0]
    const by = b.position[1]
    const ba = b.angle
    let length = 0
    if (i <= 2 || i === 4 || i === 5) length = (i <= 2 || i === 4 || i === 5) ? (i === 1 || i === 4 ? UPPER_LEG_LENGTH : LOWER_LEG_LENGTH) : 0
    if (i === 7 || i === 9) length = UPPER_ARM_LENGTH
    if (i === 8 || i === 10) length = LOWER_ARM_LENGTH
    if (i === 3 || i === 6) continue // skip feet for wireframe

    if (length > 0) {
      const halfL = length / 2
      const top = { x: bx - Math.sin(ba) * halfL, y: by + Math.cos(ba) * halfL }
      const bot = { x: bx + Math.sin(ba) * halfL, y: by - Math.cos(ba) * halfL }
      ctx.beginPath()
      ctx.moveTo(toScreenX(top.x), toScreenY(top.y))
      ctx.lineTo(toScreenX(bot.x), toScreenY(bot.y))
      ctx.stroke()
    }
  }

  ctx.setLineDash([])

  // Joint angle labels
  ctx.font = `${Math.max(8, 9 * zoom * 0.3)}px "JetBrains Mono", monospace`
  ctx.fillStyle = color
  ctx.textAlign = 'left'

  for (const [, motor] of creature.motors) {
    const angle = motor.constraint.angle
    const degrees = (angle * 180 / Math.PI).toFixed(0)
    const bodyB = motor.constraint.bodyB
    const sx = toScreenX(bodyB.position[0]) + 8
    const sy = toScreenY(bodyB.position[1]) - 4
    ctx.fillText(`${degrees}°`, sx, sy)
  }
}

/**
 * Draw creature in Heatmap mode: limbs colored by torque intensity.
 */
export function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  toScreenX: (wx: number) => number,
  toScreenY: (wy: number) => number,
  zoom: number,
  accentHex: string,
) {
  const bodies = creature.bodies
  const intensities = getMotorIntensities(creature)

  // Map body indices to motor names
  // [0]=torso, [1]=upperLegL, [2]=lowerLegL, [3]=footL,
  // [4]=upperLegR, [5]=lowerLegR, [6]=footR,
  // [7]=upperArmL, [8]=lowerArmL, [9]=upperArmR, [10]=lowerArmR
  const bodyMotorMap: Record<number, string> = {
    1: 'hip_L', 2: 'knee_L',
    4: 'hip_R', 5: 'knee_R',
    7: 'shoulder_L', 8: 'shoulder_L',
    9: 'shoulder_R', 10: 'shoulder_R',
  }

  // Draw limb segments with heat colors
  const segments: [number, number][] = [
    [1, 2], [2, 3],   // left leg chain
    [4, 5], [5, 6],   // right leg chain
    [7, 8],            // left arm chain
    [9, 10],           // right arm chain
  ]

  for (const [fromIdx, toIdx] of segments) {
    if (fromIdx >= bodies.length || toIdx >= bodies.length) continue

    const motorName = bodyMotorMap[fromIdx]
    const intensity = motorName ? (intensities.get(motorName) ?? 0) : 0
    const color = heatColor(intensity, accentHex)

    ctx.beginPath()
    ctx.moveTo(toScreenX(bodies[fromIdx].position[0]), toScreenY(bodies[fromIdx].position[1]))
    ctx.lineTo(toScreenX(bodies[toIdx].position[0]), toScreenY(bodies[toIdx].position[1]))
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(3, 4 * zoom * 0.3)
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Torso bar with average intensity
  const hipL = intensities.get('hip_L') ?? 0
  const hipR = intensities.get('hip_R') ?? 0
  const torsoIntensity = (hipL + hipR) / 2
  const tx = creature.torso.position[0]
  const ty = creature.torso.position[1]
  const ta = creature.torso.angle
  const halfW = TORSO_WIDTH / 2
  const rot = (lx: number, ly: number) => ({
    x: tx + lx * Math.cos(ta) - ly * Math.sin(ta),
    y: ty + lx * Math.sin(ta) + ly * Math.cos(ta),
  })
  const tl = rot(-halfW, 0)
  const tr = rot(halfW, 0)
  ctx.beginPath()
  ctx.moveTo(toScreenX(tl.x), toScreenY(tl.y))
  ctx.lineTo(toScreenX(tr.x), toScreenY(tr.y))
  ctx.strokeStyle = heatColor(torsoIntensity, accentHex)
  ctx.lineWidth = Math.max(3, 4 * zoom * 0.3)
  ctx.stroke()

  // Head
  const headPos = rot(0, TORSO_HEIGHT / 2 + 7)
  ctx.beginPath()
  ctx.arc(toScreenX(headPos.x), toScreenY(headPos.y), 5 * zoom * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = heatColor(torsoIntensity, accentHex)
  ctx.fill()

  // Joint dots with intensity
  for (const [motorName, motor] of creature.motors) {
    const bodyB = motor.constraint.bodyB
    const intensity = intensities.get(motorName) ?? 0
    ctx.beginPath()
    ctx.arc(
      toScreenX(bodyB.position[0]),
      toScreenY(bodyB.position[1]),
      3 * zoom * 0.3, 0, Math.PI * 2,
    )
    ctx.fillStyle = heatColor(intensity, accentHex)
    ctx.fill()
  }
}

/**
 * Draw creature in Blueprint mode: blue wireframe on grid, with dimension labels.
 */
export function drawBlueprint(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  toScreenX: (wx: number) => number,
  toScreenY: (wy: number) => number,
  zoom: number,
  _color: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  // Blueprint grid overlay (local to creature area)
  const blueprintColor = 'rgba(100, 149, 237, 0.15)' // cornflower blue, subtle
  const lineColor = 'rgba(100, 149, 237, 0.7)'
  const dimColor = 'rgba(100, 149, 237, 0.5)'
  const gridSpacing = 20 // world units

  // Draw grid centered on creature
  const cx = creature.torso.position[0]
  const cy = creature.torso.position[1]
  const gridExtent = 150

  ctx.strokeStyle = blueprintColor
  ctx.lineWidth = 0.5

  for (let gx = Math.floor((cx - gridExtent) / gridSpacing) * gridSpacing; gx <= cx + gridExtent; gx += gridSpacing) {
    const sx = toScreenX(gx)
    if (sx >= 0 && sx <= canvasWidth) {
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, canvasHeight)
      ctx.stroke()
    }
  }
  for (let gy = Math.floor((cy - gridExtent) / gridSpacing) * gridSpacing; gy <= cy + gridExtent; gy += gridSpacing) {
    const sy = toScreenY(gy)
    if (sy >= 0 && sy <= canvasHeight) {
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(canvasWidth, sy)
      ctx.stroke()
    }
  }

  // Draw creature wireframe in blueprint blue
  const bodies = creature.bodies
  const tx = creature.torso.position[0]
  const ty = creature.torso.position[1]
  const ta = creature.torso.angle
  const halfW = TORSO_WIDTH / 2
  const halfH = TORSO_HEIGHT / 2

  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.setLineDash([])

  // Torso rectangle
  const rot = (lx: number, ly: number) => ({
    x: tx + lx * Math.cos(ta) - ly * Math.sin(ta),
    y: ty + lx * Math.sin(ta) + ly * Math.cos(ta),
  })
  const corners = [
    rot(-halfW, -halfH), rot(halfW, -halfH),
    rot(halfW, halfH), rot(-halfW, halfH),
  ]
  ctx.beginPath()
  ctx.moveTo(toScreenX(corners[0].x), toScreenY(corners[0].y))
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(toScreenX(corners[i].x), toScreenY(corners[i].y))
  }
  ctx.closePath()
  ctx.stroke()

  // Limbs as lines
  const hipAttachL = rot(-halfW * 0.3, -halfH)
  const hipAttachR = rot(halfW * 0.3, -halfH)
  const shoulderAttachL = rot(-halfW * 0.45, halfH * 0.5)
  const shoulderAttachR = rot(halfW * 0.45, halfH * 0.5)

  // Left leg
  if (bodies.length > 3) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(hipAttachL.x), toScreenY(hipAttachL.y))
    ctx.lineTo(toScreenX(bodies[1].position[0]), toScreenY(bodies[1].position[1]))
    ctx.lineTo(toScreenX(bodies[2].position[0]), toScreenY(bodies[2].position[1]))
    ctx.lineTo(toScreenX(bodies[3].position[0]), toScreenY(bodies[3].position[1]))
    ctx.stroke()
  }

  // Right leg
  if (bodies.length > 6) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(hipAttachR.x), toScreenY(hipAttachR.y))
    ctx.lineTo(toScreenX(bodies[4].position[0]), toScreenY(bodies[4].position[1]))
    ctx.lineTo(toScreenX(bodies[5].position[0]), toScreenY(bodies[5].position[1]))
    ctx.lineTo(toScreenX(bodies[6].position[0]), toScreenY(bodies[6].position[1]))
    ctx.stroke()
  }

  // Left arm
  if (bodies.length > 8) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(shoulderAttachL.x), toScreenY(shoulderAttachL.y))
    ctx.lineTo(toScreenX(bodies[7].position[0]), toScreenY(bodies[7].position[1]))
    ctx.lineTo(toScreenX(bodies[8].position[0]), toScreenY(bodies[8].position[1]))
    ctx.stroke()
  }

  // Right arm
  if (bodies.length > 10) {
    ctx.beginPath()
    ctx.moveTo(toScreenX(shoulderAttachR.x), toScreenY(shoulderAttachR.y))
    ctx.lineTo(toScreenX(bodies[9].position[0]), toScreenY(bodies[9].position[1]))
    ctx.lineTo(toScreenX(bodies[10].position[0]), toScreenY(bodies[10].position[1]))
    ctx.stroke()
  }

  // Dimension labels
  ctx.font = `${Math.max(7, 8 * zoom * 0.3)}px "JetBrains Mono", monospace`
  ctx.fillStyle = dimColor
  ctx.textAlign = 'center'

  // Torso width label
  const torsoMidY = toScreenY(ty)
  ctx.fillText(`${TORSO_WIDTH}px`, toScreenX(tx), torsoMidY - 8)

  // Leg lengths (left side)
  if (bodies.length > 2) {
    const ulMid = toScreenY(bodies[1].position[1])
    ctx.textAlign = 'right'
    ctx.fillText(`UL:${UPPER_LEG_LENGTH}`, toScreenX(bodies[1].position[0]) - 10, ulMid)
    const llMid = toScreenY(bodies[2].position[1])
    ctx.fillText(`LL:${LOWER_LEG_LENGTH}`, toScreenX(bodies[2].position[0]) - 10, llMid)
  }

  // Head
  const headPos = rot(0, halfH + 7)
  ctx.beginPath()
  ctx.arc(toScreenX(headPos.x), toScreenY(headPos.y), 5 * zoom * 0.4, 0, Math.PI * 2)
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1.5
  ctx.stroke()
}

/**
 * Draw creature in Ink Wash mode: brush-stroke style with velocity-based line width.
 */
export function drawInkWash(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  toScreenX: (wx: number) => number,
  toScreenY: (wy: number) => number,
  zoom: number,
  color: string,
) {
  const bodies = creature.bodies
  const tx = creature.torso.position[0]
  const ty = creature.torso.position[1]
  const ta = creature.torso.angle
  const halfW = TORSO_WIDTH / 2
  const halfH = TORSO_HEIGHT / 2

  const rot = (lx: number, ly: number) => ({
    x: tx + lx * Math.cos(ta) - ly * Math.sin(ta),
    y: ty + lx * Math.sin(ta) + ly * Math.cos(ta),
  })

  // Get limb velocities for line width variation
  const getBodySpeed = (body: p2.Body) => {
    return Math.sqrt(body.velocity[0] ** 2 + body.velocity[1] ** 2)
  }

  // Brush stroke helper: wider for slow, thinner for fast
  const brushWidth = (body: p2.Body) => {
    const speed = getBodySpeed(body)
    const maxW = 5 * zoom * 0.3
    const minW = 1 * zoom * 0.3
    // Invert: fast = thin, slow = thick (like ink soaking)
    const t = Math.min(speed / 200, 1)
    return maxW - t * (maxW - minW)
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Draw each limb with ink-wash style
  const drawInkSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    body: p2.Body,
  ) => {
    const w = brushWidth(body)
    // Slight transparency for ink wash look
    ctx.globalAlpha = 0.7 + Math.random() * 0.2
    ctx.beginPath()
    ctx.moveTo(toScreenX(from.x), toScreenY(from.y))

    // Add slight bezier curve for organic feel
    const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 2
    const midY = (from.y + to.y) / 2 + (Math.random() - 0.5) * 2
    ctx.quadraticCurveTo(toScreenX(midX), toScreenY(midY), toScreenX(to.x), toScreenY(to.y))

    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Torso
  const tl = rot(-halfW, 0)
  const tr = rot(halfW, 0)
  drawInkSegment(tl, tr, creature.torso)

  // Head
  const headPos = rot(0, halfH + 7)
  const headSize = brushWidth(creature.torso) * 1.2
  ctx.beginPath()
  ctx.arc(toScreenX(headPos.x), toScreenY(headPos.y), Math.max(3, headSize), 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.8
  ctx.fill()
  ctx.globalAlpha = 1

  // Legs
  const hipAttachL = rot(-halfW * 0.3, -halfH)
  const hipAttachR = rot(halfW * 0.3, -halfH)

  if (bodies.length > 3) {
    drawInkSegment(hipAttachL, { x: bodies[1].position[0], y: bodies[1].position[1] }, bodies[1])
    drawInkSegment({ x: bodies[1].position[0], y: bodies[1].position[1] }, { x: bodies[2].position[0], y: bodies[2].position[1] }, bodies[2])
    drawInkSegment({ x: bodies[2].position[0], y: bodies[2].position[1] }, { x: bodies[3].position[0], y: bodies[3].position[1] }, bodies[3])
  }
  if (bodies.length > 6) {
    drawInkSegment(hipAttachR, { x: bodies[4].position[0], y: bodies[4].position[1] }, bodies[4])
    drawInkSegment({ x: bodies[4].position[0], y: bodies[4].position[1] }, { x: bodies[5].position[0], y: bodies[5].position[1] }, bodies[5])
    drawInkSegment({ x: bodies[5].position[0], y: bodies[5].position[1] }, { x: bodies[6].position[0], y: bodies[6].position[1] }, bodies[6])
  }

  // Arms
  const shoulderAttachL = rot(-halfW * 0.45, halfH * 0.5)
  const shoulderAttachR = rot(halfW * 0.45, halfH * 0.5)

  if (bodies.length > 8) {
    drawInkSegment(shoulderAttachL, { x: bodies[7].position[0], y: bodies[7].position[1] }, bodies[7])
    drawInkSegment({ x: bodies[7].position[0], y: bodies[7].position[1] }, { x: bodies[8].position[0], y: bodies[8].position[1] }, bodies[8])
  }
  if (bodies.length > 10) {
    drawInkSegment(shoulderAttachR, { x: bodies[9].position[0], y: bodies[9].position[1] }, bodies[9])
    drawInkSegment({ x: bodies[9].position[0], y: bodies[9].position[1] }, { x: bodies[10].position[0], y: bodies[10].position[1] }, bodies[10])
  }
}
