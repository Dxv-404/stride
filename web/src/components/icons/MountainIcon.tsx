/**
 * MountainIcon — Terrain Editor page icon.
 *
 * Shape: mountain peaks with terrain line.
 * Hover: peaks reshape (grow then settle).
 * Active: tallest peak subtly breathes.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, false, false, false, true,  false, false],
  [false, false, false, true,  true,  false, false],
  [false, true,  false, true,  false, true,  false],
  [false, true,  true,  false, false, true,  false],
  [true,  true,  false, false, false, false, true ],
  [true,  false, false, false, false, false, true ],
  [true,  true,  true,  true,  true,  true,  true ],
]

interface MountainIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function MountainIcon({ size = 18, state = 'static' }: MountainIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Peaks grow upward briefly
      const peakDots = ['0-4', '1-3', '1-4', '2-1', '2-5']
      const reshapes: Record<string, DotOverride> = {}
      for (const key of peakDots) {
        const [r, c] = key.split('-').map(Number)
        const cy = r * cellSize + cellSize / 2
        reshapes[key] = {
          variants: {
            hover: { cy: [cy, cy - cellSize * 0.6, cy] },
          },
          animate: 'hover',
          transition: { duration: 0.5, ease: 'easeOut' },
        }
        void c // used above in key parsing
      }
      return reshapes
    }
    if (state === 'active') {
      // Tallest peak breathes
      const cy = 0 * cellSize + cellSize / 2
      return {
        '0-4': {
          variants: {
            active: { cy: [cy, cy - cellSize * 0.25, cy] },
          },
          animate: 'active',
          transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        },
      }
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
