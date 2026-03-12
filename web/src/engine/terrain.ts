/**
 * Terrain generators -- pure height functions and point generation.
 *
 * Ported from Python terrain.py.
 * NO p2.js dependency -- physics.ts handles adding terrain to the world.
 *
 * Terrain types:
 *  - flat:   constant y = 50
 *  - hill:   single sine bump at x in [300, 500]
 *  - mixed:  repeating hills every 600 px
 *  - custom: linearly interpolated from user-supplied points
 */

import type { TerrainPoint } from './types.ts'

/* ─── Public interface ─── */

export interface Terrain {
  /** Terrain type identifier */
  type: string
  /** Return ground height at a given x coordinate (px) */
  getHeight(x: number): number
  /** Generate an array of (x,y) sample points for rendering / physics creation */
  getPoints(xMin: number, xMax: number, step?: number): TerrainPoint[]
}

/* ─── Flat terrain ─── */

export function createFlatTerrain(): Terrain {
  return {
    type: 'flat',
    getHeight: () => 50,
    getPoints(xMin: number, xMax: number, step = 20): TerrainPoint[] {
      const pts: TerrainPoint[] = []
      for (let x = xMin; x <= xMax; x += step) {
        pts.push({ x, y: 50 })
      }
      return pts
    },
  }
}

/* ─── Single hill terrain ─── */

export function createHillTerrain(): Terrain {
  const getHeight = (x: number): number => {
    // Sine bump from x = 300 to x = 500, peak amplitude 50
    if (x >= 300 && x <= 500) {
      return 50 + 50 * Math.sin((Math.PI * (x - 300)) / 200)
    }
    return 50
  }

  return {
    type: 'hill',
    getHeight,
    getPoints(xMin: number, xMax: number, step = 4): TerrainPoint[] {
      const pts: TerrainPoint[] = []
      for (let x = xMin; x <= xMax; x += step) {
        pts.push({ x, y: getHeight(x) })
      }
      return pts
    },
  }
}

/* ─── Mixed / repeating hills terrain ─── */

export function createMixedTerrain(): Terrain {
  const getHeight = (x: number): number => {
    // Wrap x into [0, 600) to create repeating hills
    const xMod = ((x % 600) + 600) % 600
    if (xMod >= 300 && xMod <= 500) {
      return 50 + 50 * Math.sin((Math.PI * (xMod - 300)) / 200)
    }
    return 50
  }

  return {
    type: 'mixed',
    getHeight,
    getPoints(xMin: number, xMax: number, step = 4): TerrainPoint[] {
      const pts: TerrainPoint[] = []
      for (let x = xMin; x <= xMax; x += step) {
        pts.push({ x, y: getHeight(x) })
      }
      return pts
    },
  }
}

/* ─── Custom terrain from user-defined control points ─── */

export function createCustomTerrain(points: TerrainPoint[]): Terrain {
  // Sort control points by x for binary-search interpolation
  const sorted = [...points].sort((a, b) => a.x - b.x)

  const getHeight = (x: number): number => {
    if (sorted.length === 0) return 50
    if (x <= sorted[0].x) return sorted[0].y
    if (x >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y

    // Binary search for the interval containing x, then lerp
    let lo = 0
    let hi = sorted.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (sorted[mid].x <= x) lo = mid
      else hi = mid
    }

    const t = (x - sorted[lo].x) / (sorted[hi].x - sorted[lo].x)
    return sorted[lo].y + t * (sorted[hi].y - sorted[lo].y)
  }

  return {
    type: 'custom',
    getHeight,
    getPoints(): TerrainPoint[] {
      return [...sorted]
    },
  }
}

/* ─── Factory ─── */

/**
 * Create a Terrain by type name.
 * Falls back to flat terrain for unknown types.
 */
export function createTerrain(
  type: string,
  customPoints?: TerrainPoint[],
): Terrain {
  switch (type) {
    case 'flat':
      return createFlatTerrain()
    case 'hill':
      return createHillTerrain()
    case 'mixed':
      return createMixedTerrain()
    case 'custom':
      if (!customPoints?.length) return createFlatTerrain()
      return createCustomTerrain(customPoints)
    default:
      return createFlatTerrain()
  }
}
