/**
 * ChartCarousel — Cycles through 4 mini visualisation previews.
 *
 * Each chart is a simplified SVG representation for the landing page,
 * avoiding the need for full data pipelines. These are static previews
 * that communicate the type of analysis available in the lab.
 *
 * Active chart is driven by scroll progress (sceneState.activeChart).
 */

interface ChartCarouselProps {
  activeChart: number  // 0-3
  onChartSelect?: (index: number) => void
}

const CHARTS = [
  {
    title: 'CONVERGENCE',
    subtitle: 'Fitness improvement over generations',
    description:
      'Watch how the population\'s best fitness climbs from random noise toward coordinated walking. The gap between best and average fitness reveals the genetic diversity.',
  },
  {
    title: 'BEHAVIORAL RADAR',
    subtitle: 'Multi-axis performance comparison',
    description:
      'Compare walking styles across controller types: sine waves, central pattern generators, and neural networks. Each axis measures a different gait quality.',
  },
  {
    title: 'POPULATION DIVERSITY',
    subtitle: 'Genetic spread in parameter space',
    description:
      'See how creatures cluster and spread in gene space. Early generations scatter randomly; later generations converge toward high-fitness regions.',
  },
  {
    title: 'FITNESS LANDSCAPE',
    subtitle: '3D surface of the search space',
    description:
      'Explore the rugged terrain of gene space. Peaks represent good walking solutions. The GA must navigate valleys and ridges to find the global optimum.',
  },
]

export default function ChartCarousel({ activeChart, onChartSelect }: ChartCarouselProps) {
  const chart = CHARTS[activeChart] ?? CHARTS[0]

  return (
    <div className="flex flex-col md:flex-row gap-8 items-center">
      {/* CSS Retro TV frame */}
      <div
        style={{
          width: 'min(420px, 80vw)',
          aspectRatio: '4 / 3',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          padding: '16px',
          border: '3px solid #2a2a2a',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Screen area */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0f0f0f',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Mini chart SVG previews */}
          <div
            className="flex items-center justify-center"
            style={{ width: '100%', height: '100%', padding: '20px' }}
          >
            {activeChart === 0 && <ConvergencePreview />}
            {activeChart === 1 && <RadarPreview />}
            {activeChart === 2 && <SwarmPreview />}
            {activeChart === 3 && <LandscapePreview />}
          </div>

          {/* Scanline overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
              pointerEvents: 'none',
            }}
          />

          {/* Chart label */}
          <div
            className="font-mono absolute top-3 left-3"
            style={{
              fontSize: '0.55rem',
              color: 'rgba(196, 149, 106, 0.6)',
              letterSpacing: '0.1em',
            }}
          >
            {chart.title}
          </div>
        </div>

        {/* TV knobs */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            right: '20px',
            display: 'flex',
            gap: '8px',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#333' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#333' }} />
        </div>
      </div>

      {/* Chart description */}
      <div className="max-w-xs">
        <p
          className="font-mono"
          style={{
            fontSize: '0.6rem',
            color: 'rgba(231, 231, 231, 0.35)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          {chart.subtitle}
        </p>
        <p
          style={{
            fontSize: '0.85rem',
            lineHeight: 1.7,
            color: 'rgba(231, 231, 231, 0.65)',
          }}
        >
          {chart.description}
        </p>

        {/* Chart indicator dots — clickable */}
        <div className="flex gap-3 mt-4">
          {CHARTS.map((_, i) => (
            <button
              key={i}
              onClick={() => onChartSelect?.(i)}
              aria-label={`View chart ${i + 1}: ${CHARTS[i].title}`}
              style={{
                width: i === activeChart ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === activeChart ? '#C4956A' : '#333',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 300ms ease',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Realistic SVG Chart Previews ─── */
/* Styled to match the actual viz components in components/viz/ and components/lab/ */

function ConvergencePreview() {
  // Realistic GA convergence: fast initial gain, stochastic plateau, occasional jumps
  const N = 50
  const points = Array.from({ length: N }, (_, i) => {
    const t = i / (N - 1)
    const x = 40 + t * 250
    // Best fitness: rapid initial climb + diminishing returns + stochastic jumps
    const base = 170 - (1 - Math.exp(-i * 0.15)) * 140
    const jump = i > 20 && i < 25 ? -15 : i > 35 && i < 38 ? -8 : 0
    const noise = Math.sin(i * 1.7) * 2 + Math.cos(i * 0.9) * 1.5
    const best = Math.max(25, base + jump + noise)
    // Average: trails best by ~30%, more noisy
    const avg = Math.min(170, best + 25 + Math.sin(i * 0.6) * 8 + (1 - t) * 15)
    // Worst: trails average
    const worst = Math.min(175, avg + 10 + (1 - t) * 20)
    return { x, best, avg, worst }
  })

  return (
    <svg viewBox="0 0 320 200" width="100%" height="100%">
      {/* Y axis grid + labels */}
      {[0, 1, 2, 3, 4].map((i) => {
        const y = 20 + i * 38
        return (
          <g key={i}>
            <line x1="40" y1={y} x2="295" y2={y} stroke="#1a1a1a" strokeDasharray="2 3" />
            <text x="36" y={y + 3} textAnchor="end" fill="#444" fontSize="7" fontFamily="monospace">
              {Math.round(200 - i * 40)}
            </text>
          </g>
        )
      })}
      {/* X axis labels */}
      {[0, 10, 20, 30, 40, 50].map((gen) => (
        <text key={gen} x={40 + (gen / 50) * 250} y="192" textAnchor="middle" fill="#444" fontSize="7" fontFamily="monospace">
          {gen}
        </text>
      ))}
      <text x="170" y="199" textAnchor="middle" fill="#555" fontSize="6" fontFamily="monospace">Generation</text>
      {/* Worst fill area */}
      <polygon
        points={[
          ...points.map((p) => `${p.x},${p.worst}`),
          ...points.slice().reverse().map((p) => `${p.x},${p.best}`),
        ].join(' ')}
        fill="rgba(196, 149, 106, 0.06)"
      />
      {/* Avg-to-best fill area */}
      <polygon
        points={[
          ...points.map((p) => `${p.x},${p.avg}`),
          ...points.slice().reverse().map((p) => `${p.x},${p.best}`),
        ].join(' ')}
        fill="rgba(107, 191, 89, 0.08)"
      />
      {/* Worst line */}
      <polyline points={points.map((p) => `${p.x},${p.worst}`).join(' ')} fill="none" stroke="#C4956A" strokeWidth="1" opacity={0.3} strokeDasharray="2 2" />
      {/* Average line */}
      <polyline points={points.map((p) => `${p.x},${p.avg}`).join(' ')} fill="none" stroke="#C4956A" strokeWidth="1.2" opacity={0.6} />
      {/* Best line */}
      <polyline points={points.map((p) => `${p.x},${p.best}`).join(' ')} fill="none" stroke="#6BBF59" strokeWidth="2" />
      {/* Legend */}
      <line x1="200" y1="12" x2="215" y2="12" stroke="#6BBF59" strokeWidth="2" />
      <text x="218" y="14" fill="#6BBF59" fontSize="6.5" fontFamily="monospace">Best</text>
      <line x1="240" y1="12" x2="255" y2="12" stroke="#C4956A" strokeWidth="1.2" />
      <text x="258" y="14" fill="#C4956A" fontSize="6.5" fontFamily="monospace">Avg</text>
    </svg>
  )
}

function RadarPreview() {
  // Matches BehavioralRadar: 5 axes, 3 controller overlays (sine, cpg, cpg+nn)
  const AXES = ['Distance', 'Speed', 'Efficiency', 'Stability', 'Symmetry']
  const center = { x: 160, y: 95 }
  const radius = 72

  const getPoint = (axis: number, value: number) => {
    const angle = ((Math.PI * 2) / 5) * axis - Math.PI / 2
    return {
      x: center.x + Math.cos(angle) * radius * value,
      y: center.y + Math.sin(angle) * radius * value,
    }
  }

  // Realistic controller profiles
  const sine   = [0.55, 0.45, 0.70, 0.40, 0.85]  // good symmetry, moderate speed
  const cpg    = [0.72, 0.68, 0.60, 0.75, 0.70]   // balanced
  const cpgnn  = [0.90, 0.85, 0.55, 0.80, 0.60]   // best distance/speed, lower efficiency

  const controllers = [
    { data: sine,  color: '#3B82F6', label: 'Sine' },
    { data: cpg,   color: '#10B981', label: 'CPG' },
    { data: cpgnn, color: '#F59E0B', label: 'CPG+NN' },
  ]

  return (
    <svg viewBox="0 0 320 200" width="100%" height="100%">
      {/* Grid pentagons */}
      {[0.25, 0.5, 0.75, 1.0].map((scale) => (
        <polygon
          key={scale}
          points={Array.from({ length: 5 }, (_, i) => getPoint(i, scale))
            .map((p) => `${p.x},${p.y}`)
            .join(' ')}
          fill="none"
          stroke="#222"
          strokeWidth="0.5"
        />
      ))}
      {/* Axis spokes */}
      {AXES.map((_, i) => {
        const end = getPoint(i, 1)
        return <line key={i} x1={center.x} y1={center.y} x2={end.x} y2={end.y} stroke="#222" strokeWidth="0.5" opacity={0.6} />
      })}
      {/* Data polygons */}
      {controllers.map(({ data, color }) => (
        <polygon
          key={color}
          points={data.map((v, i) => getPoint(i, v)).map((p) => `${p.x},${p.y}`).join(' ')}
          fill={color}
          fillOpacity={0.1}
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity={0.8}
        />
      ))}
      {/* Data points */}
      {controllers.map(({ data, color }) =>
        data.map((v, i) => {
          const p = getPoint(i, v)
          return <circle key={`${color}-${i}`} cx={p.x} cy={p.y} r={2.5} fill={color} opacity={0.9} />
        }),
      )}
      {/* Axis labels */}
      {AXES.map((label, i) => {
        const p = getPoint(i, 1.2)
        return (
          <text key={label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="#666" fontSize="6.5" fontFamily="monospace">
            {label}
          </text>
        )
      })}
      {/* Legend */}
      {controllers.map(({ color, label }, i) => (
        <g key={label}>
          <rect x={10 + i * 65} y="184" width="8" height="8" rx="1" fill={color} opacity={0.8} />
          <text x={21 + i * 65} y="191" fill="#777" fontSize="6.5" fontFamily="monospace">{label}</text>
        </g>
      ))}
    </svg>
  )
}

function SwarmPreview() {
  // Deterministic seed-based scatter — shows GA population clustering
  // Uses sine-based pseudo-random for consistent renders
  const seed = (n: number) => ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1

  // 3 clusters simulating converged GA subpopulations
  const clusters = [
    { cx: 200, cy: 60, spread: 35, count: 18, color: '#10B981' },  // high-fitness cluster
    { cx: 110, cy: 110, spread: 40, count: 14, color: '#3B82F6' }, // mid-fitness
    { cx: 240, cy: 140, spread: 25, count: 8, color: '#C4956A' },  // exploring
  ]

  const allPoints: { x: number; y: number; r: number; color: string; isBest: boolean }[] = []
  let idx = 0
  for (const cl of clusters) {
    for (let j = 0; j < cl.count; j++) {
      const angle = seed(idx) * Math.PI * 2
      const dist = seed(idx + 100) * cl.spread
      allPoints.push({
        x: Math.max(25, Math.min(295, cl.cx + Math.cos(angle) * dist)),
        y: Math.max(15, Math.min(180, cl.cy + Math.sin(angle) * dist)),
        r: 2 + seed(idx + 200) * 1.5,
        color: cl.color,
        isBest: idx === 3, // best individual in high-fitness cluster
      })
      idx++
    }
  }

  return (
    <svg viewBox="0 0 320 200" width="100%" height="100%">
      {/* Axes */}
      <line x1="25" y1="185" x2="300" y2="185" stroke="#222" strokeWidth="0.5" />
      <line x1="25" y1="10" x2="25" y2="185" stroke="#222" strokeWidth="0.5" />
      <text x="160" y="197" textAnchor="middle" fill="#444" fontSize="6.5" fontFamily="monospace">Gene Similarity (PCA)</text>
      <text x="8" y="100" textAnchor="middle" fill="#444" fontSize="6.5" fontFamily="monospace" transform="rotate(-90, 8, 100)">Fitness</text>
      {/* Grid */}
      {[45, 90, 135].map((y) => (
        <line key={y} x1="25" y1={y} x2="300" y2={y} stroke="#1a1a1a" strokeDasharray="2 3" />
      ))}
      {/* Points */}
      {allPoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.isBest ? 5 : p.r}
          fill={p.isBest ? '#F59E0B' : p.color}
          opacity={p.isBest ? 1 : 0.6}
          stroke={p.isBest ? '#F59E0B' : 'none'}
          strokeWidth={p.isBest ? 1.5 : 0}
        />
      ))}
      {/* Best marker ring */}
      {allPoints.filter((p) => p.isBest).map((p, i) => (
        <circle key={`best-${i}`} cx={p.x} cy={p.y} r={8} fill="none" stroke="#F59E0B" strokeWidth="1" opacity={0.4} />
      ))}
    </svg>
  )
}

function LandscapePreview() {
  // Multi-peak fitness landscape with valleys — matches FitnessLandscape3D style
  const rows = 12
  const cols = 16

  const heightAt = (r: number, c: number) => {
    // Two peaks + saddle point for realistic rugged landscape
    const peak1 = Math.exp(-((c - 5) ** 2 + (r - 4) ** 2) / 6) * 55
    const peak2 = Math.exp(-((c - 11) ** 2 + (r - 7) ** 2) / 4) * 45
    const ridge = Math.exp(-((c - 8) ** 2) / 12) * 20
    return peak1 + peak2 + ridge * 0.4
  }

  // Row lines (horizontal wireframe)
  const rowLines: string[] = []
  for (let r = 0; r < rows; r++) {
    let path = ''
    for (let c = 0; c < cols; c++) {
      const x = 20 + (c / (cols - 1)) * 280
      const baseY = 130 + r * 5 - c * 2
      const y = baseY - heightAt(r, c)
      path += `${c === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }
    rowLines.push(path)
  }

  // Column lines (depth wireframe)
  const colLines: string[] = []
  for (let c = 0; c < cols; c++) {
    let path = ''
    for (let r = 0; r < rows; r++) {
      const x = 20 + (c / (cols - 1)) * 280
      const baseY = 130 + r * 5 - c * 2
      const y = baseY - heightAt(r, c)
      path += `${r === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }
    colLines.push(path)
  }

  return (
    <svg viewBox="0 0 320 200" width="100%" height="100%">
      {/* Row lines — warm gradient */}
      {rowLines.map((d, i) => (
        <path key={`r${i}`} d={d} fill="none" stroke="#C4956A" strokeWidth="0.8" opacity={0.25 + (i / rows) * 0.5} />
      ))}
      {/* Column lines — cooler, thinner */}
      {colLines.map((d, i) => (
        <path key={`c${i}`} d={d} fill="none" stroke="#8899AA" strokeWidth="0.5" opacity={0.15 + (i / cols) * 0.3} />
      ))}
      {/* Peak markers */}
      <circle cx={115} cy={73} r={3} fill="none" stroke="#6BBF59" strokeWidth="1" opacity={0.7} />
      <circle cx={220} cy={78} r={2.5} fill="none" stroke="#F59E0B" strokeWidth="1" opacity={0.6} />
      {/* Labels */}
      <text x="290" y="195" textAnchor="end" fill="#444" fontSize="6" fontFamily="monospace">Gene A →</text>
      <text x="10" y="140" fill="#444" fontSize="6" fontFamily="monospace" transform="rotate(-90, 10, 140)">Gene B →</text>
    </svg>
  )
}
