/**
 * Sidebar — collapsible navigation sidebar.
 *
 * Expanded: 200px with icon + text labels
 * Collapsed: 56px with icon only
 *
 * Three navigation groups:
 *   SIMULATE: Lab, Race, Push Test
 *   EXPLORE:  Playground, Terrain
 *   DATA:     Results, Hall of Fame, About
 *
 * Active state: left border accent + elevated background
 * Smooth 200ms width transition
 *
 * Icons are 7×7 dot-matrix with Framer Motion animations:
 *   - Static: default state
 *   - Hover:  contextual micro-animation (0.3–2s)
 *   - Active: perpetual ambient animation (3–5s cycle)
 */

import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

// Dot-matrix icons
import FlaskIcon from '@/components/icons/FlaskIcon'
import CreaturesIcon from '@/components/icons/CreaturesIcon'
import PushIcon from '@/components/icons/PushIcon'
import WaveformIcon from '@/components/icons/WaveformIcon'
import MountainIcon from '@/components/icons/MountainIcon'
import BarChartIcon from '@/components/icons/BarChartIcon'
import CrownIcon from '@/components/icons/CrownIcon'
import BookIcon from '@/components/icons/BookIcon'

/* ─── Navigation data ─── */

interface NavItem {
  to: string
  label: string
  /** Dot-matrix icon component */
  Icon: React.ComponentType<{ size?: number; state?: 'static' | 'hover' | 'active' }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'SIMULATE',
    items: [
      { to: '/lab', label: 'Lab', Icon: FlaskIcon },
      { to: '/compare', label: 'Race', Icon: CreaturesIcon },
      { to: '/push-test', label: 'Push Test', Icon: PushIcon },
    ],
  },
  {
    label: 'EXPLORE',
    items: [
      { to: '/playground', label: 'Playground', Icon: WaveformIcon },
      { to: '/terrain', label: 'Terrain', Icon: MountainIcon },
    ],
  },
  {
    label: 'DATA',
    items: [
      { to: '/results', label: 'Results', Icon: BarChartIcon },
      { to: '/hall-of-fame', label: 'Hall of Fame', Icon: CrownIcon },
      { to: '/learn', label: 'About', Icon: BookIcon },
    ],
  },
]

/* ─── Nav Item Component ─── */

function SidebarNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const { Icon } = item

  // Determine icon animation state
  const iconState: 'static' | 'hover' | 'active' = isActive
    ? 'active'
    : hovered
      ? 'hover'
      : 'static'

  return (
    <Link
      to={item.to}
      className={`
        flex items-center gap-3.5 px-4 py-3 transition-colors relative
        ${isActive
          ? 'bg-bg-elevated text-text-primary'
          : 'text-text-muted hover:text-text-primary hover:bg-bg-surface'
        }
      `}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Active indicator — left border */}
      {isActive && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent" />
      )}

      {/* Dot-matrix icon */}
      <span className="flex-shrink-0 w-[22px] h-[22px] flex items-center justify-center">
        <Icon size={22} state={iconState} />
      </span>

      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span className="text-sm font-medium truncate whitespace-nowrap">
          {item.label}
        </span>
      )}
    </Link>
  )
}

/* ─── Sidebar Component ─── */

export default function Sidebar() {
  const location = useLocation()
  const collapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <aside
      className="h-full border-r border-border bg-bg flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 60 : 220,
        transition: 'width 200ms ease',
      }}
    >
      {/* Nav groups */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-8' : ''}>
            {/* Group label — hidden when collapsed */}
            {!collapsed && (
              <div className="px-4 py-1.5 mb-2 text-[11px] font-medium uppercase tracking-widest text-text-dim select-none">
                {group.label}
              </div>
            )}
            {collapsed && gi > 0 && (
              <div className="mx-3 mb-3 border-t border-border" />
            )}

            {/* Items */}
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.to}
                  item={item}
                  isActive={location.pathname === item.to}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
