/**
 * MutationVisualizer — Briefly flashes mutated genes in a chromosome bar.
 *
 * When a mutation occurs, highlights the changed gene indices with an accent
 * color flash that fades over 1 second.
 */

import { useState, useEffect, useRef } from 'react'

interface MutationVisualizerProps {
  /** Current chromosome genes */
  genes: number[]
  /** Indices of genes that were recently mutated */
  mutatedIndices: number[]
  /** Accent color for highlighting */
  accentColor?: string
  /** Height of the bar */
  height?: number
}

export default function MutationVisualizer({
  genes,
  mutatedIndices,
  accentColor = '#F59E0B',
  height = 12,
}: MutationVisualizerProps) {
  const [activeFlash, setActiveFlash] = useState<Set<number>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Flash newly mutated indices
  useEffect(() => {
    if (mutatedIndices.length === 0) return

    setActiveFlash(new Set(mutatedIndices))

    // Clear flash after 1 second
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setActiveFlash(new Set())
    }, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [mutatedIndices])

  if (genes.length === 0) return null

  const segW = 100 / genes.length

  return (
    <div className="w-full" style={{ height }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {genes.map((gene, i) => {
          const isMutated = activeFlash.has(i)
          const intensity = 0.15 + gene * 0.55

          return (
            <rect
              key={i}
              x={i * segW}
              y={0}
              width={segW}
              height={height}
              fill={isMutated ? accentColor : `rgba(136, 136, 136, ${intensity})`}
              opacity={isMutated ? 1 : 0.7}
            >
              {isMutated && (
                <animate
                  attributeName="opacity"
                  from="1"
                  to="0.3"
                  dur="1s"
                  fill="freeze"
                />
              )}
            </rect>
          )
        })}
      </svg>
    </div>
  )
}
