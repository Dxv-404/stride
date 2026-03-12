/**
 * LiveCanvas — real-time p2.js physics simulation with Canvas2D rendering.
 *
 * Unlike SimulationCanvas (which plays back pre-recorded PixiJS frames),
 * this component runs live physics each animation frame.
 *
 * Used by: Push Test (Tab 3) and Controller Race (Tab 2).
 *
 * Architecture:
 *   - Creates a p2.js world with terrain
 *   - Spawns a creature and attaches a Controller (sine/cpg/cpg_nn)
 *   - Each requestAnimationFrame: step physics → read sensors → update controller → draw
 *   - Canvas2D draws the creature as a stick figure (Y-flipped)
 *   - Supports push impulse, camera follow, foot dust particles
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as p2 from 'p2'
import { Creature } from '@/engine/creature.ts'
import { createController, type Controller, type ControllerType } from '@/engine/controllers.ts'
import { createTerrain, type Terrain } from '@/engine/terrain.ts'
import { getSensors, detectFootContacts } from '@/engine/sensors.ts'
import { decodeDirect, type JointParam } from '@/engine/encoding.ts'
import {
  GRAVITY, DT, SOLVER_ITERATIONS,
  TORSO_WIDTH, TORSO_HEIGHT,
  UPPER_LEG_LENGTH, LOWER_LEG_LENGTH, FOOT_HEIGHT,
  SPAWN_X, SPAWN_MARGIN,
  FOOT_FRICTION,
  COLLISION_GROUP_TERRAIN, COLLISION_MASK_TERRAIN,
} from '@/engine/config.ts'
import type { VisualMode } from './VisualModes.ts'
import { drawXRay, drawHeatmap, drawBlueprint, drawInkWash } from './VisualModes.ts'
import { ReplayBuffer } from './ReplayBuffer.ts'
import { type CameraMode, getCameraState, resetCameraState } from './CameraModes.ts'
import { audioEngine } from '@/lib/audioEngine.ts'

/* ─── Types ─── */

export interface LiveCanvasHandle {
  /** Apply a horizontal push impulse to the creature's torso */
  push: (force: number) => void
  /** Reset the simulation from scratch */
  reset: () => void
  /** Check if creature has fallen */
  isFallen: () => boolean
  /** Get current simulation time */
  getTime: () => number
  /** Get current torso X position (distance traveled) */
  getDistance: () => number
  /** Get the replay buffer for slow-mo playback */
  getReplayBuffer: () => ReplayBuffer
  /** Play back recent frames in slow motion */
  playReplay: (speed: number) => void
  /** Stop replay and return to live */
  stopReplay: () => void
  /** Whether currently playing a replay */
  isReplaying: () => boolean
  /** Get the canvas element for screenshot/GIF capture */
  getCanvas: () => HTMLCanvasElement | null
}

export interface LiveCanvasProps {
  genes: number[]
  controllerType: ControllerType
  terrainType?: string
  width?: number
  height?: number
  /** Whether physics is running */
  running?: boolean
  /** Zoom level (default 2.5) */
  zoom?: number
  /** Callback fired each frame with current state */
  onFrame?: (state: {
    time: number
    distance: number
    torsoAngle: number
    fallen: boolean
  }) => void
  /** Callback when creature falls */
  onFall?: () => void
  /** Show ghost trail */
  showTrail?: boolean
  /** Label color (for controller race) */
  accentColor?: string
  /** Label text */
  label?: string
  /** Visual rendering mode */
  visualMode?: VisualMode
  /** Camera behavior mode */
  cameraMode?: CameraMode
}

/* ─── Constants ─── */

/** Read themed colors from CSS variables (set via data-theme) */
function getThemedColors() {
  const s = getComputedStyle(document.documentElement)
  const get = (v: string) => s.getPropertyValue(v).trim()
  return {
    bg: get('--color-canvas-bg') || '#0F0F0F',
    ground: get('--color-canvas-ground') || '#2A2A2A',
    groundFill: get('--color-canvas-ground-fill') || '#151515',
    creature: get('--color-creature-default') || '#AAAAAA',
    sine: get('--color-creature-sine') || '#8899AA',
    cpg: get('--color-creature-cpg') || '#88AA99',
    cpg_nn: get('--color-creature-cpg-nn') || '#AA9988',
    joints: get('--color-text-muted') || 'rgba(255,255,255,0.3)',
    head: get('--color-text-primary') || '#E7E7E7',
    trail: get('--color-text-dim') || 'rgba(255,255,255,0.15)',
  }
}

// Initialize once — will be re-read on theme changes in Phase 6
let COLORS = getThemedColors()

function controllerColor(type: ControllerType): string {
  switch (type) {
    case 'sine': return COLORS.sine
    case 'cpg': return COLORS.cpg
    case 'cpg_nn': return COLORS.cpg_nn
  }
}

import { ParticleSystem } from './ParticleSystem.ts'
import { drawParallaxBackground } from './ParallaxBackground.tsx'
import { FootprintTrailSystem } from './FootprintTrails.tsx'

/* ─── Component ─── */

const LiveCanvas = forwardRef<LiveCanvasHandle, LiveCanvasProps>(function LiveCanvas(
  {
    genes,
    controllerType,
    terrainType = 'flat',
    running = true,
    zoom = 2.5,
    onFrame,
    onFall,
    showTrail = true,
    accentColor,
    label,
    visualMode = 'normal',
    cameraMode = 'follow',
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Mutable state refs (avoid re-renders on every frame)
  const worldRef = useRef<p2.World | null>(null)
  const creatureRef = useRef<Creature | null>(null)
  const controllerRef = useRef<Controller | null>(null)
  const terrainRef = useRef<Terrain | null>(null)
  const timeRef = useRef(0)
  const startXRef = useRef(SPAWN_X)
  const fallenRef = useRef(false)
  const fallReportedRef = useRef(false)
  const runningRef = useRef(running)
  const animRef = useRef(0)
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const particleSysRef = useRef(new ParticleSystem())
  const footprintSysRef = useRef(new FootprintTrailSystem())
  const shakeRef = useRef({ active: false, startTime: 0, intensity: 0 })
  const bestDistanceRef = useRef(0)
  const ambientTimerRef = useRef(0)
  const replayBufferRef = useRef(new ReplayBuffer(300))
  const replayPlaybackRef = useRef<{
    active: boolean
    frames: import('./ReplayBuffer.ts').ReplayFrame[]
    index: number
    speed: number
    accumulator: number
  }>({ active: false, frames: [], index: 0, speed: 0.25, accumulator: 0 })

  // Keep running ref in sync
  useEffect(() => { runningRef.current = running }, [running])

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    push: (force: number) => {
      const creature = creatureRef.current
      if (creature && !fallenRef.current) {
        // Apply backward push (negative X = pushes creature backward)
        creature.torso.applyImpulse([-force, 0])
        // Screen shake with exponential decay
        shakeRef.current = { active: true, startTime: timeRef.current, intensity: Math.min(force / 500, 5) }
        // Push impact particles
        particleSysRef.current.emit(
          creature.torso.position[0],
          creature.torso.position[1],
          'pushImpact',
          { color: accentColor || controllerColor(controllerType) },
        )
        // Audio: push whoosh
        audioEngine.playPushWhoosh(force / 500)
      }
    },
    reset: () => {
      teardownSim()
      setupSim()
    },
    isFallen: () => fallenRef.current,
    getTime: () => timeRef.current,
    getDistance: () => {
      const creature = creatureRef.current
      return creature ? creature.torso.position[0] - startXRef.current : 0
    },
    getReplayBuffer: () => replayBufferRef.current,
    playReplay: (speed: number) => {
      const frames = replayBufferRef.current.getRecentFrames()
      if (frames.length < 2) return
      replayPlaybackRef.current = {
        active: true,
        frames,
        index: 0,
        speed,
        accumulator: 0,
      }
    },
    stopReplay: () => {
      replayPlaybackRef.current.active = false
    },
    isReplaying: () => replayPlaybackRef.current.active,
    getCanvas: () => canvasRef.current,
  }))

  /* ─── Simulation setup/teardown ─── */

  const setupSim = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Reset state
    timeRef.current = 0
    fallenRef.current = false
    fallReportedRef.current = false
    trailRef.current = []
    particleSysRef.current.clear()
    shakeRef.current = { active: false, startTime: 0, intensity: 0 }
    bestDistanceRef.current = 0
    ambientTimerRef.current = 0
    replayBufferRef.current.clear()
    footprintSysRef.current.clear()
    resetCameraState(zoom)

    // Create world
    const world = new p2.World({ gravity: [GRAVITY[0], GRAVITY[1]] })
    const solver = world.solver as p2.GSSolver
    if (solver) {
      solver.iterations = SOLVER_ITERATIONS
      solver.tolerance = 1e-7
    }
    worldRef.current = world

    // Create terrain
    const terrain = createTerrain(terrainType)
    terrainRef.current = terrain

    // Add terrain heightfield
    const terrainMaterial = new p2.Material()
    const heights: number[] = []
    const xMin = -200, xMax = 3000, step = 8
    for (let x = xMin; x <= xMax; x += step) {
      heights.push(terrain.getHeight(x))
    }
    const heightfield = new p2.Heightfield({
      heights, elementWidth: step,
      collisionGroup: COLLISION_GROUP_TERRAIN,
      collisionMask: COLLISION_MASK_TERRAIN,
    })
    heightfield.material = terrainMaterial
    const terrainBody = new p2.Body({ mass: 0, position: [xMin, 0] })
    terrainBody.addShape(heightfield)
    world.addBody(terrainBody)

    // Spawn creature
    const terrainHeight = terrain.getHeight(SPAWN_X)
    const totalLegExtent = TORSO_HEIGHT / 2 + UPPER_LEG_LENGTH + LOWER_LEG_LENGTH + FOOT_HEIGHT
    const spawnY = terrainHeight + totalLegExtent + SPAWN_MARGIN

    // For sine controller, decode as joint params. For CPG/CPG+NN, use dummy params.
    let jointParams: JointParam[]
    if (controllerType === 'sine') {
      jointParams = decodeDirect(genes)
    } else {
      // Dummy params — motors will be driven by setMotorTargets() instead of updateMotors()
      jointParams = Array(6).fill({ amplitude: 0, frequency: 1, phase: 0 })
    }

    const creature = new Creature(world, SPAWN_X, spawnY, jointParams)
    creatureRef.current = creature
    startXRef.current = SPAWN_X

    // Contact material
    const footTerrainContact = new p2.ContactMaterial(
      creature.footMaterial, terrainMaterial,
      { friction: FOOT_FRICTION, restitution: 0.1 },
    )
    world.addContactMaterial(footTerrainContact)
    world.defaultContactMaterial.friction = 0.5
    world.defaultContactMaterial.restitution = 0.2

    // Create controller
    controllerRef.current = createController(genes, controllerType)
  }, [genes, controllerType, terrainType])

  const teardownSim = useCallback(() => {
    if (creatureRef.current && worldRef.current) {
      creatureRef.current.destroy()
    }
    creatureRef.current = null
    worldRef.current = null
    controllerRef.current = null
    terrainRef.current = null
  }, [])

  /* ─── Physics step ─── */

  const stepPhysics = useCallback(() => {
    const world = worldRef.current
    const creature = creatureRef.current
    const controller = controllerRef.current
    const terrain = terrainRef.current
    if (!world || !creature || !controller || !terrain) return

    const t = timeRef.current

    // Get controller targets
    if (controllerType === 'sine') {
      // Sine uses the built-in updateMotors
      creature.updateMotors(t)
    } else {
      // CPG / CPG+NN use external controller
      const footContacts = detectFootContacts(creature, terrain.getHeight.bind(terrain))
      const sensors = getSensors(creature, footContacts)
      const { targets } = controller.getTargets(t, DT, sensors)
      creature.setMotorTargets(targets, t)
    }

    // Step physics
    world.step(DT)

    // Clamp velocities
    creature.clampVelocities()

    // NaN check
    if (creature.hasNaN()) {
      fallenRef.current = true
      return
    }

    // Fall detection: torso tilt > 80° or torso below terrain
    const torsoAngle = Math.abs(creature.torso.angle)
    const torsoY = creature.torso.position[1]
    const terrainY = terrain.getHeight(creature.torso.position[0])
    if (torsoAngle > Math.PI * 0.44 || torsoY < terrainY + TORSO_HEIGHT / 2 - 5) {
      fallenRef.current = true
      if (!fallReportedRef.current) {
        fallReportedRef.current = true
        onFall?.()
      }
    }

    const ps = particleSysRef.current

    // Foot dust particles + footprint trails
    const footContacts = detectFootContacts(creature, terrain.getHeight.bind(terrain), 4)
    if (footContacts.foot_L || footContacts.foot_R) {
      for (const foot of creature.feet) {
        const fy = foot.position[1]
        const ty = terrain.getHeight(foot.position[0])
        if (fy - ty < 4) {
          // Footprint trail
          footprintSysRef.current.addFootprint(foot.position[0], ty)
          // Audio: footstep click
          audioEngine.playFootstep()
          // Foot dust particles
          if (Math.abs(foot.velocity[0]) > 10) {
            ps.emit(foot.position[0], ty + 1, 'footDust')
          }
        }
      }
    }

    // Crash debris on fall
    if (fallenRef.current && !fallReportedRef.current) {
      ps.emit(creature.torso.position[0], creature.torso.position[1], 'crashDebris')
      audioEngine.playCrash()
    }

    // Fitness record sparkle
    const currentDist = creature.torso.position[0] - startXRef.current
    if (currentDist > bestDistanceRef.current + 50) {
      bestDistanceRef.current = currentDist
      const color = accentColor || controllerColor(controllerType)
      ps.emitWithColor(creature.torso.position[0], creature.torso.position[1], 'fitnessRecord', color)
      audioEngine.playFitnessRecord()
    }

    // Speed lines at high velocity
    const speed = Math.abs(creature.torso.velocity[0])
    if (speed > 80) {
      ps.emit(
        creature.torso.position[0] - 20,
        creature.torso.position[1],
        'speedLines',
      )
    }

    // Ambient dust (spawn every ~0.5s)
    ambientTimerRef.current += DT
    if (ambientTimerRef.current > 0.5) {
      ambientTimerRef.current = 0
      const groundY = terrain.getHeight(creature.torso.position[0] + (Math.random() - 0.5) * 200)
      ps.emit(
        creature.torso.position[0] + (Math.random() - 0.5) * 200,
        groundY + 2,
        'ambientDust',
      )
    }

    // Update particles
    ps.step(DT)

    // Ghost trail
    if (showTrail) {
      trailRef.current.push({
        x: creature.torso.position[0],
        y: creature.torso.position[1],
      })
      if (trailRef.current.length > 30) {
        trailRef.current.shift()
      }
    }

    // Record frame for replay
    replayBufferRef.current.recordFromBodies(
      creature.bodies,
      timeRef.current,
      fallenRef.current,
    )

    timeRef.current += DT
  }, [controllerType, onFall, showTrail, accentColor])

  /* ─── Canvas2D drawing ─── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const creature = creatureRef.current
    const terrain = terrainRef.current
    if (!canvas || !creature || !terrain) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const color = accentColor || controllerColor(controllerType)

    // Camera: use mode system
    const camState = getCameraState(cameraMode, {
      creatureX: creature.torso.position[0],
      creatureY: creature.torso.position[1],
      terrainHeight: terrain.getHeight(creature.torso.position[0]),
      time: timeRef.current,
      baseZoom: zoom,
      pushActive: shakeRef.current.active,
      pushTime: shakeRef.current.startTime,
      startX: startXRef.current,
    })
    let cameraX = camState.x
    const cameraY = camState.y
    const effectiveZoom = camState.zoom

    // Screen shake — exponential decay with separate X/Y frequencies
    let shakeX = 0, shakeY = 0
    const shake = shakeRef.current
    if (shake.active) {
      const elapsed = timeRef.current - shake.startTime
      if (elapsed > 0.5) {
        shake.active = false
      } else {
        const decay = Math.exp(-elapsed * 8) // exponential decay
        const freqX = 25 // different frequencies for organic feel
        const freqY = 33
        shakeX = Math.sin(elapsed * freqX) * shake.intensity * decay
        shakeY = Math.cos(elapsed * freqY) * shake.intensity * decay * 0.7
      }
    }

    // World-to-screen transform
    const toScreenX = (wx: number) => (wx - cameraX) * effectiveZoom + w / 2 + shakeX
    const toScreenY = (wy: number) => h / 2 - (wy - cameraY) * effectiveZoom + shakeY

    // Clear
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, w, h)

    // Parallax background (behind everything)
    drawParallaxBackground(ctx, cameraX, w, h, true, COLORS.ground)

    // Draw terrain
    ctx.beginPath()
    const terrainXMin = cameraX - w / effectiveZoom / 2 - 50
    const terrainXMax = cameraX + w / effectiveZoom / 2 + 50
    ctx.moveTo(toScreenX(terrainXMin), toScreenY(terrain.getHeight(terrainXMin)))
    for (let x = terrainXMin; x <= terrainXMax; x += 4) {
      ctx.lineTo(toScreenX(x), toScreenY(terrain.getHeight(x)))
    }
    // Fill below terrain
    ctx.lineTo(toScreenX(terrainXMax), h + 10)
    ctx.lineTo(toScreenX(terrainXMin), h + 10)
    ctx.closePath()
    ctx.fillStyle = COLORS.groundFill
    ctx.fill()

    // Terrain surface line
    ctx.beginPath()
    ctx.moveTo(toScreenX(terrainXMin), toScreenY(terrain.getHeight(terrainXMin)))
    for (let x = terrainXMin; x <= terrainXMax; x += 4) {
      ctx.lineTo(toScreenX(x), toScreenY(terrain.getHeight(x)))
    }
    ctx.strokeStyle = COLORS.ground
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw footprint trails on the ground
    footprintSysRef.current.draw(ctx, toScreenX, toScreenY, effectiveZoom)

    // Draw ghost trail
    if (showTrail && trailRef.current.length > 1) {
      const trail = trailRef.current
      for (let i = 1; i < trail.length; i++) {
        const alpha = (i / trail.length) * 0.3
        ctx.beginPath()
        ctx.moveTo(toScreenX(trail[i - 1].x), toScreenY(trail[i - 1].y))
        ctx.lineTo(toScreenX(trail[i].x), toScreenY(trail[i].y))
        ctx.strokeStyle = color.replace(')', `,${alpha})`).replace('rgb', 'rgba')
        // Convert hex to rgba for trail
        ctx.globalAlpha = alpha
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    // Draw particles
    particleSysRef.current.draw(ctx, toScreenX, toScreenY, effectiveZoom)

    // Draw creature (mode-dependent)
    if (visualMode === 'xray') {
      drawXRay(ctx, creature, toScreenX, toScreenY, effectiveZoom, color)
    } else if (visualMode === 'heatmap') {
      // Use accent hex for heatmap — derive from CSS variable
      const accentHex = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#E7E7E7'
      drawHeatmap(ctx, creature, toScreenX, toScreenY, effectiveZoom, accentHex)
    } else if (visualMode === 'blueprint') {
      drawBlueprint(ctx, creature, toScreenX, toScreenY, effectiveZoom, color, w, h)
    } else if (visualMode === 'inkwash') {
      drawInkWash(ctx, creature, toScreenX, toScreenY, effectiveZoom, color)
    } else {
      drawCreature(ctx, creature, toScreenX, toScreenY, effectiveZoom, color)
    }

    // Label
    if (label) {
      ctx.font = '600 11px "Inter", sans-serif'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.fillText(label, w / 2, 20)
    }

    // Distance indicator
    const dist = creature.torso.position[0] - startXRef.current
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.fillStyle = COLORS.trail
    ctx.textAlign = 'left'
    ctx.fillText(`${dist.toFixed(0)} px`, 10, h - 10)
  }, [controllerType, zoom, accentColor, label, showTrail, visualMode, cameraMode])

  /* ─── Animation loop ─── */

  useEffect(() => {
    setupSim()

    const loop = () => {
      const replay = replayPlaybackRef.current
      const creature = creatureRef.current

      if (replay.active && creature) {
        // Replay mode — advance through recorded frames at reduced speed
        replay.accumulator += replay.speed
        while (replay.accumulator >= 1 && replay.index < replay.frames.length - 1) {
          replay.index++
          replay.accumulator -= 1
        }

        // Apply replay frame positions to creature bodies
        const frame = replay.frames[replay.index]
        if (frame) {
          const bodies = creature.bodies
          for (let i = 0; i < Math.min(frame.bodies.length, bodies.length); i++) {
            bodies[i].position[0] = frame.bodies[i].x
            bodies[i].position[1] = frame.bodies[i].y
            bodies[i].angle = frame.bodies[i].angle
          }
        }

        // End replay when we reach the last frame
        if (replay.index >= replay.frames.length - 1) {
          replay.active = false
        }
      } else if (runningRef.current && !fallenRef.current) {
        stepPhysics()
      }

      draw()

      // Report frame state
      if (creature) {
        onFrame?.({
          time: timeRef.current,
          distance: creature.torso.position[0] - startXRef.current,
          torsoAngle: creature.torso.angle,
          fallen: fallenRef.current,
        })
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animRef.current)
      teardownSim()
    }
  }, [setupSim, teardownSim, stepPhysics, draw, onFrame])

  /* ─── Canvas sizing ─── */

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      // Set canvas buffer to CSS pixel size (1:1).
      // DPR scaling is skipped intentionally — the draw() loop uses
      // canvas.width/height directly for coordinate math, so the buffer
      // must match CSS dimensions. Retina sharpness isn't critical for
      // a stick-figure physics simulation.
      canvas.width = rect.width
      canvas.height = rect.height
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // Re-read theme colors when data-theme changes
    COLORS = getThemedColors()
    const themeObserver = new MutationObserver(() => {
      COLORS = getThemedColors()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      observer.disconnect()
      themeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: 200 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  )
})

export default LiveCanvas

/* ─── Canvas2D creature drawing ─── */

function drawCreature(
  ctx: CanvasRenderingContext2D,
  creature: Creature,
  toScreenX: (wx: number) => number,
  toScreenY: (wy: number) => number,
  zoom: number,
  color: string,
) {
  const tx = creature.torso.position[0]
  const ty = creature.torso.position[1]
  const ta = creature.torso.angle

  const halfW = TORSO_WIDTH / 2
  const halfH = TORSO_HEIGHT / 2

  // Helper: rotate local point by torso angle
  const rot = (lx: number, ly: number) => ({
    x: tx + lx * Math.cos(ta) - ly * Math.sin(ta),
    y: ty + lx * Math.sin(ta) + ly * Math.cos(ta),
  })

  // Torso endpoints
  const tl = rot(-halfW, 0)
  const tr = rot(halfW, 0)

  // Head
  const headPos = rot(0, halfH + 7)

  // Draw torso bar
  ctx.beginPath()
  ctx.moveTo(toScreenX(tl.x), toScreenY(tl.y))
  ctx.lineTo(toScreenX(tr.x), toScreenY(tr.y))
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(2, 2 * zoom * 0.3)
  ctx.lineCap = 'round'
  ctx.stroke()

  // Draw head
  ctx.beginPath()
  ctx.arc(toScreenX(headPos.x), toScreenY(headPos.y), 5 * zoom * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  // Draw limbs from p2 body positions
  const bodies = creature.bodies
  // Body layout: [0]=torso, [1]=upperLegL, [2]=lowerLegL, [3]=footL,
  //              [4]=upperLegR, [5]=lowerLegR, [6]=footR,
  //              [7]=upperArmL, [8]=lowerArmL, [9]=upperArmR, [10]=lowerArmR

  // Leg chains
  const hipAttachL = rot(-halfW * 0.3, -halfH)
  const hipAttachR = rot(halfW * 0.3, -halfH)

  // Left leg: torso-attach → upper leg center → lower leg center → foot center
  if (bodies.length > 3) {
    drawLimb(ctx, toScreenX, toScreenY, zoom, color,
      hipAttachL,
      { x: bodies[1].position[0], y: bodies[1].position[1] },
      { x: bodies[2].position[0], y: bodies[2].position[1] },
      { x: bodies[3].position[0], y: bodies[3].position[1] },
    )
  }

  // Right leg
  if (bodies.length > 6) {
    drawLimb(ctx, toScreenX, toScreenY, zoom, color,
      hipAttachR,
      { x: bodies[4].position[0], y: bodies[4].position[1] },
      { x: bodies[5].position[0], y: bodies[5].position[1] },
      { x: bodies[6].position[0], y: bodies[6].position[1] },
    )
  }

  // Arm chains
  const shoulderAttachL = rot(-halfW * 0.45, halfH * 0.5)
  const shoulderAttachR = rot(halfW * 0.45, halfH * 0.5)

  // Left arm: torso-attach → upper arm center → lower arm center
  if (bodies.length > 8) {
    drawArmChain(ctx, toScreenX, toScreenY, zoom, color,
      shoulderAttachL,
      { x: bodies[7].position[0], y: bodies[7].position[1] },
      { x: bodies[8].position[0], y: bodies[8].position[1] },
    )
  }

  // Right arm
  if (bodies.length > 10) {
    drawArmChain(ctx, toScreenX, toScreenY, zoom, color,
      shoulderAttachR,
      { x: bodies[9].position[0], y: bodies[9].position[1] },
      { x: bodies[10].position[0], y: bodies[10].position[1] },
    )
  }

  // Joint dots
  const jointDotRadius = 1.5 * zoom * 0.3
  for (let i = 1; i < Math.min(bodies.length, 11); i++) {
    if (i === 0 || i === 3 || i === 6) continue // skip torso and feet
    ctx.beginPath()
    ctx.arc(
      toScreenX(bodies[i].position[0]),
      toScreenY(bodies[i].position[1]),
      jointDotRadius, 0, Math.PI * 2,
    )
    ctx.fillStyle = COLORS.joints
    ctx.fill()
  }
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  zoom: number,
  color: string,
  attach: { x: number; y: number },
  upper: { x: number; y: number },
  lower: { x: number; y: number },
  foot: { x: number; y: number },
) {
  ctx.beginPath()
  ctx.moveTo(toScreenX(attach.x), toScreenY(attach.y))
  ctx.lineTo(toScreenX(upper.x), toScreenY(upper.y))
  ctx.lineTo(toScreenX(lower.x), toScreenY(lower.y))
  ctx.lineTo(toScreenX(foot.x), toScreenY(foot.y))
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.2, 1.2 * zoom * 0.3)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawArmChain(
  ctx: CanvasRenderingContext2D,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  zoom: number,
  color: string,
  attach: { x: number; y: number },
  upper: { x: number; y: number },
  lower: { x: number; y: number },
) {
  ctx.beginPath()
  ctx.moveTo(toScreenX(attach.x), toScreenY(attach.y))
  ctx.lineTo(toScreenX(upper.x), toScreenY(upper.y))
  ctx.lineTo(toScreenX(lower.x), toScreenY(lower.y))
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, 1 * zoom * 0.3)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}
