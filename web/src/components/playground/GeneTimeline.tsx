/**
 * GeneTimeline — DAW-style sine wave visualization of gene parameters.
 *
 * X-axis = time (one gait cycle, 0→2π)
 * Y-axis = joint angle
 * Each joint's sine wave is drawn with its amplitude, frequency, and phase.
 */

import { useMemo } from 'react'
import { JOINT_NAMES } from '@/engine/encoding.ts'

interface GeneTimelineProps {
  genes: number[]
}

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EF4444', '#06B6D4',
]

export default function GeneTimeline({ genes }: GeneTimelineProps) {
  // Decode genes into sine parameters
  const joints = useMemo(() => {
    const result: { name: string; amp: number; freq: number; phase: number; color: string }[] = []
    for (let i = 0; i < Math.min(6, Math.floor(genes.length / 3)); i++) {
      result.push({
        name: JOINT_NAMES[i] || `Joint ${i}`,
        amp: genes[i * 3] ?? 0,
        freq: genes[i * 3 + 1] ?? 0,
        phase: genes[i * 3 + 2] ?? 0,
        color: COLORS[i % COLORS.length],
      })
    }
    return result
  }, [genes])

  const W = 280
  const H = 160
  const PAD = 20

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Gait Timeline
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="border border-border bg-bg-surface">
        {/* Grid lines */}
        <line x1={PAD} y1={H / 2} x2={W - 5} y2={H / 2} stroke="var(--color-border)" strokeWidth="0.5" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="var(--color-border)" strokeWidth="0.5" />

        {/* Time markers */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const x = PAD + t * (W - PAD - 5)
          return (
            <g key={t}>
              <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="var(--color-border)" strokeWidth="0.3" strokeDasharray="2,4" />
              <text x={x} y={H - 5} textAnchor="middle" fill="var(--color-text-dim)" fontSize="6">
                {(t * 2 * Math.PI).toFixed(1)}
              </text>
            </g>
          )
        })}

        {/* Sine waves for each joint */}
        {joints.map((joint) => {
          const points: string[] = []
          const steps = 100
          for (let s = 0; s <= steps; s++) {
            const t = (s / steps) * 2 * Math.PI
            const y = joint.amp * Math.sin((joint.freq * 3 + 0.5) * t + joint.phase * 2 * Math.PI)
            const sx = PAD + (s / steps) * (W - PAD - 5)
            const sy = H / 2 - y * (H / 2 - PAD) * 0.8
            points.push(`${sx},${sy}`)
          }
          return (
            <polyline
              key={joint.name}
              points={points.join(' ')}
              fill="none"
              stroke={joint.color}
              strokeWidth="1.2"
              opacity="0.7"
            />
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {joints.map(j => (
          <div key={j.name} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: j.color }} />
            <span className="font-mono text-[9px] text-text-dim uppercase">{j.name.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
