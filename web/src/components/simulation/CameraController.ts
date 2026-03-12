/**
 * Camera controller for the simulation canvas.
 *
 * Smoothly tracks a target position in world coordinates.
 * Used by the worldContainer to transform world → screen space.
 *
 * The camera's (x, y) represents the world coordinate at the center of the viewport.
 * Zoom controls the scale: 1 world unit = zoom screen pixels.
 */

export interface CameraState {
  x: number
  y: number
  zoom: number
}

export class CameraController {
  /** Current camera position (world coords at viewport center) */
  x: number
  y: number
  zoom: number

  /** Smoothing factor: 0 = instant snap, 1 = never moves */
  private lerp: number

  /** Target position for smooth tracking */
  private targetX: number
  private targetY: number

  /** Viewport dimensions (screen pixels) */
  private viewportW = 800
  private viewportH = 600

  constructor(x = 100, y = 80, zoom = 2.5, lerp = 0.08) {
    this.x = x
    this.y = y
    this.zoom = zoom
    this.lerp = lerp
    this.targetX = x
    this.targetY = y
  }

  /** Set the target the camera should track toward */
  setTarget(x: number, y: number): void {
    this.targetX = x
    this.targetY = y
  }

  /** Snap camera instantly to target (no smoothing) */
  snapToTarget(): void {
    this.x = this.targetX
    this.y = this.targetY
  }

  /** Update viewport dimensions */
  setViewport(w: number, h: number): void {
    this.viewportW = w
    this.viewportH = h
  }

  /** Advance camera position toward target (call each frame) */
  update(): void {
    this.x += (this.targetX - this.x) * this.lerp
    this.y += (this.targetY - this.y) * this.lerp
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.viewportW / 2,
      y: -(worldY - this.y) * this.zoom + this.viewportH / 2,
    }
  }

  /** Get current state snapshot */
  getState(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom }
  }
}
