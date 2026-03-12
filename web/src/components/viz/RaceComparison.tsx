/**
 * RaceComparison — SVG heatmap of controller performance across terrains.
 *
 * Rows = controllers, Columns = terrains (flat, hill, mixed).
 * Cell color intensity maps to mean fitness. Hover shows mean ± std.
 */

import { useState, useMemo } from 'react'

interface TransferEntry {
  mean: number
  std: number
  values: number[]
}

interface TransferData {
  [controller: string]: {
    absolute: {
      flat?: TransferEntry
      hill?: TransferEntry
      mixed?: TransferEntry
    }
  }
}

interface RaceComparisonProps {
  data: TransferData
}

const TERRAINS = ['flat', 'hill', 'mixed'] as const
const TERRAIN_LABELS: Record<string, string> = { flat: 'Flat', hill: 'Hill', mixed: 'Mixed' }

const CONTROLLER_LABELS: Record<string, string> = {
  sine: 'Sine',
  cpg: 'CPG',
  cpg_nn: 'CPG+NN',
}

export default function RaceComparison({ data }: RaceComparisonProps) {
  const [hovered, setHovered] = useState<{ ctrl: string; terrain: string } | null>(null)

  const { controllers, maxFitness, cells } = useMemo(() => {
    const ctrls = Object.keys(data)
    let max = 0
    const cellMap: Record<string, { mean: number; std: number }> = {}

    for (const ctrl of ctrls) {
      for (const t of TERRAINS) {
        const entry = data[ctrl]?.absolute?.[t]
        if (entry) {
          cellMap[`${ctrl}-${t}`] = { mean: entry.mean, std: entry.std }
          max = Math.max(max, entry.mean)
        }
      }
    }

    return { controllers: ctrls, maxFitness: max || 1, cells: cellMap }
  }, [data])

  const CELL_W = 140
  const CELL_H = 48
  const LABEL_W = 100
  const HEADER_H = 32
  const svgW = LABEL_W + TERRAINS.length * CELL_W + 20
  const svgH = HEADER_H + controllers.length * CELL_H + 20

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-xl mx-auto" style={{ minHeight: 200 }}>
        {/* Column headers */}
        {TERRAINS.map((t, ci) => (
          <text
            key={t}
            x={LABEL_W + ci * CELL_W + CELL_W / 2}
            y={HEADER_H - 8}
            textAnchor="middle"
            className="fill-[var(--color-text-dim)]"
            style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            {TERRAIN_LABELS[t] || t}
          </text>
        ))}

        {/* Rows */}
        {controllers.map((ctrl, ri) => (
          <g key={ctrl}>
            {/* Row label */}
            <text
              x={LABEL_W - 10}
              y={HEADER_H + ri * CELL_H + CELL_H / 2 + 4}
              textAnchor="end"
              className="fill-[var(--color-text-secondary)]"
              style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {CONTROLLER_LABELS[ctrl] || ctrl}
            </text>

            {/* Cells */}
            {TERRAINS.map((t, ci) => {
              const cell = cells[`${ctrl}-${t}`]
              const intensity = cell ? cell.mean / maxFitness : 0
              const isHovered = hovered?.ctrl === ctrl && hovered?.terrain === t

              return (
                <g
                  key={t}
                  onMouseEnter={() => setHovered({ ctrl, terrain: t })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect
                    x={LABEL_W + ci * CELL_W + 2}
                    y={HEADER_H + ri * CELL_H + 2}
                    width={CELL_W - 4}
                    height={CELL_H - 4}
                    rx={2}
                    fill={`rgba(245, 158, 11, ${0.1 + intensity * 0.7})`}
                    stroke={isHovered ? 'var(--color-accent)' : 'var(--color-border)'}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                  />
                  {cell && (
                    <text
                      x={LABEL_W + ci * CELL_W + CELL_W / 2}
                      y={HEADER_H + ri * CELL_H + CELL_H / 2 + 4}
                      textAnchor="middle"
                      className="fill-[var(--color-text-primary)]"
                      style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
                    >
                      {cell.mean.toFixed(1)}
                    </text>
                  )}
                  {!cell && (
                    <text
                      x={LABEL_W + ci * CELL_W + CELL_W / 2}
                      y={HEADER_H + ri * CELL_H + CELL_H / 2 + 4}
                      textAnchor="middle"
                      className="fill-[var(--color-text-dim)]"
                      style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      —
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && cells[`${hovered.ctrl}-${hovered.terrain}`] && (
        <div className="text-center mt-2">
          <span className="font-mono text-[10px] text-text-muted">
            {CONTROLLER_LABELS[hovered.ctrl] || hovered.ctrl} on {TERRAIN_LABELS[hovered.terrain] || hovered.terrain}:{' '}
            <span className="text-accent">
              {cells[`${hovered.ctrl}-${hovered.terrain}`].mean.toFixed(1)} ± {cells[`${hovered.ctrl}-${hovered.terrain}`].std.toFixed(1)}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
