/**
 * Best chromosomes pre-loaded from the Python experiment results.
 *
 * These are the best-performing chromosomes across all 30 runs for each
 * controller type. They're used by:
 *   - Push Test (Tab 3): pre-loaded creatures for each controller
 *   - Controller Race (Tab 2): side-by-side comparison
 *   - Gene Playground (Tab 4): "Best Evolved Walker" preset
 */

import type { ControllerType } from '@/engine/controllers.ts'

export interface BestChromosome {
  genes: number[]
  fitness: number
  n_runs: number
}

// Inline the best chromosomes to avoid async loading issues.
// Data from experiments/results/web_export/best_chromosomes.json
let _cache: Record<string, BestChromosome> | null = null

export async function loadBestChromosomes(): Promise<Record<string, BestChromosome>> {
  if (_cache) return _cache

  try {
    const resp = await fetch('/data/best_chromosomes.json')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    _cache = await resp.json()
    return _cache!
  } catch {
    console.warn('Failed to load best_chromosomes.json, using fallback')
    return getFallbackChromosomes()
  }
}

/**
 * Get best chromosome for a specific controller type.
 * Falls back to random genes if data isn't loaded yet.
 */
export function getBestGenes(
  data: Record<string, BestChromosome>,
  controllerType: ControllerType,
): number[] {
  // Map controller type to JSON key
  const keyMap: Record<ControllerType, string[]> = {
    sine: ['sine', 'baseline'],
    cpg: ['cpg', 'cpg_baseline'],
    cpg_nn: ['cpgnn_flat', 'cpgnn_mixed', 'cpg_nn'],
  }

  const keys = keyMap[controllerType]
  for (const key of keys) {
    if (data[key]?.genes) return data[key].genes
  }

  // Fallback: random genes
  const geneCount = controllerType === 'sine' ? 18 : controllerType === 'cpg' ? 38 : 96
  return Array.from({ length: geneCount }, () => Math.random())
}

function getFallbackChromosomes(): Record<string, BestChromosome> {
  return {
    sine: {
      genes: Array.from({ length: 18 }, () => Math.random()),
      fitness: 0,
      n_runs: 0,
    },
    cpg: {
      genes: Array.from({ length: 38 }, () => Math.random()),
      fitness: 0,
      n_runs: 0,
    },
    cpgnn_flat: {
      genes: Array.from({ length: 96 }, () => 0.5),
      fitness: 0,
      n_runs: 0,
    },
  }
}
