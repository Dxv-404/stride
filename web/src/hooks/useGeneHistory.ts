/**
 * useGeneHistory — undo/redo stack for gene modifications.
 *
 * Maintains a bounded stack (max 50 states) for gene editing history.
 * Provides undo/redo with keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z).
 */

import { useState, useCallback, useRef, useEffect } from 'react'

const MAX_HISTORY = 50

interface GeneHistoryState {
  past: number[][]
  present: number[]
  future: number[][]
}

export function useGeneHistory(initialGenes: number[]) {
  const [state, setState] = useState<GeneHistoryState>({
    past: [],
    present: initialGenes,
    future: [],
  })

  // Track external resets (encoding change, preset load)
  const lastInitRef = useRef(initialGenes)
  useEffect(() => {
    if (initialGenes !== lastInitRef.current) {
      lastInitRef.current = initialGenes
      setState({
        past: [],
        present: initialGenes,
        future: [],
      })
    }
  }, [initialGenes])

  /** Push a new state (clears redo stack) */
  const push = useCallback((newGenes: number[]) => {
    setState(prev => ({
      past: [...prev.past.slice(-MAX_HISTORY + 1), prev.present],
      present: newGenes,
      future: [],
    }))
  }, [])

  /** Undo to previous state */
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.past.length === 0) return prev
      const previous = prev.past[prev.past.length - 1]
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future],
      }
    })
  }, [])

  /** Redo to next state */
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.future.length === 0) return prev
      const next = prev.future[0]
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: prev.future.slice(1),
      }
    })
  }, [])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  return {
    genes: state.present,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
