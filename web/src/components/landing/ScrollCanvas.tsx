/**
 * ScrollCanvas — Persistent R3F Canvas for the scrollytelling landing page.
 *
 * Sits position: fixed at z-index 0. Contains all 3D objects for every
 * section. A SceneController component reads from sceneStateRef each
 * frame to position/fade/scale 3D elements based on scroll progress.
 *
 * This Canvas never unmounts — scroll controls what's visible.
 *
 * NOTE: Hero section (Section 1) is now pure HTML — no 3D elements.
 * The first 3D content is the wireframe human in Section 2.
 *
 * CAMERA NOTE: The GLB model uses SkinnedMesh — bone-driven vertices
 * render at their default skeleton position (feet≈y0, head≈y5) regardless
 * of group Y offset. Camera and orbit target must point at the ACTUAL
 * visual center (~y2.5), not at a group offset.
 */

import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { SceneState } from './useScrollTimeline.ts'
import WireframeHuman from './WireframeHuman.tsx'
import { OrbitControls } from '@/components/viz/R3FHelpers.tsx'
import CubeExplosion from './CubeExplosion.tsx'
import { useLandingStore } from '@/stores/landingStore.ts'

/* ─── Scene Controller: reads mutable refs, drives camera ─── */

interface SceneControllerProps {
  sceneStateRef: React.RefObject<SceneState>
}

function SceneController({ sceneStateRef }: SceneControllerProps) {
  const { camera } = useThree()

  useFrame(() => {
    if (!sceneStateRef.current) return
    const ss = sceneStateRef.current

    // Sections 1-2: Camera position for wireframe human viewing
    // Skip when orbit is active — OrbitControls owns the camera then
    // With scale 0.55: model spans y≈0→2.75, visual center ≈ y1.4
    // Camera at y3 gives a slight downward "hero shot" angle
    if (ss.activeSection <= 2 && !ss.orbitEnabled) {
      camera.position.set(0, 7, 10) // Y=camera height, Z=distance (closer for detail)
      camera.lookAt(0, 2.5, 0)      // Aim at model's visual center
    }

    // Section 3: Camera pans right so the model sits in the left portion
    // of the viewport and the About text panel sits unobstructed on the right.
    // Reduced X offset (was 3) so the bigger model appears more centered-left.
    if (ss.activeSection === 3 && !ss.orbitEnabled) {
      camera.position.lerp(new THREE.Vector3(2, 2.5, 10), 0.04)
      camera.lookAt(2, 1.2, 0)
    }

    // Section 4: Maintain position (charts are HTML, not 3D)
    if (ss.activeSection === 4) {
      camera.position.lerp(new THREE.Vector3(0, 2, 9), 0.03)
      camera.lookAt(0, 1, 0)
    }

    // Section 5: Zoom towards cube
    if (ss.activeSection === 5) {
      const zoomProgress = ss.cubeScale
      camera.position.lerp(
        new THREE.Vector3(0, 1.5, 9 - zoomProgress * 4),
        0.03
      )
      camera.lookAt(0, 1.5, 0)
    }
  })

  return null
}

/* ─── Conditional OrbitControls (active during Section 2, no zoom) ─── */

function ConditionalOrbitControls({ sceneStateRef }: SceneControllerProps) {
  const [orbitMounted, setOrbitMounted] = useState(false)
  const [dragging, setDragging] = useState(false)
  const prevOrbit = useRef(false)
  const prevDrag = useRef(false)
  const cameraResetFlag = useLandingStore((s) => s.cameraResetFlag)

  // Bridge mutable ref → React state so component mounts/unmounts correctly.
  // Also track isDraggingJoint to suppress OrbitControls during joint drag.
  useFrame(() => {
    const ss = sceneStateRef.current
    const shouldMount = ss?.orbitEnabled ?? false
    const isDrag = ss?.isDraggingJoint ?? false

    if (shouldMount !== prevOrbit.current) {
      prevOrbit.current = shouldMount
      setOrbitMounted(shouldMount)
    }
    if (isDrag !== prevDrag.current) {
      prevDrag.current = isDrag
      setDragging(isDrag)
    }
  })

  if (!orbitMounted) return null

  return (
    <OrbitControls
      enablePan={true}
      enableZoom={true}
      minDistance={4}
      maxDistance={20}
      target={[0, 2.5, 0]}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.85}
      resetKey={cameraResetFlag}
      enabled={!dragging}
    />
  )
}

/* ─── Main Canvas Component ─── */

interface ScrollCanvasProps {
  sceneStateRef: React.RefObject<SceneState>
}

export default function ScrollCanvas({ sceneStateRef }: ScrollCanvasProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{
          position: [0, 3, 10],
          fov: 45,
          near: 0.1,
          far: 200,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent', pointerEvents: 'auto' }}
        dpr={[1, 1.5]}
      >
        {/* Lighting — subtle for dark bg, MeshBasicMaterial ignores lights anyway */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[10, 15, 10]} intensity={0.3} />
        <directionalLight position={[-5, 8, -5]} intensity={0.1} />

        {/* Scene controller — reads sceneState, positions camera */}
        <SceneController sceneStateRef={sceneStateRef} />

        {/* Section 2-3: Wireframe Human */}
        <WireframeHuman sceneStateRef={sceneStateRef} />

        {/* Orbit Controls — zoom disabled, only active during Section 2 */}
        <ConditionalOrbitControls sceneStateRef={sceneStateRef} />

        {/* Section 5: Cube Explosion */}
        <CubeExplosion sceneStateRef={sceneStateRef} />
      </Canvas>
    </div>
  )
}
