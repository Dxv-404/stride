/**
 * useGLTF — loads a GLTF/GLB model using Three.js GLTFLoader.
 *
 * Returns { scene, nodes, materials } or null while loading.
 * Caches loaded models by URL to prevent duplicate fetches.
 */

import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface GLTFResult {
  scene: THREE.Group
  nodes: Record<string, THREE.Object3D>
  materials: Record<string, THREE.Material>
}

const cache = new Map<string, GLTFResult>()
const loader = new GLTFLoader()

export function useGLTF(url: string): GLTFResult | null {
  const [result, setResult] = useState<GLTFResult | null>(cache.get(url) ?? null)

  useEffect(() => {
    if (cache.has(url)) {
      setResult(cache.get(url)!)
      return
    }

    loader.load(
      url,
      (gltf: GLTF) => {
        const nodes: Record<string, THREE.Object3D> = {}
        const materials: Record<string, THREE.Material> = {}

        gltf.scene.traverse((child) => {
          if (child.name) nodes[child.name] = child
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            const mat = mesh.material
            if (Array.isArray(mat)) {
              mat.forEach(m => { if (m.name) materials[m.name] = m })
            } else if (mat.name) {
              materials[mat.name] = mat
            }
          }
        })

        const r: GLTFResult = { scene: gltf.scene, nodes, materials }
        cache.set(url, r)
        setResult(r)
      },
      undefined,
      (error) => {
        console.error(`Failed to load GLTF: ${url}`, error)
      }
    )
  }, [url])

  return result
}
