import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteHarvestEstimate,
  type EstimateSource,
  type HarvestEstimate,
} from '../../services/resources/harvestEstimatesApi'

type HarvestEstimateDeleteModalProps = {
  isOpen: boolean
  estimate: HarvestEstimate | null
  onClose: () => void
  onSuccess: (deletedId: number) => void
}

const estimateSourceLabels: Record<EstimateSource, string> = {
  farmer: 'Farmer Assessment',
  extension: 'Extension Officer',
  model: 'Predictive Model',
  other: 'Other',
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function HarvestEstimateDeleteModal({
  isOpen,
  estimate,
  onClose,
  onSuccess,
}: HarvestEstimateDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string>('')
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setDeleteError('')
      setIsDeleting(false)
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onClose])

  if (!isOpen || !estimate) {
    return null
  }

  async function handleDelete() {
    if (isDeleting || !estimate) return

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteHarvestEstimate(estimate.id)
      onSuccess(estimate.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setDeleteError(
            err.detail ||
              'This harvest estimate cannot be deleted because it is referenced by other records.',
          )
        } else {
          setDeleteError(err.detail || err.message || 'Unable to delete the harvest estimate.')
        }
      } else {
        setDeleteError('A network error occurred while deleting the harvest estimate.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const truncatedNotes =
    estimate.notes.length > 120
      ? estimate.notes.slice(0, 117) + '...'
      : estimate.notes

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => {
          if (!isDeleting) onClose()
        }}
      />
      <div
        aria-labelledby="delete-estimate-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-estimate-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Harvest Estimate
            </h4>
            <button
              aria-label="Close dialog"
              className="agri-modal-close"
              disabled={isDeleting}
              onClick={onClose}
              type="button"
            >
              <i aria-hidden="true" className="bi bi-x-lg" />
            </button>
          </div>

          <div className="agri-modal-body">
            {deleteError && (
              <div className="farms-alert" role="alert">
                <i aria-hidden="true" className="bi bi-exclamation-circle-fill" />
                <div className="farms-alert-content">{deleteError}</div>
              </div>
            )}

            <p style={{ margin: 0, color: 'var(--app-ink)', fontSize: '13.5px' }}>
              Are you sure you want to delete this harvest estimate? This is a
              projected figure, not an actual harvest record.
            </p>

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
                gap: '6px',
              }}
            >
              <div>
                <strong>Estimated On:</strong> {formatDate(estimate.estimated_on)}
              </div>
              <div>
                <strong>Quantity:</strong> {estimate.estimated_quantity} {estimate.quantity_unit}
              </div>
              {estimate.estimate_source && (
                <div>
                  <strong>Source:</strong>{' '}
                  {estimateSourceLabels[estimate.estimate_source] ?? estimate.estimate_source}
                </div>
              )}
              {estimate.source_reference && (
                <div>
                  <strong>Reference:</strong> {estimate.source_reference}
                </div>
              )}
              {truncatedNotes && (
                <div>
                  <strong>Notes:</strong> {truncatedNotes}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '12px 14px',
                background: '#fbf4f3',
                border: '1px solid #f2d9d6',
                borderRadius: '8px',
                color: '#842f26',
                fontSize: '12.5px',
              }}
            >
              <i aria-hidden="true" className="bi bi-info-circle me-1" />
              <strong>Warning:</strong> This action is permanent and cannot be undone.
            </div>
          </div>

          <div className="agri-modal-footer">
            <button
              className="farms-btn-secondary"
              disabled={isDeleting}
              onClick={onClose}
              ref={cancelButtonRef}
              type="button"
            >
              Cancel
            </button>
            <button
              className="farms-btn-danger"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              type="button"
            >
              {isDeleting ? (
                <>
                  <span
                    aria-hidden="true"
                    className="spinner-border spinner-border-sm"
                    role="status"
                  />
                  Deleting...
                </>
              ) : (
                'Delete Estimate'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
