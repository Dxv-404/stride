/**
 * SkeletonTrail — Animated stick figure walking visualization.
 *
 * Two modes:
 * - Animate (default): Camera follows a walking stick figure with trailing
 *   ghosts, play/pause, speed control, and a frame scrubber.
 * - Trail: Static chronophotography overlay of all positions.
 *
 * Runs a headless p2.js simulation using the best evolved chromosome,
 * captures body positions at ~60 evenly spaced intervals.
 * Lazy-loaded since it imports p2.js.
 */

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { decodeDirect } from '@/engine/encoding.ts'
import { runSimulation } from '@/engine/physics.ts'
import { createTerrain } from '@/engine/terrain.ts'
import type { CreatureFrame } from '@/engine/types.ts'

/* ─── Types ─── */

interface BestChromosome {
  genes: number[]
  fitness: number
  n_runs: number
}

interface SkeletonTrailProps {
  data: Record<string, BestChromosome>
}

/* ─── Constants ─── */

const N_FRAMES = 60   // frames for smooth animation
const N_GHOSTS = 4    // trailing ghost figures
const ACCENT = '#F59E0B'
const SCALE = 100     // pixels per physics meter
const VIEW_W = 500    // viewport width (SVG units)
const VIEW_H = 300    // viewport height (SVG units)

// Limb connections: [fromJoint, toJoint]
const LIMB_SEGMENTS: [string, string][] = [
  ['shoulder_L', 'elbow_L'],
  ['shoulder_R', 'elbow_R'],
  ['hip_L', 'knee_L'],
  ['hip_R', 'knee_R'],
  ['knee_L', 'ankle_L'],
  ['knee_R', 'ankle_R'],
]

// Segments from torso center to joints
const TORSO_SEGMENTS: string[] = [
  'shoulder_L', 'shoulder_R', 'hip_L', 'hip_R',
]

/* ─── Coordinate helpers ─── */

const toX = (px: number) => px * SCALE
const toY = (py: number) => -py * SCALE // flip Y: physics up → SVG down

/* ─── StickFigure sub-component ─── */

function StickFigure({
  frame,
  opacity,
  color = ACCENT,
  strokeW = 1.5,
}: {
  frame: CreatureFrame
  opacity: number
  color?: string
  strokeW?: number
}) {
  const tx = toX(frame.torsoX)
  const ty = toY(frame.torsoY)

  return (
    <g opacity={opacity}>
      {/* Torso dot */}
      <circle cx={tx} cy={ty} r={3} fill={color} />

      {/* Head */}
      {frame.joints['shoulder_L'] && frame.joints['shoulder_R'] && (
        <circle
          cx={tx}
          cy={ty - 10}
          r={5}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
      )}

      {/* Torso → joint segments */}
      {TORSO_SEGMENTS.map(jk => {
        const jt = frame.joints[jk]
        if (!jt) return null
        return (
          <line
            key={jk}
            x1={tx} y1={ty}
            x2={toX(jt.x)} y2={toY(jt.y)}
            stroke={color} strokeWidth={strokeW * 0.8} strokeLinecap="round"
          />
        )
      })}

      {/* Limb segments */}
      {LIMB_SEGMENTS.map(([from, to]) => {
        const j1 = frame.joints[from]
        const j2 = frame.joints[to]
        if (!j1 || !j2) return null
        return (
          <line
            key={`${from}-${to}`}
            x1={toX(j1.x)} y1={toY(j1.y)}
            x2={toX(j2.x)} y2={toY(j2.y)}
            stroke={color} strokeWidth={strokeW * 0.7} strokeLinecap="round"
          />
        )
      })}

      {/* Joint dots */}
      {Object.values(frame.joints).map((jt, ji) => (
        <circle
          key={ji}
          cx={toX(jt.x)} cy={toY(jt.y)}
          r={2} fill={color}
        />
      ))}
    </g>
  )
}

/* ─── Main Component ─── */

export default function SkeletonTrail({ data }: SkeletonTrailProps) {
  const [mode, setMode] = useState<'animate' | 'trail'>('animate')
  const [playing, setPlaying] = useState(true) // auto-play on mount
  const [speed, setSpeed] = useState(1)
  const [currentFrame, setCurrentFrame] = useState(0)
  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const frameAccRef = useRef(0)

  /* ── Run headless simulation and sample frames ── */
  const { frames, error } = useMemo(() => {
    try {
      const chromosome = data['sine'] ?? data['baseline']
      if (!chromosome?.genes) {
        return { frames: [] as CreatureFrame[], error: 'No sine chromosome available' }
      }

      const jointParams = decodeDirect(chromosome.genes)
      const terrain = createTerrain('flat')
      const result = runSimulation(terrain, jointParams)

      if (result.frames.length < 10) {
        return { frames: [] as CreatureFrame[], error: 'Simulation too short' }
      }

      // Sample N_FRAMES evenly spaced frames (skip first 10% for settling)
      const startIdx = Math.floor(result.frames.length * 0.1)
      const endIdx = result.frames.length - 1
      const step = (endIdx - startIdx) / (N_FRAMES - 1)
      const sampled: CreatureFrame[] = []
      for (let i = 0; i < N_FRAMES; i++) {
        const idx = Math.round(startIdx + i * step)
        sampled.push(result.frames[Math.min(idx, endIdx)])
      }

      return { frames: sampled, error: null }
    } catch (e) {
      return {
        frames: [] as CreatureFrame[],
        error: e instanceof Error ? e.message : 'Simulation failed',
      }
    }
  }, [data])

  /* ── Bounds for trail mode (full overview) ── */
  const trailViewBox = useMemo(() => {
    if (frames.length === 0) return '0 -300 800 400'
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const frame of frames) {
      minX = Math.min(minX, toX(frame.torsoX))
      maxX = Math.max(maxX, toX(frame.torsoX))
      minY = Math.min(minY, toY(frame.torsoY))
      maxY = Math.max(maxY, toY(frame.torsoY))
      for (const jt of Object.values(frame.joints)) {
        minX = Math.min(minX, toX(jt.x))
        maxX = Math.max(maxX, toX(jt.x))
        minY = Math.min(minY, toY(jt.y))
        maxY = Math.max(maxY, toY(jt.y))
      }
    }
    const padX = (maxX - minX) * 0.08 + 30
    const padY = (maxY - minY) * 0.12 + 30
    return `${minX - padX} ${minY - padY} ${maxX - minX + padX * 2} ${maxY - minY + padY * 2}`
  }, [frames])

  /* ── Ground tick marks ── */
  const groundTicks = useMemo(() => {
    if (frames.length === 0) return []
    const ticks: number[] = []
    const startM = Math.floor(frames[0].torsoX) - 2
    const endM = Math.ceil(frames[frames.length - 1].torsoX) + 2
    for (let x = startM; x <= endM; x++) {
      ticks.push(x)
    }
    return ticks
  }, [frames])

  /* ── Animation loop ── */
  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const delta = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    frameAccRef.current += delta * speed * 20 // ~20 fps base playback
    if (frameAccRef.current >= 1) {
      const steps = Math.floor(frameAccRef.current)
      frameAccRef.current -= steps
      setCurrentFrame(prev => (prev + steps) % frames.length) // loop
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [speed, frames.length])

  useEffect(() => {
    if (playing && mode === 'animate') {
      lastTimeRef.current = 0
      frameAccRef.current = 0
      rafRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, animate, mode])

  /* ── Error / empty state ── */
  if (error || frames.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-mono text-xs text-text-dim">{error || 'No frames generated'}</p>
      </div>
    )
  }

  /* ── Compute viewBox ── */
  const frame = frames[currentFrame]
  const cx = toX(frame.torsoX)
  const cy = toY(frame.torsoY)
  const viewBox = mode === 'animate'
    ? `${cx - VIEW_W / 2} ${cy - VIEW_H * 0.35} ${VIEW_W} ${VIEW_H}`
    : trailViewBox

  return (
    <div>
      {/* ── Controls ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Mode toggle */}
        <button
          onClick={() => {
            const next = mode === 'animate' ? 'trail' : 'animate'
            setMode(next)
            if (next === 'animate') setPlaying(true)
          }}
          className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
            mode === 'animate'
              ? 'border-accent text-accent bg-accent/10'
              : 'border-border text-text-muted hover:text-text-secondary'
          }`}
        >
          {mode === 'animate' ? '● Animate' : '◫ Trail'}
        </button>

        {mode === 'animate' && (
          <>
            {/* Play/Pause */}
            <button
              onClick={() => setPlaying(!playing)}
              className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border border-border hover:border-accent text-text-muted hover:text-accent transition-colors cursor-pointer"
            >
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>

            {/* Speed buttons */}
            {[0.5, 1, 2].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 font-mono text-[9px] border transition-colors cursor-pointer ${
                  speed === s
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-text-dim hover:text-text-secondary'
                }`}
              >
                {s}×
              </button>
            ))}

            {/* Frame scrubber */}
            <input
              type="range"
              min={0}
              max={frames.length - 1}
              value={currentFrame}
              onChange={e => {
                setCurrentFrame(parseInt(e.target.value))
                setPlaying(false)
              }}
              className="flex-1 min-w-[80px] h-1 accent-[#F59E0B] cursor-pointer"
            />
          </>
        )}

        <span className="font-mono text-[9px] text-text-dim ml-auto">
          {mode === 'animate'
            ? `Frame ${currentFrame + 1}/${frames.length} · ${frame.torsoX.toFixed(1)}m`
            : `Sine controller · ${frames.length} snapshots`
          }
        </span>
      </div>

      {/* ── SVG Canvas ── */}
      <svg
        viewBox={viewBox}
        className="w-full bg-[#0a0a0f] border border-border"
        style={{ minHeight: 280 }}
      >
        {/* Ground line (extends well beyond creature path) */}
        <line
          x1={toX(frames[0].torsoX - 5)}
          y1={0}
          x2={toX(frames[frames.length - 1].torsoX + 5)}
          y2={0}
          stroke="var(--color-border)"
          strokeWidth={1}
        />

        {/* Ground tick marks (distance markers) */}
        {groundTicks.map(m => (
          <g key={m}>
            <line
              x1={toX(m)} y1={0}
              x2={toX(m)} y2={6}
              stroke="var(--color-border)" strokeWidth={0.5}
            />
            <text
              x={toX(m)} y={18}
              fill="var(--color-text-dim)"
              textAnchor="middle"
              style={{ fontSize: 8, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {m}m
            </text>
          </g>
        ))}

        {mode === 'animate' ? (
          <>
            {/* Trailing ghosts (previous positions, fading out) */}
            {Array.from({ length: N_GHOSTS }, (_, gi) => {
              const ghostIdx = currentFrame - (gi + 1) * 2
              if (ghostIdx < 0) return null
              return (
                <StickFigure
                  key={`ghost-${gi}`}
                  frame={frames[ghostIdx]}
                  opacity={0.18 - gi * 0.035}
                  color={ACCENT}
                  strokeW={1}
                />
              )
            })}

            {/* Current frame (fully visible, thicker strokes) */}
            <StickFigure
              frame={frames[currentFrame]}
              opacity={1}
              color={ACCENT}
              strokeW={2}
            />

            {/* Distance label above head */}
            <text
              x={cx}
              y={cy - 25}
              fill={ACCENT}
              textAnchor="middle"
              opacity={0.6}
              style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            >
              {frame.torsoX.toFixed(1)}m
            </text>

            {/* Direction arrow (top-left of viewport) */}
            <g opacity={0.25}>
              <line
                x1={cx - VIEW_W / 2 + 25} y1={cy - VIEW_H * 0.3}
                x2={cx - VIEW_W / 2 + 75} y2={cy - VIEW_H * 0.3}
                stroke={ACCENT} strokeWidth={1}
              />
              <polygon
                points={[
                  `${cx - VIEW_W / 2 + 75},${cy - VIEW_H * 0.3 - 4}`,
                  `${cx - VIEW_W / 2 + 83},${cy - VIEW_H * 0.3}`,
                  `${cx - VIEW_W / 2 + 75},${cy - VIEW_H * 0.3 + 4}`,
                ].join(' ')}
                fill={ACCENT}
              />
            </g>
          </>
        ) : (
          /* Trail mode: all frames with increasing opacity */
          frames.map((f, fi) => (
            <StickFigure
              key={fi}
              frame={f}
              opacity={0.06 + (fi / (frames.length - 1)) * 0.7}
              strokeW={1.2}
            />
          ))
        )}
      </svg>

      <p className="font-mono text-[9px] text-text-dim text-center mt-2">
        {mode === 'animate'
          ? 'Sine controller · Camera follows creature · Drag scrubber to explore'
          : 'Chronophotography-style motion study · Opacity increases with time (left → right)'
        }
      </p>
    </div>
  )
}
