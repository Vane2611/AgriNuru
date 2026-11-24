import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteDecisionReport,
  type DecisionReport,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  report: DecisionReport | null
  fieldName: string
  onClose: () => void
  onSuccess: (id: number) => void
}

export function DecisionReportDeleteModal({
  isOpen,
  report,
  fieldName,
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

  if (!isOpen || !report) return null

  async function handleDelete() {
    if (isDeleting || !report) return
    setIsDeleting(true)
    setGeneralError(null)
    try {
      await deleteDecisionReport(report.id)
      onSuccess(report.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setGeneralError(
            'This report is referenced by market comparisons and cannot be deleted.',
          )
        } else {
          setGeneralError(err.detail ?? err.message ?? 'Unable to delete the report.')
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
        aria-labelledby="delete-report-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-report-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Decision Report
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
              Are you sure you want to delete this decision report?
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
              <div><strong>Report:</strong> #{report.id}</div>
              <div><strong>Field:</strong> {fieldName}</div>
              <div><strong>Status:</strong> {report.status}</div>
              <div>
                <strong>Created:</strong>{' '}
                {new Date(report.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
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
              <strong>Note:</strong> Market comparisons linked to this report will prevent deletion.
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
                'Delete Report'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
