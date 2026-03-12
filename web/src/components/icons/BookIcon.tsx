/**
 * BookIcon — About / Learn page icon.
 *
 * Shape: open book with text lines.
 * Hover: page flips — dots on right page shimmer.
 * Active: a single line on the page fades in and out.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [true,  true,  true,  false, true,  true,  true ],
  [true,  false, true,  false, true,  false, true ],
  [true,  false, true,  false, true,  true,  true ],
  [true,  true,  true,  false, true,  false, true ],
  [true,  false, false, false, true,  true,  true ],
  [true,  true,  true,  false, true,  false, true ],
  [true,  true,  true,  true,  true,  true,  true ],
]

interface BookIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function BookIcon({ size = 18, state = 'static' }: BookIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Right page dots shimmer — cascade opacity
      const rightPageDots = [
        '1-4', '1-6',
        '2-4', '2-5', '2-6',
        '3-4', '3-6',
        '4-4', '4-5', '4-6',
        '5-4', '5-6',
      ]
      const shimmers: Record<string, DotOverride> = {}
      rightPageDots.forEach((key, i) => {
        shimmers[key] = {
          variants: {
            hover: { opacity: [0.2, 1] },
          },
          animate: 'hover',
          transition: { duration: 0.3, delay: i * 0.04, ease: 'easeOut' },
        }
      })
      return shimmers
    }
    if (state === 'active') {
      // Single text line fades
      const lineDots = ['3-1', '3-2']
      const fades: Record<string, DotOverride> = {}
      for (const key of lineDots) {
        fades[key] = {
          variants: {
            active: { opacity: [1, 0.3, 1] },
          },
          animate: 'active',
          transition: { duration: 3.5, repeat: Infinity, ease: 'easeInOut' },
        }
      }
      return fades
    }
    return {}
  }, [state, cellSize])

  return <DotMatrixIcon grid={GRID} size={size} state={state} dotOverrides={overrides} />
}
