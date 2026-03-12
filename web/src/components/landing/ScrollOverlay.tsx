/**
 * ScrollOverlay — HTML scroll container for all landing page sections.
 *
 * This component sits at z-index 20, scrolls normally with the page,
 * and contains all text, buttons, charts, and UI elements. The 3D
 * canvas (ScrollCanvas) sits behind at z-index 0.
 *
 * Each section div has an ID for GSAP ScrollTrigger targeting.
 */

import { useNavigate } from 'react-router-dom'
import type { SceneState } from './useScrollTimeline.ts'
import { useLandingStore } from '@/stores/landingStore.ts'
import HeroSection from './HeroSection.tsx'
import HumanSection from './HumanSection.tsx'
import AboutSection from './AboutSection.tsx'
import ShowcaseSection from './ShowcaseSection.tsx'
import CubeSection from './CubeSection.tsx'
import ConnectSection from './ConnectSection.tsx'

interface ScrollOverlayProps {
  sceneStateRef: React.RefObject<SceneState>
  onContinueHuman: () => void
}

export default function ScrollOverlay({
  sceneStateRef,
  onContinueHuman,
}: ScrollOverlayProps) {
  const navigate = useNavigate()
  const scrollLocked = useLandingStore((s) => s.scrollLocked)

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 20,
        /* Wrapper is pointer-transparent so that Section 2 (wireframe human)
           can pass mouse events through to the R3F Canvas underneath (z-0).
           Each section that needs clicks explicitly opts in with pointerEvents: 'auto'. */
        pointerEvents: 'none',
      }}
    >
      {/* Section 1: Connect — Creation of Adam opener */}
      <section
        id="section-connect"
        className="landing-section"
        style={{ minHeight: '250vh', pointerEvents: 'auto' }}
      >
        <ConnectSection />
      </section>

      {/* Section 2: Wireframe Human (100vh — locks scroll at top) */}
      {/* pointerEvents stays 'none' (inherited from wrapper) so drag/rotate/zoom
          events pass through to the R3F Canvas. Interactive children (buttons,
          tooltips) re-enable with their own pointerEvents: 'auto'. */}
      <section
        id="section-human"
        className="landing-section"
        style={{ minHeight: '100vh' }}
      >
        <HumanSection onContinue={onContinueHuman} />
      </section>

      {/* Section 3: About Split
       *  pointerEvents disabled during scroll lock so clicks pass through
       *  to the R3F canvas for joint interaction in Section 2. */}
      <section
        id="section-about"
        className="landing-section"
        style={{
          minHeight: '100vh',
          pointerEvents: scrollLocked ? 'none' : 'auto',
          opacity: scrollLocked ? 0 : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        <AboutSection />
      </section>

      {/* Section 4: TV + Charts Showcase */}
      <section
        id="section-showcase"
        className="landing-section"
        style={{ minHeight: '200vh', pointerEvents: 'auto' }}
      >
        <ShowcaseSection sceneStateRef={sceneStateRef} />
      </section>

      {/* Section 5: Cube Explosion */}
      <section
        id="section-cube"
        className="landing-section flex items-center justify-center"
        style={{ minHeight: '150vh', pointerEvents: 'auto' }}
      >
        <CubeSection
          sceneStateRef={sceneStateRef}
          onEnterLab={() => navigate('/lab')}
        />
      </section>

      {/* Section 6: Hero — footer */}
      <section
        id="section-hero"
        className="landing-section"
        style={{ minHeight: '100vh', pointerEvents: 'auto' }}
      >
        <HeroSection />
      </section>
    </div>
  )
}
