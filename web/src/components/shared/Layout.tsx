/**
 * Layout shell — wraps all pages except Landing.
 *
 * Structure:
 *   ┌──────────── Header ────────────┐
 *   │ Sidebar │       Main           │
 *   │         │    <Outlet />         │
 *   │         │                       │
 *   └─────────┴───────────────────────┘
 *
 * The sidebar collapses from 200px → 56px.
 * Pages fill the main area completely (no padding from Layout).
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import GuidedTour, { useTourCompleted } from './GuidedTour'

export default function Layout() {
  const tourDone = useTourCompleted()
  const [showTour, setShowTour] = useState(!tourDone)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
    </div>
  )
}
