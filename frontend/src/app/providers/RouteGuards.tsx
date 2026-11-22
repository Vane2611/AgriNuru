import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { useAuth } from './AuthProvider'

type RouteGuardProps = {
  children?: ReactNode
}

function AuthLoadingState() {
  return (
    <main
      aria-live="polite"
      className="route-loading-state"
      role="status"
    >
      <span aria-hidden="true" className="route-loading-mark">
        <i className="bi bi-leaf-fill" />
      </span>
      <span className="route-loading-copy">Checking your session...</span>
    </main>
  )
}

export function ProtectedRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingState />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname + location.search }}
        to="/login"
      />
    )
  }

  return children ? <>{children}</> : <Outlet />
}

export function GuestRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoadingState />
  }

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />
  }

  return children ? <>{children}</> : <Outlet />
}
