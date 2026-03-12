/**
 * Controller Race — Three creatures walking side-by-side.
 *
 * Layout:
 *   ┌─────────┬─────────┬─────────┐
 *   │  SINE   │   CPG   │ CPG+NN  │   ← 3 LiveCanvas instances
 *   │         │         │         │
 *   ├─────────┴─────────┴─────────┤
 *   │  BottomDock: terrain | ▶/⏸ | distances │
 *   └─────────────────────────────┘
 *
 * Shows Sine (blue), CPG (green), and CPG+NN (amber) creatures
 * on the same terrain, pre-loaded with their best evolved chromosomes.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import LiveCanvas, { type LiveCanvasHandle } from '@/components/simulation/LiveCanvas.tsx'
import BottomDock from '@/components/shared/BottomDock.tsx'
import TimelineStrip, { type StripFrame } from '@/components/compare/TimelineStrip.tsx'
import ComparativeAnatomy from '@/components/compare/ComparativeAnatomy.tsx'
import { loadBestChromosomes, getBestGenes, type BestChromosome } from '@/data/best-chromosomes.ts'
import type { ControllerType } from '@/engine/controllers.ts'

const CONTROLLERS: { type: ControllerType; label: string; color: string }[] = [
  { type: 'sine', label: 'SINE', color: '#3B82F6' },
  { type: 'cpg', label: 'CPG', color: '#10B981' },
  { type: 'cpg_nn', label: 'CPG+NN', color: '#F59E0B' },
]

const TERRAINS = ['flat', 'hill', 'mixed'] as const

export default function Compare() {
  const [data, setData] = useState<Record<string, BestChromosome> | null>(null)
  const [terrain, setTerrain] = useState<string>('flat')
  const [distances, setDistances] = useState<Record<ControllerType, number>>({
    sine: 0, cpg: 0, cpg_nn: 0,
  })
  const [simTime, setSimTime] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [running, setRunning] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showAnatomy, setShowAnatomy] = useState(false)
  const [timelineFrames, setTimelineFrames] = useState<Record<ControllerType, StripFrame[]>>({
    sine: [], cpg: [], cpg_nn: [],
  })

  const canvasRefs = useRef<Record<ControllerType, LiveCanvasHandle | null>>({
    sine: null, cpg: null, cpg_nn: null,
  })

  // Load data
  useEffect(() => {
    loadBestChromosomes().then(setData)
  }, [])

  // Stable frame callbacks
  const frameHandlers = useMemo(() => ({
    sine: (state: { time: number; distance: number }) => {
      setDistances(prev => ({ ...prev, sine: state.distance }))
      setSimTime(state.time)
    },
    cpg: (state: { time: number; distance: number }) => {
      setDistances(prev => ({ ...prev, cpg: state.distance }))
    },
    cpg_nn: (state: { time: number; distance: number }) => {
      setDistances(prev => ({ ...prev, cpg_nn: state.distance }))
    },
  }), [])

  // Determine winner
  const maxDist = Math.max(distances.sine, distances.cpg, distances.cpg_nn)
  const minDist = Math.min(distances.sine, distances.cpg, distances.cpg_nn)
  const hasWinner = maxDist > 50 && maxDist - minDist > 30
  const winner = hasWinner
    ? CONTROLLERS.find(c => distances[c.type] === maxDist)
    : null

  const handleTerrainChange = useCallback((t: string) => {
    setTerrain(t)
    setResetKey(k => k + 1)
    setRunning(false)
    setDistances({ sine: 0, cpg: 0, cpg_nn: 0 })
    setSimTime(0)
  }, [])

  const handleReset = useCallback(() => {
    setResetKey(k => k + 1)
    setRunning(false)
    setDistances({ sine: 0, cpg: 0, cpg_nn: 0 })
    setSimTime(0)
    setTimelineFrames({ sine: [], cpg: [], cpg_nn: [] })
  }, [])

  const handleCaptureTimeline = useCallback(() => {
    const frames: Record<ControllerType, StripFrame[]> = { sine: [], cpg: [], cpg_nn: [] }
    for (const ctrl of CONTROLLERS) {
      const handle = canvasRefs.current[ctrl.type]
      if (handle) {
        const buffer = handle.getReplayBuffer()
        const replayFrames = buffer.getRecentFrames()
        frames[ctrl.type] = replayFrames.map(f => ({
          bodies: f.bodies.map(b => ({ x: b.x, y: b.y })),
          time: f.time,
        }))
      }
    }
    setTimelineFrames(frames)
    setShowTimeline(true)
  }, [])

  // Gene counts per controller for anatomy view
  const anatomyControllers = useMemo(() => {
    return CONTROLLERS.map(ctrl => ({
      label: ctrl.label,
      color: ctrl.color,
      geneCount: data ? (getBestGenes(data, ctrl.type)?.length ?? 0) : 0,
    }))
  }, [data])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Three canvases side-by-side */}
      <div className="flex-1 flex overflow-hidden">
        {CONTROLLERS.map(ctrl => {
          const genes = data ? getBestGenes(data, ctrl.type) : null

          return (
            <div key={ctrl.type} className="flex-1 flex flex-col border-r border-border last:border-r-0">
              {/* Canvas */}
              <div className="flex-1 relative overflow-hidden bg-bg-surface">
                {genes ? (
                  <LiveCanvas
                    key={`${ctrl.type}-${terrain}-${resetKey}`}
                    ref={(el) => { canvasRefs.current[ctrl.type] = el }}
                    genes={genes}
                    controllerType={ctrl.type}
                    terrainType={terrain}
                    running={running}
                    zoom={2.0}
                    onFrame={frameHandlers[ctrl.type]}
                    accentColor={ctrl.color}
                    label={ctrl.label}
                    showTrail={true}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted animate-pulse">
                      LOADING...
                    </p>
                  </div>
                )}

                {/* Winner badge overlay */}
                {winner?.type === ctrl.type && (
                  <div className="absolute top-3 left-3 px-2 py-1 border text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: ctrl.color, borderColor: ctrl.color, backgroundColor: `${ctrl.color}20` }}
                  >
                    LEADING
                  </div>
                )}
              </div>

              {/* Distance bar */}
              <div className="h-10 flex items-center gap-2 px-3 border-t border-border bg-bg-panel">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: ctrl.color }}>
                  {ctrl.label}
                </span>
                <div className="flex-1 h-1 bg-border overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${maxDist > 0 ? (distances[ctrl.type] / maxDist) * 100 : 0}%`,
                      backgroundColor: ctrl.color,
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-text-secondary tabular-nums w-12 text-right">
                  {distances[ctrl.type].toFixed(0)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Timeline strips */}
      {showTimeline && (
        <div className="border-t border-border bg-bg-panel px-3 py-2 overflow-x-auto">
          <div className="flex gap-4">
            {CONTROLLERS.map(ctrl => (
              <div key={ctrl.type} className="flex-1 min-w-0">
                <TimelineStrip
                  frames={timelineFrames[ctrl.type]}
                  label={ctrl.label}
                  color={ctrl.color}
                  snapshots={6}
                  height={50}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparative anatomy */}
      {showAnatomy && data && (
        <div className="border-t border-border bg-bg-panel px-3 py-2">
          <ComparativeAnatomy controllers={anatomyControllers} width={140} height={180} />
        </div>
      )}

      {/* Bottom dock */}
      <BottomDock>
        {/* Terrain selector */}
        <div className="flex border border-border">
          {TERRAINS.map(t => (
            <button
              key={t}
              onClick={() => handleTerrainChange(t)}
              className={`
                text-[10px] font-medium uppercase tracking-wider px-3 py-1 transition-colors cursor-pointer
                ${terrain === t
                  ? 'bg-accent text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setRunning(r => !r)}
          className="btn-flat btn-primary px-4 py-1 text-xs"
        >
          {running ? 'Pause' : 'Start'}
        </button>

        {/* Reset */}
        <button onClick={handleReset} className="btn-flat px-3 py-1 text-xs">
          Reset
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Timeline capture */}
        <button
          onClick={handleCaptureTimeline}
          className={`btn-flat px-3 py-1 text-xs ${showTimeline ? 'text-accent' : ''}`}
          title="Capture timeline strip"
        >
          Timeline
        </button>

        {/* Anatomy toggle */}
        <button
          onClick={() => setShowAnatomy(a => !a)}
          className={`btn-flat px-3 py-1 text-xs ${showAnatomy ? 'text-accent' : ''}`}
          title="Show comparative anatomy"
        >
          Anatomy
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Timer */}
        <span className="font-mono text-[11px] text-text-dim tabular-nums">
          {simTime.toFixed(1)}s
        </span>
      </BottomDock>
    </div>
  )
}
