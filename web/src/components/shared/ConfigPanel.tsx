/**
 * ConfigPanel — collapsible right-side panel for parameters / settings.
 *
 * Slides from the right. When open, it PUSHES the main content area
 * via flex layout (not an overlay). This means PixiJS canvas ResizeObserver
 * picks up the width change automatically.
 *
 * Width: 320px. Smooth 200ms transition.
 */

interface ConfigPanelProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function ConfigPanel({ open, onClose, title = 'Settings', children }: ConfigPanelProps) {
  return (
    <aside
      className="h-full border-l border-border bg-bg-panel flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: open ? 320 : 0,
        minWidth: open ? 320 : 0,
        transition: 'width 200ms ease, min-width 200ms ease',
      }}
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
          {title}
        </span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          title="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {children}
      </div>
    </aside>
  )
}
