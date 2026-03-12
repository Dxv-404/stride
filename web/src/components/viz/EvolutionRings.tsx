/**
 * EvolutionRings — Concentric rings visualization where each ring = one generation.
 *
 * Dots on each ring = individuals in that generation. Best individual highlighted.
 * Creates a mandala-like pattern showing evolutionary progress.
 * Hover any dot to see generation stats.
 */

import { useMemo, useRef, useState } from 'react'

interface RingData {
  generation: number
  best: number
  avg: number
  count?: number
}

interface EvolutionRingsProps {
  /** Fitness history: one entry per generation */
  data: RingData[]
  /** Accent color */
  accentColor?: string
  /** Size in pixels */
  size?: number
}

interface TooltipState {
  x: number
  y: number
  gen: number
  best: number
  avg: number
  isBest: boolean
}

export default function EvolutionRings({
  data,
  accentColor = '#F59E0B',
  size = 350,
}: EvolutionRingsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const cx = size / 2
  const cy = size / 2
  const maxRadius = size * 0.45
  const minRadius = 20

  const { rings } = useMemo(() => {
    const maxFit = Math.max(1, ...data.map(d => d.best))
    const rings = data.map((d, i) => {
      const radius = minRadius + ((i + 1) / data.length) * (maxRadius - minRadius)
      const fitNorm = d.best / maxFit
      const avgNorm = d.avg / maxFit
      // Place dots around the ring based on fitness distribution
      const dotCount = d.count ?? Math.max(4, Math.min(24, Math.round(8 + avgNorm * 16)))
      const dots = Array.from({ length: dotCount }, (_, j) => {
        const angle = (j / dotCount) * Math.PI * 2 - Math.PI / 2
        // Vary dot distance from center based on individual fitness
        const jitter = (Math.sin(j * 137.508) * 0.5 + 0.5) * avgNorm
        const r = radius + (jitter - 0.5) * 6
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          isBest: j === 0,
        }
      })

      return { ...d, radius, fitNorm, avgNorm, dots }
    })

    return { maxFitness: maxFit, rings }
  }, [data, cx, cy, maxRadius])

  const handleDotEnter = (e: React.MouseEvent, ringIdx: number, isBest: boolean) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const ring = rings[ringIdx]
    if (!ring) return
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      gen: ring.generation,
      best: ring.best,
      avg: ring.avg,
      isBest,
    })
  }

  const handleDotLeave = () => setTooltip(null)

  if (data.length === 0) {
    return (
      <div className="text-center text-text-dim text-xs py-8">
        No generation data. Run evolution to see the rings form.
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <svg width={size} height={size} className="w-full h-auto" viewBox={`0 0 ${size} ${size}`}>
        {/* Background rings */}
        {rings.map((ring, i) => (
          <circle
            key={`ring-${i}`}
            cx={cx} cy={cy} r={ring.radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={0.3}
            opacity={0.1 + ring.fitNorm * 0.15}
          />
        ))}

        {/* Dots on each ring */}
        {rings.map((ring, i) =>
          ring.dots.map((dot, j) => (
            <circle
              key={`dot-${i}-${j}`}
              cx={dot.x} cy={dot.y}
              r={dot.isBest ? 3 : 1.5}
              fill={accentColor}
              opacity={dot.isBest ? 0.9 : 0.2 + ring.avgNorm * 0.4}
              className="cursor-pointer"
              onMouseEnter={e => handleDotEnter(e, i, dot.isBest)}
              onMouseLeave={handleDotLeave}
            />
          ))
        )}

        {/* Best fitness spiral line connecting best dots */}
        {rings.length > 1 && (
          <polyline
            points={rings.map(r => `${r.dots[0].x},${r.dots[0].y}`).join(' ')}
            fill="none"
            stroke={accentColor}
            strokeWidth={1}
            opacity={0.4}
          />
        )}

        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={8} fill="#888" fontFamily="monospace">
          GEN 0
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={7} fill="#555" fontFamily="monospace">
          {data.length} gens
        </text>

        {/* Outer ring label */}
        <text
          x={cx} y={cy - maxRadius - 8}
          textAnchor="middle" fontSize={7} fill="#555" fontFamily="monospace"
        >
          Best: {data[data.length - 1]?.best.toFixed(0)}
        </text>
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
            Gen {tooltip.gen}
          </p>
          <div className="space-y-1">
            <p className="font-mono text-[10px] text-text-secondary">
              Best{' '}<span className="text-text-primary ml-2">{tooltip.best.toFixed(1)}</span>
            </p>
            <p className="font-mono text-[10px] text-text-secondary">
              Avg{' '}<span className="text-text-primary ml-2">{tooltip.avg.toFixed(1)}</span>
            </p>
          </div>
          {tooltip.isBest && (
            <p className="font-mono text-[9px] text-accent mt-1.5 tracking-wider uppercase">Top individual</p>
          )}
        </div>
      )}
    </div>
  )
}
