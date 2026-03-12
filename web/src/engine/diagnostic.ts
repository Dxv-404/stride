/**
 * Diagnostic — verify motors now work with correct p2.js API.
 * Run: npx tsx src/engine/diagnostic.ts
 */
// @ts-expect-error — diagnostic.ts is a Node.js script, 'module' is a Node built-in not available in browser builds
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const p2 = require('p2')

import { decodeChromosome } from './encoding.ts'
import type { JointParam } from './encoding.ts'
import {
  GRAVITY, DT, SIM_STEPS, SOLVER_ITERATIONS, Y_MIN, Y_MAX,
  TORSO_HEIGHT, TORSO_WIDTH, TORSO_MASS,
  UPPER_LEG_LENGTH, LOWER_LEG_LENGTH, FOOT_HEIGHT, FOOT_WIDTH,
  UPPER_LEG_MASS, LOWER_LEG_MASS, FOOT_MASS,
  UPPER_ARM_LENGTH, LOWER_ARM_LENGTH, UPPER_ARM_MASS, LOWER_ARM_MASS,
  LIMB_WIDTH,
  HIP_LIMIT, KNEE_LIMIT, SHOULDER_LIMIT, ANKLE_LIMIT,
  PD_KP, PD_KD, MOTOR_MAX_FORCE,
  ELBOW_STIFFNESS, ELBOW_DAMPING,
  ANKLE_STIFFNESS, ANKLE_DAMPING,
  MAX_VELOCITY,
  SPAWN_X, SPAWN_MARGIN,
  STUCK_THRESHOLD, STUCK_WINDOW,
  FALL_MARGIN, FOOT_FRICTION,
  COLLISION_GROUP_TERRAIN, COLLISION_GROUP_CREATURE,
  COLLISION_MASK_TERRAIN, COLLISION_MASK_CREATURE,
  GROUND_BASE_HEIGHT,
} from './config.ts'

function createLimbBody(length: number, mass: number, x: number, y: number): any {
  const body = new p2.Body({ mass, position: [x, y] })
  const shape = new p2.Box({ width: LIMB_WIDTH, height: length })
  shape.collisionGroup = COLLISION_GROUP_CREATURE
  shape.collisionMask = COLLISION_MASK_CREATURE
  body.addShape(shape)
  return body
}

interface MotorJoint { name: string; constraint: any; param: JointParam }

function runSim(jointParams: JointParam[]): {
  distance: number; totalEnergy: number; fallCount: number; uprightness: number
  aborted: boolean; stepsSimulated: number; torsoXHistory: number[]
} {
  const world = new p2.World({ gravity: [0, GRAVITY[1]] })
  world.solver.iterations = SOLVER_ITERATIONS; world.solver.tolerance = 1e-7

  // Terrain
  const xMin = -200, xMax = 3000, step = 8
  const tMat = new p2.Material()
  const heights: number[] = []
  for (let x = xMin; x <= xMax; x += step) heights.push(GROUND_BASE_HEIGHT)
  const hf = new p2.Heightfield({ heights, elementWidth: step })
  hf.collisionGroup = COLLISION_GROUP_TERRAIN; hf.collisionMask = COLLISION_MASK_TERRAIN; hf.material = tMat
  const tb = new p2.Body({ mass: 0, position: [xMin, 0] })
  tb.addShape(hf); world.addBody(tb)

  // Torso
  const spawnY = GROUND_BASE_HEIGHT + TORSO_HEIGHT / 2 + UPPER_LEG_LENGTH + LOWER_LEG_LENGTH + FOOT_HEIGHT + SPAWN_MARGIN
  const torso = new p2.Body({ mass: TORSO_MASS, position: [SPAWN_X, spawnY] })
  const torsoShape = new p2.Box({ width: TORSO_WIDTH, height: TORSO_HEIGHT })
  torsoShape.collisionGroup = COLLISION_GROUP_CREATURE; torsoShape.collisionMask = COLLISION_MASK_CREATURE
  torso.addShape(torsoShape); world.addBody(torso)

  const allBodies: any[] = [torso]
  const motors: MotorJoint[] = []
  const fMat = new p2.Material()
  const thw = TORSO_WIDTH / 2, thh = TORSO_HEIGHT / 2

  // Legs (using correct motor API!)
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? -1 : 1
    const hipX = SPAWN_X + sign * (thw * 0.3)
    const ul = createLimbBody(UPPER_LEG_LENGTH, UPPER_LEG_MASS, hipX, spawnY - thh - UPPER_LEG_LENGTH / 2)
    world.addBody(ul); allBodies.push(ul)
    const hj = new p2.RevoluteConstraint(torso, ul, { localPivotA: [sign * (thw * 0.3), -thh], localPivotB: [0, UPPER_LEG_LENGTH / 2], collideConnected: false })
    hj.setLimits(HIP_LIMIT[0], HIP_LIMIT[1]); hj.lowerLimitEnabled = true; hj.upperLimitEnabled = true
    // CORRECT API: enableMotor() + motorEquation force limits
    hj.enableMotor()
    hj.motorEquation.maxForce = MOTOR_MAX_FORCE
    hj.motorEquation.minForce = -MOTOR_MAX_FORCE
    hj.setMotorSpeed(0)
    world.addConstraint(hj)
    motors.push({ name: `hip_${side}`, constraint: hj, param: jointParams[side === 'L' ? 0 : 1] })

    const ll = createLimbBody(LOWER_LEG_LENGTH, LOWER_LEG_MASS, hipX, spawnY - thh - UPPER_LEG_LENGTH - LOWER_LEG_LENGTH / 2)
    world.addBody(ll); allBodies.push(ll)
    const kj = new p2.RevoluteConstraint(ul, ll, { localPivotA: [0, -UPPER_LEG_LENGTH / 2], localPivotB: [0, LOWER_LEG_LENGTH / 2], collideConnected: false })
    kj.setLimits(KNEE_LIMIT[0], KNEE_LIMIT[1]); kj.lowerLimitEnabled = true; kj.upperLimitEnabled = true
    kj.enableMotor()
    kj.motorEquation.maxForce = MOTOR_MAX_FORCE
    kj.motorEquation.minForce = -MOTOR_MAX_FORCE
    kj.setMotorSpeed(0)
    world.addConstraint(kj)
    motors.push({ name: `knee_${side}`, constraint: kj, param: jointParams[side === 'L' ? 2 : 3] })

    const fb = new p2.Body({ mass: FOOT_MASS, position: [hipX, spawnY - thh - UPPER_LEG_LENGTH - LOWER_LEG_LENGTH - FOOT_HEIGHT / 2] })
    const fs = new p2.Box({ width: FOOT_WIDTH, height: FOOT_HEIGHT })
    fs.material = fMat; fs.collisionGroup = COLLISION_GROUP_CREATURE; fs.collisionMask = COLLISION_MASK_CREATURE
    fb.addShape(fs); world.addBody(fb); allBodies.push(fb)
    const aj = new p2.RevoluteConstraint(ll, fb, { localPivotA: [0, -LOWER_LEG_LENGTH / 2], localPivotB: [0, FOOT_HEIGHT / 2], collideConnected: false })
    aj.setLimits(ANKLE_LIMIT[0], ANKLE_LIMIT[1]); aj.lowerLimitEnabled = true; aj.upperLimitEnabled = true
    world.addConstraint(aj)
    world.addSpring(new p2.RotationalSpring(ll, fb, { restAngle: 0, stiffness: ANKLE_STIFFNESS, damping: ANKLE_DAMPING }))
  }

  // Arms
  for (const side of ['L', 'R'] as const) {
    const sign = side === 'L' ? -1 : 1
    const sx = SPAWN_X + sign * (thw * 0.45)
    const ua = createLimbBody(UPPER_ARM_LENGTH, UPPER_ARM_MASS, sx, spawnY + thh - UPPER_ARM_LENGTH / 2)
    world.addBody(ua); allBodies.push(ua)
    const sj = new p2.RevoluteConstraint(torso, ua, { localPivotA: [sign * (thw * 0.45), thh * 0.5], localPivotB: [0, UPPER_ARM_LENGTH / 2], collideConnected: false })
    sj.setLimits(SHOULDER_LIMIT[0], SHOULDER_LIMIT[1]); sj.lowerLimitEnabled = true; sj.upperLimitEnabled = true
    sj.enableMotor()
    sj.motorEquation.maxForce = MOTOR_MAX_FORCE
    sj.motorEquation.minForce = -MOTOR_MAX_FORCE
    sj.setMotorSpeed(0)
    world.addConstraint(sj)
    motors.push({ name: `shoulder_${side}`, constraint: sj, param: jointParams[side === 'L' ? 4 : 5] })
    const la = createLimbBody(LOWER_ARM_LENGTH, LOWER_ARM_MASS, sx, spawnY + thh - UPPER_ARM_LENGTH - LOWER_ARM_LENGTH / 2)
    world.addBody(la); allBodies.push(la)
    const ej = new p2.RevoluteConstraint(ua, la, { localPivotA: [0, -UPPER_ARM_LENGTH / 2], localPivotB: [0, LOWER_ARM_LENGTH / 2], collideConnected: false })
    ej.setLimits(-Math.PI / 2, Math.PI / 2); ej.lowerLimitEnabled = true; ej.upperLimitEnabled = true
    world.addConstraint(ej)
    world.addSpring(new p2.RotationalSpring(ua, la, { restAngle: 0, stiffness: ELBOW_STIFFNESS, damping: ELBOW_DAMPING }))
  }

  for (let i = 0; i < allBodies.length; i++) for (let j = i + 1; j < allBodies.length; j++) world.disableBodyCollision(allBodies[i], allBodies[j])
  world.addContactMaterial(new p2.ContactMaterial(fMat, tMat, { friction: FOOT_FRICTION, restitution: 0.1 }))
  world.defaultContactMaterial.friction = 0.5; world.defaultContactMaterial.restitution = 0.2

  // Simulation loop with CORRECT motor API
  const torsoXHistory: number[] = []
  const startX = torso.position[0]
  let totalEnergy = 0, fallCount = 0, uprightSteps = 0, aborted = false, stepsSimulated = 0
  const GRACE_STEPS = 90, MOTOR_RAMP = 1.0
  const stuckWindowSteps = Math.round(STUCK_WINDOW / DT)
  let lastCheckX = startX, stepsSinceCheck = 0

  for (let s = 0; s < SIM_STEPS; s++) {
    const t = s * DT
    const ramp = Math.min(t / MOTOR_RAMP, 1.0)

    for (const joint of motors) {
      const { amplitude, frequency, phase } = joint.param
      const targetAngle = ramp * amplitude * Math.sin(2 * Math.PI * frequency * t + phase)
      const currentAngle = joint.constraint.angle
      const error = targetAngle - currentAngle
      const angVelA = joint.constraint.bodyA.angularVelocity
      const angVelB = joint.constraint.bodyB.angularVelocity
      const errorDot = -(angVelB - angVelA)
      // NEGATED: p2.js positive motorSpeed = CW = decreasing angle
      const motorSpeed = -(PD_KP * error + PD_KD * errorDot)
      joint.constraint.setMotorSpeed(motorSpeed)
    }

    world.step(DT)

    for (const body of allBodies) {
      const spd = Math.sqrt(body.velocity[0] ** 2 + body.velocity[1] ** 2)
      if (spd > MAX_VELOCITY) { const sc = MAX_VELOCITY / spd; body.velocity[0] *= sc; body.velocity[1] *= sc }
      if (Math.abs(body.angularVelocity) > 20) body.angularVelocity = Math.sign(body.angularVelocity) * 20
    }

    let hasNaN = false
    for (const b of allBodies) { if (isNaN(b.position[0]) || isNaN(b.position[1])) { hasNaN = true; break } }
    if (hasNaN) { aborted = true; break }
    const torsoY = torso.position[1]
    if (torsoY < Y_MIN || torsoY > Y_MAX) { aborted = true; break }

    torsoXHistory.push(torso.position[0])
    stepsSimulated = s + 1
    for (const j of motors) totalEnergy += Math.abs(j.constraint.getMotorSpeed()) * DT
    if (torsoY < GROUND_BASE_HEIGHT + TORSO_HEIGHT / 2 + FALL_MARGIN) fallCount++
    if (Math.abs(torso.angle) < Math.PI / 4) uprightSteps++
    if (s < GRACE_STEPS) continue
    stepsSinceCheck++
    if (stepsSinceCheck >= stuckWindowSteps) {
      if (Math.abs(torso.position[0] - lastCheckX) < STUCK_THRESHOLD) { aborted = true; break }
      lastCheckX = torso.position[0]; stepsSinceCheck = 0
    }
  }

  const finalX = stepsSimulated > 0 ? torsoXHistory[torsoXHistory.length - 1] : startX
  return {
    distance: finalX - startX, totalEnergy, fallCount,
    uprightness: stepsSimulated > 0 ? uprightSteps / stepsSimulated : 0,
    aborted, stepsSimulated, torsoXHistory,
  }
}

// ─── Gene patterns ───
const genes: Record<string, number[]> = {
  'no_amp':       [0.0,0.5,0.0, 0.0,0.5,0.5, 0.0,0.5,0.25, 0.0,0.5,0.75, 0.0,0.3,0.0, 0.0,0.3,0.5],
  'walk':         [0.4,0.5,0.0, 0.4,0.5,0.5, 0.3,0.5,0.25, 0.3,0.5,0.75, 0.1,0.3,0.0, 0.1,0.3,0.5],
  'hi_freq':      [0.3,1.0,0.0, 0.3,1.0,0.5, 0.2,1.0,0.25, 0.2,1.0,0.75, 0.1,1.0,0.0, 0.1,1.0,0.5],
  'small':        [0.1,0.5,0.0, 0.1,0.5,0.5, 0.08,0.5,0.25, 0.08,0.5,0.75, 0.05,0.3,0.0, 0.05,0.3,0.5],
  'all_ones':     new Array(18).fill(1),
  'all_zeros':    new Array(18).fill(0),
}

console.log(`Config: GRAVITY=${GRAVITY[1]}, MOTOR_MAX_FORCE=${MOTOR_MAX_FORCE}, PD_KP=${PD_KP}, PD_KD=${PD_KD}`)
console.log(`  FOOT_WIDTH=${FOOT_WIDTH}, SPAWN_MARGIN=${SPAWN_MARGIN}, SOLVER_ITERATIONS=${SOLVER_ITERATIONS}`)
console.log()

console.log('═══ SIMULATION RESULTS (with WORKING motors!) ═══\n')
const dists: number[] = []
for (const [name, g] of Object.entries(genes)) {
  const jp = decodeChromosome(g, 'direct')
  const r = runSim(jp)
  dists.push(r.distance)
  console.log(`  ${name.padEnd(12)} | dist: ${r.distance.toFixed(1).padStart(7)} | energy: ${r.totalEnergy.toFixed(0).padStart(7)} | falls: ${r.fallCount.toString().padStart(4)} | upright: ${r.uprightness.toFixed(2)} | steps: ${r.stepsSimulated.toString().padStart(3)} | abort: ${r.aborted}`)
}
const unique = new Set(dists.map(d => d.toFixed(1)))
console.log(`\n  → ${unique.size} unique distances out of ${dists.length} patterns ${unique.size > 1 ? '✅ GENES MATTER!' : '❌ All identical'}`)

// Torso X trajectories
console.log('\n═══ TORSO X AT KEY STEPS ═══\n')
for (const [name, g] of Object.entries(genes)) {
  const jp = decodeChromosome(g, 'direct')
  const r = runSim(jp)
  const xAt = (s: number) => s < r.torsoXHistory.length ? r.torsoXHistory[s].toFixed(1) : 'N/A'
  console.log(`  ${name.padEnd(12)} | s30: ${xAt(30).padStart(7)} | s60: ${xAt(60).padStart(7)} | s90: ${xAt(90).padStart(7)} | s120: ${xAt(120).padStart(7)} | s180: ${xAt(180).padStart(7)} | s240: ${xAt(240).padStart(7)}`)
}

console.log('\n═══ DONE ═══')
