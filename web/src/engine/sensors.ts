/**
 * Sensor system for the CPG+NN controller.
 *
 * Extracts an 18-dimensional sensor vector from the p2.js creature state,
 * then reduces it to 6 dimensions for NN input.
 *
 * Sensor layout (18 dims):
 *   [0-5]   6 joint angles (normalized by joint limits)
 *   [6-11]  6 joint angular velocities (normalized by max angular vel)
 *   [12-15] 4 torso state: angle, angular velocity, y-position, x-velocity
 *   [16-17] 2 foot contacts: binary (0/1)
 *
 * Reduced sensors (6 dims) — indices [0, 1, 6, 7, 12, 16]:
 *   hip_L angle, hip_R angle, hip_L vel, hip_R vel, torso angle, foot_L contact
 */

import type { Creature } from './creature.ts'

/* ─── Normalization constants ─── */

/** Joint angle normalization (radians). Joint limits are roughly ±π/3 for hips,
 *  so dividing by π/2 maps the typical range to roughly [-0.67, 0.67]. */
const ANGLE_NORM = Math.PI / 2

/** Angular velocity normalization. Typical max angular velocity for motors. */
const ANGVEL_NORM = 10.0

/** Torso angle normalization (radians). */
const TORSO_ANGLE_NORM = Math.PI

/** Torso angular velocity normalization. */
const TORSO_ANGVEL_NORM = 10.0

/** Torso Y position normalization. 100 is typical standing height. */
const TORSO_Y_NORM = 100.0

/** Torso X velocity normalization. */
const TORSO_XVEL_NORM = 200.0

/* ─── Sensor extraction ─── */

/**
 * Extract 18-dimensional sensor vector from creature state.
 *
 * @param creature     p2.js Creature instance
 * @param footContacts  Object with foot_L and foot_R boolean flags
 * @returns 18-element float array, each value normalized to roughly [-1, 1]
 */
export function getSensors(
  creature: Creature,
  footContacts: { foot_L: boolean; foot_R: boolean },
): number[] {
  const sensors = new Array(18)

  // [0-5] Joint angles (6)
  const angles = creature.getJointAngles()
  for (let i = 0; i < 6; i++) {
    sensors[i] = clamp(angles[i] / ANGLE_NORM, -1, 1)
  }

  // [6-11] Joint angular velocities (6)
  const angVels = creature.getJointAngularVelocities()
  for (let i = 0; i < 6; i++) {
    sensors[6 + i] = clamp(angVels[i] / ANGVEL_NORM, -1, 1)
  }

  // [12-15] Torso state (4)
  sensors[12] = clamp(creature.torso.angle / TORSO_ANGLE_NORM, -1, 1)
  sensors[13] = clamp(creature.torso.angularVelocity / TORSO_ANGVEL_NORM, -1, 1)
  sensors[14] = clamp(creature.torso.position[1] / TORSO_Y_NORM, -1, 1)
  sensors[15] = clamp(creature.torso.velocity[0] / TORSO_XVEL_NORM, -1, 1)

  // [16-17] Foot contacts (2)
  sensors[16] = footContacts.foot_L ? 1.0 : 0.0
  sensors[17] = footContacts.foot_R ? 1.0 : 0.0

  return sensors
}

/**
 * Detect which feet are in contact with the terrain by checking
 * if foot bodies are near the terrain height.
 *
 * Uses a simple height-based check rather than p2.js contact events,
 * since p2's contact API is cumbersome and this is good enough for
 * the NN sensor input.
 */
export function detectFootContacts(
  creature: Creature,
  terrainGetHeight: (x: number) => number,
  threshold = 3.0,
): { foot_L: boolean; foot_R: boolean } {
  let foot_L = false
  let foot_R = false

  for (let i = 0; i < creature.feet.length; i++) {
    const foot = creature.feet[i]
    const footY = foot.position[1]
    const terrainY = terrainGetHeight(foot.position[0])
    const isContact = footY - terrainY < threshold

    if (i === 0) foot_L = isContact
    else foot_R = isContact
  }

  return { foot_L, foot_R }
}

/* ─── Utility ─── */

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
