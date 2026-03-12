/**
 * PlaybackControls — horizontal transport bar for the BottomDock.
 *
 * Layout:
 *   [Start/Pause] [Step] [Reset] | [1x 2x 5x 10x MAX] [Auto-Pause] | Gen 12/75 [━━━━━░░░] | [◄ scrubber ►]
 *
 * Three playback modes:
 *   A. Step Mode   – "Step" button runs exactly one generation, then auto-pauses.
 *   B. Auto-Pause  – Toggle that pauses after each generation so creatures play fully.
 *   C. Scrubber    – After evolution completes, a slider lets user scrub generation snapshots.
 */

import { useSimulationStore, type PlaybackSpeed } from '@/stores/simulationStore'

interface PlaybackControlsProps {
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  onStep: () => void
  /** Called when user drags the generation scrubber */
  onScrub?: (generation: number) => void
  /** Total stored snapshots (for scrubber max) */
  snapshotCount?: number
}

const SPEEDS: { value: PlaybackSpeed; label: string }[] = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 5, label: '5×' },
  { value: 10, label: '10×' },
  { value: 'max', label: 'MAX' },
]

export default function PlaybackControls({
  onStart,
  onPause,
  onResume,
  onReset,
  onStep,
  onScrub,
  snapshotCount = 0,
}: PlaybackControlsProps) {
  const status = useSimulationStore((s) => s.status)
  const speed = useSimulationStore((s) => s.speed)
  const setSpeed = useSimulationStore((s) => s.setSpeed)
  const stats = useSimulationStore((s) => s.stats)
  const params = useSimulationStore((s) => s.params)
  const autoPause = useSimulationStore((s) => s.autoPauseBetweenGens)
  const setAutoPause = useSimulationStore((s) => s.setAutoPauseBetweenGens)
  const scrubberGen = useSimulationStore((s) => s.scrubberGeneration)

  const progressPct =
    params.maxGenerations > 0
      ? Math.min((stats.generation / params.maxGenerations) * 100, 100)
      : 0

  const showPlay = status === 'idle' || status === 'completed'
  const showResume = status === 'paused'
  const pauseEnabled = status === 'running'
  const resetEnabled = status !== 'idle'
  const stepEnabled = status === 'paused' || status === 'idle' || status === 'completed'
  const showScrubber = status === 'completed' && snapshotCount > 1

  // Current display generation (scrubber overrides live gen)
  const displayGen = scrubberGen ?? stats.generation

  return (
    <div className="flex items-center gap-3">
      {/* ── Primary action button ── */}
      {showPlay && (
        <button className="btn-flat btn-primary px-4 py-1 text-xs" onClick={onStart}>
          Start
        </button>
      )}
      {showResume && (
        <button className="btn-flat btn-primary px-4 py-1 text-xs" onClick={onResume}>
          Resume
        </button>
      )}
      {!showPlay && !showResume && (
        <button
          className="btn-flat btn-primary px-4 py-1 text-xs"
          disabled={!pauseEnabled}
          onClick={onPause}
        >
          Pause
        </button>
      )}

      {/* Step */}
      <button
        className={`btn-flat px-3 py-1 text-xs ${!stepEnabled ? 'opacity-40 pointer-events-none' : ''}`}
        disabled={!stepEnabled}
        onClick={onStep}
        title="Advance one generation"
      >
        Step
      </button>

      {/* Reset */}
      <button
        className={`btn-flat px-3 py-1 text-xs ${!resetEnabled ? 'opacity-40 pointer-events-none' : ''}`}
        disabled={!resetEnabled}
        onClick={onReset}
      >
        Reset
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-border" />

      {/* ── Speed selector ── */}
      <div className="flex items-center gap-0.5">
        {SPEEDS.map(({ value, label }) => (
          <button
            key={String(value)}
            onClick={() => setSpeed(value)}
            className={`
              font-mono text-[10px] px-1.5 py-0.5 border transition-colors cursor-pointer
              ${speed === value
                ? 'bg-accent text-bg border-accent'
                : 'bg-transparent text-text-muted border-border hover:border-accent-subtle hover:text-text'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Auto-Pause toggle */}
      <button
        onClick={() => setAutoPause(!autoPause)}
        className={`
          font-mono text-[10px] px-2 py-0.5 border transition-colors cursor-pointer
          ${autoPause
            ? 'bg-accent text-bg border-accent'
            : 'bg-transparent text-text-muted border-border hover:border-accent-subtle hover:text-text'
          }
        `}
        title="Auto-pause after each generation"
      >
        Auto-Pause
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-border" />

      {/* ── Generation progress ── */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-text-muted tabular-nums">
          Gen {displayGen}/{params.maxGenerations}
        </span>
        {!showScrubber && (
          <div className="w-24 h-1 bg-bg rounded-sm overflow-hidden border border-border">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </div>

      {/* ── Generation scrubber (visible when completed) ── */}
      {showScrubber && onScrub && (
        <>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-text-dim uppercase tracking-wider">
              Scrub
            </span>
            <input
              type="range"
              min={0}
              max={snapshotCount - 1}
              value={scrubberGen ?? snapshotCount - 1}
              onChange={(e) => onScrub(Number(e.target.value))}
              className="w-28 h-1 accent-[var(--color-accent)] cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
