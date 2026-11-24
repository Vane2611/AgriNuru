import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  createHarvestEstimate,
  updateHarvestEstimate,
  type EstimateSource,
  type HarvestEstimate,
} from '../../services/resources/harvestEstimatesApi'

type HarvestEstimateFormModalProps = {
  isOpen: boolean
  growingSeasonId: number
  initialEstimate?: HarvestEstimate | null
  onClose: () => void
  onSuccess: (estimate: HarvestEstimate) => void
}

type FormValues = {
  estimated_on: string
  estimated_quantity: string
  quantity_unit: string
  estimate_source: EstimateSource | ''
  source_reference: string
  notes: string
}

const estimateSourceOptions: { value: EstimateSource; label: string }[] = [
  { value: 'farmer', label: 'Farmer Assessment' },
  { value: 'extension', label: 'Extension Officer' },
  { value: 'model', label: 'Predictive Model' },
  { value: 'other', label: 'Other' },
]

export function estimateSourceLabel(value: EstimateSource | ''): string {
  if (!value) return '—'
  return estimateSourceOptions.find((o) => o.value === value)?.label ?? value
}

function deriveInitialValues(
  initialEstimate: HarvestEstimate | null | undefined,
): FormValues {
  if (!initialEstimate) {
    return {
      estimated_on: '',
      estimated_quantity: '',
      quantity_unit: 'kg',
      estimate_source: '',
      source_reference: '',
      notes: '',
    }
  }
  return {
    estimated_on: initialEstimate.estimated_on,
    estimated_quantity: initialEstimate.estimated_quantity,
    quantity_unit: initialEstimate.quantity_unit,
    estimate_source: initialEstimate.estimate_source,
    source_reference: initialEstimate.source_reference,
    notes: initialEstimate.notes,
  }
}

export function HarvestEstimateFormModal({
  isOpen,
  growingSeasonId,
  initialEstimate,
  onClose,
  onSuccess,
}: HarvestEstimateFormModalProps) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialEstimate),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const estimatedOnRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialEstimate)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialEstimate))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialEstimate])

  useEffect(() => {
    if (isOpen) {
      estimatedOnRef.current?.focus()
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

    if (!values.estimated_on) {
      errors.estimated_on = 'Estimated on date is required.'
    }

    const quantityNum = parseFloat(values.estimated_quantity)
    if (!values.estimated_quantity.trim()) {
      errors.estimated_quantity = 'Estimated quantity is required.'
    } else if (Number.isNaN(quantityNum) || quantityNum <= 0) {
      errors.estimated_quantity = 'Estimated quantity must be greater than zero.'
    }

    if (!values.quantity_unit.trim()) {
      errors.quantity_unit = 'Quantity unit is required.'
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
        estimated_on: values.estimated_on,
        estimated_quantity: values.estimated_quantity.trim(),
        quantity_unit: values.quantity_unit.trim(),
        estimate_source: values.estimate_source || undefined,
        source_reference: values.source_reference.trim() || undefined,
        notes: values.notes.trim() || undefined,
      }

      let result: HarvestEstimate
      if (isEditing && initialEstimate) {
        result = await updateHarvestEstimate(initialEstimate.id, payload)
      } else {
        result = await createHarvestEstimate(payload)
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
            err.message || 'Failed to save the harvest estimate. Please check your input.',
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
        aria-labelledby="estimate-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="estimate-form-modal-title">
              {isEditing ? 'Edit Harvest Estimate' : 'Add Harvest Estimate'}
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
                <label className="agri-form-label" htmlFor="estimate-on-input">
                  Estimated On <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.estimated_on ? 'estimate-on-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.estimated_on)}
                  className={`agri-form-input${fieldErrors.estimated_on ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="estimate-on-input"
                  onChange={(e) => handleChange('estimated_on', e.target.value)}
                  ref={estimatedOnRef}
                  type="date"
                  value={values.estimated_on}
                />
                {fieldErrors.estimated_on && (
                  <p className="agri-form-error" id="estimate-on-error">
                    {fieldErrors.estimated_on}
                  </p>
                )}
              </div>

              <div className="row g-2">
                <div className="col-sm-7">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="estimate-quantity-input">
                      Estimated Quantity <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.estimated_quantity ? 'estimate-qty-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.estimated_quantity)}
                      className={`agri-form-input${fieldErrors.estimated_quantity ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="estimate-quantity-input"
                      min="0.001"
                      onChange={(e) => handleChange('estimated_quantity', e.target.value)}
                      placeholder="e.g. 500"
                      step="0.01"
                      type="number"
                      value={values.estimated_quantity}
                    />
                    {fieldErrors.estimated_quantity && (
                      <p className="agri-form-error" id="estimate-qty-error">
                        {fieldErrors.estimated_quantity}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-sm-5">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="estimate-unit-input">
                      Unit <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.quantity_unit ? 'estimate-unit-error' : 'estimate-unit-hint'}
                      aria-invalid={Boolean(fieldErrors.quantity_unit)}
                      className={`agri-form-input${fieldErrors.quantity_unit ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="estimate-unit-input"
                      maxLength={30}
                      onChange={(e) => handleChange('quantity_unit', e.target.value)}
                      placeholder="e.g. kg"
                      type="text"
                      value={values.quantity_unit}
                    />
                    {fieldErrors.quantity_unit && (
                      <p className="agri-form-error" id="estimate-unit-error">
                        {fieldErrors.quantity_unit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="agri-form-hint" id="estimate-unit-hint" style={{ marginTop: '-8px' }}>
                e.g. kg, tonnes, bags
              </p>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="estimate-source-select">
                  Estimate Source
                </label>
                <select
                  aria-describedby={fieldErrors.estimate_source ? 'estimate-source-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.estimate_source)}
                  className={`agri-form-select${fieldErrors.estimate_source ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="estimate-source-select"
                  onChange={(e) => handleChange('estimate_source', e.target.value)}
                  value={values.estimate_source}
                >
                  <option value="">— Select source (optional) —</option>
                  {estimateSourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.estimate_source && (
                  <p className="agri-form-error" id="estimate-source-error">
                    {fieldErrors.estimate_source}
                  </p>
                )}
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="estimate-source-ref-input">
                  Source Reference
                </label>
                <input
                  aria-describedby={fieldErrors.source_reference ? 'estimate-source-ref-error' : 'estimate-source-ref-hint'}
                  aria-invalid={Boolean(fieldErrors.source_reference)}
                  className={`agri-form-input${fieldErrors.source_reference ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="estimate-source-ref-input"
                  maxLength={500}
                  onChange={(e) => handleChange('source_reference', e.target.value)}
                  placeholder="e.g. John Mwangi (officer), model v2.1"
                  type="text"
                  value={values.source_reference}
                />
                {fieldErrors.source_reference && (
                  <p className="agri-form-error" id="estimate-source-ref-error">
                    {fieldErrors.source_reference}
                  </p>
                )}
                <p className="agri-form-hint" id="estimate-source-ref-hint">
                  Optional reference, e.g. officer name, model version.
                </p>
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="estimate-notes-input">
                  Notes
                </label>
                <textarea
                  className={`agri-form-textarea${fieldErrors.notes ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="estimate-notes-input"
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this estimate..."
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
                  'Add Estimate'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
