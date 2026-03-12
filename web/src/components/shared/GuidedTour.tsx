/**
 * GuidedTour — First-visit onboarding overlay.
 *
 * 5-step tour: Sidebar → Lab → Push Test → Playground → Results.
 * Uses a spotlight + tooltip pattern. Stores completion in localStorage.
 */

import { useState, useCallback, useEffect } from 'react'

const TOUR_KEY = 'stride-tour-completed'

interface TourStep {
  title: string
  description: string
  target: string // CSS selector (for reference, but we position manually)
  position: { top: string; left: string }
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Navigation Sidebar',
    description: 'Access all pages from here — Lab, Push Test, Playground, Results, and more.',
    target: 'aside',
    position: { top: '50%', left: '80px' },
  },
  {
    title: 'Evolution Lab',
    description: 'Configure genetic algorithm parameters and watch creatures evolve in real-time.',
    target: '[data-page="lab"]',
    position: { top: '30%', left: '50%' },
  },
  {
    title: 'Push Test',
    description: 'Test evolved creatures against physical perturbations. See how robust they are!',
    target: '[data-page="push-test"]',
    position: { top: '40%', left: '50%' },
  },
  {
    title: 'Gene Playground',
    description: 'Manually tweak every gene and watch the creature respond. Save and share your creations.',
    target: '[data-page="playground"]',
    position: { top: '50%', left: '50%' },
  },
  {
    title: 'Results Dashboard',
    description: 'Explore pre-computed data from 510 simulation runs with interactive charts and 3D visualizations.',
    target: '[data-page="results"]',
    position: { top: '60%', left: '50%' },
  },
]

export function useTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'true'
  } catch {
    return true // If localStorage is unavailable, skip tour
  }
}

export default function GuidedTour({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)

  const handleNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }, [step])

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, 'true')
    } catch { /* noop */ }
    setVisible(false)
    onComplete?.()
  }, [onComplete])

  const handleSkip = useCallback(() => {
    handleComplete()
  }, [handleComplete])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
      if (e.key === 'Enter' || e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSkip, handleNext])

  if (!visible) return null

  const currentStep = TOUR_STEPS[step]

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay backdrop */}
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={handleSkip} />

      {/* Tooltip */}
      <div
        className="absolute z-10 max-w-sm border border-accent bg-bg-surface shadow-lg"
        style={{
          top: currentStep.position.top,
          left: currentStep.position.left,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Step indicator */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-[10px] font-medium uppercase tracking-wider text-accent">
            Step {step + 1} of {TOUR_STEPS.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-[10px] text-text-dim hover:text-text cursor-pointer"
          >
            Skip Tour
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-primary mb-1">
            {currentStep.title}
          </h3>
          <p className="font-mono text-[11px] text-text-dim leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? 'bg-accent' : i < step ? 'bg-accent/40' : 'bg-border'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="text-[10px] font-medium uppercase tracking-wider px-4 py-1
                       bg-accent text-bg hover:bg-accent/80 transition-colors cursor-pointer"
          >
            {step < TOUR_STEPS.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  )
}
