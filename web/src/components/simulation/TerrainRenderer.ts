/**
 * Terrain renderer — draws the ground surface using PixiJS Graphics.
 *
 * Draws in WORLD coordinates (Y-up). The parent container handles
 * the camera transform (scale.y = -zoom flips Y automatically).
 *
 * Visual layers:
 *  1. Filled earth polygon (dark surface color)
 *  2. Terrain surface line (slightly brighter)
 *  3. Subtle grid lines for depth perception
 */

import { Graphics, Container } from 'pixi.js'
import type { Terrain } from '@/engine/terrain.ts'

/** Read terrain colors from CSS theme variables */
function getTerrainColors() {
  const s = getComputedStyle(document.documentElement)
  const hex = (v: string, fallback: number) => {
    const val = s.getPropertyValue(v).trim()
    if (val.startsWith('#') && val.length === 7) return parseInt(val.slice(1), 16)
    return fallback
  }
  return {
    fill: hex('--color-canvas-ground-fill', 0x151515),
    stroke: hex('--color-canvas-ground', 0x2A2A2A),
    grid: hex('--color-border', 0x1E1E1E),
    highlight: hex('--color-accent', 0xC4956A),
  }
}

export class TerrainRenderer {
  readonly container: Container
  private fillGfx: Graphics
  private lineGfx: Graphics
  private gridGfx: Graphics

  /** Cached terrain reference */
  private terrain: Terrain | null = null

  /** World X range to render */
  private xMin = -200
  private xMax = 3000

  constructor() {
    this.container = new Container()

    this.gridGfx = new Graphics()
    this.fillGfx = new Graphics()
    this.lineGfx = new Graphics()

    this.container.addChild(this.gridGfx)
    this.container.addChild(this.fillGfx)
    this.container.addChild(this.lineGfx)
  }

  /** Set the terrain to render */
  setTerrain(terrain: Terrain): void {
    this.terrain = terrain
    this.redraw()
  }

  /** Set the world X range to draw */
  setRange(xMin: number, xMax: number): void {
    this.xMin = xMin
    this.xMax = xMax
    this.redraw()
  }

  /** Fully redraw the terrain (call when terrain changes, not every frame) */
  redraw(): void {
    if (!this.terrain) return

    const colors = getTerrainColors()
    const step = 4
    const points = this.terrain.getPoints(this.xMin, this.xMax, step)
    if (points.length < 2) return

    // --- Grid lines (vertical, for depth perception) ---
    this.gridGfx.clear()
    const gridSpacing = 100
    const gridStart = Math.ceil(this.xMin / gridSpacing) * gridSpacing
    for (let gx = gridStart; gx <= this.xMax; gx += gridSpacing) {
      const gy = this.terrain.getHeight(gx)
      this.gridGfx
        .moveTo(gx, gy)
        .lineTo(gx, gy - 500)
        .stroke({ width: 0.5, color: colors.grid, alpha: 0.2 })
    }

    // --- Filled earth polygon ---
    this.fillGfx.clear()
    const yFloor = -500

    this.fillGfx.moveTo(points[0].x, yFloor)
    for (const pt of points) {
      this.fillGfx.lineTo(pt.x, pt.y)
    }
    this.fillGfx.lineTo(points[points.length - 1].x, yFloor)
    this.fillGfx.closePath()
    this.fillGfx.fill({ color: colors.fill, alpha: 1 })

    // --- Surface line ---
    this.lineGfx.clear()
    this.lineGfx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.lineGfx.lineTo(points[i].x, points[i].y)
    }
    this.lineGfx.stroke({ width: 1.5, color: colors.stroke })

    // Subtle accent highlight
    this.lineGfx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.lineGfx.lineTo(points[i].x, points[i].y)
    }
    this.lineGfx.stroke({ width: 0.5, color: colors.highlight, alpha: 0.15 })
  }

  destroy(): void {
    this.container.destroy({ children: true })
  }
}
