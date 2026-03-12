/**
 * Preloader — Branded loading screen for the landing page.
 *
 * Shows "STRIDE" wordmark + horizontal progress bar while 3D assets
 * load. Fades out once usePreloader reports ready, then unmounts.
 *
 * This overlay sits at z-50 and covers the entire viewport.
 */

import { useState, useEffect } from 'react'

interface PreloaderProps {
  progress: number  // 0–1
  ready: boolean
}

export default function Preloader({ progress, ready }: PreloaderProps) {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (ready) {
      setFadeOut(true)
      const timer = setTimeout(() => setVisible(false), 600) // match CSS transition
      return () => clearTimeout(timer)
    }
  }, [ready])

  if (!visible) return null

  return (
    <div
      className="no-transition"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0A',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 600ms ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* STRIDE wordmark */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(2rem, 6vw, 4rem)',
          fontWeight: 400,
          color: '#E7E7E7',
          letterSpacing: '0.2em',
          marginBottom: '3rem',
        }}
      >
        STRIDE
      </h1>

      {/* Progress bar container */}
      <div
        style={{
          width: 'min(280px, 60vw)',
          height: '2px',
          backgroundColor: '#2E2E2E',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Progress fill */}
        <div
          className="no-transition"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: `${progress * 100}%`,
            backgroundColor: '#C4956A',
            transition: 'width 200ms ease-out',
          }}
        />
      </div>

      {/* Loading text */}
      <p
        className="font-mono"
        style={{
          fontSize: '0.7rem',
          color: 'rgba(231, 231, 231, 0.3)',
          marginTop: '1rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {progress < 1 ? 'Loading assets...' : 'Ready'}
      </p>
    </div>
  )
}
