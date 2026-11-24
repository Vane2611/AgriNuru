import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteProductionPlan,
  type ProductionPlan,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  plan: ProductionPlan | null
  cropName: string
  fieldName: string
  onClose: () => void
  onSuccess: (id: number) => void
}

export function ProductionPlanDeleteModal({
  isOpen,
  plan,
  cropName,
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

  if (!isOpen || !plan) return null

  async function handleDelete() {
    if (isDeleting || !plan) return
    setIsDeleting(true)
    setGeneralError(null)
    try {
      await deleteProductionPlan(plan.id)
      onSuccess(plan.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setGeneralError(
            'This production plan is referenced by decision reports or market comparisons and cannot be deleted.',
          )
        } else {
          setGeneralError(err.detail ?? err.message ?? 'Unable to delete the production plan.')
        }
      } else {
        setGeneralError('A network error occurred while deleting.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const costDisplay =
    plan.estimated_cost != null && plan.estimated_cost !== ''
      ? `${plan.estimated_cost} ${plan.currency}`
      : 'Not entered'

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => { if (!isDeleting) onClose() }}
      />
      <div
        aria-labelledby="delete-plan-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-plan-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Production Plan
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
              Are you sure you want to delete this production plan?
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
              <div><strong>Crop:</strong> {cropName}</div>
              <div><strong>Field:</strong> {fieldName}</div>
              <div><strong>Status:</strong> {plan.status}</div>
              <div><strong>Estimated Cost:</strong> {costDisplay}</div>
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
              <strong>Note:</strong> Deletion is prevented if this plan is linked to a decision report or market comparison.
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
                'Delete Plan'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
