/**
 * DotMatrixIcon — base renderer for 7×7 dot-matrix icons.
 *
 * Renders a boolean grid as an SVG with perfect circles.
 * Supports three display states:
 *   - static:  just render the grid
 *   - hover:   Framer Motion micro-animation (0.3–2s story)
 *   - active:  perpetual ambient animation (3–5s cycle)
 *
 * Each concrete icon provides its own grid and animation overrides.
 */

import { motion, type Variants } from 'framer-motion'

/* ─── Types ─── */

export type DotGrid = boolean[][]

export interface DotOverride {
  /** Framer Motion variants keyed by state name */
  variants?: Variants
  /** Which variant to animate to */
  animate?: string
  /** Transition overrides */
  transition?: Record<string, unknown>
}

export interface DotMatrixIconProps {
  /** 7×7 boolean grid — true = dot visible */
  grid: DotGrid
  /** Icon size in pixels (default 18) */
  size?: number
  /** Display state */
  state?: 'static' | 'hover' | 'active'
  /** Per-dot animation overrides, keyed by "row-col" (e.g. "2-3") */
  dotOverrides?: Record<string, DotOverride>
  /** Additional CSS class */
  className?: string
}

/* ─── Constants ─── */

const GRID_SIZE = 7
const DOT_RADIUS_FRACTION = 0.35 // radius as fraction of cell size

/* ─── Component ─── */

export default function DotMatrixIcon({
  grid,
  size = 18,
  state = 'static',
  dotOverrides = {},
  className = '',
}: DotMatrixIconProps) {
  const cellSize = size / GRID_SIZE
  const dotRadius = cellSize * DOT_RADIUS_FRACTION

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      className={className}
    >
      {grid.map((row, r) =>
        row.map((on, c) => {
          if (!on) return null

          const cx = c * cellSize + cellSize / 2
          const cy = r * cellSize + cellSize / 2
          const key = `${r}-${c}`
          const override = dotOverrides[key]

          // Static rendering — no motion wrapper needed
          if (state === 'static' && !override) {
            return (
              <circle
                key={key}
                cx={cx}
                cy={cy}
                r={dotRadius}
                fill="currentColor"
              />
            )
          }

          return (
            <motion.circle
              key={key}
              cx={cx}
              cy={cy}
              r={dotRadius}
              fill="currentColor"
              variants={override?.variants}
              animate={
                override?.animate
                  ? override.animate
                  : state === 'static'
                    ? 'static'
                    : undefined
              }
              transition={override?.transition}
            />
          )
        }),
      )}
    </svg>
  )
}
