import { useEffect, useRef, useState } from 'react'

import {
  listHarvestEstimates,
  type HarvestEstimate,
} from '../../services/resources/harvestEstimatesApi'
import type { GrowingSeason } from '../../services/resources/growingSeasonsApi'
import { estimateSourceLabel } from './HarvestEstimateFormModal'
import { HarvestEstimateFormModal } from './HarvestEstimateFormModal'
import { HarvestEstimateDeleteModal } from './HarvestEstimateDeleteModal'
import type { EstimateModalState } from './types'

type HarvestEstimatesPanelProps = {
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

function formatQuantity(qty: string): string {
  const num = parseFloat(qty)
  if (Number.isNaN(num)) return qty
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function HarvestEstimatesPanel({ season }: HarvestEstimatesPanelProps) {
  const [records, setRecords] = useState<HarvestEstimate[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [modalState, setModalState] = useState<EstimateModalState>({ type: 'none' })

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

  const fetchRecords = useRef(async (seasonId: number) => {
    if (isMountedRef.current) {
      setLoading(true)
      setFetchError(null)
    }
    try {
      const data = await listHarvestEstimates({ growing_season_id: seasonId })
      if (isMountedRef.current) {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.estimated_on).getTime() - new Date(a.estimated_on).getTime(),
        )
        setRecords(sorted)
        setLoading(false)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setFetchError(
          err instanceof Error ? err.message : 'Unable to load harvest estimates.',
        )
        setLoading(false)
      }
    }
  })

  useEffect(() => {
    setRecords([])
    setFetchError(null)
    void fetchRecords.current(season.id)
  }, [season.id])

  function handleSuccess(_estimate: HarvestEstimate, verb: string) {
    void fetchRecords.current(season.id)
    setSuccessMessage(`Harvest estimate ${verb} successfully.`)
  }

  function handleDeleted(_id: number) {
    void fetchRecords.current(season.id)
    setSuccessMessage('Harvest estimate deleted successfully.')
  }

  return (
    <section aria-labelledby="estimates-panel-title" className="fields-panel">
      <div className="fields-panel-header">
        <div className="fields-panel-title-group">
          <h3 id="estimates-panel-title">Harvest Estimates</h3>
          <p className="fields-panel-subtitle">
            These are projected harvest figures, not actual recorded harvests.
          </p>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => setModalState({ type: 'createEstimate' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add Estimate
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
            <strong>Unable to load harvest estimates:</strong> {fetchError}
            <div style={{ marginTop: '8px' }}>
              <button
                className="farms-btn-secondary"
                onClick={() => void fetchRecords.current(season.id)}
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
            <i aria-hidden="true" className="bi bi-bar-chart-line" />
          </div>
          <h3>No harvest estimates yet</h3>
          <p>
            Add a projected harvest figure for this growing season. Estimates help
            with planning but are not actual harvest records.
          </p>
          <button
            className="farms-btn-primary"
            onClick={() => setModalState({ type: 'createEstimate' })}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Add Estimate
          </button>
        </div>
      )}

      {!loading && !fetchError && records.length > 0 && (
        <div className="fields-table-wrapper">
          <table className="fields-table">
            <thead>
              <tr>
                <th>Estimated On</th>
                <th>Estimated Quantity</th>
                <th>Source</th>
                <th>Source Reference</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((estimate) => (
                <tr key={estimate.id}>
                  <td>{formatDate(estimate.estimated_on)}</td>
                  <td>
                    {formatQuantity(estimate.estimated_quantity)} {estimate.quantity_unit}
                  </td>
                  <td style={{ color: estimate.estimate_source ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                    {estimateSourceLabel(estimate.estimate_source)}
                  </td>
                  <td style={{ color: estimate.source_reference ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                    {estimate.source_reference
                      ? truncate(estimate.source_reference, 60)
                      : '—'}
                  </td>
                  <td style={{ color: estimate.notes ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                    {estimate.notes ? truncate(estimate.notes, 80) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        aria-label={`Edit estimate from ${formatDate(estimate.estimated_on)}`}
                        className="farm-card-btn"
                        onClick={() =>
                          setModalState({ type: 'editEstimate', estimate })
                        }
                        title="Edit estimate"
                        type="button"
                      >
                        <i aria-hidden="true" className="bi bi-pencil" />
                      </button>
                      <button
                        aria-label={`Delete estimate from ${formatDate(estimate.estimated_on)}`}
                        className="farm-card-btn farm-card-btn--danger"
                        onClick={() =>
                          setModalState({ type: 'deleteEstimate', estimate })
                        }
                        title="Delete estimate"
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
      )}

      <HarvestEstimateFormModal
        growingSeasonId={season.id}
        initialEstimate={
          modalState.type === 'editEstimate' ? modalState.estimate : null
        }
        isOpen={
          modalState.type === 'createEstimate' || modalState.type === 'editEstimate'
        }
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={(estimate) =>
          handleSuccess(
            estimate,
            modalState.type === 'editEstimate' ? 'updated' : 'added',
          )
        }
      />

      <HarvestEstimateDeleteModal
        estimate={
          modalState.type === 'deleteEstimate' ? modalState.estimate : null
        }
        isOpen={modalState.type === 'deleteEstimate'}
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={handleDeleted}
      />
    </section>
  )
}
