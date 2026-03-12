/**
 * BarChartIcon — Results page icon.
 *
 * Shape: three vertical bars of ascending height.
 * Hover: bars grow from zero to full height.
 * Active: tallest bar perpetually pulses.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, false, false, false, false, true,  false],
  [false, false, false, false, false, true,  false],
  [false, false, false, true,  false, true,  false],
  [false, false, false, true,  false, true,  false],
  [false, true,  false, true,  false, true,  false],
  [false, true,  false, true,  false, true,  false],
  [true,  true,  true,  true,  true,  true,  true ],
]

interface BarChartIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function BarChartIcon({ size = 18, state = 'static' }: BarChartIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Bars grow from bottom: each dot scales up from 0
      const barDots = [
        '4-1', '5-1',           // short bar
        '2-3', '3-3', '4-3', '5-3', // medium bar
        '0-5', '1-5', '2-5', '3-5', '4-5', '5-5', // tall bar
      ]
      const grows: Record<string, DotOverride> = {}
      for (const key of barDots) {
        const [r] = key.split('-').map(Number)
        // Delay based on row: lower rows appear first
        const delay = (6 - r) * 0.06
        grows[key] = {
          variants: {
            hover: { r: [0, cellSize * 0.35] },
          },
          animate: 'hover',
          transition: { duration: 0.3, delay, ease: 'easeOut' },
        }
      }
      return grows
    }
    if (state === 'active') {
      // Tallest bar top dot pulses
      const cy = 0 * cellSize + cellSize / 2
      return {
        '0-5': {
          variants: {
            active: { cy: [cy, cy - cellSize * 0.2, cy], opacity: [1, 0.6, 1] },
          },
          animate: 'active',
          transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        },
      }
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
