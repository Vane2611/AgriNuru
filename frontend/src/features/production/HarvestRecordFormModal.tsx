import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  createHarvestRecord,
  updateHarvestRecord,
  type HarvestRecord,
} from '../../services/resources/harvestRecordsApi'

type HarvestRecordFormModalProps = {
  isOpen: boolean
  growingSeasonId: number
  plantingDate: string
  initialRecord?: HarvestRecord | null
  onClose: () => void
  onSuccess: (record: HarvestRecord) => void
}

type FormValues = {
  harvested_on: string
  quantity: string
  quantity_unit: string
  quality_grade: string
  notes: string
}

function deriveInitialValues(
  initialRecord: HarvestRecord | null | undefined,
): FormValues {
  if (!initialRecord) {
    return {
      harvested_on: '',
      quantity: '',
      quantity_unit: 'kg',
      quality_grade: '',
      notes: '',
    }
  }
  return {
    harvested_on: initialRecord.harvested_on,
    quantity: initialRecord.quantity,
    quantity_unit: initialRecord.quantity_unit,
    quality_grade: initialRecord.quality_grade,
    notes: initialRecord.notes,
  }
}

export function HarvestRecordFormModal({
  isOpen,
  growingSeasonId,
  plantingDate,
  initialRecord,
  onClose,
  onSuccess,
}: HarvestRecordFormModalProps) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialRecord),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const harvestedOnRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialRecord)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialRecord))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialRecord])

  useEffect(() => {
    if (isOpen) {
      harvestedOnRef.current?.focus()
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

  const formattedPlantingDate = plantingDate
    ? new Date(plantingDate + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

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

    if (!values.harvested_on) {
      errors.harvested_on = 'Harvest date is required.'
    }

    const quantityNum = parseFloat(values.quantity)
    if (!values.quantity.trim()) {
      errors.quantity = 'Quantity is required.'
    } else if (Number.isNaN(quantityNum) || quantityNum <= 0) {
      errors.quantity = 'Quantity must be greater than zero.'
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
        harvested_on: values.harvested_on,
        quantity: values.quantity.trim(),
        quantity_unit: values.quantity_unit.trim(),
        quality_grade: values.quality_grade.trim() || undefined,
        notes: values.notes.trim() || undefined,
      }

      let result: HarvestRecord
      if (isEditing && initialRecord) {
        result = await updateHarvestRecord(initialRecord.id, payload)
      } else {
        result = await createHarvestRecord(payload)
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
            err.message || 'Failed to save the harvest record. Please check your input.',
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
        aria-labelledby="harvest-record-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="harvest-record-form-modal-title">
              {isEditing ? 'Edit Harvest Record' : 'Record Harvest'}
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
                <label className="agri-form-label" htmlFor="harvest-on-input">
                  Harvested On <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.harvested_on ? 'harvest-on-error' : 'harvest-on-hint'}
                  aria-invalid={Boolean(fieldErrors.harvested_on)}
                  className={`agri-form-input${fieldErrors.harvested_on ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="harvest-on-input"
                  onChange={(e) => handleChange('harvested_on', e.target.value)}
                  ref={harvestedOnRef}
                  type="date"
                  value={values.harvested_on}
                />
                {fieldErrors.harvested_on && (
                  <p className="agri-form-error" id="harvest-on-error">
                    {fieldErrors.harvested_on}
                  </p>
                )}
                {plantingDate && (
                  <p className="agri-form-hint" id="harvest-on-hint">
                    Must be on or after the planting date ({formattedPlantingDate}).
                  </p>
                )}
              </div>

              <div className="row g-2">
                <div className="col-sm-7">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="harvest-quantity-input">
                      Quantity <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.quantity ? 'harvest-qty-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.quantity)}
                      className={`agri-form-input${fieldErrors.quantity ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="harvest-quantity-input"
                      min="0.001"
                      onChange={(e) => handleChange('quantity', e.target.value)}
                      placeholder="e.g. 250"
                      step="0.001"
                      type="number"
                      value={values.quantity}
                    />
                    {fieldErrors.quantity && (
                      <p className="agri-form-error" id="harvest-qty-error">
                        {fieldErrors.quantity}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-sm-5">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="harvest-unit-input">
                      Unit <span className="required-star">*</span>
                    </label>
                    <input
                      aria-describedby={fieldErrors.quantity_unit ? 'harvest-unit-error' : 'harvest-unit-hint'}
                      aria-invalid={Boolean(fieldErrors.quantity_unit)}
                      className={`agri-form-input${fieldErrors.quantity_unit ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="harvest-unit-input"
                      maxLength={30}
                      onChange={(e) => handleChange('quantity_unit', e.target.value)}
                      placeholder="e.g. kg"
                      type="text"
                      value={values.quantity_unit}
                    />
                    {fieldErrors.quantity_unit && (
                      <p className="agri-form-error" id="harvest-unit-error">
                        {fieldErrors.quantity_unit}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="agri-form-hint" id="harvest-unit-hint" style={{ marginTop: '-8px' }}>
                e.g. kg, tonnes, bags
              </p>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="harvest-grade-input">
                  Quality Grade
                </label>
                <input
                  aria-describedby={fieldErrors.quality_grade ? 'harvest-grade-error' : 'harvest-grade-hint'}
                  aria-invalid={Boolean(fieldErrors.quality_grade)}
                  className={`agri-form-input${fieldErrors.quality_grade ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="harvest-grade-input"
                  maxLength={100}
                  onChange={(e) => handleChange('quality_grade', e.target.value)}
                  placeholder="e.g. Grade A"
                  type="text"
                  value={values.quality_grade}
                />
                {fieldErrors.quality_grade && (
                  <p className="agri-form-error" id="harvest-grade-error">
                    {fieldErrors.quality_grade}
                  </p>
                )}
                <p className="agri-form-hint" id="harvest-grade-hint">
                  Optional grade, e.g. Grade A, Grade B.
                </p>
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="harvest-notes-input">
                  Notes
                </label>
                <textarea
                  className={`agri-form-textarea${fieldErrors.notes ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="harvest-notes-input"
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this harvest..."
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
                  'Record Harvest'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
