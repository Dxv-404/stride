/**
 * Gene Playground — manually control every gene and watch the creature walk.
 *
 * Layout:
 *   ┌───────────────────────────┬──────────┐
 *   │                           │  Config  │
 *   │   SimulationCanvas        │  Panel   │
 *   │   (fills available area)  │  (genes) │
 *   │                           │          │
 *   ├───────────────────────────┴──────────┤
 *   │          BottomDock (48px)            │
 *   └──────────────────────────────────────┘
 *
 * Features:
 *   - 18 gene sliders (direct) or 9 (indirect), with debounced re-simulation
 *   - Presets: Random, Symmetric, All Max, All Min, Mutate
 *   - Chromosome heatmap bar
 *   - Direct/indirect encoding toggle in dock
 *   - Fitness breakdown overlay on canvas
 */

import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import SimulationCanvas from '@/components/simulation/SimulationCanvas.tsx'
import ChromosomeBar from '@/components/playground/ChromosomeBar.tsx'
import BottomDock from '@/components/shared/BottomDock.tsx'
import ConfigPanel from '@/components/shared/ConfigPanel.tsx'
import { useUIStore } from '@/stores/uiStore.ts'
import { WorkerBridge, type SingleEvalResult } from '@/lib/workerBridge.ts'
import { JOINT_NAMES, getGeneCount } from '@/engine/encoding.ts'
import type { CreatureRecord, FitnessBreakdown } from '@/engine/types.ts'
import { getChromosomeFromUrl, buildShareUrl } from '@/lib/chromosomeUrl.ts'
import ShareModal from '@/components/shared/ShareModal.tsx'
import GeneTimeline from '@/components/playground/GeneTimeline.tsx'
import PresetLibrary from '@/components/playground/PresetLibrary.tsx'
import GeneDiffView from '@/components/playground/GeneDiffView.tsx'
import GeneConstraints from '@/components/playground/GeneConstraints.tsx'
import { useGeneHistory } from '@/hooks/useGeneHistory.ts'

const ChromosomeHelix = lazy(() => import('@/components/viz/ChromosomeHelix.tsx'))

/* ─── Gene label helpers ─── */

const PARAM_NAMES = ['amp', 'freq', 'phase'] as const

function getDirectLabels(): string[] {
  const labels: string[] = []
  for (const joint of JOINT_NAMES) {
    for (const param of PARAM_NAMES) {
      labels.push(`${joint}.${param}`)
    }
  }
  return labels
}

function getIndirectLabels(): string[] {
  const labels: string[] = []
  const jointTypes = ['hip', 'knee', 'shoulder']
  for (const jt of jointTypes) {
    for (const param of PARAM_NAMES) {
      labels.push(`${jt}.${param}`)
    }
  }
  return labels
}

/* ─── Gene group definitions for visual grouping ─── */

interface GeneGroup {
  name: string
  startIndex: number
  count: number
}

function getDirectGroups(): GeneGroup[] {
  return JOINT_NAMES.map((name, i) => ({
    name: name.replace('_', ' ').toUpperCase(),
    startIndex: i * 3,
    count: 3,
  }))
}

function getIndirectGroups(): GeneGroup[] {
  return ['HIP', 'KNEE', 'SHOULDER'].map((name, i) => ({
    name,
    startIndex: i * 3,
    count: 3,
  }))
}

/* ─── Presets ─── */

function randomGenes(count: number): number[] {
  return Array.from({ length: count }, () => Math.random())
}

function symmetricGenes(): number[] {
  const base = Array.from({ length: 9 }, () => Math.random())
  const genes: number[] = []
  for (let i = 0; i < 3; i++) {
    genes.push(base[i * 3 + 0], base[i * 3 + 1], base[i * 3 + 2])
    genes.push(base[i * 3 + 0], base[i * 3 + 1], (base[i * 3 + 2] + 0.5) % 1)
  }
  return genes
}

function allMax(count: number): number[] {
  return Array.from({ length: count }, () => 1.0)
}

function allMin(count: number): number[] {
  return Array.from({ length: count }, () => 0.0)
}

function mutateGenes(genes: number[], rate = 0.3): number[] {
  return genes.map((g) => {
    if (Math.random() < rate) {
      const delta = (Math.random() - 0.5) * 0.3
      return Math.max(0, Math.min(1, g + delta))
    }
    return g
  })
}

const EVAL_DEBOUNCE = 200

/* ─── Component ─── */

export default function Playground() {
  const [encoding, setEncoding] = useState<'direct' | 'indirect'>('direct')
  const geneCount = getGeneCount(encoding)

  const [genes, setGenes] = useState<number[]>(() => {
    // Check URL hash for shared chromosome
    const fromUrl = getChromosomeFromUrl()
    if (fromUrl) return fromUrl.genes
    return randomGenes(18)
  })
  const [creatures, setCreatures] = useState<CreatureRecord[]>([])
  const [fitness, setFitness] = useState<FitnessBreakdown | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const bridgeRef = useRef<WorkerBridge | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const evalIdRef = useRef(0)

  // --- Config panel state ---
  const configOpen = useUIStore(s => s.configPanelOpen)
  const toggleConfig = useUIStore(s => s.toggleConfigPanel)
  const playgroundTab = useUIStore(s => s.playgroundTab)
  const setPlaygroundTab = useUIStore(s => s.setPlaygroundTab)

  // Undo/redo history
  const history = useGeneHistory(genes)

  // Reference genes for diff view (the initial random state)
  const [referenceGenes] = useState<number[]>(() => [...genes])

  const labels = useMemo(
    () => (encoding === 'direct' ? getDirectLabels() : getIndirectLabels()),
    [encoding],
  )
  const groups = useMemo(
    () => (encoding === 'direct' ? getDirectGroups() : getIndirectGroups()),
    [encoding],
  )

  // Create worker on mount
  useEffect(() => {
    const bridge = new WorkerBridge()
    bridgeRef.current = bridge
    return () => {
      bridge.terminate()
      bridgeRef.current = null
    }
  }, [])

  // Reset genes when encoding changes
  useEffect(() => {
    setGenes(randomGenes(geneCount))
  }, [geneCount])

  // Evaluate creature when genes change (debounced)
  const evaluate = useCallback((genesToEval: number[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const bridge = bridgeRef.current
      if (!bridge || !bridge.isAlive) return

      const evalId = ++evalIdRef.current
      setEvaluating(true)

      try {
        const result: SingleEvalResult = await bridge.evaluateSingle(genesToEval)
        if (evalId !== evalIdRef.current) return

        const record: CreatureRecord = {
          id: 1,
          genes: genesToEval,
          fitness: result.fitness.total,
          fitnessBreakdown: result.fitness,
          parentIds: null,
          crossoverPoints: [],
          mutations: [],
          walkFrames: result.walkFrames,
        }

        setCreatures([record])
        setFitness(result.fitness)
      } catch {
        // Worker might have been reset/terminated
      } finally {
        if (evalId === evalIdRef.current) setEvaluating(false)
      }
    }, EVAL_DEBOUNCE)
  }, [])

  // Trigger evaluation when genes change
  useEffect(() => {
    evaluate(genes)
  }, [genes, evaluate])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Keyboard shortcuts: undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) {
          if (history.canRedo) {
            history.redo()
            setGenes(history.genes)
          }
        } else {
          if (history.canUndo) {
            history.undo()
            setGenes(history.genes)
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [history])

  /* ─── Handlers ─── */

  const handleGeneChange = useCallback((index: number, value: number) => {
    setGenes((prev) => {
      const next = [...prev]
      next[index] = value
      history.push(next)
      return next
    })
  }, [history])

  const handlePreset = useCallback(
    (type: 'random' | 'symmetric' | 'max' | 'min') => {
      switch (type) {
        case 'random':
          setGenes(randomGenes(geneCount))
          break
        case 'symmetric':
          setGenes(encoding === 'direct' ? symmetricGenes() : randomGenes(geneCount))
          break
        case 'max':
          setGenes(allMax(geneCount))
          break
        case 'min':
          setGenes(allMin(geneCount))
          break
      }
    },
    [geneCount, encoding],
  )

  const handleMutate = useCallback(() => {
    setGenes((prev) => mutateGenes(prev))
  }, [])

  const handleEncodingChange = useCallback((enc: 'direct' | 'indirect') => {
    setEncoding(enc)
    setCreatures([])
    setFitness(null)
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content area: canvas + optional config panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-bg-surface">
          {creatures.length > 0 ? (
            <SimulationCanvas
              terrainType="flat"
              creatures={creatures}
              bestCreatureId={1}
              generation={0}
              bestFitness={fitness?.total ?? 0}
              playing={true}
              speed={1}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <p className="font-medium text-xs uppercase tracking-wide text-accent mb-3">
                  {evaluating ? 'SIMULATING...' : 'GENE PLAYGROUND'}
                </p>
                <p className="font-mono text-xs text-text-dim">
                  {evaluating
                    ? 'Running physics simulation...'
                    : 'Adjust gene sliders to see your creature walk.'}
                </p>
              </div>
            </div>
          )}

          {/* Fitness overlay */}
          {fitness && (
            <div className="absolute bottom-3 left-3 bg-bg-panel/90 border border-border px-3 py-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-1">FITNESS</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
                <span className="text-text-dim">Total</span>
                <span className={`text-right ${fitness.total > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fitness.total.toFixed(1)}
                </span>
                <span className="text-text-dim">Dist</span>
                <span className="text-right text-text-secondary">{fitness.distance.toFixed(1)}</span>
                <span className="text-text-dim">Energy</span>
                <span className="text-right text-red-400/70">-{fitness.energy.toFixed(1)}</span>
                <span className="text-text-dim">Falls</span>
                <span className="text-right text-red-400/70">-{fitness.falls.toFixed(1)}</span>
                <span className="text-text-dim">Upright</span>
                <span className="text-right text-green-400/70">+{fitness.uprightness.toFixed(1)}</span>
              </div>
            </div>
          )}

          {evaluating && creatures.length > 0 && (
            <div className="absolute top-3 right-3 text-[11px] font-medium uppercase tracking-wider text-accent animate-pulse">
              RE-EVALUATING...
            </div>
          )}
        </div>

        {/* Config panel with tabbed gene editor */}
        <ConfigPanel open={configOpen} onClose={toggleConfig} title="Gene Editor">
          {/* Tab selector */}
          <div className="flex border border-border mb-4">
            {(['sliders', 'timeline', 'presets', 'diff', 'constraints', 'helix'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPlaygroundTab(tab)}
                className={`flex-1 text-[9px] font-medium uppercase tracking-wider py-1.5 transition-colors cursor-pointer
                  ${playgroundTab === tab
                    ? 'bg-accent text-bg'
                    : 'bg-transparent text-text-muted hover:text-text'}`}
              >
                {tab === 'sliders' ? 'Edit' : tab === 'timeline' ? 'Wave' : tab === 'helix' ? '3D' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Chromosome bar (always visible) */}
          <div className="mb-4">
            <ChromosomeBar genes={genes} labels={labels} />
          </div>

          {/* Tab content */}
          {playgroundTab === 'sliders' && (
            <>
              {/* Preset buttons */}
              <div className="mb-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                  Quick Actions
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Random', action: () => handlePreset('random') },
                    ...(encoding === 'direct'
                      ? [{ label: 'Symmetric', action: () => handlePreset('symmetric') }]
                      : []),
                    { label: 'All Max', action: () => handlePreset('max') },
                    { label: 'All Min', action: () => handlePreset('min') },
                    { label: 'Mutate', action: handleMutate },
                  ].map(({ label, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      className="btn-flat text-[10px] px-2.5 py-0.5"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gene sliders grouped by joint */}
              {groups.map((group) => (
                <div key={group.name} className="mb-4">
                  <h3 className="text-[10px] font-medium uppercase tracking-wider text-accent mb-2">
                    {group.name}
                  </h3>
                  {Array.from({ length: group.count }, (_, j) => {
                    const geneIdx = group.startIndex + j
                    const paramName = PARAM_NAMES[j]
                    return (
                      <GeneSlider
                        key={geneIdx}
                        index={geneIdx}
                        label={paramName}
                        value={genes[geneIdx]}
                        onChange={handleGeneChange}
                      />
                    )
                  })}
                </div>
              ))}
            </>
          )}

          {playgroundTab === 'timeline' && (
            <GeneTimeline genes={genes} />
          )}

          {playgroundTab === 'presets' && (
            <PresetLibrary
              genes={genes}
              geneCount={geneCount}
              onApply={(newGenes) => { history.push(newGenes); setGenes(newGenes) }}
            />
          )}

          {playgroundTab === 'diff' && (
            <GeneDiffView
              genesA={genes}
              genesB={referenceGenes}
              labelA="Current"
              labelB="Initial"
            />
          )}

          {playgroundTab === 'constraints' && (
            <GeneConstraints
              genes={genes}
              onApply={(newGenes) => { history.push(newGenes); setGenes(newGenes) }}
            />
          )}

          {playgroundTab === 'helix' && (
            <div className="h-[350px] border border-border bg-[#0a0a0f]">
              <Suspense fallback={<div className="h-full flex items-center justify-center text-text-dim text-xs">Loading 3D...</div>}>
                <ChromosomeHelix
                  genes={genes}
                  geneLabels={labels}
                />
              </Suspense>
            </div>
          )}

          {/* Undo/Redo indicator */}
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
            <button
              onClick={() => { if (history.canUndo) { history.undo(); setGenes(history.genes) } }}
              disabled={!history.canUndo}
              className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border transition-colors
                ${history.canUndo
                  ? 'border-border text-text-muted hover:text-text cursor-pointer'
                  : 'border-border/50 text-text-dim/30 cursor-not-allowed'}`}
            >
              Undo
            </button>
            <button
              onClick={() => { if (history.canRedo) { history.redo(); setGenes(history.genes) } }}
              disabled={!history.canRedo}
              className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 border transition-colors
                ${history.canRedo
                  ? 'border-border text-text-muted hover:text-text cursor-pointer'
                  : 'border-border/50 text-text-dim/30 cursor-not-allowed'}`}
            >
              Redo
            </button>
            <span className="font-mono text-[9px] text-text-dim">
              Ctrl+Z / Ctrl+Shift+Z
            </span>
          </div>
        </ConfigPanel>
      </div>

      {/* Bottom dock */}
      <BottomDock>
        {/* Encoding toggle */}
        <div className="flex border border-border">
          {(['direct', 'indirect'] as const).map((enc) => (
            <button
              key={enc}
              onClick={() => handleEncodingChange(enc)}
              className={`
                text-[10px] font-medium uppercase tracking-wider px-3 py-1 transition-colors cursor-pointer
                ${encoding === enc
                  ? 'bg-accent text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
            >
              {enc}
            </button>
          ))}
        </div>

        {/* Gene count */}
        <span className="font-mono text-[11px] text-text-dim tabular-nums">
          {geneCount} genes
        </span>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Share button */}
        <button
          onClick={() => setShareOpen(true)}
          className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider
                     border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          Share
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Config toggle */}
        <button
          onClick={toggleConfig}
          className={`
            w-8 h-8 flex items-center justify-center transition-colors cursor-pointer
            ${configOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'}
          `}
          title="Toggle gene editor"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="3" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="7" width="14" height="3" stroke="currentColor" strokeWidth="1.2" />
            <rect x="1" y="12" width="14" height="3" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="5" cy="3.5" r="1.5" fill="currentColor" />
            <circle cx="10" cy="8.5" r="1.5" fill="currentColor" />
            <circle cx="7" cy="13.5" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </BottomDock>

      {/* Share modal */}
      {shareOpen && (
        <ShareModal
          url={buildShareUrl(genes, 'sine', '/playground')}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

/* ─── Gene Slider sub-component ─── */

function GeneSlider({
  index,
  label,
  value,
  onChange,
}: {
  index: number
  label: string
  value: number
  onChange: (index: number, value: number) => void
}) {
  return (
    <label className="block mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="font-mono text-[11px] text-text-secondary uppercase">
          {label}
        </span>
        <span className="font-mono text-[11px] text-text-primary tabular-nums">
          {value.toFixed(3)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.005}
        value={value}
        onChange={(e) => onChange(index, Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded bg-border accent-accent cursor-pointer"
      />
    </label>
  )
}
