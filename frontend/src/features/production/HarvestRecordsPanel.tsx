import { useEffect, useRef, useState } from 'react'

import {
  listHarvestRecords,
  type HarvestRecord,
} from '../../services/resources/harvestRecordsApi'
import type { GrowingSeason } from '../../services/resources/growingSeasonsApi'
import { HarvestRecordFormModal } from './HarvestRecordFormModal'
import { HarvestRecordDeleteModal } from './HarvestRecordDeleteModal'
import type { HarvestModalState } from './types'

type HarvestRecordsPanelProps = {
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

export function HarvestRecordsPanel({ season }: HarvestRecordsPanelProps) {
  const [records, setRecords] = useState<HarvestRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [modalState, setModalState] = useState<HarvestModalState>({ type: 'none' })

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
      const data = await listHarvestRecords({ growing_season_id: seasonId })
      if (isMountedRef.current) {
        const sorted = [...data].sort(
          (a, b) =>
            new Date(b.harvested_on).getTime() - new Date(a.harvested_on).getTime(),
        )
        setRecords(sorted)
        setLoading(false)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setFetchError(
          err instanceof Error ? err.message : 'Unable to load harvest records.',
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

  function handleSuccess(_record: HarvestRecord, verb: string) {
    void fetchRecords.current(season.id)
    setSuccessMessage(`Harvest record ${verb} successfully.`)
  }

  function handleDeleted(_id: number) {
    void fetchRecords.current(season.id)
    setSuccessMessage('Harvest record deleted successfully.')
  }

  return (
    <section aria-labelledby="harvest-records-panel-title" className="fields-panel">
      <div className="fields-panel-header">
        <div className="fields-panel-title-group">
          <h3 id="harvest-records-panel-title">Actual Harvest Records</h3>
          <p className="fields-panel-subtitle">
            These are confirmed harvest quantities actually recorded in the field.
          </p>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => setModalState({ type: 'createRecord' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Record Harvest
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
            <strong>Unable to load harvest records:</strong> {fetchError}
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
            <i aria-hidden="true" className="bi bi-basket" />
          </div>
          <h3>No harvest records yet</h3>
          <p>
            Record actual harvest quantities from the field. These are confirmed
            figures, not projections or estimates.
          </p>
          <button
            className="farms-btn-primary"
            onClick={() => setModalState({ type: 'createRecord' })}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Record Harvest
          </button>
        </div>
      )}

      {!loading && !fetchError && records.length > 0 && (
        <div className="fields-table-wrapper">
          <table className="fields-table">
            <thead>
              <tr>
                <th>Harvested On</th>
                <th>Quantity</th>
                <th>Quality Grade</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.harvested_on)}</td>
                  <td>
                    {formatQuantity(record.quantity)} {record.quantity_unit}
                  </td>
                  <td style={{ color: record.quality_grade ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                    {record.quality_grade || '—'}
                  </td>
                  <td style={{ color: record.notes ? 'var(--app-ink)' : 'var(--app-muted)' }}>
                    {record.notes ? truncate(record.notes, 80) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        aria-label={`Edit harvest record from ${formatDate(record.harvested_on)}`}
                        className="farm-card-btn"
                        onClick={() =>
                          setModalState({ type: 'editRecord', record })
                        }
                        title="Edit harvest record"
                        type="button"
                      >
                        <i aria-hidden="true" className="bi bi-pencil" />
                      </button>
                      <button
                        aria-label={`Delete harvest record from ${formatDate(record.harvested_on)}`}
                        className="farm-card-btn farm-card-btn--danger"
                        onClick={() =>
                          setModalState({ type: 'deleteRecord', record })
                        }
                        title="Delete harvest record"
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

      <HarvestRecordFormModal
        growingSeasonId={season.id}
        initialRecord={
          modalState.type === 'editRecord' ? modalState.record : null
        }
        isOpen={
          modalState.type === 'createRecord' || modalState.type === 'editRecord'
        }
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={(record) =>
          handleSuccess(
            record,
            modalState.type === 'editRecord' ? 'updated' : 'added',
          )
        }
        plantingDate={season.planting_date}
      />

      <HarvestRecordDeleteModal
        isOpen={modalState.type === 'deleteRecord'}
        onClose={() => setModalState({ type: 'none' })}
        onSuccess={handleDeleted}
        record={
          modalState.type === 'deleteRecord' ? modalState.record : null
        }
      />
    </section>
  )
}
