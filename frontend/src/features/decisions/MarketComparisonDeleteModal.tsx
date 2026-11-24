import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteMarketComparison,
  type MarketComparison,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  comparison: MarketComparison | null
  marketName: string
  cropName: string
  onClose: () => void
  onSuccess: (id: number) => void
}

export function MarketComparisonDeleteModal({
  isOpen,
  comparison,
  marketName,
  cropName,
  onClose,
  onSuccess,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setGeneralError(null)
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

  if (!isOpen || !comparison) return null

  async function handleDelete() {
    if (isDeleting || !comparison) return
    setIsDeleting(true)
    setGeneralError(null)
    try {
      await deleteMarketComparison(comparison.id)
      onSuccess(comparison.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setGeneralError(
            'This market comparison cannot be deleted because it is referenced by other records.',
          )
        } else {
          setGeneralError(err.detail ?? err.message ?? 'Unable to delete the market comparison.')
        }
      } else {
        setGeneralError('A network error occurred while deleting.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => { if (!isDeleting) onClose() }}
      />
      <div
        aria-labelledby="delete-comparison-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-comparison-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Market Comparison
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
            {generalError && (
              <div className="farms-alert" role="alert">
                <i aria-hidden="true" className="bi bi-exclamation-circle-fill" />
                <div className="farms-alert-content">{generalError}</div>
              </div>
            )}

            <p style={{ margin: 0, color: 'var(--app-ink)', fontSize: '13.5px' }}>
              Are you sure you want to delete this market comparison?
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
              <div><strong>Report:</strong> #{comparison.decision_report}</div>
              <div><strong>Market:</strong> {marketName}</div>
              <div><strong>Crop:</strong> {cropName}</div>
              <div><strong>Quantity:</strong> {comparison.quantity}</div>
              <div>
                <strong>Comparison Date:</strong>{' '}
                {comparison.comparison_date.slice(0, 10)}
              </div>
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
                'Delete Comparison'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
