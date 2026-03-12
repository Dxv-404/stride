/**
 * GeneDiffView — side-by-side comparison of two chromosomes.
 *
 * Shows per-gene differences as horizontal bar charts.
 * Highlights which genes changed most between current and a reference.
 */

import { useMemo } from 'react'
import { JOINT_NAMES } from '@/engine/encoding.ts'

interface GeneDiffViewProps {
  genesA: number[]
  genesB: number[]
  labelA?: string
  labelB?: string
}

const PARAM_NAMES = ['amp', 'freq', 'phase'] as const

export default function GeneDiffView({
  genesA,
  genesB,
  labelA = 'Current',
  labelB = 'Reference',
}: GeneDiffViewProps) {
  const diffs = useMemo(() => {
    const len = Math.max(genesA.length, genesB.length)
    return Array.from({ length: len }, (_, i) => {
      const a = genesA[i] ?? 0
      const b = genesB[i] ?? 0
      const jointIdx = Math.floor(i / 3)
      const paramIdx = i % 3
      return {
        index: i,
        label: `${JOINT_NAMES[jointIdx] ?? `J${jointIdx}`}.${PARAM_NAMES[paramIdx]}`,
        a,
        b,
        delta: a - b,
        absDelta: Math.abs(a - b),
      }
    })
  }, [genesA, genesB])

  const maxDelta = Math.max(0.01, ...diffs.map(d => d.absDelta))
  const totalDiff = diffs.reduce((s, d) => s + d.absDelta, 0)

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Gene Comparison
      </div>

      {/* Labels */}
      <div className="flex justify-between mb-2">
        <span className="font-mono text-[9px] text-accent">{labelA}</span>
        <span className="font-mono text-[9px] text-text-dim">
          Total Δ: {totalDiff.toFixed(2)}
        </span>
        <span className="font-mono text-[9px] text-blue-400">{labelB}</span>
      </div>

      {/* Diff bars */}
      <div className="space-y-1">
        {diffs.map(d => (
          <div key={d.index} className="flex items-center gap-2">
            <span className="font-mono text-[8px] text-text-dim w-14 text-right truncate">
              {d.label}
            </span>
            <div className="flex-1 h-3 bg-bg-surface border border-border relative overflow-hidden">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
              {/* Delta bar */}
              {d.delta !== 0 && (
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: d.delta > 0 ? '50%' : `${50 + (d.delta / maxDelta) * 50}%`,
                    width: `${(d.absDelta / maxDelta) * 50}%`,
                    backgroundColor: d.delta > 0 ? 'var(--color-accent)' : '#3B82F6',
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
            <span className={`font-mono text-[8px] w-8 text-right ${
              d.absDelta > 0.1 ? 'text-accent' : 'text-text-dim'
            }`}>
              {d.delta > 0 ? '+' : ''}{d.delta.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
