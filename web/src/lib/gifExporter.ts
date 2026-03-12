/**
 * gifExporter — capture canvas frames and export as animated GIF.
 *
 * Uses gif.js (already in package.json) which runs encoding in a Web Worker.
 *
 * Usage:
 *   const exporter = new GifExporter(canvas, { fps: 20, quality: 10 })
 *   exporter.start()
 *   // ... after some time ...
 *   const blob = await exporter.stop()
 *   downloadBlob(blob, 'creature.gif')
 */

// @ts-expect-error gif.js has no types
import GIF from 'gif.js'

/* ─── Types ─── */

export interface GifExporterOptions {
  /** Frames per second for capture (default 20) */
  fps?: number
  /** GIF quality: lower = better quality, slower (default 10, range 1-30) */
  quality?: number
  /** Max capture duration in seconds (default 5) */
  maxDuration?: number
  /** Scale factor for output (default 0.5 for smaller files) */
  scale?: number
}

/* ─── GifExporter class ─── */

export class GifExporter {
  private canvas: HTMLCanvasElement
  private options: Required<GifExporterOptions>
  private intervalId: ReturnType<typeof setInterval> | null = null
  private gif: InstanceType<typeof GIF> | null = null
  private frameCount = 0
  private startTime = 0
  private _capturing = false

  constructor(canvas: HTMLCanvasElement, options: GifExporterOptions = {}) {
    this.canvas = canvas
    this.options = {
      fps: options.fps ?? 20,
      quality: options.quality ?? 10,
      maxDuration: options.maxDuration ?? 5,
      scale: options.scale ?? 0.5,
    }
  }

  get capturing(): boolean {
    return this._capturing
  }

  /**
   * Start capturing frames from the canvas.
   */
  start(): void {
    if (this._capturing) return

    const { fps, quality, scale } = this.options
    const w = Math.round(this.canvas.width * scale)
    const h = Math.round(this.canvas.height * scale)

    this.gif = new GIF({
      workers: 2,
      quality,
      width: w,
      height: h,
      workerScript: '/gif.worker.js',
    })

    this._capturing = true
    this.frameCount = 0
    this.startTime = performance.now()

    // Capture at specified FPS
    const interval = 1000 / fps
    this.intervalId = setInterval(() => {
      if (!this._capturing || !this.gif) return

      // Check max duration
      const elapsed = (performance.now() - this.startTime) / 1000
      if (elapsed >= this.options.maxDuration) {
        this.stop() // will resolve via the render event
        return
      }

      // Create scaled-down frame
      const frameCanvas = document.createElement('canvas')
      frameCanvas.width = w
      frameCanvas.height = h
      const ctx = frameCanvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(this.canvas, 0, 0, w, h)

      this.gif.addFrame(frameCanvas, { delay: interval, copy: true })
      this.frameCount++
    }, interval)
  }

  /**
   * Stop capturing and render the GIF.
   * Returns a Blob containing the animated GIF.
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this._capturing || !this.gif) {
        reject(new Error('Not capturing'))
        return
      }

      this._capturing = false
      if (this.intervalId) {
        clearInterval(this.intervalId)
        this.intervalId = null
      }

      if (this.frameCount === 0) {
        reject(new Error('No frames captured'))
        return
      }

      this.gif.on('finished', (blob: Blob) => {
        resolve(blob)
      })

      this.gif.render()
    })
  }

  /**
   * Cancel capture without producing output.
   */
  cancel(): void {
    this._capturing = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.gif = null
  }
}

/* ─── Utility ─── */

/**
 * Download a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download a canvas snapshot as PNG.
 */
export function downloadCanvasPNG(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}
