/**
 * BehavioralRadar — SVG spider/radar chart comparing controller gait profiles.
 *
 * 5 axes: Distance, Speed, Efficiency (1/CoT), Stability (1/torso angle), Symmetry.
 * Overlapping translucent polygons per controller tier (sine=blue, cpg=green, cpg_nn=orange).
 * Concentric pentagon grid lines. Hover highlights one controller, dims others.
 */

import { useState, useMemo } from 'react'

/* ─── Types ─── */

interface FingerprintMetric {
  mean: number
  std: number
  values: number[]
}

interface ControllerGait {
  symmetry: {
    n_walking: number
    n_hopping: number
    n_incommensurate: number
    phase_diffs: number[]
  }
  fingerprint: Record<string, FingerprintMetric>
}

export interface GaitData {
  [controller: string]: ControllerGait
}

interface BehavioralRadarProps {
  data: GaitData
}

/* ─── Constants ─── */

const AXES = ['Distance', 'Speed', 'Efficiency', 'Stability', 'Symmetry'] as const
const AXIS_COUNT = AXES.length
const CENTER = 200
const RADIUS = 150
const GRID_LEVELS = 4

const CONTROLLER_STYLES: Record<string, { color: string; label: string }> = {
  sine: { color: '#3B82F6', label: 'Sine' },
  cpg: { color: '#10B981', label: 'CPG' },
  cpgnn_flat: { color: '#F59E0B', label: 'CPG+NN' },
}

/* ─── Geometry helpers ─── */

function angleForAxis(i: number): number {
  // Start from top (-π/2), go clockwise
  return (2 * Math.PI * i) / AXIS_COUNT - Math.PI / 2
}

function polarToXY(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)]
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const angle = angleForAxis(i)
      const r = v * RADIUS
      const [x, y] = polarToXY(angle, r)
      return `${x},${y}`
    })
    .join(' ')
}

/* ─── Component ─── */

export default function BehavioralRadar({ data }: BehavioralRadarProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  /* ── Normalize across controllers ── */
  const { controllers, normalized } = useMemo(() => {
    const ctrls = Object.keys(data).filter(k => CONTROLLER_STYLES[k])

    // Extract raw values per axis
    const raw: Record<string, number[]> = {}
    for (const ctrl of ctrls) {
      const fp = data[ctrl].fingerprint
      const sym = data[ctrl].symmetry

      // Distance (mean)
      const distance = Math.max(0, fp.distance?.mean ?? 0)
      // Speed (mean)
      const speed = Math.max(0, fp.avg_speed?.mean ?? 0)
      // Efficiency = 1 / cost_of_transport (lower CoT = better)
      const cot = fp.cost_of_transport?.mean ?? 1
      const efficiency = cot > 0 ? 1 / cot : 0
      // Stability = 1 / avg_torso_angle (lower angle = more stable)
      const angle = fp.avg_torso_angle?.mean ?? 1
      const stability = angle > 0 ? 1 / angle : 0
      // Symmetry = average(1 - |phase_diff - π| / π) across phase diffs
      const phaseDiffs = sym.phase_diffs ?? []
      const symmetry = phaseDiffs.length > 0
        ? phaseDiffs.reduce((sum, pd) => sum + (1 - Math.abs(pd - Math.PI) / Math.PI), 0) / phaseDiffs.length
        : 0

      raw[ctrl] = [distance, speed, efficiency, stability, Math.max(0, symmetry)]
    }

    // Find max per axis for normalization
    const maxPerAxis = Array.from({ length: AXIS_COUNT }, (_, ai) =>
      Math.max(...ctrls.map(c => raw[c][ai]), 0.001),
    )

    // Normalize to [0, 1]
    const norm: Record<string, number[]> = {}
    for (const ctrl of ctrls) {
      norm[ctrl] = raw[ctrl].map((v, i) => v / maxPerAxis[i])
    }

    return { controllers: ctrls, normalized: norm }
  }, [data])

  const svgSize = CENTER * 2 + 20

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full max-w-md mx-auto" style={{ minHeight: 300 }}>
        {/* ── Grid rings (concentric pentagons) ── */}
        {Array.from({ length: GRID_LEVELS }, (_, level) => {
          const r = ((level + 1) / GRID_LEVELS) * RADIUS
          const pts = Array.from({ length: AXIS_COUNT }, (_, i) => {
            const angle = angleForAxis(i)
            const [x, y] = polarToXY(angle, r)
            return `${x},${y}`
          }).join(' ')

          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={0.5}
              opacity={0.6}
            />
          )
        })}

        {/* ── Axis lines ── */}
        {AXES.map((_, i) => {
          const angle = angleForAxis(i)
          const [x2, y2] = polarToXY(angle, RADIUS)
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x2}
              y2={y2}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              opacity={0.4}
            />
          )
        })}

        {/* ── Data polygons ── */}
        {controllers.map(ctrl => {
          const style = CONTROLLER_STYLES[ctrl]
          if (!style) return null
          const values = normalized[ctrl]
          const isActive = hovered === null || hovered === ctrl
          const isDimmed = hovered !== null && hovered !== ctrl

          return (
            <polygon
              key={ctrl}
              points={polygonPoints(values)}
              fill={style.color}
              fillOpacity={isDimmed ? 0.03 : 0.15}
              stroke={style.color}
              strokeWidth={isActive ? 2 : 1}
              strokeOpacity={isDimmed ? 0.2 : 0.8}
              style={{ transition: 'all 0.3s ease' }}
              onMouseEnter={() => setHovered(ctrl)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* ── Data points ── */}
        {controllers.map(ctrl => {
          const style = CONTROLLER_STYLES[ctrl]
          if (!style) return null
          const values = normalized[ctrl]
          const isDimmed = hovered !== null && hovered !== ctrl

          return values.map((v, i) => {
            const angle = angleForAxis(i)
            const [x, y] = polarToXY(angle, v * RADIUS)
            return (
              <circle
                key={`${ctrl}-${i}`}
                cx={x}
                cy={y}
                r={3}
                fill={style.color}
                opacity={isDimmed ? 0.2 : 0.9}
                style={{ transition: 'opacity 0.3s ease' }}
              />
            )
          })
        })}

        {/* ── Axis labels ── */}
        {AXES.map((label, i) => {
          const angle = angleForAxis(i)
          const [x, y] = polarToXY(angle, RADIUS + 22)
          return (
            <text
              key={label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--color-text-secondary)]"
              style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
            >
              {label}
            </text>
          )
        })}
      </svg>

      {/* ── Legend ── */}
      <div className="flex gap-6 mt-2">
        {controllers.map(ctrl => {
          const style = CONTROLLER_STYLES[ctrl]
          if (!style) return null
          const isActive = hovered === null || hovered === ctrl
          return (
            <button
              key={ctrl}
              className="flex items-center gap-2 cursor-pointer transition-opacity"
              style={{ opacity: isActive ? 1 : 0.3 }}
              onMouseEnter={() => setHovered(ctrl)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: style.color }} />
              <span className="font-mono text-[10px] text-text-secondary">{style.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Hover tooltip ── */}
      {hovered && normalized[hovered] && (
        <div className="mt-3 font-mono text-[10px] text-text-muted text-center">
          <span className="text-text-secondary">{CONTROLLER_STYLES[hovered]?.label}:</span>{' '}
          {AXES.map((axis, i) => (
            <span key={axis}>
              {axis} <span className="text-accent">{(normalized[hovered][i] * 100).toFixed(0)}%</span>
              {i < AXIS_COUNT - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
