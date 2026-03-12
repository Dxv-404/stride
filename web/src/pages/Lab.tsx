/**
 * Evolution Lab page — the centerpiece of STRIDE.
 *
 * Layout:
 *   ┌───────────────────────────┬──────────┐
 *   │                           │  Config  │
 *   │   SimulationCanvas        │  Panel   │
 *   │   (fills available area)  │  (320px) │
 *   │                           │          │
 *   ├───────────────────────────┴──────────┤
 *   │          BottomDock (48px)            │
 *   └──────────────────────────────────────┘
 *
 * Canvas fills the main area. PlaybackControls live in the BottomDock.
 * Stats, ConvergenceChart, and ParameterPanel live in a toggleable ConfigPanel.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import SimulationCanvas from '@/components/simulation/SimulationCanvas.tsx'
import ParameterPanel from '@/components/lab/ParameterPanel.tsx'
import PlaybackControls from '@/components/lab/PlaybackControls.tsx'
import StatsPanel from '@/components/lab/StatsPanel.tsx'
import ConvergenceChart from '@/components/lab/ConvergenceChart.tsx'
import BottomDock from '@/components/shared/BottomDock.tsx'
import ConfigPanel from '@/components/shared/ConfigPanel.tsx'
import NeuralNetworkDiagram from '@/components/viz/NeuralNetworkDiagram.tsx'
import CPGPhasorDiagram from '@/components/viz/CPGPhasorDiagram.tsx'
import ChromosomeBar from '@/components/shared/ChromosomeBar.tsx'
import MutationVisualizer from '@/components/shared/MutationVisualizer.tsx'
import { WorkerBridge } from '@/lib/workerBridge.ts'
import { useSimulationStore } from '@/stores/simulationStore.ts'
import { useUIStore } from '@/stores/uiStore.ts'
import type { CreatureRecord, GenerationSnapshot } from '@/engine/types.ts'

/** Max creatures to send to the canvas (top N by fitness) */
const MAX_DISPLAY_CREATURES = 8

/** Lightweight snapshot for scrubber replay (avoids putting full walkFrames in Zustand) */
interface ScrubberSnapshot {
  generation: number
  topCreatures: CreatureRecord[]
  bestCreatureId: number
  stats: GenerationSnapshot['stats']
}

export default function Lab() {
  // --- Local state for canvas rendering ---
  const [creatures, setCreatures] = useState<CreatureRecord[]>([])
  const [bestCreatureId, setBestCreatureId] = useState<number>(-1)
  const [showNNDiagram, setShowNNDiagram] = useState(false)
  const [showCPGPhasor, setShowCPGPhasor] = useState(false)
  const [mutatedIndices, setMutatedIndices] = useState<number[]>([])
  const prevBestGenesRef = useRef<number[]>([])

  // --- Scrubber snapshot storage (stored in ref, not Zustand, to avoid serialization overhead) ---
  const snapshotsRef = useRef<ScrubberSnapshot[]>([])
  const [snapshotCount, setSnapshotCount] = useState(0)

  // --- Store bindings ---
  const params = useSimulationStore(s => s.params)
  const stats = useSimulationStore(s => s.stats)
  const status = useSimulationStore(s => s.status)
  const speed = useSimulationStore(s => s.speed)
  const setStatus = useSimulationStore(s => s.setStatus)
  const updateStats = useSimulationStore(s => s.updateStats)
  const resetStore = useSimulationStore(s => s.reset)
  const scrubberGeneration = useSimulationStore(s => s.scrubberGeneration)
  const setScrubberGeneration = useSimulationStore(s => s.setScrubberGeneration)

  // Track scrubbed fitness for canvas overlay
  const [scrubberFitness, setScrubberFitness] = useState<number | null>(null)

  // --- Config panel state ---
  const configOpen = useUIStore(s => s.configPanelOpen)
  const toggleConfig = useUIStore(s => s.toggleConfigPanel)

  // --- Worker bridge (persistent across renders) ---
  const bridgeRef = useRef<WorkerBridge | null>(null)

  // Create worker bridge on mount, terminate on unmount
  useEffect(() => {
    const bridge = new WorkerBridge()
    bridgeRef.current = bridge

    // --- Generation callback ---
    const unsubGen = bridge.onGeneration((snapshot: GenerationSnapshot) => {
      // Update store stats
      const { stats: snapStats } = snapshot
      updateStats({
        generation: snapshot.generation,
        bestFitness: snapStats.bestFitness,
        avgFitness: snapStats.avgFitness,
        worstFitness: snapStats.worstFitness,
        diversity: snapStats.diversity,
        fitnessHistory: [
          ...useSimulationStore.getState().stats.fitnessHistory,
          {
            gen: snapshot.generation,
            best: snapStats.bestFitness,
            avg: snapStats.avgFitness,
          },
        ],
      })

      // Update creatures for canvas (top N with walkFrames)
      const topCreatures = snapshot.population
        .filter(c => c.walkFrames && c.walkFrames.length > 0)
        .slice(0, MAX_DISPLAY_CREATURES)
      setCreatures(topCreatures)
      setBestCreatureId(snapStats.bestCreatureId)

      // Store snapshot for scrubber replay
      snapshotsRef.current.push({
        generation: snapshot.generation,
        topCreatures,
        bestCreatureId: snapStats.bestCreatureId,
        stats: snapStats,
      })
      setSnapshotCount(snapshotsRef.current.length)

      // Auto-pause between generations (if toggled on)
      const currentAutoPause = useSimulationStore.getState().autoPauseBetweenGens
      if (currentAutoPause && snapshot.generation > 0) {
        bridge.pause()
        setStatus('paused')
      }

      // Detect mutated genes by comparing best creature's genes to previous gen
      if (topCreatures.length > 0) {
        const bestGenes = topCreatures[0].genes
        const prev = prevBestGenesRef.current
        if (prev.length === bestGenes.length) {
          const changed: number[] = []
          for (let i = 0; i < bestGenes.length; i++) {
            if (Math.abs(bestGenes[i] - prev[i]) > 0.001) changed.push(i)
          }
          if (changed.length > 0) setMutatedIndices(changed)
        }
        prevBestGenesRef.current = [...bestGenes]
      }
    })

    // --- Completion callback ---
    const unsubComplete = bridge.onComplete(() => {
      setStatus('completed')
    })

    // --- Step-paused callback ---
    const unsubStepPaused = bridge.onStepPaused(() => {
      setStatus('paused')
    })

    // --- Error callback ---
    const unsubError = bridge.onError((msg) => {
      console.error('[Lab] Worker error:', msg)
      setStatus('idle')
    })

    return () => {
      unsubGen()
      unsubComplete()
      unsubStepPaused()
      unsubError()
      bridge.terminate()
      bridgeRef.current = null
    }
  }, [setStatus, updateStats])

  // --- Playback control handlers ---

  const handleStart = useCallback(() => {
    const bridge = bridgeRef.current
    if (!bridge) return

    // Reset stats for new run
    updateStats({
      generation: 0,
      bestFitness: 0,
      avgFitness: 0,
      worstFitness: 0,
      diversity: 1,
      fitnessHistory: [],
    })
    setCreatures([])
    setBestCreatureId(-1)

    setStatus('running')
    bridge.start(params)
  }, [params, setStatus, updateStats])

  const handlePause = useCallback(() => {
    bridgeRef.current?.pause()
    setStatus('paused')
  }, [setStatus])

  const handleResume = useCallback(() => {
    bridgeRef.current?.resume()
    setStatus('running')
  }, [setStatus])

  const handleReset = useCallback(() => {
    bridgeRef.current?.reset()
    resetStore()
    setCreatures([])
    setBestCreatureId(-1)
    snapshotsRef.current = []
    setSnapshotCount(0)
  }, [resetStore])

  const handleStep = useCallback(() => {
    const bridge = bridgeRef.current
    if (!bridge) return

    // If idle or completed, start fresh then immediately step
    if (status === 'idle' || status === 'completed') {
      // Reset stats for new run
      updateStats({
        generation: 0,
        bestFitness: 0,
        avgFitness: 0,
        worstFitness: 0,
        diversity: 1,
        fitnessHistory: [],
      })
      setCreatures([])
      setBestCreatureId(-1)
      snapshotsRef.current = []
      setSnapshotCount(0)
      setScrubberGeneration(null)

      setStatus('running')
      // Start with stepMode: worker will auto-pause after gen 0
      bridge.start(params)
      // Immediately tell worker to step (sets stepMode flag)
      bridge.step()
      return
    }

    // If paused, step forward one generation
    if (status === 'paused') {
      setScrubberGeneration(null)
      setStatus('running')
      bridge.step()
    }
  }, [status, params, setStatus, updateStats, setScrubberGeneration])

  const handleScrub = useCallback((genIndex: number) => {
    const snap = snapshotsRef.current[genIndex]
    if (!snap) return

    setScrubberGeneration(snap.generation)
    setScrubberFitness(snap.stats.bestFitness)
    setCreatures(snap.topCreatures)
    setBestCreatureId(snap.bestCreatureId)
  }, [setScrubberGeneration])

  const handleCreatureClick = useCallback((id: number) => {
    console.log('Creature clicked:', id)
    // Phase H: Open inspector
  }, [])

  // --- Compute playback speed multiplier ---
  const speedMultiplier = speed === 'max' ? 100 : speed

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content area: canvas + optional config panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-bg-surface">
          {creatures.length > 0 ? (
            <SimulationCanvas
              terrainType={params.terrainType}
              creatures={creatures}
              bestCreatureId={bestCreatureId}
              generation={scrubberGeneration ?? stats.generation}
              bestFitness={scrubberFitness ?? stats.bestFitness}
              playing={status === 'running'}
              speed={speedMultiplier}
              onCreatureClick={handleCreatureClick}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <p className="font-medium text-xs uppercase tracking-wide text-accent mb-3">
                  {status === 'running' ? 'EVOLVING...' : 'EVOLUTION LAB'}
                </p>
                <p className="font-mono text-xs text-text-dim">
                  {status === 'running'
                    ? 'Computing first generation...'
                    : 'Configure parameters and press Start to begin evolution.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Chromosome bar + mutation flash overlay */}
          {creatures.length > 0 && (
            <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
              <ChromosomeBar
                genes={creatures[0].genes}
                expandable={false}
              />
              <MutationVisualizer
                genes={creatures[0].genes}
                mutatedIndices={mutatedIndices}
                height={4}
              />
            </div>
          )}
        </div>

        {/* Config panel (pushes canvas) */}
        <ConfigPanel open={configOpen} onClose={toggleConfig} title="Configuration">
          <StatsPanel />
          <div className="mt-4">
            <ConvergenceChart />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <ParameterPanel />
          </div>

          {/* Visualization toggles — available when creatures have enough genes */}
          {creatures.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
                Visualizations
              </div>
              <div className="flex gap-1.5 mb-3">
                {creatures[0].genes.length >= 96 && (
                  <button
                    onClick={() => setShowNNDiagram(v => !v)}
                    className={`flex-1 text-[9px] font-medium uppercase tracking-wider py-1.5 border transition-colors cursor-pointer
                      ${showNNDiagram
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-transparent text-text-muted border-border hover:text-text'}`}
                  >
                    Neural Net
                  </button>
                )}
                {creatures[0].genes.length >= 38 && (
                  <button
                    onClick={() => setShowCPGPhasor(v => !v)}
                    className={`flex-1 text-[9px] font-medium uppercase tracking-wider py-1.5 border transition-colors cursor-pointer
                      ${showCPGPhasor
                        ? 'bg-accent text-bg border-accent'
                        : 'bg-transparent text-text-muted border-border hover:text-text'}`}
                  >
                    CPG Phases
                  </button>
                )}
              </div>

              {showNNDiagram && creatures[0].genes.length >= 96 && (
                <div className="mb-3 border border-border bg-[#0a0a0f] p-2">
                  <NeuralNetworkDiagram
                    genes={creatures[0].genes}
                    width={280}
                    height={220}
                  />
                </div>
              )}

              {showCPGPhasor && creatures[0].genes.length >= 38 && (
                <div className="mb-3 border border-border bg-[#0a0a0f] p-2">
                  <CPGPhasorDiagram
                    genes={creatures[0].genes}
                    size={260}
                  />
                </div>
              )}
            </div>
          )}
        </ConfigPanel>
      </div>

      {/* Bottom dock with playback controls */}
      <BottomDock>
        <PlaybackControls
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onReset={handleReset}
          onStep={handleStep}
          onScrub={handleScrub}
          snapshotCount={snapshotCount}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Config toggle */}
        <button
          onClick={toggleConfig}
          className={`
            w-8 h-8 flex items-center justify-center transition-colors cursor-pointer
            ${configOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'}
          `}
          title="Toggle configuration panel"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </BottomDock>
    </div>
  )
}
