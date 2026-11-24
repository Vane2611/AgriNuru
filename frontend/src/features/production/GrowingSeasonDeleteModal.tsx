import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteGrowingSeason,
  type GrowingSeason,
} from '../../services/resources/growingSeasonsApi'

type GrowingSeasonDeleteModalProps = {
  isOpen: boolean
  season: GrowingSeason | null
  cropName: string
  fieldName: string
  farmName: string
  onClose: () => void
  onSuccess: (deletedId: number) => void
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

function formatStatus(status: string): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'abandoned':
      return 'Abandoned'
    default:
      return status
  }
}

export function GrowingSeasonDeleteModal({
  isOpen,
  season,
  cropName,
  fieldName,
  farmName,
  onClose,
  onSuccess,
}: GrowingSeasonDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  // Focus cancel button on open (safe default — prevents accidental delete on Enter)
  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus()
    }
  }, [isOpen])

  // Clear error when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setGeneralError(null)
      setIsDeleting(false)
    }
  }, [isOpen])

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onClose])

  if (!isOpen || !season) {
    return null
  }

  async function handleDelete() {
    if (isDeleting || !season) return

    setIsDeleting(true)
    setGeneralError(null)

    try {
      await deleteGrowingSeason(season.id)
      onSuccess(season.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setGeneralError(
            err.detail ||
              'This growing season cannot be deleted because it has associated activities, costs, harvest estimates or harvest records. Remove all child records first.',
          )
        } else {
          setGeneralError(err.detail || err.message || 'Unable to delete the growing season.')
        }
      } else {
        setGeneralError('A network error occurred while deleting the growing season.')
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
        onClick={() => {
          if (!isDeleting) onClose()
        }}
      />
      <div
        aria-labelledby="delete-season-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-season-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Growing Season
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
              Are you sure you want to delete this growing season?
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
                <strong>Crop:</strong> {cropName}
              </div>
              <div>
                <strong>Field:</strong> {fieldName}
              </div>
              <div>
                <strong>Farm:</strong> {farmName}
              </div>
              <div>
                <strong>Planting Date:</strong> {formatDate(season.planting_date)}
              </div>
              <div>
                <strong>Status:</strong> {formatStatus(season.status)}
              </div>
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
              <strong>Warning:</strong> This will permanently delete the growing season
              and all its associated activities, costs, harvest estimates and harvest records.
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
                'Delete Season'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
