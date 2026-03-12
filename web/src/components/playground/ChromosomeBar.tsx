/**
 * ChromosomeBar — color-coded heatmap bar of gene values.
 *
 * Each gene [0,1] is rendered as a rectangular cell.
 * Color maps from deep blue (0) → purple (0.5) → hot pink/red (1).
 * Hover shows gene name + value tooltip.
 */

import { useMemo } from 'react'

interface ChromosomeBarProps {
  genes: number[]
  labels: string[]
  /** Index of the currently hovered/selected gene (-1 = none) */
  highlightIndex?: number
  onGeneClick?: (index: number) => void
}

/** Map a [0,1] value to a hex color string (blue → purple → pink) */
function geneToColor(value: number): string {
  const t = Math.max(0, Math.min(1, value))
  // HSL: 240 (blue) → 300 (purple) → 340 (pink)
  const hue = 240 + t * 100
  const sat = 70 + t * 20
  const lit = 30 + t * 30
  return `hsl(${hue}, ${sat}%, ${lit}%)`
}

export default function ChromosomeBar({
  genes,
  labels,
  highlightIndex = -1,
  onGeneClick,
}: ChromosomeBarProps) {
  const cells = useMemo(
    () =>
      genes.map((v, i) => ({
        color: geneToColor(v),
        label: labels[i] ?? `gene_${i}`,
        value: v,
      })),
    [genes, labels],
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted uppercase tracking-wider">
        Chromosome
      </div>
      <div className="flex h-5 border border-border overflow-hidden">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="flex-1 relative cursor-pointer transition-all group"
            style={{
              backgroundColor: cell.color,
              outline: i === highlightIndex ? '2px solid #e7e7e7' : 'none',
              outlineOffset: '-1px',
            }}
            title={`${cell.label}: ${cell.value.toFixed(3)}`}
            onClick={() => onGeneClick?.(i)}
          >
            {/* Hover highlight */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/20 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  )
}
