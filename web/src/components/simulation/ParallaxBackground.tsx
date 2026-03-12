/**
 * ParallaxBackground — Multi-layer parallax background for simulation canvases.
 *
 * 3 layers of subtle geometric shapes (dots, lines) that scroll at different
 * speeds relative to camera. Monochromatic. Togglable via `enabled` prop.
 */

// Imperative draw function — no React imports needed

interface ParallaxBackgroundProps {
  /** Camera X position in world space */
  cameraX: number
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Whether to draw the background */
  enabled?: boolean
}

interface ParallaxElement {
  x: number
  y: number
  size: number
  type: 'dot' | 'line' | 'cross'
  opacity: number
}

function generateLayer(count: number, seed: number): ParallaxElement[] {
  const elements: ParallaxElement[] = []
  // Simple seeded RNG
  let s = seed
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }

  for (let i = 0; i < count; i++) {
    elements.push({
      x: rand() * 4000 - 1000,
      y: rand() * 600,
      size: 1 + rand() * 3,
      type: ['dot', 'line', 'cross'][Math.floor(rand() * 3)] as 'dot' | 'line' | 'cross',
      opacity: 0.02 + rand() * 0.06,
    })
  }
  return elements
}

const LAYERS = [
  { speed: 0.1, elements: generateLayer(60, 42) },  // far (slow)
  { speed: 0.3, elements: generateLayer(40, 137) },  // mid
  { speed: 0.5, elements: generateLayer(25, 256) },  // near (fast)
]

export function drawParallaxBackground(
  ctx: CanvasRenderingContext2D,
  cameraX: number,
  width: number,
  height: number,
  enabled: boolean,
  color = '#888',
) {
  if (!enabled) return

  for (const layer of LAYERS) {
    const offsetX = cameraX * layer.speed

    for (const el of layer.elements) {
      const sx = ((el.x - offsetX) % 2000 + 2000) % 2000 - 200
      const sy = el.y

      if (sx < -20 || sx > width + 20 || sy < -20 || sy > height + 20) continue

      ctx.globalAlpha = el.opacity
      ctx.strokeStyle = color
      ctx.fillStyle = color

      switch (el.type) {
        case 'dot':
          ctx.beginPath()
          ctx.arc(sx, sy, el.size, 0, Math.PI * 2)
          ctx.fill()
          break
        case 'line':
          ctx.beginPath()
          ctx.moveTo(sx - el.size * 2, sy)
          ctx.lineTo(sx + el.size * 2, sy)
          ctx.lineWidth = 0.5
          ctx.stroke()
          break
        case 'cross':
          ctx.beginPath()
          ctx.moveTo(sx - el.size, sy - el.size)
          ctx.lineTo(sx + el.size, sy + el.size)
          ctx.moveTo(sx + el.size, sy - el.size)
          ctx.lineTo(sx - el.size, sy + el.size)
          ctx.lineWidth = 0.5
          ctx.stroke()
          break
      }
    }
  }

  ctx.globalAlpha = 1
}

export default function ParallaxBackground(_props: ParallaxBackgroundProps) {
  // This component is a no-op render — the actual drawing happens via
  // drawParallaxBackground() called from the canvas render loop.
  return null
}
