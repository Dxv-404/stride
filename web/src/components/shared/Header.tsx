/**
 * Header bar — fixed 44px bar at the top of the application.
 *
 * Layout: [Sidebar toggle] — [Status text] — [S T R I D E wordmark] — [Theme toggle]
 *
 * The wordmark uses Inter 700 at 20px with 0.08em letter-spacing.
 * Status text reads from simulationStore to show current state.
 */

import { Link } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useSimulationStore } from '@/stores/simulationStore'
import ThemeToggle from './ThemeToggle'

function StatusIndicator() {
  const status = useSimulationStore((s) => s.status)
  const gen = useSimulationStore((s) => s.stats.generation)

  if (status === 'idle') return null

  const statusText =
    status === 'running' ? `Evolving · Gen ${gen}` :
    status === 'paused' ? `Paused · Gen ${gen}` :
    status === 'completed' ? `Complete · Gen ${gen}` : ''

  const dotColor =
    status === 'running' ? 'bg-success' :
    status === 'paused' ? 'bg-accent' :
    'bg-text-muted'

  return (
    <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
      <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ${status === 'running' ? 'animate-pulse' : ''}`} />
      <span>{statusText}</span>
    </div>
  )
}

export default function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <header className="h-11 border-b border-border bg-bg flex items-center px-4 flex-shrink-0 relative z-40">
      {/* Left: Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" />
          <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {/* Center-left: Status indicator */}
      <div className="ml-4">
        <StatusIndicator />
      </div>

      {/* Center: Wordmark */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <Link
          to="/"
          className="text-[20px] font-bold tracking-[0.08em] text-text-primary hover:text-accent transition-colors no-underline"
        >
          S T R I D E
        </Link>
      </div>

      {/* Right: Theme toggle */}
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  )
}
