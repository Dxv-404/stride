/**
 * Hall of Fame — Showcases the best evolved creatures from each experiment.
 *
 * Loads best chromosomes from the experiment data and displays them as
 * live simulation cards, each showing the creature walking in real-time.
 * Sorted by fitness score.
 */

import { useState, useEffect, useMemo } from 'react'
import LiveCanvas from '@/components/simulation/LiveCanvas.tsx'
import { loadBestChromosomes, type BestChromosome } from '@/data/best-chromosomes.ts'
import type { ControllerType } from '@/engine/controllers.ts'
import { encodeChromosome } from '@/lib/chromosomeUrl.ts'
import ShareModal from '@/components/shared/ShareModal.tsx'
import CreatureDetailModal from '@/components/shared/CreatureDetailModal.tsx'

/* ─── Creature card metadata ─── */

interface CreatureCard {
  key: string
  label: string
  controllerType: ControllerType
  genes: number[]
  fitness: number
  color: string
  description: string
}

const CONTROLLER_COLORS: Record<ControllerType, string> = {
  sine: '#3B82F6',
  cpg: '#10B981',
  cpg_nn: '#F59E0B',
}

const CONTROLLER_LABELS: Record<ControllerType, string> = {
  sine: 'Sine',
  cpg: 'CPG',
  cpg_nn: 'CPG+NN',
}

/** Map JSON keys to display metadata */
function buildCards(data: Record<string, BestChromosome>): CreatureCard[] {
  const CARD_DEFS: {
    key: string
    label: string
    controllerType: ControllerType
    description: string
  }[] = [
    { key: 'baseline', label: 'Sine Baseline', controllerType: 'sine', description: 'Open-loop sine controller on flat terrain' },
    { key: 'high_amp', label: 'Sine High Amp', controllerType: 'sine', description: 'Higher amplitude range for joints' },
    { key: 'low_freq', label: 'Sine Low Freq', controllerType: 'sine', description: 'Lower movement frequencies' },
    { key: 'indirect', label: 'Sine Indirect', controllerType: 'sine', description: 'Indirect encoding with symmetry' },
    { key: 'long_run', label: 'Sine 200 Gen', controllerType: 'sine', description: 'Extended evolution — 200 generations' },
    { key: 'large_pop', label: 'Sine Large Pop', controllerType: 'sine', description: 'Population of 200 individuals' },
    { key: 'cpg_baseline', label: 'CPG Baseline', controllerType: 'cpg', description: 'Kuramoto-coupled oscillators on flat' },
    { key: 'cpg_hill', label: 'CPG Hill', controllerType: 'cpg', description: 'CPG evolved on uphill terrain' },
    { key: 'cpg_mixed', label: 'CPG Mixed', controllerType: 'cpg', description: 'CPG on mixed terrain' },
    { key: 'cpgnn_flat', label: 'CPG+NN Flat', controllerType: 'cpg_nn', description: 'Full hybrid on flat terrain' },
    { key: 'cpgnn_mixed', label: 'CPG+NN Mixed', controllerType: 'cpg_nn', description: 'Full hybrid on mixed terrain' },
    { key: 'cpgnn_frozen', label: 'CPG+NN Frozen', controllerType: 'cpg_nn', description: 'NN weights frozen (CPG only)' },
    { key: 'cpgnn_high_mutation', label: 'CPG+NN High Mut', controllerType: 'cpg_nn', description: 'Higher neural net mutation rate' },
    { key: 'cpgnn_2x_budget', label: 'CPG+NN 2× Budget', controllerType: 'cpg_nn', description: '150 generations — double compute' },
  ]

  const cards: CreatureCard[] = []
  for (const def of CARD_DEFS) {
    const entry = data[def.key]
    if (!entry?.genes) continue
    cards.push({
      key: def.key,
      label: def.label,
      controllerType: def.controllerType,
      genes: entry.genes,
      fitness: entry.fitness,
      color: CONTROLLER_COLORS[def.controllerType],
      description: def.description,
    })
  }

  // Sort by fitness descending
  cards.sort((a, b) => b.fitness - a.fitness)
  return cards
}

/* ─── Creature Preview Card ─── */

function CreaturePreviewCard({ card, rank, onClick }: { card: CreatureCard; rank: number; onClick: () => void }) {
  const [shareOpen, setShareOpen] = useState(false)

  const playgroundHash = encodeChromosome(card.genes, card.controllerType)

  return (
    <div
      className="border border-border bg-bg-surface overflow-hidden group hover:border-border-hover transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Rank badge + header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span
          className="font-medium text-xs uppercase tracking-wide w-6 h-6 flex items-center justify-center rounded"
          style={{
            backgroundColor: rank <= 3
              ? rank === 1 ? '#F59E0B' : rank === 2 ? '#94A3B8' : '#B45309'
              : 'transparent',
            color: rank <= 3 ? '#0a0a0f' : '#6b7280',
            border: rank > 3 ? '1px solid #333' : 'none',
          }}
        >
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-primary truncate">
            {card.label}
          </div>
          <div className="font-mono text-[0.5rem] text-text-dim truncate">
            {card.description}
          </div>
        </div>
        <div
          className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm"
          style={{ backgroundColor: card.color + '22', color: card.color }}
        >
          {CONTROLLER_LABELS[card.controllerType]}
        </div>
      </div>

      {/* Live canvas */}
      <div className="h-40 bg-[#111827]">
        <LiveCanvas
          genes={card.genes}
          controllerType={card.controllerType}
          terrainType="flat"
          running={true}
          zoom={2.0}
          accentColor={card.color}
        />
      </div>

      {/* Footer stats + actions */}
      <div className="px-3 py-2 border-t border-border flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <div className="font-mono text-[0.55rem] text-text-dim">
          Fitness
        </div>
        <div
          className="font-medium text-xs uppercase tracking-wide"
          style={{ color: card.color }}
        >
          {card.fitness.toFixed(1)}
        </div>
        <div className="flex-1" />
        <a
          href={`/playground#${playgroundHash}`}
          className="text-[9px] font-medium uppercase tracking-wider text-text-muted hover:text-accent transition-colors"
        >
          Playground
        </a>
        <button
          onClick={() => setShareOpen(true)}
          className="text-[9px] font-medium uppercase tracking-wider text-text-muted hover:text-accent transition-colors cursor-pointer"
        >
          Share
        </button>
      </div>

      {/* Share modal */}
      {shareOpen && (
        <ShareModal
          url={`${window.location.origin}/playground#${playgroundHash}`}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

/* ─── Page ─── */

export default function HallOfFamePage() {
  const [data, setData] = useState<Record<string, BestChromosome> | null>(null)
  const [selectedCreature, setSelectedCreature] = useState<(CreatureCard & { rank: number }) | null>(null)

  useEffect(() => {
    loadBestChromosomes().then(setData)
  }, [])

  const cards = useMemo(() => (data ? buildCards(data) : []), [data])

  // Stats
  const topFitness = cards.length > 0 ? cards[0].fitness : 0
  const tierCounts = useMemo(() => {
    const counts = { sine: 0, cpg: 0, cpg_nn: 0 }
    for (const c of cards) counts[c.controllerType]++
    return counts
  }, [cards])

  if (!data) {
    return (
      <div className="h-full p-4 overflow-y-auto flex items-center justify-center">
        <p className="font-medium text-xs uppercase tracking-wide text-text-muted animate-pulse">
          LOADING HALL OF FAME...
        </p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="h-full p-4 overflow-y-auto">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-text-secondary mb-6">HALL OF FAME</h1>
        <div className="border border-border bg-bg-surface p-12 text-center">
          <p className="font-medium text-xs uppercase tracking-wide text-text-muted mb-2">NO CREATURES YET</p>
          <p className="font-mono text-xs text-text-dim">
            Run experiments to populate the Hall of Fame
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-text-secondary mb-1">HALL OF FAME</h1>
        <p className="font-mono text-xs text-text-dim">
          Best evolved creatures from {cards.length} experiments, ranked by fitness.
          Each creature walks in real-time using its evolved controller.
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="border border-border bg-bg-surface p-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim uppercase">Top Fitness</p>
          <p className="font-medium text-xs uppercase tracking-wide text-accent">{topFitness.toFixed(0)}</p>
        </div>
        <div className="border border-border bg-bg-surface p-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim uppercase">Sine</p>
          <p className="font-medium text-xs uppercase tracking-wide" style={{ color: CONTROLLER_COLORS.sine }}>
            {tierCounts.sine}
          </p>
        </div>
        <div className="border border-border bg-bg-surface p-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim uppercase">CPG</p>
          <p className="font-medium text-xs uppercase tracking-wide" style={{ color: CONTROLLER_COLORS.cpg }}>
            {tierCounts.cpg}
          </p>
        </div>
        <div className="border border-border bg-bg-surface p-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-text-dim uppercase">CPG+NN</p>
          <p className="font-medium text-xs uppercase tracking-wide" style={{ color: CONTROLLER_COLORS.cpg_nn }}>
            {tierCounts.cpg_nn}
          </p>
        </div>
      </div>

      {/* Creature cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <CreaturePreviewCard
            key={card.key}
            card={card}
            rank={i + 1}
            onClick={() => setSelectedCreature({ ...card, rank: i + 1 })}
          />
        ))}
      </div>

      {/* Detail modal */}
      <CreatureDetailModal
        creature={selectedCreature}
        onClose={() => setSelectedCreature(null)}
      />
    </div>
  )
}
