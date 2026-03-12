/**
 * LandingScene3D — Full 3D landing scene composition.
 *
 * A single R3F Canvas containing:
 *   - Wireframe grid floor with fog (Blender viewport aesthetic)
 *   - Retro CRT TV playing the landing animation
 *   - 3D extruded "STRIDE" title with wireframe→solid animation
 *   - Wireframe creature that walks in and sleeps
 *
 * Fixed camera — no user controls. Subtle cinematic drift.
 */

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import GridFloor from './GridFloor.tsx'
import RetroTV from './RetroTV.tsx'
import ExtrudedTitle from './ExtrudedTitle.tsx'
import CreatureWalker from './CreatureWalker.tsx'

/** Slow cinematic camera drift around the scene */
function CameraDrift() {
  const lookTarget = useRef(new THREE.Vector3(0, 1.5, -2))

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.04
    state.camera.position.x = 6 + Math.sin(t) * 1.2
    state.camera.position.z = 10 + Math.cos(t) * 1.0
    state.camera.position.y = 4 + Math.sin(t * 0.7) * 0.3
    state.camera.lookAt(lookTarget.current)
  })

  return null
}

export default function LandingScene3D() {
  return (
    <Canvas
      camera={{
        position: [6, 4, 10],
        fov: 45,
        near: 0.1,
        far: 200,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: 'var(--landing-bg, #0A0A0A)' }}
      dpr={[1, 2]}
    >
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.6} />
      <directionalLight position={[-5, 8, -5]} intensity={0.2} />

      {/* Grid floor */}
      <GridFloor fogColor="#0A0A0A" fogNear={15} fogFar={60} />

      {/* Retro CRT TV — centered, slightly rotated toward camera */}
      <RetroTV
        position={[0, 0, -2]}
        rotation={[0, 0.3, 0]}
        scale={6}
      />

      {/* 3D extruded title — floating above the TV */}
      <ExtrudedTitle
        position={[0, 5, -2]}
        delay={0.5}
      />

      {/* Wireframe creature — walks in from right after title animates */}
      <CreatureWalker
        delay={3.5}
        startX={10}
        targetX={3}
      />

      {/* Cinematic camera drift */}
      <CameraDrift />
    </Canvas>
  )
}
