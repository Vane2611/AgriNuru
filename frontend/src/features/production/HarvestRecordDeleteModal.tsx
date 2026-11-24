import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteHarvestRecord,
  type HarvestRecord,
} from '../../services/resources/harvestRecordsApi'

type HarvestRecordDeleteModalProps = {
  isOpen: boolean
  record: HarvestRecord | null
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

export function HarvestRecordDeleteModal({
  isOpen,
  record,
  onClose,
  onSuccess,
}: HarvestRecordDeleteModalProps) {
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

  if (!isOpen || !record) {
    return null
  }

  async function handleDelete() {
    if (isDeleting || !record) return

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteHarvestRecord(record.id)
      onSuccess(record.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setDeleteError(
            err.detail ||
              'This harvest record cannot be deleted because it is referenced by other records.',
          )
        } else {
          setDeleteError(err.detail || err.message || 'Unable to delete the harvest record.')
        }
      } else {
        setDeleteError('A network error occurred while deleting the harvest record.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const truncatedNotes =
    record.notes.length > 120
      ? record.notes.slice(0, 117) + '...'
      : record.notes

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
        aria-labelledby="delete-harvest-record-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-harvest-record-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Harvest Record
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
              Are you sure you want to delete this actual harvest record? This is a
              confirmed harvest, not an estimate.
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
                <strong>Harvested On:</strong> {formatDate(record.harvested_on)}
              </div>
              <div>
                <strong>Quantity:</strong> {record.quantity} {record.quantity_unit}
              </div>
              {record.quality_grade && (
                <div>
                  <strong>Quality Grade:</strong> {record.quality_grade}
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
                'Delete Record'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
