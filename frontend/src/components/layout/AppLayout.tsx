import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'
import './app-layout.css'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      {mobileSidebarOpen && (
        <button
          aria-label="Close navigation menu"
          className="app-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          type="button"
        />
      )}

      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onNavigate={() => setMobileSidebarOpen(false)}
      />

      <div className="app-main">
        <AppHeader
          onMenuToggle={() => setMobileSidebarOpen((open) => !open)}
          onSidebarToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
          mobileSidebarOpen={mobileSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
        />
        <div className="app-page">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
