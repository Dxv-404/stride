/**
 * Landing page — Multi-section scrollytelling experience.
 *
 * Architecture: Fixed R3F Canvas (z-0) + Background layer (z-[-1]) +
 * HTML scroll overlay (z-20) + ThemeToggle (z-30) + Preloader (z-50).
 *
 * GSAP ScrollTrigger maps scroll position → mutable refs.
 * useFrame inside ScrollCanvas reads refs to animate 3D objects.
 * Lenis provides smooth scroll.
 *
 * Section 2 (wireframe human) uses scroll-lock: the page freezes when
 * the section reaches the viewport top. Clicking "Continue" triggers an
 * exit animation and resumes scrolling to the About section.
 *
 * Renders OUTSIDE the Layout (no sidebar/header).
 */

import { useEffect } from 'react'
import ThemeToggle from '@/components/shared/ThemeToggle.tsx'
import ScrollCanvas from '@/components/landing/ScrollCanvas.tsx'
import ScrollOverlay from '@/components/landing/ScrollOverlay.tsx'
import Preloader from '@/components/landing/Preloader.tsx'
import { useScrollTimeline } from '@/components/landing/useScrollTimeline.ts'
import { usePreloader } from '@/components/landing/usePreloader.ts'
import { useLandingStore } from '@/stores/landingStore.ts'

export default function Landing() {
  const { sceneStateRef, bgLayerRef, unlockHumanSection } = useScrollTimeline()
  const { progress, ready } = usePreloader()
  const setLoaded = useLandingStore((s) => s.setLoaded)

  // Sync preloader state to store
  useEffect(() => {
    if (ready) setLoaded(true)
  }, [ready, setLoaded])

  return (
    <div className="relative">
      {/* Background colour layer — z-[-1], position fixed */}
      <div
        ref={bgLayerRef}
        className="no-transition"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          backgroundColor: '#0A0A0A',
        }}
      />

      {/* 3D Canvas — z-0, position fixed, transparent */}
      <ScrollCanvas sceneStateRef={sceneStateRef} />

      {/* HTML scroll sections — z-20, position relative */}
      <ScrollOverlay
        sceneStateRef={sceneStateRef}
        onContinueHuman={unlockHumanSection}
      />

      {/* Theme toggle — z-30, position fixed, top-right */}
      <div className="fixed top-6 right-6" style={{ zIndex: 30 }}>
        <ThemeToggle />
      </div>

      {/* Preloader — z-50, covers everything until assets load */}
      <Preloader progress={progress} ready={ready} />
    </div>
  )
}
