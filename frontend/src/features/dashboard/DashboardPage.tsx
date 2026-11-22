import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useAuth } from '../../app/providers/AuthProvider'
import { listDecisionReports } from '../../services/resources/decisionReportsApi'
import { listFarms, type Farm } from '../../services/resources/farmsApi'
import {
  listGrowingSeasons,
  type GrowingSeason,
} from '../../services/resources/growingSeasonsApi'
import {
  listProductionCosts,
  type ProductionCost,
} from '../../services/resources/productionCostsApi'

type DashboardData = {
  farms: Farm[]
  growingSeasons: GrowingSeason[]
  productionCosts: ProductionCost[]
  decisionReportsCount: number
}

type LoadState =
  | { status: 'loading'; data: DashboardData | null }
  | { status: 'success'; data: DashboardData }
  | { status: 'error'; data: null }

function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function actualCostsByCurrency(costs: ProductionCost[]): Array<{
  currency: string
  amount: number
}> {
  const totals = new Map<string, number>()

  for (const cost of costs) {
    if (cost.cost_basis !== 'actual') {
      continue
    }

    const amount = Number(cost.amount)
    if (!Number.isFinite(amount)) {
      continue
    }
    totals.set(cost.currency, (totals.get(cost.currency) ?? 0) + amount)
  }

  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function DashboardPage() {
  const { user } = useAuth()
  const isMountedRef = useRef(true)
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    data: null,
  })

  const loadDashboard = useCallback(async () => {
    setLoadState({ status: 'loading', data: null })

    const results = await Promise.allSettled([
      listFarms(),
      listGrowingSeasons(),
      listProductionCosts(),
      listDecisionReports(),
    ])

    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    if (failed) {
      throw failed.reason
    }

    return {
      farms: results[0].status === 'fulfilled' ? results[0].value : [],
      growingSeasons:
        results[1].status === 'fulfilled' ? results[1].value : [],
      productionCosts:
        results[2].status === 'fulfilled' ? results[2].value : [],
      decisionReportsCount:
        results[3].status === 'fulfilled' ? results[3].value.length : 0,
    }
  }, [])

  useEffect(() => {
    let active = true
    isMountedRef.current = true

    void loadDashboard()
      .then((data) => {
        if (active) {
          setLoadState({ status: 'success', data })
        }
      })
      .catch(() => {
        if (active) {
          setLoadState({ status: 'error', data: null })
        }
      })

    return () => {
      active = false
      isMountedRef.current = false
    }
  }, [loadDashboard])

  function retry() {
    void loadDashboard()
      .then((data) => {
        if (isMountedRef.current) {
          setLoadState({ status: 'success', data })
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setLoadState({ status: 'error', data: null })
        }
      })
  }

  if (loadState.status === 'loading') {
    return (
      <section aria-busy="true" aria-live="polite" className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">Farmer workspace</p>
            <h2 className="dashboard-title">Your farm overview</h2>
          </div>
        </div>
        <div className="dashboard-loading-grid">
          {[0, 1, 2, 3].map((item) => (
            <div aria-hidden="true" className="dashboard-skeleton" key={item} />
          ))}
        </div>
      </section>
    )
  }

  if (loadState.status === 'error') {
    return (
      <section className="dashboard-page">
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>We could not load your farm overview</h2>
            <p>
              Check your connection and try again. No dashboard records are
              being displayed until the information can be retrieved.
            </p>
          </div>
          <button className="dashboard-secondary-button" onClick={retry} type="button">
            <i aria-hidden="true" className="bi bi-arrow-clockwise" />
            Retry
          </button>
        </div>
      </section>
    )
  }

  const { farms, growingSeasons, productionCosts, decisionReportsCount } =
    loadState.data
  const activeGrowingSeasons =
    growingSeasons.filter((season) => season.status === 'in_progress').length
  const actualCostTotals = actualCostsByCurrency(productionCosts)
  const profileName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
    || user?.username

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">Farmer workspace</p>
          <h2 className="dashboard-title">
            {profileName ? `Welcome, ${profileName}` : 'Your farm overview'}
          </h2>
        </div>
      </div>

      <div className="dashboard-summary-grid">
        <article className="dashboard-summary-card">
          <span aria-hidden="true" className="dashboard-card-icon dashboard-card-icon--green">
            <i className="bi bi-geo-alt" />
          </span>
          <div>
            <p className="dashboard-card-label">My Farms</p>
            <strong className="dashboard-card-value">{farms.length}</strong>
            <p className="dashboard-card-caption">
              {farms.length === 0
                ? 'No farms recorded'
                : farms.length === 1
                  ? '1 farm recorded'
                  : `${farms.length} farms recorded`}
            </p>
          </div>
        </article>

        <article className="dashboard-summary-card">
          <span aria-hidden="true" className="dashboard-card-icon dashboard-card-icon--amber">
            <i className="bi bi-box-seam" />
          </span>
          <div>
            <p className="dashboard-card-label">Active Growing Seasons</p>
            <strong className="dashboard-card-value">
              {activeGrowingSeasons}
            </strong>
            <p className="dashboard-card-caption">
              {activeGrowingSeasons === 0
                ? 'No seasons in progress'
                : `${activeGrowingSeasons} in progress`}
            </p>
          </div>
        </article>

        <article className="dashboard-summary-card">
          <span aria-hidden="true" className="dashboard-card-icon dashboard-card-icon--blue">
            <i className="bi bi-cash-stack" />
          </span>
          <div>
            <p className="dashboard-card-label">Actual Production Costs</p>
            {actualCostTotals.length > 0 ? (
              actualCostTotals.map((total) => (
                <strong className="dashboard-card-value dashboard-card-value--currency" key={total.currency}>
                  {total.currency} {formatAmount(total.amount)}
                </strong>
              ))
            ) : (
              <strong className="dashboard-card-value dashboard-card-value--empty">
                0
              </strong>
            )}
            <p className="dashboard-card-caption">
              {actualCostTotals.length > 0
                ? 'Recorded actual costs'
                : 'No actual costs recorded'}
            </p>
          </div>
        </article>

        <article className="dashboard-summary-card">
          <span aria-hidden="true" className="dashboard-card-icon dashboard-card-icon--violet">
            <i className="bi bi-journal-text" />
          </span>
          <div>
            <p className="dashboard-card-label">Decision Reports</p>
            <strong className="dashboard-card-value">
              {decisionReportsCount}
            </strong>
            <p className="dashboard-card-caption">
              {decisionReportsCount === 0
                ? 'No reports recorded'
                : `${decisionReportsCount} report${decisionReportsCount === 1 ? '' : 's'} recorded`}
            </p>
          </div>
        </article>
      </div>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-eyebrow">Overview</p>
              <h3>Recent farm activity</h3>
            </div>
          </div>
          <div className="dashboard-empty-inline">
            <i aria-hidden="true" className="bi bi-clock-history" />
            <p>No recent activity is shown because an activity summary is not available yet.</p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-eyebrow">Shortcuts</p>
              <h3>Quick actions</h3>
            </div>
          </div>
          <div className="dashboard-actions">
            <NavLink className="dashboard-action" to="/dashboard/farms">
              <i aria-hidden="true" className="bi bi-plus-circle" />
              <span>View My Farms</span>
            </NavLink>
            <NavLink className="dashboard-action" to="/dashboard/production">
              <i aria-hidden="true" className="bi bi-box-seam" />
              <span>View Production</span>
            </NavLink>
            <NavLink className="dashboard-action" to="/dashboard/decisions">
              <i aria-hidden="true" className="bi bi-journal-text" />
              <span>View Decision Reports</span>
            </NavLink>
          </div>
        </section>
      </div>
    </section>
  )
}
