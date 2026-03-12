/**
 * ComparativeAnatomy — Side-by-side creature diagrams with measurements.
 *
 * Shows static creature poses for each controller type with labeled
 * measurements: limb lengths, joint ranges, body proportions.
 * Highlights differences between controllers.
 */

import {
  TORSO_WIDTH, TORSO_HEIGHT,
  UPPER_LEG_LENGTH, LOWER_LEG_LENGTH, FOOT_HEIGHT,
  UPPER_ARM_LENGTH, LOWER_ARM_LENGTH,
} from '@/engine/config.ts'

interface AnatomyProps {
  /** Controllers to compare */
  controllers: {
    label: string
    color: string
    geneCount: number
  }[]
  /** Width per diagram */
  width?: number
  /** Height per diagram */
  height?: number
}

export default function ComparativeAnatomy({
  controllers,
  width = 160,
  height = 200,
}: AnatomyProps) {
  const measurements = [
    { label: 'Torso', value: `${TORSO_WIDTH.toFixed(0)}×${TORSO_HEIGHT.toFixed(0)}` },
    { label: 'Upper Leg', value: `${UPPER_LEG_LENGTH.toFixed(0)}` },
    { label: 'Lower Leg', value: `${LOWER_LEG_LENGTH.toFixed(0)}` },
    { label: 'Foot', value: `${FOOT_HEIGHT.toFixed(0)}` },
    { label: 'Upper Arm', value: `${UPPER_ARM_LENGTH.toFixed(0)}` },
    { label: 'Lower Arm', value: `${LOWER_ARM_LENGTH.toFixed(0)}` },
  ]

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {controllers.map((ctrl) => (
        <div key={ctrl.label} className="flex-shrink-0">
          <div className="text-[9px] font-medium uppercase tracking-wider text-text-muted mb-1 text-center"
               style={{ color: ctrl.color }}>
            {ctrl.label}
          </div>
          <div className="border border-border bg-bg-surface" style={{ width, height }}>
            <svg width={width} height={height - 30} viewBox="0 0 100 120">
              {/* Torso */}
              <rect x={38} y={20} width={24} height={15} rx={2}
                fill="none" stroke={ctrl.color} strokeWidth={1.2} opacity={0.8} />

              {/* Head */}
              <circle cx={50} cy={14} r={5} fill="none" stroke={ctrl.color} strokeWidth={1} opacity={0.6} />

              {/* Left leg */}
              <line x1={42} y1={35} x2={38} y2={55} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />
              <line x1={38} y1={55} x2={36} y2={75} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />
              <line x1={36} y1={75} x2={33} y2={80} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />

              {/* Right leg */}
              <line x1={58} y1={35} x2={62} y2={55} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />
              <line x1={62} y1={55} x2={64} y2={75} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />
              <line x1={64} y1={75} x2={67} y2={80} stroke={ctrl.color} strokeWidth={1} opacity={0.7} />

              {/* Left arm */}
              <line x1={38} y1={24} x2={30} y2={38} stroke={ctrl.color} strokeWidth={0.8} opacity={0.5} />
              <line x1={30} y1={38} x2={28} y2={50} stroke={ctrl.color} strokeWidth={0.8} opacity={0.5} />

              {/* Right arm */}
              <line x1={62} y1={24} x2={70} y2={38} stroke={ctrl.color} strokeWidth={0.8} opacity={0.5} />
              <line x1={70} y1={38} x2={72} y2={50} stroke={ctrl.color} strokeWidth={0.8} opacity={0.5} />

              {/* Measurement lines */}
              <line x1={25} y1={35} x2={25} y2={55} stroke={ctrl.color} strokeWidth={0.3} strokeDasharray="1 1" opacity={0.4} />
              <text x={23} y={47} fill={ctrl.color} fontSize={4} textAnchor="end" opacity={0.5}>
                {UPPER_LEG_LENGTH.toFixed(0)}
              </text>

              <line x1={25} y1={55} x2={25} y2={75} stroke={ctrl.color} strokeWidth={0.3} strokeDasharray="1 1" opacity={0.4} />
              <text x={23} y={67} fill={ctrl.color} fontSize={4} textAnchor="end" opacity={0.5}>
                {LOWER_LEG_LENGTH.toFixed(0)}
              </text>

              {/* Ground line */}
              <line x1={10} y1={82} x2={90} y2={82} stroke="currentColor" strokeWidth={0.3} opacity={0.2} />

              {/* Gene count badge */}
              <text x={50} y={100} fill={ctrl.color} fontSize={5} textAnchor="middle" opacity={0.6}>
                {ctrl.geneCount} genes
              </text>
            </svg>
          </div>
          {/* Measurements table */}
          <div className="mt-1">
            {measurements.map(m => (
              <div key={m.label} className="flex justify-between text-[7px] font-mono text-text-dim px-1">
                <span>{m.label}</span>
                <span style={{ color: ctrl.color }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
