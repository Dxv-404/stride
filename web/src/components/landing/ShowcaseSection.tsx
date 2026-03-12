/**
 * ShowcaseSection — Section 4 HTML overlay: TV + Charts.
 *
 * Dark background section. A CSS retro TV frame houses a chart carousel
 * that cycles through 4 mini visualisation previews based on scroll
 * progress. Right side has descriptive text for each chart.
 *
 * The active chart index is driven by sceneState.activeChart.
 */

import ChartCarousel from './ChartCarousel.tsx'
import type { SceneState } from './useScrollTimeline.ts'
import { useRef, useState, useCallback } from 'react'

interface ShowcaseSectionProps {
  sceneStateRef: React.RefObject<SceneState>
}

export default function ShowcaseSection({ sceneStateRef }: ShowcaseSectionProps) {
  const [activeChart, setActiveChart] = useState(0)
  const lastChart = useRef(0)

  const manualOverride = useRef(false)
  const overrideTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Sync activeChart from sceneState (set by scroll progress)
  // Manual dot clicks override scroll for 3 seconds
  const currentChart = sceneStateRef.current?.activeChart ?? 0
  if (!manualOverride.current && currentChart !== lastChart.current) {
    lastChart.current = currentChart
    if (currentChart !== activeChart) {
      setActiveChart(currentChart)
    }
  }

  const handleChartSelect = useCallback((index: number) => {
    setActiveChart(index)
    // Override scroll-driven updates for 3s so the click sticks
    manualOverride.current = true
    clearTimeout(overrideTimeout.current)
    overrideTimeout.current = setTimeout(() => {
      manualOverride.current = false
    }, 3000)
  }, [])

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: '100vh',
        padding: '4rem 2rem',
      }}
    >
      {/* Section label */}
      <div className="mb-12 text-center">
        <p
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'rgba(231, 231, 231, 0.3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}
        >
          Data Visualisations
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)',
            fontWeight: 400,
            color: '#E7E7E7',
            letterSpacing: '0.1em',
          }}
        >
          INSIDE THE LAB
        </h2>
      </div>

      {/* Chart carousel with TV frame */}
      <ChartCarousel activeChart={activeChart} onChartSelect={handleChartSelect} />
    </div>
  )
}
