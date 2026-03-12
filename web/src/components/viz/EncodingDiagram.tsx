/**
 * EncodingDiagram — SVG butterfly layout comparing direct and indirect encoding.
 *
 * Left side: 18 bars (direct encoding — 6 joints × 3 params)
 * Right side: 9 bars (indirect encoding — 3 joints × 3 params, mirrored)
 * Center: simplified stick figure showing 6 motorized joints
 * Lines connecting gene groups to joints.
 *
 * Illustrates how indirect encoding uses half the genes by
 * mirroring left-side joint params to the right side.
 */

import { useState, useMemo } from 'react'

/* ─── Types ─── */

interface BestChromosome {
  genes: number[]
  fitness: number
  n_runs: number
}

interface EncodingDiagramProps {
  data: Record<string, BestChromosome>
}

/* ─── Constants ─── */

const JOINTS = ['Hip', 'Knee', 'Shoulder'] as const
const PARAMS = ['Amp', 'Freq', 'Phase'] as const

const DIRECT_LABELS = [
  'hip_L amp', 'hip_L freq', 'hip_L phase',
  'hip_R amp', 'hip_R freq', 'hip_R phase',
  'knee_L amp', 'knee_L freq', 'knee_L phase',
  'knee_R amp', 'knee_R freq', 'knee_R phase',
  'shldr_L amp', 'shldr_L freq', 'shldr_L phase',
  'shldr_R amp', 'shldr_R freq', 'shldr_R phase',
]

const INDIRECT_LABELS = [
  'hip amp', 'hip freq', 'hip phase',
  'knee amp', 'knee freq', 'knee phase',
  'shldr amp', 'shldr freq', 'shldr phase',
]

const PARAM_COLORS: Record<string, string> = {
  Amp: '#F59E0B',
  Freq: '#3B82F6',
  Phase: '#10B981',
}

/* ─── Stick figure joint positions (center column) ─── */
const FIGURE_CX = 350
const FIGURE = {
  head: { cx: FIGURE_CX, cy: 60, r: 12 },
  torso: { x1: FIGURE_CX, y1: 72, x2: FIGURE_CX, y2: 140 },
  // Joint positions (for connection lines)
  joints: {
    Shoulder: { y: 85 },
    Hip: { y: 140 },
    Knee: { y: 195 },
  },
  // Limb segments
  upperArm_L: { x1: FIGURE_CX, y1: 85, x2: FIGURE_CX - 30, y2: 115 },
  upperArm_R: { x1: FIGURE_CX, y1: 85, x2: FIGURE_CX + 30, y2: 115 },
  forearm_L: { x1: FIGURE_CX - 30, y1: 115, x2: FIGURE_CX - 35, y2: 145 },
  forearm_R: { x1: FIGURE_CX + 30, y1: 115, x2: FIGURE_CX + 35, y2: 145 },
  thigh_L: { x1: FIGURE_CX, y1: 140, x2: FIGURE_CX - 20, y2: 190 },
  thigh_R: { x1: FIGURE_CX, y1: 140, x2: FIGURE_CX + 20, y2: 190 },
  shin_L: { x1: FIGURE_CX - 20, y1: 190, x2: FIGURE_CX - 22, y2: 240 },
  shin_R: { x1: FIGURE_CX + 20, y1: 190, x2: FIGURE_CX + 22, y2: 240 },
  foot_L: { x1: FIGURE_CX - 22, y1: 240, x2: FIGURE_CX - 35, y2: 245 },
  foot_R: { x1: FIGURE_CX + 22, y1: 240, x2: FIGURE_CX + 35, y2: 245 },
}

/* ─── Component ─── */

export default function EncodingDiagram({ data }: EncodingDiagramProps) {
  const [hoveredJoint, setHoveredJoint] = useState<string | null>(null)

  /* ── Get sine (direct) genes ── */
  const directGenes = useMemo(() => {
    const sine = data['sine'] ?? data['baseline']
    return sine?.genes?.slice(0, 18) ?? Array(18).fill(0.5)
  }, [data])

  /* ── Indirect = first 9 genes mirrored ── */
  const indirectGenes = useMemo(() => {
    return directGenes.slice(0, 9) // hip_L, knee_L, shldr_L → mirrored to R
  }, [directGenes])

  const BAR_MAX_W = 80
  const LEFT_X = 30        // Direct bars (left panel)
  const RIGHT_X = 470      // Indirect bars (right panel)
  const BAR_H = 10
  const BAR_GAP = 2.5

  return (
    <div>
      <svg viewBox="0 0 700 300" className="w-full max-w-2xl mx-auto" style={{ minHeight: 280 }}>
        {/* ── Title labels ── */}
        <text x={LEFT_X + BAR_MAX_W / 2} y={18} textAnchor="middle"
          className="fill-[var(--color-text-secondary)]"
          style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Direct (18 genes)
        </text>
        <text x={RIGHT_X + BAR_MAX_W / 2} y={18} textAnchor="middle"
          className="fill-[var(--color-text-secondary)]"
          style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Indirect (9 genes)
        </text>

        {/* ── Direct encoding bars (left) ── */}
        {directGenes.map((val, i) => {
          const jointIdx = Math.floor(i / 3) // 0-5 → which joint pair
          const paramIdx = i % 3
          const jointName = JOINTS[Math.floor(jointIdx / 2)]
          const isHighlighted = hoveredJoint === null || hoveredJoint === jointName
          const y = 30 + i * (BAR_H + BAR_GAP)
          const barW = val * BAR_MAX_W
          const color = PARAM_COLORS[PARAMS[paramIdx]]

          return (
            <g key={`d-${i}`}
              onMouseEnter={() => setHoveredJoint(jointName)}
              onMouseLeave={() => setHoveredJoint(null)}
              style={{ transition: 'opacity 0.2s' }}
              opacity={isHighlighted ? 1 : 0.2}
            >
              {/* Background */}
              <rect x={LEFT_X} y={y} width={BAR_MAX_W} height={BAR_H} fill="var(--color-border)" opacity={0.3} rx={1} />
              {/* Value bar (grows right) */}
              <rect x={LEFT_X} y={y} width={barW} height={BAR_H} fill={color} opacity={0.8} rx={1} />
              {/* Label */}
              <text x={LEFT_X + BAR_MAX_W + 4} y={y + BAR_H - 1.5}
                className="fill-[var(--color-text-dim)]"
                style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono, monospace' }}>
                {DIRECT_LABELS[i]}
              </text>
            </g>
          )
        })}

        {/* ── Indirect encoding bars (right) ── */}
        {indirectGenes.map((val, i) => {
          const jointIdx = Math.floor(i / 3) // 0-2 → which joint
          const paramIdx = i % 3
          const jointName = JOINTS[jointIdx]
          const isHighlighted = hoveredJoint === null || hoveredJoint === jointName
          // Center vertically relative to direct bars
          const directMidY = 30 + 9 * (BAR_H + BAR_GAP) - (BAR_H + BAR_GAP) / 2
          const indirectTotalH = 9 * (BAR_H + BAR_GAP)
          const startY = directMidY - indirectTotalH / 2
          const y = startY + i * (BAR_H + BAR_GAP)
          const barW = val * BAR_MAX_W
          const color = PARAM_COLORS[PARAMS[paramIdx]]

          return (
            <g key={`i-${i}`}
              onMouseEnter={() => setHoveredJoint(jointName)}
              onMouseLeave={() => setHoveredJoint(null)}
              style={{ transition: 'opacity 0.2s' }}
              opacity={isHighlighted ? 1 : 0.2}
            >
              {/* Background */}
              <rect x={RIGHT_X} y={y} width={BAR_MAX_W} height={BAR_H} fill="var(--color-border)" opacity={0.3} rx={1} />
              {/* Value bar */}
              <rect x={RIGHT_X} y={y} width={barW} height={BAR_H} fill={color} opacity={0.8} rx={1} />
              {/* Label */}
              <text x={RIGHT_X + BAR_MAX_W + 4} y={y + BAR_H - 1.5}
                className="fill-[var(--color-text-dim)]"
                style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono, monospace' }}>
                {INDIRECT_LABELS[i]}
              </text>
              {/* Mirror indicator */}
              <text x={RIGHT_X - 6} y={y + BAR_H - 1.5} textAnchor="end"
                className="fill-[var(--color-text-dim)]"
                style={{ fontSize: 6, fontFamily: 'JetBrains Mono, monospace' }}>
                ⟷
              </text>
            </g>
          )
        })}

        {/* ── Center stick figure ── */}
        <g opacity={0.7}>
          {/* Head */}
          <circle cx={FIGURE.head.cx} cy={FIGURE.head.cy} r={FIGURE.head.r}
            fill="none" stroke="var(--color-text-dim)" strokeWidth={1.5} />
          {/* Torso */}
          <line {...FIGURE.torso} stroke="var(--color-text-dim)" strokeWidth={2} />
          {/* Limbs */}
          {(['upperArm_L', 'upperArm_R', 'forearm_L', 'forearm_R',
            'thigh_L', 'thigh_R', 'shin_L', 'shin_R',
            'foot_L', 'foot_R'] as const).map(limb => (
            <line key={limb} {...FIGURE[limb]} stroke="var(--color-text-dim)" strokeWidth={1.5} />
          ))}
          {/* Joint dots */}
          {JOINTS.map(joint => {
            const jy = FIGURE.joints[joint].y
            const isHighlighted = hoveredJoint === null || hoveredJoint === joint
            return (
              <g key={joint}>
                <circle cx={FIGURE_CX - (joint === 'Shoulder' ? 0 : 20)} cy={jy + (joint === 'Knee' ? 5 : 0)}
                  r={4} fill={isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
                  style={{ transition: 'fill 0.2s' }}
                  onMouseEnter={() => setHoveredJoint(joint)}
                  onMouseLeave={() => setHoveredJoint(null)}
                />
                <circle cx={FIGURE_CX + (joint === 'Shoulder' ? 0 : 20)} cy={jy + (joint === 'Knee' ? 5 : 0)}
                  r={4} fill={isHighlighted ? 'var(--color-accent)' : 'var(--color-border)'}
                  style={{ transition: 'fill 0.2s' }}
                  onMouseEnter={() => setHoveredJoint(joint)}
                  onMouseLeave={() => setHoveredJoint(null)}
                />
                {/* Joint label */}
                <text x={FIGURE_CX} y={jy + (joint === 'Knee' ? 5 : 0) - 10} textAnchor="middle"
                  className="fill-[var(--color-text-dim)]"
                  style={{ fontSize: 7, fontFamily: 'JetBrains Mono, monospace' }}>
                  {joint}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* ── Legend ── */}
      <div className="flex justify-center gap-6 mt-2">
        {PARAMS.map(p => (
          <div key={p} className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PARAM_COLORS[p] }} />
            <span className="font-mono text-[9px] text-text-dim">{p === 'Amp' ? 'Amplitude' : p === 'Freq' ? 'Frequency' : 'Phase'}</span>
          </div>
        ))}
      </div>

      <p className="font-mono text-[9px] text-text-dim text-center mt-2">
        Hover over joint dots to highlight connected genes · Indirect encoding mirrors L↔R
      </p>
    </div>
  )
}
