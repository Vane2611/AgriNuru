import { useEffect, useRef, useState } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  deleteProductionCost,
  type ProductionCost,
  type ProductionCostBasis,
  type ProductionCostCategory,
} from '../../services/resources/productionCostsApi'

type ProductionCostDeleteModalProps = {
  isOpen: boolean
  cost: ProductionCost | null
  onClose: () => void
  onSuccess: (deletedId: number) => void
}

const categoryLabels: Record<ProductionCostCategory, string> = {
  seeds: 'Seeds',
  fertiliser: 'Fertiliser',
  labour: 'Labour',
  irrigation: 'Irrigation',
  pest_control: 'Pest Control',
  land_preparation: 'Land Preparation',
  machinery: 'Machinery',
  other: 'Other',
}

const costBasisLabels: Record<ProductionCostBasis, string> = {
  actual: 'Actual Expenditure',
  estimated: 'Estimated Cost',
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

export function ProductionCostDeleteModal({
  isOpen,
  cost,
  onClose,
  onSuccess,
}: ProductionCostDeleteModalProps) {
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

  if (!isOpen || !cost) {
    return null
  }

  async function handleDelete() {
    if (isDeleting || !cost) return

    setIsDeleting(true)
    setDeleteError('')

    try {
      await deleteProductionCost(cost.id)
      onSuccess(cost.id)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setDeleteError(
            err.detail ||
              'This cost record cannot be deleted because it is referenced by other records.',
          )
        } else {
          setDeleteError(err.detail || err.message || 'Unable to delete the cost record.')
        }
      } else {
        setDeleteError('A network error occurred while deleting the cost record.')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const truncatedNotes =
    cost.notes.length > 120
      ? cost.notes.slice(0, 117) + '...'
      : cost.notes

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
        aria-labelledby="delete-cost-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="delete-cost-title" style={{ color: '#a3382c' }}>
              <i aria-hidden="true" className="bi bi-exclamation-triangle me-2" />
              Delete Cost Record
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
              Are you sure you want to delete this cost record?
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
                <strong>Category:</strong>{' '}
                {categoryLabels[cost.category] ?? cost.category}
              </div>
              <div>
                <strong>Basis:</strong>{' '}
                {costBasisLabels[cost.cost_basis] ?? cost.cost_basis}
              </div>
              <div>
                <strong>Amount:</strong> {cost.amount} {cost.currency}
              </div>
              {cost.cost_date && (
                <div>
                  <strong>Date:</strong> {formatDate(cost.cost_date)}
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
                'Delete Cost'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
