/**
 * SimulationCanvas — React wrapper for the PixiJS simulation renderer.
 *
 * Manages the PixiJS Application lifecycle, terrain/creature rendering,
 * camera tracking, and playback animation.
 *
 * Architecture:
 *   app.stage
 *     ├── worldContainer (camera-controlled, Y-flipped)
 *     │     ├── terrainRenderer
 *     │     ├── motionTrail
 *     │     └── creaturesContainer
 *     │           └── creatureRenderers[0..N]
 *     └── overlayContainer (fixed, screen-space)
 *           ├── genText (generation counter)
 *           └── fitnessText
 *
 * The worldContainer uses scale.y = -zoom to flip the Y axis,
 * matching p2.js's Y-up convention to PixiJS's Y-down screen.
 *
 * NOTE: drawFrame() is called once via setTimeout on init and then
 * continuously from the PixiJS ticker. This ensures at least one
 * frame renders even if requestAnimationFrame is throttled (e.g.
 * background tabs).
 */

import { useEffect, useRef, useCallback } from 'react'
import { Application, Container, Text, TextStyle } from 'pixi.js'
import type { CreatureRecord, CreatureFrame } from '@/engine/types.ts'
import { createTerrain } from '@/engine/terrain.ts'
import type { Terrain } from '@/engine/terrain.ts'
import { CameraController } from './CameraController.ts'
import { TerrainRenderer } from './TerrainRenderer.ts'
import { CreatureRenderer, MotionTrailRenderer, fitnessToColor } from './CreatureRenderer.ts'

/* ─── Constants ─── */

/** Read BG color from CSS variable, convert to hex number for PixiJS */
function getBgColor(): number {
  const css = getComputedStyle(document.documentElement).getPropertyValue('--color-canvas-bg').trim()
  if (css.startsWith('#') && css.length === 7) {
    return parseInt(css.slice(1), 16)
  }
  return 0x0F0F0F // fallback
}

const BG_COLOR = getBgColor()
const DEFAULT_ZOOM = 2.5
const MAX_VISIBLE_CREATURES = 10

/* ─── Props ─── */

export interface SimulationCanvasProps {
  terrainType?: string
  creatures?: CreatureRecord[]
  bestCreatureId?: number
  generation?: number
  bestFitness?: number
  playing?: boolean
  speed?: number
  onCreatureClick?: (id: number) => void
  onFrameChange?: (frame: number) => void
  frameIndex?: number
  maxFrames?: number
}

/* ─── Component ─── */

export default function SimulationCanvas({
  terrainType = 'flat',
  creatures = [],
  bestCreatureId,
  generation = 0,
  bestFitness = 0,
  playing = true,
  speed = 1,
  onCreatureClick,
  onFrameChange,
  frameIndex: externalFrameIndex,
  maxFrames = 300,
}: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const stateRef = useRef({
    frameIndex: 0,
    accumulator: 0,
    creatures: creatures,
    bestCreatureId: bestCreatureId,
    generation: generation,
    bestFitness: bestFitness,
    playing: playing,
    speed: speed,
    terrainType: terrainType,
    maxFrames: maxFrames,
    onCreatureClick: onCreatureClick,
    onFrameChange: onFrameChange,
  })

  // Keep stateRef in sync with props
  useEffect(() => {
    stateRef.current.creatures = creatures
    stateRef.current.bestCreatureId = bestCreatureId
    stateRef.current.generation = generation
    stateRef.current.bestFitness = bestFitness
    stateRef.current.playing = playing
    stateRef.current.speed = speed
    stateRef.current.maxFrames = maxFrames
    stateRef.current.onCreatureClick = onCreatureClick
    stateRef.current.onFrameChange = onFrameChange
  }, [creatures, bestCreatureId, generation, bestFitness, playing, speed, maxFrames, onCreatureClick, onFrameChange])

  // Handle terrain type changes
  const terrainRef = useRef(terrainType)
  const terrainRendererRef = useRef<TerrainRenderer | null>(null)

  useEffect(() => {
    if (terrainType !== terrainRef.current && terrainRendererRef.current) {
      terrainRef.current = terrainType
      stateRef.current.terrainType = terrainType
      const terrain = createTerrain(terrainType)
      terrainRendererRef.current.setTerrain(terrain)
    }
  }, [terrainType])

  // Handle external frame index (from scrubber)
  useEffect(() => {
    if (externalFrameIndex !== undefined) {
      stateRef.current.frameIndex = externalFrameIndex
    }
  }, [externalFrameIndex])

  // Reset frame index when creatures change
  const creaturesKeyRef = useRef('')
  useEffect(() => {
    const key = creatures.map(c => c.id).join(',')
    if (key !== creaturesKeyRef.current) {
      creaturesKeyRef.current = key
      stateRef.current.frameIndex = 0
      stateRef.current.accumulator = 0
    }
  }, [creatures])

  /** Stable click handler */
  const handleCreatureClick = useCallback((id: number) => {
    stateRef.current.onCreatureClick?.(id)
  }, [])

  /* ─── PixiJS Application lifecycle ─── */

  useEffect(() => {
    if (!containerRef.current) return

    const el = containerRef.current
    let destroyed = false

    // --- Scene objects (created during init) ---
    let camera: CameraController
    let terrain: Terrain
    let terrainRenderer: TerrainRenderer
    let motionTrail: MotionTrailRenderer
    let creatureRenderers: CreatureRenderer[] = []
    let worldContainer: Container
    let genText: Text
    let fitnessText: Text

    /**
     * Core draw function — draws creatures, updates camera, overlay text.
     * Called from both the ticker (continuous animation) and setTimeout
     * (guaranteed initial render even in background tabs).
     *
     * @param screenW  Canvas width in CSS pixels
     * @param screenH  Canvas height in CSS pixels
     * @param deltaFrames  Time elapsed in frames (0 = no frame advance)
     */
    function drawFrame(
      screenW: number,
      screenH: number,
      deltaFrames: number,
    ) {
      const state = stateRef.current
      const { creatures: crs, playing: isPlaying, speed: spd } = state

      // --- Advance frame index ---
      if (isPlaying && crs.length > 0 && deltaFrames > 0) {
        state.accumulator += spd * deltaFrames
        while (state.accumulator >= 1) {
          state.accumulator -= 1
          state.frameIndex++
          if (state.frameIndex >= state.maxFrames) {
            state.frameIndex = 0 // Loop back to start for continuous playback
          }
        }
        state.onFrameChange?.(state.frameIndex)
      }

      const fi = state.frameIndex

      // --- Find best and worst fitness for color mapping ---
      let worst = Infinity
      let best = -Infinity
      for (const c of crs) {
        if (c.fitness < worst) worst = c.fitness
        if (c.fitness > best) best = c.fitness
      }
      if (worst === Infinity) worst = 0
      if (best === -Infinity) best = 0

      // --- Draw creatures ---
      let bestFrame: CreatureFrame | null = null

      for (let i = 0; i < MAX_VISIBLE_CREATURES; i++) {
        const cr = creatureRenderers[i]
        if (i >= crs.length) {
          cr.setVisible(false)
          continue
        }

        const creature = crs[i]
        const frames = creature.walkFrames
        if (!frames || frames.length === 0) {
          cr.setVisible(false)
          continue
        }

        const safeFrame = Math.min(fi, frames.length - 1)
        const frame = frames[safeFrame]
        if (!frame) {
          cr.setVisible(false)
          continue
        }

        const isBest = creature.id === state.bestCreatureId
        const color = fitnessToColor(creature.fitness, worst, best)

        // Opacity: best = full, others fade based on relative fitness
        const fitnessT = best > worst
          ? (creature.fitness - worst) / (best - worst)
          : 0.5
        const alpha = isBest ? 1.0 : 0.25 + fitnessT * 0.45

        cr.id = creature.id
        cr.draw(frame, color, alpha, isBest)
        cr.setVisible(true)

        if (isBest) {
          bestFrame = frame
        }
      }

      // --- Camera tracking ---
      if (bestFrame) {
        const terrainY = terrain.getHeight(bestFrame.torsoX)
        camera.setTarget(bestFrame.torsoX, terrainY + 35)
      }
      camera.update()

      // Apply camera transform to worldContainer
      const zoom = camera.zoom
      worldContainer.scale.set(zoom, -zoom)
      worldContainer.pivot.set(camera.x, camera.y)
      worldContainer.position.set(screenW / 2, screenH / 2)

      // --- Motion trail for best creature ---
      if (bestFrame) {
        motionTrail.push(bestFrame.torsoX, bestFrame.torsoY)
        const bestColor = crs.length > 0
          ? fitnessToColor(
              crs.find(c => c.id === state.bestCreatureId)?.fitness ?? 0,
              worst, best,
            )
          : 0x8b62d8
        motionTrail.setColor(bestColor)
        motionTrail.draw()
      }

      // --- Overlay text ---
      genText.text = `GEN ${state.generation}`
      fitnessText.text = `BEST: ${state.bestFitness.toFixed(1)}`
    }

    async function init() {
      const app = new Application()

      await app.init({
        backgroundAlpha: 1,
        backgroundColor: BG_COLOR,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
        resizeTo: el,
        preference: 'webgl',
      })

      if (destroyed) {
        app.destroy(true)
        return
      }

      el.appendChild(app.canvas)
      appRef.current = app

      const w = app.screen.width
      const h = app.screen.height

      // --- Camera ---
      camera = new CameraController(100, 80, DEFAULT_ZOOM)
      camera.setViewport(w, h)

      // --- World container (camera-controlled) ---
      worldContainer = new Container()
      app.stage.addChild(worldContainer)

      // --- Terrain ---
      terrainRenderer = new TerrainRenderer()
      terrainRendererRef.current = terrainRenderer
      worldContainer.addChild(terrainRenderer.container)

      terrain = createTerrain(stateRef.current.terrainType)
      terrainRenderer.setTerrain(terrain)

      // --- Motion trail ---
      motionTrail = new MotionTrailRenderer()
      worldContainer.addChild(motionTrail.graphics)

      // --- Creatures container ---
      const creaturesContainer = new Container()
      worldContainer.addChild(creaturesContainer)

      for (let i = 0; i < MAX_VISIBLE_CREATURES; i++) {
        const cr = new CreatureRenderer()
        cr.setVisible(false)
        creaturesContainer.addChild(cr.container)
        creatureRenderers.push(cr)

        const idx = i
        cr.container.on('pointertap', () => {
          if (creatureRenderers[idx].id >= 0) {
            handleCreatureClick(creatureRenderers[idx].id)
          }
        })
      }

      // --- Overlay (screen-space, not affected by camera) ---
      const overlayContainer = new Container()
      app.stage.addChild(overlayContainer)

      // Read overlay text color from theme
      const overlayTextColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text-dim').trim() || '#e7e7e766'

      const pixelStyle = new TextStyle({
        fontFamily: '"Inter", sans-serif',
        fontWeight: '600',
        fontSize: 11,
        fill: overlayTextColor,
        letterSpacing: 1,
      })

      genText = new Text({ text: 'GEN 0', style: pixelStyle })
      genText.position.set(16, 12)
      overlayContainer.addChild(genText)

      const fitnessStyle = new TextStyle({
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11,
        fill: overlayTextColor,
      })

      fitnessText = new Text({ text: 'BEST: 0.0', style: fitnessStyle })
      fitnessText.position.set(16, 30)
      overlayContainer.addChild(fitnessText)

      // --- Initial draw ---
      // Snap camera to best creature immediately (no lerp)
      if (stateRef.current.creatures.length > 0) {
        const bestId = stateRef.current.bestCreatureId
        const bestCreature = stateRef.current.creatures.find(c => c.id === bestId)
          ?? stateRef.current.creatures[0]
        const f0 = bestCreature.walkFrames?.[0]
        if (f0) {
          const terrainY = terrain.getHeight(f0.torsoX)
          camera.setTarget(f0.torsoX, terrainY + 35)
          camera.snapToTarget()
        }
      }
      try {
        drawFrame(w, h, 0)
        app.render()
      } catch {
        // Initial render may fail under StrictMode; ticker will retry
      }

      // --- Render loop ---
      // PixiJS v8 batcher can throw on the first few frames after async init,
      // especially under React StrictMode's double-mount. try-catch keeps
      // the ticker alive so subsequent frames render correctly.
      app.ticker.add((ticker) => {
        if (destroyed) return
        try {
          drawFrame(w, h, ticker.deltaTime)
        } catch {
          // Swallow batcher errors — they self-heal on next frame
        }
      })

      // --- Handle resize ---
      const resizeObserver = new ResizeObserver(() => {
        if (destroyed) return
        const newW = app.screen.width
        const newH = app.screen.height
        camera.setViewport(newW, newH)
      })
      resizeObserver.observe(el)

      return () => {
        resizeObserver.disconnect()
      }
    }

    let cleanupResize: (() => void) | undefined

    init().then(cleanup => {
      cleanupResize = cleanup
    })

    return () => {
      destroyed = true
      cleanupResize?.()
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
      terrainRendererRef.current = null
    }
  }, [handleCreatureClick])

  return (
    <div className="w-full h-full relative" style={{ minHeight: 300 }}>
      <div
        ref={containerRef}
        className="absolute inset-0"
      />
    </div>
  )
}
