/**
 * useScrollTimeline — GSAP ScrollTrigger + Lenis smooth scroll integration.
 *
 * This hook is the bridge between scroll position and 3D animation.
 * It creates a Lenis smooth scroller, registers GSAP ScrollTrigger
 * pins/scrubs for each landing section, and writes animation state
 * to a mutable ref object that useFrame reads inside the R3F Canvas.
 *
 * Pattern: GSAP writes → mutable ref → useFrame reads (no React re-renders)
 *
 * SCROLL LOCK: Section 2 (wireframe human) freezes the page when it reaches
 * the viewport top. The user can rotate/zoom/pan the 3D model. Clicking
 * "Continue" triggers an exit animation (shrink + rotate + slide left),
 * then scrolls to the About section.
 */

import { useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useLandingStore } from '@/stores/landingStore.ts'

gsap.registerPlugin(ScrollTrigger)

/** Mutable scene state — GSAP writes, useFrame reads. NOT React state. */
export interface SceneState {
  // Section 1 — Hero
  heroOpacity: number
  gridOpacity: number

  // Section 2-3 — Wireframe Human
  humanScale: number
  humanX: number       // 0 = center, negative = left
  humanRotY: number
  humanOpacity: number
  jointMarkersVisible: boolean
  orbitEnabled: boolean
  /** True when a joint is being dragged — disables OrbitControls */
  isDraggingJoint: boolean

  // Section 4 — Showcase
  showcaseProgress: number  // 0-1 across Section 4
  activeChart: number       // 0-3

  // Section 5 — Cube
  cubeScale: number
  cubeExplodeProgress: number  // 0 = intact, 1 = fully exploded
  ctaVisible: boolean

  // Global
  bgColor: string
  activeSection: number
}

function createInitialState(): SceneState {
  return {
    heroOpacity: 1,
    gridOpacity: 1,
    humanScale: 0,
    humanX: 0,
    humanRotY: 0,
    humanOpacity: 1,
    jointMarkersVisible: false,
    orbitEnabled: false,
    isDraggingJoint: false,
    showcaseProgress: 0,
    activeChart: 0,
    cubeScale: 0,
    cubeExplodeProgress: 0,
    ctaVisible: false,
    bgColor: '#FAFAFA',
    activeSection: 0,
  }
}

export function useScrollTimeline() {
  const sceneStateRef = useRef<SceneState>(createInitialState())
  const lenisRef = useRef<Lenis | null>(null)
  const bgLayerRef = useRef<HTMLDivElement | null>(null)
  const unlockFnRef = useRef<(() => void) | null>(null)

  // Store actions
  const setActiveSection = useLandingStore((s) => s.setActiveSection)
  const setScrollLocked = useLandingStore((s) => s.setScrollLocked)

  const scrollToSection = useCallback((selector: string) => {
    lenisRef.current?.scrollTo(selector, { duration: 1.2 })
  }, [])

  // Stable callback for Continue button — delegates to the ref-stored function
  const unlockHumanSection = useCallback(() => {
    unlockFnRef.current?.()
  }, [])

  useEffect(() => {
    // ── Lenis setup ──
    const lenis = new Lenis({
      lerp: 0.1,
      smoothWheel: true,
    })
    lenisRef.current = lenis

    // Force scroll to top — the blocking script in index.html sets
    // scrollRestoration='manual' and calls scrollTo(0,0) before the
    // browser can restore, but we also reset Lenis here as a safeguard.
    lenis.scrollTo(0, { immediate: true })

    // DEV: expose Lenis globally for testing scroll lock
    if (import.meta.env.DEV) {
      ;(window as any).__lenis = lenis
    }

    // Connect Lenis to GSAP's ticker (named fn so we can remove during lock)
    lenis.on('scroll', ScrollTrigger.update)
    const lenisRaf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(lenisRaf)
    gsap.ticker.lagSmoothing(0)

    // Recalculate all ScrollTrigger positions now that Lenis owns scroll,
    // then force a progress update so every scrubbed timeline (including
    // ConnectSection's, which was created before Lenis existed) evaluates
    // its current progress at scroll=0.
    ScrollTrigger.refresh()
    ScrollTrigger.update()

    const ss = sceneStateRef.current

    // DEV: expose sceneState globally for debugging
    if (import.meta.env.DEV) {
      ;(window as any).__sceneState = ss
      // DEV: expose unlock function for testing navigation past scroll lock
      ;(window as any).__unlockHuman = () => unlockFnRef.current?.()
    }

    // ── Hero (footer) ──
    // Hero is now the last section. Transition global bg from dark → white
    // as the hero scrolls into view from below.
    ScrollTrigger.create({
      trigger: '#section-hero',
      start: 'top bottom',
      end: 'top 20%',
      scrub: true,
      onUpdate: (self) => {
        ss.heroOpacity = self.progress
        ss.activeSection = 6
        setActiveSection(6)

        // Dark → White bg transition (10 → 250)
        const v = Math.round(10 + self.progress * 240)
        ss.bgColor = `rgb(${v}, ${v}, ${v})`
        if (bgLayerRef.current) {
          bgLayerRef.current.style.backgroundColor = ss.bgColor
        }
      },
    })

    // ── Section 2: Wireframe Human entrance (scroll-driven) ──
    // Model scales from 0 → 1 as the section scrolls into view.
    // This trigger is KILLED when Continue is clicked to prevent
    // conflicts with the exit tween.
    const entranceTrigger = ScrollTrigger.create({
      trigger: '#section-human',
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      onUpdate: (self) => {
        ss.humanScale = self.progress
        ss.jointMarkersVisible = self.progress > 0.5
        ss.activeSection = 2
        setActiveSection(2)
      },
    })

    // ── Section 2: Scroll lock when section reaches viewport top ──
    //
    // FOUR-LAYER LOCK (nuclear approach):
    //   1. gsap.ticker.remove(lenisRaf) — disconnect Lenis from the render loop
    //      entirely, so no pending interpolation can ever fire
    //   2. lenis.stop() — mark Lenis as stopped (its wheel handler calls
    //      preventDefault on incoming wheel events)
    //   3. overflow:hidden on html+body — prevent native browser scroll
    //   4. capture-phase wheel blocker — last resort, prevents any scroll
    //      that leaks through layers 1-3. Does NOT stopPropagation so
    //      OrbitControls still receives wheel events for zoom.
    let isLocked = false
    let lockedScrollY = 0
    let isSettling = false  // guard: prevents onLeaveBack during lock setup

    // Capture-phase wheel blocker — fires before ALL other handlers
    const captureWheelBlocker = (e: WheelEvent) => {
      if (!isLocked) return
      e.preventDefault()
      // Don't stopPropagation — OrbitControls needs wheel events for zoom
    }
    document.addEventListener('wheel', captureWheelBlocker, {
      capture: true,
      passive: false,
    })

    ScrollTrigger.create({
      trigger: '#section-human',
      start: 'top top',
      onEnter: () => {
        if (isLocked || isSettling) return
        isSettling = true
        isLocked = true

        // Snap to 1px PAST the section top — landing exactly ON the
        // ScrollTrigger boundary causes a race: window.scrollTo snaps
        // back, ScrollTrigger sees a "backward" scroll, onLeaveBack
        // fires after the isSettling guard clears, and the lock undoes.
        // +1px keeps us definitively inside the trigger zone.
        const sectionEl = document.getElementById('section-human')
        lockedScrollY = (sectionEl ? sectionEl.offsetTop : window.scrollY) + 1

        // 1. IMMEDIATELY block all scroll — overflow:hidden FIRST so
        //    pending wheel events can't push the position while we set up
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'

        // 2. Disconnect Lenis from GSAP ticker — no more raf() calls
        gsap.ticker.remove(lenisRaf)

        // 3. Stop Lenis — marks internal state as stopped
        lenis.stop()

        // 4. Snap scroll to 1px past the section top
        window.scrollTo(0, lockedScrollY)

        ss.orbitEnabled = true
        ss.humanScale = 1  // ensure fully scaled
        ss.jointMarkersVisible = true  // show joint markers during interaction
        ss.activeSection = 2
        setActiveSection(2)
        setScrollLocked(true)

        // 5. Re-enforce scroll position over several frames to fight
        //    any residual Lenis interpolation or queued scroll events
        const enforcePosition = (framesLeft: number) => {
          requestAnimationFrame(() => {
            window.scrollTo(0, lockedScrollY)
            if (framesLeft > 1) enforcePosition(framesLeft - 1)
            else isSettling = false
          })
        }
        enforcePosition(6)  // enforce for 6 frames (~100ms)
      },
      onLeaveBack: () => {
        // Guard: ignore during lock settling (prevents feedback loop)
        if (isSettling) return
        if (!isLocked) return
        isLocked = false
        ss.orbitEnabled = false

        // Reconnect Lenis to GSAP ticker
        gsap.ticker.add(lenisRaf)
        lenis.start()
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        setScrollLocked(false)
      },
    })

    // ── Unlock function — called by Continue button ──
    unlockFnRef.current = () => {
      if (!isLocked) return
      isLocked = false

      // 1. Disable orbit controls (SceneController takes over camera)
      ss.orbitEnabled = false

      // 2. Kill entrance trigger to prevent it fighting the exit tween
      entranceTrigger.kill()

      // 3. Hide Continue button immediately
      setScrollLocked(false)

      // 4. Animate model: shrink slightly, rotate, slide left
      const tl = gsap.timeline()

      tl.to(ss, {
        humanScale: 0.8,
        humanRotY: 0.35,
        humanX: -0.1,
        humanOpacity: 0.6,
        duration: 1.2,
        ease: 'power2.inOut',
      })

      // 5. At 0.6s, reconnect Lenis and unlock scroll
      tl.call(
        () => {
          document.documentElement.style.overflow = ''
          document.body.style.overflow = ''
          gsap.ticker.add(lenisRaf)
          lenis.start()
        },
        [],
        0.6,
      )

      // 6. At 0.8s, scroll to About section
      tl.call(
        () => {
          lenis.scrollTo('#section-about', { duration: 1.2 })
        },
        [],
        0.8,
      )
    }

    // ── Section 3: About — track active section + reverse exit animation ──
    // Model position (humanX, humanRotY, humanScale) is set by the exit tween above.
    // onLeaveBack restores model to Section 2 interactive state when scrolling up.
    ScrollTrigger.create({
      trigger: '#section-about',
      start: 'top 60%',
      end: 'bottom 40%',
      onEnter: () => {
        ss.activeSection = 3
        setActiveSection(3)
      },
      onEnterBack: () => {
        ss.activeSection = 3
        setActiveSection(3)
        // Returning from Section 4 — restore exit-tween values
        gsap.to(ss, {
          humanScale: 0.8,
          humanX: -0.1,
          humanRotY: 0.35,
          humanOpacity: 0.6,
          duration: 0.5,
          ease: 'power2.out',
        })
        ss.jointMarkersVisible = true
      },
      onLeaveBack: () => {
        // Scrolling back up into Section 2 — tween model to interactive position
        gsap.to(ss, {
          humanScale: 1,
          humanX: 0,
          humanRotY: 0,
          humanOpacity: 1,
          duration: 0.6,
          ease: 'power2.out',
        })
        ss.jointMarkersVisible = true
        ss.activeSection = 2
        setActiveSection(2)
      },
    })

    // ── Section 4: Showcase — fade out human + hide joint markers ──
    // humanOpacity starts at 0.6 (set by exit tween) and fades to 0.
    ScrollTrigger.create({
      trigger: '#section-showcase',
      start: 'top bottom',
      end: 'top 50%',
      scrub: true,
      onUpdate: (self) => {
        ss.humanOpacity = 0.6 * (1 - self.progress)
        // Hide joint markers once the model has faded significantly
        ss.jointMarkersVisible = self.progress < 0.3
      },
    })

    ScrollTrigger.create({
      trigger: '#section-showcase',
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        ss.showcaseProgress = self.progress
        ss.activeChart = Math.min(3, Math.floor(self.progress * 4))
        ss.activeSection = 4
        setActiveSection(4)
      },
    })

    // ── Section 5: Cube explosion ──
    ScrollTrigger.create({
      trigger: '#section-cube',
      start: 'top bottom',
      end: 'top 30%',
      scrub: true,
      onUpdate: (self) => {
        ss.cubeScale = self.progress
      },
    })

    ScrollTrigger.create({
      trigger: '#section-cube',
      start: 'top 30%',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        ss.cubeExplodeProgress = self.progress
        ss.ctaVisible = self.progress > 0.7
        ss.activeSection = 5
        setActiveSection(5)
      },
    })

    // ── Connect (opener — Section 1) ──
    // Connect is now the first section. Its own bg div handles the light
    // background, so no global bg transition is needed here. Just track
    // activeSection so the camera stays in the default position.
    ScrollTrigger.create({
      trigger: '#section-connect',
      start: 'top top',
      end: 'bottom top',
      onEnter: () => {
        ss.activeSection = 1
        setActiveSection(1)
      },
      onEnterBack: () => {
        ss.activeSection = 1
        setActiveSection(1)
      },
    })

    // Cleanup
    return () => {
      lenis.destroy()
      ScrollTrigger.getAll().forEach((t) => t.kill())
      gsap.ticker.remove(lenisRaf)
      document.removeEventListener('wheel', captureWheelBlocker, { capture: true })
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [setActiveSection, setScrollLocked])

  return {
    sceneStateRef,
    bgLayerRef,
    lenisRef,
    scrollToSection,
    unlockHumanSection,
  }
}
