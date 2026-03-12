/**
 * FrictionZoneEditor — paint friction zones onto terrain.
 *
 * Three presets: Ice (0.1), Normal (0.7), Rubber (1.5).
 * Zones are horizontal bands with colored overlays.
 */

import { useState, useCallback } from 'react'

export interface FrictionZone {
  x1: number
  x2: number
  friction: number
}

interface FrictionZoneEditorProps {
  zones: FrictionZone[]
  onChange: (zones: FrictionZone[]) => void
}

const FRICTION_PRESETS = [
  { label: 'ICE', value: 0.1, color: '#3B82F6' },
  { label: 'NORMAL', value: 0.7, color: '#6B7280' },
  { label: 'RUBBER', value: 1.5, color: '#EF4444' },
]

export function getFrictionColor(friction: number): string {
  if (friction <= 0.3) return '#3B82F620'
  if (friction >= 1.0) return '#EF444420'
  return '#6B728020'
}

export function getFrictionLabel(friction: number): string {
  if (friction <= 0.3) return 'Ice'
  if (friction >= 1.0) return 'Rubber'
  return 'Normal'
}

export default function FrictionZoneEditor({ zones, onChange }: FrictionZoneEditorProps) {
  const [selectedFriction, setSelectedFriction] = useState(0.1)
  const [newX1, setNewX1] = useState(0)
  const [newX2, setNewX2] = useState(200)

  const handleAdd = useCallback(() => {
    onChange([...zones, { x1: newX1, x2: newX2, friction: selectedFriction }])
  }, [zones, onChange, newX1, newX2, selectedFriction])

  const handleRemove = useCallback((index: number) => {
    onChange(zones.filter((_, i) => i !== index))
  }, [zones, onChange])

  const handleClear = useCallback(() => {
    onChange([])
  }, [onChange])

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Friction Zones
      </div>

      {/* Friction type selector */}
      <div className="flex gap-1.5 mb-3">
        {FRICTION_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => setSelectedFriction(p.value)}
            className={`flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 border transition-colors cursor-pointer
              ${selectedFriction === p.value
                ? 'text-bg'
                : 'bg-transparent text-text-muted hover:text-text border-border'}`}
            style={selectedFriction === p.value ? { backgroundColor: p.color, borderColor: p.color } : {}}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Position inputs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="font-mono text-[9px] text-text-dim">START X</label>
          <input
            type="number"
            value={newX1}
            onChange={e => setNewX1(Number(e.target.value))}
            className="w-full bg-bg-surface border border-border px-2 py-1 font-mono text-[11px] text-text-secondary
                       focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="font-mono text-[9px] text-text-dim">END X</label>
          <input
            type="number"
            value={newX2}
            onChange={e => setNewX2(Number(e.target.value))}
            className="w-full bg-bg-surface border border-border px-2 py-1 font-mono text-[11px] text-text-secondary
                       focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        <button onClick={handleAdd} className="flex-1 btn-flat text-[10px] px-2.5 py-1">
          Add Zone
        </button>
        <button onClick={handleClear} className="btn-flat text-[10px] px-2.5 py-1 text-red-400">
          Clear All
        </button>
      </div>

      {/* Zone list */}
      {zones.length > 0 && (
        <div className="space-y-1">
          {zones.map((zone, i) => {
            const preset = FRICTION_PRESETS.find(p => p.value === zone.friction)
            return (
              <div key={i} className="flex items-center gap-2 px-2 py-1 bg-bg-surface border border-border">
                <div
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: preset?.color ?? '#6B7280' }}
                />
                <span className="font-mono text-[9px] text-text-secondary flex-1">
                  {zone.x1}–{zone.x2} ({getFrictionLabel(zone.friction)})
                </span>
                <button
                  onClick={() => handleRemove(i)}
                  className="text-[9px] text-red-400/60 hover:text-red-400 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
