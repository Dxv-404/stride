/**
 * R3FHelpers — lightweight replacements for @react-three/drei components.
 *
 * Replaces OrbitControls and Text from drei to avoid the massive
 * dependency tree that causes Vite optimization issues.
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame, extend } from '@react-three/fiber'
import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'

// Extend so R3F knows about OrbitControls
extend({ OrbitControls: ThreeOrbitControls })

/* ─── OrbitControls ─── */

interface OrbitControlsProps {
  enablePan?: boolean
  enableZoom?: boolean
  minDistance?: number
  maxDistance?: number
  autoRotate?: boolean
  autoRotateSpeed?: number
  minPolarAngle?: number
  maxPolarAngle?: number
  /** Orbit target point — defaults to [0, 0, 0] */
  target?: [number, number, number]
  /** When this value changes (by reference), the camera resets to its initial position */
  resetKey?: unknown
  /** Master enable/disable — when false, all orbit interaction is suppressed */
  enabled?: boolean
}

export function OrbitControls({
  enablePan = true,
  enableZoom = true,
  minDistance = 0,
  maxDistance = Infinity,
  autoRotate = false,
  autoRotateSpeed = 2,
  minPolarAngle = 0,
  maxPolarAngle = Math.PI,
  target,
  resetKey,
  enabled = true,
}: OrbitControlsProps) {
  const { camera, gl } = useThree()
  const controlsRef = useRef<ThreeOrbitControls | null>(null)
  // Capture the camera's initial position & target once (set by <Canvas camera={...}>)
  const initialPos = useRef<THREE.Vector3 | null>(null)
  const initialTarget = useRef<THREE.Vector3 | null>(null)
  const prevResetKey = useRef(resetKey)

  useEffect(() => {
    const controls = new ThreeOrbitControls(camera, gl.domElement)
    controls.enablePan = enablePan
    controls.enableZoom = enableZoom
    controls.minDistance = minDistance
    controls.maxDistance = maxDistance
    controls.autoRotate = autoRotate
    controls.autoRotateSpeed = autoRotateSpeed
    controls.minPolarAngle = minPolarAngle
    controls.maxPolarAngle = maxPolarAngle
    if (target) controls.target.set(target[0], target[1], target[2])
    controlsRef.current = controls

    // Save initial camera position & orbit target on first mount only
    if (!initialPos.current) {
      initialPos.current = camera.position.clone()
    }
    if (!initialTarget.current) {
      initialTarget.current = controls.target.clone()
    }

    return () => {
      controls.dispose()
    }
  }, [camera, gl, enablePan, enableZoom, minDistance, maxDistance, autoRotate, autoRotateSpeed, minPolarAngle, maxPolarAngle, target])

  // Reset camera when resetKey changes (skip initial render)
  useEffect(() => {
    if (prevResetKey.current !== resetKey && controlsRef.current && initialPos.current) {
      camera.position.copy(initialPos.current)
      if (initialTarget.current) {
        controlsRef.current.target.copy(initialTarget.current)
      }
      controlsRef.current.update()
    }
    prevResetKey.current = resetKey
  }, [resetKey, camera])

  useFrame(() => {
    if (!controlsRef.current) return
    // Sync enabled prop each frame (driven by drag state)
    controlsRef.current.enabled = enabled
    controlsRef.current.update()
  })

  return null
}

/* ─── Text (simple sprite-based text) ─── */

interface TextProps {
  children: string | string[]
  position?: [number, number, number]
  fontSize?: number
  color?: string
  anchorX?: 'left' | 'center' | 'right'
  rotation?: [number, number, number]
}

export function Text({
  children,
  position = [0, 0, 0],
  fontSize = 0.15,
  color = '#888',
}: TextProps) {
  // Join array children into a single string
  const text = Array.isArray(children) ? children.join('') : children
  const meshRef = useRef<THREE.Sprite>(null)

  const { texture, aspect } = useMemoTexture(text, fontSize, color)

  return (
    <sprite ref={meshRef} position={position} scale={[fontSize * aspect * 4, fontSize * 4, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  )
}

function useMemoTexture(text: string, fontSize: number, color: string) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const pxSize = Math.max(64, Math.round(fontSize * 512))
  const font = `${pxSize}px sans-serif`
  ctx.font = font
  const metrics = ctx.measureText(text)
  const w = Math.ceil(metrics.width) + 8
  const h = pxSize + 8

  canvas.width = w
  canvas.height = h
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  ctx.fillText(text, 4, 4)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true

  return { texture, aspect: w / h }
}
