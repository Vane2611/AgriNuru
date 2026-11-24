import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Crop, CropVariety } from '../../services/resources/cropsApi'
import type { Farm, Field } from '../../services/resources/farmsApi'
import {
  createGrowingSeason,
  updateGrowingSeason,
  type GrowingSeason,
  type GrowingSeasonStatus,
} from '../../services/resources/growingSeasonsApi'

type GrowingSeasonFormModalProps = {
  isOpen: boolean
  initialSeason?: GrowingSeason | null
  farms: Farm[]
  allFields: Field[]
  crops: Crop[]
  allVarieties: CropVariety[]
  onClose: () => void
  onSuccess: (season: GrowingSeason) => void
}

type FormValues = {
  farmId: string
  field: string
  crop: string
  variety: string
  planting_date: string
  expected_harvest_date: string
  actual_harvest_date: string
  area_planted_hectares: string
  status: GrowingSeasonStatus
  notes: string
}

function deriveInitialValues(
  initialSeason: GrowingSeason | null | undefined,
  allFields: Field[],
): FormValues {
  if (!initialSeason) {
    return {
      farmId: '',
      field: '',
      crop: '',
      variety: '',
      planting_date: '',
      expected_harvest_date: '',
      actual_harvest_date: '',
      area_planted_hectares: '',
      status: 'planned',
      notes: '',
    }
  }

  const matchingField = allFields.find((f) => f.id === initialSeason.field)
  const farmId = matchingField ? String(matchingField.farm) : ''

  return {
    farmId,
    field: String(initialSeason.field),
    crop: String(initialSeason.crop),
    variety: initialSeason.variety != null ? String(initialSeason.variety) : '',
    planting_date: initialSeason.planting_date,
    expected_harvest_date: initialSeason.expected_harvest_date ?? '',
    actual_harvest_date: initialSeason.actual_harvest_date ?? '',
    area_planted_hectares: initialSeason.area_planted_hectares ?? '',
    status: initialSeason.status,
    notes: initialSeason.notes,
  }
}

export function GrowingSeasonFormModal({
  isOpen,
  initialSeason,
  farms,
  allFields,
  crops,
  allVarieties,
  onClose,
  onSuccess,
}: GrowingSeasonFormModalProps) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialSeason, allFields),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const farmSelectRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialSeason)

  // Reset form state when modal opens or the initialSeason changes
  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialSeason, allFields))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialSeason, allFields])

  // Auto-focus the Farm select on open
  useEffect(() => {
    if (isOpen) {
      farmSelectRef.current?.focus()
    }
  }, [isOpen])

  // Escape key
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

  // Derived lists based on current selections
  const fieldsForFarm = values.farmId
    ? allFields.filter((f) => String(f.farm) === values.farmId)
    : []

  const varietiesForCrop = values.crop
    ? allVarieties.filter((v) => String(v.crop) === values.crop)
    : []

  const selectedField = allFields.find((f) => String(f.id) === values.field) ?? null
  const fieldAreaNum = selectedField ? parseFloat(selectedField.area_hectares) : null

  function handleChange(key: keyof FormValues, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }

      // Farm → Field dependency: reset field and variety
      if (key === 'farmId') {
        next.field = ''
        next.variety = ''
        next.area_planted_hectares = ''
      }

      // Field change: clear area error
      if (key === 'field') {
        next.variety = prev.crop ? prev.variety : ''
      }

      // Crop → Variety dependency
      if (key === 'crop') {
        next.variety = ''
      }

      return next
    })

    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[key]
      if (key === 'farmId') {
        delete updated.field
        delete updated.variety
      }
      if (key === 'crop') {
        delete updated.variety
      }
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    // Client-side validation
    const errors: Record<string, string> = {}

    if (!values.field) {
      errors.field = 'Please select a field.'
    }
    if (!values.crop) {
      errors.crop = 'Please select a crop.'
    }
    if (!values.planting_date) {
      errors.planting_date = 'Planting date is required.'
    }
    if (!values.status) {
      errors.status = 'Status is required.'
    }

    // Area planted validation
    const areaStr = values.area_planted_hectares.trim()
    if (areaStr) {
      const areaNum = parseFloat(areaStr)
      if (Number.isNaN(areaNum) || areaNum < 0.0001) {
        errors.area_planted_hectares = 'Area planted must be greater than zero.'
      } else if (fieldAreaNum !== null && !Number.isNaN(fieldAreaNum) && areaNum > fieldAreaNum) {
        errors.area_planted_hectares = `Area planted (${areaNum} ha) cannot exceed the field's recorded area (${fieldAreaNum} ha).`
      }
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
        field: parseInt(values.field, 10),
        crop: parseInt(values.crop, 10),
        variety: values.variety ? parseInt(values.variety, 10) : null,
        planting_date: values.planting_date,
        expected_harvest_date: values.expected_harvest_date || null,
        actual_harvest_date: values.actual_harvest_date || null,
        area_planted_hectares: areaStr || null,
        status: values.status,
        notes: values.notes.trim(),
      }

      let result: GrowingSeason
      if (isEditing && initialSeason) {
        result = await updateGrowingSeason(initialSeason.id, payload)
      } else {
        result = await createGrowingSeason(payload)
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
          setGeneralError(err.message || 'Failed to save the growing season. Please check your input.')
        }
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusOptions: { value: GrowingSeasonStatus; label: string }[] = [
    { value: 'planned', label: 'Planned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'abandoned', label: 'Abandoned' },
  ]

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
        aria-labelledby="season-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="season-form-modal-title">
              {isEditing ? 'Edit Growing Season' : 'Add Growing Season'}
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

              {/* Farm selector — derived control */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-farm-select">
                  Farm <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.field ? 'season-field-error' : undefined}
                  className="agri-form-select"
                  disabled={isSubmitting}
                  id="season-farm-select"
                  onChange={(e) => handleChange('farmId', e.target.value)}
                  ref={farmSelectRef}
                  value={values.farmId}
                >
                  <option value="">— Select a farm —</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={String(farm.id)}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Field */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-field-select">
                  Field <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.field ? 'season-field-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.field)}
                  className={`agri-form-select${fieldErrors.field ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.farmId}
                  id="season-field-select"
                  onChange={(e) => handleChange('field', e.target.value)}
                  value={values.field}
                >
                  <option value="">
                    {values.farmId ? '— Select a field —' : '— Select a farm first —'}
                  </option>
                  {fieldsForFarm.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name} ({parseFloat(f.area_hectares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha)
                    </option>
                  ))}
                </select>
                {fieldErrors.field && (
                  <p className="agri-form-error" id="season-field-error">
                    {fieldErrors.field}
                  </p>
                )}
                {selectedField && (
                  <p className="agri-form-hint">
                    Field area: {parseFloat(selectedField.area_hectares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha. Area planted cannot exceed this.
                  </p>
                )}
              </div>

              {/* Crop */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-crop-select">
                  Crop <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.crop ? 'season-crop-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.crop)}
                  className={`agri-form-select${fieldErrors.crop ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-crop-select"
                  onChange={(e) => handleChange('crop', e.target.value)}
                  value={values.crop}
                >
                  <option value="">— Select a crop —</option>
                  {crops.map((crop) => (
                    <option key={crop.id} value={String(crop.id)}>
                      {crop.common_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.crop && (
                  <p className="agri-form-error" id="season-crop-error">
                    {fieldErrors.crop}
                  </p>
                )}
              </div>

              {/* Variety */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-variety-select">
                  Variety
                </label>
                <select
                  aria-describedby={fieldErrors.variety ? 'season-variety-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.variety)}
                  className={`agri-form-select${fieldErrors.variety ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.crop}
                  id="season-variety-select"
                  onChange={(e) => handleChange('variety', e.target.value)}
                  value={values.variety}
                >
                  <option value="">— No specific variety —</option>
                  {varietiesForCrop.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}
                      {v.maturity_days != null ? ` (${v.maturity_days} days)` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.variety && (
                  <p className="agri-form-error" id="season-variety-error">
                    {fieldErrors.variety}
                  </p>
                )}
                {!values.crop && (
                  <p className="agri-form-hint">Select a crop to see available varieties.</p>
                )}
              </div>

              {/* Planting Date */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-planting-date">
                  Planting Date <span className="required-star">*</span>
                </label>
                <input
                  aria-describedby={fieldErrors.planting_date ? 'season-planting-date-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.planting_date)}
                  className={`agri-form-input${fieldErrors.planting_date ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-planting-date"
                  onChange={(e) => handleChange('planting_date', e.target.value)}
                  type="date"
                  value={values.planting_date}
                />
                {fieldErrors.planting_date && (
                  <p className="agri-form-error" id="season-planting-date-error">
                    {fieldErrors.planting_date}
                  </p>
                )}
              </div>

              {/* Expected Harvest Date */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-expected-harvest">
                  Expected Harvest Date
                </label>
                <input
                  aria-describedby={fieldErrors.expected_harvest_date ? 'season-expected-harvest-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.expected_harvest_date)}
                  className={`agri-form-input${fieldErrors.expected_harvest_date ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-expected-harvest"
                  onChange={(e) => handleChange('expected_harvest_date', e.target.value)}
                  type="date"
                  value={values.expected_harvest_date}
                />
                {fieldErrors.expected_harvest_date && (
                  <p className="agri-form-error" id="season-expected-harvest-error">
                    {fieldErrors.expected_harvest_date}
                  </p>
                )}
                <p className="agri-form-hint">Must be on or after the planting date.</p>
              </div>

              {/* Actual Harvest Date */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-actual-harvest">
                  Actual Harvest Date
                </label>
                <input
                  aria-describedby={fieldErrors.actual_harvest_date ? 'season-actual-harvest-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.actual_harvest_date)}
                  className={`agri-form-input${fieldErrors.actual_harvest_date ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-actual-harvest"
                  onChange={(e) => handleChange('actual_harvest_date', e.target.value)}
                  type="date"
                  value={values.actual_harvest_date}
                />
                {fieldErrors.actual_harvest_date && (
                  <p className="agri-form-error" id="season-actual-harvest-error">
                    {fieldErrors.actual_harvest_date}
                  </p>
                )}
                <p className="agri-form-hint">Must be on or after the planting date.</p>
              </div>

              {/* Area Planted */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-area-planted">
                  Area Planted (ha)
                </label>
                <input
                  aria-describedby={fieldErrors.area_planted_hectares ? 'season-area-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.area_planted_hectares)}
                  className={`agri-form-input${fieldErrors.area_planted_hectares ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-area-planted"
                  min="0.01"
                  onChange={(e) => handleChange('area_planted_hectares', e.target.value)}
                  placeholder="e.g. 1.50"
                  step="0.01"
                  type="number"
                  value={values.area_planted_hectares}
                />
                {fieldErrors.area_planted_hectares && (
                  <p className="agri-form-error" id="season-area-error">
                    {fieldErrors.area_planted_hectares}
                  </p>
                )}
                {selectedField && (
                  <p className="agri-form-hint">
                    Field area: {parseFloat(selectedField.area_hectares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha. Area planted cannot exceed this.
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-status-select">
                  Status <span className="required-star">*</span>
                </label>
                <select
                  aria-describedby={fieldErrors.status ? 'season-status-error' : undefined}
                  aria-invalid={Boolean(fieldErrors.status)}
                  className={`agri-form-select${fieldErrors.status ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="season-status-select"
                  onChange={(e) => handleChange('status', e.target.value as GrowingSeasonStatus)}
                  value={values.status}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.status && (
                  <p className="agri-form-error" id="season-status-error">
                    {fieldErrors.status}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="season-notes">
                  Notes
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="season-notes"
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Optional notes about this growing season..."
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
                  'Add Season'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
