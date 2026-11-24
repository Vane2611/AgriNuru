import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  createProductionCost,
  updateProductionCost,
  type ProductionCost,
  type ProductionCostBasis,
  type ProductionCostCategory,
} from '../../services/resources/productionCostsApi'

type ProductionCostFormModalProps = {
  isOpen: boolean
  growingSeasonId: number
  initialCost?: ProductionCost | null
  onClose: () => void
  onSuccess: (cost: ProductionCost) => void
}

type FormValues = {
  category: ProductionCostCategory | ''
  cost_basis: ProductionCostBasis
  amount: string
  currency: string
  cost_date: string
  notes: string
}

const categoryOptions: { value: ProductionCostCategory; label: string }[] = [
  { value: 'seeds', label: 'Seeds' },
  { value: 'fertiliser', label: 'Fertiliser' },
  { value: 'labour', label: 'Labour' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'land_preparation', label: 'Land Preparation' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'other', label: 'Other' },
]

const costBasisOptions: { value: ProductionCostBasis; label: string }[] = [
  { value: 'actual', label: 'Actual Expenditure' },
  { value: 'estimated', label: 'Estimated Cost' },
]

export function costCategoryLabel(value: ProductionCostCategory): string {
  return categoryOptions.find((o) => o.value === value)?.label ?? value
}

export function costBasisLabel(value: ProductionCostBasis): string {
  return costBasisOptions.find((o) => o.value === value)?.label ?? value
}

function deriveInitialValues(
  initialCost: ProductionCost | null | undefined,
): FormValues {
  if (!initialCost) {
    return {
      category: '',
      cost_basis: 'actual',
      amount: '',
      currency: 'KES',
      cost_date: '',
      notes: '',
    }
  }
  return {
    category: initialCost.category,
    cost_basis: initialCost.cost_basis,
    amount: initialCost.amount,
    currency: initialCost.currency,
    cost_date: initialCost.cost_date ?? '',
    notes: initialCost.notes,
  }
}

export function ProductionCostFormModal({
  isOpen,
  growingSeasonId,
  initialCost,
  onClose,
  onSuccess,
}: ProductionCostFormModalProps) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialCost),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const categorySelectRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialCost)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialCost))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialCost])

  useEffect(() => {
    if (isOpen) {
      categorySelectRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onClose])

  if (!isOpen) {
    return null
  }

  function handleChange(key: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const errors: Record<string, string> = {}

    if (!values.category) {
      errors.category = 'Category is required.'
    }
    if (!values.cost_basis) {
      errors.cost_basis = 'Cost basis is required.'
    }

    const amountNum = parseFloat(values.amount)
    if (!values.amount.trim()) {
      errors.amount = 'Amount is required.'
    } else if (Number.isNaN(amountNum) || amountNum <= 0) {
      errors.amount = 'Amount must be greater than zero.'
    }

    if (!values.currency.trim()) {
      errors.currency = 'Currency is required.'
    } else if (!/^[A-Z]{3}$/.test(values.currency.trim())) {
      errors.currency = 'Currency must be a 3-letter uppercase code, e.g. KES, USD.'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    setGeneralError('')

    try {
      const payload = {
        growing_season: growingSeasonId,
        category: values.category as ProductionCostCategory,
        cost_basis: values.cost_basis,
        amount: values.amount.trim(),
        currency: values.currency.trim(),
        cost_date: values.cost_date || null,
        notes: values.notes.trim() || undefined,
      }

      let result: ProductionCost
      if (isEditing && initialCost) {
        result = await updateProductionCost(initialCost.id, payload)
      } else {
        result = await createProductionCost(payload)
      }

      onSuccess(result)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const nextErrors: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(err.fields)) {
          if (msgs.length > 0) {
            nextErrors[key] = msgs[0]
          }
        }
        setFieldErrors(nextErrors)

        if (err.detail) {
          setGeneralError(err.detail)
        } else if (Object.keys(nextErrors).length === 0) {
          setGeneralError(
            err.message || 'Failed to save the cost record. Please check your input.',
          )
        }
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => {
          if (!isSubmitting) onClose()
        }}
      />
      <div
        aria-labelledby="cost-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="cost-form-modal-title">
              {isEditing ? 'Edit Cost' : 'Add Cost'}
            </h4>
            <button
              aria-label="Close dialog"
              className="agri-modal-close"
              disabled={isSubmitting}
              onClick={onClose}
              type="button"
            >
              <i aria-hidden="true" className="bi bi-x-lg" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="agri-modal-body">
              {generalError && (
                <div className="farms-alert" role="alert">
                  <i aria-hidden="true" className="bi bi-exclamation-triangle-fill" />
                  <div className="farms-alert-content">{generalError}</div>
                </div>
              )}

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="cost-category-select">
                  Category <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.category ? 'cost-category-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.category)}
                  className={`agri-form-select${fieldErrors.category ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="cost-category-select"
                  onChange={(e) => handleChange('category', e.target.value)}
                  ref={categorySelectRef}
                  value={values.category}
                >
                  <option value="">— Select category —</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p className="agri-form-error" id="cost-category-error">
                    {fieldErrors.category}
                  </p>
                )}
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="cost-basis-select">
                  Cost Basis <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.cost_basis ? 'cost-basis-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.cost_basis)}
                  className={`agri-form-select${fieldErrors.cost_basis ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="cost-basis-select"
                  onChange={(e) => handleChange('cost_basis', e.target.value)}
                  value={values.cost_basis}
                >
                  {costBasisOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.cost_basis && (
                  <p className="agri-form-error" id="cost-basis-error">
                    {fieldErrors.cost_basis}
                  </p>
                )}
                {values.cost_basis === 'estimated' && (
                  <p className="agri-form-hint">
                    Estimated costs are projections and are not counted as actual expenditure.
                  </p>
                )}
              </div>

              <div className="row g-2">
                <div className="col-sm-7">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="cost-amount-input">
                      Amount <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.amount ? 'cost-amount-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.amount)}
                      className={`agri-form-input${fieldErrors.amount ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="cost-amount-input"
                      min="0.01"
                      onChange={(e) => handleChange('amount', e.target.value)}
                      placeholder="e.g. 1500.00"
                      step="0.01"
                      type="number"
                      value={values.amount}
                    />
                    {fieldErrors.amount && (
                      <p className="agri-form-error" id="cost-amount-error">
                        {fieldErrors.amount}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-sm-5">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="cost-currency-input">
                      Currency <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.currency ? 'cost-currency-error' : 'cost-currency-hint'}
                      aria-invalid={Boolean(fieldErrors.currency)}
                      className={`agri-form-input${fieldErrors.currency ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="cost-currency-input"
                      maxLength={3}
                      onChange={(e) =>
                        handleChange('currency', e.target.value.toUpperCase())
                      }
                      placeholder="KES"
                      type="text"
                      value={values.currency}
                    />
                    {fieldErrors.currency && (
                      <p className="agri-form-error" id="cost-currency-error">
                        {fieldErrors.currency}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="agri-form-hint" id="cost-currency-hint" style={{ marginTop: '-8px' }}>
                3-letter currency code, e.g. KES, USD, EUR.
              </p>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="cost-date-input">
                  Cost Date
                </label>
                <input
                  aria-describedby={fieldErrors.cost_date ? 'cost-date-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.cost_date)}
                  className={`agri-form-input${fieldErrors.cost_date ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="cost-date-input"
                  onChange={(e) => handleChange('cost_date', e.target.value)}
                  type="date"
                  value={values.cost_date}
                />
                {fieldErrors.cost_date && (
                  <p className="agri-form-error" id="cost-date-error">
                    {fieldErrors.cost_date}
                  </p>
                )}
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="cost-notes-input">
                  Notes
                </label>
                <textarea
                  className={`agri-form-textarea${fieldErrors.notes ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="cost-notes-input"
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this cost..."
                  rows={3}
                  value={values.notes}
                />
                {fieldErrors.notes && (
                  <p className="agri-form-error">{fieldErrors.notes}</p>
                )}
              </div>
            </div>

            <div className="agri-modal-footer">
              <button
                className="farms-btn-secondary"
                disabled={isSubmitting}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="farms-btn-primary"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="spinner-border spinner-border-sm"
                      role="status"
                    />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Add Cost'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
