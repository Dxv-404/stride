/**
 * GridFloor — Wireframe grid floor with fog fade at horizon.
 *
 * Mimics the viewport grid from Blender/Unity: a major grid
 * with subtle sub-grid lines, fading into fog at the edges.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

interface GridFloorProps {
  size?: number
  divisions?: number
  colorCenter?: string
  colorGrid?: string
  fogColor?: string
  fogNear?: number
  fogFar?: number
}

export default function GridFloor({
  size = 100,
  divisions = 100,
  colorCenter = '#444444',
  colorGrid = '#222222',
  fogColor = '#0A0A0A',
  fogNear = 15,
  fogFar = 60,
}: GridFloorProps) {
  const { scene } = useThree()

  // Apply fog to the scene for horizon fade
  useEffect(() => {
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)
    return () => {
      scene.fog = null
    }
  }, [scene, fogColor, fogNear, fogFar])

  return (
    <group>
      {/* Main grid */}
      <gridHelper args={[size, divisions, colorCenter, colorGrid]} />
      {/* Finer sub-grid — offset down slightly to prevent z-fighting */}
      <gridHelper
        args={[size, divisions * 2, '#181818', '#181818']}
        position={[0, -0.001, 0]}
      />
    </group>
  )
}
