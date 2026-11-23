import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Field } from '../../services/resources/farmsApi'

type FieldDeleteModalProps = {
  field: Field
  farmName: string
  onClose: () => void
  onConfirm: (field: Field) => Promise<void>
}

export function FieldDeleteModal({
  field,
  farmName,
  onClose,
  onConfirm,
}: FieldDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDeleting, onClose])

  async function handleDelete() {
    if (isDeleting) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await onConfirm(field)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage(
            err.detail ||
              'This field cannot be deleted because it is associated with existing production seasons or harvest records.',
          )
        } else {
          setErrorMessage(err.detail || err.message || 'Unable to delete field.')
        }
      } else {
        setErrorMessage('A network error occurred while deleting the field.')
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
          if (!isDeleting) {
            onClose()
          }
        }}
      />
      <div
        aria-labelledby="delete-field-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-field-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Field
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
            {errorMessage ? (
              <div className="farms-alert" role="alert">
                <i aria-hidden="true" className="bi bi-exclamation-circle-fill" />
                <div className="farms-alert-content">{errorMessage}</div>
              </div>
            ) : (
              <>
                <p style={{ margin: 0, color: 'var(--app-ink)', fontSize: '13.5px' }}>
                  Are you sure you want to delete <strong>{field.name}</strong> from{' '}
                  <strong>{farmName}</strong>?
                </p>
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
                  <strong>Warning:</strong> Fields referenced in crop growing seasons,
                  production costs, or harvest records cannot be deleted.
                </div>
              </>
            )}
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
              onClick={handleDelete}
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
                'Delete Field'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
