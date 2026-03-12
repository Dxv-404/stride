/**
 * Default simulation configuration -- browser-optimized parameters.
 *
 * Ported from Python physics_sim.py, creature.py, fitness.py, ga_core.py.
 * Browser version uses shorter simulation (5 s @ 60 fps = 300 steps)
 * and smaller populations / fewer generations for interactive use.
 */

/* ─── Physics constants ─── */

/** Gravity vector — reduced from real-world 981 to 300 for stable open-loop walking.
 *  With sinusoidal motor control (no balance feedback), 981 causes immediate
 *  collapse because the tipping torque overwhelms the motors. 300 gives
 *  motors 3× more relative strength for a stable standing/walking biped. */
export const GRAVITY: [number, number] = [0, -300]

/** Fixed physics time step in seconds */
export const DT = 1 / 60

/** Total simulation duration in seconds (Python: 10 s, browser: 5 s) */
export const SIM_DURATION = 5

/** Total physics steps = SIM_DURATION / DT */
export const SIM_STEPS = Math.round(SIM_DURATION / DT) // 300

/** Constraint solver iterations per step — more iterations needed for
 *  high motor forces (50k) to converge without instability. */
export const SOLVER_ITERATIONS = 20

/** Maximum velocity magnitude for any body (px/s) */
export const MAX_VELOCITY = 500

/** Minimum Y before creature is considered out-of-bounds */
export const Y_MIN = -500

/** Maximum Y (safety cap) */
export const Y_MAX = 2000

/* ─── Terrain ─── */

/** Base ground height (flat terrain) in px */
export const GROUND_BASE_HEIGHT = 50

/* ─── Creature body dimensions (px & kg) ─── */

export const TORSO_WIDTH = 60
export const TORSO_HEIGHT = 20
export const TORSO_MASS = 5.0

export const UPPER_LEG_LENGTH = 30
export const LOWER_LEG_LENGTH = 25
export const UPPER_ARM_LENGTH = 30
export const LOWER_ARM_LENGTH = 25

export const UPPER_LEG_MASS = 1.5
export const LOWER_LEG_MASS = 1.0
export const UPPER_ARM_MASS = 0.8
export const LOWER_ARM_MASS = 0.5

/** Wider feet provide a larger base of support for standing stability.
 *  At 20px with 18px hip spacing, the creature is top-heavy; 40px gives margin. */
export const FOOT_WIDTH = 40
export const FOOT_HEIGHT = 5
export const FOOT_MASS = 0.5
export const FOOT_FRICTION = 2.0

/** Limb thickness for box shapes (capsule approximation) */
export const LIMB_WIDTH = 6

/* ─── Joint limits (radians) ─── */

export const HIP_LIMIT: [number, number] = [-Math.PI / 3, Math.PI / 3]
export const KNEE_LIMIT: [number, number] = [-Math.PI / 6, Math.PI / 3]
export const SHOULDER_LIMIT: [number, number] = [-Math.PI / 2, Math.PI / 2]
export const ANKLE_LIMIT: [number, number] = [-Math.PI / 6, Math.PI / 6]

/* ─── Motor PD controller gains ─── */

/** PD gains — KP must be high so the motor reacts aggressively to small errors.
 *  At KP=30, a 1° error gives motor speed 0.5 rad/s (sluggish).
 *  At KP=300, a 1° error gives 5 rad/s (snappy position tracking). */
export const PD_KP = 300
export const PD_KD = 20
/** Motor torque limit — must overcome gravity on the full leg chain.
 *  Full leg gravity torque at 15° ≈ 24,000 (upper+lower+foot about hip).
 *  50,000 gives ~2× headroom for dynamic walking motion. */
export const MOTOR_MAX_FORCE = 50000

/* ─── Spring joints (elbows & ankles) ─── */

export const ELBOW_STIFFNESS = 5000
export const ELBOW_DAMPING = 70

/** Ankle spring stiffness — must support full body weight (13.6 kg × 981 g).
 *  At 3000, ankles flex too easily under load, causing leg collapse. */
export const ANKLE_STIFFNESS = 15000
export const ANKLE_DAMPING = 200
export const ANKLE_REST_ANGLE = 0

/* ─── Spawn parameters ─── */

export const SPAWN_X = 100
/** Spawn margin above terrain — kept minimal (1px) to avoid drop impact.
 *  Even a 5px drop creates collision impulses that fold joints despite strong motors. */
export const SPAWN_MARGIN = 1

/* ─── Stuck detection ─── */

/** Minimum displacement (px) to not be considered stuck */
export const STUCK_THRESHOLD = 5.0

/** Window (in seconds) over which to measure stuck-ness */
export const STUCK_WINDOW = 2.0

/* ─── Fall detection ─── */

/** Torso must be at least this far above terrain to not count as fallen */
export const FALL_MARGIN = 5

/* ─── Fitness coefficients ─── */

/** Energy penalty weight — kept low because high-torque motors are energy-hungry. */
export const FITNESS_ALPHA = 0.02

/** Fall penalty weight per frame below the fall threshold.
 *  Originally 0.5, but that makes ONE stumble cost -150, making standing
 *  strictly superior to walking. At 0.1 a brief stumble costs ~-30,
 *  which walking distance can overcome. */
export const FITNESS_BETA = 0.1

/** Uprightness reward weight.
 *  Originally 10.0 — standing perfectly upright for 5s gives +10 for free,
 *  dominating the fitness landscape. At 3.0 it's still a bonus for balance
 *  but no longer enough to beat modest forward distance. */
export const FITNESS_GAMMA = 3.0

export const GAIT_BONUS_WEIGHT = 5.0

/** Velocity bonus weight — fraction of forward-moving frames × this weight.
 *  Increased from 3.0 to 8.0 to strongly reward consistent forward movement. */
export const VELOCITY_BONUS_WEIGHT = 8.0

/** Distance scaling — multiply raw distance to make it the dominant fitness signal.
 *  At 1.0, a creature moving 50px has the same weight as the uprightness bonus.
 *  At 3.0, the same 50px contributes 150 — clearly the main optimization target. */
export const DISTANCE_SCALE = 3.0

export const PENALTY_FITNESS = -1000

/* ─── GA defaults (browser-optimized) ─── */

export const DEFAULT_POPULATION_SIZE = 50
export const DEFAULT_MAX_GENERATIONS = 75
export const DEFAULT_MUTATION_RATE = 0.10
export const DEFAULT_CROSSOVER_RATE = 0.8
export const DEFAULT_ELITISM_RATE = 0.05
export const DEFAULT_TOURNAMENT_K = 3
export const DEFAULT_RANK_S = 1.5

/** Fitness sharing niche radius */
export const DEFAULT_SIGMA_SHARE = 0.1

/* ─── Collision groups (bit masks) ─── */

export const COLLISION_GROUP_TERRAIN = 1
export const COLLISION_GROUP_CREATURE = 2

/** Creature parts collide with terrain but not with each other */
export const COLLISION_MASK_CREATURE = COLLISION_GROUP_TERRAIN
export const COLLISION_MASK_TERRAIN = COLLISION_GROUP_CREATURE

/* ─── PRNG ─── */

/**
 * Mulberry32 -- fast 32-bit seeded PRNG.
 * Returns a function that produces floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Seeded gaussian random using Box-Muller transform.
 * Takes a uniform [0,1) RNG and returns a standard normal sample.
 */
export function gaussianRandom(rng: () => number): number {
  const u1 = rng()
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
}
