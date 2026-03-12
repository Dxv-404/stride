/**
 * TerrainEditorCanvas — interactive 2D canvas for sculpting terrain.
 *
 * Renders a terrain height profile on an HTML Canvas 2D context.
 * Users click-drag to sculpt using the selected brush tool.
 *
 * Coordinate system:
 *   - Canvas X maps to terrain X (0..terrainLength)
 *   - Canvas Y is inverted: screen-top = max height, screen-bottom = 0
 *   - Terrain heights are in world-space pixels (0..maxHeight)
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import type { TerrainPoint } from '@/engine/types.ts'

/* ─── Constants ─── */

const TERRAIN_LENGTH = 2000
const POINT_SPACING = 5
const POINT_COUNT = TERRAIN_LENGTH / POINT_SPACING + 1
const BASE_HEIGHT = 50
const MAX_HEIGHT = 200
/** Read terrain editor colors from CSS theme variables */
function getEditorColors() {
  const s = getComputedStyle(document.documentElement)
  const get = (v: string, fb: string) => s.getPropertyValue(v).trim() || fb
  return {
    bg: get('--color-canvas-bg', '#0F0F0F'),
    grid: get('--color-border', '#2E2E2E'),
    fillTop: get('--color-canvas-ground', '#2A2A2A'),
    fillBottom: get('--color-canvas-ground-fill', '#151515'),
    stroke: get('--color-accent', '#C4956A'),
    brushPreview: get('--color-accent', '#C4956A') + '4D',  // ~30% opacity
  }
}

export type BrushTool = 'sculpt' | 'smooth' | 'flatten' | 'cliff' | 'gap'

interface TerrainEditorCanvasProps {
  points: TerrainPoint[]
  onPointsChange: (points: TerrainPoint[]) => void
  tool: BrushTool
  brushSize: number
  /** Whether the brush raises (true) or lowers (false) terrain */
  brushUp: boolean
}

/* ─── Brush operations ─── */

function applyBrush(
  points: TerrainPoint[],
  worldX: number,
  tool: BrushTool,
  brushSize: number,
  brushUp: boolean,
  strength: number,
): TerrainPoint[] {
  const next = points.map((p) => ({ ...p }))
  const radius = brushSize * POINT_SPACING

  for (let i = 0; i < next.length; i++) {
    const dx = next[i].x - worldX
    const dist = Math.abs(dx)
    if (dist > radius) continue

    // Falloff: 1 at center, 0 at edge
    const falloff = 1 - dist / radius

    switch (tool) {
      case 'sculpt': {
        const delta = (brushUp ? 1 : -1) * strength * 2 * falloff
        next[i].y = Math.max(0, Math.min(MAX_HEIGHT, next[i].y + delta))
        break
      }
      case 'smooth': {
        // Average with neighbors
        const left = i > 0 ? next[i - 1].y : next[i].y
        const right = i < next.length - 1 ? next[i + 1].y : next[i].y
        const avg = (left + next[i].y + right) / 3
        next[i].y += (avg - next[i].y) * falloff * 0.5
        break
      }
      case 'flatten': {
        // Flatten toward the height at the brush center
        const centerIdx = Math.round(worldX / POINT_SPACING)
        const centerY = centerIdx >= 0 && centerIdx < points.length
          ? points[centerIdx].y
          : BASE_HEIGHT
        next[i].y += (centerY - next[i].y) * falloff * 0.3
        break
      }
      case 'cliff': {
        // Create a vertical wall: raise left side, lower right side
        if (dist < radius * 0.2) {
          next[i].y = Math.max(0, Math.min(MAX_HEIGHT, next[i].y + (dx < 0 ? 3 : -3)))
        }
        break
      }
      case 'gap': {
        // Push terrain down to create a gap
        next[i].y = Math.max(0, next[i].y - strength * 3 * falloff)
        break
      }
    }
  }

  return next
}

/* ─── Component ─── */

export default function TerrainEditorCanvas({
  points,
  onPointsChange,
  tool,
  brushSize,
  brushUp,
}: TerrainEditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)
  const paintingRef = useRef(false)

  // Camera: horizontal scroll offset
  const [scrollX, setScrollX] = useState(0)
  const zoomRef = useRef(1)

  /* ─── Canvas to world coordinate conversion ─── */

  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number, _canvasW: number, canvasH: number) => {
      const worldX = scrollX + canvasX / zoomRef.current
      const worldY = MAX_HEIGHT - (canvasY / canvasH) * MAX_HEIGHT
      return { worldX, worldY }
    },
    [scrollX],
  )

  /* ─── Drawing ─── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const zoom = zoomRef.current
    const colors = getEditorColors()

    // Clear
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 1
    for (let gy = 0; gy <= MAX_HEIGHT; gy += 25) {
      const screenY = h - (gy / MAX_HEIGHT) * h
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(w, screenY)
      ctx.stroke()
    }
    for (let gx = 0; gx <= TERRAIN_LENGTH; gx += 100) {
      const screenX = (gx - scrollX) * zoom
      if (screenX < 0 || screenX > w) continue
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, h)
      ctx.stroke()
    }

    // Terrain filled area
    ctx.beginPath()
    ctx.moveTo((points[0].x - scrollX) * zoom, h)
    for (const p of points) {
      const sx = (p.x - scrollX) * zoom
      const sy = h - (p.y / MAX_HEIGHT) * h
      ctx.lineTo(sx, sy)
    }
    ctx.lineTo((points[points.length - 1].x - scrollX) * zoom, h)
    ctx.closePath()

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, colors.fillTop)
    grad.addColorStop(1, colors.fillBottom)
    ctx.fillStyle = grad
    ctx.fill()

    // Terrain line
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      const sx = (points[i].x - scrollX) * zoom
      const sy = h - (points[i].y / MAX_HEIGHT) * h
      if (i === 0) ctx.moveTo(sx, sy)
      else ctx.lineTo(sx, sy)
    }
    ctx.strokeStyle = colors.stroke
    ctx.lineWidth = 2
    ctx.stroke()

    // Brush preview
    if (mousePos) {
      const brushRadius = brushSize * POINT_SPACING * zoom
      ctx.beginPath()
      ctx.arc(mousePos.x, mousePos.y, brushRadius, 0, Math.PI * 2)
      ctx.fillStyle = colors.brushPreview
      ctx.fill()
      ctx.strokeStyle = colors.stroke
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Spawn marker (x=100)
    const spawnScreenX = (100 - scrollX) * zoom
    if (spawnScreenX > 0 && spawnScreenX < w) {
      ctx.strokeStyle = colors.stroke + '66'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(spawnScreenX, 0)
      ctx.lineTo(spawnScreenX, h)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = colors.stroke
      ctx.font = '9px "JetBrains Mono", monospace'
      ctx.fillText('SPAWN', spawnScreenX + 4, 14)
    }

    // Height scale labels
    ctx.fillStyle = colors.grid
    ctx.font = '9px "JetBrains Mono", monospace'
    for (let gy = 0; gy <= MAX_HEIGHT; gy += 50) {
      const screenY = h - (gy / MAX_HEIGHT) * h
      ctx.fillText(`${gy}`, 4, screenY - 2)
    }
  }, [points, mousePos, scrollX, brushSize])

  /* ─── Resize observer ─── */

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      // Adjust zoom so full terrain fits roughly
      zoomRef.current = rect.width / TERRAIN_LENGTH
      draw()
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [draw])

  // Redraw when points/mouse changes
  useEffect(() => {
    draw()
  }, [draw])

  /* ─── Mouse handlers ─── */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      paintingRef.current = true
      canvas.setPointerCapture(e.pointerId)

      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { worldX } = canvasToWorld(cx, cy, rect.width, rect.height)

      const newPoints = applyBrush(points, worldX, tool, brushSize, brushUp, 1)
      onPointsChange(newPoints)
    },
    [points, onPointsChange, tool, brushSize, brushUp, canvasToWorld],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setMousePos({ x: cx, y: cy })

      if (paintingRef.current) {
        const { worldX } = canvasToWorld(cx, cy, rect.width, rect.height)
        const newPoints = applyBrush(points, worldX, tool, brushSize, brushUp, 0.5)
        onPointsChange(newPoints)
      }
    },
    [points, onPointsChange, tool, brushSize, brushUp, canvasToWorld],
  )

  const handlePointerUp = useCallback(() => {
    paintingRef.current = false
  }, [])

  const handlePointerLeave = useCallback(() => {
    setMousePos(null)
    paintingRef.current = false
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      setScrollX((prev) =>
        Math.max(0, Math.min(TERRAIN_LENGTH - 500, prev + e.deltaX + e.deltaY)),
      )
    },
    [],
  )

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      />
    </div>
  )
}

/* ─── Terrain point factory ─── */

export function createFlatPoints(height = BASE_HEIGHT): TerrainPoint[] {
  const pts: TerrainPoint[] = []
  for (let i = 0; i < POINT_COUNT; i++) {
    pts.push({ x: i * POINT_SPACING, y: height })
  }
  return pts
}

/* ─── Procedural terrain generators ─── */

function noise(x: number, seed: number): number {
  // Simple hash-based noise function
  const n = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, seed: number): number {
  const xi = Math.floor(x)
  const frac = x - xi
  const t = frac * frac * (3 - 2 * frac) // smoothstep
  return noise(xi, seed) * (1 - t) + noise(xi + 1, seed) * t
}

export function generateProceduralTerrain(
  frequency: number,
  amplitude: number,
  octaves: number,
  seed: number,
): TerrainPoint[] {
  const pts: TerrainPoint[] = []
  for (let i = 0; i < POINT_COUNT; i++) {
    const x = i * POINT_SPACING
    let y = BASE_HEIGHT
    let amp = amplitude
    let freq = frequency

    for (let o = 0; o < octaves; o++) {
      y += (smoothNoise(x * freq / TERRAIN_LENGTH, seed + o * 100) - 0.5) * 2 * amp
      amp *= 0.5
      freq *= 2
    }

    pts.push({ x, y: Math.max(5, Math.min(MAX_HEIGHT - 5, y)) })
  }
  return pts
}

/* ─── Preset terrains ─── */

export function getPresetTerrain(preset: string): TerrainPoint[] {
  switch (preset) {
    case 'rolling-hills':
      return generateProceduralTerrain(3, 40, 3, 42)
    case 'staircase': {
      const pts: TerrainPoint[] = []
      for (let i = 0; i < POINT_COUNT; i++) {
        const x = i * POINT_SPACING
        const step = Math.floor(x / 200) * 15
        pts.push({ x, y: BASE_HEIGHT + step % 90 })
      }
      return pts
    }
    case 'canyon': {
      const pts: TerrainPoint[] = []
      for (let i = 0; i < POINT_COUNT; i++) {
        const x = i * POINT_SPACING
        const inCanyon = (x % 400) > 150 && (x % 400) < 250
        pts.push({ x, y: inCanyon ? 15 : BASE_HEIGHT + 20 })
      }
      return pts
    }
    case 'spike-field':
      return generateProceduralTerrain(8, 50, 2, 123)
    case 'gentle-slope': {
      const pts: TerrainPoint[] = []
      for (let i = 0; i < POINT_COUNT; i++) {
        const x = i * POINT_SPACING
        pts.push({ x, y: BASE_HEIGHT + (x / TERRAIN_LENGTH) * 60 })
      }
      return pts
    }
    default:
      return createFlatPoints()
  }
}

/* ─── Difficulty score (0-100) ─── */

export function computeDifficulty(points: TerrainPoint[]): number {
  if (points.length < 2) return 0

  let totalSlope = 0
  let maxSlope = 0
  let variance = 0
  const meanY = points.reduce((s, p) => s + p.y, 0) / points.length

  for (let i = 1; i < points.length; i++) {
    const slope = Math.abs(points[i].y - points[i - 1].y) / POINT_SPACING
    totalSlope += slope
    if (slope > maxSlope) maxSlope = slope
    variance += (points[i].y - meanY) ** 2
  }

  variance /= points.length
  const avgSlope = totalSlope / (points.length - 1)

  // Normalize components to 0-100 and combine
  const slopeScore = Math.min(avgSlope * 200, 40)
  const peakScore = Math.min(maxSlope * 50, 30)
  const varScore = Math.min(Math.sqrt(variance) / 2, 30)

  return Math.round(slopeScore + peakScore + varScore)
}
