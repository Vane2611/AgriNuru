import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Farm, FarmCreateRequest } from '../../services/resources/farmsApi'

type FarmFormModalProps = {
  isOpen: boolean
  initialFarm?: Farm | null
  onClose: () => void
  onSubmit: (payload: FarmCreateRequest) => Promise<void>
}

type FormValues = {
  name: string
  county: string
  sub_county: string
  ward: string
  village: string
  description: string
}

export function FarmFormModal({
  isOpen,
  initialFarm,
  onClose,
  onSubmit,
}: FarmFormModalProps) {
  const [values, setValues] = useState<FormValues>(() => ({
    name: initialFarm?.name ?? '',
    county: initialFarm?.county ?? '',
    sub_county: initialFarm?.sub_county ?? '',
    ward: initialFarm?.ward ?? '',
    village: initialFarm?.village ?? '',
    description: initialFarm?.description ?? '',
  }))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const isEditing = Boolean(initialFarm)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Handle ESC key
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

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[field]
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) {
      return
    }

    const trimmedName = values.name.trim()
    if (!trimmedName) {
      setFieldErrors({ name: 'Farm name is required.' })
      nameInputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    setGeneralError('')

    const payload: FarmCreateRequest = {
      name: trimmedName,
      county: values.county.trim() || undefined,
      sub_county: values.sub_county.trim() || undefined,
      ward: values.ward.trim() || undefined,
      village: values.village.trim() || undefined,
      description: values.description.trim() || undefined,
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
          setGeneralError(err.message || 'Failed to save farm details. Please check your input.')
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
        aria-labelledby="farm-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="farm-modal-title">
              {isEditing ? 'Edit Farm Details' : 'Add New Farm'}
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
                <label className="agri-form-label" htmlFor="farm-name-input">
                  Farm Name <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.name ? 'farm-name-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.name)}
                  className={`agri-form-input${fieldErrors.name ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="farm-name-input"
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Green Valley Farm"
                  ref={nameInputRef}
                  type="text"
                  value={values.name}
                />
                {fieldErrors.name && (
                  <p className="agri-form-error" id="farm-name-error">
                    {fieldErrors.name}
                  </p>
                )}
                <p className="agri-form-hint">
                  Must be unique across your registered farms.
                </p>
              </div>

              <div className="row g-2">
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="farm-county-input">
                      County
                    </label>
                    <input
                      className="agri-form-input"
                      disabled={isSubmitting}
                      id="farm-county-input"
                      onChange={(e) => handleChange('county', e.target.value)}
                      placeholder="e.g. Kisumu"
                      type="text"
                      value={values.county}
                    />
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="farm-subcounty-input">
                      Sub-County
                    </label>
                    <input
                      className="agri-form-input"
                      disabled={isSubmitting}
                      id="farm-subcounty-input"
                      onChange={(e) => handleChange('sub_county', e.target.value)}
                      placeholder="e.g. Nyando"
                      type="text"
                      value={values.sub_county}
                    />
                  </div>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="farm-ward-input">
                      Ward
                    </label>
                    <input
                      className="agri-form-input"
                      disabled={isSubmitting}
                      id="farm-ward-input"
                      onChange={(e) => handleChange('ward', e.target.value)}
                      placeholder="e.g. Ahero"
                      type="text"
                      value={values.ward}
                    />
                  </div>
                </div>
                <div className="col-sm-6">
                  <div className="agri-form-group">
                    <label className="agri-form-label" htmlFor="farm-village-input">
                      Village
                    </label>
                    <input
                      className="agri-form-input"
                      disabled={isSubmitting}
                      id="farm-village-input"
                      onChange={(e) => handleChange('village', e.target.value)}
                      placeholder="e.g. Kakola"
                      type="text"
                      value={values.village}
                    />
                  </div>
                </div>
              </div>

              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="farm-description-input">
                  Description
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="farm-description-input"
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Optional details such as topography, soil generalities, or notes..."
                  rows={3}
                  value={values.description}
                />
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
                  'Create Farm'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
