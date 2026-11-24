import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppLayout } from '../components/layout/AppLayout'
import { SectionPlaceholder } from '../components/layout/SectionPlaceholder'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { FarmsPage } from '../features/farms/FarmsPage'
import { CropsPage } from '../features/crops/CropsPage'
import { ProductionPage } from '../features/production/ProductionPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { MarketsPage } from '../features/markets/MarketsPage'
import { DecisionsPage } from '../features/decisions/DecisionsPage'
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
        element: <CropsPage />,
      },
      {
        path: 'production',
        element: <ProductionPage />,
      },
      {
        path: 'markets',
        element: <MarketsPage />,
      },
      {
        path: 'decisions',
        element: <DecisionsPage />,
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
