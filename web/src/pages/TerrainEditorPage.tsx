/**
 * Terrain Editor — Interactive terrain sculpting page.
 *
 * Layout:
 *   ┌───────────────────────────┬──────────┐
 *   │                           │  Config  │
 *   │   TerrainEditorCanvas     │  Panel   │
 *   │   (fills available area)  │  (tools) │
 *   │                           │          │
 *   ├───────────────────────────┴──────────┤
 *   │  BottomDock: undo | reset | difficulty │
 *   └──────────────────────────────────────┘
 *
 * Brush tools, presets, and procedural generation
 * live in the ConfigPanel. Undo/Reset + difficulty in dock.
 */

import { useState, useCallback } from 'react'
import TerrainEditorCanvas, {
  createFlatPoints,
  getPresetTerrain,
  generateProceduralTerrain,
  computeDifficulty,
  type BrushTool,
} from '@/components/terrain/TerrainEditorCanvas.tsx'
import BottomDock from '@/components/shared/BottomDock.tsx'
import ConfigPanel from '@/components/shared/ConfigPanel.tsx'
import { useUIStore } from '@/stores/uiStore.ts'
import type { TerrainPoint } from '@/engine/types.ts'
import FrictionZoneEditor, { type FrictionZone } from '@/components/terrain/FrictionZoneEditor.tsx'
import ChallengeBuilder from '@/components/terrain/ChallengeBuilder.tsx'

/* ─── Brush tool definitions ─── */

const BRUSH_TOOLS: { id: BrushTool; label: string; icon: string; desc: string }[] = [
  { id: 'sculpt', label: 'SCULPT', icon: '▲', desc: 'Raise / lower terrain' },
  { id: 'smooth', label: 'SMOOTH', icon: '〰', desc: 'Blend heights together' },
  { id: 'flatten', label: 'FLATTEN', icon: '▬', desc: 'Level to center height' },
  { id: 'cliff', label: 'CLIFF', icon: '▌', desc: 'Create vertical walls' },
  { id: 'gap', label: 'GAP', icon: '▼', desc: 'Dig down to zero' },
]

const PRESETS = [
  { id: 'flat', label: 'Flat' },
  { id: 'rolling-hills', label: 'Rolling Hills' },
  { id: 'gentle-slope', label: 'Gentle Slope' },
  { id: 'staircase', label: 'Staircase' },
  { id: 'canyon', label: 'Canyon' },
  { id: 'spike-field', label: 'Spike Field' },
]

type TerrainTab = 'draw' | 'zones' | 'challenge'

export default function TerrainEditorPage() {
  const [points, setPoints] = useState<TerrainPoint[]>(() => createFlatPoints())
  const [tool, setTool] = useState<BrushTool>('sculpt')
  const [brushSize, setBrushSize] = useState(10)
  const [brushUp, setBrushUp] = useState(true)
  const [history, setHistory] = useState<TerrainPoint[][]>([])
  const [terrainTab, setTerrainTab] = useState<TerrainTab>('draw')
  const [frictionZones, setFrictionZones] = useState<FrictionZone[]>([])

  // Procedural generation params
  const [procFreq, setProcFreq] = useState(4)
  const [procAmp, setProcAmp] = useState(35)
  const [procOctaves, setProcOctaves] = useState(3)

  // Config panel state
  const configOpen = useUIStore(s => s.configPanelOpen)
  const toggleConfig = useUIStore(s => s.toggleConfigPanel)

  const difficulty = computeDifficulty(points)

  /* ─── Handlers ─── */

  const handlePointsChange = useCallback((newPoints: TerrainPoint[]) => {
    setHistory(prev => [...prev.slice(-20), points]) // keep last 20 for undo
    setPoints(newPoints)
  }, [points])

  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    setPoints(history[history.length - 1])
    setHistory(prev => prev.slice(0, -1))
  }, [history])

  const handlePreset = useCallback((preset: string) => {
    setHistory(prev => [...prev.slice(-20), points])
    setPoints(getPresetTerrain(preset))
  }, [points])

  const handleGenerate = useCallback(() => {
    setHistory(prev => [...prev.slice(-20), points])
    const seed = Math.floor(Math.random() * 10000)
    setPoints(generateProceduralTerrain(procFreq, procAmp, procOctaves, seed))
  }, [points, procFreq, procAmp, procOctaves])

  const handleReset = useCallback(() => {
    setHistory(prev => [...prev.slice(-20), points])
    setPoints(createFlatPoints())
    setFrictionZones([])
  }, [points])

  const handleExport = useCallback(() => {
    const data = JSON.stringify({ points, frictionZones }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stride-terrain-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [points, frictionZones])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.points) {
          setHistory(prev => [...prev.slice(-20), points])
          setPoints(data.points)
        }
        if (data.frictionZones) {
          setFrictionZones(data.frictionZones)
        }
      } catch {
        console.error('Invalid terrain file')
      }
    }
    input.click()
  }, [points])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Main content: canvas + config panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-bg-surface">
          <TerrainEditorCanvas
            points={points}
            onPointsChange={handlePointsChange}
            tool={tool}
            brushSize={brushSize}
            brushUp={brushUp}
          />
        </div>

        {/* Config panel with tabbed tools */}
        <ConfigPanel open={configOpen} onClose={toggleConfig} title="Terrain Tools">
          {/* Tab selector */}
          <div className="flex border border-border mb-4">
            {(['draw', 'zones', 'challenge'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTerrainTab(tab)}
                className={`flex-1 text-[9px] font-medium uppercase tracking-wider py-1.5 transition-colors cursor-pointer
                  ${terrainTab === tab
                    ? 'bg-accent text-bg'
                    : 'bg-transparent text-text-muted hover:text-text'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {terrainTab === 'draw' && (
            <>
          {/* Brush tools */}
          <section className="mb-5">
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">
              Brush Tool
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {BRUSH_TOOLS.map(b => (
                <button
                  key={b.id}
                  onClick={() => setTool(b.id)}
                  className={`
                    flex items-center gap-1.5 px-2.5 py-2 text-left transition-colors
                    border font-mono text-[11px]
                    ${tool === b.id
                      ? 'bg-accent-subtle text-text-primary border-accent'
                      : 'bg-bg-surface text-text-secondary border-border hover:border-border-hover'
                    }
                  `}
                  title={b.desc}
                >
                  <span className="text-sm">{b.icon}</span>
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Brush settings */}
          <section className="mb-5">
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">
              Brush Settings
            </h2>
            <div className="space-y-2">
              <div>
                <label className="font-mono text-[11px] text-text-dim flex justify-between">
                  <span>SIZE</span>
                  <span className="text-text-secondary">{brushSize}</span>
                </label>
                <input
                  type="range" min={2} max={30} step={1}
                  value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setBrushUp(true)}
                  className={`flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 border transition-colors
                    ${brushUp
                      ? 'bg-green-900/50 text-green-400 border-green-600'
                      : 'bg-bg-surface text-text-dim border-border'
                    }`}
                >
                  ▲ RAISE
                </button>
                <button
                  onClick={() => setBrushUp(false)}
                  className={`flex-1 text-[10px] font-medium uppercase tracking-wider py-1.5 border transition-colors
                    ${!brushUp
                      ? 'bg-red-900/50 text-red-400 border-red-600'
                      : 'bg-bg-surface text-text-dim border-border'
                    }`}
                >
                  ▼ LOWER
                </button>
              </div>
            </div>
          </section>

          {/* Presets */}
          <section className="mb-5">
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">
              Presets
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePreset(p.id)}
                  className="px-2 py-1.5 font-mono text-[11px] text-text-secondary
                             bg-bg-surface border border-border hover:border-border-hover
                             hover:text-text-primary transition-colors text-left"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          {/* Procedural generator */}
          <section>
            <h2 className="text-[10px] font-medium uppercase tracking-wider text-text-secondary mb-2">
              Procedural
            </h2>
            <div className="space-y-2">
              <div>
                <label className="font-mono text-[11px] text-text-dim flex justify-between">
                  <span>FREQUENCY</span>
                  <span className="text-text-secondary">{procFreq}</span>
                </label>
                <input
                  type="range" min={1} max={12} step={1}
                  value={procFreq}
                  onChange={e => setProcFreq(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-text-dim flex justify-between">
                  <span>AMPLITUDE</span>
                  <span className="text-text-secondary">{procAmp}</span>
                </label>
                <input
                  type="range" min={5} max={80} step={5}
                  value={procAmp}
                  onChange={e => setProcAmp(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-text-dim flex justify-between">
                  <span>OCTAVES</span>
                  <span className="text-text-secondary">{procOctaves}</span>
                </label>
                <input
                  type="range" min={1} max={5} step={1}
                  value={procOctaves}
                  onChange={e => setProcOctaves(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
              <button
                onClick={handleGenerate}
                className="w-full text-[10px] font-medium uppercase tracking-wider py-2 bg-accent-subtle text-text-primary
                           border border-accent hover:bg-accent/30 transition-colors"
              >
                GENERATE
              </button>
            </div>
          </section>
            </>
          )}

          {terrainTab === 'zones' && (
            <FrictionZoneEditor zones={frictionZones} onChange={setFrictionZones} />
          )}

          {terrainTab === 'challenge' && (
            <ChallengeBuilder
              points={points}
              frictionZones={frictionZones}
              onApplyPoints={(p) => {
                setHistory(prev => [...prev.slice(-20), points])
                setPoints(p)
              }}
              onApplyFriction={setFrictionZones}
            />
          )}
        </ConfigPanel>
      </div>

      {/* Bottom dock */}
      <BottomDock>
        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="btn-flat px-3 py-1 text-xs disabled:opacity-30"
        >
          Undo
        </button>

        {/* Reset */}
        <button onClick={handleReset} className="btn-flat px-3 py-1 text-xs">
          Reset
        </button>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Difficulty meter */}
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Difficulty</span>
        <div className="w-24 h-1.5 bg-bg border border-border overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${difficulty}%`,
              background: difficulty < 30
                ? '#10B981'
                : difficulty < 60
                  ? '#F59E0B'
                  : '#EF4444',
            }}
          />
        </div>
        <span className="font-mono text-[10px] text-text-dim tabular-nums">{difficulty}/100</span>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Export / Import */}
        <button onClick={handleExport} className="btn-flat px-3 py-1 text-xs">
          Export
        </button>
        <button onClick={handleImport} className="btn-flat px-3 py-1 text-xs">
          Import
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Config toggle */}
        <button
          onClick={toggleConfig}
          className={`
            w-8 h-8 flex items-center justify-center transition-colors cursor-pointer
            ${configOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'}
          `}
          title="Toggle tools panel"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </BottomDock>
    </div>
  )
}
