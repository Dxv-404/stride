/**
 * CameraModes — camera behavior presets for LiveCanvas.
 *
 * Four modes controlling how the camera follows the creature:
 *
 *   follow   — smooth tracking of creature X position (default)
 *   fixed    — camera stays at initial position
 *   dramatic — auto-zooms in on action, slowly zooms out during recovery
 *   overview — zoomed out to see full terrain
 *
 * Each mode returns { x, y, zoom } given current creature state.
 */

/* ─── Types ─── */

export type CameraMode = 'follow' | 'fixed' | 'dramatic' | 'overview'

export const CAMERA_MODES: CameraMode[] = ['follow', 'fixed', 'dramatic', 'overview']

export const CAMERA_MODE_LABELS: Record<CameraMode, string> = {
  follow: 'FOLLOW',
  fixed: 'FIXED',
  dramatic: 'DRAMATIC',
  overview: 'OVERVIEW',
}

export interface CameraState {
  x: number
  y: number
  zoom: number
}

export interface CameraInput {
  creatureX: number
  creatureY: number
  terrainHeight: number
  time: number
  baseZoom: number
  /** Whether a push recently happened */
  pushActive: boolean
  /** Time when the push occurred */
  pushTime: number
  /** Initial camera X (for fixed mode) */
  startX: number
}

/* ─── Camera state for smooth interpolation ─── */

interface DramaticState {
  targetZoom: number
  currentZoom: number
  pushTriggered: boolean
}

const dramaticState: DramaticState = {
  targetZoom: 2.5,
  currentZoom: 2.5,
  pushTriggered: false,
}

/* ─── Mode implementations ─── */

/**
 * Follow mode: smooth tracking of creature X, terrain-relative Y.
 */
function follow(input: CameraInput): CameraState {
  return {
    x: input.creatureX,
    y: input.terrainHeight + 40,
    zoom: input.baseZoom,
  }
}

/**
 * Fixed mode: camera stays at start position.
 */
function fixed(input: CameraInput): CameraState {
  return {
    x: input.startX,
    y: input.terrainHeight + 40,
    zoom: input.baseZoom,
  }
}

/**
 * Dramatic mode: zooms in during push, slowly zooms out during recovery.
 */
function dramatic(input: CameraInput): CameraState {
  const elapsed = input.time - input.pushTime

  if (input.pushActive && elapsed < 0.1) {
    // Just pushed — zoom in
    dramaticState.targetZoom = input.baseZoom * 1.5
    dramaticState.pushTriggered = true
  } else if (dramaticState.pushTriggered && elapsed > 0.3) {
    // Recovery — slowly zoom back out
    dramaticState.targetZoom = input.baseZoom
    if (elapsed > 2) {
      dramaticState.pushTriggered = false
    }
  }

  // Smooth interpolation
  dramaticState.currentZoom += (dramaticState.targetZoom - dramaticState.currentZoom) * 0.05

  return {
    x: input.creatureX,
    y: input.terrainHeight + 40,
    zoom: dramaticState.currentZoom,
  }
}

/**
 * Overview mode: zoomed out wide view, tracks creature loosely.
 */
function overview(input: CameraInput): CameraState {
  return {
    x: input.creatureX,
    y: input.terrainHeight + 80,
    zoom: input.baseZoom * 0.5,
  }
}

/* ─── Public API ─── */

/**
 * Get camera state for the given mode and input.
 */
export function getCameraState(mode: CameraMode, input: CameraInput): CameraState {
  switch (mode) {
    case 'follow': return follow(input)
    case 'fixed': return fixed(input)
    case 'dramatic': return dramatic(input)
    case 'overview': return overview(input)
  }
}

/**
 * Reset dramatic mode state (call on simulation reset).
 */
export function resetCameraState(baseZoom: number): void {
  dramaticState.targetZoom = baseZoom
  dramaticState.currentZoom = baseZoom
  dramaticState.pushTriggered = false
}
