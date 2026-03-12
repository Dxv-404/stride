/**
 * FootprintTrails — Fading footprint marks on the ground surface.
 *
 * Small dots at foot contact points that fade over ~3 seconds.
 * Called from the canvas render loop.
 */

export interface Footprint {
  x: number
  y: number
  timestamp: number
  opacity: number
}

const MAX_FOOTPRINTS = 100
const FOOTPRINT_LIFETIME = 3000 // ms

export class FootprintTrailSystem {
  private footprints: Footprint[] = []

  /** Record a new footprint at the given position */
  addFootprint(x: number, y: number) {
    this.footprints.push({
      x, y,
      timestamp: performance.now(),
      opacity: 0.4,
    })

    // Trim old footprints
    if (this.footprints.length > MAX_FOOTPRINTS) {
      this.footprints = this.footprints.slice(-MAX_FOOTPRINTS)
    }
  }

  /** Draw all footprints, fading old ones */
  draw(
    ctx: CanvasRenderingContext2D,
    toScreenX: (wx: number) => number,
    toScreenY: (wy: number) => number,
    zoom: number,
  ) {
    const now = performance.now()

    // Remove expired footprints
    this.footprints = this.footprints.filter(fp => now - fp.timestamp < FOOTPRINT_LIFETIME)

    for (const fp of this.footprints) {
      const age = now - fp.timestamp
      const fadeT = 1 - age / FOOTPRINT_LIFETIME
      if (fadeT <= 0) continue

      const screenX = toScreenX(fp.x)
      const screenY = toScreenY(fp.y)

      ctx.globalAlpha = fadeT * 0.3
      ctx.fillStyle = '#888'
      ctx.beginPath()
      ctx.ellipse(screenX, screenY, 2 * zoom * 0.4, 1 * zoom * 0.4, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1
  }

  /** Clear all footprints */
  clear() {
    this.footprints = []
  }
}
