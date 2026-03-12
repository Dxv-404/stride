/**
 * ChallengeBuilder — difficulty metrics and challenge presets for terrain.
 *
 * Computes: total ascent, max slope, variation, zone complexity.
 * Includes challenge presets: Easy Walk, Hill Climb, Obstacle Course, etc.
 */

import { useCallback, useMemo } from 'react'
import type { TerrainPoint } from '@/engine/types.ts'
import {
  createFlatPoints,
  getPresetTerrain,
  generateProceduralTerrain,
} from '@/components/terrain/TerrainEditorCanvas.tsx'
import type { FrictionZone } from './FrictionZoneEditor.tsx'

interface ChallengeBuilderProps {
  points: TerrainPoint[]
  frictionZones: FrictionZone[]
  onApplyPoints: (points: TerrainPoint[]) => void
  onApplyFriction: (zones: FrictionZone[]) => void
}

interface ChallengeMetrics {
  totalAscent: number
  maxSlope: number
  avgSlope: number
  heightVariation: number
  frictionComplexity: number
  overallDifficulty: number
}

function computeMetrics(points: TerrainPoint[], frictionZones: FrictionZone[]): ChallengeMetrics {
  let totalAscent = 0
  let maxSlope = 0
  let slopeSum = 0
  let minY = Infinity, maxY = -Infinity

  for (let i = 1; i < points.length; i++) {
    const dy = points[i].y - points[i - 1].y
    const dx = points[i].x - points[i - 1].x
    if (dy > 0) totalAscent += dy
    const slope = dx !== 0 ? Math.abs(dy / dx) : 0
    maxSlope = Math.max(maxSlope, slope)
    slopeSum += slope
    minY = Math.min(minY, points[i].y)
    maxY = Math.max(maxY, points[i].y)
  }

  const avgSlope = points.length > 1 ? slopeSum / (points.length - 1) : 0
  const heightVariation = maxY - minY
  const frictionComplexity = frictionZones.length * 15

  const overallDifficulty = Math.min(100, Math.round(
    totalAscent * 0.3 + maxSlope * 50 + avgSlope * 30 + heightVariation * 0.2 + frictionComplexity
  ))

  return { totalAscent, maxSlope, avgSlope, heightVariation, frictionComplexity, overallDifficulty }
}

const CHALLENGE_PRESETS: {
  name: string
  desc: string
  apply: () => { points: TerrainPoint[]; friction: FrictionZone[] }
}[] = [
  {
    name: 'Easy Walk',
    desc: 'Gentle flat terrain, no obstacles',
    apply: () => ({ points: createFlatPoints(), friction: [] }),
  },
  {
    name: 'Hill Climb',
    desc: 'Progressive uphill terrain',
    apply: () => ({ points: getPresetTerrain('gentle-slope'), friction: [] }),
  },
  {
    name: 'Obstacle Course',
    desc: 'Mixed terrain with cliffs and gaps',
    apply: () => ({ points: getPresetTerrain('canyon'), friction: [] }),
  },
  {
    name: 'Ice Rink',
    desc: 'Flat terrain with very low friction',
    apply: () => ({
      points: createFlatPoints(),
      friction: [{ x1: -100, x2: 2000, friction: 0.1 }],
    }),
  },
  {
    name: 'Friction Madness',
    desc: 'Alternating ice and rubber zones',
    apply: () => ({
      points: getPresetTerrain('rolling-hills'),
      friction: [
        { x1: 0, x2: 200, friction: 0.1 },
        { x1: 200, x2: 400, friction: 1.5 },
        { x1: 400, x2: 600, friction: 0.1 },
        { x1: 600, x2: 800, friction: 1.5 },
      ],
    }),
  },
  {
    name: 'Chaos',
    desc: 'Procedural terrain + random friction',
    apply: () => ({
      points: generateProceduralTerrain(8, 50, 4, Math.floor(Math.random() * 10000)),
      friction: [
        { x1: 100, x2: 300, friction: 0.1 },
        { x1: 500, x2: 700, friction: 1.5 },
      ],
    }),
  },
]

export default function ChallengeBuilder({
  points,
  frictionZones,
  onApplyPoints,
  onApplyFriction,
}: ChallengeBuilderProps) {
  const metrics = useMemo(() => computeMetrics(points, frictionZones), [points, frictionZones])

  const handleApplyPreset = useCallback((index: number) => {
    const { points: p, friction: f } = CHALLENGE_PRESETS[index].apply()
    onApplyPoints(p)
    onApplyFriction(f)
  }, [onApplyPoints, onApplyFriction])

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Challenge Builder
      </div>

      {/* Metrics dashboard */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard label="Total Ascent" value={`${metrics.totalAscent.toFixed(0)} px`} />
        <MetricCard label="Max Slope" value={`${(metrics.maxSlope * 100).toFixed(0)}%`} />
        <MetricCard label="Height Range" value={`${metrics.heightVariation.toFixed(0)} px`} />
        <MetricCard label="Friction Zones" value={`${frictionZones.length}`} />
      </div>

      {/* Overall difficulty */}
      <div className="mb-4 p-2 border border-border bg-bg-surface">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Overall Difficulty
          </span>
          <span className="font-mono text-[11px] text-text-primary">
            {metrics.overallDifficulty}/100
          </span>
        </div>
        <div className="w-full h-2 bg-bg border border-border overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${metrics.overallDifficulty}%`,
              background: metrics.overallDifficulty < 30
                ? '#10B981'
                : metrics.overallDifficulty < 60
                  ? '#F59E0B'
                  : '#EF4444',
            }}
          />
        </div>
      </div>

      {/* Challenge presets */}
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Challenge Presets
      </div>
      <div className="space-y-1.5">
        {CHALLENGE_PRESETS.map((preset, i) => (
          <button
            key={preset.name}
            onClick={() => handleApplyPreset(i)}
            className="w-full text-left px-2.5 py-2 bg-bg-surface border border-border
                       hover:border-border-hover transition-colors cursor-pointer"
          >
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-primary">
              {preset.name}
            </div>
            <div className="font-mono text-[8px] text-text-dim mt-0.5">
              {preset.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 border border-border bg-bg-surface text-center">
      <div className="font-mono text-[9px] text-text-dim uppercase">{label}</div>
      <div className="font-mono text-[11px] text-text-primary">{value}</div>
    </div>
  )
}
