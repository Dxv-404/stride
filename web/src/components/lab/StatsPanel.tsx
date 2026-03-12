import { useSimulationStore } from '@/stores/simulationStore.ts'

interface StatCardProps {
  label: string
  value: string
  colorClass: string
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="bg-bg-surface border border-border p-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary uppercase">
        {label}
      </div>
      <div className={`font-mono text-lg ${colorClass}`}>
        {value}
      </div>
    </div>
  )
}

export default function StatsPanel() {
  const stats = useSimulationStore((s) => s.stats)
  const hasData = stats.generation > 0

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard
        label="Generation"
        value={hasData ? String(stats.generation) : '--'}
        colorClass="text-accent"
      />
      <StatCard
        label="Best Fitness"
        value={hasData ? stats.bestFitness.toFixed(1) : '--'}
        colorClass="text-fitness-high"
      />
      <StatCard
        label="Avg Fitness"
        value={hasData ? stats.avgFitness.toFixed(1) : '--'}
        colorClass="text-fitness-mid"
      />
      <StatCard
        label="Diversity"
        value={hasData ? stats.diversity.toFixed(3) : '--'}
        colorClass="text-accent"
      />
    </div>
  )
}
