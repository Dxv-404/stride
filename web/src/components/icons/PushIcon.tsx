/**
 * PushIcon — Push Test page icon.
 *
 * Shape: stick figure with impact arrow.
 * Hover: figure rocks backward then recovers.
 * Active: impact arrow pulses.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, false, false, true,  false, false, false],
  [true,  false, false, true,  false, false, false],
  [true,  true,  true,  true,  true,  true,  false],
  [true,  false, false, true,  false, false, false],
  [false, false, false, true,  false, false, false],
  [false, false, true,  false, true,  false, false],
  [false, true,  false, false, false, true,  false],
]

interface PushIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function PushIcon({ size = 18, state = 'static' }: PushIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Figure rocks right then recovers — body column shifts
      const bodyDots = ['0-3', '1-3', '2-3', '2-4', '2-5', '3-3', '4-3']
      const shifts: Record<string, DotOverride> = {}
      for (const key of bodyDots) {
        const [, c] = key.split('-').map(Number)
        const cx = c * cellSize + cellSize / 2
        shifts[key] = {
          variants: {
            hover: { cx: [cx, cx + cellSize * 0.6, cx] },
          },
          animate: 'hover',
          transition: { duration: 0.6, ease: 'easeInOut' },
        }
      }
      return shifts
    }
    if (state === 'active') {
      // Arrow pulses — left column dots
      const arrowDots = ['1-0', '2-0', '2-1', '2-2', '3-0']
      const pulses: Record<string, DotOverride> = {}
      for (const key of arrowDots) {
        pulses[key] = {
          variants: {
            active: { opacity: [1, 0.3, 1] },
          },
          animate: 'active',
          transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        }
      }
      return pulses
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
