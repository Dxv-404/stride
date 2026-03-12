/**
 * NNTimeSeries — Animated line chart of neural network modulation signals.
 *
 * Shows how the CPG+NN controller modulates each of the 6 joints over time.
 * Includes an animated cursor that sweeps across the time axis,
 * a toggle between NN output and raw CPG signal, and a creature selector.
 *
 * Uses Recharts LineChart with 6 Line components (one per joint).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'

/* ─── Types ─── */

interface NNModulationEntry {
  train_fitness: number
  time: number[]
  modulation: number[][]
  cpg: number[][]
}

export interface NNModulationData {
  [controller: string]: NNModulationEntry[]
}

interface NNTimeSeriesProps {
  data: NNModulationData
}

/* ─── Constants ─── */

const JOINT_NAMES = ['Hip L', 'Hip R', 'Knee L', 'Knee R', 'Shoulder L', 'Shoulder R']
const JOINT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const CONTROLLER_LABELS: Record<string, string> = {
  cpgnn_flat: 'CPG+NN (Flat)',
  cpgnn_mixed: 'CPG+NN (Mixed)',
}

/* ─── Component ─── */

export default function NNTimeSeries({ data }: NNTimeSeriesProps) {
  const controllers = useMemo(() => Object.keys(data), [data])
  const [activeController, setActiveController] = useState(controllers[0] ?? 'cpgnn_flat')
  const [activeEntry, setActiveEntry] = useState(0)
  const [cursorTime, setCursorTime] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showCPG, setShowCPG] = useState(false)
  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  const entries = data[activeController] ?? []
  const entry = entries[activeEntry]

  /* ── Build chart data ── */
  const chartData = useMemo(() => {
    if (!entry) return []
    return entry.time.map((t, i) => {
      const row: Record<string, number> = { time: t }
      const source = showCPG ? entry.cpg : entry.modulation
      for (let j = 0; j < 6; j++) {
        row[`j${j}`] = source[i]?.[j] ?? 0
      }
      return row
    })
  }, [entry, showCPG])

  const maxTime = entry?.time[entry.time.length - 1] ?? 15

  /* ── Fixed Y domain (prevents axis jumping during progressive reveal) ── */
  const yDomain = useMemo<[number, number]>(() => {
    let min = Infinity, max = -Infinity
    for (const row of chartData) {
      for (let j = 0; j < 6; j++) {
        const v = row[`j${j}`] as number
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (!isFinite(min)) return [-1, 1]
    const pad = (max - min) * 0.08 || 0.1
    return [min - pad, max + pad]
  }, [chartData])

  /* ── Visible data: progressive reveal during playback ── */
  const visibleData = useMemo(() => {
    if (cursorTime === null) return chartData
    return chartData.filter(d => d.time <= cursorTime)
  }, [chartData, cursorTime])

  /* ── Cursor animation loop ── */
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp
    const elapsed = (timestamp - startTimeRef.current) / 1000
    // Sweep across at 1× real-time, stop at end
    if (elapsed >= maxTime) {
      setCursorTime(null) // reveal full waveform
      setPlaying(false)
      return
    }
    setCursorTime(elapsed)
    rafRef.current = requestAnimationFrame(animate)
  }, [maxTime])

  useEffect(() => {
    if (playing) {
      startTimeRef.current = 0
      setCursorTime(0) // start from empty
      rafRef.current = requestAnimationFrame(animate)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, animate])

  if (!entry) {
    return <div className="text-text-dim font-mono text-xs p-4">No NN modulation data available.</div>
  }

  return (
    <div>
      {/* ── Controller tabs + creature selector ── */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex gap-1">
          {controllers.map(c => (
            <button
              key={c}
              onClick={() => { setActiveController(c); setActiveEntry(0); setPlaying(false); setCursorTime(null) }}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
                activeController === c
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {CONTROLLER_LABELS[c] ?? c}
            </button>
          ))}
        </div>

        {entries.length > 1 && (
          <div className="flex gap-1 ml-auto">
            {entries.map((e, i) => (
              <button
                key={i}
                onClick={() => { setActiveEntry(i); setPlaying(false); setCursorTime(null) }}
                className={`px-2 py-1 font-mono text-[9px] border transition-colors cursor-pointer ${
                  activeEntry === i
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-text-dim hover:text-text-secondary'
                }`}
                title={`Fitness: ${e.train_fitness.toFixed(1)}`}
              >
                #{i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setPlaying(!playing)}
          className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border border-border hover:border-accent text-text-muted hover:text-accent transition-colors cursor-pointer"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          onClick={() => setShowCPG(!showCPG)}
          className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
            showCPG ? 'border-accent text-accent bg-accent/10' : 'border-border text-text-muted hover:text-text-secondary'
          }`}
        >
          {showCPG ? 'Showing: CPG Signal' : 'Showing: NN Output'}
        </button>
        <span className="font-mono text-[9px] text-text-dim ml-auto">
          Fitness: <span className="text-accent">{entry.train_fitness.toFixed(1)}</span>
        </span>
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={visibleData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, maxTime]}
            tick={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fill: 'var(--color-text-dim)' }}
            label={{
              value: 'Time (s)', position: 'bottom', offset: 5,
              style: { fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fill: 'var(--color-text-dim)' },
            }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fill: 'var(--color-text-dim)' }}
            label={{
              value: showCPG ? 'CPG Signal' : 'Modulation',
              angle: -90, position: 'insideLeft', offset: 15,
              style: { fontSize: 9, fontFamily: '"JetBrains Mono", monospace', fill: 'var(--color-text-dim)' },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
            }}
            // @ts-expect-error recharts Formatter generic types are overly strict
            formatter={(value: number, name: string) => {
              const idx = parseInt(name.replace('j', ''))
              return [value.toFixed(3), JOINT_NAMES[idx] ?? name]
            }}
            // @ts-expect-error recharts labelFormatter type expects ReactNode param
            labelFormatter={(label: number) => `t = ${Number(label).toFixed(2)}s`}
          />
          {JOINT_COLORS.map((color, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={`j${i}`}
              stroke={color}
              dot={false}
              strokeWidth={1.5}
              name={`j${i}`}
              isAnimationActive={false}
            />
          ))}
          {cursorTime !== null && (
            <ReferenceLine
              x={cursorTime}
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.5}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {JOINT_NAMES.map((name, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5" style={{ backgroundColor: JOINT_COLORS[i] }} />
            <span className="font-mono text-[9px] text-text-dim">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
