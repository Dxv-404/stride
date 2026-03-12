/**
 * About / Learn page — explains STRIDE's concepts.
 *
 * Sections:
 *   1. Project overview
 *   2. Creature anatomy (stick figure diagram)
 *   3. Controller tiers (Sine → CPG → CPG+NN)
 *   4. Genetic algorithm pipeline
 *   5. Experiment summary
 *   6. Credits
 */

import { useState } from 'react'

/* ─── Section component ─── */

function Section({ id, title, children }: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-16 pb-16 border-b border-border last:border-b-0">
      <h2 className="font-semibold text-sm uppercase tracking-widest text-accent mb-6">{title}</h2>
      {children}
    </section>
  )
}

/* ─── Info card ─── */

function InfoCard({ label, value, color = 'text-accent' }: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="border border-border bg-bg-surface p-5 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-dim mb-2">{label}</p>
      <p className={`font-semibold text-base ${color}`}>{value}</p>
    </div>
  )
}

/* ─── Creature anatomy SVG ─── */

function CreatureAnatomy() {
  const [hoveredPart, setHoveredPart] = useState<string | null>(null)

  const parts: Record<string, { label: string; desc: string; color: string }> = {
    torso: {
      label: 'Torso',
      desc: 'Central body segment (mass: 6.0 kg). Houses all joint connections.',
      color: '#8b62d8',
    },
    hip: {
      label: 'Hip Joints',
      desc: 'Motorized joints (2) connecting torso to upper legs. Range: [-π/4, π/3].',
      color: '#3B82F6',
    },
    knee: {
      label: 'Knee Joints',
      desc: 'Motorized joints (2) connecting upper to lower legs. Range: [-2π/3, 0].',
      color: '#10B981',
    },
    shoulder: {
      label: 'Shoulder Joints',
      desc: 'Motorized joints (2) connecting torso to upper arms. Range: [-π/3, π/3].',
      color: '#F59E0B',
    },
    elbow: {
      label: 'Elbow Springs',
      desc: 'Passive spring joints (2). Not motorized — swing naturally via damped spring.',
      color: '#6366F1',
    },
    ankle: {
      label: 'Ankle Springs',
      desc: 'Passive spring joints (2). Keep feet oriented downward for ground contact.',
      color: '#EC4899',
    },
    foot: {
      label: 'Feet',
      desc: 'Wide contact surfaces for ground friction. Provide foot-contact sensor data.',
      color: '#06B6D4',
    },
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* SVG stick figure */}
      <div className="border border-border bg-bg-panel p-6 flex-shrink-0">
        <svg width="240" height="320" viewBox="0 0 240 320" className="block">
          {/* Ground */}
          <line x1="0" y1="290" x2="240" y2="290" stroke="currentColor" opacity="0.08" strokeWidth="1" />
          <text x="120" y="308" textAnchor="middle" fill="currentColor" opacity="0.18" fontSize="9" fontFamily="monospace">ground</text>

          {/* Torso */}
          <rect
            x="100" y="80" width="40" height="65" rx="3"
            fill={hoveredPart === 'torso' ? parts.torso.color : '#2a2a40'}
            stroke={parts.torso.color} strokeWidth="2"
            onMouseEnter={() => setHoveredPart('torso')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer transition-colors"
          />
          <text x="120" y="118" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="monospace">torso</text>

          {/* Head (cosmetic) */}
          <circle cx="120" cy="65" r="15" fill="none" stroke="currentColor" opacity="0.2" strokeWidth="1" />

          {/* Left arm */}
          <line x1="100" y1="92" x2="70" y2="140"
            stroke={hoveredPart === 'shoulder' ? parts.shoulder.color : '#F59E0B99'}
            strokeWidth="3"
            onMouseEnter={() => setHoveredPart('shoulder')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="100" cy="92" r="4" fill={parts.shoulder.color} />
          <line x1="70" y1="140" x2="55" y2="185"
            stroke={hoveredPart === 'elbow' ? parts.elbow.color : '#6366F199'}
            strokeWidth="2"
            onMouseEnter={() => setHoveredPart('elbow')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="70" cy="140" r="3" fill={parts.elbow.color} />

          {/* Right arm */}
          <line x1="140" y1="92" x2="170" y2="140"
            stroke={hoveredPart === 'shoulder' ? parts.shoulder.color : '#F59E0B99'}
            strokeWidth="3"
            onMouseEnter={() => setHoveredPart('shoulder')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="140" cy="92" r="4" fill={parts.shoulder.color} />
          <line x1="170" y1="140" x2="185" y2="185"
            stroke={hoveredPart === 'elbow' ? parts.elbow.color : '#6366F199'}
            strokeWidth="2"
            onMouseEnter={() => setHoveredPart('elbow')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="170" cy="140" r="3" fill={parts.elbow.color} />

          {/* Left leg */}
          <line x1="108" y1="145" x2="85" y2="210"
            stroke={hoveredPart === 'hip' ? parts.hip.color : '#3B82F699'}
            strokeWidth="4"
            onMouseEnter={() => setHoveredPart('hip')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="108" cy="145" r="5" fill={parts.hip.color} />
          <line x1="85" y1="210" x2="75" y2="265"
            stroke={hoveredPart === 'knee' ? parts.knee.color : '#10B98199'}
            strokeWidth="3"
            onMouseEnter={() => setHoveredPart('knee')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="85" cy="210" r="4" fill={parts.knee.color} />

          {/* Left ankle + foot */}
          <circle cx="75" cy="265" r="3" fill={parts.ankle.color} />
          <rect
            x="60" y="275" width="30" height="10" rx="2"
            fill={hoveredPart === 'foot' ? parts.foot.color : '#06B6D444'}
            stroke={parts.foot.color} strokeWidth="1"
            onMouseEnter={() => setHoveredPart('foot')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />

          {/* Right leg */}
          <line x1="132" y1="145" x2="155" y2="210"
            stroke={hoveredPart === 'hip' ? parts.hip.color : '#3B82F699'}
            strokeWidth="4"
            onMouseEnter={() => setHoveredPart('hip')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="132" cy="145" r="5" fill={parts.hip.color} />
          <line x1="155" y1="210" x2="165" y2="265"
            stroke={hoveredPart === 'knee' ? parts.knee.color : '#10B98199'}
            strokeWidth="3"
            onMouseEnter={() => setHoveredPart('knee')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />
          <circle cx="155" cy="210" r="4" fill={parts.knee.color} />

          {/* Right ankle + foot */}
          <circle cx="165" cy="265" r="3" fill={parts.ankle.color} />
          <rect
            x="150" y="275" width="30" height="10" rx="2"
            fill={hoveredPart === 'foot' ? parts.foot.color : '#06B6D444'}
            stroke={parts.foot.color} strokeWidth="1"
            onMouseEnter={() => setHoveredPart('foot')}
            onMouseLeave={() => setHoveredPart(null)}
            className="cursor-pointer"
          />

          {/* Joint type labels */}
          <text x="15" y="93" fill={parts.shoulder.color} fontSize="8" fontFamily="monospace">shoulder</text>
          <text x="15" y="148" fill={parts.hip.color} fontSize="8" fontFamily="monospace">hip</text>
          <text x="15" y="213" fill={parts.knee.color} fontSize="8" fontFamily="monospace">knee</text>
          <text x="15" y="268" fill={parts.ankle.color} fontSize="8" fontFamily="monospace">ankle</text>
        </svg>
      </div>

      {/* Part info */}
      <div className="flex-1 space-y-3">
        <p className="text-sm text-text-dim mb-4">
          Hover over body parts to learn about each component.
        </p>
        {hoveredPart ? (
          <div className="border border-border bg-bg-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: parts[hoveredPart].color }}>
              {parts[hoveredPart].label}
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {parts[hoveredPart].desc}
            </p>
          </div>
        ) : (
          <div className="border border-border bg-bg-panel p-5">
            <p className="text-sm text-text-dim">← Hover a joint or body part</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-6">
          <InfoCard label="MOTORIZED JOINTS" value="6" color="text-blue-400" />
          <InfoCard label="SPRING JOINTS" value="4" color="text-purple-400" />
          <InfoCard label="BODY SEGMENTS" value="11" color="text-text-secondary" />
          <InfoCard label="TOTAL MASS" value="11.6 kg" color="text-text-secondary" />
        </div>
      </div>
    </div>
  )
}

/* ─── Controller tier card ─── */

function ControllerTier({ name, color, genes, description, formula, complexity }: {
  name: string
  color: string
  genes: number
  description: string
  formula: string
  complexity: string
}) {
  return (
    <div className="border border-border bg-bg-surface p-6 flex-1 min-w-[280px]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-3 h-3" style={{ backgroundColor: color }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
          {name}
        </h3>
        <span className="font-mono text-xs text-text-dim ml-auto">{genes} genes</span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed mb-4">
        {description}
      </p>
      <div className="bg-bg-panel border border-border p-3 mb-4">
        <code className="font-mono text-xs text-text-dim break-all">{formula}</code>
      </div>
      <p className="font-mono text-xs text-text-dim">
        Complexity: <span className="text-text-secondary">{complexity}</span>
      </p>
    </div>
  )
}

/* ─── GA pipeline step ─── */

function GAStep({ num, title, description }: {
  num: number
  title: string
  description: string
}) {
  return (
    <div className="flex gap-5 items-start">
      <div className="w-10 h-10 border border-accent flex items-center justify-center flex-shrink-0">
        <span className="font-mono text-sm font-semibold text-accent">{String(num).padStart(2, '0')}</span>
      </div>
      <div className="flex-1 pb-5 border-b border-border/50 last:border-b-0">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-primary mb-1.5">{title}</h4>
        <p className="text-sm text-text-dim leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

/* ─── Main page ─── */

export default function Learn() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-8 py-10">
        {/* Page header */}
        <div className="mb-12">
          <h1 className="font-bold text-2xl tracking-tight text-text-primary mb-3">About STRIDE</h1>
          <p className="text-base text-text-dim max-w-2xl">
            Understanding how virtual creatures learn to walk through evolutionary optimization.
          </p>
        </div>

        {/* Quick nav */}
        <div className="flex gap-2.5 mb-12 flex-wrap">
          {['overview', 'anatomy', 'controllers', 'algorithm', 'experiments'].map(s => (
            <a
              key={s}
              href={`#${s}`}
              className="font-mono text-xs px-4 py-2 border border-border text-text-dim
                hover:text-accent hover:border-accent transition-colors"
            >
              {s.toUpperCase()}
            </a>
          ))}
        </div>

        {/* 1. Project overview */}
        <Section id="overview" title="PROJECT OVERVIEW">
          <div className="space-y-5">
            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              STRIDE (Simulated Terrestrial Running using Iterative Directed Evolution) is a
              computational experiment in evolving bipedal locomotion. Starting from random
              movement patterns, a genetic algorithm iteratively discovers walking gaits through
              natural selection — no human-designed gaits, no machine learning training data.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed max-w-3xl">
              The project explores three tiers of motor control complexity: open-loop sinusoidal
              oscillators, coupled central pattern generators (CPGs), and a hybrid CPG + neural
              network controller with sensory feedback. Each tier builds on the previous one
              through cascade seeding — best solutions from simpler controllers bootstrap the
              search for more complex ones.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              <InfoCard label="CONTROLLER TIERS" value="3" />
              <InfoCard label="EXPERIMENTS" value="17" />
              <InfoCard label="TOTAL RUNS" value="510" />
              <InfoCard label="SIMULATED STEPS" value="~153M" />
            </div>
          </div>
        </Section>

        {/* 2. Creature anatomy */}
        <Section id="anatomy" title="CREATURE ANATOMY">
          <p className="text-sm text-text-dim mb-6 max-w-3xl">
            Each creature is a 2D ragdoll with 11 rigid body segments, 6 motorized joints, and
            4 passive spring joints. The physics simulation uses p2.js with PD motor control.
          </p>
          <CreatureAnatomy />
        </Section>

        {/* 3. Controller tiers */}
        <Section id="controllers" title="CONTROLLER TIERS">
          <p className="text-sm text-text-dim mb-6 max-w-3xl">
            Three levels of control complexity, each building on the previous. Higher tiers
            use cascade seeding — inheriting optimized parameters from simpler controllers.
          </p>

          {/* Tier progression arrow */}
          <div className="flex items-center gap-3 mb-8 font-mono text-sm text-text-dim">
            <span className="text-blue-400 font-semibold">Sine</span>
            <span>→ seeds →</span>
            <span className="text-green-400 font-semibold">CPG</span>
            <span>→ seeds →</span>
            <span className="text-yellow-400 font-semibold">CPG+NN</span>
          </div>

          <div className="flex flex-col xl:flex-row gap-5">
            <ControllerTier
              name="SINE"
              color="#3B82F6"
              genes={18}
              description="Open-loop sinusoidal controller. Each of 6 motorized joints follows an independent sine wave with evolvable amplitude, frequency, and phase. Simple but effective — no feedback, no inter-joint coordination."
              formula="target_j(t) = A_j · sin(2π · f_j · t + φ_j)"
              complexity="O(6) per step — 6 sin() calls"
            />
            <ControllerTier
              name="CPG"
              color="#10B981"
              genes={38}
              description="Kuramoto-coupled central pattern generator. 6 oscillators connected by 10 directed coupling links. Oscillators influence each other's phase dynamics, enabling coordinated gait patterns (e.g., alternating left-right)."
              formula="dφ_i/dt = 2π·f_i + Σ_j(w_ij · sin(φ_j - φ_i + Φ_ij))"
              complexity="O(6 + 10) per step — coupled dynamics"
            />
            <ControllerTier
              name="CPG+NN"
              color="#F59E0B"
              genes={96}
              description="Hybrid CPG with neural network modulation. The CPG generates base oscillation; a small 6→4→6 neural network reads 6 sensor inputs and modulates CPG output. Enables reactive behavior (e.g., adjusting to terrain)."
              formula="final_i = cpg_i × (1 + 0.5 × tanh(W₂·tanh(W₁·s + b₁) + b₂))"
              complexity="O(6 + 10 + 58) per step — CPG + NN forward pass"
            />
          </div>

          {/* Sensor inputs */}
          <div className="mt-8 border border-border bg-bg-panel p-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-yellow-400 mb-4">CPG+NN SENSOR INPUTS (6 DIMS)</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { name: 'hip_L angle', desc: 'Left hip joint position' },
                { name: 'hip_R angle', desc: 'Right hip joint position' },
                { name: 'hip_L velocity', desc: 'Left hip angular rate' },
                { name: 'hip_R velocity', desc: 'Right hip angular rate' },
                { name: 'torso angle', desc: 'Body tilt from vertical' },
                { name: 'foot_L contact', desc: 'Left foot on ground (0/1)' },
              ].map(s => (
                <div key={s.name} className="border border-border/50 p-3">
                  <span className="font-mono text-xs text-text-secondary">{s.name}</span>
                  <br />
                  <span className="text-xs text-text-dim">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 4. Genetic algorithm */}
        <Section id="algorithm" title="GENETIC ALGORITHM">
          <p className="text-sm text-text-dim mb-8 max-w-3xl">
            The GA evolves controller parameters (chromosomes of [0,1] floats) to maximize
            a fitness function combining distance, stability, velocity, and gait regularity.
          </p>

          <div className="space-y-4 max-w-3xl">
            <GAStep
              num={1}
              title="RANDOM POPULATION"
              description="Initialize 100 individuals with random [0,1] genes. For CPG/CPG+NN, cascade-seed from previous tier's best solutions instead of random init."
            />
            <GAStep
              num={2}
              title="FITNESS EVALUATION"
              description="Simulate each creature for 500 physics steps (~8.3 seconds). Fitness = distance + velocity bonus + upright bonus + gait bonus - stumble penalty."
            />
            <GAStep
              num={3}
              title="TOURNAMENT SELECTION"
              description="Select parents via tournament selection (k=5). Pick 5 random individuals, keep the fittest. Repeat to form a mating pool."
            />
            <GAStep
              num={4}
              title="BLX-α CROSSOVER"
              description="Blend crossover with α=0.3. For each gene, the child's value is sampled from the range [min - α·d, max + α·d] where d = |parent1 - parent2|."
            />
            <GAStep
              num={5}
              title="GAUSSIAN MUTATION"
              description="Each gene has a probability p_m of being mutated by adding Gaussian noise: gene += N(0, σ). For CPG+NN, different mutation rates per gene group."
            />
            <GAStep
              num={6}
              title="ELITISM"
              description="The top 5% of individuals survive directly to the next generation without modification, preserving the best solutions found so far."
            />
            <GAStep
              num={7}
              title="CONVERGENCE"
              description="Repeat for 75-150 generations until fitness plateaus. Best individual is extracted as the evolved walker."
            />
          </div>

          {/* Fitness function breakdown */}
          <div className="mt-10 border border-border bg-bg-panel p-6 max-w-3xl">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-accent mb-4">FITNESS FUNCTION</h4>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>distance</span>
                <span className="text-text-dim text-xs">Horizontal displacement (primary signal)</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>+ velocity_bonus</span>
                <span className="text-text-dim text-xs">Reward for higher average speed</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>+ upright_bonus</span>
                <span className="text-text-dim text-xs">Reward for keeping torso near vertical</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>+ gait_bonus</span>
                <span className="text-text-dim text-xs">Reward for rhythmic leg alternation</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>- stumble_penalty</span>
                <span className="text-text-dim text-xs">Penalty for excessive torso oscillation</span>
              </div>
            </div>
          </div>
        </Section>

        {/* 5. Experiments */}
        <Section id="experiments" title="EXPERIMENT OVERVIEW">
          <p className="text-sm text-text-dim mb-6 max-w-3xl">
            17 experiments across 3 controller tiers, each repeated 30 times with different
            random seeds (42–71) for statistical rigor.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-6 font-semibold text-xs uppercase tracking-wider text-text-secondary">Tier</th>
                  <th className="text-left py-3 pr-6 font-semibold text-xs uppercase tracking-wider text-text-secondary">Experiment</th>
                  <th className="text-left py-3 font-semibold text-xs uppercase tracking-wider text-text-secondary">What it tests</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Sine', 'baseline', 'Default parameters on flat terrain'],
                  ['Sine', 'high_amp', 'Wider amplitude range for joints'],
                  ['Sine', 'low_freq', 'Lower movement frequencies'],
                  ['Sine', 'high_mutation', 'Increased mutation rate (0.15)'],
                  ['Sine', 'large_pop', 'Larger population (200 individuals)'],
                  ['Sine', 'long_run', 'Extended evolution (200 generations)'],
                  ['Sine', 'indirect', 'Indirect encoding (9 genes via symmetry)'],
                  ['Sine', 'hill', 'Uphill terrain (slope ≈ 5°)'],
                  ['Sine', 'mixed', 'Mixed terrain (flat + hills)'],
                  ['CPG', 'cpg_baseline', 'CPG on flat, seeded from sine'],
                  ['CPG', 'cpg_hill', 'CPG on uphill terrain'],
                  ['CPG', 'cpg_mixed', 'CPG on mixed terrain'],
                  ['CPG+NN', 'cpgnn_flat', 'Full hybrid on flat terrain'],
                  ['CPG+NN', 'cpgnn_mixed', 'Full hybrid on mixed terrain'],
                  ['CPG+NN', 'cpgnn_frozen', 'NN weights frozen (CPG only, dimensionality control)'],
                  ['CPG+NN', 'cpgnn_high_mutation', 'Higher NN mutation rate'],
                  ['CPG+NN', 'cpgnn_2x_budget', '150 generations (double budget)'],
                ].map(([tier, name, desc], i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-surface transition-colors">
                    <td className={`py-3 pr-6 font-medium ${
                      tier === 'Sine' ? 'text-blue-400' :
                      tier === 'CPG' ? 'text-green-400' : 'text-yellow-400'
                    }`}>{tier}</td>
                    <td className="py-3 pr-6 font-mono text-text-secondary">{name}</td>
                    <td className="py-3 text-text-dim">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 6. Credits */}
        <section className="text-center py-12">
          <p className="font-semibold text-sm uppercase tracking-widest text-text-dim mb-3">STRIDE</p>
          <p className="text-base text-text-dim">
            Simulated Terrestrial Running using Iterative Directed Evolution
          </p>
          <p className="text-sm text-text-dim mt-3">
            Dev Krishna · Optimisation Techniques · CHRIST University Pune
          </p>
          <p className="text-sm text-text-dim mt-1">
            Built with Python + pymunk + React + p2.js
          </p>
        </section>
      </div>
    </div>
  )
}
