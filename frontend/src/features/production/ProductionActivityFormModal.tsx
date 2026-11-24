import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  createProductionActivity,
  updateProductionActivity,
  type ActivityType,
  type ProductionActivity,
} from '../../services/resources/productionActivitiesApi'

type ProductionActivityFormModalProps = {
  isOpen: boolean
  growingSeasonId: number
  plantingDate: string
  initialActivity?: ProductionActivity | null
  onClose: () => void
  onSuccess: (activity: ProductionActivity) => void
}

type FormValues = {
  activity_type: ActivityType
  activity_date: string
  notes: string
}

const activityTypeOptions: { value: ActivityType; label: string }[] = [
  { value: 'land_preparation', label: 'Land Preparation' },
  { value: 'planting', label: 'Planting' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'fertiliser_application', label: 'Fertiliser Application' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'weeding', label: 'Weeding' },
  { value: 'other', label: 'Other' },
]

function activityTypeLabel(value: ActivityType): string {
  return activityTypeOptions.find((o) => o.value === value)?.label ?? value
}

function deriveInitialValues(
  initialActivity: ProductionActivity | null | undefined,
): FormValues {
  if (!initialActivity) {
    return {
      activity_type: 'land_preparation',
      activity_date: '',
      notes: '',
    }
  }
  return {
    activity_type: initialActivity.activity_type,
    activity_date: initialActivity.activity_date,
    notes: initialActivity.notes,
  }
}

export function ProductionActivityFormModal({
  isOpen,
  growingSeasonId,
  plantingDate,
  initialActivity,
  onClose,
  onSuccess,
}: ProductionActivityFormModalProps) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialActivity),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const activityTypeRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialActivity)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialActivity))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialActivity])

  useEffect(() => {
    if (isOpen) {
      activityTypeRef.current?.focus()
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

    if (!values.activity_type) {
      errors.activity_type = 'Activity type is required.'
    }
    if (!values.activity_date) {
      errors.activity_date = 'Activity date is required.'
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
        activity_type: values.activity_type,
        activity_date: values.activity_date,
        notes: values.notes.trim() || undefined,
      }

      let result: ProductionActivity
      if (isEditing && initialActivity) {
        result = await updateProductionActivity(initialActivity.id, payload)
      } else {
        result = await createProductionActivity(payload)
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
            err.message || 'Failed to save the activity. Please check your input.',
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
        aria-labelledby="activity-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="activity-form-modal-title">
              {isEditing ? 'Edit Activity' : 'Add Activity'}
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
                <label className="agri-form-label" htmlFor="activity-type-select">
                  Activity Type <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.activity_type ? 'activity-type-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.activity_type)}
                  className={`agri-form-select${fieldErrors.activity_type ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="activity-type-select"
                  onChange={(e) => handleChange('activity_type', e.target.value)}
                  ref={activityTypeRef}
                  value={values.activity_type}
                >
                  {activityTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.activity_type && (
                  <p className="agri-form-error" id="activity-type-error">
                    {fieldErrors.activity_type}
                  </p>
                )}
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="activity-date-input">
                  Activity Date <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.activity_date ? 'activity-date-error' : 'activity-date-hint'}
                  aria-invalid={Boolean(fieldErrors.activity_date)}
                  className={`agri-form-input${fieldErrors.activity_date ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="activity-date-input"
                  onChange={(e) => handleChange('activity_date', e.target.value)}
                  type="date"
                  value={values.activity_date}
                />
                {fieldErrors.activity_date && (
                  <p className="agri-form-error" id="activity-date-error">
                    {fieldErrors.activity_date}
                  </p>
                )}
                {plantingDate && (
                  <p className="agri-form-hint" id="activity-date-hint">
                    Must be on or after the planting date ({formattedPlantingDate}).
                  </p>
                )}
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="activity-notes-input">
                  Notes
                </label>
                <textarea
                  className={`agri-form-textarea${fieldErrors.notes ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="activity-notes-input"
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this activity..."
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
                  'Add Activity'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

export { activityTypeLabel }
