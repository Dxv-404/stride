/**
 * Creature -- builds a stick-figure biped in a p2.js World.
 *
 * Ported from Python creature.py.
 *
 * Body plan:
 *   - 1 torso (60x20 box, mass 5)
 *   - 2 upper legs (30 px, mass 1.5 each)
 *   - 2 lower legs (25 px, mass 1.0 each)
 *   - 2 upper arms (30 px, mass 0.8 each)
 *   - 2 lower arms (25 px, mass 0.5 each)
 *   - 2 feet (20x5 box, mass 0.5 each)
 *
 * Joints:
 *   - 6 motorized (RevoluteConstraint): hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
 *   - 2 spring elbows (RotationalSpring on RevoluteConstraint)
 *   - 2 spring ankles (RotationalSpring on RevoluteConstraint)
 *
 * Motor control uses a PD controller targeting A*sin(2pi*omega*t + phi).
 */

import * as p2 from 'p2'
import type { JointParam } from './encoding.ts'
import type { CreatureFrame } from './types.ts'
import {
  TORSO_WIDTH,
  TORSO_HEIGHT,
  TORSO_MASS,
  UPPER_LEG_LENGTH,
  LOWER_LEG_LENGTH,
  UPPER_ARM_LENGTH,
  LOWER_ARM_LENGTH,
  UPPER_LEG_MASS,
  LOWER_LEG_MASS,
  UPPER_ARM_MASS,
  LOWER_ARM_MASS,
  FOOT_WIDTH,
  FOOT_HEIGHT,
  FOOT_MASS,
  LIMB_WIDTH,
  HIP_LIMIT,
  KNEE_LIMIT,
  SHOULDER_LIMIT,
  ANKLE_LIMIT,
  PD_KP,
  PD_KD,
  MOTOR_MAX_FORCE,
  ELBOW_STIFFNESS,
  ELBOW_DAMPING,
  ANKLE_STIFFNESS,
  ANKLE_DAMPING,
  ANKLE_REST_ANGLE,
  MAX_VELOCITY,
  COLLISION_GROUP_CREATURE,
  COLLISION_MASK_CREATURE,
} from './config.ts'
import { JOINT_NAMES } from './encoding.ts'

/* ─── Helper to create a limb body as a thin Box ─── */

function createLimbBody(
  length: number,
  mass: number,
  x: number,
  y: number,
): p2.Body {
  const body = new p2.Body({
    mass,
    position: [x, y],
  })
  const shape = new p2.Box({ width: LIMB_WIDTH, height: length })
  shape.collisionGroup = COLLISION_GROUP_CREATURE
  shape.collisionMask = COLLISION_MASK_CREATURE
  body.addShape(shape)
  return body
}

/* ─── Motorized joint descriptor ─── */

export interface MotorJoint {
  name: string
  constraint: p2.RevoluteConstraint
  param: JointParam
}

/* ─── Spring joint descriptor ─── */

export interface SpringJoint {
  name: string
  constraint: p2.RevoluteConstraint
  spring: p2.RotationalSpring
}

/* ─── Creature class ─── */

export class Creature {
  /** All p2 bodies belonging to this creature */
  bodies: p2.Body[] = []

  /** The torso body (root of the figure) */
  torso!: p2.Body

  /** Feet bodies (for friction material setup) */
  feet: p2.Body[] = []

  /** 6 motorized joints keyed by JOINT_NAMES */
  motors: Map<string, MotorJoint> = new Map()

  /** 2 spring elbows + 2 spring ankles */
  springs: SpringJoint[] = []

  /** All constraints added to the world */
  constraints: p2.Constraint[] = []

  /** All p2 Springs added to the world */
  p2Springs: p2.Spring[] = []

  /** Foot material for contact-material setup */
  footMaterial: p2.Material

  /** Reference to the world (for cleanup) */
  private world: p2.World

  /**
   * Build the creature at (spawnX, spawnY) in the given world.
   * @param jointParams  6-element array matching JOINT_NAMES order
   * @param elbowRestAngles  optional 2-element [left, right] rest angles for elbow springs
   */
  constructor(
    world: p2.World,
    spawnX: number,
    spawnY: number,
    jointParams: JointParam[],
    elbowRestAngles: [number, number] = [0, 0],
  ) {
    this.world = world
    this.footMaterial = new p2.Material()

    // --- Torso ---
    this.torso = new p2.Body({
      mass: TORSO_MASS,
      position: [spawnX, spawnY],
    })
    const torsoShape = new p2.Box({ width: TORSO_WIDTH, height: TORSO_HEIGHT })
    torsoShape.collisionGroup = COLLISION_GROUP_CREATURE
    torsoShape.collisionMask = COLLISION_MASK_CREATURE
    this.torso.addShape(torsoShape)
    this.addBody(this.torso)

    // Half dimensions for anchor points
    const torsoHalfW = TORSO_WIDTH / 2
    const torsoHalfH = TORSO_HEIGHT / 2

    // --- Build legs (left and right) ---
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? -1 : 1
      const hipX = spawnX + sign * (torsoHalfW * 0.3)

      // Upper leg: hangs below torso
      const upperLeg = createLimbBody(
        UPPER_LEG_LENGTH,
        UPPER_LEG_MASS,
        hipX,
        spawnY - torsoHalfH - UPPER_LEG_LENGTH / 2,
      )
      this.addBody(upperLeg)

      // Hip joint: torso <-> upper leg
      const hipJoint = new p2.RevoluteConstraint(this.torso, upperLeg, {
        localPivotA: [sign * (torsoHalfW * 0.3), -torsoHalfH],
        localPivotB: [0, UPPER_LEG_LENGTH / 2],
        collideConnected: false,
      })
      hipJoint.setLimits(HIP_LIMIT[0], HIP_LIMIT[1])
      hipJoint.lowerLimitEnabled = true
      hipJoint.upperLimitEnabled = true
      this.addConstraint(hipJoint)

      // Enable motor — must use p2's method API, not direct property assignment.
      // Setting .motorEnabled/.motorSpeed directly creates phantom JS properties
      // that p2 never reads; the motor equation never enters the solver.
      hipJoint.enableMotor()
      // @ts-expect-error — p2.js creates motorEquation at runtime via enableMotor(), but @types/p2 lacks it
      hipJoint.motorEquation.maxForce = MOTOR_MAX_FORCE
      // @ts-expect-error — same: motorEquation exists at runtime
      hipJoint.motorEquation.minForce = -MOTOR_MAX_FORCE
      hipJoint.setMotorSpeed(0)

      const hipIdx = side === 'L' ? 0 : 1
      this.motors.set(`hip_${side}`, {
        name: `hip_${side}`,
        constraint: hipJoint,
        param: jointParams[hipIdx],
      })

      // Lower leg
      const lowerLeg = createLimbBody(
        LOWER_LEG_LENGTH,
        LOWER_LEG_MASS,
        hipX,
        spawnY - torsoHalfH - UPPER_LEG_LENGTH - LOWER_LEG_LENGTH / 2,
      )
      this.addBody(lowerLeg)

      // Knee joint: upper leg <-> lower leg
      const kneeJoint = new p2.RevoluteConstraint(upperLeg, lowerLeg, {
        localPivotA: [0, -UPPER_LEG_LENGTH / 2],
        localPivotB: [0, LOWER_LEG_LENGTH / 2],
        collideConnected: false,
      })
      kneeJoint.setLimits(KNEE_LIMIT[0], KNEE_LIMIT[1])
      kneeJoint.lowerLimitEnabled = true
      kneeJoint.upperLimitEnabled = true
      this.addConstraint(kneeJoint)

      kneeJoint.enableMotor()
      // @ts-expect-error — p2.js creates motorEquation at runtime via enableMotor(), but @types/p2 lacks it
      kneeJoint.motorEquation.maxForce = MOTOR_MAX_FORCE
      // @ts-expect-error — same: motorEquation exists at runtime
      kneeJoint.motorEquation.minForce = -MOTOR_MAX_FORCE
      kneeJoint.setMotorSpeed(0)

      const kneeIdx = side === 'L' ? 2 : 3
      this.motors.set(`knee_${side}`, {
        name: `knee_${side}`,
        constraint: kneeJoint,
        param: jointParams[kneeIdx],
      })

      // Foot
      const footBody = new p2.Body({
        mass: FOOT_MASS,
        position: [
          hipX,
          spawnY - torsoHalfH - UPPER_LEG_LENGTH - LOWER_LEG_LENGTH - FOOT_HEIGHT / 2,
        ],
      })
      const footShape = new p2.Box({ width: FOOT_WIDTH, height: FOOT_HEIGHT })
      footShape.material = this.footMaterial
      footShape.collisionGroup = COLLISION_GROUP_CREATURE
      footShape.collisionMask = COLLISION_MASK_CREATURE
      footBody.addShape(footShape)
      this.addBody(footBody)
      this.feet.push(footBody)

      // Ankle joint: lower leg <-> foot (spring, passive)
      const ankleJoint = new p2.RevoluteConstraint(lowerLeg, footBody, {
        localPivotA: [0, -LOWER_LEG_LENGTH / 2],
        localPivotB: [0, FOOT_HEIGHT / 2],
        collideConnected: false,
      })
      ankleJoint.setLimits(ANKLE_LIMIT[0], ANKLE_LIMIT[1])
      ankleJoint.lowerLimitEnabled = true
      ankleJoint.upperLimitEnabled = true
      this.addConstraint(ankleJoint)

      const ankleSpring = new p2.RotationalSpring(lowerLeg, footBody, {
        restAngle: ANKLE_REST_ANGLE,
        stiffness: ANKLE_STIFFNESS,
        damping: ANKLE_DAMPING,
      })
      this.addSpring(ankleSpring)

      this.springs.push({
        name: `ankle_${side}`,
        constraint: ankleJoint,
        spring: ankleSpring,
      })
    }

    // --- Build arms (left and right) ---
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? -1 : 1
      const shoulderX = spawnX + sign * (torsoHalfW * 0.45)

      // Upper arm: extends from top-side of torso
      const upperArm = createLimbBody(
        UPPER_ARM_LENGTH,
        UPPER_ARM_MASS,
        shoulderX,
        spawnY + torsoHalfH - UPPER_ARM_LENGTH / 2,
      )
      this.addBody(upperArm)

      // Shoulder joint: torso <-> upper arm
      const shoulderJoint = new p2.RevoluteConstraint(this.torso, upperArm, {
        localPivotA: [sign * (torsoHalfW * 0.45), torsoHalfH * 0.5],
        localPivotB: [0, UPPER_ARM_LENGTH / 2],
        collideConnected: false,
      })
      shoulderJoint.setLimits(SHOULDER_LIMIT[0], SHOULDER_LIMIT[1])
      shoulderJoint.lowerLimitEnabled = true
      shoulderJoint.upperLimitEnabled = true
      this.addConstraint(shoulderJoint)

      shoulderJoint.enableMotor()
      // @ts-expect-error — p2.js creates motorEquation at runtime via enableMotor(), but @types/p2 lacks it
      shoulderJoint.motorEquation.maxForce = MOTOR_MAX_FORCE
      // @ts-expect-error — same: motorEquation exists at runtime
      shoulderJoint.motorEquation.minForce = -MOTOR_MAX_FORCE
      shoulderJoint.setMotorSpeed(0)

      const shoulderIdx = side === 'L' ? 4 : 5
      this.motors.set(`shoulder_${side}`, {
        name: `shoulder_${side}`,
        constraint: shoulderJoint,
        param: jointParams[shoulderIdx],
      })

      // Lower arm (forearm)
      const lowerArm = createLimbBody(
        LOWER_ARM_LENGTH,
        LOWER_ARM_MASS,
        shoulderX,
        spawnY + torsoHalfH - UPPER_ARM_LENGTH - LOWER_ARM_LENGTH / 2,
      )
      this.addBody(lowerArm)

      // Elbow joint: upper arm <-> lower arm (spring, passive)
      const elbowJoint = new p2.RevoluteConstraint(upperArm, lowerArm, {
        localPivotA: [0, -UPPER_ARM_LENGTH / 2],
        localPivotB: [0, LOWER_ARM_LENGTH / 2],
        collideConnected: false,
      })
      // Elbows have limited range but are spring-driven, not motorized
      elbowJoint.setLimits(-Math.PI / 2, Math.PI / 2)
      elbowJoint.lowerLimitEnabled = true
      elbowJoint.upperLimitEnabled = true
      this.addConstraint(elbowJoint)

      const elbowIdx = side === 'L' ? 0 : 1
      const elbowSpring = new p2.RotationalSpring(upperArm, lowerArm, {
        restAngle: elbowRestAngles[elbowIdx],
        stiffness: ELBOW_STIFFNESS,
        damping: ELBOW_DAMPING,
      })
      this.addSpring(elbowSpring)

      this.springs.push({
        name: `elbow_${side}`,
        constraint: elbowJoint,
        spring: elbowSpring,
      })
    }

    // Disable self-collision between all creature bodies
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        world.disableBodyCollision(this.bodies[i], this.bodies[j])
      }
    }
  }

  /* ─── Internal helpers ─── */

  private addBody(body: p2.Body): void {
    this.bodies.push(body)
    this.world.addBody(body)
  }

  private addConstraint(c: p2.Constraint): void {
    this.constraints.push(c)
    this.world.addConstraint(c)
  }

  private addSpring(s: p2.Spring): void {
    this.p2Springs.push(s)
    this.world.addSpring(s)
  }

  /* ─── Motor update (PD controller) ─── */

  /** Duration (seconds) over which motor targets ramp from 0 to full amplitude.
   *  Without this ramp, strong motors violently snap joints to random initial
   *  targets at spawn, causing the creature to collapse before it can stabilize. */
  static readonly MOTOR_RAMP_DURATION = 1.0

  /**
   * Update all 6 motorized joints for the current simulation time.
   *
   * For each motor the target angle is ramp(t) * A*sin(2*pi*freq*t + phase).
   * The ramp factor goes 0→1 over MOTOR_RAMP_DURATION seconds so the creature
   * can settle on the terrain before the gait pattern kicks in.
   *
   * A PD controller sets motor speed = Kp * error + Kd * d(error)/dt.
   *
   * @param t  Simulation time in seconds
   */
  updateMotors(t: number): void {
    // Smooth ramp: 0 at t=0, 1 at t=MOTOR_RAMP_DURATION
    const ramp = Math.min(t / Creature.MOTOR_RAMP_DURATION, 1.0)

    for (const joint of this.motors.values()) {
      const { amplitude, frequency, phase } = joint.param
      const targetAngle = ramp * amplitude * Math.sin(2 * Math.PI * frequency * t + phase)
      const currentAngle = joint.constraint.angle
      const error = targetAngle - currentAngle

      // Angular velocity difference (bodyB - bodyA)
      const angVelA = joint.constraint.bodyA.angularVelocity
      const angVelB = joint.constraint.bodyB.angularVelocity
      const errorDot = -(angVelB - angVelA)

      // Negate: p2.js motorSpeed sign convention is inverted —
      // positive setMotorSpeed rotates CW (decreasing angle).
      // Our PD controller wants positive error → increase angle → need negative motorSpeed.
      const motorSpeed = -(PD_KP * error + PD_KD * errorDot)
      joint.constraint.setMotorSpeed(motorSpeed)
    }
  }

  /**
   * Apply externally-computed target angles via PD controller.
   * Used by CPG and CPG+NN controllers (v2).
   *
   * @param targets  6-element array of target angles in radians,
   *                 ordered by JOINT_NAMES: hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
   * @param t        Simulation time (for motor ramp)
   */
  setMotorTargets(targets: number[], t: number): void {
    const ramp = Math.min(t / Creature.MOTOR_RAMP_DURATION, 1.0)

    let i = 0
    for (const name of JOINT_NAMES) {
      const joint = this.motors.get(name)
      if (!joint) { i++; continue }

      const targetAngle = ramp * targets[i]
      const currentAngle = joint.constraint.angle
      const error = targetAngle - currentAngle

      const angVelA = joint.constraint.bodyA.angularVelocity
      const angVelB = joint.constraint.bodyB.angularVelocity
      const errorDot = -(angVelB - angVelA)

      const motorSpeed = -(PD_KP * error + PD_KD * errorDot)
      joint.constraint.setMotorSpeed(motorSpeed)
      i++
    }
  }

  /**
   * Get current joint angles for all 6 motorized joints.
   * Returns angles in JOINT_NAMES order.
   */
  getJointAngles(): number[] {
    const angles: number[] = []
    for (const name of JOINT_NAMES) {
      const joint = this.motors.get(name)
      angles.push(joint ? joint.constraint.angle : 0)
    }
    return angles
  }

  /**
   * Get current joint angular velocities for all 6 motorized joints.
   * Returns angular velocities in JOINT_NAMES order.
   */
  getJointAngularVelocities(): number[] {
    const vels: number[] = []
    for (const name of JOINT_NAMES) {
      const joint = this.motors.get(name)
      if (joint) {
        vels.push(joint.constraint.bodyB.angularVelocity - joint.constraint.bodyA.angularVelocity)
      } else {
        vels.push(0)
      }
    }
    return vels
  }

  /* ─── Velocity clamping ─── */

  /**
   * Clamp velocity of all bodies to MAX_VELOCITY to prevent instabilities.
   */
  clampVelocities(): void {
    for (const body of this.bodies) {
      const vx = body.velocity[0]
      const vy = body.velocity[1]
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed
        body.velocity[0] *= scale
        body.velocity[1] *= scale
      }
      // Clamp angular velocity too
      if (Math.abs(body.angularVelocity) > 20) {
        body.angularVelocity = Math.sign(body.angularVelocity) * 20
      }
    }
  }

  /* ─── Frame capture ─── */

  /**
   * Capture the current state as a CreatureFrame for playback / rendering.
   */
  captureFrame(): CreatureFrame {
    const joints: CreatureFrame['joints'] = {}

    // Record each motor joint position from the constraint
    for (const name of JOINT_NAMES) {
      const motor = this.motors.get(name)
      if (motor) {
        const bodyB = motor.constraint.bodyB
        joints[name] = {
          x: bodyB.position[0],
          y: bodyB.position[1],
          angle: motor.constraint.angle,
        }
      }
    }

    // Also record spring joints (elbows, ankles)
    for (const sj of this.springs) {
      const bodyB = sj.constraint.bodyB
      joints[sj.name] = {
        x: bodyB.position[0],
        y: bodyB.position[1],
        angle: sj.constraint.angle,
      }
    }

    return {
      torsoX: this.torso.position[0],
      torsoY: this.torso.position[1],
      torsoAngle: this.torso.angle,
      joints,
    }
  }

  /* ─── Torque measurement ─── */

  /**
   * Sum absolute motor torques for energy calculation.
   */
  getTotalMotorTorque(): number {
    let total = 0
    for (const joint of this.motors.values()) {
      // Use the motor speed from p2's API as a proxy for energy expenditure.
      // getMotorSpeed() returns the actual motor velocity setting.
      total += Math.abs(joint.constraint.getMotorSpeed())
    }
    return total
  }

  /* ─── NaN detection ─── */

  /**
   * Check if any body has NaN position or velocity.
   */
  hasNaN(): boolean {
    for (const body of this.bodies) {
      if (
        isNaN(body.position[0]) || isNaN(body.position[1]) ||
        isNaN(body.velocity[0]) || isNaN(body.velocity[1]) ||
        isNaN(body.angle)
      ) {
        return true
      }
    }
    return false
  }

  /* ─── Cleanup ─── */

  /**
   * Remove all bodies, constraints, and springs from the world.
   */
  destroy(): void {
    for (const s of this.p2Springs) {
      this.world.removeSpring(s)
    }
    for (const c of this.constraints) {
      this.world.removeConstraint(c)
    }
    for (const b of this.bodies) {
      this.world.removeBody(b)
    }
    this.bodies = []
    this.constraints = []
    this.p2Springs = []
    this.motors.clear()
    this.springs = []
    this.feet = []
  }
}
