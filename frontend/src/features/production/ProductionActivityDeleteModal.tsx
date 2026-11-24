import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteProductionActivity,
  type ActivityType,
  type ProductionActivity,
} from '../../services/resources/productionActivitiesApi'

type ProductionActivityDeleteModalProps = {
  isOpen: boolean
  activity: ProductionActivity | null
  onClose: () => void
  onSuccess: (deletedId: number) => void
}

const activityTypeLabels: Record<ActivityType, string> = {
  land_preparation: 'Land Preparation',
  planting: 'Planting',
  irrigation: 'Irrigation',
  fertiliser_application: 'Fertiliser Application',
  pest_control: 'Pest Control',
  weeding: 'Weeding',
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

export function ProductionActivityDeleteModal({
  isOpen,
  activity,
  onClose,
  onSuccess,
}: ProductionActivityDeleteModalProps) {
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

  if (!isOpen || !activity) {
    return null
  }

  async function handleDelete() {
    if (isDeleting || !activity) return

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteProductionActivity(activity.id)
      onSuccess(activity.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setDeleteError(
            err.detail ||
              'This activity cannot be deleted because it is referenced by other records.',
          )
        } else {
          setDeleteError(err.detail || err.message || 'Unable to delete the activity.')
        }
      } else {
        setDeleteError('A network error occurred while deleting the activity.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const truncatedNotes =
    activity.notes.length > 120
      ? activity.notes.slice(0, 117) + '...'
      : activity.notes

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
        aria-labelledby="delete-activity-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-activity-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Activity
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
              Are you sure you want to delete this production activity?
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
                <strong>Type:</strong>{' '}
                {activityTypeLabels[activity.activity_type] ?? activity.activity_type}
              </div>
              <div>
                <strong>Date:</strong> {formatDate(activity.activity_date)}
              </div>
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
                'Delete Activity'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
