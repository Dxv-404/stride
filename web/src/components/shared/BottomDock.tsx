/**
 * BottomDock — reusable bottom bar for simulation pages.
 *
 * Sits at the bottom of the page's main area. Flat styling,
 * sharp corners, 48px height, border-top separator.
 *
 * Each page renders its own BottomDock with page-specific controls
 * passed as children.
 */

interface BottomDockProps {
  children: React.ReactNode
  className?: string
}

export default function BottomDock({ children, className = '' }: BottomDockProps) {
  return (
    <div
      className={`
        h-12 flex-shrink-0 flex items-center px-4 gap-3
        bg-bg-surface border-t border-border
        ${className}
      `}
    >
      {children}
    </div>
  )
}
