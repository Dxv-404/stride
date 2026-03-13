/**
 * ConnectSection — Opening section with intro animation + Creation of Adam.
 *
 * On mount, "STRIDE" cycles through 8 Indian regional scripts with a
 * synced 00→100 counter. After one cycle the intro fades, revealing a
 * wireframe-mesh scroll indicator. Scrolling triggers the hands animation.
 */

import { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ── STRIDE transliterated across Indian regional scripts (single cycle) ── */
const STRIDE_LANGS = [
  'STRIDE',     // English
  'स्ट्राइड',    // Hindi (Devanagari)
  'স্ট্রাইড',    // Bengali
  'ஸ்ட்ரைட்',   // Tamil
  'స్ట్రైడ్',    // Telugu
  'ಸ್ಟ್ರೈಡ್',    // Kannada
  'സ്ട്രൈഡ്',   // Malayalam
  'સ્ટ્રાઈડ',    // Gujarati
  'STRIDE',     // Back to English
]

const CYCLE_MS = 400    // ms per language step
const TOTAL_MS = STRIDE_LANGS.length * CYCLE_MS // ~3600ms
const FADE_PAUSE = 400  // ms pause after last language
const FADE_MS = 600     // ms for the fade-out transition

export default function ConnectSection() {
  /* ── Refs ── */
  const containerRef = useRef<HTMLDivElement>(null)
  const bgRef = useRef<HTMLDivElement>(null)
  const robotHandRef = useRef<HTMLDivElement>(null)
  const humanHandRef = useRef<HTMLDivElement>(null)
  const strideTextRef = useRef<HTMLDivElement>(null)
  const buttonsRef = useRef<HTMLDivElement>(null)
  const creditRef = useRef<HTMLDivElement>(null)
  const scrollHintRef = useRef<HTMLDivElement>(null)

  /* ── Intro state ── */
  const [introPhase, setIntroPhase] = useState<'cycling' | 'fading' | 'done'>(
    'cycling',
  )
  const [langIndex, setLangIndex] = useState(0)
  const [counter, setCounter] = useState(0)

  /* ── Intro: language cycling + counter (rAF-driven, single cycle) ── */
  useEffect(() => {
    if (introPhase !== 'cycling') return

    const start = performance.now()
    let rafId: number

    const tick = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / TOTAL_MS, 1)

      setCounter(Math.floor(progress * 100))
      setLangIndex(
        Math.min(
          Math.floor(elapsed / CYCLE_MS),
          STRIDE_LANGS.length - 1,
        ),
      )

      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        // Cycling complete → short pause → begin fade
        setTimeout(() => setIntroPhase('fading'), FADE_PAUSE)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [introPhase])

  /* ── Intro: remove overlay after fade-out transition ends ── */
  useEffect(() => {
    if (introPhase !== 'fading') return
    const timer = setTimeout(() => setIntroPhase('done'), FADE_MS)
    return () => clearTimeout(timer)
  }, [introPhase])

  /* ── GSAP ScrollTrigger animations (hands, text, buttons) ── */
  useEffect(() => {
    const sectionEl =
      containerRef.current?.closest('#section-connect') ??
      document.getElementById('section-connect')

    const ctx = gsap.context(() => {
      // Background fade: transparent → #f7f7f7
      gsap.fromTo(
        bgRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 80%',
            end: 'top 20%',
            scrub: true,
          },
        },
      )

      // ── Explicitly set initial hand positions ──
      // gsap.set() locks in the off-screen transforms BEFORE the timeline
      // is created. This guarantees a known starting state regardless of
      // mount order, Lenis init timing, or ScrollTrigger.refresh() calls.
      if (robotHandRef.current) {
        gsap.set(robotHandRef.current, { xPercent: -110, yPercent: -50, opacity: 0 })
      }
      if (humanHandRef.current) {
        gsap.set(humanHandRef.current, { xPercent: 110, yPercent: -50, opacity: 0 })
      }

      // Master timeline scrubbed over the full section scroll.
      //
      // NOTE: invalidateOnRefresh is deliberately OFF. It was causing an
      // intermittent bug where ScrollTrigger.refresh() (called by
      // useScrollTimeline after Lenis init) would re-apply the "from"
      // values of one hand but not the other, leaving the robot hand
      // stuck at opacity:0. The three-layer reload fix (blocking script
      // in index.html + Lenis reset + ScrollTrigger.refresh/update)
      // already guarantees scroll starts at 0, so invalidateOnRefresh
      // is unnecessary.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionEl,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
        },
      })

      // 0–5%: Scroll hint fades out immediately when user starts scrolling
      tl.fromTo(
        scrollHintRef.current,
        { opacity: 1, y: 0 },
        { opacity: 0, y: 10, duration: 0.05, ease: 'power1.in' },
        0,
      )

      // 0–55%: Hands slide inward from off-screen
      // immediateRender:false prevents a double-application of "from"
      // values (gsap.set already applied them above). yPercent:-50 is
      // declared explicitly so GSAP never drops the vertical centering.
      if (robotHandRef.current) {
        tl.fromTo(
          robotHandRef.current,
          { xPercent: -110, yPercent: -50, opacity: 0 },
          { xPercent: 0, yPercent: -50, opacity: 1, duration: 0.55, ease: 'none', immediateRender: false },
          0,
        )
      }
      if (humanHandRef.current) {
        tl.fromTo(
          humanHandRef.current,
          { xPercent: 110, yPercent: -50, opacity: 0 },
          { xPercent: 0, yPercent: -50, opacity: 1, duration: 0.55, ease: 'none', immediateRender: false },
          0,
        )
      }

      // 58–72%: STRIDE text
      tl.fromTo(
        strideTextRef.current,
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.14, ease: 'power2.out' },
        0.58,
      )

      // 68–78%: Buttons slide up + fade in
      tl.fromTo(
        buttonsRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.1, ease: 'power2.out' },
        0.68,
      )

      // 75–85%: Credit fades in
      tl.fromTo(
        creditRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.1, ease: 'none' },
        0.75,
      )
    }, containerRef)

    return () => ctx.revert()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
      }}
    >
      {/* ─── Self-owned background: fades from transparent → #f7f7f7 ─── */}
      <div
        ref={bgRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#f7f7f7',
          zIndex: 0,
          opacity: 0,
        }}
      />

      {/* ─── Upper block: STRIDE text + buttons ─── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 10,
          position: 'relative',
          marginBottom: '2rem',
        }}
      >
        {/* STRIDE wordmark */}
        <div ref={strideTextRef} style={{ opacity: 0 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(3rem, 8vw, 7rem)',
              fontWeight: 400,
              color: '#111111',
              letterSpacing: '0.25em',
              textAlign: 'center',
              lineHeight: 1,
              margin: 0,
            }}
          >
            STRIDE
          </h2>
        </div>

        {/* Buttons */}
        <div
          ref={buttonsRef}
          style={{
            display: 'flex',
            gap: '1.5rem',
            marginTop: '2rem',
            opacity: 0,
          }}
        >
          {/* GitHub button */}
          <a
            href="https://github.com/Dxv-404"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
              letterSpacing: '0.15em',
              color: '#f7f7f7',
              backgroundColor: '#111',
              border: 'none',
              padding: '0.8rem 2rem',
              borderRadius: '50px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'background-color 300ms ease, transform 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#222'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#111'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            GitHub
            <span style={{ fontSize: '1em', lineHeight: 1 }}>&#8599;</span>
          </a>

          {/* Download Report button */}
          <a
            href="/report/stride_report.pdf"
            download
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
              letterSpacing: '0.15em',
              color: '#111',
              backgroundColor: 'transparent',
              border: '1.5px solid #333',
              padding: '0.8rem 2rem',
              borderRadius: '50px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition:
                'border-color 300ms ease, color 300ms ease, transform 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#111'
              e.currentTarget.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Download Report
            <span style={{ fontSize: '1em', lineHeight: 1 }}>&#8595;</span>
          </a>
        </div>
      </div>

      {/* ─── Lower block: Hands ─── */}
      <div
        style={{
          position: 'relative',
          width: '120%',
          height: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Robot hand — enters from left
             width/height attributes give the browser the intrinsic aspect
             ratio BEFORE the image loads, preventing a 0-height div that
             would make GSAP's yPercent:-50 resolve to 0px and hide the hand.
             loading="eager" + decoding="sync" ensure the image is decoded
             before the first paint, and fetchPriority="high" matches the
             <link rel="preload"> in index.html. */}
        <div
          ref={robotHandRef}
          style={{
            position: 'absolute',
            left: '-8%',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '58%',
            zIndex: 1,
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          <img
            src="/connect/robot_hand.png"
            alt="Robot hand reaching right"
            width={883}
            height={1024}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Human hand — enters from right */}
        <div
          ref={humanHandRef}
          style={{
            position: 'absolute',
            right: '-8%',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '58%',
            zIndex: 2,
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          <img
            src="/connect/human_hand.png"
            alt="Human hand reaching left"
            width={1104}
            height={1280}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>

      {/* ─── Wireframe mesh scroll indicator (z10, revealed after intro) ─── */}
      <div
        ref={scrollHintRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          zIndex: 10,
          opacity: 0,
        }}
      >
        {/* Low-poly wireframe mouse icon with visible triangulation */}
        <svg
          width="36"
          height="58"
          viewBox="0 0 20 32"
          fill="none"
          style={{ opacity: 0.5 }}
        >
          {/* Outer shape — polygonal (straight segments, not curves) */}
          <path
            d="M3,10 L6,3 L10,1 L14,3 L17,10 L17,22 L14,29 L10,31 L6,29 L3,22 Z"
            stroke="#1A1A1A"
            strokeWidth="0.8"
            fill="none"
          />
          {/* Internal wireframe triangulation */}
          <line x1="10" y1="1" x2="3" y2="22" stroke="#1A1A1A" strokeWidth="0.4" opacity="0.3" />
          <line x1="10" y1="1" x2="17" y2="22" stroke="#1A1A1A" strokeWidth="0.4" opacity="0.3" />
          <line x1="3" y1="10" x2="17" y2="10" stroke="#1A1A1A" strokeWidth="0.5" opacity="0.35" />
          <line x1="3" y1="22" x2="17" y2="22" stroke="#1A1A1A" strokeWidth="0.5" opacity="0.35" />
          <line x1="6" y1="3" x2="14" y2="29" stroke="#1A1A1A" strokeWidth="0.3" opacity="0.2" />
          <line x1="14" y1="3" x2="6" y2="29" stroke="#1A1A1A" strokeWidth="0.3" opacity="0.2" />
          <line x1="10" y1="31" x2="3" y2="10" stroke="#1A1A1A" strokeWidth="0.3" opacity="0.2" />
          <line x1="10" y1="31" x2="17" y2="10" stroke="#1A1A1A" strokeWidth="0.3" opacity="0.2" />
          {/* Scroll wheel dot — animated */}
          <circle cx="10" cy="11" r="1.2" fill="#1A1A1A">
            <animate attributeName="cy" values="10;16;10" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>
        <p
          className="font-mono"
          style={{
            fontSize: '0.6rem',
            color: 'rgba(26, 26, 26, 0.25)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
          }}
        >
          Scroll
        </p>
      </div>

      {/* ─── Intro overlay (z20 — covers everything, fades after cycle) ─── */}
      {introPhase !== 'done' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            backgroundColor: '#f7f7f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: introPhase === 'fading' ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
            pointerEvents: 'none',
          }}
        >
          {/* Cycling language text */}
          <p
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 8rem)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 300,
              color: '#111',
              letterSpacing: '0.08em',
              lineHeight: 1,
              textAlign: 'center',
              margin: 0,
              userSelect: 'none',
            }}
          >
            {STRIDE_LANGS[langIndex]}
          </p>

          {/* Counter — bottom right, dot matrix font */}
          <p
            style={{
              position: 'absolute',
              bottom: '2rem',
              right: '2.5rem',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
              fontWeight: 400,
              color: 'rgba(26, 26, 26, 0.3)',
              letterSpacing: '0.15em',
              margin: 0,
              fontVariantNumeric: 'tabular-nums',
              userSelect: 'none',
            }}
          >
            {String(counter).padStart(3, '0')}
          </p>
        </div>
      )}

      {/* ─── Credit line ─── */}
      <div
        ref={creditRef}
        style={{
          position: 'absolute',
          bottom: '2rem',
          opacity: 0,
        }}
      >
        <p
          className="font-mono"
          style={{
            fontSize: '0.65rem',
            color: 'rgba(0, 0, 0, 0.3)',
            letterSpacing: '0.1em',
          }}
        >
          Dev Krishna &middot; 2026
        </p>
      </div>
    </div>
  )
}
