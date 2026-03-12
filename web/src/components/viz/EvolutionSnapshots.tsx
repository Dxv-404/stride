/**
 * EvolutionSnapshots — Filmstrip visualization of evolution milestones.
 *
 * Horizontal strip showing key generations (0, 10, 25, 50, 75).
 * Each card shows best fitness, mean fitness, and a small fitness bar.
 * Cards are connected by a timeline line.
 * Experiment selector tabs to switch between controller tiers.
 */

import { useState, useMemo } from 'react'

/* ─── Types ─── */

interface ExperimentConvergence {
  generations: number[]
  best_per_gen: number[]
  mean_per_gen: number[]
  n_runs: number
}

interface ConvergenceData {
  [exp: string]: ExperimentConvergence
}

interface EvolutionSnapshotsProps {
  data: ConvergenceData
}

/* ─── Constants ─── */

const MILESTONE_GENS = [0, 10, 25, 50, 74] // generation indices (0-based)
const MILESTONE_LABELS = ['Gen 0', 'Gen 10', 'Gen 25', 'Gen 50', 'Gen 75']

const EXPERIMENT_GROUPS: Record<string, { keys: string[]; label: string }> = {
  tiers: {
    keys: ['baseline', 'cpg_baseline', 'cpgnn_flat'],
    label: 'Controller Tiers',
  },
  sine: {
    keys: ['baseline', 'high_amp', 'low_freq', 'large_pop'],
    label: 'Sine Variants',
  },
  cpgnn: {
    keys: ['cpgnn_flat', 'cpgnn_mixed', 'cpgnn_frozen', 'cpgnn_2x_budget'],
    label: 'CPG+NN Variants',
  },
}

const EXP_LABELS: Record<string, string> = {
  baseline: 'Sine',
  cpg_baseline: 'CPG',
  cpgnn_flat: 'CPG+NN (flat)',
  cpgnn_mixed: 'CPG+NN (mixed)',
  cpgnn_frozen: 'CPG+NN (frozen)',
  cpgnn_2x_budget: 'CPG+NN (2×)',
  high_amp: 'High Amp',
  low_freq: 'Low Freq',
  large_pop: 'Large Pop',
}

const EXP_COLORS: Record<string, string> = {
  baseline: '#3B82F6',
  cpg_baseline: '#10B981',
  cpgnn_flat: '#F59E0B',
  cpgnn_mixed: '#F97316',
  cpgnn_frozen: '#8B5CF6',
  cpgnn_2x_budget: '#EC4899',
  high_amp: '#06B6D4',
  low_freq: '#84CC16',
  large_pop: '#EF4444',
}

/* ─── Component ─── */

export default function EvolutionSnapshots({ data }: EvolutionSnapshotsProps) {
  const groupKeys = Object.keys(EXPERIMENT_GROUPS)
  const [activeGroup, setActiveGroup] = useState(groupKeys[0])
  const [expandedCard, setExpandedCard] = useState<number | null>(null)

  const group = EXPERIMENT_GROUPS[activeGroup]

  /* ── Compute global max fitness for bar scaling ── */
  const globalMax = useMemo(() => {
    let max = 0
    for (const exp of group.keys) {
      const d = data[exp]
      if (d) {
        max = Math.max(max, ...d.best_per_gen)
      }
    }
    return max || 1
  }, [data, group.keys])

  /* ── Extract milestone snapshots ── */
  const milestones = useMemo(() => {
    return MILESTONE_GENS.map((genIdx, mi) => {
      const experiments = group.keys
        .filter(k => data[k])
        .map(expKey => {
          const d = data[expKey]
          const idx = Math.min(genIdx, d.best_per_gen.length - 1)
          return {
            key: expKey,
            label: EXP_LABELS[expKey] ?? expKey,
            color: EXP_COLORS[expKey] ?? '#888',
            best: d.best_per_gen[idx],
            mean: d.mean_per_gen[idx],
          }
        })
      return { genLabel: MILESTONE_LABELS[mi], genIdx, experiments }
    })
  }, [data, group.keys])

  return (
    <div>
      {/* ── Group tabs ── */}
      <div className="flex gap-1 mb-6">
        {groupKeys.map(gk => (
          <button
            key={gk}
            onClick={() => { setActiveGroup(gk); setExpandedCard(null) }}
            className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
              activeGroup === gk
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {EXPERIMENT_GROUPS[gk].label}
          </button>
        ))}
      </div>

      {/* ── Filmstrip ── */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute top-[28px] left-8 right-8 h-px bg-border" />

        {/* Milestone cards */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {milestones.map((ms, mi) => {
            const isExpanded = expandedCard === mi
            return (
              <div
                key={mi}
                className="flex-1 min-w-[140px] relative cursor-pointer"
                onClick={() => setExpandedCard(isExpanded ? null : mi)}
              >
                {/* Timeline dot */}
                <div className="flex justify-center mb-3">
                  <div className="w-3 h-3 rounded-full bg-accent border-2 border-bg relative z-10" />
                </div>

                {/* Card */}
                <div
                  className={`border p-3 transition-all ${
                    isExpanded
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-bg-surface hover:border-text-dim'
                  }`}
                >
                  {/* Gen label */}
                  <div className="font-mono text-[9px] uppercase tracking-wider text-text-dim mb-2 text-center">
                    {ms.genLabel}
                  </div>

                  {/* Experiment bars */}
                  {ms.experiments.map(exp => (
                    <div key={exp.key} className="mb-1.5 last:mb-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-mono text-[8px] text-text-dim truncate max-w-[60px]">
                          {exp.label}
                        </span>
                        <span className="font-mono text-[9px] text-text-primary font-medium">
                          {exp.best.toFixed(0)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-border/30 w-full">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${(exp.best / globalMax) * 100}%`,
                            backgroundColor: exp.color,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      {/* Mean fitness (shown on expand) */}
                      {isExpanded && (
                        <div className="font-mono text-[8px] text-text-dim mt-0.5">
                          mean: {exp.mean.toFixed(0)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 justify-center">
        {group.keys.filter(k => data[k]).map(expKey => (
          <div key={expKey} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: EXP_COLORS[expKey] ?? '#888' }} />
            <span className="font-mono text-[9px] text-text-dim">{EXP_LABELS[expKey] ?? expKey}</span>
          </div>
        ))}
      </div>

      <p className="font-mono text-[9px] text-text-dim text-center mt-3">
        Click a card to expand details · Bars show best fitness across 30 runs
      </p>
    </div>
  )
}
