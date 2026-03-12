/**
 * jointData — Maps wireframe human skeleton joints to GA parameters.
 *
 * The wireframe_man.glb has 79 joints, but we only highlight ~12
 * key joints that correspond to the creature's motorized/spring
 * joints in the genetic algorithm. Each entry provides:
 *   - boneName: exact name in the GLB skeleton
 *   - label: human-readable name shown in tooltip
 *   - gaParam: which GA parameters control this joint
 *   - description: educational text about the joint's role
 */

/** Joint classification — determines icon shape and animation style */
export type JointType = 'motorized' | 'spring' | 'reference' | 'fixed' | 'visual'

/** Rotation limits in radians for draggable joints */
export interface RotationLimits {
  xMin: number
  xMax: number
  zMin: number
  zMax: number
}

export interface JointInfo {
  /** Exact bone name in the GLB skeleton hierarchy */
  boneName: string
  /** Human-readable label for tooltip */
  label: string
  /** GA parameter description */
  gaParam: string
  /** Educational description of the joint's role */
  description: string
  /** Accent color override (optional) */
  color?: string
  /** Joint classification — determines marker icon shape */
  type: JointType
  /** Whether this joint can be dragged to rotate its bone */
  draggable?: boolean
  /** Which axes the drag rotates: 'x' = flex/extend only, 'xy' = flex + abduction */
  dragAxis?: 'x' | 'xy'
  /** Anatomical rotation limits (radians) */
  rotationLimits?: RotationLimits
  /** Pixels-to-radians sensitivity (default 0.005) */
  dragSensitivity?: number
}

/**
 * Key joints to highlight on the wireframe human.
 * These map to the 6 motorized joints + 2 spring elbows
 * in the STRIDE creature.
 */
export const JOINT_DATA: JointInfo[] = [
  // ─── Hips (motorized) ───
  {
    boneName: 'thighL_051',
    label: 'Left Hip',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'Motorized joint controlling leg swing range. The GA optimises three parameters: how far the leg swings (amplitude), how fast it cycles (frequency), and when it starts in the gait cycle (phase).',
    type: 'motorized',
    draggable: true,
    dragAxis: 'xy',
    rotationLimits: { xMin: -0.8, xMax: 1.6, zMin: -0.35, zMax: 0.5 },
    dragSensitivity: 0.006,
  },
  {
    boneName: 'thighR_056',
    label: 'Right Hip',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'Mirrors the left hip with independent parameters. Evolution discovers that a phase offset between left and right hips produces alternating leg motion — the basis of bipedal walking.',
    type: 'motorized',
    draggable: true,
    dragAxis: 'xy',
    rotationLimits: { xMin: -0.8, xMax: 1.6, zMin: -0.5, zMax: 0.35 },
    dragSensitivity: 0.006,
  },

  // ─── Knees (motorized) ───
  {
    boneName: 'shinL_052',
    label: 'Left Knee',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'Controls leg extension timing. The knee must bend during swing phase and extend during stance. Poor knee timing causes the creature to stumble or drag its feet.',
    type: 'motorized',
    draggable: true,
    dragAxis: 'x',
    rotationLimits: { xMin: 0, xMax: 2.4, zMin: 0, zMax: 0 },
    dragSensitivity: 0.007,
  },
  {
    boneName: 'shinR_057',
    label: 'Right Knee',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'The right knee works in coordination with the right hip. Evolution often discovers that knee frequency should match hip frequency for a smooth gait cycle.',
    type: 'motorized',
    draggable: true,
    dragAxis: 'x',
    rotationLimits: { xMin: 0, xMax: 2.4, zMin: 0, zMax: 0 },
    dragSensitivity: 0.007,
  },

  // ─── Shoulders (motorized) ───
  {
    boneName: 'upper_armL_09',
    label: 'Left Shoulder',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'Controls arm swing for balance. Counter-rotating arms reduce angular momentum during walking, preventing the torso from spinning. The GA learns this naturally.',
    type: 'motorized',
    draggable: true,
    dragAxis: 'xy',
    rotationLimits: { xMin: -1.0, xMax: 2.8, zMin: -0.5, zMax: 1.6 },
    dragSensitivity: 0.006,
  },
  {
    boneName: 'upper_armR_030',
    label: 'Right Shoulder',
    gaParam: 'Amplitude, Frequency, Phase',
    description:
      'The right arm swings opposite to the left arm. Evolution discovers this anti-phase pattern because it maximises walking distance — the fitness function.',
    type: 'motorized',
    draggable: true,
    dragAxis: 'xy',
    rotationLimits: { xMin: -1.0, xMax: 2.8, zMin: -1.6, zMax: 0.5 },
    dragSensitivity: 0.006,
  },

  // ─── Elbows (passive springs) ───
  {
    boneName: 'forearmL_010',
    label: 'Left Elbow',
    gaParam: 'Spring Stiffness, Damping',
    description:
      'Passive spring joint — not motorized. A DampedRotarySpring connects the forearm to the upper arm. The GA only optimises stiffness and damping, not active motion.',
    type: 'spring',
    draggable: true,
    dragAxis: 'x',
    rotationLimits: { xMin: 0, xMax: 2.5, zMin: 0, zMax: 0 },
    dragSensitivity: 0.006,
  },
  {
    boneName: 'forearmR_031',
    label: 'Right Elbow',
    gaParam: 'Spring Stiffness, Damping',
    description:
      'Like the left elbow, this is a passive joint. The spring lets the forearm swing naturally in response to shoulder motion, adding realism without extra genes.',
    type: 'spring',
    draggable: true,
    dragAxis: 'x',
    rotationLimits: { xMin: 0, xMax: 2.5, zMin: 0, zMax: 0 },
    dragSensitivity: 0.006,
  },

  // ─── Torso (reference point) ───
  {
    boneName: 'spine_01',
    label: 'Torso',
    gaParam: 'Body Reference',
    description:
      'The torso is the creature\'s rigid body core. It connects all limbs and its height/angle during walking determines the creature\'s overall stability and efficiency.',
    type: 'reference',
  },

  // ─── Ankles (fixed joints) ───
  {
    boneName: 'footL_053',
    label: 'Left Ankle',
    gaParam: 'Fixed Joint',
    description:
      'The ankle is a fixed rigid connection in the simulation — no motor or spring. The foot\'s angle relative to the shin is constant, simplifying the model.',
    type: 'fixed',
  },
  {
    boneName: 'footR_058',
    label: 'Right Ankle',
    gaParam: 'Fixed Joint',
    description:
      'Like the left ankle, this is a rigid attachment. Future work could add ankle motors as additional genes for the GA to optimise.',
    type: 'fixed',
  },

  // ─── Head (visual anchor) ───
  {
    boneName: 'spine006_07',
    label: 'Head',
    gaParam: 'Visual Only',
    description:
      'The head has no role in the GA — it\'s purely visual. In the physics simulation, the creature is headless. This wireframe model adds it for anatomical context.',
    type: 'visual',
  },
]

/**
 * Lookup a joint info by bone name.
 * Returns undefined if the bone isn't in our highlighted set.
 */
export function getJointInfo(boneName: string): JointInfo | undefined {
  return JOINT_DATA.find((j) => j.boneName === boneName)
}

/* ─── Monochromatic colour palette ───
 *  Single hue family (cool silver-white) differentiated by OPACITY.
 *  Shape and animation carry the identity, not colour.
 *  This avoids the "AI data-dashboard" look of multi-colour coding.
 */
export const MARKER_COLOR = '#D4D0E0'       // soft silver — idle state
export const MARKER_COLOR_ACTIVE = '#FFFFFF' // pure white — hover/selected

/** Opacity hierarchy per joint type (idle state). Shape is primary differentiator. */
export const JOINT_OPACITY: Record<JointType, number> = {
  motorized: 0.9,   // most prominent — the key GA joints
  spring:    0.8,    // slightly softer — passive, not motorized
  reference: 0.85,   // torso hub
  fixed:     0.5,    // subtle — no GA role
  visual:    0.4,    // dimmest — purely decorative
}

/**
 * Circuit trace connections — defines the "nervous system" lines
 * between joints. Each connection is [fromBoneName, toBoneName].
 * Topology follows the body's skeletal chain:
 *   torso → shoulders → elbows
 *   torso → hips → knees → ankles
 *   torso → head
 */
export const TRACE_CONNECTIONS: [string, string][] = [
  // Left arm chain
  ['spine_01',       'upper_armL_09'],   // torso → left shoulder
  ['upper_armL_09',  'forearmL_010'],     // left shoulder → left elbow

  // Right arm chain
  ['spine_01',       'upper_armR_030'],   // torso → right shoulder
  ['upper_armR_030', 'forearmR_031'],     // right shoulder → right elbow

  // Left leg chain
  ['spine_01',       'thighL_051'],       // torso → left hip
  ['thighL_051',     'shinL_052'],        // left hip → left knee
  ['shinL_052',      'footL_053'],        // left knee → left ankle

  // Right leg chain
  ['spine_01',       'thighR_056'],       // torso → right hip
  ['thighR_056',     'shinR_057'],        // right hip → right knee
  ['shinR_057',      'footR_058'],        // right knee → right ankle

  // Head
  ['spine_01',       'spine006_07'],      // torso → head
]
