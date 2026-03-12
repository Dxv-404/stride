/**
 * ChromosomeBar — Persistent thin bar showing chromosome as colored segments.
 *
 * Each segment = one gene. Color intensity maps to gene value (0→dim, 1→bright).
 * Optionally expandable to show full gene values.
 */

import { useState } from 'react'

interface ChromosomeBarProps {
  /** Gene values (0-1 range) */
  genes: number[]
  /** Accent color for the bar */
  accentColor?: string
  /** Whether the bar is expandable on click */
  expandable?: boolean
  /** Gene labels for expanded view */
  geneLabels?: string[]
}

export default function ChromosomeBar({
  genes,
  accentColor = '#F59E0B',
  expandable = true,
  geneLabels,
}: ChromosomeBarProps) {
  const [expanded, setExpanded] = useState(false)

  if (genes.length === 0) return null

  return (
    <div className="w-full">
      {/* Thin bar */}
      <div
        className={`w-full h-2 flex ${expandable ? 'cursor-pointer' : ''}`}
        onClick={() => expandable && setExpanded(e => !e)}
        title={expandable ? 'Click to expand chromosome view' : undefined}
      >
        {genes.map((gene, i) => (
          <div
            key={i}
            className="flex-1 min-w-0"
            style={{
              backgroundColor: accentColor,
              opacity: 0.1 + gene * 0.7,
            }}
          />
        ))}
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="mt-1 p-2 border border-border bg-bg-surface">
          <div className="text-[8px] font-medium uppercase tracking-wider text-text-muted mb-1">
            Chromosome — {genes.length} genes
          </div>
          <div className="flex flex-wrap gap-0.5">
            {genes.map((gene, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ width: Math.max(16, 100 / genes.length) + '%' }}
              >
                <div
                  className="w-full h-4"
                  style={{
                    backgroundColor: accentColor,
                    opacity: 0.15 + gene * 0.7,
                  }}
                />
                <span className="text-[6px] font-mono text-text-dim mt-0.5 truncate w-full text-center">
                  {geneLabels?.[i] || `g${i}`}
                </span>
                <span className="text-[6px] font-mono" style={{ color: accentColor }}>
                  {gene.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
