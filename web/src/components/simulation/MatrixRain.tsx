/**
 * MatrixRain — Optional animated matrix-style rain background.
 *
 * Binary/hex characters falling. Very low opacity. Theme-colored.
 * Can be toggled on/off.
 */

import { useEffect, useRef } from 'react'

interface MatrixRainProps {
  /** Whether the rain is active */
  enabled?: boolean
  /** Color of the characters */
  color?: string
  /** Opacity of the rain (0-1) */
  opacity?: number
}

const CHARS = '01ACGTFN'.split('')

interface Drop {
  x: number
  y: number
  speed: number
  char: string
  nextCharTime: number
}

export default function MatrixRain({
  enabled = true,
  color = '#F59E0B',
  opacity = 0.04,
}: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const dropsRef = useRef<Drop[]>([])
  // Track canvas dimensions internally (no state needed)

  // Initialize drops
  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    if (!canvas) return

    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width
      canvas.height = rect.height

      // Create drops
      const colWidth = 14
      const cols = Math.floor(rect.width / colWidth)
      dropsRef.current = Array.from({ length: cols }, (_, i) => ({
        x: i * colWidth + colWidth / 2,
        y: Math.random() * rect.height,
        speed: 30 + Math.random() * 60,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        nextCharTime: 0,
      }))
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [enabled])

  // Animation loop
  useEffect(() => {
    if (!enabled) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = '10px monospace'
      ctx.fillStyle = color
      ctx.globalAlpha = opacity

      for (const drop of dropsRef.current) {
        drop.y += drop.speed * dt

        // Change char periodically
        if (now > drop.nextCharTime) {
          drop.char = CHARS[Math.floor(Math.random() * CHARS.length)]
          drop.nextCharTime = now + 100 + Math.random() * 200
        }

        // Draw char
        ctx.fillText(drop.char, drop.x, drop.y)

        // Draw fading trail
        ctx.globalAlpha = opacity * 0.5
        ctx.fillText(drop.char, drop.x, drop.y - 12)
        ctx.globalAlpha = opacity * 0.25
        ctx.fillText(drop.char, drop.x, drop.y - 24)
        ctx.globalAlpha = opacity

        // Reset when off screen
        if (drop.y > canvas.height + 30) {
          drop.y = -20
          drop.speed = 30 + Math.random() * 60
        }
      }

      ctx.globalAlpha = 1
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [enabled, color, opacity])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
