/**
 * Fitness evaluation -- compute fitness from simulation results.
 *
 * Ported from Python fitness.py.
 *
 * F(x) = distance - alpha*energy - beta*falls + gamma*uprightness
 *        + gait_bonus + velocity_bonus
 *
 * NO p2.js dependency.
 */

import type { FitnessBreakdown } from './types.ts'
import type { JointParam } from './encoding.ts'
import type { SimulationResult } from './physics.ts'
import {
  FITNESS_ALPHA,
  FITNESS_BETA,
  FITNESS_GAMMA,
  GAIT_BONUS_WEIGHT,
  VELOCITY_BONUS_WEIGHT,
  DISTANCE_SCALE,
  PENALTY_FITNESS,
} from './config.ts'

/* ─── Gait bonus ─── */

/**
 * Compute gait quality bonus based on:
 *   1. Anti-phase coordination of left/right hips
 *   2. Hip-knee coupling (knees should flex when hips extend)
 *   3. Frequency matching across joints
 *
 * @param jointParams  6-element array [hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R]
 * @returns Gait bonus score in [0, gait_bonus_weight]
 */
function computeGaitBonus(jointParams: JointParam[]): number {
  if (jointParams.length < 6) return 0

  const hipL = jointParams[0]
  const hipR = jointParams[1]
  const kneeL = jointParams[2]
  const kneeR = jointParams[3]

  let bonus = 0

  // 1. Anti-phase hips: phase difference should be close to pi
  const hipPhaseDiff = Math.abs(hipL.phase - hipR.phase)
  const normalizedDiff = Math.min(hipPhaseDiff, 2 * Math.PI - hipPhaseDiff)
  // Reward being close to pi (perfectly anti-phase)
  const antiPhaseScore = 1 - Math.abs(normalizedDiff - Math.PI) / Math.PI
  bonus += antiPhaseScore * 0.4

  // 2. Hip-knee coupling: knees on same side should have related phase
  // Ideal: knee phase ~ hip phase + pi/2 (knee flexes as hip extends)
  const couplingL = Math.abs(kneeL.phase - hipL.phase)
  const normCouplingL = Math.min(couplingL, 2 * Math.PI - couplingL)
  const couplingScoreL = 1 - Math.abs(normCouplingL - Math.PI / 2) / Math.PI
  const couplingR = Math.abs(kneeR.phase - hipR.phase)
  const normCouplingR = Math.min(couplingR, 2 * Math.PI - couplingR)
  const couplingScoreR = 1 - Math.abs(normCouplingR - Math.PI / 2) / Math.PI
  bonus += ((couplingScoreL + couplingScoreR) / 2) * 0.3

  // 3. Frequency matching: all leg joints should have similar frequency
  const freqs = [hipL.frequency, hipR.frequency, kneeL.frequency, kneeR.frequency]
  const meanFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length
  const freqVariance =
    freqs.reduce((sum, f) => sum + (f - meanFreq) ** 2, 0) / freqs.length
  // Lower variance = better frequency matching
  const freqScore = Math.max(0, 1 - freqVariance / 4)
  bonus += freqScore * 0.3

  return bonus * GAIT_BONUS_WEIGHT
}

/* ─── Velocity bonus ─── */

/**
 * Compute velocity bonus: fraction of frames where the creature moved forward.
 *
 * @param torsoXHistory  Per-step torso X positions
 * @returns Velocity bonus score
 */
function computeVelocityBonus(torsoXHistory: number[]): number {
  if (torsoXHistory.length < 2) return 0

  let forwardFrames = 0
  for (let i = 1; i < torsoXHistory.length; i++) {
    if (torsoXHistory[i] > torsoXHistory[i - 1]) {
      forwardFrames++
    }
  }

  const forwardFraction = forwardFrames / (torsoXHistory.length - 1)
  return forwardFraction * VELOCITY_BONUS_WEIGHT
}

/* ─── Main fitness function ─── */

/**
 * Compute full fitness breakdown from a simulation result.
 *
 * @param result       Output from runSimulation()
 * @param jointParams  The decoded joint parameters used in simulation
 * @returns FitnessBreakdown with total and per-component scores
 */
export function computeFitness(
  result: SimulationResult,
  jointParams: JointParam[],
): FitnessBreakdown {
  // If simulation was aborted due to NaN or extreme out-of-bounds, assign penalty
  if (result.aborted && result.stepsSimulated < 30) {
    return {
      total: PENALTY_FITNESS,
      distance: 0,
      energy: 0,
      falls: 0,
      uprightness: 0,
    }
  }

  const distance = result.distance * DISTANCE_SCALE
  const energyPenalty = FITNESS_ALPHA * result.totalEnergy
  const fallPenalty = FITNESS_BETA * result.fallCount
  const uprightReward = FITNESS_GAMMA * result.uprightness
  const gaitBonus = computeGaitBonus(jointParams)
  const velocityBonus = computeVelocityBonus(result.torsoXHistory)

  const total = distance - energyPenalty - fallPenalty + uprightReward + gaitBonus + velocityBonus

  return {
    total,
    distance,
    energy: energyPenalty,
    falls: result.fallCount,
    uprightness: result.uprightness,
  }
}
