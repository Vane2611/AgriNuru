import { NavLink } from 'react-router-dom'

const navigationItems = [
  { label: 'Overview', path: '/dashboard', icon: 'bi-grid-1x2' },
  { label: 'My Farms', path: '/dashboard/farms', icon: 'bi-geo-alt' },
  { label: 'Crop Library', path: '/dashboard/crops', icon: 'bi-flower1' },
  { label: 'Production', path: '/dashboard/production', icon: 'bi-box-seam' },
  { label: 'Market Prices', path: '/dashboard/markets', icon: 'bi-graph-up-arrow' },
  {
    label: 'Decisions & Reports',
    path: '/dashboard/decisions',
    icon: 'bi-journal-text',
  },
]

type AppSidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onNavigate: () => void
}

export function AppSidebar({
  collapsed,
  mobileOpen,
  onNavigate,
}: AppSidebarProps) {
  return (
    <aside
      aria-label="Main navigation"
      className={[
        'app-sidebar',
        collapsed ? 'app-sidebar--collapsed' : '',
        mobileOpen ? 'app-sidebar--mobile-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      id="app-navigation-sidebar"
    >
      <NavLink
        aria-label="Grinab overview"
        className="app-brand"
        onClick={onNavigate}
        to="/dashboard"
      >
        <span aria-hidden="true" className="app-brand-mark">
          <i className="bi bi-leaf-fill" />
        </span>
        <span className="app-brand-name">Grinab</span>
      </NavLink>

      <div className="app-sidebar-section-label">Workspace</div>
      <nav className="app-navigation">
        {navigationItems.map((item) => (
          <NavLink
            aria-label={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `app-nav-link${isActive ? ' is-active' : ''}`
            }
            end={item.path === '/dashboard'}
            key={item.path}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            to={item.path}
          >
            <i aria-hidden="true" className={`bi ${item.icon}`} />
            <span className="app-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="app-sidebar-bottom">
        <NavLink
          aria-label={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            `app-nav-link${isActive ? ' is-active' : ''}`
          }
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          to="/dashboard/settings"
        >
          <i aria-hidden="true" className="bi bi-gear" />
          <span className="app-nav-label">Settings</span>
        </NavLink>
        <div className="app-sidebar-note">
          <span className="app-sidebar-note-icon">
            <i aria-hidden="true" className="bi bi-info-circle" />
          </span>
          <span className="app-nav-label">
            Your farm information stays under your control.
          </span>
        </div>
      </div>
    </aside>
  )
}
