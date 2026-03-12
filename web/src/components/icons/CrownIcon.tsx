/**
 * CrownIcon — Hall of Fame page icon.
 *
 * Shape: crown with three points.
 * Hover: crown tips sparkle (dots flash).
 * Active: slow gentle float.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, true,  false, true,  false, true,  false],
  [false, true,  false, true,  false, true,  false],
  [true,  true,  true,  true,  true,  true,  true ],
  [true,  false, true,  false, true,  false, true ],
  [true,  false, false, true,  false, false, true ],
  [true,  true,  true,  true,  true,  true,  true ],
  [false, false, false, false, false, false, false],
]

interface CrownIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function CrownIcon({ size = 18, state = 'static' }: CrownIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Crown tips sparkle — three top dots flash in sequence
      const tips = ['0-1', '0-3', '0-5']
      const sparkles: Record<string, DotOverride> = {}
      tips.forEach((key, i) => {
        sparkles[key] = {
          variants: {
            hover: { r: [cellSize * 0.35, cellSize * 0.5, cellSize * 0.35] },
          },
          animate: 'hover',
          transition: { duration: 0.4, delay: i * 0.12, ease: 'easeOut' },
        }
      })
      return sparkles
    }
    if (state === 'active') {
      // Gentle float — entire crown area dots shift up slightly
      const allDots = [
        '0-1', '0-3', '0-5',
        '1-1', '1-3', '1-5',
        '2-0', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6',
        '3-0', '3-2', '3-4', '3-6',
        '4-0', '4-3', '4-6',
        '5-0', '5-1', '5-2', '5-3', '5-4', '5-5', '5-6',
      ]
      const floats: Record<string, DotOverride> = {}
      for (const key of allDots) {
        const [r] = key.split('-').map(Number)
        const cy = r * cellSize + cellSize / 2
        floats[key] = {
          variants: {
            active: { cy: [cy, cy - cellSize * 0.15, cy] },
          },
          animate: 'active',
          transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
        }
      }
      return floats
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
