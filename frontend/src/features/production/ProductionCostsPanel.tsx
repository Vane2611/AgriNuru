import { useEffect, useRef, useState } from 'react'

import {
  listProductionCosts,
  type ProductionCost,
} from '../../services/resources/productionCostsApi'
import type { GrowingSeason } from '../../services/resources/growingSeasonsApi'
import {
  costCategoryLabel,
  costBasisLabel,
} from './ProductionCostFormModal'
import { ProductionCostFormModal } from './ProductionCostFormModal'
import { ProductionCostDeleteModal } from './ProductionCostDeleteModal'
import type { CostModalState } from './types'

type ProductionCostsPanelProps = {
  season: GrowingSeason
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

function formatAmount(amount: string): string {
  const num = parseFloat(amount)
  if (Number.isNaN(num)) return amount
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type CurrencyTotals = Record<string, { actual: number; estimated: number }>

function computeTotals(costs: ProductionCost[]): CurrencyTotals {
  const totals: CurrencyTotals = {}
  for (const cost of costs) {
    const currency = cost.currency
    const amount = parseFloat(cost.amount)
    if (Number.isNaN(amount)) continue
    if (!totals[currency]) {
      totals[currency] = { actual: 0, estimated: 0 }
    }
    if (cost.cost_basis === 'actual') {
      totals[currency].actual += amount
    } else {
      totals[currency].estimated += amount
    }
  }
  return totals
}

export function ProductionCostsPanel({ season }: ProductionCostsPanelProps) {
  const [records, setRecords] = useState<ProductionCost[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [modalState, setModalState] = useState<CostModalState>({ type: 'none' })

  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  const seasonIdRef = useRef(season.id)

  const fetchRecords = useRef(async (seasonId: number) => {
    if (isMountedRef.current) {
      setLoading(true)
      setFetchError(null)
    }
    try {
      const all = await listProductionCosts()
      if (isMountedRef.current) {
        const filtered = all.filter((c) => c.growing_season === seasonId)
        const sorted = [...filtered].sort((a, b) => {
          if (!a.cost_date && !b.cost_date) return 0
          if (!a.cost_date) return 1
          if (!b.cost_date) return -1
          return new Date(b.cost_date).getTime() - new Date(a.cost_date).getTime()
        })
        setRecords(sorted)
        setLoading(false)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setFetchError(
          err instanceof Error ? err.message : 'Unable to load cost records.',
        )
        setLoading(false)
      }
    }
  })

  useEffect(() => {
    seasonIdRef.current = season.id
    setRecords([])
    setFetchError(null)
    void fetchRecords.current(season.id)
  }, [season.id])

  function handleSuccess(_cost: ProductionCost, verb: string) {
    void fetchRecords.current(seasonIdRef.current)
    setSuccessMessage(`Cost record ${verb} successfully.`)
  }

  function handleDeleted(_id: number) {
    void fetchRecords.current(seasonIdRef.current)
    setSuccessMessage('Cost record deleted successfully.')
  }

  const totals = computeTotals(records)
  const currencyKeys = Object.keys(totals).sort()

  return (
    <section aria-labelledby="costs-panel-title" className="fields-panel">
      <div className="fields-panel-header">
        <div className="fields-panel-title-group">
          <h3 id="costs-panel-title">Production Costs</h3>
          <p className="fields-panel-subtitle">
            Actual expenditure and estimated costs for this growing season.
          </p>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => setModalState({ type: 'createCost' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add Cost
        </button>
      </div>

      {successMessage && (
        <div className="farms-alert farms-alert-success" role="status">
          <i aria-hidden="true" className="bi bi-check-circle-fill" />
          <div className="farms-alert-content">{successMessage}</div>
          <button
            aria-label="Dismiss message"
            className="farms-alert-dismiss"
            onClick={() => setSuccessMessage(null)}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {loading && records.length === 0 && (
        <div aria-busy="true" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div
              className="dashboard-skeleton"
              key={i}
              style={{ height: '44px', borderRadius: '8px', marginBottom: '8px' }}
            />
          ))}
        </div>
      )}

      {fetchError && !loading && (
        <div className="farms-alert" role="alert">
          <i aria-hidden="true" className="bi bi-exclamation-circle-fill" />
          <div className="farms-alert-content">
            <strong>Unable to load cost records:</strong> {fetchError}
            <div style={{ marginTop: '8px' }}>
              <button
                className="farms-btn-secondary"
                onClick={() => void fetchRecords.current(seasonIdRef.current)}
                style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
                type="button"
              >
                <i aria-hidden="true" className="bi bi-arrow-clockwise" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !fetchError && records.length === 0 && (
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-cash-coin" />
          </div>
          <h3>No costs recorded yet</h3>
          <p>
            Record actual expenditure or cost estimates for seeds, labour, fertiliser
            and other inputs for this growing season.
          </p>
          <button
            className="farms-btn-primary"
            onClick={() => setModalState({ type: 'createCost' })}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Add Cost
          </button>
        </div>
      )}

      {!loading && !fetchError && records.length > 0 && (
        <>
          <div className="fields-table-wrapper">
            <table className="fields-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Basis</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Notes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((cost) => (
                  <tr key={cost.id}>
                    <td>{costCategoryLabel(cost.category)}</td>
                    <td>
                      {cost.cost_basis === 'estimated' ? (
                        <em style={{ color: 'var(--app-muted)' }}>
                          {costBasisLabel(cost.cost_basis)}
                        </em>
                      ) : (
                        costBasisLabel(cost.cost_basis)
                      )}
                    </td>
                    <td>
                      {formatAmount(cost.amount)} {cost.currency}
                    </td>
                    <td style={{ color: cost.cost_date ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                      {cost.cost_date ? formatDate(cost.cost_date) : '—'}
                    </td>
                    <td style={{ color: cost.notes ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                      {cost.notes ? truncate(cost.notes, 80) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          aria-label={`Edit ${costCategoryLabel(cost.category)} cost`}
                          className="farm-card-btn"
                          onClick={() => setModalState({ type: 'editCost', cost })}
                          title="Edit cost"
                          type="button"
                        >
                          <i aria-hidden="true" className="bi bi-pencil" />
                        </button>
                        <button
                          aria-label={`Delete ${costCategoryLabel(cost.category)} cost`}
                          className="farm-card-btn farm-card-btn--danger"
                          onClick={() => setModalState({ type: 'deleteCost', cost })}
                          title="Delete cost"
                          type="button"
                        >
                          <i aria-hidden="true" className="bi bi-trash3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currencyKeys.length > 0 && (
            <div
              style={{
                padding: '14px 16px',
                background: '#f8faf7',
                border: '1px solid var(--app-border)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--app-ink)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <strong style={{ color: 'var(--app-forest)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cost Totals
              </strong>
              {currencyKeys.map((currency) => {
                const { actual, estimated } = totals[currency]
                return (
                  <div key={currency} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 650, minWidth: '44px' }}>{currency}:</span>
                    <span>
                      Actual{' '}
                      <strong>
                        {actual.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </span>
                    {estimated > 0 && (
                      <span style={{ color: 'var(--app-muted)' }}>
                        <em>
                          Estimated{' '}
                          {estimated.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </em>
                        {' '}
                        <span style={{ fontSize: '11px' }}>(projected, not spent)</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <ProductionCostFormModal
        growingSeasonId={season.id}
        initialCost={modalState.type === 'editCost' ? modalState.cost : null}
        isOpen={modalState.type === 'createCost' || modalState.type === 'editCost'}
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={(cost) =>
          handleSuccess(cost, modalState.type === 'editCost' ? 'updated' : 'added')
        }
      />

      <ProductionCostDeleteModal
        cost={modalState.type === 'deleteCost' ? modalState.cost : null}
        isOpen={modalState.type === 'deleteCost'}
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={handleDeleted}
      />
    </section>
  )
}
