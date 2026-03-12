/**
 * CreatureDetailModal — full-screen modal for inspecting a Hall of Fame creature.
 *
 * Shows a large LiveCanvas running the creature in real-time,
 * plus detailed stats, description, and chromosome bar.
 *
 * Follows the ShortcutsModal pattern: Framer Motion scale+opacity entrance,
 * backdrop click / Escape to close.
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LiveCanvas, { type LiveCanvasHandle } from '@/components/simulation/LiveCanvas.tsx'
import ChromosomeBar from '@/components/shared/ChromosomeBar.tsx'
import type { ControllerType } from '@/engine/controllers.ts'
import { encodeChromosome } from '@/lib/chromosomeUrl.ts'

/* ─── Types ─── */

interface CreatureDetail {
  key: string
  label: string
  controllerType: ControllerType
  genes: number[]
  fitness: number
  color: string
  description: string
  rank: number
}

interface CreatureDetailModalProps {
  creature: CreatureDetail | null
  onClose: () => void
}

/* ─── Labels ─── */

const CONTROLLER_LABELS: Record<ControllerType, string> = {
  sine: 'Sine Wave',
  cpg: 'CPG Oscillator',
  cpg_nn: 'CPG + Neural Net',
}

const TERRAIN_FROM_KEY: Record<string, string> = {
  baseline: 'Flat',
  high_amp: 'Flat',
  low_freq: 'Flat',
  indirect: 'Flat',
  long_run: 'Flat',
  large_pop: 'Flat',
  cpg_baseline: 'Flat',
  cpg_hill: 'Hill',
  cpg_mixed: 'Mixed',
  cpgnn_flat: 'Flat',
  cpgnn_mixed: 'Mixed',
  cpgnn_frozen: 'Flat',
  cpgnn_high_mutation: 'Flat',
  cpgnn_2x_budget: 'Flat',
}

/* ─── Component ─── */

export default function CreatureDetailModal({ creature, onClose }: CreatureDetailModalProps) {
  const liveRef = useRef<LiveCanvasHandle>(null)
  const [distance, setDistance] = useState(0)
  const [simTime, setSimTime] = useState(0)

  // Escape key to close
  useEffect(() => {
    if (!creature) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [creature, onClose])

  const handleFrame = useCallback((state: { time: number; distance: number }) => {
    setDistance(state.distance)
    setSimTime(state.time)
  }, [])

  const handleReset = useCallback(() => {
    liveRef.current?.reset()
    setDistance(0)
    setSimTime(0)
  }, [])

  const terrain = creature ? (TERRAIN_FROM_KEY[creature.key] ?? 'Flat') : 'Flat'
  const terrainType = terrain.toLowerCase() as 'flat' | 'hill' | 'mixed'

  return (
    <AnimatePresence>
      {creature && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-bg border border-border max-w-2xl w-full mx-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header bar ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <span
                className="font-medium text-xs w-7 h-7 flex items-center justify-center rounded-sm"
                style={{
                  backgroundColor: creature.rank <= 3
                    ? creature.rank === 1 ? '#F59E0B' : creature.rank === 2 ? '#94A3B8' : '#B45309'
                    : 'transparent',
                  color: creature.rank <= 3 ? '#0a0a0f' : '#6b7280',
                  border: creature.rank > 3 ? '1px solid #333' : 'none',
                }}
              >
                #{creature.rank}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs uppercase tracking-wider text-text-primary">
                  {creature.label}
                </div>
              </div>
              <div
                className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5"
                style={{ backgroundColor: creature.color + '22', color: creature.color }}
              >
                {CONTROLLER_LABELS[creature.controllerType]}
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* ── Live simulation ── */}
            <div className="h-80 bg-[#0a0a0f] relative">
              <LiveCanvas
                ref={liveRef}
                genes={creature.genes}
                controllerType={creature.controllerType}
                terrainType={terrainType}
                running={true}
                zoom={2.2}
                accentColor={creature.color}
                onFrame={handleFrame}
              />

              {/* Live stats overlay */}
              <div className="absolute top-3 left-3 pointer-events-none">
                <div className="font-mono text-[10px] text-text-dim">
                  <span className="text-text-muted">Distance</span>{' '}
                  <span className="text-text-primary ml-1">{(distance * 10).toFixed(0)} px</span>
                </div>
                <div className="font-mono text-[10px] text-text-dim mt-0.5">
                  <span className="text-text-muted">Time</span>{' '}
                  <span className="text-text-primary ml-1">{simTime.toFixed(1)}s</span>
                </div>
              </div>

              {/* Reset button */}
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-wider text-text-muted hover:text-accent border border-border hover:border-accent px-2 py-1 bg-bg/80 transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* ── Stats grid ── */}
            <div className="grid grid-cols-4 border-t border-border">
              <div className="px-4 py-3 border-r border-border">
                <div className="font-mono text-[9px] uppercase tracking-wider text-text-dim mb-1">Fitness</div>
                <div className="font-medium text-sm" style={{ color: creature.color }}>
                  {creature.fitness.toFixed(1)}
                </div>
              </div>
              <div className="px-4 py-3 border-r border-border">
                <div className="font-mono text-[9px] uppercase tracking-wider text-text-dim mb-1">Controller</div>
                <div className="font-mono text-xs text-text-primary">
                  {creature.controllerType.toUpperCase()}
                </div>
              </div>
              <div className="px-4 py-3 border-r border-border">
                <div className="font-mono text-[9px] uppercase tracking-wider text-text-dim mb-1">Genes</div>
                <div className="font-mono text-xs text-text-primary">
                  {creature.genes.length}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="font-mono text-[9px] uppercase tracking-wider text-text-dim mb-1">Terrain</div>
                <div className="font-mono text-xs text-text-primary">
                  {terrain}
                </div>
              </div>
            </div>

            {/* ── Description ── */}
            <div className="px-4 py-3 border-t border-border">
              <p className="font-mono text-[11px] text-text-secondary leading-relaxed">
                {creature.description}.{' '}
                {creature.controllerType === 'cpg_nn'
                  ? 'Uses sensory feedback to modulate CPG oscillator output via a small neural network.'
                  : creature.controllerType === 'cpg'
                    ? 'Kuramoto-coupled oscillators drive the joints with emergent phase coordination.'
                    : 'Open-loop sinusoidal signals drive each joint independently.'
                }
                {' '}Evolved with a population of creatures over multiple generations to maximize walking distance
                while minimizing energy expenditure and falls.
              </p>
            </div>

            {/* ── Chromosome bar ── */}
            <div className="border-t border-border">
              <ChromosomeBar genes={creature.genes} expandable={true} />
            </div>

            {/* ── Footer actions ── */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-3">
              <a
                href={`/playground#${encodeChromosome(creature.genes, creature.controllerType)}`}
                className="btn-flat btn-primary px-4 py-1.5 text-xs"
              >
                Open in Playground
              </a>
              <div className="flex-1" />
              <span className="font-mono text-[9px] text-text-dim uppercase tracking-wider">
                Esc to close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
