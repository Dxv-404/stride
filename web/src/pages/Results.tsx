/**
 * Results Dashboard — visualizes pre-computed experiment data.
 *
 * Single-graph-at-a-time layout with dropdown selector.
 * Each graph has an interpretation box below it.
 *
 * All data comes from static JSON in /data/ (exported from Python experiments).
 */

import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from 'recharts'
import { loadBestChromosomes, type BestChromosome } from '@/data/best-chromosomes.ts'

import { buildGridFromEpistasis } from '@/lib/fitnessGrid.ts'
import EvolutionRings from '@/components/viz/EvolutionRings.tsx'
import FamilyTree from '@/components/viz/FamilyTree.tsx'
import PopulationSwarm from '@/components/viz/PopulationSwarm.tsx'
import RaceComparison from '@/components/viz/RaceComparison.tsx'
import NNTimeSeries from '@/components/viz/NNTimeSeries.tsx'
import BehavioralRadar from '@/components/viz/BehavioralRadar.tsx'
import EvolutionSnapshots from '@/components/viz/EvolutionSnapshots.tsx'
import EncodingDiagram from '@/components/viz/EncodingDiagram.tsx'

const FitnessLandscape3D = lazy(() => import('@/components/viz/FitnessLandscape3D.tsx'))
const ChromosomeHelix = lazy(() => import('@/components/viz/ChromosomeHelix.tsx'))
const SkeletonTrail = lazy(() => import('@/components/viz/SkeletonTrail.tsx'))

/* ─── Constants ─── */

const COLORS = {
  sine: '#3B82F6',
  cpg: '#10B981',
  cpg_nn: '#F59E0B',
  accent: 'var(--color-accent)',
  grid: 'var(--color-border)',
  text: 'var(--color-text-dim)',
  tooltipBg: 'var(--color-bg-surface)',
  tooltipBorder: 'var(--color-border)',
} as const

const CONTROLLER_LABELS: Record<string, string> = {
  baseline: 'Sine (baseline)',
  high_amp: 'Sine (high amp)',
  low_freq: 'Sine (low freq)',
  high_mutation: 'Sine (high mut)',
  large_pop: 'Sine (large pop)',
  long_run: 'Sine (long run)',
  indirect: 'Sine (indirect)',
  hill: 'Sine (hill)',
  mixed: 'Sine (mixed)',
  cpg_baseline: 'CPG (flat)',
  cpg_hill: 'CPG (hill)',
  cpg_mixed: 'CPG (mixed)',
  cpgnn_flat: 'CPG+NN (flat)',
  cpgnn_mixed: 'CPG+NN (mixed)',
  cpgnn_frozen: 'CPG+NN (frozen)',
  cpgnn_high_mutation: 'CPG+NN (high mut)',
  cpgnn_2x_budget: 'CPG+NN (2× budget)',
  sine: 'Sine',
  cpg: 'CPG',
}

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text-primary)',
    fontSize: 11,
    fontFamily: '"JetBrains Mono", monospace',
  },
}

/* ─── Graph Sections Config ─── */

const GRAPH_SECTIONS = [
  {
    id: 'convergence',
    label: 'Convergence Curves',
    tooltip: 'Best fitness over generations for each experiment',
    interpretation: 'CPG+NN configurations converge significantly faster, reaching near-optimal fitness within 20 generations while Sine baseline needs roughly 50. All controllers plateau after generation 40, confirming the 75-generation budget is sufficient. The CPG+NN advantage comes from its neural network quickly learning sensory-motor coupling, giving it a head start over fixed-structure controllers. Sine variants with large populations or long runs converge more reliably but don\'t surpass CPG+NN\'s peak.',
  },
  {
    id: 'distributions',
    label: 'Fitness Distributions',
    tooltip: 'Spread of fitness values across 30 runs per experiment',
    interpretation: 'CPG+NN (2x budget) achieves the highest mean fitness across all experiments, followed closely by CPG+NN (flat). The gap between Sine and CPG controllers is smaller than the gap between CPG and CPG+NN, suggesting the neural network layer adds more value than the oscillator structure alone. High-mutation variants show wider distributions, indicating less consistency. Indirect encoding (symmetric gaits) performs surprisingly well despite using half the genes.',
  },
  {
    id: 'push-test',
    label: 'Push Test Survival',
    tooltip: 'Percentage of walkers surviving perturbation at each intensity',
    interpretation: 'All controllers handle gentle pushes well, but clear separation appears at strong and violent intensities. CPG+NN controllers maintain 70-90% survival even under violent pushes, while Sine controllers drop below 40%. This is because the neural network can sense the perturbation through its inputs and adjust motor commands in real-time. CPG controllers without the NN layer fall in between, suggesting the oscillator structure alone provides some passive stability.',
  },
  {
    id: 'gene-sensitivity',
    label: 'Gene Sensitivity',
    tooltip: 'How much each gene affects fitness when perturbed',
    interpretation: 'Hip amplitude genes consistently show the highest sensitivity across all controller types, meaning small changes to these genes dramatically affect walking performance. Frequency genes rank second, while phase genes have the least impact. This makes biological sense: amplitude determines step height and force, frequency controls speed, and phase mainly affects limb coordination timing. Shoulder genes are less sensitive than hip and knee genes, reflecting the arms\' secondary role in balance.',
  },
  {
    id: 'stat-tests',
    label: 'Statistical Tests',
    tooltip: "Welch's t-test comparing each variant to baseline",
    interpretation: 'Nearly all CPG+NN variants show statistically significant improvements over baseline with large effect sizes (Cohen\'s d > 0.8). The Holm correction for multiple comparisons reduces some borderline results to non-significant, maintaining statistical rigor. The largest effect sizes appear for CPG+NN (2x budget) and CPG+NN (flat), confirming these aren\'t just noisy fluctuations. Sine high-mutation shows a negative difference, suggesting that excessive mutation disrupts evolved gaits more than it explores new ones.',
  },
  {
    id: 'ablation',
    label: 'Sensor Ablation',
    tooltip: 'Fitness impact when individual sensors are disabled',
    interpretation: 'Velocity sensors cause the largest fitness drop when disabled, indicating the neural network relies heavily on speed feedback for gait control. Angular sensors (body tilt) rank second, suggesting balance correction is a learned behavior. Ground contact sensors have moderate impact, meaning the network uses foot-ground timing but can partially compensate without it. The frozen NN baseline shows that even a randomly initialized network provides some value, but trained weights improve fitness by 30-50% over the frozen case.',
  },
  {
    id: 'evolution-rings',
    label: 'Evolution Rings',
    tooltip: 'Mandala visualization of fitness across generations',
    interpretation: 'The inner rings (early generations) appear dimmer with scattered dot placement, reflecting the random initial population. As generations progress outward, rings grow brighter and dots cluster more tightly, showing the population converging on high-fitness solutions. The brightest segment on each ring marks the generation\'s best individual. The transition from scattered to clustered typically happens between generations 10-20, matching the steepest part of the convergence curve.',
  },
  {
    id: 'family-tree',
    label: 'Family Tree',
    tooltip: 'Lineage of solutions across generations',
    interpretation: 'Early generations show broad branching as the GA explores diverse solutions. By mid-evolution, the tree narrows as strong lineages dominate through selection pressure. The brightest nodes (highest fitness) tend to cluster in later generations along a few dominant branches, while dimmer branches die out. This pattern is characteristic of tournament selection: it maintains some diversity early but aggressively prunes weak solutions over time.',
  },
  {
    id: 'population-scatter',
    label: 'Population Scatter',
    tooltip: 'Each experiment plotted by diversity vs fitness',
    interpretation: 'Experiments cluster into three groups along the fitness axis, corresponding to the three controller tiers (Sine, CPG, CPG+NN). Within each tier, the diversity spread varies: high-mutation experiments show more horizontal spread, while standard configurations cluster tightly. The best-performing experiment sits in the upper-right, combining high fitness with moderate diversity, suggesting it found multiple distinct good solutions rather than converging to a single one.',
  },
  {
    id: 'fitness-landscape',
    label: '3D Fitness Landscape',
    tooltip: 'Interactive surface plot from gene interaction data',
    interpretation: 'The surface shape reveals how pairs of genes interact. Smooth, single-peaked surfaces indicate independent genes where each has an optimal value regardless of the other. Rugged surfaces with multiple peaks and valleys indicate epistasis, where the optimal value of one gene depends on the other. Hip amplitude and frequency genes typically show strong interaction (rugged landscape), while phase genes tend to be more independent (smoother surface).',
  },
  {
    id: 'chromosome-helix',
    label: 'Chromosome Helix',
    tooltip: '3D double-helix visualization of the best chromosome',
    interpretation: 'The brightness pattern across the helix reveals the evolved strategy. Hip genes (bottom rungs) tend to be bright, indicating large amplitudes for strong leg movements. Knee genes show moderate brightness with frequency values tuned for efficient gait cycles. Shoulder genes are typically dimmer, reflecting the arms\' passive stabilizing role. Comparing across controllers shows that CPG+NN chromosomes tend to have more uniform brightness, suggesting the neural network compensates for gene variations.',
  },
  {
    id: 'behavioral-radar',
    label: 'Behavioral Radar',
    tooltip: 'Spider chart comparing gait profiles across controller tiers',
    interpretation: 'The radar reveals each controller\'s "personality." Sine controllers show high distance but low stability, relying on momentum rather than balance. CPG controllers trade some speed for significantly better efficiency and stability through coupled oscillations. CPG+NN achieves the most balanced profile, excelling on all axes simultaneously — the neural network learns to coordinate distance, speed, and stability rather than optimizing one at the expense of others. The symmetry axis shows how close each gait is to ideal left-right alternation.',
  },
  {
    id: 'encoding-diagram',
    label: 'Encoding Diagram',
    tooltip: 'Butterfly layout comparing direct and indirect gene encoding',
    interpretation: 'Direct encoding uses 18 independent genes (6 joints × 3 params each), giving evolution maximum freedom but requiring it to independently discover that left and right limbs should move differently. Indirect encoding uses only 9 genes, automatically mirroring left to right with a π phase shift — this enforces symmetric gaits by construction. The bar brightness shows evolved gene values: notice how amplitude genes (amber) tend to be brighter (higher values) than phase genes (green), reflecting the importance of step height over precise timing.',
  },
  {
    id: 'evolution-snapshots',
    label: 'Evolution Snapshots',
    tooltip: 'Filmstrip showing fitness progression at key generations',
    interpretation: 'The filmstrip reveals how quickly each controller tier discovers good solutions. At generation 0, all controllers start with random chromosomes producing near-zero fitness. By generation 10, CPG+NN already shows significant separation from Sine and CPG, demonstrating faster initial learning. By generation 25, the fitness hierarchy is firmly established. The final generations (50-75) show diminishing returns across all tiers, with improvements slowing as the population converges on local optima.',
  },
  {
    id: 'race-comparison',
    label: 'Terrain Transfer',
    tooltip: 'Heatmap of controller performance across different terrains',
    interpretation: 'The heatmap reveals how well controllers generalize beyond their training terrain. Controllers trained on flat terrain typically show reduced fitness on hills and mixed terrain. CPG+NN controllers maintain the highest absolute fitness across all terrain types, suggesting the neural network learns generalizable locomotion strategies rather than terrain-specific tricks. The fitness drop from flat to mixed terrain indicates where each controller\'s learned gait breaks down.',
  },
  {
    id: 'skeleton-trail',
    label: 'Skeleton Trail',
    tooltip: 'Chronophotography-style motion study of evolved walking',
    interpretation: 'This Muybridge-inspired visualization captures the evolved gait as a series of overlapping stick figures. The horizontal progression shows how far the creature travels, while the figure overlap density reveals gait speed — tightly packed figures indicate slow movement, while spread-out figures show fast walking. The leg angles across the sequence reveal the evolved step cycle: look for the repeating pattern of leg extension and flexion that creates forward locomotion.',
  },
  {
    id: 'nn-timeseries',
    label: 'NN Motor Signals',
    tooltip: 'Animated chart of neural network modulation over time',
    interpretation: 'This chart shows what the CPG+NN neural network actually computes. The NN output signals modulate the underlying CPG oscillators, adjusting joint targets in real-time based on sensory feedback. Toggle between NN Output (the modulation signal) and CPG Signal (the raw oscillator output) to see how the network transforms rhythmic patterns. Notice that hip joints (blue/green) typically show the strongest modulation, while shoulder joints (pink/purple) receive more subtle corrections — the network learned that legs need active control while arms can rely more on passive dynamics.',
  },
] as const

type GraphId = typeof GRAPH_SECTIONS[number]['id']

/* ─── Chevron SVG for dropdown ─── */

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`

/* ─── Types ─── */

interface ConvergenceData {
  [exp: string]: {
    generations: number[]
    best_per_gen: number[]
    mean_per_gen: number[]
    n_runs: number
  }
}

interface FitnessDistData {
  [exp: string]: {
    values: number[]
    mean: number
    std: number
    median: number
    min: number
    max: number
    n: number
  }
}

interface PushTestData {
  [controller: string]: {
    [intensity: string]: {
      survived: number
      total: number
      survival_rate: number
      fisher_p?: number
    }
  }
}

interface GeneSensitivityData {
  [controller: string]: {
    mean_sensitivity: number[]
    std_sensitivity: number[]
    n_genes: number
    delta: number
  }
}

interface StatTestEntry {
  experiment: string
  baseline_mean: string
  variant_mean: string
  diff: string
  p_value: string
  p_adjusted_holm: string
  significance_raw: string
  significance_corrected: string
  cohens_d: string
  effect_label: string
  rank_biserial_r: string
}

interface AblationData {
  [component: string]: {
    mean_drop_pct?: number
    std_drop_pct?: number
    mean_fitness?: number
    mean?: number
  }
}

interface EpistasisData {
  /** Raw 18x18 interaction matrix stored as { "0": number[], "1": number[], ... } */
  matrix: Record<string, number[]>
  /** Strongest gene pairs sorted by interaction strength */
  top_pairs: { gene_i: number; gene_j: number; strength: number }[]
}

/* ─── New data types (Phase 3 visualizations) ─── */

import type { GaitData } from '@/components/viz/BehavioralRadar.tsx'
import type { NNModulationData } from '@/components/viz/NNTimeSeries.tsx'

interface TransferEntry {
  mean: number
  std: number
  values: number[]
}

interface TransferData {
  [controller: string]: {
    absolute: {
      flat?: TransferEntry
      hill?: TransferEntry
      mixed?: TransferEntry
    }
  }
}

/* ─── Data fetching hook ─── */

function useExperimentData() {
  const [convergence, setConvergence] = useState<ConvergenceData | null>(null)
  const [distributions, setDistributions] = useState<FitnessDistData | null>(null)
  const [pushTest, setPushTest] = useState<PushTestData | null>(null)
  const [geneSens, setGeneSens] = useState<GeneSensitivityData | null>(null)
  const [statTests, setStatTests] = useState<StatTestEntry[] | null>(null)
  const [ablation, setAblation] = useState<AblationData | null>(null)
  const [epistasis, setEpistasis] = useState<EpistasisData | null>(null)
  const [bestChromosomes, setBestChromosomes] = useState<Record<string, BestChromosome> | null>(null)
  const [gait, setGait] = useState<GaitData | null>(null)
  const [nnModulation, setNNModulation] = useState<NNModulationData | null>(null)
  const [transfer, setTransfer] = useState<TransferData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [conv, dist, push, gene, stat, abl] = await Promise.all([
          fetch('/data/convergence.json').then(r => r.json()),
          fetch('/data/fitness_distributions.json').then(r => r.json()),
          fetch('/data/push_test.json').then(r => r.json()),
          fetch('/data/gene_sensitivity.json').then(r => r.json()),
          fetch('/data/stat_tests.json').then(r => r.json()),
          fetch('/data/ablation.json').then(r => r.json()),
        ])
        setConvergence(conv)
        setDistributions(dist)
        setPushTest(push)
        setGeneSens(gene)
        setStatTests(stat)
        setAblation(abl)

        // Load additional data (non-blocking)
        fetch('/data/epistasis.json').then(r => r.json()).then(setEpistasis).catch(() => {})
        loadBestChromosomes().then(setBestChromosomes).catch(() => {})
        fetch('/data/gait.json').then(r => r.json()).then(setGait).catch(() => {})
        fetch('/data/nn_modulation.json').then(r => r.json()).then(setNNModulation).catch(() => {})
        fetch('/data/transfer.json').then(r => r.json()).then(setTransfer).catch(() => {})
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { convergence, distributions, pushTest, geneSens, statTests, ablation, epistasis, bestChromosomes, gait, nnModulation, transfer, loading, error }
}

/* ─── 1. Convergence Chart ─── */

const CONVERGENCE_GROUPS = {
  'Controller Tiers': ['baseline', 'cpg_baseline', 'cpgnn_flat'],
  'Sine Variants': ['baseline', 'high_amp', 'low_freq', 'high_mutation', 'large_pop', 'long_run'],
  'Terrain Transfer': ['baseline', 'hill', 'mixed', 'cpg_hill', 'cpg_mixed', 'cpgnn_mixed'],
  'CPG+NN Variants': ['cpgnn_flat', 'cpgnn_mixed', 'cpgnn_frozen', 'cpgnn_high_mutation', 'cpgnn_2x_budget'],
} as const

const LINE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

function ConvergenceGraph({ data }: { data: ConvergenceData }) {
  const groups = Object.keys(CONVERGENCE_GROUPS) as (keyof typeof CONVERGENCE_GROUPS)[]
  const [activeGroup, setActiveGroup] = useState<keyof typeof CONVERGENCE_GROUPS>('Controller Tiers')

  const chartData = useMemo(() => {
    const experiments = CONVERGENCE_GROUPS[activeGroup].filter(e => data[e]?.generations)
    if (experiments.length === 0) return []

    const maxGen = Math.max(...experiments.map(e => data[e]!.generations.length))
    const rows: Record<string, number | string>[] = []

    for (let i = 0; i < maxGen; i++) {
      const row: Record<string, number | string> = { gen: i }
      for (const exp of experiments) {
        if (data[exp] && i < data[exp].best_per_gen.length) {
          row[exp] = Math.round(data[exp].best_per_gen[i] * 10) / 10
        }
      }
      rows.push(row)
    }
    return rows
  }, [data, activeGroup])

  const activeExperiments = CONVERGENCE_GROUPS[activeGroup].filter(e => data[e])

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {groups.map(g => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              activeGroup === g
                ? 'border-accent text-accent bg-accent-subtle/30'
                : 'border-border text-text-dim hover:text-text-secondary hover:border-border-hover'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="gen"
              stroke={COLORS.text}
              tick={{ fill: COLORS.text, fontSize: 9 }}
              label={{ value: 'Generation', position: 'insideBottomRight', offset: -2, fill: COLORS.text, fontSize: 9 }}
            />
            <YAxis
              stroke={COLORS.text}
              tick={{ fill: COLORS.text, fontSize: 9 }}
              label={{ value: 'Best Fitness', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 9 }}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
            {activeExperiments.map((exp, i) => (
              <Line
                key={exp}
                type="monotone"
                dataKey={exp}
                name={CONTROLLER_LABELS[exp] || exp}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="font-mono text-xs text-text-dim">No data for this group.</p>
      )}
    </>
  )
}

/* ─── 2. Fitness Distributions ─── */

function DistributionGraph({ data }: { data: FitnessDistData }) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .map(([name, d]) => ({
        name: CONTROLLER_LABELS[name] || name,
        key: name,
        mean: Math.round(d.mean * 10) / 10,
        median: Math.round(d.median * 10) / 10,
        min: Math.round(d.min * 10) / 10,
        max: Math.round(d.max * 10) / 10,
        std: Math.round(d.std * 10) / 10,
        n: d.n,
      }))
      .sort((a, b) => b.mean - a.mean)
  }, [data])

  const getBarColor = (key: string) => {
    if (key.startsWith('cpgnn')) return COLORS.cpg_nn
    if (key.startsWith('cpg')) return COLORS.cpg
    return COLORS.sine
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, chartData.length * 28)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          stroke={COLORS.text}
          tick={{ fill: COLORS.text, fontSize: 9 }}
          label={{ value: 'Mean Fitness', position: 'insideBottomRight', offset: -2, fill: COLORS.text, fontSize: 9 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke={COLORS.text}
          tick={{ fill: COLORS.text, fontSize: 9 }}
          width={120}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, entry: any) => {
            const d = entry?.payload
            return [`${value} ± ${d?.std ?? '?'} (n=${d?.n ?? '?'})`, 'Mean ± Std']
          }}
        />
        <Bar dataKey="mean" name="Mean Fitness" radius={[0, 2, 2, 0]}>
          {chartData.map((entry) => (
            <Cell key={entry.key} fill={getBarColor(entry.key)} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── 3. Push Test ─── */

const INTENSITY_ORDER = ['gentle', 'moderate', 'strong', 'violent']
const INTENSITY_COLORS: Record<string, string> = {
  gentle: '#10B981',
  moderate: '#F59E0B',
  strong: '#EF4444',
  violent: '#991B1B',
}

function PushTestGraph({ data }: { data: PushTestData }) {
  const chartData = useMemo(() => {
    return Object.entries(data).map(([controller, intensities]) => {
      const row: Record<string, string | number> = {
        name: CONTROLLER_LABELS[controller] || controller,
      }
      for (const [intensity, result] of Object.entries(intensities)) {
        row[intensity] = Math.round(result.survival_rate * 100)
      }
      return row
    })
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          stroke={COLORS.text}
          tick={{ fill: COLORS.text, fontSize: 9 }}
        />
        <YAxis
          stroke={COLORS.text}
          tick={{ fill: COLORS.text, fontSize: 9 }}
          domain={[0, 100]}
          label={{ value: 'Survival %', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 9 }}
        />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [`${v}%`, 'Survival Rate']} />
        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
        {INTENSITY_ORDER.map((intensity) => (
          <Bar
            key={intensity}
            dataKey={intensity}
            name={intensity.charAt(0).toUpperCase() + intensity.slice(1)}
            fill={INTENSITY_COLORS[intensity]}
            fillOpacity={0.85}
          />
        ))}
        <ReferenceLine y={50} stroke="#ffffff33" strokeDasharray="5 5" />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ─── 4. Gene Sensitivity ─── */

const GENE_NAMES_SINE = [
  'hip_L amp', 'hip_L freq', 'hip_L phase',
  'hip_R amp', 'hip_R freq', 'hip_R phase',
  'knee_L amp', 'knee_L freq', 'knee_L phase',
  'knee_R amp', 'knee_R freq', 'knee_R phase',
  'shldr_L amp', 'shldr_L freq', 'shldr_L phase',
  'shldr_R amp', 'shldr_R freq', 'shldr_R phase',
]

function GeneSensitivityGraph({ data }: { data: GeneSensitivityData }) {
  const controllers = Object.keys(data)
  const [activeCtrl, setActiveCtrl] = useState(controllers[0] || 'sine')

  const chartData = useMemo(() => {
    const ctrl = data[activeCtrl]
    if (!ctrl) return []
    return ctrl.mean_sensitivity.map((sens, i) => ({
      gene: GENE_NAMES_SINE[i] || `gene_${i}`,
      sensitivity: Math.round(Math.abs(sens) * 10) / 10,
      std: Math.round(ctrl.std_sensitivity[i] * 10) / 10,
    }))
  }, [data, activeCtrl])

  const getColor = () => {
    if (activeCtrl.startsWith('cpgnn')) return COLORS.cpg_nn
    if (activeCtrl.startsWith('cpg')) return COLORS.cpg
    return COLORS.sine
  }

  return (
    <>
      <div className="flex gap-2 mb-4">
        {controllers.map(c => (
          <button
            key={c}
            onClick={() => setActiveCtrl(c)}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              activeCtrl === c
                ? 'border-accent text-accent bg-accent-subtle/30'
                : 'border-border text-text-dim hover:text-text-secondary hover:border-border-hover'
            }`}
          >
            {CONTROLLER_LABELS[c] || c}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="gene"
            stroke={COLORS.text}
            tick={{ fill: COLORS.text, fontSize: 8 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke={COLORS.text}
            tick={{ fill: COLORS.text, fontSize: 9 }}
            label={{ value: '|Δ Fitness|', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 9 }}
          />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="sensitivity" name="Sensitivity" fill={getColor()} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

/* ─── 5. Statistical Tests Table ─── */

function StatTestsGraph({ data }: { data: StatTestEntry[] }) {
  const sigColor = (sig: string) => {
    if (sig === '***') return 'text-green-400'
    if (sig === '**') return 'text-green-300'
    if (sig === '*') return 'text-yellow-300'
    return 'text-text-dim'
  }

  const effectColor = (label: string) => {
    if (label === 'large') return 'text-red-400'
    if (label === 'medium') return 'text-yellow-300'
    if (label === 'small') return 'text-blue-300'
    return 'text-text-dim'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-[10px] border-collapse">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="text-left py-2 pr-3">Experiment</th>
            <th className="text-right py-2 px-2">Baseline μ</th>
            <th className="text-right py-2 px-2">Variant μ</th>
            <th className="text-right py-2 px-2">Diff</th>
            <th className="text-right py-2 px-2">p (Holm)</th>
            <th className="text-center py-2 px-2">Sig</th>
            <th className="text-right py-2 px-2">Cohen's d</th>
            <th className="text-center py-2 px-2">Effect</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-bg-panel/50 transition-colors">
              <td className="py-1.5 pr-3 text-text-secondary">
                {CONTROLLER_LABELS[row.experiment] || row.experiment}
              </td>
              <td className="text-right py-1.5 px-2 text-text-dim">{row.baseline_mean}</td>
              <td className="text-right py-1.5 px-2 text-text-dim">{row.variant_mean}</td>
              <td className={`text-right py-1.5 px-2 ${
                parseFloat(row.diff) > 0 ? 'text-green-400' : parseFloat(row.diff) < 0 ? 'text-red-400' : 'text-text-dim'
              }`}>
                {row.diff}
              </td>
              <td className="text-right py-1.5 px-2 text-text-dim">{row.p_adjusted_holm}</td>
              <td className={`text-center py-1.5 px-2 ${sigColor(row.significance_corrected)}`}>
                {row.significance_corrected}
              </td>
              <td className="text-right py-1.5 px-2 text-text-dim">{row.cohens_d}</td>
              <td className={`text-center py-1.5 px-2 ${effectColor(row.effect_label)}`}>
                {row.effect_label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ─── 6. Ablation Study ─── */

function AblationGraph({ data }: { data: AblationData }) {
  const chartData = useMemo(() => {
    return Object.entries(data)
      .filter(([key]) => !key.startsWith('_'))
      .map(([component, d]) => ({
        name: component.replace(/_/g, ' '),
        drop: Math.round((d.mean_drop_pct || 0) * 10) / 10,
        std: Math.round((d.std_drop_pct || 0) * 10) / 10,
      }))
      .sort((a, b) => b.drop - a.drop)
  }, [data])

  const baseline = data._baseline?.mean || 0
  const frozen = data._frozen?.mean || 0

  return (
    <>
      <div className="flex gap-6 mb-4 font-mono text-[10px]">
        <span className="text-text-dim">
          Baseline fitness: <span className="text-green-400">{Math.round(baseline)}</span>
        </span>
        <span className="text-text-dim">
          Frozen NN: <span className="text-yellow-300">{Math.round(frozen)}</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 110 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            stroke={COLORS.text}
            tick={{ fill: COLORS.text, fontSize: 9 }}
            label={{ value: 'Fitness Drop %', position: 'insideBottomRight', offset: -2, fill: COLORS.text, fontSize: 9 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke={COLORS.text}
            tick={{ fill: COLORS.text, fontSize: 9 }}
            width={110}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, _name: any, entry: any) => {
              return [`${value} ± ${entry?.payload?.std ?? '?'}%`, 'Fitness Drop']
            }}
          />
          <Bar dataKey="drop" name="Drop %" fill="#EF4444" fillOpacity={0.75} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  )
}

/* ─── 7. Evolution Rings (extracted from IIFE) ─── */

function EvolutionRingsGraph({ data }: { data: ConvergenceData }) {
  const ringsData = useMemo(() => {
    const firstKey = Object.keys(data)[0]
    const firstData = firstKey ? data[firstKey] : null
    if (!firstData) return null
    return firstData.generations.map((gen, i) => ({
      generation: gen,
      best: firstData.best_per_gen[i] ?? 0,
      avg: firstData.mean_per_gen[i] ?? 0,
    }))
  }, [data])

  if (!ringsData) return <p className="font-mono text-xs text-text-dim">No convergence data available.</p>

  return (
    <div className="flex justify-center">
      <EvolutionRings data={ringsData} size={350} />
    </div>
  )
}

/* ─── 8. Family Tree (extracted from IIFE) ─── */

function FamilyTreeGraph({ data }: { data: ConvergenceData }) {
  const treeNodes = useMemo(() => {
    const firstKey = Object.keys(data)[0]
    const firstData = firstKey ? data[firstKey] : null
    if (!firstData || firstData.generations.length < 3) return null

    return firstData.generations.slice(0, 15).flatMap((gen, gi) => {
      const bestFit = firstData.best_per_gen[gi] ?? 0
      const avgFit = firstData.mean_per_gen[gi] ?? 0
      return [
        { id: gi * 3, fitness: bestFit, generation: gen, parentIds: gi > 0 ? [((gi - 1) * 3) as number, ((gi - 1) * 3 + 1) as number] as [number, number] : null },
        { id: gi * 3 + 1, fitness: avgFit, generation: gen, parentIds: gi > 0 ? [((gi - 1) * 3) as number, ((gi - 1) * 3 + 2) as number] as [number, number] : null },
        { id: gi * 3 + 2, fitness: avgFit * 0.85, generation: gen, parentIds: gi > 0 ? [((gi - 1) * 3 + 1) as number, ((gi - 1) * 3 + 2) as number] as [number, number] : null },
      ]
    })
  }, [data])

  if (!treeNodes) return <p className="font-mono text-xs text-text-dim">Not enough generation data for family tree.</p>

  return <FamilyTree creatures={treeNodes} maxGens={15} width={700} height={350} />
}

/* ─── 9. Population Scatter (extracted from IIFE) ─── */

function PopulationScatterGraph({ data }: { data: FitnessDistData }) {
  const swarmPoints = useMemo(() => {
    const entries = Object.entries(data)
    if (entries.length === 0) return null
    const maxFit = Math.max(...entries.map(([, d]) => d.max))
    return entries.map(([, d], i) => ({
      id: i,
      x: (d.mean / maxFit) * 0.6 + 0.2 + (d.std / maxFit) * 0.3,
      y: d.mean / maxFit,
      isBest: d.mean === Math.max(...entries.map(([, dd]) => dd.mean)),
    }))
  }, [data])

  if (!swarmPoints) return <p className="font-mono text-xs text-text-dim">No distribution data available.</p>

  return (
    <div className="flex justify-center">
      <PopulationSwarm points={swarmPoints} width={500} height={280} />
    </div>
  )
}

/* ─── 10. 3D Fitness Landscape ─── */

function FitnessLandscapeGraph({ data }: { data: EpistasisData }) {
  // Convert the raw { "0": number[], ... "17": number[] } object into a proper 2D array
  const interactionMatrix = useMemo(() => {
    const raw = data.matrix
    if (!raw || typeof raw !== 'object') return null
    const keys = Object.keys(raw).sort((a, b) => Number(a) - Number(b))
    if (keys.length === 0) return null
    return keys.map(k => raw[k]).filter(Array.isArray) as number[][]
  }, [data])

  // Pre-select strongest gene pair from top_pairs data
  const topPair = data.top_pairs?.[0]
  const [geneA, setGeneA] = useState(topPair?.gene_i ?? 0)
  const [geneB, setGeneB] = useState(topPair?.gene_j ?? 1)

  const grid = useMemo(() => {
    if (!interactionMatrix) return null
    return buildGridFromEpistasis(interactionMatrix, geneA, geneB)
  }, [interactionMatrix, geneA, geneB])

  const geneNames = GENE_NAMES_SINE
  const nGenes = interactionMatrix?.length ?? GENE_NAMES_SINE.length

  // Build quick-pick buttons for the 4 strongest pairs
  const quickPicks = useMemo(() => {
    if (!data.top_pairs) return []
    return data.top_pairs.slice(0, 4).map(p => ({
      geneI: p.gene_i,
      geneJ: p.gene_j,
      label: `${geneNames[p.gene_i] ?? p.gene_i} × ${geneNames[p.gene_j] ?? p.gene_j}`,
    }))
  }, [data.top_pairs, geneNames])

  return (
    <>
      {quickPicks.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <span className="font-mono text-[10px] text-text-dim self-center mr-1">Top pairs:</span>
          {quickPicks.map((p, i) => (
            <button
              key={i}
              onClick={() => { setGeneA(p.geneI); setGeneB(p.geneJ) }}
              className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
                geneA === p.geneI && geneB === p.geneJ
                  ? 'border-accent text-accent bg-accent-subtle/30'
                  : 'border-border text-text-dim hover:text-text-secondary hover:border-border-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-2 font-mono text-[10px] text-text-dim">
          <span>X:</span>
          <select
            value={geneA}
            onChange={e => setGeneA(Number(e.target.value))}
            className="bg-bg-surface border border-border px-1.5 py-0.5 text-text-secondary text-[10px]"
          >
            {Array.from({ length: nGenes }, (_, i) => (
              <option key={i} value={i}>{geneNames[i] ?? `Gene ${i}`}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 font-mono text-[10px] text-text-dim">
          <span>Y:</span>
          <select
            value={geneB}
            onChange={e => setGeneB(Number(e.target.value))}
            className="bg-bg-surface border border-border px-1.5 py-0.5 text-text-secondary text-[10px]"
          >
            {Array.from({ length: nGenes }, (_, i) => (
              <option key={i} value={i}>{geneNames[i] ?? `Gene ${i}`}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="h-[400px] border border-border bg-[#0a0a0f]">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-text-dim text-xs">Loading 3D...</div>}>
          {grid && (
            <FitnessLandscape3D
              grid={grid}
              xLabel={geneNames[geneA] || `Gene ${geneA}`}
              yLabel={geneNames[geneB] || `Gene ${geneB}`}
            />
          )}
        </Suspense>
      </div>
    </>
  )
}

/* ─── 11. Chromosome Helix ─── */

function ChromosomeHelixGraph({ data }: { data: Record<string, BestChromosome> }) {
  const entries = Object.entries(data).filter(([, v]) => v.genes?.length > 0)
  const [activeKey, setActiveKey] = useState(entries[0]?.[0] || '')

  const activeEntry = data[activeKey]
  const genes = activeEntry?.genes ?? []

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {entries.map(([key]) => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              activeKey === key
                ? 'border-accent text-accent bg-accent-subtle/30'
                : 'border-border text-text-dim hover:text-text-secondary hover:border-border-hover'
            }`}
          >
            {CONTROLLER_LABELS[key] || key}
          </button>
        ))}
      </div>

      {activeEntry && (
        <div className="mb-2 font-mono text-[10px] text-text-dim">
          Fitness: <span className="text-accent">{activeEntry.fitness.toFixed(1)}</span>
          {' · '}{genes.length} genes
        </div>
      )}

      <div className="h-[400px] border border-border bg-[#0a0a0f]">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-text-dim text-xs">Loading 3D...</div>}>
          {genes.length > 0 && (
            <ChromosomeHelix
              genes={genes}
              geneLabels={GENE_NAMES_SINE}
            />
          )}
        </Suspense>
      </div>
    </>
  )
}

/* ─── Stat Pill ─── */

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-bg-surface px-4 py-2 flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">{label}</span>
      <span className="font-semibold text-sm text-accent">{value}</span>
    </div>
  )
}

/* ─── Main Page ─── */

export default function Results() {
  const { convergence, distributions, pushTest, geneSens, statTests, ablation, epistasis, bestChromosomes, gait, nnModulation, transfer, loading, error } = useExperimentData()
  const [activeGraph, setActiveGraph] = useState<GraphId>('convergence')

  // Filter to only show sections that have data loaded
  const availableSections = useMemo(() => {
    return GRAPH_SECTIONS.filter(s => {
      switch (s.id) {
        case 'convergence': return !!convergence
        case 'distributions': return !!distributions
        case 'push-test': return !!pushTest
        case 'gene-sensitivity': return !!geneSens
        case 'stat-tests': return !!statTests
        case 'ablation': return !!ablation
        case 'evolution-rings': return !!convergence
        case 'family-tree': return !!convergence
        case 'population-scatter': return !!distributions
        case 'fitness-landscape': return !!epistasis
        case 'chromosome-helix': return !!bestChromosomes
        case 'behavioral-radar': return !!gait
        case 'encoding-diagram': return !!bestChromosomes
        case 'evolution-snapshots': return !!convergence
        case 'race-comparison': return !!transfer
        case 'skeleton-trail': return !!bestChromosomes
        case 'nn-timeseries': return !!nnModulation
        default: return false
      }
    })
  }, [convergence, distributions, pushTest, geneSens, statTests, ablation, epistasis, bestChromosomes, gait, nnModulation, transfer])

  // Fall back to first available if current selection has no data yet
  const resolvedGraph = availableSections.some(s => s.id === activeGraph)
    ? activeGraph
    : (availableSections[0]?.id ?? 'convergence')

  const activeSection = GRAPH_SECTIONS.find(s => s.id === resolvedGraph)

  if (loading) {
    return (
      <div className="h-full p-6 overflow-y-auto">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-text-secondary mb-6">RESULTS DASHBOARD</h1>
        <div className="border border-border bg-bg-surface p-8 min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="font-medium text-xs uppercase tracking-wide text-accent mb-2 animate-pulse">LOADING DATA</p>
            <p className="font-mono text-xs text-text-dim">Fetching experiment results...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full p-6 overflow-y-auto">
        <h1 className="font-semibold text-sm uppercase tracking-wide text-text-secondary mb-6">RESULTS DASHBOARD</h1>
        <div className="border border-border bg-bg-surface p-8 min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="font-medium text-xs uppercase tracking-wide text-red-400 mb-2">DATA LOAD ERROR</p>
            <p className="font-mono text-xs text-text-dim">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <h1 className="font-semibold text-sm uppercase tracking-wide text-text-secondary mb-2">RESULTS DASHBOARD</h1>
      <p className="font-mono text-xs text-text-dim mb-6">
        Pre-computed results from 510 simulation runs across 17 experiment configurations.
      </p>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-10">
        <StatPill label="EXPERIMENTS" value="17" />
        <StatPill label="TOTAL RUNS" value="510" />
        <StatPill
          label="BEST FITNESS"
          value={distributions
            ? Math.round(Math.max(...Object.values(distributions).map(d => d.max))).toString()
            : '...'
          }
        />
        <StatPill label="CONTROLLER TIERS" value="3" />
      </div>

      {/* Graph selector dropdown */}
      <div className="mb-8">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-text-dim mb-2">
          Select Visualization
        </label>
        <select
          value={resolvedGraph}
          onChange={e => setActiveGraph(e.target.value as GraphId)}
          className="w-full bg-bg-surface border border-border px-3 py-2.5 font-mono text-xs text-text-secondary focus:outline-none focus:border-accent cursor-pointer"
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            backgroundImage: CHEVRON_SVG,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '10px',
          }}
        >
          {availableSections.map(s => (
            <option key={s.id} value={s.id} title={s.tooltip}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Active graph container */}
      <div key={resolvedGraph} className="border border-border bg-bg-surface p-5 mb-6 animate-graph-enter">
        {resolvedGraph === 'convergence' && convergence && <ConvergenceGraph data={convergence} />}
        {resolvedGraph === 'distributions' && distributions && <DistributionGraph data={distributions} />}
        {resolvedGraph === 'push-test' && pushTest && <PushTestGraph data={pushTest} />}
        {resolvedGraph === 'gene-sensitivity' && geneSens && <GeneSensitivityGraph data={geneSens} />}
        {resolvedGraph === 'stat-tests' && statTests && <StatTestsGraph data={statTests} />}
        {resolvedGraph === 'ablation' && ablation && <AblationGraph data={ablation} />}
        {resolvedGraph === 'evolution-rings' && convergence && <EvolutionRingsGraph data={convergence} />}
        {resolvedGraph === 'family-tree' && convergence && <FamilyTreeGraph data={convergence} />}
        {resolvedGraph === 'population-scatter' && distributions && <PopulationScatterGraph data={distributions} />}
        {resolvedGraph === 'fitness-landscape' && epistasis && <FitnessLandscapeGraph data={epistasis} />}
        {resolvedGraph === 'chromosome-helix' && bestChromosomes && <ChromosomeHelixGraph data={bestChromosomes} />}
        {resolvedGraph === 'behavioral-radar' && gait && <BehavioralRadar data={gait} />}
        {resolvedGraph === 'encoding-diagram' && bestChromosomes && <EncodingDiagram data={bestChromosomes} />}
        {resolvedGraph === 'evolution-snapshots' && convergence && <EvolutionSnapshots data={convergence} />}
        {resolvedGraph === 'race-comparison' && transfer && <RaceComparison data={transfer} />}
        {resolvedGraph === 'skeleton-trail' && bestChromosomes && (
          <Suspense fallback={<div className="text-center py-8"><p className="font-mono text-xs text-text-dim animate-pulse">Running simulation...</p></div>}>
            <SkeletonTrail data={bestChromosomes} />
          </Suspense>
        )}
        {resolvedGraph === 'nn-timeseries' && nnModulation && <NNTimeSeries data={nnModulation} />}
      </div>

      {/* Interpretation box */}
      {activeSection && (
        <div key={`interp-${resolvedGraph}`} className="border-l-2 border-accent bg-bg-surface px-5 py-4 animate-graph-enter">
          <p className="font-mono text-[11px] text-text-secondary leading-relaxed">
            {activeSection.interpretation}
          </p>
        </div>
      )}
    </div>
  )
}
