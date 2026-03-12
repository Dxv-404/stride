/**
 * CreatureWalker — 3D wireframe creature that walks in and sleeps.
 *
 * Pipeline:
 *   1. Loads best sine chromosome via loadBestChromosomes()
 *   2. Runs headless p2.js simulation → captures walk frames
 *   3. Renders creature as cylinder bones + sphere joints
 *
 * Animation phases:
 *   Walking → Sitting transition → Sleeping (idle breathing)
 */

import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { decodeDirect } from '@/engine/encoding.ts'
import { runSimulation } from '@/engine/physics.ts'
import { createTerrain } from '@/engine/terrain.ts'
import type { CreatureFrame } from '@/engine/types.ts'
import { loadBestChromosomes } from '@/data/best-chromosomes.ts'

/* ─── Constants ─── */

const N_FRAMES = 60
// p2.js uses pixel-scale units (torso=60x20, limbs=25-30 units).
// Creature stands ~70 units tall (ankle y≈52 to torso y≈120).
// Scale 0.05 → ~3.5 scene units tall, proportional to the TV.
const CREATURE_SCALE = 0.05
const ACCENT = '#C4956A'

// Joint connections (mirrors SkeletonTrail.tsx)
const LIMB_SEGMENTS: [string, string][] = [
  ['shoulder_L', 'elbow_L'],
  ['shoulder_R', 'elbow_R'],
  ['hip_L', 'knee_L'],
  ['hip_R', 'knee_R'],
  ['knee_L', 'ankle_L'],
  ['knee_R', 'ankle_R'],
]
const TORSO_JOINTS = ['shoulder_L', 'shoulder_R', 'hip_L', 'hip_R']

// Walk animation
const WALK_FPS = 24
const SIT_DURATION = 1.5    // seconds for the sitting transition

type AnimPhase = 'loading' | 'walking' | 'sitting' | 'sleeping'

/** Interpolate between two CreatureFrames */
function lerpFrame(a: CreatureFrame, b: CreatureFrame, t: number): CreatureFrame {
  const joints: Record<string, { x: number; y: number; angle: number }> = {}
  for (const [name, ja] of Object.entries(a.joints)) {
    const jb = b.joints[name]
    if (!jb) { joints[name] = ja; continue }
    joints[name] = {
      x: ja.x + (jb.x - ja.x) * t,
      y: ja.y + (jb.y - ja.y) * t,
      angle: ja.angle + (jb.angle - ja.angle) * t,
    }
  }
  return {
    torsoX: a.torsoX + (b.torsoX - a.torsoX) * t,
    torsoY: a.torsoY + (b.torsoY - a.torsoY) * t,
    torsoAngle: a.torsoAngle + (b.torsoAngle - a.torsoAngle) * t,
    joints,
  }
}

/** Create a "lying down" target frame from the last walk pose.
 *  Input frame is already Y-normalized (feet at y≈0, in physics units). */
function createSleepPose(base: CreatureFrame): CreatureFrame {
  const joints: Record<string, { x: number; y: number; angle: number }> = {}
  // Ground level: near y=0 (since input is already Y-normalized)
  const groundY = 2

  for (const [name, jt] of Object.entries(base.joints)) {
    const isLeft = name.includes('_L')
    const spreadDir = isLeft ? -8 : 8  // spread limbs outward
    joints[name] = {
      x: base.torsoX + (jt.x - base.torsoX) * 1.3 + spreadDir,
      y: groundY + Math.random() * 3,
      angle: jt.angle * 0.2,
    }
  }

  return {
    torsoX: base.torsoX,
    torsoY: groundY + 5,
    torsoAngle: Math.PI / 4,
    joints,
  }
}

/* ─── Bone: a thin cylinder between two 3D points ─── */

const _boneDir = new THREE.Vector3()
const _boneUp = new THREE.Vector3(0, 1, 0)
const _boneQuat = new THREE.Quaternion()

function Bone({ from, to, radius = 0.06 }: {
  from: [number, number, number]
  to: [number, number, number]
  radius?: number
}) {
  const ref = useRef<THREE.Mesh>(null)

  // Compute midpoint, length, and orientation
  const [midpoint, length, quaternion] = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid: [number, number, number] = [
      (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2,
    ]
    const len = a.distanceTo(b)
    _boneDir.subVectors(b, a).normalize()
    _boneQuat.setFromUnitVectors(_boneUp, _boneDir)
    return [mid, len, _boneQuat.clone()] as const
  }, [from, to])

  return (
    <mesh ref={ref} position={midpoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 6]} />
      <meshBasicMaterial color={ACCENT} />
    </mesh>
  )
}

/* ─── Creature skeleton: bones + joint spheres + head ─── */

function CreatureSkeleton({ frame }: { frame: CreatureFrame }) {
  const tx = frame.torsoX * CREATURE_SCALE
  const ty = frame.torsoY * CREATURE_SCALE
  const torsoPos: [number, number, number] = [tx, ty, 0]

  const jointPos = (name: string): [number, number, number] => {
    const jt = frame.joints[name]
    return jt ? [jt.x * CREATURE_SCALE, jt.y * CREATURE_SCALE, 0] : torsoPos
  }

  // Collect all bones
  const bones: { from: [number, number, number]; to: [number, number, number] }[] = []

  // Torso → shoulder/hip joints
  for (const jk of TORSO_JOINTS) {
    if (frame.joints[jk]) {
      bones.push({ from: torsoPos, to: jointPos(jk) })
    }
  }
  // Limb segments
  for (const [fromJ, toJ] of LIMB_SEGMENTS) {
    if (frame.joints[fromJ] && frame.joints[toJ]) {
      bones.push({ from: jointPos(fromJ), to: jointPos(toJ) })
    }
  }

  // All joint positions for spheres
  const allJoints: [number, number, number][] = [torsoPos]
  for (const jt of Object.values(frame.joints)) {
    allJoints.push([jt.x * CREATURE_SCALE, jt.y * CREATURE_SCALE, 0])
  }

  // Head position above torso (offset 20 physics units above torso)
  const headPos: [number, number, number] = [tx, ty + 20 * CREATURE_SCALE, 0]

  return (
    <>
      {/* Bone cylinders */}
      {bones.map((b, i) => (
        <Bone key={`bone-${i}`} from={b.from} to={b.to} radius={0.04} />
      ))}

      {/* Joint spheres */}
      {allJoints.map((pos, i) => (
        <mesh key={`jt-${i}`} position={pos}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={ACCENT} />
        </mesh>
      ))}

      {/* Head ring */}
      <mesh position={headPos}>
        <ringGeometry args={[0.18, 0.26, 16]} />
        <meshBasicMaterial color={ACCENT} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

/* ─── Main component ─── */

interface CreatureWalkerProps {
  delay?: number
  startX?: number    // world X to start from (off-screen right)
  targetX?: number   // world X to stop at
}

export default function CreatureWalker({
  delay = 3.5,
  startX = 8,
  targetX = 2.5,
}: CreatureWalkerProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [walkFrames, setWalkFrames] = useState<CreatureFrame[] | null>(null)
  const [phase, setPhase] = useState<AnimPhase>('loading')
  const [displayFrame, setDisplayFrame] = useState<CreatureFrame | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const walkIdxRef = useRef(0)
  const walkAccRef = useRef(0)
  const sitStartRef = useRef(0)
  const sleepPoseRef = useRef<CreatureFrame | null>(null)
  const lastWalkFrameRef = useRef<CreatureFrame | null>(null)

  // Load chromosomes and run simulation
  useEffect(() => {
    let cancelled = false
    loadBestChromosomes().then(data => {
      if (cancelled) return
      try {
        const chromo = data['sine'] ?? data['baseline']
        if (!chromo?.genes) return

        const jointParams = decodeDirect(chromo.genes)
        const terrain = createTerrain('flat')
        const result = runSimulation(terrain, jointParams)

        if (result.frames.length < 20) return

        // Sample N_FRAMES evenly (skip first 10% settling)
        const startIdx = Math.floor(result.frames.length * 0.1)
        const endIdx = result.frames.length - 1
        const step = (endIdx - startIdx) / (N_FRAMES - 1)
        const sampled: CreatureFrame[] = []
        for (let i = 0; i < N_FRAMES; i++) {
          const idx = Math.round(startIdx + i * step)
          sampled.push(result.frames[Math.min(idx, endIdx)])
        }

        setWalkFrames(sampled)
        setPhase('walking')
      } catch (e) {
        console.warn('CreatureWalker simulation failed:', e)
      }
    })
    return () => { cancelled = true }
  }, [])

  useFrame((state, delta) => {
    if (!walkFrames || !groupRef.current) return

    const elapsed = state.clock.elapsedTime
    if (startTimeRef.current === null) {
      startTimeRef.current = elapsed + delay
    }
    const t = elapsed - startTimeRef.current
    if (t < 0) return

    if (phase === 'walking') {
      // Advance walk cycle
      walkAccRef.current += delta * WALK_FPS
      if (walkAccRef.current >= 1) {
        const steps = Math.floor(walkAccRef.current)
        walkAccRef.current -= steps
        walkIdxRef.current = (walkIdxRef.current + steps) % walkFrames.length
      }

      const frame = walkFrames[walkIdxRef.current]
      // Normalize: center X on torso, shift Y so feet touch ground (y=0).
      // Find the lowest Y (ankle/foot level) to use as ground offset.
      const allY = [frame.torsoY, ...Object.values(frame.joints).map(j => j.y)]
      const minY = Math.min(...allY)
      const normalizedFrame: CreatureFrame = {
        ...frame,
        torsoX: 0,
        torsoY: frame.torsoY - minY,
        torsoAngle: frame.torsoAngle,
        joints: Object.fromEntries(
          Object.entries(frame.joints).map(([k, jt]) => [
            k,
            { ...jt, x: jt.x - frame.torsoX, y: jt.y - minY }
          ])
        ),
      }

      // Move group from startX toward targetX
      const walkProgress = Math.min(t / 4.0, 1) // 4 seconds to walk across
      const worldX = startX + (targetX - startX) * easeInOutQuad(walkProgress)
      groupRef.current.position.x = worldX

      setDisplayFrame(normalizedFrame)
      lastWalkFrameRef.current = normalizedFrame

      if (walkProgress >= 1) {
        setPhase('sitting')
        sitStartRef.current = elapsed
        sleepPoseRef.current = createSleepPose(normalizedFrame)
      }
    }

    if (phase === 'sitting') {
      const sitT = (elapsed - sitStartRef.current) / SIT_DURATION
      const progress = Math.min(sitT, 1)

      if (lastWalkFrameRef.current && sleepPoseRef.current) {
        const interpolated = lerpFrame(
          lastWalkFrameRef.current,
          sleepPoseRef.current,
          easeInOutQuad(progress)
        )
        setDisplayFrame(interpolated)
      }

      if (progress >= 1) {
        setPhase('sleeping')
      }
    }

    if (phase === 'sleeping') {
      // Gentle breathing — subtle Y oscillation
      groupRef.current.position.y = Math.sin(elapsed * 0.8) * 0.04
    }
  })

  return (
    <group ref={groupRef} position={[startX, 0, 0]}>
      {displayFrame && <CreatureSkeleton frame={displayFrame} />}
    </group>
  )
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
