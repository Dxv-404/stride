/**
 * PhotoMode — fullscreen overlay for clean canvas screenshots.
 *
 * Hides all UI chrome (sidebar, dock, overlays), shows the canvas
 * with optional grid/rule-of-thirds overlay, and a "Capture" button
 * that downloads a high-res PNG.
 */

import { useState, useCallback, useEffect } from 'react'
import { downloadCanvasPNG } from '@/lib/gifExporter.ts'

interface PhotoModeProps {
  /** The canvas element to capture */
  canvas: HTMLCanvasElement | null
  onClose: () => void
}

export default function PhotoMode({ canvas, onClose }: PhotoModeProps) {
  const [showGrid, setShowGrid] = useState(false)
  const [showWatermark, setShowWatermark] = useState(true)
  const [flash, setFlash] = useState(false)

  const handleCapture = useCallback(() => {
    if (!canvas) return

    // Visual flash feedback
    setFlash(true)
    setTimeout(() => setFlash(false), 200)

    if (showWatermark) {
      // Create a copy with watermark
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      const ctx = copy.getContext('2d')
      if (!ctx) return
      ctx.drawImage(canvas, 0, 0)

      // Add watermark
      ctx.font = '600 10px "JetBrains Mono", monospace'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.textAlign = 'right'
      ctx.fillText('STRIDE', copy.width - 10, copy.height - 10)

      downloadCanvasPNG(copy, `stride-${Date.now()}.png`)
    } else {
      downloadCanvasPNG(canvas, `stride-${Date.now()}.png`)
    }
  }, [canvas, showWatermark])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.code === 'Enter') handleCapture()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, handleCapture])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Flash effect */}
      {flash && <div className="absolute inset-0 bg-white/30 z-50 pointer-events-none" />}

      {/* Rule of thirds grid overlay */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="w-full h-full relative">
            {/* Vertical lines */}
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/15" />
            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/15" />
            {/* Horizontal lines */}
            <div className="absolute left-0 right-0 top-1/3 h-px bg-white/15" />
            <div className="absolute left-0 right-0 top-2/3 h-px bg-white/15" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 p-4 bg-gradient-to-t from-black/80 to-transparent">
        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid(g => !g)}
          className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer border
            ${showGrid
              ? 'border-accent text-accent bg-accent/10'
              : 'border-white/20 text-white/50 hover:text-white/80'}`}
        >
          Grid
        </button>

        {/* Watermark toggle */}
        <button
          onClick={() => setShowWatermark(w => !w)}
          className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors cursor-pointer border
            ${showWatermark
              ? 'border-accent text-accent bg-accent/10'
              : 'border-white/20 text-white/50 hover:text-white/80'}`}
        >
          Watermark
        </button>

        {/* Capture button */}
        <button
          onClick={handleCapture}
          className="px-6 py-1.5 bg-accent text-bg text-xs font-semibold uppercase tracking-wide
                     transition-transform cursor-pointer active:scale-95 transform"
        >
          Capture
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider
                     border border-white/20 text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="absolute top-4 right-4 z-20 font-mono text-[10px] text-white/30">
        <kbd className="px-1 py-0.5 border border-white/10">ENTER</kbd> Capture
        &nbsp;·&nbsp;
        <kbd className="px-1 py-0.5 border border-white/10">ESC</kbd> Close
      </div>
    </div>
  )
}
