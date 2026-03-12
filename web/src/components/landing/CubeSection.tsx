/**
 * CubeSection — Section 5 HTML overlay: "ENTER THE LAB" CTA.
 *
 * This component overlays the 3D CubeExplosion scene. Once the cube
 * has mostly exploded (cubeExplodeProgress > 0.7), the ctaVisible
 * flag is set in sceneState and this component renders the CTA button.
 *
 * Because ctaVisible lives in a mutable ref (no React re-render),
 * we poll it via requestAnimationFrame to sync with React state.
 */

import { useState, useEffect, useRef } from 'react'
import type { SceneState } from './useScrollTimeline.ts'

interface CubeSectionProps {
  sceneStateRef: React.RefObject<SceneState>
  onEnterLab: () => void
}

export default function CubeSection({ sceneStateRef, onEnterLab }: CubeSectionProps) {
  const [ctaVisible, setCtaVisible] = useState(false)
  const rafRef = useRef(0)

  // Poll sceneState.ctaVisible via RAF — bridges mutable ref → React state
  useEffect(() => {
    function tick() {
      const visible = sceneStateRef.current?.ctaVisible ?? false
      setCtaVisible((prev) => (prev !== visible ? visible : prev))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [sceneStateRef])

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: '100vh',
        pointerEvents: 'none',
        position: 'relative',
      }}
    >
      {/* Section title — always visible when in section */}
      <div
        className="text-center mb-8"
        style={{
          opacity: ctaVisible ? 0 : 0.6,
          transition: 'opacity 600ms ease',
          pointerEvents: 'none',
        }}
      >
        <p
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'rgba(231, 231, 231, 0.3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          The Gateway
        </p>
      </div>

      {/* CTA Button — fades in after explosion */}
      <div
        style={{
          opacity: ctaVisible ? 1 : 0,
          transform: ctaVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 800ms ease, transform 800ms ease',
          pointerEvents: ctaVisible ? 'auto' : 'none',
        }}
      >
        <button
          onClick={onEnterLab}
          className="group"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1rem, 2vw, 1.4rem)',
            letterSpacing: '0.2em',
            color: '#E7E7E7',
            background: 'none',
            border: '1px solid rgba(196, 149, 106, 0.5)',
            padding: '1rem 3rem',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'border-color 300ms ease, color 300ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#C4956A'
            e.currentTarget.style.color = '#C4956A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(196, 149, 106, 0.5)'
            e.currentTarget.style.color = '#E7E7E7'
          }}
        >
          ENTER THE LAB
        </button>

        {/* Subtitle under CTA */}
        <p
          className="font-mono text-center mt-4"
          style={{
            fontSize: '0.6rem',
            color: 'rgba(231, 231, 231, 0.25)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Explore the simulation environment
        </p>
      </div>
    </div>
  )
}
