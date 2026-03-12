import { useEffect } from 'react'
import { useSimulationStore } from '@/stores/simulationStore'
import { useUIStore } from '@/stores/uiStore'

export default function KeyboardShortcuts() {
  const { status, setStatus, speed, setSpeed } = useSimulationStore()
  const {
    toggleInspector,
    toggleDiversityMap,
    toggleShortcutsModal,
  } = useUIStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (status === 'running') setStatus('paused')
          else if (status === 'paused') setStatus('running')
          break
        case '1':
          setSpeed(1)
          break
        case '2':
          setSpeed(2)
          break
        case '3':
          setSpeed(5)
          break
        case '4':
          setSpeed(10)
          break
        case '5':
          setSpeed('max')
          break
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            // Don't conflict with browser refresh
          }
          break
        case 'c':
        case 'C':
          if (!e.ctrlKey && !e.metaKey) toggleInspector()
          break
        case 'd':
        case 'D':
          if (!e.ctrlKey && !e.metaKey) toggleDiversityMap()
          break
        case '?':
          toggleShortcutsModal()
          break
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            // Fullscreen toggle will be implemented with canvas ref
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, speed, setStatus, setSpeed, toggleInspector, toggleDiversityMap, toggleShortcutsModal])

  return null
}
