import { useSimulationStore, type SimParams } from '@/stores/simulationStore.ts'

// ---------------------------------------------------------------------------
// Shared slider config
// ---------------------------------------------------------------------------

interface SliderDef {
  key: keyof Pick<
    SimParams,
    'populationSize' | 'mutationRate' | 'crossoverRate' | 'elitismRate' | 'maxGenerations'
  >
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

const POPULATION_SLIDERS: SliderDef[] = [
  {
    key: 'populationSize',
    label: 'POP SIZE',
    min: 20,
    max: 200,
    step: 10,
    format: (v) => String(v),
  },
  {
    key: 'maxGenerations',
    label: 'MAX GENS',
    min: 25,
    max: 200,
    step: 5,
    format: (v) => String(v),
  },
]

const OPERATOR_SLIDERS: SliderDef[] = [
  {
    key: 'mutationRate',
    label: 'MUTATION',
    min: 0.01,
    max: 0.3,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'crossoverRate',
    label: 'CROSSOVER',
    min: 0.4,
    max: 1.0,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'elitismRate',
    label: 'ELITISM',
    min: 0,
    max: 0.2,
    step: 0.01,
    format: (v) => v.toFixed(2),
  },
]

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-medium uppercase tracking-wider text-accent mb-3 mt-5 first:mt-0">
      {children}
    </h3>
  )
}

function ParamSlider({
  def,
  value,
  disabled,
  onChange,
}: {
  def: SliderDef
  value: number
  disabled: boolean
  onChange: (key: string, v: number) => void
}) {
  return (
    <label className="block mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {def.label}
        </span>
        <span className="font-mono text-xs text-text-primary">
          {def.format(value)}
        </span>
      </div>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded bg-border accent-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </label>
  )
}

function ParamSelect<V extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: V
  options: readonly V[]
  disabled: boolean
  onChange: (v: V) => void
}) {
  return (
    <label className="block mb-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary block mb-1">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as V)}
        className="w-full bg-bg-surface border border-border text-text-primary font-mono text-xs px-2 py-1.5 rounded appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-accent"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ParameterPanel() {
  const status = useSimulationStore((s) => s.status)
  const params = useSimulationStore((s) => s.params)
  const setParam = useSimulationStore((s) => s.setParam)

  // Allow editing when idle or completed — lock only during active simulation
  const disabled = status === 'running' || status === 'paused'

  function handleSlider(key: string, value: number) {
    setParam(key as keyof SimParams, value)
  }

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-1">
        GA PARAMETERS
      </div>

      {disabled && (
        <p className="font-mono text-[0.65rem] text-text-dim mb-3">
          Locked while simulation is {status}.
        </p>
      )}

      {/* -- Population --------------------------------------------------- */}
      <SectionHeading>POPULATION</SectionHeading>
      {POPULATION_SLIDERS.map((def) => (
        <ParamSlider
          key={def.key}
          def={def}
          value={params[def.key] as number}
          disabled={disabled}
          onChange={handleSlider}
        />
      ))}

      {/* -- Operators ---------------------------------------------------- */}
      <SectionHeading>OPERATORS</SectionHeading>
      {OPERATOR_SLIDERS.map((def) => (
        <ParamSlider
          key={def.key}
          def={def}
          value={params[def.key] as number}
          disabled={disabled}
          onChange={handleSlider}
        />
      ))}

      <ParamSelect
        label="SELECTION"
        value={params.selectionMethod}
        options={['tournament', 'roulette', 'rank'] as const}
        disabled={disabled}
        onChange={(v) => setParam('selectionMethod', v)}
      />

      {/* -- Environment -------------------------------------------------- */}
      <SectionHeading>ENVIRONMENT</SectionHeading>

      <ParamSelect
        label="TERRAIN"
        value={params.terrainType}
        options={['flat', 'hill', 'mixed', 'custom'] as const}
        disabled={disabled}
        onChange={(v) => setParam('terrainType', v)}
      />

      <ParamSelect
        label="ENCODING"
        value={params.encoding}
        options={['direct', 'indirect'] as const}
        disabled={disabled}
        onChange={(v) => setParam('encoding', v)}
      />
    </div>
  )
}
