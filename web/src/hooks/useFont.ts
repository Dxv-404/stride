/**
 * useFont — loads a Three.js typeface JSON font for TextGeometry.
 *
 * Returns the parsed Font object or null while loading.
 * Caches by URL to prevent duplicate fetches.
 */

import { useState, useEffect } from 'react'
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js'

const cache = new Map<string, Font>()
const loader = new FontLoader()

export function useFont(url: string): Font | null {
  const [font, setFont] = useState<Font | null>(cache.get(url) ?? null)

  useEffect(() => {
    if (cache.has(url)) {
      setFont(cache.get(url)!)
      return
    }

    loader.load(
      url,
      (loadedFont: Font) => {
        cache.set(url, loadedFont)
        setFont(loadedFont)
      },
      undefined,
      (error) => {
        console.error(`Failed to load font: ${url}`, error)
      }
    )
  }, [url])

  return font
}
