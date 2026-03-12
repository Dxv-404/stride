/**
 * useVideoTexture — creates a Three.js VideoTexture from a video URL.
 *
 * Creates a hidden <video> element set to loop+muted+autoplay,
 * wraps it in a VideoTexture, and disposes on unmount.
 */

import { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'

interface VideoTextureOptions {
  loop?: boolean
  muted?: boolean
  autoplay?: boolean
}

export function useVideoTexture(
  src: string,
  options: VideoTextureOptions = {}
): THREE.VideoTexture | null {
  const { loop = true, muted = true, autoplay = true } = options
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = document.createElement('video')
    video.src = src
    video.crossOrigin = 'anonymous'
    video.loop = loop
    video.muted = muted
    video.playsInline = true
    video.preload = 'auto'
    videoRef.current = video

    const onCanPlay = () => {
      const tex = new THREE.VideoTexture(video)
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.colorSpace = THREE.SRGBColorSpace
      setTexture(tex)

      if (autoplay) {
        video.play().catch((e) => {
          console.warn('Video autoplay blocked:', e)
        })
      }
    }

    video.addEventListener('canplaythrough', onCanPlay, { once: true })
    video.load()

    return () => {
      video.removeEventListener('canplaythrough', onCanPlay)
      video.pause()
      video.removeAttribute('src')
      video.load() // release resources
      videoRef.current = null
      setTexture((prev) => {
        prev?.dispose()
        return null
      })
    }
  }, [src, loop, muted, autoplay])

  return texture
}
