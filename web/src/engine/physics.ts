/**
 * Physics simulation -- creates a p2.js world, spawns a creature,
 * runs the physics loop, and returns walk frames + raw results.
 *
 * Ported from Python physics_sim.py.
 *
 * Browser version: 5 s at 60 fps = 300 steps (Python: 10 s = 600 steps).
 * Solver iterations reduced to 10 (Python: 20) for performance.
 */

import * as p2 from 'p2'
import { Creature } from './creature.ts'
import type { Terrain } from './terrain.ts'
import type { JointParam } from './encoding.ts'
import type { CreatureFrame } from './types.ts'
import {
  GRAVITY,
  DT,
  SIM_STEPS,
  SOLVER_ITERATIONS,
  Y_MIN,
  Y_MAX,
  TORSO_HEIGHT,
  UPPER_LEG_LENGTH,
  LOWER_LEG_LENGTH,
  FOOT_HEIGHT,
  SPAWN_X,
  SPAWN_MARGIN,
  STUCK_THRESHOLD,
  STUCK_WINDOW,
  FALL_MARGIN,
  FOOT_FRICTION,
  COLLISION_GROUP_TERRAIN,
  COLLISION_MASK_TERRAIN,
} from './config.ts'

/* ─── Simulation result ─── */

export interface SimulationResult {
  /** Recorded frames for playback (one per physics step) */
  frames: CreatureFrame[]
  /** Final torso X position */
  finalX: number
  /** Starting torso X position */
  startX: number
  /** Net horizontal distance traveled */
  distance: number
  /** Cumulative absolute motor torque (energy proxy) */
  totalEnergy: number
  /** Number of times the creature fell */
  fallCount: number
  /** Fraction of time torso was upright (|angle| < pi/4) */
  uprightness: number
  /** Whether simulation was aborted early (NaN, out-of-bounds, stuck) */
  aborted: boolean
  /** Number of steps actually simulated */
  stepsSimulated: number
  /** Per-step torso X positions for velocity bonus calculation */
  torsoXHistory: number[]
}

/* ─── Add terrain to world ─── */

/**
 * Create a static Heightfield body for terrain and add it to the world.
 *
 * Uses p2.Heightfield instead of p2.Line because Heightfield properly
 * collides with Box shapes (creature limbs). Line shapes have unreliable
 * collision with Box — creatures fall through them.
 *
 * The Heightfield represents an infinitely-deep solid below the surface,
 * so nothing can tunnel through it regardless of velocity.
 */
function addTerrainToWorld(
  world: p2.World,
  terrain: Terrain,
  xMin = -200,
  xMax = 3000,
  step = 8,
): { body: p2.Body; material: p2.Material } {
  const terrainMaterial = new p2.Material()

  // Sample terrain heights at regular intervals using getHeight()
  // (can't rely on getPoints — custom terrain returns irregularly spaced control points)
  const heights: number[] = []
  for (let x = xMin; x <= xMax; x += step) {
    heights.push(terrain.getHeight(x))
  }

  const heightfield = new p2.Heightfield({
    heights,
    elementWidth: step,
    collisionGroup: COLLISION_GROUP_TERRAIN,
    collisionMask: COLLISION_MASK_TERRAIN,
  })
  heightfield.material = terrainMaterial

  // Body position = left edge of heightfield; heights extend in +X direction
  const terrainBody = new p2.Body({
    mass: 0,
    position: [xMin, 0],
  })
  terrainBody.addShape(heightfield)

  world.addBody(terrainBody)
  return { body: terrainBody, material: terrainMaterial }
}

/* ─── Main simulation function ─── */

/**
 * Run a complete physics simulation for one creature.
 *
 * @param terrain       Terrain to simulate on
 * @param jointParams   6-element array of decoded joint parameters
 * @param elbowRestAngles  Optional [left, right] elbow spring rest angles
 * @returns SimulationResult with frames, distance, energy, etc.
 */
export function runSimulation(
  terrain: Terrain,
  jointParams: JointParam[],
  elbowRestAngles: [number, number] = [0, 0],
): SimulationResult {
  // --- Create world ---
  const world = new p2.World({
    gravity: [GRAVITY[0], GRAVITY[1]],
  })

  // Configure solver
  const solver = world.solver as p2.GSSolver
  if (solver) {
    solver.iterations = SOLVER_ITERATIONS
    solver.tolerance = 1e-7
  }

  // --- Add terrain ---
  const { material: terrainMaterial } = addTerrainToWorld(world, terrain)

  // --- Compute spawn height ---
  // The creature hangs below the torso center by:
  //   torsoHalfH + upperLeg + lowerLeg + foot
  // We must spawn high enough that the feet clear the terrain.
  const terrainHeight = terrain.getHeight(SPAWN_X)
  const totalLegExtent = TORSO_HEIGHT / 2 + UPPER_LEG_LENGTH + LOWER_LEG_LENGTH + FOOT_HEIGHT
  const spawnY = terrainHeight + totalLegExtent + SPAWN_MARGIN

  // --- Spawn creature ---
  const creature = new Creature(world, SPAWN_X, spawnY, jointParams, elbowRestAngles)

  // --- Set up contact material (foot friction) ---
  const footTerrainContact = new p2.ContactMaterial(
    creature.footMaterial,
    terrainMaterial,
    {
      friction: FOOT_FRICTION,
      restitution: 0.1,
    },
  )
  world.addContactMaterial(footTerrainContact)

  // Also set default friction for non-foot parts
  world.defaultContactMaterial.friction = 0.5
  world.defaultContactMaterial.restitution = 0.2

  // --- Run simulation ---
  const frames: CreatureFrame[] = []
  const torsoXHistory: number[] = []

  const startX = creature.torso.position[0]
  let totalEnergy = 0
  let fallCount = 0
  let uprightSteps = 0
  let aborted = false
  let stepsSimulated = 0

  // Stuck detection grace period: must exceed MOTOR_RAMP_DURATION (1.0s = 60 steps)
  // so creatures aren't penalized during the stabilization ramp
  const GRACE_STEPS = 90 // 1.5 seconds at 60 fps
  const stuckWindowSteps = Math.round(STUCK_WINDOW / DT)
  let lastCheckX = startX
  let stepsSinceCheck = 0

  for (let step = 0; step < SIM_STEPS; step++) {
    const t = step * DT

    // 1. Update motor targets
    creature.updateMotors(t)

    // 2. Step physics
    world.step(DT)

    // 3. Clamp velocities
    creature.clampVelocities()

    // 4. NaN check
    if (creature.hasNaN()) {
      aborted = true
      break
    }

    // 5. Out-of-bounds check
    const torsoY = creature.torso.position[1]
    if (torsoY < Y_MIN || torsoY > Y_MAX) {
      aborted = true
      break
    }

    // 6. Record frame
    const frame = creature.captureFrame()
    frames.push(frame)
    torsoXHistory.push(frame.torsoX)
    stepsSimulated = step + 1

    // 7. Accumulate energy (sum of absolute motor speeds as torque proxy)
    totalEnergy += creature.getTotalMotorTorque() * DT

    // 8. Fall detection: torso center below terrain + half height + margin
    const terrainAtTorso = terrain.getHeight(frame.torsoX)
    const minTorsoY = terrainAtTorso + TORSO_HEIGHT / 2 + FALL_MARGIN
    if (torsoY < minTorsoY) {
      fallCount++
    }

    // 9. Uprightness: |angle| < pi/4
    if (Math.abs(creature.torso.angle) < Math.PI / 4) {
      uprightSteps++
    }

    // 10. Stuck detection (skip grace period for settling)
    if (step < GRACE_STEPS) continue
    stepsSinceCheck++
    if (stepsSinceCheck >= stuckWindowSteps) {
      const currentX = creature.torso.position[0]
      const displacement = Math.abs(currentX - lastCheckX)
      if (displacement < STUCK_THRESHOLD) {
        // Creature is stuck -- end simulation early
        aborted = true
        break
      }
      lastCheckX = currentX
      stepsSinceCheck = 0
    }
  }

  // --- Compute results ---
  const finalX = stepsSimulated > 0
    ? frames[frames.length - 1].torsoX
    : startX

  const distance = finalX - startX
  const uprightness = stepsSimulated > 0 ? uprightSteps / stepsSimulated : 0

  // Cleanup
  creature.destroy()

  return {
    frames,
    finalX,
    startX,
    distance,
    totalEnergy,
    fallCount,
    uprightness,
    aborted,
    stepsSimulated,
    torsoXHistory,
  }
}
