import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../app/providers/AuthProvider'
import { ApiError } from '../../services/resources/authApi'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/farms': 'My Farms',
  '/dashboard/crops': 'Crop Library',
  '/dashboard/production': 'Production',
  '/dashboard/markets': 'Market Prices',
  '/dashboard/decisions': 'Decisions & Reports',
  '/dashboard/settings': 'Settings',
}

type AppHeaderProps = {
  mobileSidebarOpen: boolean
  onMenuToggle: () => void
  onSidebarToggle: () => void
  sidebarCollapsed: boolean
}

export function AppHeader({
  mobileSidebarOpen,
  onMenuToggle,
  onSidebarToggle,
  sidebarCollapsed,
}: AppHeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const pageTitle = pageTitles[pathname] ?? 'AgriNuru'
  const profileName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || user?.username
    || 'Farmer account'

  useEffect(() => {
    function closeProfileMenu(event: MouseEvent) {
      if (
        profileMenuRef.current
        && !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false)
      }
    }

    function closeProfileMenuWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeProfileMenu)
    document.addEventListener('keydown', closeProfileMenuWithEscape)
    return () => {
      document.removeEventListener('mousedown', closeProfileMenu)
      document.removeEventListener('keydown', closeProfileMenuWithEscape)
    }
  }, [])

  async function handleSignOut() {
    if (isSigningOut) {
      return
    }

    setLogoutError('')
    setIsSigningOut(true)
    try {
      await logout()
      setProfileMenuOpen(false)
      navigate('/login', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setLogoutError(
          'Unable to reach AgriNuru. Check your connection and try again.',
        )
      } else {
        setLogoutError('Sign out could not be completed. Please try again.')
      }
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="app-header">
      <div className="app-header-leading">
        <button
          aria-label="Open navigation menu"
          aria-expanded={mobileSidebarOpen}
          className="app-header-icon-button app-mobile-menu-button"
          onClick={onMenuToggle}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-list" />
        </button>
        <button
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          aria-controls="app-navigation-sidebar"
          className="app-header-icon-button app-desktop-menu-button"
          onClick={onSidebarToggle}
          type="button"
        >
          <i
            aria-hidden="true"
            className={`bi ${sidebarCollapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`}
          />
        </button>
        <div className="app-header-title-group">
          <span className="app-header-eyebrow">Farmer workspace</span>
          <h1 className="app-header-title">{pageTitle}</h1>
        </div>
      </div>

      <div className="app-header-actions">
        <button
          aria-label="Notifications (placeholder)"
          className="app-header-icon-button app-notification-button"
          title="Notifications"
          type="button"
        >
          <i aria-hidden="true" className="bi bi-bell" />
          <span aria-hidden="true" className="app-notification-dot" />
        </button>
        <div className="app-profile-menu" ref={profileMenuRef}>
          <button
            aria-controls="app-profile-menu"
            aria-expanded={profileMenuOpen}
            aria-label="Open farmer profile menu"
            className="app-profile-button"
            onClick={() => {
              setProfileMenuOpen((open) => !open)
              setLogoutError('')
            }}
            type="button"
          >
            <span aria-hidden="true" className="app-profile-avatar">
              <i className="bi bi-person" />
            </span>
            <span className="app-profile-copy">
              <span className="app-profile-name">{profileName}</span>
              <span className="app-profile-caption">Farmer account</span>
            </span>
            <i aria-hidden="true" className="bi bi-chevron-down app-profile-caret" />
          </button>
          {profileMenuOpen && (
            <div
              aria-label="Farmer profile actions"
              className="app-profile-dropdown"
              id="app-profile-menu"
            >
              <div className="app-profile-dropdown-summary">
                <span className="app-profile-dropdown-name">{profileName}</span>
                {user?.email && (
                  <span className="app-profile-dropdown-email">{user.email}</span>
                )}
              </div>
              {logoutError && (
                <p className="app-profile-logout-error" role="alert">
                  {logoutError}
                </p>
              )}
              <button
                className="app-profile-signout"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                <i
                  aria-hidden="true"
                  className={`bi ${isSigningOut ? 'bi-arrow-repeat' : 'bi-box-arrow-right'}`}
                />
                <span>{isSigningOut ? 'Signing out...' : 'Sign out'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
