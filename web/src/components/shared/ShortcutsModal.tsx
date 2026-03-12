import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '@/stores/uiStore'

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: '1-5', action: 'Speed: 1x / 2x / 5x / 10x / Max' },
  { key: 'C', action: 'Toggle Creature Inspector' },
  { key: 'D', action: 'Toggle Diversity Map' },
  { key: '?', action: 'Show Shortcuts' },
] as const

export default function ShortcutsModal() {
  const { shortcutsModalOpen, toggleShortcutsModal } = useUIStore()

  return (
    <AnimatePresence>
      {shortcutsModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={toggleShortcutsModal}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-bg-panel border border-border p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-xs uppercase tracking-wide text-text-secondary mb-4">
              KEYBOARD SHORTCUTS
            </h2>
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-text-primary bg-bg-surface border border-border px-2 py-0.5">
                    {s.key}
                  </span>
                  <span className="font-mono text-xs text-text-secondary">
                    {s.action}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="btn-flat w-full mt-6 text-center"
              onClick={toggleShortcutsModal}
            >
              CLOSE
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
