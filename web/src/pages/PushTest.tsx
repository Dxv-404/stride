/**
 * Push Test — The single most impressive demo.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │   LiveCanvas (fills area)   │
 *   │   + verdict overlay         │
 *   │   + stats overlay           │
 *   ├─────────────────────────────┤
 *   │  BottomDock: ctrl | force | PUSH | ⌨ │
 *   └─────────────────────────────┘
 *
 * Shows a creature walking, with a PUSH button (or spacebar).
 * Key demo: push sine → falls. Push CPG+NN → recovers.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import LiveCanvas, { type LiveCanvasHandle } from '@/components/simulation/LiveCanvas.tsx'
import BottomDock from '@/components/shared/BottomDock.tsx'
import { loadBestChromosomes, getBestGenes, type BestChromosome } from '@/data/best-chromosomes.ts'
import type { ControllerType } from '@/engine/controllers.ts'
import { useUIStore } from '@/stores/uiStore.ts'
import { VISUAL_MODE_LABELS } from '@/components/simulation/VisualModes.ts'
import { CAMERA_MODES, CAMERA_MODE_LABELS, type CameraMode } from '@/components/simulation/CameraModes.ts'
import { GifExporter, downloadBlob } from '@/lib/gifExporter.ts'
import { buildShareUrl } from '@/lib/chromosomeUrl.ts'
import ShareModal from '@/components/shared/ShareModal.tsx'
import PhotoMode from '@/components/shared/PhotoMode.tsx'
import { audioEngine } from '@/lib/audioEngine.ts'

/* ─── Push strengths ─── */

const PUSH_LEVELS = [500, 1000, 1500, 2000] as const

const CONTROLLER_OPTIONS: { type: ControllerType; label: string; color: string }[] = [
  { type: 'sine', label: 'SINE', color: '#3B82F6' },
  { type: 'cpg', label: 'CPG', color: '#10B981' },
  { type: 'cpg_nn', label: 'CPG+NN', color: '#F59E0B' },
]

/* ─── Verdict state ─── */

type Verdict = 'none' | 'waiting' | 'recovered' | 'fell'

export default function PushTest() {
  const [chromosomeData, setChromosomeData] = useState<Record<string, BestChromosome> | null>(null)
  const [controllerType, setControllerType] = useState<ControllerType>('cpg_nn')
  const [pushStrength, setPushStrength] = useState(1000)
  const [verdict, setVerdict] = useState<Verdict>('none')
  const [pushTime, setPushTime] = useState(0)
  const [recoveryTime, setRecoveryTime] = useState(0)
  const [distance, setDistance] = useState(0)
  const [simTime, setSimTime] = useState(0)
  const [resetKey, setResetKey] = useState(0)

  const canvasRef = useRef<LiveCanvasHandle>(null)
  const verdictTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Visual mode
  const visualMode = useUIStore(s => s.visualMode)
  const cycleVisualMode = useUIStore(s => s.cycleVisualMode)
  const setVisualMode = useUIStore(s => s.setVisualMode)
  const audioEnabled = useUIStore(s => s.audioEnabled)
  const toggleAudio = useUIStore(s => s.toggleAudio)
  const [modeFlash, setModeFlash] = useState(false)

  // Camera mode
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow')
  const [cameraFlash, setCameraFlash] = useState(false)

  // Replay state
  const [isReplaying, setIsReplaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(0.25)
  const replayCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Export state
  const [gifCapturing, setGifCapturing] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [photoMode, setPhotoMode] = useState(false)
  const gifExporterRef = useRef<GifExporter | null>(null)

  // Load best chromosomes on mount
  useEffect(() => {
    loadBestChromosomes().then(setChromosomeData)
  }, [])

  // Get genes for current controller type
  const genes = chromosomeData ? getBestGenes(chromosomeData, controllerType) : null

  /* ─── Push handler ─── */

  const handlePush = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || canvas.isFallen()) return

    canvas.push(pushStrength)
    setVerdict('waiting')
    setPushTime(canvas.getTime())

    // Clear any existing timer
    if (verdictTimerRef.current) {
      clearTimeout(verdictTimerRef.current)
    }

    // Check verdict after 3 seconds
    verdictTimerRef.current = setTimeout(() => {
      if (!canvasRef.current) return
      if (canvasRef.current.isFallen()) {
        setVerdict('fell')
        setRecoveryTime(0)
      } else {
        setVerdict('recovered')
        setRecoveryTime(3.0)
      }
    }, 3000)
  }, [pushStrength])

  // Replay handler (defined before keyboard shortcuts that reference it)
  const handleReplay = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.isReplaying()) {
      canvas.stopReplay()
      setIsReplaying(false)
      if (replayCheckRef.current) clearInterval(replayCheckRef.current)
      return
    }
    canvas.playReplay(replaySpeed)
    setIsReplaying(true)
    // Poll for replay end
    replayCheckRef.current = setInterval(() => {
      if (!canvasRef.current?.isReplaying()) {
        setIsReplaying(false)
        if (replayCheckRef.current) clearInterval(replayCheckRef.current)
      }
    }, 100)
  }, [replaySpeed])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space') {
        e.preventDefault()
        handlePush()
      } else if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey) {
        cycleVisualMode()
        setModeFlash(true)
        setTimeout(() => setModeFlash(false), 2000)
      } else if (e.code === 'KeyM' && !e.ctrlKey && !e.metaKey) {
        setVisualMode(visualMode === 'heatmap' ? 'normal' : 'heatmap')
        setModeFlash(true)
        setTimeout(() => setModeFlash(false), 2000)
      } else if (e.code === 'KeyX' && !e.ctrlKey && !e.metaKey) {
        setVisualMode(visualMode === 'xray' ? 'normal' : 'xray')
        setModeFlash(true)
        setTimeout(() => setModeFlash(false), 2000)
      } else if (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey) {
        // Cycle camera mode
        setCameraMode(prev => {
          const idx = CAMERA_MODES.indexOf(prev)
          return CAMERA_MODES[(idx + 1) % CAMERA_MODES.length]
        })
        setCameraFlash(true)
        setTimeout(() => setCameraFlash(false), 2000)
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        // Toggle replay
        handleReplay()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlePush, handleReplay, cycleVisualMode, setVisualMode, visualMode])

  // On fall callback
  const handleFall = useCallback(() => {
    if (verdict === 'waiting') {
      setVerdict('fell')
      const elapsed = canvasRef.current ? canvasRef.current.getTime() - pushTime : 0
      setRecoveryTime(elapsed)
      if (verdictTimerRef.current) {
        clearTimeout(verdictTimerRef.current)
      }
    }
  }, [verdict, pushTime])

  // Frame callback
  const handleFrame = useCallback((state: {
    time: number; distance: number; torsoAngle: number; fallen: boolean
  }) => {
    setDistance(state.distance)
    setSimTime(state.time)
  }, [])

  // Controller change
  const handleControllerChange = useCallback((type: ControllerType) => {
    setControllerType(type)
    setVerdict('none')
    setResetKey(k => k + 1)
    if (verdictTimerRef.current) {
      clearTimeout(verdictTimerRef.current)
    }
  }, [])

  // Reset
  const handleReset = useCallback(() => {
    setVerdict('none')
    setResetKey(k => k + 1)
    if (verdictTimerRef.current) {
      clearTimeout(verdictTimerRef.current)
    }
  }, [])

  // GIF capture handler
  const handleGif = useCallback(async () => {
    const canvas = canvasRef.current?.getCanvas()
    if (!canvas) return
    if (gifCapturing) {
      // Stop capture
      const exporter = gifExporterRef.current
      if (exporter) {
        try {
          const blob = await exporter.stop()
          downloadBlob(blob, `stride-push-${Date.now()}.gif`)
        } catch { /* cancelled */ }
        gifExporterRef.current = null
      }
      setGifCapturing(false)
    } else {
      // Start capture
      const exporter = new GifExporter(canvas, { fps: 20, maxDuration: 5, scale: 0.5 })
      gifExporterRef.current = exporter
      setGifCapturing(true)
      exporter.start()
      // Auto-stop after max duration
      setTimeout(() => {
        if (gifExporterRef.current === exporter && exporter.capturing) {
          exporter.stop().then(blob => {
            downloadBlob(blob, `stride-push-${Date.now()}.gif`)
          }).catch(() => {})
          gifExporterRef.current = null
          setGifCapturing(false)
        }
      }, 5200)
    }
  }, [gifCapturing])

  // Share handler
  const handleShare = useCallback(() => {
    if (!genes) return
    setShareOpen(true)
  }, [genes])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (verdictTimerRef.current) clearTimeout(verdictTimerRef.current)
      if (replayCheckRef.current) clearInterval(replayCheckRef.current)
      gifExporterRef.current?.cancel()
    }
  }, [])

  const activeOption = CONTROLLER_OPTIONS.find(o => o.type === controllerType)!

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden bg-bg-surface">
        {genes ? (
          <LiveCanvas
            key={`${controllerType}-${resetKey}`}
            ref={canvasRef}
            genes={genes}
            controllerType={controllerType}
            terrainType="flat"
            running={true}
            zoom={2.8}
            onFrame={handleFrame}
            onFall={handleFall}
            accentColor={activeOption.color}
            label={activeOption.label}
            visualMode={visualMode}
            cameraMode={cameraMode}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-medium text-xs uppercase tracking-wide text-text-muted animate-pulse">
              LOADING CHROMOSOMES...
            </p>
          </div>
        )}

        {/* Verdict overlay */}
        {verdict !== 'none' && (
          <div className="absolute top-4 right-4 bg-bg-panel/90 border border-border px-4 py-3">
            {verdict === 'waiting' && (
              <div className="font-medium text-xs uppercase tracking-wide text-amber-400 animate-pulse">
                MONITORING...
              </div>
            )}
            {verdict === 'recovered' && (
              <div>
                <div className="font-medium text-xs uppercase tracking-wide text-green-400">✓ RECOVERED</div>
                <div className="font-mono text-[11px] text-text-dim mt-1">
                  Stable after {recoveryTime.toFixed(1)}s
                </div>
              </div>
            )}
            {verdict === 'fell' && (
              <div>
                <div className="font-medium text-xs uppercase tracking-wide text-red-400">✗ FELL</div>
                <div className="font-mono text-[11px] text-text-dim mt-1">
                  Collapsed after {recoveryTime.toFixed(1)}s
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visual mode indicator */}
        {visualMode !== 'normal' && (
          <div className={`absolute top-4 left-4 bg-bg-panel/90 border border-border px-3 py-1.5
            transition-opacity duration-500 ${modeFlash ? 'opacity-100' : 'opacity-50'}`}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              {VISUAL_MODE_LABELS[visualMode]}
            </span>
          </div>
        )}

        {/* Camera mode indicator */}
        {cameraMode !== 'follow' && (
          <div className={`absolute ${visualMode !== 'normal' ? 'top-12' : 'top-4'} left-4 bg-bg-panel/90 border border-border px-3 py-1.5
            transition-opacity duration-500 ${cameraFlash ? 'opacity-100' : 'opacity-50'}`}>
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">
              CAM: {CAMERA_MODE_LABELS[cameraMode]}
            </span>
          </div>
        )}

        {/* Replay badge */}
        {isReplaying && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="bg-bg-panel/80 border border-accent px-5 py-2 animate-pulse">
              <span className="font-mono text-sm uppercase tracking-widest text-accent">
                REPLAY {replaySpeed}×
              </span>
            </div>
          </div>
        )}

        {/* Stats overlay */}
        <div className="absolute bottom-3 left-3 bg-bg-panel/90 border border-border px-3 py-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
            <span className="text-text-dim">Time</span>
            <span className="text-right text-text-secondary">{simTime.toFixed(1)}s</span>
            <span className="text-text-dim">Distance</span>
            <span className="text-right text-text-secondary">{distance.toFixed(0)} px</span>
          </div>
        </div>
      </div>

      {/* Bottom dock */}
      <BottomDock>
        {/* Controller selector */}
        <div className="flex border border-border">
          {CONTROLLER_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => handleControllerChange(opt.type)}
              className={`
                text-[10px] font-medium uppercase tracking-wider px-3 py-1 transition-colors cursor-pointer
                ${controllerType === opt.type
                  ? 'text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
              style={controllerType === opt.type ? { backgroundColor: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Push strength */}
        <div className="flex border border-border">
          {PUSH_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setPushStrength(level)}
              className={`
                text-[10px] font-medium uppercase tracking-wider px-2 py-1 transition-colors cursor-pointer
                ${pushStrength === level
                  ? 'bg-accent text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* PUSH button */}
        <button
          onClick={handlePush}
          className="px-5 py-1 bg-red-600 hover:bg-red-500 text-white
                     text-xs font-semibold uppercase tracking-wide
                     transition-colors cursor-pointer active:scale-95 transform"
        >
          ← PUSH
        </button>

        {/* Keyboard hint */}
        <span className="font-mono text-[10px] text-text-dim">
          or <kbd className="px-1 py-0.5 bg-bg border border-border text-text-secondary text-[10px]">SPACE</kbd>
        </span>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Camera mode */}
        <div className="flex border border-border">
          {CAMERA_MODES.map(mode => (
            <button
              key={mode}
              onClick={() => { setCameraMode(mode); setCameraFlash(true); setTimeout(() => setCameraFlash(false), 2000) }}
              className={`
                text-[10px] font-medium uppercase tracking-wider px-2 py-1 transition-colors cursor-pointer
                ${cameraMode === mode
                  ? 'bg-accent text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
            >
              {CAMERA_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Replay controls */}
        <button
          onClick={handleReplay}
          className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer border
            ${isReplaying
              ? 'border-accent text-accent bg-accent/10'
              : 'border-border text-text-muted hover:text-text'}`}
        >
          {isReplaying ? 'STOP' : 'REPLAY'}
        </button>
        <div className="flex border border-border">
          {([0.25, 0.5, 1] as const).map(spd => (
            <button
              key={spd}
              onClick={() => setReplaySpeed(spd)}
              className={`
                text-[10px] font-medium tracking-wider px-1.5 py-1 transition-colors cursor-pointer
                ${replaySpeed === spd
                  ? 'bg-accent text-bg'
                  : 'bg-transparent text-text-muted hover:text-text'}
              `}
            >
              {spd}×
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Export controls */}
        <button
          onClick={handleGif}
          className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer border
            ${gifCapturing
              ? 'border-red-500 text-red-400 bg-red-500/10 animate-pulse'
              : 'border-border text-text-muted hover:text-text'}`}
        >
          {gifCapturing ? 'STOP GIF' : 'GIF'}
        </button>

        <button
          onClick={handleShare}
          className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider
                     border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          Share
        </button>

        <button
          onClick={() => setPhotoMode(true)}
          className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider
                     border border-border text-text-muted hover:text-text transition-colors cursor-pointer"
        >
          Photo
        </button>

        <button
          onClick={async () => {
            if (!audioEngine.isInitialized) await audioEngine.init()
            audioEngine.muted = !audioEngine.muted
            toggleAudio()
          }}
          className={`px-3 py-1 text-[10px] font-medium uppercase tracking-wider
                     border transition-colors cursor-pointer ${
                       audioEnabled
                         ? 'border-accent/40 bg-accent/10 text-accent'
                         : 'border-border text-text-muted hover:text-text'
                     }`}
        >
          {audioEnabled ? 'Sound ON' : 'Sound OFF'}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset */}
        <button onClick={handleReset} className="btn-flat px-3 py-1 text-xs">
          Reset
        </button>
      </BottomDock>

      {/* Share modal */}
      {shareOpen && genes && (
        <ShareModal
          url={buildShareUrl(genes, controllerType)}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Photo mode */}
      {photoMode && (
        <PhotoMode
          canvas={canvasRef.current?.getCanvas() ?? null}
          onClose={() => setPhotoMode(false)}
        />
      )}
    </div>
  )
}
