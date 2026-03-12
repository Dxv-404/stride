/**
 * fitnessGrid — utility to build fitness grids from epistasis data.
 *
 * Extracted from FitnessLandscape3D to avoid pulling Three.js/drei
 * into non-3D code paths.
 */

const GRID_RES = 32

/** Build a fitness grid from epistasis matrix data */
export function buildGridFromEpistasis(matrix: number[][], geneIdxA: number, geneIdxB: number): number[][] {
  const size = GRID_RES
  const grid: number[][] = []
  const baseVal = matrix[geneIdxA]?.[geneIdxB] ?? 0

  for (let i = 0; i < size; i++) {
    const row: number[] = []
    for (let j = 0; j < size; j++) {
      const x = i / (size - 1)
      const y = j / (size - 1)
      const interaction = baseVal * Math.sin(x * Math.PI) * Math.sin(y * Math.PI) * 100
      const base = 50 * (1 - (x - 0.5) ** 2 - (y - 0.5) ** 2)
      row.push(Math.max(0, base + interaction))
    }
    grid.push(row)
  }

  return grid
}
