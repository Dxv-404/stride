/**
 * CreaturesIcon — Race / Compare page icon.
 *
 * Shape: three stick figures side by side.
 * Hover: figures advance forward (shift right).
 * Active: lead figure perpetually bobs.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, true,  false, false, true,  false, true ],
  [false, true,  false, false, true,  false, true ],
  [true,  true,  true,  false, true,  true,  true ],
  [false, true,  false, false, true,  false, true ],
  [false, true,  false, false, true,  false, true ],
  [true,  false, true,  true,  false, true,  false],
  [true,  false, true,  true,  false, true,  false],
]

interface CreaturesIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function CreaturesIcon({ size = 18, state = 'static' }: CreaturesIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // All figures shift slightly right
      const shifts: Record<string, DotOverride> = {}
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (GRID[r][c]) {
            shifts[`${r}-${c}`] = {
              variants: {
                hover: { cx: (c * cellSize + cellSize / 2) + cellSize * 0.3 },
              },
              animate: 'hover',
              transition: { duration: 0.4, ease: 'easeOut' },
            }
          }
        }
      }
      return shifts
    }
    if (state === 'active') {
      // Lead figure (column 6) bobs
      const bobs: Record<string, DotOverride> = {}
      for (let r = 0; r < 7; r++) {
        if (GRID[r][6]) {
          const cy = r * cellSize + cellSize / 2
          bobs[`${r}-6`] = {
            variants: {
              active: { cy: [cy, cy - cellSize * 0.3, cy] },
            },
            animate: 'active',
            transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }
        }
      }
      return bobs
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
