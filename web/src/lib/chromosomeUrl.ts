/**
 * chromosomeUrl — encode/decode chromosomes as shareable URL hashes.
 *
 * Format: #genes=<base64url-encoded Float32Array>&ctrl=<controllerType>
 *
 * Uses base64url encoding (URL-safe base64 without padding) to keep
 * URLs short. A typical 18-gene chromosome encodes to ~96 characters.
 */

import type { ControllerType } from '@/engine/controllers.ts'

/* ─── Encoding ─── */

/**
 * Encode genes + controller type into a URL hash string.
 */
export function encodeChromosome(genes: number[], controllerType: ControllerType): string {
  const float32 = new Float32Array(genes)
  const bytes = new Uint8Array(float32.buffer)
  const binary = String.fromCharCode(...bytes)
  const base64 = btoa(binary)
  // Convert to base64url (URL-safe)
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `genes=${base64url}&ctrl=${controllerType}`
}

/**
 * Build a full shareable URL with chromosome hash.
 */
export function buildShareUrl(genes: number[], controllerType: ControllerType, path = '/playground'): string {
  const hash = encodeChromosome(genes, controllerType)
  const base = window.location.origin + path
  return `${base}#${hash}`
}

/* ─── Decoding ─── */

/**
 * Decode a URL hash string back into genes + controller type.
 * Returns null if the hash is invalid or missing.
 */
export function decodeChromosome(hash: string): { genes: number[]; controllerType: ControllerType } | null {
  try {
    const clean = hash.startsWith('#') ? hash.slice(1) : hash
    if (!clean) return null

    const params = new URLSearchParams(clean)
    const genesStr = params.get('genes')
    const ctrl = params.get('ctrl')
    if (!genesStr || !ctrl) return null

    // Validate controller type
    if (!['sine', 'cpg', 'cpg_nn'].includes(ctrl)) return null

    // Decode base64url back to base64
    let base64 = genesStr.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    while (base64.length % 4 !== 0) base64 += '='

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const float32 = new Float32Array(bytes.buffer)
    const genes = Array.from(float32)

    // Sanity check: genes should be in [0, 1] range (mostly)
    if (genes.length === 0 || genes.some(g => !isFinite(g))) return null

    return { genes, controllerType: ctrl as ControllerType }
  } catch {
    return null
  }
}

/**
 * Check current URL hash for an encoded chromosome.
 */
export function getChromosomeFromUrl(): { genes: number[]; controllerType: ControllerType } | null {
  return decodeChromosome(window.location.hash)
}
