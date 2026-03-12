/**
 * WireframeHuman — 3D wireframe human model for the scrollytelling landing.
 *
 * Loads wireframe_man.glb, applies purple wireframe material, traverses
 * the skeleton to place JointMarker spheres at key bones.
 *
 * Position, scale, rotation, and opacity are driven by sceneState refs
 * (written by GSAP ScrollTrigger, read here each frame).
 *
 * IMPORTANT: We use the original gltf.scene directly (NOT a clone).
 * Three.js SkinnedMesh.clone() doesn't rebind the skeleton to cloned
 * bones — the renderer only updates the original skeleton's world matrices.
 * Since we only use this model on the landing page, mutating the cached
 * scene is safe and ensures bone.getWorldPosition() returns correct values.
 *
 * NOTE: The GLB uses SkinnedMesh — bone-driven vertices render at
 * their default skeleton position (roughly y=0 feet, y≈5 head) regardless
 * of the group's Y position. Camera/orbit must target the actual visual range.
 */

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGLTF } from '@/hooks/useGLTF.ts'
import JointMarker from './JointMarker.tsx'
import CircuitTraces from './CircuitTraces.tsx'
import { JOINT_DATA } from './jointData.ts'
import type { JointInfo } from './jointData.ts'
import type { SceneState } from './useScrollTimeline.ts'

interface WireframeHumanProps {
  sceneStateRef: React.RefObject<SceneState>
}

/** Matched bone entry for rendering JointMarkers */
interface MatchedBone {
  bone: THREE.Bone
  info: JointInfo
}

export default function WireframeHuman({ sceneStateRef }: WireframeHumanProps) {
  const groupRef = useRef<THREE.Group>(null)
  const gltf = useGLTF('/models/wireframe_man.glb')
  const materialsApplied = useRef(false)
  const [matchedBones, setMatchedBones] = useState<MatchedBone[]>([])
  const [boneMap, setBoneMap] = useState<Map<string, THREE.Bone>>(new Map())

  // Apply wireframe material directly to the original scene (once only).
  // No cloning — avoids the SkinnedMesh skeleton rebinding issue.
  // No glow mesh clone — SkinnedMesh.clone() doesn't rebind skeleton.
  useEffect(() => {
    if (!gltf || materialsApplied.current) return
    materialsApplied.current = true

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return
      const mesh = child as THREE.Mesh

      // Purple wireframe — semi-transparent so joint markers show through
      // the dense 120K-tri mesh (which looks nearly solid at full opacity)
      mesh.material = new THREE.MeshBasicMaterial({
        color: '#A855F7',
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      })
    })
  }, [gltf])

  // Find matching bones in the skeleton for joint markers + circuit traces.
  // Uses the original (rendered) scene so bone world matrices are
  // updated by the renderer — getWorldPosition() returns correct values.
  useEffect(() => {
    if (!gltf) return

    const bones: MatchedBone[] = []
    const map = new Map<string, THREE.Bone>()

    gltf.scene.traverse((child) => {
      if (!(child as THREE.Bone).isBone) return
      const bone = child as THREE.Bone

      // Exact match by bone name (jointData uses the actual GLB bone names)
      const info = JOINT_DATA.find((j) => j.boneName === bone.name)

      if (info) {
        bones.push({ bone, info })
        map.set(bone.name, bone) // also populate the map for CircuitTraces
      }
    })

    if (import.meta.env.DEV) {
      console.log('[WireframeHuman] Matched bones:', bones.map(b => `${b.bone.name} → ${b.info.label}`))
    }
    setMatchedBones(bones)
    setBoneMap(map)
  }, [gltf])

  // Drive position/scale/opacity from scroll state each frame
  useFrame(() => {
    if (!groupRef.current || !sceneStateRef.current) return
    const ss = sceneStateRef.current

    // Scale entrance animation (Section 2 entry)
    // 0.55 is the sweet spot — large enough to see joint detail,
    // small enough to not overflow viewport edges
    const scale = ss.humanScale * 0.55
    groupRef.current.scale.set(scale, scale, scale)

    // Horizontal slide (Section 3: slides left)
    groupRef.current.position.x = ss.humanX * 8 // convert normalized to world units
    // NOTE: position.y doesn't work for SkinnedMesh (bind matrix issue).
    // To move the model up/down, change camera Y values in ScrollCanvas.tsx lines 45-46.

    // Rotation (Section 3: slight turn)
    groupRef.current.rotation.y = ss.humanRotY

    // Opacity fade (Section 4: fades out)
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.Material
        if ('opacity' in mat) {
          ;(mat as THREE.MeshBasicMaterial).opacity = ss.humanOpacity * 0.55
        }
      }
    })

    // Visibility — show when humanScale > 0 and opacity > 0
    groupRef.current.visible = ss.humanScale > 0.01 && ss.humanOpacity > 0.01
  })

  if (!gltf) return null

  return (
    <>
      <group ref={groupRef}>
        {/* Wireframe human model — original scene, not a clone */}
        <primitive object={gltf.scene} />

        {/* Soft purple point light for subtle illumination on dark bg */}
        <pointLight
          color="#A855F7"
          intensity={0.4}
          distance={15}
          position={[0, 2.5, 3]}
        />
      </group>

      {/* Circuit traces — "nervous system" lines between joints.
          Rendered OUTSIDE the group (world space) like JointMarker.
          Uses boneMap to read world positions each frame. */}
      {boneMap.size > 0 && (
        <CircuitTraces
          boneMap={boneMap}
          sceneStateRef={sceneStateRef}
        />
      )}

      {/* Joint markers — rendered OUTSIDE the group to avoid double-scaling.
          bone.getWorldPosition() already includes the group's transform,
          so markers in world space land exactly on the bones.
          Pass sceneStateRef so markers can read visibility in useFrame
          (props from a mutable ref go stale without re-renders). */}
      {matchedBones.map(({ bone, info }) => (
        <JointMarker
          key={info.boneName}
          bone={bone}
          info={info}
          sceneStateRef={sceneStateRef}
        />
      ))}
    </>
  )
}
