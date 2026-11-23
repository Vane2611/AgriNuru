import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { SectionPlaceholder } from '../components/layout/SectionPlaceholder'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { FarmsPage } from '../features/farms/FarmsPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { GuestRoute, ProtectedRoute } from './providers/RouteGuards'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <RegisterPage />
      </GuestRoute>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'farms',
        element: <FarmsPage />,
      },
      {
        path: 'crops',
        element: (
          <SectionPlaceholder
            title="Crop Library"
            description="Crop and variety information will be available here."
          />
        ),
      },
      {
        path: 'production',
        element: (
          <SectionPlaceholder
            title="Production"
            description="Growing seasons and production records will be available here."
          />
        ),
      },
      {
        path: 'markets',
        element: (
          <SectionPlaceholder
            title="Market Prices"
            description="Recorded market information will be available here."
          />
        ),
      },
      {
        path: 'decisions',
        element: (
          <SectionPlaceholder
            title="Decisions & Reports"
            description="Decision records and reports will be available here."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <SectionPlaceholder
            title="Settings"
            description="Farmer preferences will be available here."
          />
        ),
      },
    ],
  },
])
