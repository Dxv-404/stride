/**
 * usePreloader — Tracks THREE.js asset loading progress.
 *
 * Wraps THREE.DefaultLoadingManager to expose a 0→1 progress value.
 * The landing page uses this to display a branded loading screen
 * while the wireframe human GLB (~3.6 MB), video texture, and font
 * are fetched.
 *
 * Returns { progress, ready } where ready = all assets loaded + short delay.
 */

import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

interface PreloaderState {
  /** Loading progress 0–1 */
  progress: number
  /** True once all assets loaded and transition delay elapsed */
  ready: boolean
}

export function usePreloader(): PreloaderState {
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    const manager = THREE.DefaultLoadingManager

    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) {
        setProgress(loaded / total)
      }
    }

    manager.onLoad = () => {
      if (doneRef.current) return
      doneRef.current = true
      setProgress(1)
      // Short delay so the user sees the completed state before fade-out
      setTimeout(() => setReady(true), 400)
    }

    manager.onError = (url) => {
      console.warn('Failed to load:', url)
    }

    // Safety: if nothing loads (e.g. cache hit), auto-ready after 3s
    const safetyTimeout = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        setProgress(1)
        setReady(true)
      }
    }, 3000)

    return () => {
      clearTimeout(safetyTimeout)
    }
  }, [])

  return { progress, ready }
}
