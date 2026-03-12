import { useSimulationStore } from '@/stores/simulationStore.ts'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function ConvergenceChart() {
  const fitnessHistory = useSimulationStore((s) => s.stats.fitnessHistory)

  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary mb-1">
        CONVERGENCE
      </div>

      {fitnessHistory.length === 0 ? (
        <div className="h-[150px] flex items-center justify-center text-text-dim text-xs">
          Waiting for data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={fitnessHistory}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="gen"
              stroke="var(--color-text-dim)"
              tick={{ fill: 'var(--color-text-dim)', fontSize: 9 }}
              label={{
                value: 'Gen',
                position: 'insideBottomRight',
                offset: -2,
                fill: 'var(--color-text-dim)',
                fontSize: 9,
              }}
            />
            <YAxis
              stroke="var(--color-text-dim)"
              tick={{ fill: 'var(--color-text-dim)', fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
                fontSize: 11,
              }}
            />
            <Line
              type="monotone"
              dataKey="best"
              name="Best"
              stroke="var(--color-success)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="avg"
              name="Avg"
              stroke="var(--color-accent)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
