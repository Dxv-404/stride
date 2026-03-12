/**
 * landingStore — Zustand store for scrollytelling landing page state.
 *
 * Tracks preloader status, active section, and scroll-lock state.
 * The 3D animation state lives in mutable refs (not here) to avoid
 * React re-renders during 60fps animation — see useScrollTimeline.ts.
 */

import { create } from 'zustand'

interface LandingState {
  /** Whether all assets have loaded (preloader complete) */
  loaded: boolean
  /** Currently visible section index (0-6) */
  activeSection: number
  /** Whether scroll is locked for Section 2 interaction */
  scrollLocked: boolean
  /** Whether the user has clicked "Continue" in Section 2 */
  humanInteracted: boolean
  /** Currently selected joint name (for tooltip display) */
  selectedJoint: string | null
  /** Screen-space position of the selected joint (for tooltip placement) */
  jointScreenPos: { x: number; y: number } | null
  /** Increment to trigger camera reset to default position */
  cameraResetFlag: number
  /** Whether a joint is actively being dragged (disables OrbitControls + tooltip) */
  isDraggingJoint: boolean

  setLoaded: (loaded: boolean) => void
  setActiveSection: (section: number) => void
  setScrollLocked: (locked: boolean) => void
  setHumanInteracted: (interacted: boolean) => void
  setSelectedJoint: (joint: string | null) => void
  setJointScreenPos: (pos: { x: number; y: number } | null) => void
  requestCameraReset: () => void
  setIsDraggingJoint: (dragging: boolean) => void
}

export const useLandingStore = create<LandingState>((set, get) => {
  // DEV: expose store globally for debugging
  if (import.meta.env.DEV) {
    ;(window as any).__landingStore = { getState: get, setState: set }
  }
  return {
  loaded: false,
  activeSection: 0,
  scrollLocked: false,
  humanInteracted: false,
  selectedJoint: null,
  jointScreenPos: null,
  cameraResetFlag: 0,
  isDraggingJoint: false,

  setLoaded: (loaded) => set({ loaded }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setScrollLocked: (scrollLocked) => set({ scrollLocked }),
  setHumanInteracted: (humanInteracted) => set({ humanInteracted }),
  setSelectedJoint: (selectedJoint) => set({ selectedJoint }),
  setJointScreenPos: (jointScreenPos) => set({ jointScreenPos }),
  requestCameraReset: () => set((s) => ({ cameraResetFlag: s.cameraResetFlag + 1 })),
  setIsDraggingJoint: (isDraggingJoint) => set({ isDraggingJoint }),
}})
