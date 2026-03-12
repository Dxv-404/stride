/**
 * FlaskIcon — Lab page icon.
 *
 * Shape: Erlenmeyer flask silhouette.
 * Hover: bubbles rise from the liquid.
 * Active: single bubble perpetually drifts upward (3s cycle).
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, false, true,  true,  true,  false, false],
  [false, false, true,  false, true,  false, false],
  [false, false, true,  false, true,  false, false],
  [false, true,  true,  false, true,  true,  false],
  [true,  true,  false, true,  false, true,  true ],
  [true,  true,  true,  true,  true,  true,  true ],
  [false, true,  true,  true,  true,  true,  false],
]

interface FlaskIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function FlaskIcon({ size = 18, state = 'static' }: FlaskIconProps) {
  const overrides = useMemo((): Record<string, DotOverride> => {
    if (state === 'hover') {
      // Bubbles rise: dots at 4-3 and 5-4 animate upward
      const o: Record<string, DotOverride> = {
        '4-3': {
          variants: { hover: { cy: [0, -2], opacity: [1, 0] } },
          animate: 'hover',
          transition: { duration: 0.6, ease: 'easeOut' },
        },
        '5-2': {
          variants: { hover: { cy: [0, -3], opacity: [1, 0] } },
          animate: 'hover',
          transition: { duration: 0.8, ease: 'easeOut', delay: 0.15 },
        },
      }
      return o
    }
    if (state === 'active') {
      // Single bubble drifts
      const o: Record<string, DotOverride> = {
        '4-3': {
          variants: { active: { cy: [0, -2], opacity: [1, 0, 1] } },
          animate: 'active',
          transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        },
      }
      return o
    }
    return {}
  }, [state])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
