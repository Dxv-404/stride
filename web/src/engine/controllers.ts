/**
 * Controller classes for all three tiers: Sine, CPG, and CPG+NN.
 *
 * Each controller takes a raw [0,1] chromosome and produces 6 motor target
 * angles per step. The Creature class applies these via PD control.
 *
 * Gene layouts:
 *   Sine:    18 genes → 6 joints × 3 params (amp, freq, phase)
 *   CPG:     38 genes → 18 oscillator + 20 coupling
 *   CPG+NN:  96 genes → 38 CPG + 58 NN weights
 */

/* ─── Controller interface ─── */

export type ControllerType = 'sine' | 'cpg' | 'cpg_nn'

export interface Controller {
  type: ControllerType
  /** Get 6 target angles for the current step.
   *  @param t   Simulation time in seconds
   *  @param dt  Time step in seconds
   *  @param sensors  Optional 18-dim sensor array (only used by CPG+NN)
   *  @returns  Object with targets (6 floats) and optional modulation (6 floats)
   */
  getTargets(t: number, dt: number, sensors?: number[]): {
    targets: number[]
    modulation?: number[]
  }
}

/* ─── Sine Controller ─── */

/**
 * Open-loop sinusoidal controller. Each joint follows:
 *   target_j(t) = A_j * sin(2π * ω_j * t + φ_j)
 *
 * 18 genes → 6 joints × (amplitude, frequency, phase)
 */
export class SineController implements Controller {
  type: ControllerType = 'sine'

  private amplitudes: number[]  // [0, π/2]
  private frequencies: number[] // [0.5, 5.0] Hz
  private phases: number[]      // [0, 2π]

  constructor(genes: number[]) {
    this.amplitudes = []
    this.frequencies = []
    this.phases = []

    for (let i = 0; i < 6; i++) {
      this.amplitudes.push(genes[i * 3 + 0] * (Math.PI / 2))
      this.frequencies.push(genes[i * 3 + 1] * 4.5 + 0.5)
      this.phases.push(genes[i * 3 + 2] * (2 * Math.PI))
    }
  }

  getTargets(t: number): { targets: number[] } {
    const targets: number[] = []
    for (let i = 0; i < 6; i++) {
      targets.push(
        this.amplitudes[i] * Math.sin(2 * Math.PI * this.frequencies[i] * t + this.phases[i])
      )
    }
    return { targets }
  }
}

/* ─── CPG Controller (Kuramoto-coupled oscillators) ─── */

/**
 * 10 directed coupling connections between the 6 oscillators.
 * Each connection is stored as [from, to].
 */
const CPG_CONNECTIONS: [number, number][] = [
  [0, 2], [2, 0],  // hip_L <-> knee_L
  [1, 3], [3, 1],  // hip_R <-> knee_R
  [0, 1], [1, 0],  // hip_L <-> hip_R
  [2, 3], [3, 2],  // knee_L <-> knee_R
  [4, 5], [5, 4],  // shoulder_L <-> shoulder_R
]

/**
 * Kuramoto-coupled CPG controller. Phase dynamics:
 *   dφ_i/dt = 2π·f_i + Σ_j(w_ij · sin(φ_j - φ_i + Φ_ij))
 *
 * 38 genes:
 *   0-17:  6 oscillators × 3 (amplitude, frequency, phase)
 *   18-37: 10 connections × 2 (weight, phase_offset)
 */
export class CPGController implements Controller {
  type: ControllerType = 'cpg'

  private amplitudes: number[]    // [0, π/2]
  private frequencies: number[]   // [0.5, 5.0] Hz
  private phases: number[]        // current phase state (evolves over time)
  private couplingWeights: number[]     // [-2, 2] per connection
  private couplingPhaseOffsets: number[] // [0, 2π] per connection

  /** Max phase velocity clamp (prevents explosion) */
  private static readonly MAX_DPHI = 10 * 2 * Math.PI

  constructor(genes: number[]) {
    this.amplitudes = []
    this.frequencies = []
    this.phases = []
    this.couplingWeights = []
    this.couplingPhaseOffsets = []

    // Decode 6 oscillators (genes 0-17)
    for (let i = 0; i < 6; i++) {
      this.amplitudes.push(genes[i * 3 + 0] * (Math.PI / 2))
      this.frequencies.push(genes[i * 3 + 1] * 4.5 + 0.5)
      this.phases.push(genes[i * 3 + 2] * (2 * Math.PI))
    }

    // Decode 10 coupling connections (genes 18-37)
    for (let c = 0; c < 10; c++) {
      const w = (genes[18 + c * 2 + 0] - 0.5) * 4   // [-2, 2]
      const phi = genes[18 + c * 2 + 1] * (2 * Math.PI) // [0, 2π]
      this.couplingWeights.push(w)
      this.couplingPhaseOffsets.push(phi)
    }
  }

  /**
   * Advance oscillator phases by one time step using Kuramoto dynamics.
   * Returns 6 target angles.
   */
  step(dt: number): number[] {
    const dPhases = new Array(6).fill(0)

    for (let i = 0; i < 6; i++) {
      // Intrinsic frequency term
      let dphi = 2 * Math.PI * this.frequencies[i]

      // Coupling terms from connected oscillators
      for (let c = 0; c < CPG_CONNECTIONS.length; c++) {
        const [from, to] = CPG_CONNECTIONS[c]
        if (to !== i) continue  // Only connections TO oscillator i

        const w = this.couplingWeights[c]
        const phiOffset = this.couplingPhaseOffsets[c]
        dphi += w * Math.sin(this.phases[from] - this.phases[i] + phiOffset)
      }

      // Clamp to prevent explosion
      dphi = Math.max(-CPGController.MAX_DPHI, Math.min(CPGController.MAX_DPHI, dphi))
      dPhases[i] = dphi
    }

    // Update phases
    const targets: number[] = []
    for (let i = 0; i < 6; i++) {
      this.phases[i] += dPhases[i] * dt
      targets.push(this.amplitudes[i] * Math.sin(this.phases[i]))
    }

    return targets
  }

  getTargets(_t: number, dt: number): { targets: number[] } {
    return { targets: this.step(dt) }
  }
}

/* ─── CPG+NN Controller (hybrid with sensory feedback) ─── */

/** Indices into the 18-dim sensor array for the 6 reduced sensors.
 *  Intentionally asymmetric: only foot_L contact (not foot_R) to keep
 *  the NN at 6 inputs / 58 weights. The NN relies on CPG inter-leg
 *  coupling for right-side timing.
 *
 *  [0]  hip_L angle
 *  [1]  hip_R angle
 *  [6]  hip_L angular velocity
 *  [7]  hip_R angular velocity
 *  [12] torso angle
 *  [16] foot_L contact
 */
export const REDUCED_SENSOR_INDICES = [0, 1, 6, 7, 12, 16]

/**
 * CPG + Neural Network hybrid controller.
 * The CPG generates base oscillation; a small NN (6→4→6) modulates
 * the CPG output based on sensory feedback.
 *
 *   final_i = cpg_i × (1 + 0.5 × m_i)
 *
 * where m_i ∈ [-1, 1] is the NN's tanh output.
 *
 * 96 genes:
 *   0-37:  CPG (same as CPGController)
 *   38-95: NN weights (58 total)
 *     38-61:  W1 (4×6 = 24), hidden layer weights
 *     62-65:  b1 (4), hidden layer biases
 *     66-89:  W2 (6×4 = 24), output layer weights
 *     90-95:  b2 (6), output layer biases
 */
export class CPGNNController implements Controller {
  type: ControllerType = 'cpg_nn'

  private cpg: CPGController
  private W1: number[][]  // 4×6 (hidden × input)
  private b1: number[]    // 4
  private W2: number[][]  // 6×4 (output × hidden)
  private b2: number[]    // 6

  constructor(genes: number[]) {
    // CPG uses genes 0-37
    this.cpg = new CPGController(genes.slice(0, 38))

    // Decode NN weights from genes 38-95
    // All scaled: gene * 4 - 2 → [-2, 2]
    let idx = 38

    // W1: 4 hidden × 6 input = 24 weights
    this.W1 = []
    for (let h = 0; h < 4; h++) {
      const row: number[] = []
      for (let inp = 0; inp < 6; inp++) {
        row.push(genes[idx++] * 4 - 2)
      }
      this.W1.push(row)
    }

    // b1: 4 biases
    this.b1 = []
    for (let h = 0; h < 4; h++) {
      this.b1.push(genes[idx++] * 4 - 2)
    }

    // W2: 6 output × 4 hidden = 24 weights
    this.W2 = []
    for (let o = 0; o < 6; o++) {
      const row: number[] = []
      for (let h = 0; h < 4; h++) {
        row.push(genes[idx++] * 4 - 2)
      }
      this.W2.push(row)
    }

    // b2: 6 biases
    this.b2 = []
    for (let o = 0; o < 6; o++) {
      this.b2.push(genes[idx++] * 4 - 2)
    }
  }

  /**
   * NN forward pass: 6 reduced sensors → 4 hidden (tanh) → 6 modulation (tanh)
   */
  private forwardNN(sensors6: number[]): number[] {
    // Hidden layer: h = tanh(W1 @ s + b1)
    const hidden = new Array(4)
    for (let h = 0; h < 4; h++) {
      let sum = this.b1[h]
      for (let j = 0; j < 6; j++) {
        sum += this.W1[h][j] * sensors6[j]
      }
      hidden[h] = Math.tanh(sum)
    }

    // Output layer: m = tanh(W2 @ h + b2)
    const modulation = new Array(6)
    for (let o = 0; o < 6; o++) {
      let sum = this.b2[o]
      for (let h = 0; h < 4; h++) {
        sum += this.W2[o][h] * hidden[h]
      }
      modulation[o] = Math.tanh(sum)
    }

    return modulation
  }

  getTargets(_t: number, dt: number, sensors?: number[]): {
    targets: number[]
    modulation: number[]
  } {
    // Get CPG base targets
    const cpgTargets = this.cpg.step(dt)

    // Get reduced sensors (6 from 18)
    let sensors6: number[]
    if (sensors && sensors.length >= 18) {
      sensors6 = REDUCED_SENSOR_INDICES.map(i => sensors[i])
    } else {
      // No sensors available — zero input (NN produces baseline modulation)
      sensors6 = [0, 0, 0, 0, 0, 0]
    }

    // NN modulation
    const modulation = this.forwardNN(sensors6)

    // Final targets: cpg_i × (1 + 0.5 × m_i)
    const targets = cpgTargets.map((cpg, i) => cpg * (1 + 0.5 * modulation[i]))

    return { targets, modulation }
  }
}

/* ─── Factory ─── */

/**
 * Create a controller from a chromosome and type.
 */
export function createController(genes: number[], type: ControllerType): Controller {
  switch (type) {
    case 'sine':
      return new SineController(genes)
    case 'cpg':
      return new CPGController(genes)
    case 'cpg_nn':
      return new CPGNNController(genes)
    default:
      throw new Error(`Unknown controller type: ${type}`)
  }
}

/**
 * Get the expected gene count for a controller type.
 */
export function getControllerGeneCount(type: ControllerType): number {
  switch (type) {
    case 'sine': return 18
    case 'cpg': return 38
    case 'cpg_nn': return 96
  }
}
