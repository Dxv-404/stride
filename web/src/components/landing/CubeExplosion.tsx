/**
 * CubeExplosion — Section 5 R3F component: wireframe cube that explodes.
 *
 * A wireframe box appears as the user scrolls into Section 5. The cube
 * scales up, then its edges scatter outward as cubeExplodeProgress
 * reaches 1.0. Uses individual edge meshes (thin boxes) positioned
 * at each of the 12 edges of a unit cube.
 *
 * sceneState.cubeScale drives entrance, cubeExplodeProgress drives scatter.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneState } from './useScrollTimeline.ts'

interface CubeExplosionProps {
  sceneStateRef: React.RefObject<SceneState>
}

const ACCENT = '#C4956A'
const EDGE_THICKNESS = 0.02
const CUBE_SIZE = 2

/** Edge definition: start point, end point, scatter direction */
interface EdgeDef {
  start: [number, number, number]
  end: [number, number, number]
  scatterDir: [number, number, number]
  rotAxis: [number, number, number]
}

/** Generate the 12 edges of a cube centered at origin */
function createEdges(size: number): EdgeDef[] {
  const h = size / 2
  const edges: EdgeDef[] = []

  // Bottom face (y = -h)
  edges.push({ start: [-h, -h, -h], end: [h, -h, -h], scatterDir: [0, -1, -1], rotAxis: [1, 0, 0] })
  edges.push({ start: [h, -h, -h], end: [h, -h, h], scatterDir: [1, -1, 0], rotAxis: [0, 1, 0] })
  edges.push({ start: [h, -h, h], end: [-h, -h, h], scatterDir: [0, -1, 1], rotAxis: [1, 0, 0] })
  edges.push({ start: [-h, -h, h], end: [-h, -h, -h], scatterDir: [-1, -1, 0], rotAxis: [0, 1, 0] })

  // Top face (y = h)
  edges.push({ start: [-h, h, -h], end: [h, h, -h], scatterDir: [0, 1, -1], rotAxis: [1, 0, 0] })
  edges.push({ start: [h, h, -h], end: [h, h, h], scatterDir: [1, 1, 0], rotAxis: [0, 1, 0] })
  edges.push({ start: [h, h, h], end: [-h, h, h], scatterDir: [0, 1, 1], rotAxis: [1, 0, 0] })
  edges.push({ start: [-h, h, h], end: [-h, h, -h], scatterDir: [-1, 1, 0], rotAxis: [0, 1, 0] })

  // Vertical edges
  edges.push({ start: [-h, -h, -h], end: [-h, h, -h], scatterDir: [-1, 0, -1], rotAxis: [0, 0, 1] })
  edges.push({ start: [h, -h, -h], end: [h, h, -h], scatterDir: [1, 0, -1], rotAxis: [0, 0, 1] })
  edges.push({ start: [h, -h, h], end: [h, h, h], scatterDir: [1, 0, 1], rotAxis: [0, 0, 1] })
  edges.push({ start: [-h, -h, h], end: [-h, h, h], scatterDir: [-1, 0, 1], rotAxis: [0, 0, 1] })

  return edges
}

/** Single edge mesh — a thin box along the edge */
function EdgeMesh({
  edge,
  sceneStateRef,
  index,
}: {
  edge: EdgeDef
  sceneStateRef: React.RefObject<SceneState>
  index: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Precompute edge geometry data
  const { midpoint, length, quaternion } = useMemo(() => {
    const s = new THREE.Vector3(...edge.start)
    const e = new THREE.Vector3(...edge.end)
    const mid = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5)
    const len = s.distanceTo(e)
    const dir = new THREE.Vector3().subVectors(e, s).normalize()
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir
    )
    return { midpoint: mid, length: len, quaternion: q }
  }, [edge])

  useFrame(() => {
    if (!meshRef.current || !sceneStateRef.current) return

    // Read live value from mutable ref each frame (not a stale prop)
    const explodeProgress = sceneStateRef.current.cubeExplodeProgress

    // Ease the explosion
    const t = easeOutCubic(Math.max(0, explodeProgress))

    // Scatter outward
    const scatter = new THREE.Vector3(...edge.scatterDir).normalize()
    const offset = scatter.multiplyScalar(t * 4 + t * t * 2)

    meshRef.current.position.copy(midpoint).add(offset)
    meshRef.current.quaternion.copy(quaternion)

    // Add rotation during explosion
    const rotAxis = new THREE.Vector3(...edge.rotAxis)
    const rotQuat = new THREE.Quaternion().setFromAxisAngle(
      rotAxis,
      t * Math.PI * (1 + index * 0.3)
    )
    meshRef.current.quaternion.premultiply(rotQuat)

    // Fade out during explosion
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 1 - t * 0.7
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[EDGE_THICKNESS, length, EDGE_THICKNESS]} />
      <meshBasicMaterial color={ACCENT} transparent opacity={1} />
    </mesh>
  )
}

export default function CubeExplosion({ sceneStateRef }: CubeExplosionProps) {
  const groupRef = useRef<THREE.Group>(null)
  const edges = useMemo(() => createEdges(CUBE_SIZE), [])

  useFrame((state) => {
    if (!groupRef.current || !sceneStateRef.current) return
    const ss = sceneStateRef.current

    // Visibility
    groupRef.current.visible = ss.cubeScale > 0.01

    // Scale entrance
    const s = ss.cubeScale
    groupRef.current.scale.set(s, s, s)

    // Gentle rotation before explosion
    if (ss.cubeExplodeProgress < 0.1) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, 1.5, 0]}>
      {edges.map((edge, i) => (
        <EdgeMesh
          key={i}
          edge={edge}
          sceneStateRef={sceneStateRef}
          index={i}
        />
      ))}

      {/* Center point light — intensity driven by useFrame in parent group */}
      <CubeLight sceneStateRef={sceneStateRef} />
    </group>
  )
}

/** Point light at cube center — intensity ramps up during explosion */
function CubeLight({ sceneStateRef }: CubeExplosionProps) {
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame(() => {
    if (!lightRef.current || !sceneStateRef.current) return
    const p = sceneStateRef.current.cubeExplodeProgress
    lightRef.current.intensity = p > 0.3 ? p * 3 : 0.5
  })

  return (
    <pointLight ref={lightRef} color={ACCENT} intensity={0.5} distance={6} />
  )
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}
