/**
 * HumanSection — Section 2 HTML overlay for interactive wireframe human.
 *
 * Displays:
 *   - Section title: "ANATOMY OF EVOLUTION" (stays visible during lock)
 *   - Interaction hint: "Drag to rotate · Scroll to zoom"
 *   - Continue button: appears when scroll is locked, triggers exit animation
 *   - Floating tooltip near the selected joint (projected from 3D → screen)
 *
 * TOOLTIP: Positioned near the selected joint using screen-projected coordinates
 * from the Zustand store (written by JointMarker in useFrame). The tooltip
 * includes a thin connector line from the joint dot to the card.
 */

import { useMemo } from 'react'
import { useLandingStore } from '@/stores/landingStore.ts'
import { JOINT_DATA } from './jointData.ts'

interface HumanSectionProps {
  onContinue: () => void
}

export default function HumanSection({ onContinue }: HumanSectionProps) {
  const activeSection = useLandingStore((s) => s.activeSection)
  const scrollLocked = useLandingStore((s) => s.scrollLocked)
  const selectedJoint = useLandingStore((s) => s.selectedJoint)
  const jointScreenPos = useLandingStore((s) => s.jointScreenPos)
  const setSelectedJoint = useLandingStore((s) => s.setSelectedJoint)
  const requestCameraReset = useLandingStore((s) => s.requestCameraReset)
  const isDraggingJoint = useLandingStore((s) => s.isDraggingJoint)

  const isActive = activeSection === 2

  const jointInfo = selectedJoint
    ? JOINT_DATA.find((j) => j.boneName === selectedJoint)
    : null

  // Calculate tooltip placement: offset to the right of the joint,
  // or to the left if too close to the right edge.
  const tooltipStyle = useMemo(() => {
    if (!jointScreenPos || !jointInfo) return null

    const vw = window.innerWidth
    const vh = window.innerHeight
    const cardW = 320 // approximate card width
    const offsetX = 40 // horizontal gap from joint dot
    const offsetY = -20 // slight upward offset

    // Place right of joint, or left if near right edge
    const placeLeft = jointScreenPos.x + offsetX + cardW > vw - 40
    const x = placeLeft
      ? jointScreenPos.x - offsetX - cardW
      : jointScreenPos.x + offsetX
    // Clamp Y to keep card within viewport
    const y = Math.max(60, Math.min(vh - 280, jointScreenPos.y + offsetY))

    return {
      x,
      y,
      jointX: jointScreenPos.x,
      jointY: jointScreenPos.y,
      placeLeft,
    }
  }, [jointScreenPos, jointInfo])

  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        minHeight: '100vh',
        pointerEvents: 'none',
      }}
    >
      {/* Section title — fixed at viewport top when scroll-locked */}
      {scrollLocked && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: '2.5rem',
            paddingBottom: '1rem',
            textAlign: 'center',
            zIndex: 25,
            pointerEvents: 'none',
            opacity: 1,
            transition: 'opacity 0.4s ease',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              fontWeight: 400,
              color: '#E7E7E7',
              letterSpacing: '0.15em',
            }}
          >
            ANATOMY OF EVOLUTION
          </h2>
          <p
            className="font-mono mt-3"
            style={{
              fontSize: '0.7rem',
              color: 'rgba(231, 231, 231, 0.45)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Click joints to inspect &middot; Drag joints to pose &middot; They spring back
          </p>
        </div>
      )}

      {/* Bottom area — interaction hint + Continue button (only during lock) */}
      {scrollLocked && (
        <div
          style={{
            position: 'fixed',
            bottom: '2.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            pointerEvents: 'none',
          }}
        >
          {/* Interaction hint */}
          <p
            className="font-mono"
            style={{
              fontSize: '0.6rem',
              color: 'rgba(231, 231, 231, 0.35)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              animation: scrollLocked ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          >
            Drag to rotate &middot; Scroll to zoom &middot; Right-click to pan
          </p>

          {/* Button row — Recenter + Continue */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              pointerEvents: scrollLocked ? 'auto' : 'none',
              opacity: scrollLocked ? 1 : 0,
              transform: scrollLocked ? 'translateY(0)' : 'translateY(8px)',
              transition: 'all 0.4s ease',
            }}
          >
            {/* Recenter button */}
            <button
              onClick={requestCameraReset}
              className="font-mono"
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(231, 231, 231, 0.5)',
                background: 'rgba(231, 231, 231, 0.04)',
                border: '1px solid rgba(231, 231, 231, 0.15)',
                padding: '0.6rem 1.2rem',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(231, 231, 231, 0.1)'
                e.currentTarget.style.borderColor = 'rgba(231, 231, 231, 0.3)'
                e.currentTarget.style.color = 'rgba(231, 231, 231, 0.85)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(231, 231, 231, 0.04)'
                e.currentTarget.style.borderColor = 'rgba(231, 231, 231, 0.15)'
                e.currentTarget.style.color = 'rgba(231, 231, 231, 0.5)'
              }}
            >
              ⟲ Recenter
            </button>

            {/* Continue button */}
            <button
              onClick={() => {
                setSelectedJoint(null)
                onContinue()
              }}
              className="font-mono"
              style={{
                fontSize: '0.65rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(231, 231, 231, 0.7)',
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                padding: '0.7rem 2.5rem',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.4s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)'
                e.currentTarget.style.color = 'rgba(231, 231, 231, 0.95)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.08)'
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.25)'
                e.currentTarget.style.color = 'rgba(231, 231, 231, 0.7)'
              }}
            >
              Continue &darr;
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
       *  FLOATING TOOLTIP — appears near the selected joint
       *  Positioned via 3D→screen projection from JointMarker.
       *  Includes a thin connector line from joint dot to card.
       * ═══════════════════════════════════════════════════════════ */}
      {jointInfo && tooltipStyle && !isDraggingJoint && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 26,
            pointerEvents: 'none',
          }}
        >
          {/* Connector line — SVG from joint dot to card edge */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <line
              x1={tooltipStyle.jointX}
              y1={tooltipStyle.jointY}
              x2={tooltipStyle.placeLeft
                ? tooltipStyle.x + 320
                : tooltipStyle.x}
              y2={tooltipStyle.y + 30}
              stroke="rgba(168, 85, 247, 0.35)"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
            {/* Small dot at the joint end */}
            <circle
              cx={tooltipStyle.jointX}
              cy={tooltipStyle.jointY}
              r="4"
              fill="none"
              stroke="rgba(168, 85, 247, 0.5)"
              strokeWidth="1.5"
            />
            <circle
              cx={tooltipStyle.jointX}
              cy={tooltipStyle.jointY}
              r="1.5"
              fill="rgba(212, 208, 224, 0.7)"
            />
          </svg>

          {/* Tooltip card */}
          <div
            style={{
              position: 'absolute',
              left: tooltipStyle.x,
              top: tooltipStyle.y,
              width: '320px',
              pointerEvents: 'auto',
              animation: 'tooltipIn 0.3s ease-out',
            }}
          >
            {/* Card content */}
            <div
              style={{
                position: 'relative',
                background: 'rgba(18, 16, 24, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                padding: '1.25rem 1.5rem 1.25rem 1.5rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(168, 85, 247, 0.06)',
              }}
            >
              {/* Top accent line — purple gradient */}
              <div
                style={{
                  position: 'absolute',
                  top: -1,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent 10%, rgba(168, 85, 247, 0.6) 50%, transparent 90%)',
                }}
              />
              {/* Left accent bar — subtle vertical glow */}
              <div
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  bottom: '0.5rem',
                  left: -1,
                  width: '2px',
                  background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.4), rgba(168, 85, 247, 0.1))',
                }}
              />

              {/* Close button */}
              <button
                onClick={() => setSelectedJoint(null)}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  fontSize: '0.65rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(231, 231, 231, 0.3)',
                  padding: '4px 6px',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(231, 231, 231, 0.8)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(231, 231, 231, 0.3)' }}
              >
                ✕
              </button>

              {/* Joint label + type badge row */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.95rem',
                    color: '#E7E7E7',
                    letterSpacing: '0.08em',
                    fontWeight: 400,
                  }}
                >
                  {jointInfo.label}
                </h3>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.5rem',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(168, 85, 247, 0.7)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    padding: '2px 6px',
                  }}
                >
                  {jointInfo.type}
                </span>
              </div>

              {/* GA parameter — mono badge */}
              <p
                className="font-mono"
                style={{
                  fontSize: '0.58rem',
                  color: 'rgba(231, 231, 231, 0.4)',
                  letterSpacing: '0.06em',
                  marginBottom: '0.75rem',
                }}
              >
                {jointInfo.gaParam}
              </p>

              {/* Thin separator */}
              <div
                style={{
                  height: '1px',
                  background: 'rgba(212, 208, 224, 0.08)',
                  marginBottom: '0.75rem',
                }}
              />

              {/* Description */}
              <p
                style={{
                  fontSize: '0.75rem',
                  lineHeight: 1.65,
                  color: 'rgba(231, 231, 231, 0.6)',
                }}
              >
                {jointInfo.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tooltip entrance animation */}
      <style>{`
        @keyframes tooltipIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
