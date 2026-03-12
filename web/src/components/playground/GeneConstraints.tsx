/**
 * GeneConstraints — visual constraint editor for gene bounds.
 *
 * Features:
 *   - Set min/max bounds per gene
 *   - Link symmetric joints (left/right)
 *   - Lock individual genes
 */

import { useState, useCallback } from 'react'
import { JOINT_NAMES } from '@/engine/encoding.ts'

interface GeneConstraintsProps {
  genes: number[]
  onApply: (genes: number[]) => void
}

interface Constraint {
  min: number
  max: number
  locked: boolean
}

const PARAM_NAMES = ['amp', 'freq', 'phase'] as const

/** Symmetric joint pairs (left index, right index) */
const SYMMETRIC_PAIRS = [
  [0, 3],   // hip_L <-> hip_R (gene groups 0-2, 9-11)
  [1, 4],   // knee_L <-> knee_R (gene groups 3-5, 12-14)
  [2, 5],   // shoulder_L <-> shoulder_R (gene groups 6-8, 15-17)
]

export default function GeneConstraints({ genes, onApply }: GeneConstraintsProps) {
  const [constraints, setConstraints] = useState<Constraint[]>(() =>
    genes.map(() => ({ min: 0, max: 1, locked: false }))
  )
  const [symmetryLinked, setSymmetryLinked] = useState(false)

  const handleLockToggle = useCallback((index: number) => {
    setConstraints(prev => {
      const next = [...prev]
      next[index] = { ...next[index], locked: !next[index].locked }
      return next
    })
  }, [])

  const handleClamp = useCallback(() => {
    const newGenes = genes.map((g, i) => {
      const c = constraints[i]
      if (!c) return g
      if (c.locked) return g
      return Math.max(c.min, Math.min(c.max, g))
    })
    onApply(newGenes)
  }, [genes, constraints, onApply])

  const handleSymmetrize = useCallback(() => {
    const newGenes = [...genes]
    for (const [leftJoint, rightJoint] of SYMMETRIC_PAIRS) {
      for (let p = 0; p < 3; p++) {
        const leftIdx = leftJoint * 3 + p
        const rightIdx = rightJoint * 3 + p
        if (leftIdx < newGenes.length && rightIdx < newGenes.length) {
          if (p === 2) {
            // Phase: mirror (add 0.5, wrap)
            newGenes[rightIdx] = (newGenes[leftIdx] + 0.5) % 1
          } else {
            // Amplitude, frequency: copy
            newGenes[rightIdx] = newGenes[leftIdx]
          }
        }
      }
    }
    onApply(newGenes)
  }, [genes, onApply])

  const handleRandomize = useCallback(() => {
    const newGenes = genes.map((g, i) => {
      const c = constraints[i]
      if (!c || c.locked) return g
      return c.min + Math.random() * (c.max - c.min)
    })
    onApply(newGenes)
  }, [genes, constraints, onApply])

  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted mb-2">
        Gene Constraints
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={handleClamp}
          className="btn-flat text-[10px] px-2.5 py-0.5"
        >
          Clamp All
        </button>
        <button
          onClick={handleRandomize}
          className="btn-flat text-[10px] px-2.5 py-0.5"
        >
          Random (Bounded)
        </button>
        <button
          onClick={handleSymmetrize}
          className="btn-flat text-[10px] px-2.5 py-0.5"
        >
          Symmetrize
        </button>
        <button
          onClick={() => setSymmetryLinked(l => !l)}
          className={`text-[10px] px-2.5 py-0.5 border transition-colors cursor-pointer
            ${symmetryLinked
              ? 'border-accent text-accent bg-accent/10'
              : 'border-border text-text-muted hover:text-text'}`}
        >
          Link L/R
        </button>
      </div>

      {/* Gene constraint list */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {genes.map((g, i) => {
          const jointIdx = Math.floor(i / 3)
          const paramIdx = i % 3
          const label = `${JOINT_NAMES[jointIdx] ?? `J${jointIdx}`}.${PARAM_NAMES[paramIdx]}`
          const c = constraints[i] ?? { min: 0, max: 1, locked: false }

          return (
            <div key={i} className="flex items-center gap-1.5">
              {/* Lock toggle */}
              <button
                onClick={() => handleLockToggle(i)}
                className={`w-4 h-4 flex items-center justify-center text-[8px] cursor-pointer
                  ${c.locked ? 'text-red-400' : 'text-text-dim hover:text-text-muted'}`}
                title={c.locked ? 'Unlock' : 'Lock'}
              >
                {c.locked ? '🔒' : '·'}
              </button>

              {/* Label */}
              <span className="font-mono text-[8px] text-text-dim w-14 truncate">
                {label}
              </span>

              {/* Current value */}
              <span className="font-mono text-[8px] text-text-secondary w-8 text-right">
                {g.toFixed(2)}
              </span>

              {/* Min/Max visualization */}
              <div className="flex-1 h-2 bg-bg-surface border border-border relative">
                {/* Allowed range */}
                <div
                  className="absolute top-0 bottom-0 bg-accent/20"
                  style={{
                    left: `${c.min * 100}%`,
                    width: `${(c.max - c.min) * 100}%`,
                  }}
                />
                {/* Current value marker */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-accent"
                  style={{ left: `${g * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
