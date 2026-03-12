/**
 * RetroTV — Retro CRT television (Chayka 206) with video on screen.
 *
 * Loads the GLB model, applies a dark material to the body,
 * then overlays a PlaneGeometry with VideoTexture at the screen
 * position derived from the OBJ vertex data.
 *
 * Screen rectangle (from OBJ analysis):
 *   X: [-0.332, 0.158], Y: [0.043, 0.465], Z: ~0.175
 */

import { useEffect, useMemo } from 'react'
import { useGLTF } from '@/hooks/useGLTF.ts'
import { useVideoTexture } from '@/hooks/useVideoTexture.ts'
import * as THREE from 'three'

// Screen corners from OBJ vertex analysis
const SCREEN = {
  minX: -0.332,
  maxX: 0.158,
  minY: 0.043,
  maxY: 0.465,
  z: 0.185, // slightly in front of glass surface (avoid z-fighting)
}
const SCREEN_W = SCREEN.maxX - SCREEN.minX   // ~0.49
const SCREEN_H = SCREEN.maxY - SCREEN.minY   // ~0.422
const SCREEN_CX = (SCREEN.minX + SCREEN.maxX) / 2  // ~-0.087
const SCREEN_CY = (SCREEN.minY + SCREEN.maxY) / 2  // ~0.254

interface RetroTVProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export default function RetroTV({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: RetroTVProps) {
  const gltf = useGLTF('/models/retro_tv.glb')
  const videoTexture = useVideoTexture('/landing_video.mp4')

  // Clone the scene so material changes don't affect the cache
  const clonedScene = useMemo(() => {
    if (!gltf) return null
    return gltf.scene.clone(true)
  }, [gltf])

  // Apply a dark material to the TV body (replacing the missing-texture default)
  useEffect(() => {
    if (!clonedScene) return

    clonedScene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh
      mesh.material = new THREE.MeshStandardMaterial({
        color: '#1a1a1a',
        roughness: 0.7,
        metalness: 0.2,
      })
    })
  }, [clonedScene])

  if (!clonedScene) return null

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* TV body */}
      <primitive object={clonedScene} />

      {/* Video screen overlay */}
      <mesh position={[SCREEN_CX, SCREEN_CY, SCREEN.z]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        {videoTexture ? (
          <meshBasicMaterial map={videoTexture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#111111" />
        )}
      </mesh>

      {/* Subtle screen glow */}
      <pointLight
        position={[SCREEN_CX, SCREEN_CY, SCREEN.z + 0.5]}
        intensity={0.8}
        distance={4}
        color="#8899aa"
      />
    </group>
  )
}
