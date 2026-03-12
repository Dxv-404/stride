/**
 * PresetLibrary — grid of gene presets with save/load and blend slider.
 *
 * Built-in presets + user-saved presets (localStorage).
 * Blend slider linearly interpolates between two selected presets.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'

interface PresetLibraryProps {
  genes: number[]
  geneCount: number
  onApply: (genes: number[]) => void
}

interface Preset {
  name: string
  genes: number[]
  builtin?: boolean
}

const STORAGE_KEY = 'stride-presets'

/** Generate built-in presets */
function getBuiltinPresets(count: number): Preset[] {
  return [
    {
      name: 'Random',
      genes: Array.from({ length: count }, () => Math.random()),
      builtin: true,
    },
    {
      name: 'Symmetric',
      genes: (() => {
        const half = Array.from({ length: Math.ceil(count / 6) * 3 }, () => Math.random())
        const g: number[] = []
        for (let i = 0; i < Math.ceil(count / 6); i++) {
          g.push(half[i * 3], half[i * 3 + 1], half[i * 3 + 2])
          g.push(half[i * 3], half[i * 3 + 1], (half[i * 3 + 2] + 0.5) % 1)
        }
        return g.slice(0, count)
      })(),
      builtin: true,
    },
    {
      name: 'Hopping',
      genes: Array.from({ length: count }, (_, i) => {
        const param = i % 3
        if (param === 0) return 0.8 // high amplitude
        if (param === 1) return 0.7 // high frequency
        return (Math.floor(i / 3) * 0.1) % 1 // staggered phases
      }),
      builtin: true,
    },
    {
      name: 'Crawling',
      genes: Array.from({ length: count }, (_, i) => {
        const param = i % 3
        if (param === 0) return 0.3 // low amplitude
        if (param === 1) return 0.2 // low frequency
        return (Math.floor(i / 3) * 0.25) % 1
      }),
      builtin: true,
    },
    {
      name: 'All Max',
      genes: Array.from({ length: count }, () => 1.0),
      builtin: true,
    },
    {
      name: 'All Min',
      genes: Array.from({ length: count }, () => 0.0),
      builtin: true,
    },
  ]
}

function loadUserPresets(): Preset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveUserPresets(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export default function PresetLibrary({ genes, geneCount, onApply }: PresetLibraryProps) {
  const [userPresets, setUserPresets] = useState<Preset[]>(loadUserPresets)
  const [selectedA, setSelectedA] = useState<number | null>(null)
  const [selectedB, setSelectedB] = useState<number | null>(null)
  const [blendValue, setBlendValue] = useState(0)
  const [saveName, setSaveName] = useState('')

  const builtins = useMemo(() => getBuiltinPresets(geneCount), [geneCount])
  const allPresets = useMemo(() => [...builtins, ...userPresets], [builtins, userPresets])

  // Save presets to localStorage when changed
  useEffect(() => {
    saveUserPresets(userPresets)
  }, [userPresets])

  // Apply blend
  useEffect(() => {
    if (selectedA !== null && selectedB !== null && selectedA !== selectedB) {
      const a = allPresets[selectedA]?.genes
      const b = allPresets[selectedB]?.genes
      if (a && b) {
        const blended = a.map((v, i) => v * (1 - blendValue) + (b[i] ?? v) * blendValue)
        onApply(blended)
      }
    }
  }, [blendValue, selectedA, selectedB, allPresets, onApply])

  const handleSave = useCallback(() => {
    const name = saveName.trim() || `Custom ${userPresets.length + 1}`
    setUserPresets(prev => [...prev, { name, genes: [...genes] }])
    setSaveName('')
  }, [saveName, genes, userPresets.length])

  const handleDelete = useCallback((index: number) => {
    const userIndex = index - builtins.length
    if (userIndex >= 0) {
      setUserPresets(prev => prev.filter((_, i) => i !== userIndex))
    }
  }, [builtins.length])

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Preset Library
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {allPresets.map((preset, i) => (
          <button
            key={`${preset.name}-${i}`}
            onClick={() => {
              if (selectedA === null) {
                setSelectedA(i)
                onApply(preset.genes)
              } else if (selectedB === null && i !== selectedA) {
                setSelectedB(i)
              } else {
                setSelectedA(i)
                setSelectedB(null)
                setBlendValue(0)
                onApply(preset.genes)
              }
            }}
            className={`text-left px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider
              transition-colors cursor-pointer border
              ${selectedA === i
                ? 'border-accent bg-accent/10 text-accent'
                : selectedB === i
                  ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                  : 'border-border text-text-muted hover:text-text hover:border-border-hover'}`}
          >
            <div className="truncate">{preset.name}</div>
            {!preset.builtin && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(i) }}
                className="text-[8px] text-red-400/60 hover:text-red-400 float-right mt-[-14px] cursor-pointer"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Blend slider */}
      {selectedA !== null && selectedB !== null && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-mono text-[9px] text-accent">{allPresets[selectedA]?.name}</span>
            <span className="font-mono text-[9px] text-blue-400">{allPresets[selectedB]?.name}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={blendValue}
            onChange={(e) => setBlendValue(Number(e.target.value))}
            className="w-full h-1.5 appearance-none rounded bg-border accent-accent cursor-pointer"
          />
          <div className="text-center font-mono text-[9px] text-text-dim mt-0.5">
            Blend: {(blendValue * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Save custom preset */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Preset name..."
          className="flex-1 bg-bg-surface border border-border px-2 py-1 font-mono text-[10px] text-text-secondary
                     focus:outline-none focus:border-accent placeholder:text-text-dim"
        />
        <button
          onClick={handleSave}
          className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider
                     border border-accent text-accent hover:bg-accent/10 transition-colors cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  )
}
