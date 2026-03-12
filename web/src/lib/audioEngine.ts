/**
 * audioEngine — Tone.js generative soundtrack for simulation.
 *
 * Maps simulation events to synthesized sounds:
 *   - Footstep clicks (short noise burst on foot contact)
 *   - Push whoosh (filtered sweep on push impulse)
 *   - Crash impact (low thud on creature fall)
 *   - Fitness record (ascending arpeggio on new best)
 *   - Ambient drone (low pad tied to current fitness)
 *
 * All sounds are synthesized — zero audio assets.
 * Singleton pattern: import { audioEngine } from './audioEngine'.
 * Must call audioEngine.init() on first user interaction.
 */

import * as Tone from 'tone'

class AudioEngine {
  private initialized = false
  private _muted = false
  private _volume = 0.5 // 0–1

  // Synths (created lazily on init)
  private footstepSynth: Tone.NoiseSynth | null = null
  private pushSynth: Tone.Synth | null = null
  private crashSynth: Tone.MembraneSynth | null = null
  private fitnessSynth: Tone.PolySynth | null = null
  private droneSynth: Tone.AMSynth | null = null
  private droneGain: Tone.Gain | null = null

  // Master volume node
  private masterGain: Tone.Gain | null = null

  // Throttle footsteps (max 1 per 150ms)
  private lastFootstepTime = 0

  /** Initialize audio context (must be called from a user gesture handler) */
  async init() {
    if (this.initialized) return
    await Tone.start()
    this.initialized = true

    // Master volume
    this.masterGain = new Tone.Gain(this._volume).toDestination()

    // Footstep: short burst of filtered noise
    this.footstepSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      volume: -18,
    })
    const footFilter = new Tone.Filter(2000, 'bandpass', -12)
    this.footstepSynth.connect(footFilter)
    footFilter.connect(this.masterGain)

    // Push whoosh: quick frequency sweep
    this.pushSynth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -12,
    })
    const pushFilter = new Tone.Filter(800, 'lowpass', -24)
    this.pushSynth.connect(pushFilter)
    pushFilter.connect(this.masterGain)

    // Crash: low membrane thud
    this.crashSynth = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -10,
    })
    this.crashSynth.connect(this.masterGain)

    // Fitness record: bright arpeggiated blip
    this.fitnessSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
      volume: -14,
    })
    this.fitnessSynth.connect(this.masterGain)

    // Ambient drone: low pad
    this.droneGain = new Tone.Gain(0).connect(this.masterGain)
    this.droneSynth = new Tone.AMSynth({
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
      modulationEnvelope: { attack: 0.5, decay: 0.2, sustain: 1, release: 0.5 },
      volume: -20,
    })
    this.droneSynth.connect(this.droneGain)

    // Apply mute state
    if (this._muted && this.masterGain) {
      this.masterGain.gain.value = 0
    }
  }

  /** Whether audio context has been started */
  get isInitialized() { return this.initialized }

  /** Get/set muted state */
  get muted() { return this._muted }
  set muted(v: boolean) {
    this._muted = v
    if (this.masterGain) {
      this.masterGain.gain.rampTo(v ? 0 : this._volume, 0.1)
    }
  }

  /** Get/set volume (0–1) */
  get volume() { return this._volume }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v))
    if (this.masterGain && !this._muted) {
      this.masterGain.gain.rampTo(this._volume, 0.1)
    }
  }

  /** Footstep click — on foot ground contact */
  playFootstep() {
    if (!this.initialized || this._muted || !this.footstepSynth) return
    const now = Tone.now()
    if (now - this.lastFootstepTime < 0.15) return // throttle
    this.lastFootstepTime = now
    this.footstepSynth.triggerAttackRelease('16n')
  }

  /** Push whoosh — on push impulse */
  playPushWhoosh(intensity = 1) {
    if (!this.initialized || this._muted || !this.pushSynth) return
    // Higher pitch for stronger push
    const freq = 100 + intensity * 200
    this.pushSynth.triggerAttackRelease(freq, '8n')
  }

  /** Crash thud — on creature fall */
  playCrash() {
    if (!this.initialized || this._muted || !this.crashSynth) return
    this.crashSynth.triggerAttackRelease('C1', '4n')
  }

  /** Fitness record — ascending blip */
  playFitnessRecord() {
    if (!this.initialized || this._muted || !this.fitnessSynth) return
    const now = Tone.now()
    this.fitnessSynth.triggerAttackRelease('C5', '16n', now)
    this.fitnessSynth.triggerAttackRelease('E5', '16n', now + 0.08)
    this.fitnessSynth.triggerAttackRelease('G5', '16n', now + 0.16)
  }

  /** Start ambient drone (call once when simulation starts) */
  startDrone() {
    if (!this.initialized || !this.droneSynth || !this.droneGain) return
    this.droneSynth.triggerAttack('C2')
    this.droneGain.gain.rampTo(this._muted ? 0 : 0.3, 1)
  }

  /** Stop ambient drone */
  stopDrone() {
    if (!this.initialized || !this.droneSynth || !this.droneGain) return
    this.droneGain.gain.rampTo(0, 0.5)
    setTimeout(() => {
      this.droneSynth?.triggerRelease()
    }, 600)
  }

  /** Update drone pitch based on fitness (0–1 normalized) */
  updateDronePitch(normalizedFitness: number) {
    if (!this.initialized || !this.droneSynth) return
    // Map 0–1 to C2–C3 range
    const freq = 65.4 + normalizedFitness * 65.4
    this.droneSynth.frequency.rampTo(freq, 0.5)
  }

  /** Clean up all synths */
  dispose() {
    this.stopDrone()
    this.footstepSynth?.dispose()
    this.pushSynth?.dispose()
    this.crashSynth?.dispose()
    this.fitnessSynth?.dispose()
    this.droneSynth?.dispose()
    this.droneGain?.dispose()
    this.masterGain?.dispose()
    this.initialized = false
  }
}

/** Singleton audio engine instance */
export const audioEngine = new AudioEngine()
export default audioEngine
