/**
 * TimelineStrip — Horizontal filmstrip showing creature poses at regular intervals.
 *
 * Like motion-capture reference strips. Useful for comparing gaits across controllers.
 * Shows snapshots every 0.5s of the walk cycle.
 */

import { useMemo } from 'react'

/** A single body's position in a frame */
interface BodyPos {
  x: number
  y: number
}

/** A frame with body positions (compatible with ReplayFrame) */
export interface StripFrame {
  bodies: BodyPos[]
  time?: number
}

interface TimelineStripProps {
  /** Walk frames from a creature simulation */
  frames: StripFrame[]
  /** Label for this strip */
  label?: string
  /** Color for the creature */
  color?: string
  /** Number of snapshots to show */
  snapshots?: number
  /** Height of each frame thumbnail */
  height?: number
}

export default function TimelineStrip({
  frames,
  label = 'Creature',
  color = '#F59E0B',
  snapshots = 8,
  height = 60,
}: TimelineStripProps) {
  const keyFrames = useMemo(() => {
    if (frames.length === 0) return []
    const step = Math.max(1, Math.floor(frames.length / snapshots))
    const selected: { frame: StripFrame; time: number; index: number }[] = []
    for (let i = 0; i < frames.length && selected.length < snapshots; i += step) {
      selected.push({
        frame: frames[i],
        time: frames[i].time ?? i / 60,
        index: i,
      })
    }
    return selected
  }, [frames, snapshots])

  if (keyFrames.length === 0) {
    return (
      <div className="text-center text-text-dim text-xs py-4">
        No walk frames available
      </div>
    )
  }

  const frameWidth = height * 1.2

  return (
    <div>
      {label && (
        <div className="text-[9px] font-medium uppercase tracking-wider text-text-muted mb-1">
          {label}
        </div>
      )}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {keyFrames.map(({ frame, time }, i) => (
          <div
            key={i}
            className="flex-shrink-0 border border-border bg-bg-surface"
            style={{ width: frameWidth, height }}
          >
            {/* Mini creature render */}
            <svg width={frameWidth} height={height - 14} viewBox="-1 -1.5 2 2">
              {/* Simple stick figure from body positions */}
              {frame.bodies && frame.bodies.length > 0 && (
                <g>
                  {/* Connect adjacent bodies with lines */}
                  {frame.bodies.slice(0, -1).map((body, j) => {
                    const next = frame.bodies[j + 1]
                    if (!next) return null
                    return (
                      <line
                        key={j}
                        x1={body.x - frame.bodies[0].x}
                        y1={-body.y + frame.bodies[0].y}
                        x2={next.x - frame.bodies[0].x}
                        y2={-next.y + frame.bodies[0].y}
                        stroke={color}
                        strokeWidth={0.06}
                        opacity={0.7}
                      />
                    )
                  })}
                  {/* Dots for joints */}
                  {frame.bodies.map((body, j) => (
                    <circle
                      key={j}
                      cx={body.x - frame.bodies[0].x}
                      cy={-body.y + frame.bodies[0].y}
                      r={0.04}
                      fill={color}
                    />
                  ))}
                </g>
              )}
              {/* Ground line */}
              <line x1={-1} y1={0.5} x2={1} y2={0.5} stroke="#333" strokeWidth={0.02} />
            </svg>
            {/* Time label */}
            <div className="text-center font-mono text-[7px] text-text-dim">
              {time.toFixed(1)}s
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
