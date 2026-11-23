import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import {
  validateFieldCoordinates,
  type Field,
  type FieldCreateRequest,
} from '../../services/resources/farmsApi'

type FieldFormModalProps = {
  isOpen: boolean
  farmName: string
  initialField?: Field | null
  onClose: () => void
  onSubmit: (payload: FieldCreateRequest) => Promise<void>
}

type FieldFormValues = {
  name: string
  area_hectares: string
  latitude: string
  longitude: string
  irrigation_available: 'true' | 'false' | 'null'
}

export function FieldFormModal({
  isOpen,
  farmName,
  initialField,
  onClose,
  onSubmit,
}: FieldFormModalProps) {
  const [values, setValues] = useState<FieldFormValues>(() => ({
    name: initialField?.name ?? '',
    area_hectares: initialField?.area_hectares ?? '',
    latitude: initialField?.latitude ?? '',
    longitude: initialField?.longitude ?? '',
    irrigation_available:
      initialField?.irrigation_available === true
        ? 'true'
        : initialField?.irrigation_available === false
          ? 'false'
          : 'null',
  }))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialField)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

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

  function handleChange(field: keyof FieldFormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[field]
      if (field === 'latitude' || field === 'longitude') {
        delete updated.latitude
        delete updated.longitude
      }
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) {
      return
    }

    const errors: Record<string, string> = {}
    const trimmedName = values.name.trim()
    if (!trimmedName) {
      errors.name = 'Field name is required.'
    }

    const trimmedArea = values.area_hectares.trim()
    const areaNum = parseFloat(trimmedArea)
    if (!trimmedArea) {
      errors.area_hectares = 'Field area in hectares is required.'
    } else if (Number.isNaN(areaNum) || areaNum <= 0) {
      errors.area_hectares = 'Field area must be a positive number greater than zero.'
    }

    const trimmedLat = values.latitude.trim()
    const trimmedLng = values.longitude.trim()

    // Validate coordinates pair
    const latNull = !trimmedLat
    const lngNull = !trimmedLng

    if (!validateFieldCoordinates(latNull ? null : trimmedLat, lngNull ? null : trimmedLng)) {
      errors.latitude = 'Both latitude and longitude must be provided together or left blank.'
      errors.longitude = 'Both latitude and longitude must be provided together or left blank.'
    } else if (!latNull && !lngNull) {
      const latNum = parseFloat(trimmedLat)
      const lngNum = parseFloat(trimmedLng)

      if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
        errors.latitude = 'Latitude must be a valid number between -90 and 90.'
      }
      if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        errors.longitude = 'Longitude must be a valid number between -180 and 180.'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    setGeneralError('')

    const payload: FieldCreateRequest = {
      name: trimmedName,
      area_hectares: trimmedArea,
      latitude: trimmedLat || null,
      longitude: trimmedLng || null,
      irrigation_available:
        values.irrigation_available === 'true'
          ? true
          : values.irrigation_available === 'false'
            ? false
            : null,
    }

    try {
      await onSubmit(payload)
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
          setGeneralError(err.message || 'Failed to save field details. Please check your inputs.')
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
          if (!isSubmitting) {
            onClose()
          }
        }}
      />
      <div
        aria-labelledby="field-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="field-modal-title">
              {isEditing ? `Edit Field — ${farmName}` : `Add New Field to ${farmName}`}
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
                <label className="agri-form-label" htmlFor="field-name-input">
                  Field / Plot Name <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.name ? 'field-name-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`agri-form-input${fieldErrors.name ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="field-name-input"
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. North Plot A"
                  ref={nameInputRef}
                  type="text"
                  value={values.name}
                />
                {fieldErrors.name && (
                  <p className="agri-form-error" id="field-name-error">
                    {fieldErrors.name}
                  </p>
                )}
                <p className="agri-form-hint">
                  Must be unique within {farmName}.
                </p>
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="field-area-input">
                  Area (Hectares) <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.area_hectares ? 'field-area-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.area_hectares)}
                  className={`agri-form-input${fieldErrors.area_hectares ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="field-area-input"
                  min="0.0001"
                  onChange={(e) => handleChange('area_hectares', e.target.value)}
                  placeholder="e.g. 1.25"
                  step="any"
                  type="number"
                  value={values.area_hectares}
                />
                {fieldErrors.area_hectares && (
                  <p className="agri-form-error" id="field-area-error">
                    {fieldErrors.area_hectares}
                  </p>
                )}
                <p className="agri-form-hint">
                  Field area in hectares (must be greater than zero).
                </p>
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="field-irrigation-select">
                  Irrigation Availability
                </label>
                <select
                  className="agri-form-select"
                  disabled={isSubmitting}
                  id="field-irrigation-select"
                  onChange={(e) =>
                    handleChange(
                      'irrigation_available',
                      e.target.value as 'true' | 'false' | 'null',
                    )
                  }
                  value={values.irrigation_available}
                >
                  <option value="null">Unknown / Not specified</option>
                  <option value="true">Irrigation Available</option>
                  <option value="false">No Irrigation (Rainfed only)</option>
                </select>
              </div>

              <div className="row g-2">
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="field-lat-input">
                      Latitude (optional)
                    </label>
                    <input
                      aria-describedby={fieldErrors.latitude ? 'field-lat-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.latitude)}
                      className={`agri-form-input${fieldErrors.latitude ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="field-lat-input"
                      onChange={(e) => handleChange('latitude', e.target.value)}
                      placeholder="e.g. -0.0917"
                      step="any"
                      type="number"
                      value={values.latitude}
                    />
                    {fieldErrors.latitude && (
                      <p className="agri-form-error" id="field-lat-error">
                        {fieldErrors.latitude}
                      </p>
                    )}
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="field-lng-input">
                      Longitude (optional)
                    </label>
                    <input
                      aria-describedby={fieldErrors.longitude ? 'field-lng-error' : undefined}
                      aria-invalid={Boolean(fieldErrors.longitude)}
                      className={`agri-form-input${fieldErrors.longitude ? ' is-invalid' : ''}`}
                      disabled={isSubmitting}
                      id="field-lng-input"
                      onChange={(e) => handleChange('longitude', e.target.value)}
                      placeholder="e.g. 34.7680"
                      step="any"
                      type="number"
                      value={values.longitude}
                    />
                    {fieldErrors.longitude && (
                      <p className="agri-form-error" id="field-lng-error">
                        {fieldErrors.longitude}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="agri-form-hint" style={{ marginTop: '-8px' }}>
                Both latitude and longitude must be provided together, or both omitted.
              </p>
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
                  'Add Field'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
