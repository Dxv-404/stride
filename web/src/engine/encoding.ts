/**
 * Direct & indirect chromosome encoding for creature joint parameters.
 *
 * Direct encoding:  18 genes → 6 joints × 3 params (amp, freq, phase)
 * Indirect encoding: 9 genes → 3 joint types, mirrored L/R with π phase shift
 *
 * Joint order: hip_L, hip_R, knee_L, knee_R, shoulder_L, shoulder_R
 */

export const JOINT_NAMES = [
  'hip_L', 'hip_R', 'knee_L', 'knee_R', 'shoulder_L', 'shoulder_R',
] as const

export type JointName = (typeof JOINT_NAMES)[number]

export interface JointParam {
  amplitude: number  // [0, π/2]
  frequency: number  // Hz
  phase: number      // [0, 2π]
}

export function decodeDirect(chromosome: number[]): JointParam[] {
  const params: JointParam[] = []
  for (let i = 0; i < 6; i++) {
    params.push({
      amplitude: chromosome[i * 3 + 0] * (Math.PI / 2),
      frequency: chromosome[i * 3 + 1] * 2.7 + 0.3,    // [0.3, 3.0]
      phase: chromosome[i * 3 + 2] * (2 * Math.PI),
    })
  }
  return params
}

export function decodeIndirect(chromosome: number[]): JointParam[] {
  const params: JointParam[] = []
  for (let i = 0; i < 3; i++) {
    const amp = chromosome[i * 3 + 0] * (Math.PI / 2)
    const freq = chromosome[i * 3 + 1] * 4.5 + 0.5     // [0.5, 5.0]
    const phase = chromosome[i * 3 + 2] * (2 * Math.PI)

    // Left side
    params.push({ amplitude: amp, frequency: freq, phase })
    // Right side: same amp/freq, phase offset by π
    params.push({
      amplitude: amp,
      frequency: freq,
      phase: (phase + Math.PI) % (2 * Math.PI),
    })
  }
  return params
}

export function decodeChromosome(
  chromosome: number[],
  encoding: 'direct' | 'indirect' = 'direct'
): JointParam[] {
  if (encoding === 'direct') {
    return decodeDirect(chromosome)
  }
  return decodeIndirect(chromosome)
}

export function getGeneCount(encoding: 'direct' | 'indirect' = 'direct'): number {
  return encoding === 'direct' ? 18 : 9
}
