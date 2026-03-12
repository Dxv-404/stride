/**
 * PixiJS v8 rendering test with pixel-level verification.
 * Reads specific pixel values to verify rendering works correctly.
 */

import { useEffect, useRef, useState } from 'react'
import { Application, Graphics, Container } from 'pixi.js'

/** Read pixel color at (x,y) from a canvas */
function readPixel(canvas: HTMLCanvasElement, x: number, y: number): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'no-ctx'
  const data = ctx.getImageData(x, y, 1, 1).data
  return `rgb(${data[0]},${data[1]},${data[2]}) a=${data[3]}`
}

export default function PixiTest() {
  const hiddenRef = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<string[]>(['Initializing...'])

  useEffect(() => {
    if (!hiddenRef.current) return
    const el = hiddenRef.current
    let destroyed = false

    async function init() {
      const app = new Application()
      await app.init({
        backgroundColor: 0x0a0a0f,
        antialias: true,
        resolution: 1,
        width: 800,
        height: 400,
        preserveDrawingBuffer: true,
      })
      if (destroyed) { app.destroy(true); return }
      el.appendChild(app.canvas)

      const w = app.screen.width // 800
      const h = app.screen.height // 400
      const log: string[] = []
      log.push(`Canvas: ${w}x${h}`)

      // === Test 1: Draw directly on stage ===
      const stageGfx = new Graphics()
      app.stage.addChild(stageGfx)
      // Red circle at center (400, 200) r=30
      stageGfx.circle(w / 2, h / 2, 30).fill({ color: 0xff4444 })
      // Green rect at (10, 10, 60, 30)
      stageGfx.rect(10, 10, 60, 30).fill({ color: 0x44ff88 })

      // === Test 2: Y-flipped Container ===
      const worldContainer = new Container()
      worldContainer.position.set(w / 2, h / 2) // (400, 200)
      worldContainer.scale.set(2.5, -2.5)        // Y-flip + zoom
      worldContainer.pivot.set(100, 80)           // camera at (100, 80)
      app.stage.addChild(worldContainer)

      const worldGfx = new Graphics()
      worldContainer.addChild(worldGfx)

      // Purple circle at world (100, 80) -> screen center (400, 200)
      worldGfx.circle(100, 80, 10).fill({ color: 0x8b62d8 })
      // Cyan circle at world (100, 65) -> screen (400, 200 + 15*2.5 = 237.5)
      worldGfx.circle(100, 65, 8).fill({ color: 0x00ccff })

      // === Test 3: Clear + redraw ===
      const dynGfx = new Graphics()
      worldContainer.addChild(dynGfx)
      dynGfx.circle(120, 70, 5).fill({ color: 0xff00ff })
      dynGfx.clear()
      // After clear, draw yellow circle at world (120, 85) -> screen ~(450, 187.5)
      dynGfx.circle(120, 85, 5).fill({ color: 0xffff00 })

      // Force render and read pixels
      setTimeout(() => {
        if (destroyed) return
        app.render()

        // Extract to a 2D canvas for pixel reading
        const extractCanvas = document.createElement('canvas')
        extractCanvas.width = w
        extractCanvas.height = h
        const ctx = extractCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(app.canvas, 0, 0)

          // Read pixels at known positions
          // (400, 200) = screen center -> should be purple (from worldGfx, drawn last over red)
          log.push(`T1 center(400,200): ${readPixel(extractCanvas, 400, 200)}`)
          // (30, 20) = inside green rect
          log.push(`T1 green-rect(30,20): ${readPixel(extractCanvas, 30, 20)}`)
          // (400, 238) = cyan circle from world container (world y=65)
          log.push(`T2 cyan(400,238): ${readPixel(extractCanvas, 400, 238)}`)
          // (100, 100) = background (should be bg color 0x0a0a0f)
          log.push(`BG(100,100): ${readPixel(extractCanvas, 100, 100)}`)
          // (450, 188) = yellow circle from clear+redraw test
          // world(120,85) -> screen: x=400+(120-100)*2.5=450, y=200+(80-85)*2.5=200-12.5=187.5
          log.push(`T3 yellow(450,188): ${readPixel(extractCanvas, 450, 188)}`)
          // Check if ANY non-background pixel exists in worldContainer area
          let nonBgCount = 0
          for (let px = 350; px < 450; px += 5) {
            for (let py = 150; py < 270; py += 5) {
              const c = readPixel(extractCanvas, px, py)
              if (!c.startsWith('rgb(10,10,15)')) nonBgCount++
            }
          }
          log.push(`Non-bg pixels in center region: ${nonBgCount}/480`)
        } else {
          log.push('ERROR: Could not get 2D context for pixel reading')
        }

        setResults(log)
        app.destroy(true, { children: true })
      }, 500)
    }

    init()
    return () => { destroyed = true }
  }, [])

  return (
    <div className="space-y-2">
      <p className="font-medium text-xs uppercase tracking-wide text-accent">PIXI V8 PIXEL TEST</p>
      <div ref={hiddenRef} style={{ position: 'absolute', left: -9999 }} />
      {results.map((line, i) => (
        <p key={i} className="font-mono text-xs text-green-400">{line}</p>
      ))}
    </div>
  )
}
