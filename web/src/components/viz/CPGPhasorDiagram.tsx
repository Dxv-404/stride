/**
 * CPGPhasorDiagram — SVG circular phasor diagram for CPG oscillators.
 *
 * Each joint = a dot on a unit circle rotating at its frequency.
 * Lines connect coupled oscillators. Animated: dots rotate showing
 * phase relationships.
 */

import { useState, useEffect, useRef, useMemo } from 'react'

interface CPGPhasorDiagramProps {
  /** Genes array (at least 38 for CPG params) */
  genes: number[]
  /** Accent color */
  accentColor?: string
  /** Size in pixels */
  size?: number
  /** Whether to animate */
  animated?: boolean
}

const JOINT_LABELS = ['hip_L', 'hip_R', 'knee_L', 'knee_R', 'shld_L', 'shld_R']

const JOINT_COLORS = [
  '#F59E0B', '#F59E0B', // hips (amber)
  '#10B981', '#10B981', // knees (green)
  '#3B82F6', '#3B82F6', // shoulders (blue)
]

// Coupling connections (pairs of joint indices)
const COUPLINGS: [number, number][] = [
  [0, 2], // hip_L ↔ knee_L
  [1, 3], // hip_R ↔ knee_R
  [0, 1], // hip_L ↔ hip_R
  [2, 3], // knee_L ↔ knee_R
  [4, 5], // shld_L ↔ shld_R
]

function decodeOscillatorParams(genes: number[]) {
  const oscillators = []
  for (let j = 0; j < 6; j++) {
    const amp = (genes[j * 3] ?? 0.5) * (Math.PI / 2) // [0, π/2]
    const freq = (genes[j * 3 + 1] ?? 0.5) * 4.5 + 0.5 // [0.5, 5.0] Hz
    const phase = (genes[j * 3 + 2] ?? 0) * Math.PI * 2 // [0, 2π]
    oscillators.push({ amp, freq, phase })
  }
  return oscillators
}

function decodeCouplingParams(genes: number[]) {
  const couplings = []
  for (let c = 0; c < COUPLINGS.length; c++) {
    const weight = ((genes[18 + c * 2] ?? 0.5) - 0.5) * 4 // [-2, 2]
    const phaseOffset = (genes[18 + c * 2 + 1] ?? 0) * Math.PI * 2
    couplings.push({ weight, phaseOffset, from: COUPLINGS[c][0], to: COUPLINGS[c][1] })
  }
  return couplings
}

export default function CPGPhasorDiagram({
  genes,
  accentColor = '#F59E0B',
  size = 300,
  animated = true,
}: CPGPhasorDiagramProps) {
  const [time, setTime] = useState(0)
  const animRef = useRef<number>(0)

  const oscillators = useMemo(() => decodeOscillatorParams(genes), [genes])
  const couplings = useMemo(() => decodeCouplingParams(genes), [genes])

  useEffect(() => {
    if (!animated) return
    let running = true
    let last = performance.now()
    const tick = (now: number) => {
      if (!running) return
      const dt = (now - last) / 1000
      last = now
      setTime(prev => prev + dt)
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { running = false; cancelAnimationFrame(animRef.current) }
  }, [animated])

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.35
  const innerRadius = radius * 0.15

  // Compute current phases
  const phases = useMemo(() => {
    return oscillators.map(osc => {
      const currentPhase = osc.phase + 2 * Math.PI * osc.freq * time
      return currentPhase % (Math.PI * 2)
    })
  }, [oscillators, time])

  // Dot positions on the circle
  const dotPositions = phases.map(phase => ({
    x: cx + Math.cos(phase - Math.PI / 2) * radius,
    y: cy + Math.sin(phase - Math.PI / 2) * radius,
  }))

  return (
    <svg width={size} height={size} className="w-full h-auto" viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#333" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={radius * 0.5} fill="none" stroke="#222" strokeWidth={0.5} strokeDasharray="4 4" />
      <circle cx={cx} cy={cy} r={innerRadius} fill="none" stroke="#222" strokeWidth={0.5} />

      {/* Crosshairs */}
      <line x1={cx - radius - 10} y1={cy} x2={cx + radius + 10} y2={cy} stroke="#222" strokeWidth={0.5} />
      <line x1={cx} y1={cy - radius - 10} x2={cx} y2={cy + radius + 10} stroke="#222" strokeWidth={0.5} />

      {/* Phase labels (0, π/2, π, 3π/2) */}
      <text x={cx} y={cy - radius - 14} textAnchor="middle" fontSize={8} fill="#555" fontFamily="monospace">0</text>
      <text x={cx + radius + 14} y={cy + 3} textAnchor="start" fontSize={8} fill="#555" fontFamily="monospace">π/2</text>
      <text x={cx} y={cy + radius + 18} textAnchor="middle" fontSize={8} fill="#555" fontFamily="monospace">π</text>
      <text x={cx - radius - 14} y={cy + 3} textAnchor="end" fontSize={8} fill="#555" fontFamily="monospace">3π/2</text>

      {/* Coupling lines */}
      {couplings.map((c, i) => {
        const from = dotPositions[c.from]
        const to = dotPositions[c.to]
        if (!from || !to) return null
        const absWeight = Math.abs(c.weight)
        const thickness = 0.5 + absWeight * 1.5
        const opacity = 0.1 + (absWeight / 2) * 0.5

        return (
          <line
            key={`coupling-${i}`}
            x1={from.x} y1={from.y}
            x2={to.x} y2={to.y}
            stroke={c.weight > 0 ? accentColor : '#6B7280'}
            strokeWidth={thickness}
            opacity={opacity}
            strokeDasharray={c.weight < 0 ? '4 3' : 'none'}
          />
        )
      })}

      {/* Radial lines from center to dots (like clock hands) */}
      {dotPositions.map((pos, i) => (
        <line
          key={`radial-${i}`}
          x1={cx} y1={cy}
          x2={pos.x} y2={pos.y}
          stroke={JOINT_COLORS[i]}
          strokeWidth={1}
          opacity={0.3}
        />
      ))}

      {/* Oscillator dots */}
      {dotPositions.map((pos, i) => {
        const ampNorm = oscillators[i].amp / (Math.PI / 2)
        const dotRadius = 4 + ampNorm * 6

        return (
          <g key={`dot-${i}`}>
            {/* Glow */}
            <circle
              cx={pos.x} cy={pos.y} r={dotRadius + 3}
              fill={JOINT_COLORS[i]}
              opacity={0.15}
            />
            {/* Dot */}
            <circle
              cx={pos.x} cy={pos.y} r={dotRadius}
              fill={JOINT_COLORS[i]}
              stroke="#111"
              strokeWidth={1}
            />
            {/* Label */}
            <text
              x={pos.x} y={pos.y - dotRadius - 6}
              textAnchor="middle" fontSize={7} fill="#aaa" fontFamily="monospace"
            >
              {JOINT_LABELS[i]}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <g transform={`translate(8, ${size - 50})`}>
        <text fontSize={7} fill="#555" fontFamily="monospace">
          <tspan x={0} dy={0}>● Hips</tspan>
          <tspan x={0} dy={12} fill="#10B981">● Knees</tspan>
          <tspan x={0} dy={12} fill="#3B82F6">● Shoulders</tspan>
        </text>
      </g>

      {/* Frequency info */}
      <g transform={`translate(${size - 80}, ${size - 50})`}>
        {oscillators.slice(0, 3).map((osc, i) => (
          <text key={i} fontSize={7} fill="#555" fontFamily="monospace" x={0} y={i * 12}>
            {['H', 'K', 'S'][i]}: {osc.freq.toFixed(1)} Hz
          </text>
        ))}
      </g>
    </svg>
  )
}
