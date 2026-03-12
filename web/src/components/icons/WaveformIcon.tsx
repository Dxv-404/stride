/**
 * WaveformIcon — Playground page icon.
 *
 * Shape: sine wave across the grid.
 * Hover: wave morphs (dots shift vertically).
 * Active: single crest perpetually oscillates.
 */

import { useMemo } from 'react'
import DotMatrixIcon, { type DotGrid, type DotOverride } from './DotMatrixIcon'

// prettier-ignore
const GRID: DotGrid = [
  [false, false, true,  false, false, false, false],
  [false, true,  false, true,  false, false, false],
  [false, true,  false, false, false, false, false],
  [true,  false, false, false, false, false, true ],
  [false, false, false, false, false, true,  false],
  [false, false, false, true,  false, true,  false],
  [false, false, false, false, true,  false, false],
]

interface WaveformIconProps {
  size?: number
  state?: 'static' | 'hover' | 'active'
}

export default function WaveformIcon({ size = 18, state = 'static' }: WaveformIconProps) {
  const cellSize = size / 7

  const overrides = useMemo<Record<string, DotOverride>>(() => {
    if (state === 'hover') {
      // Wave morphs — top crest dots shift down, trough dots shift up
      const morphs: Record<string, DotOverride> = {}
      const topDots = [
        { key: '0-2', dir: 1 },
        { key: '1-1', dir: 0.5 },
        { key: '1-3', dir: 0.5 },
      ]
      const bottomDots = [
        { key: '6-4', dir: -1 },
        { key: '5-3', dir: -0.5 },
        { key: '5-5', dir: -0.5 },
      ]
      for (const dot of [...topDots, ...bottomDots]) {
        const [r] = dot.key.split('-').map(Number)
        const cy = r * cellSize + cellSize / 2
        morphs[dot.key] = {
          variants: {
            hover: { cy: cy + cellSize * dot.dir },
          },
          animate: 'hover',
          transition: { duration: 0.5, ease: 'easeInOut' },
        }
      }
      return morphs
    }
    if (state === 'active') {
      // Crest dot oscillates
      const cy = 0 * cellSize + cellSize / 2
      return {
        '0-2': {
          variants: {
            active: { cy: [cy, cy + cellSize * 0.5, cy] },
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
