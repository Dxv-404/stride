/**
 * ExtrudedTitle — 3D text "STRIDE" with wireframe→solid extrusion animation.
 *
 * Animation sequence:
 *   1. Text starts flat (scale.z ≈ 0) in wireframe
 *   2. scale.z animates from 0→1 over ~1.5s (fake extrusion — cheap!)
 *   3. Wireframe fades out, solid material fades in
 *
 * Uses the scale.z trick instead of rebuilding TextGeometry each frame,
 * which would be prohibitively expensive (~90 geometry rebuilds).
 */

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFont } from '@/hooks/useFont.ts'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import * as THREE from 'three'

// Animation timing (seconds)
const EXTRUDE_DURATION = 1.5
const WIREFRAME_HOLD = 0.3  // pause in wireframe before transitioning
const MATERIAL_FADE = 0.8   // wireframe → solid transition
const TARGET_DEPTH = 0.35

interface ExtrudedTitleProps {
  position?: [number, number, number]
  /** Seconds before animation begins */
  delay?: number
  color?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function ExtrudedTitle({
  position = [0, 3, 0],
  delay = 0,
  color = '#C4956A',
}: ExtrudedTitleProps) {
  const font = useFont('/fonts/helvetiker_bold.typeface.json')
  const groupRef = useRef<THREE.Group>(null)
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const solidMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const startTimeRef = useRef<number | null>(null)
  const [done, setDone] = useState(false)

  // Build geometry once at full depth, center it
  const geometry = useMemo(() => {
    if (!font) return null
    const geo = new TextGeometry('STRIDE', {
      font,
      size: 1.0,
      depth: TARGET_DEPTH,
      curveSegments: 8,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    })
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    // Center horizontally and depth-wise
    geo.translate(
      -(box.max.x - box.min.x) / 2,
      0,
      -(TARGET_DEPTH / 2)
    )
    return geo
  }, [font])

  useFrame((state) => {
    if (!groupRef.current || done) return

    const elapsed = state.clock.elapsedTime
    if (startTimeRef.current === null) {
      startTimeRef.current = elapsed + delay
    }

    const t = elapsed - startTimeRef.current
    if (t < 0) return

    // Phase 1: Scale Z from ~0 to 1 (fake extrusion)
    const extrudeProgress = easeOutCubic(Math.min(t / EXTRUDE_DURATION, 1))
    groupRef.current.scale.z = Math.max(0.01, extrudeProgress)

    // Phase 2: Wireframe → Solid
    const fadeStart = EXTRUDE_DURATION + WIREFRAME_HOLD
    const fadeT = (t - fadeStart) / MATERIAL_FADE
    const fade = Math.max(0, Math.min(fadeT, 1))

    if (wireMatRef.current) wireMatRef.current.opacity = 1 - fade
    if (solidMatRef.current) solidMatRef.current.opacity = fade

    if (fade >= 1) setDone(true)
  })

  if (!font || !geometry) return null

  return (
    <group ref={groupRef} position={position} scale={[1, 1, 0.01]}>
      {/* Wireframe layer — visible during extrusion, fades out */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          ref={wireMatRef}
          color={color}
          wireframe
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>

      {/* Solid layer — fades in after extrusion */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          ref={solidMatRef}
          color={color}
          metalness={0.3}
          roughness={0.5}
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  )
}
