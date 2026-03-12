/**
 * PopulationSwarm — Animated 2D scatter showing population diversity and convergence.
 *
 * Each dot = one creature. X = gene similarity, Y = fitness.
 * Dots cluster as population converges. Hover for details.
 */

import { useState, useEffect, useRef } from 'react'

interface SwarmPoint {
  id: number
  x: number // normalized [0,1] — e.g., PCA dimension or gene mean
  y: number // fitness (normalized to [0,1])
  isBest: boolean
}

interface PopulationSwarmProps {
  /** Current population snapshot */
  points: SwarmPoint[]
  /** Accent color */
  accentColor?: string
  /** Width of SVG */
  width?: number
  /** Height of SVG */
  height?: number
}

interface TooltipState {
  x: number
  y: number
  id: number
  fitness: number
  diversity: number
  isBest: boolean
}

export default function PopulationSwarm({
  points,
  accentColor = '#F59E0B',
  width = 400,
  height = 250,
}: PopulationSwarmProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const padX = 40
  const padY = 25
  const plotW = width - padX * 2
  const plotH = height - padY * 2

  // Animate dot transitions
  const [animatedPoints, setAnimatedPoints] = useState(points)
  const prevPointsRef = useRef(points)

  useEffect(() => {
    // Smoothly transition to new positions
    const start = performance.now()
    const duration = 500
    const prev = prevPointsRef.current

    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = t * t * (3 - 2 * t) // smoothstep

      const interpolated = points.map((p, i) => {
        const oldP = prev[i] ?? p
        return {
          ...p,
          x: oldP.x + (p.x - oldP.x) * eased,
          y: oldP.y + (p.y - oldP.y) * eased,
        }
      })
      setAnimatedPoints(interpolated)

      if (t < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    prevPointsRef.current = points
  }, [points])

  const handleDotEnter = (e: React.MouseEvent, point: SwarmPoint) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      id: point.id,
      fitness: point.y,
      diversity: point.x,
      isBest: point.isBest,
    })
  }

  const handleDotLeave = () => setTooltip(null)

  if (points.length === 0) {
    return (
      <div className="text-center text-text-dim text-xs py-8">
        No population data available.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <svg width={width} height={height} className="w-full h-auto" viewBox={`0 0 ${width} ${height}`}>
        {/* Background grid */}
        {[0.25, 0.5, 0.75].map(v => (
          <g key={`grid-${v}`}>
            <line
              x1={padX + v * plotW} y1={padY}
              x2={padX + v * plotW} y2={padY + plotH}
              stroke="#222" strokeWidth={0.5}
            />
            <line
              x1={padX} y1={padY + v * plotH}
              x2={padX + plotW} y2={padY + v * plotH}
              stroke="#222" strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Axes */}
        <line x1={padX} y1={padY + plotH} x2={padX + plotW} y2={padY + plotH} stroke="#444" strokeWidth={1} />
        <line x1={padX} y1={padY} x2={padX} y2={padY + plotH} stroke="#444" strokeWidth={1} />

        {/* Axis labels */}
        <text x={padX + plotW / 2} y={height - 4} textAnchor="middle" fontSize={8} fill="#555" fontFamily="monospace">
          Gene Similarity
        </text>
        <text
          x={8} y={padY + plotH / 2}
          textAnchor="middle" fontSize={8} fill="#555" fontFamily="monospace"
          transform={`rotate(-90, 8, ${padY + plotH / 2})`}
        >
          Fitness
        </text>

        {/* Points */}
        {animatedPoints.map((p, i) => {
          const px = padX + p.x * plotW
          const py = padY + plotH - p.y * plotH
          const originalPoint = points[i] ?? p

          return (
            <g key={p.id}>
              {p.isBest && (
                <circle cx={px} cy={py} r={6} fill={accentColor} opacity={0.15} />
              )}
              <circle
                cx={px} cy={py}
                r={p.isBest ? 4 : 2.5}
                fill={accentColor}
                opacity={p.isBest ? 0.9 : 0.4}
                stroke={p.isBest ? accentColor : 'none'}
                strokeWidth={p.isBest ? 1 : 0}
                className="cursor-pointer"
                onMouseEnter={e => handleDotEnter(e, originalPoint)}
                onMouseLeave={handleDotLeave}
              />
            </g>
          )
        })}
      </svg>

      {/* Tooltip overlay */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 border border-border bg-bg-surface px-3 py-2.5 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%) translateY(-10px)',
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-wider text-accent mb-1.5">
            Experiment #{tooltip.id + 1}
          </p>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-text-secondary">
              Fitness{' '}<span className="text-text-primary ml-2">{tooltip.fitness.toFixed(2)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              Diversity{' '}<span className="text-text-primary ml-2">{tooltip.diversity.toFixed(2)}</span>
            </p>
          </div>
          {tooltip.isBest && (
            <p className="font-mono text-[9px] text-accent mt-1.5 tracking-wider uppercase">Best in group</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Utility: generate swarm points from a generation snapshot */
export function buildSwarmPoints(
  creatures: { id: number; genes: number[]; fitness: number }[],
  bestId: number,
): SwarmPoint[] {
  if (creatures.length === 0) return []

  const maxFit = Math.max(1, ...creatures.map(c => c.fitness))

  return creatures.map(c => {
    // Simple gene mean as X-axis (diversity indicator)
    const geneMean = c.genes.reduce((s, g) => s + g, 0) / c.genes.length
    return {
      id: c.id,
      x: geneMean,
      y: c.fitness / maxFit,
      isBest: c.id === bestId,
    }
  })
}
