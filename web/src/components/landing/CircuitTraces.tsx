/**
 * CircuitTraces — Animated "nervous system" lines connecting skeleton joints.
 *
 * Draws line segments between joint pairs defined in TRACE_CONNECTIONS.
 * Each frame, reads bone world positions and updates the line geometry.
 * An animated light pulse travels outward from the torso along each chain.
 *
 * Uses a single BufferGeometry with all line segments for performance —
 * one draw call for the entire trace network.
 *
 * VISIBILITY: Reads `jointMarkersVisible` from sceneStateRef (same as
 * JointMarker). Traces appear/disappear with the joint markers.
 *
 * Rendered OUTSIDE the WireframeHuman group (world space) — same as
 * JointMarker — so bone.getWorldPosition() gives correct placement.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACE_CONNECTIONS, MARKER_COLOR, MARKER_COLOR_ACTIVE } from './jointData.ts'
import type { SceneState } from './useScrollTimeline.ts'

interface CircuitTracesProps {
  /** Map of boneName → THREE.Bone (from WireframeHuman's skeleton traverse) */
  boneMap: Map<string, THREE.Bone>
  sceneStateRef: React.RefObject<SceneState>
}

/** Number of edges in the trace network */
const EDGE_COUNT = TRACE_CONNECTIONS.length

/**
 * Each edge is drawn as a line segment (2 vertices × 3 floats = 6 floats).
 * We also store per-vertex colors for the animated pulse effect.
 */
export default function CircuitTraces({ boneMap, sceneStateRef }: CircuitTracesProps) {
  const lineRef = useRef<THREE.LineSegments>(null)

  // Pre-allocate position and color buffers
  const { posAttr, colorAttr } = useMemo(() => {
    const positions = new Float32Array(EDGE_COUNT * 2 * 3) // 2 verts × 3 coords
    const colors = new Float32Array(EDGE_COUNT * 2 * 3)    // 2 verts × RGB

    const positionAttribute = new THREE.BufferAttribute(positions, 3)
    positionAttribute.setUsage(THREE.DynamicDrawUsage)

    const colorAttribute = new THREE.BufferAttribute(colors, 3)
    colorAttribute.setUsage(THREE.DynamicDrawUsage)

    return { posAttr: positionAttribute, colorAttr: colorAttribute }
  }, [])

  // Create geometry once with the pre-allocated buffers
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', posAttr)
    geo.setAttribute('color', colorAttr)
    return geo
  }, [posAttr, colorAttr])

  // Monochromatic: dim silver base → bright white pulse
  const baseColor = useMemo(() => new THREE.Color(MARKER_COLOR).multiplyScalar(0.3), [])
  const pulseColor = useMemo(() => new THREE.Color(MARKER_COLOR_ACTIVE), [])

  // Temp vectors for world position reads (reused each frame)
  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (!lineRef.current) return

    const visible = sceneStateRef.current?.jointMarkersVisible ?? false
    lineRef.current.visible = visible

    if (!visible) return

    const t = state.clock.elapsedTime
    const positions = posAttr.array as Float32Array
    const colors = colorAttr.array as Float32Array

    for (let i = 0; i < EDGE_COUNT; i++) {
      const [fromName, toName] = TRACE_CONNECTIONS[i]
      const boneA = boneMap.get(fromName)
      const boneB = boneMap.get(toName)

      if (!boneA || !boneB) {
        // Missing bone — hide this edge by collapsing to origin
        const offset = i * 6
        positions[offset] = positions[offset + 1] = positions[offset + 2] = 0
        positions[offset + 3] = positions[offset + 4] = positions[offset + 5] = 0
        continue
      }

      // Get world positions
      boneA.getWorldPosition(tmpA)
      boneB.getWorldPosition(tmpB)

      const offset = i * 6
      positions[offset] = tmpA.x
      positions[offset + 1] = tmpA.y
      positions[offset + 2] = tmpA.z
      positions[offset + 3] = tmpB.x
      positions[offset + 4] = tmpB.y
      positions[offset + 5] = tmpB.z

      // Animated pulse: a wave of brightness traveling outward from torso.
      // Each edge gets a phase based on its index (deeper connections = later phase).
      // The pulse cycles every ~3 seconds.
      const pulsePhase = i * 0.4 // stagger per edge
      const pulse = Math.max(0, Math.sin(t * 2.0 - pulsePhase))
      const pulseIntensity = pulse * pulse // square for sharper falloff

      // Blend between base (dim purple) and pulse (bright amber)
      const r = baseColor.r + (pulseColor.r - baseColor.r) * pulseIntensity
      const g = baseColor.g + (pulseColor.g - baseColor.g) * pulseIntensity
      const b = baseColor.b + (pulseColor.b - baseColor.b) * pulseIntensity

      // Start vertex color
      const cOffset = i * 6
      colors[cOffset] = r
      colors[cOffset + 1] = g
      colors[cOffset + 2] = b
      // End vertex — slightly delayed pulse for traveling effect
      const pulse2 = Math.max(0, Math.sin(t * 2.0 - pulsePhase - 0.3))
      const pi2 = pulse2 * pulse2
      colors[cOffset + 3] = baseColor.r + (pulseColor.r - baseColor.r) * pi2
      colors[cOffset + 4] = baseColor.g + (pulseColor.g - baseColor.g) * pi2
      colors[cOffset + 5] = baseColor.b + (pulseColor.b - baseColor.b) * pi2
    }

    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true
  })

  return (
    <lineSegments
      ref={lineRef}
      geometry={geometry}
      renderOrder={9}
    >
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.65}
        depthTest={false}
        linewidth={1}
      />
    </lineSegments>
  )
}
