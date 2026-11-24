import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Crop, CropVariety } from '../../services/resources/cropsApi'
import type { Farm, Field } from '../../services/resources/farmsApi'
import {
  createRecommendation,
  updateRecommendation,
  type CropRecommendation,
  type CropRecommendationStatus,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  initialRec: CropRecommendation | null
  farms: Farm[]
  allFields: Field[]
  crops: Crop[]
  allVarieties: CropVariety[]
  onClose: () => void
  onSuccess: (rec: CropRecommendation) => void
}

type FormValues = {
  selectedFarmId: string
  fieldId: string
  cropId: string
  varietyId: string
  generatedAt: string
  status: CropRecommendationStatus
  suitabilityScore: string
  explanation: string
  uncertaintyNotes: string
  assumptionsText: string
  sourceRefText: string
  modelVersion: string
}

function deriveInitialValues(
  initialRec: CropRecommendation | null,
  allFields: Field[],
): FormValues {
  if (!initialRec) {
    return {
      selectedFarmId: '',
      fieldId: '',
      cropId: '',
      varietyId: '',
      generatedAt: new Date().toISOString().slice(0, 16),
      status: 'generated',
      suitabilityScore: '',
      explanation: '',
      uncertaintyNotes: '',
      assumptionsText: '',
      sourceRefText: '',
      modelVersion: '',
    }
  }

  const matchingField = allFields.find((f) => f.id === initialRec.field)
  const farmId = matchingField ? String(matchingField.farm) : ''

  const assumptionsText =
    initialRec.assumptions &&
    typeof initialRec.assumptions === 'object' &&
    'text' in initialRec.assumptions &&
    typeof initialRec.assumptions.text === 'string'
      ? initialRec.assumptions.text
      : initialRec.assumptions && Object.keys(initialRec.assumptions).length > 0
      ? JSON.stringify(initialRec.assumptions)
      : ''

  const sourceRefText =
    Array.isArray(initialRec.source_reference) &&
    initialRec.source_reference.length > 0 &&
    typeof initialRec.source_reference[0] === 'string'
      ? initialRec.source_reference[0]
      : ''

  return {
    selectedFarmId: farmId,
    fieldId: String(initialRec.field),
    cropId: String(initialRec.crop),
    varietyId: initialRec.variety != null ? String(initialRec.variety) : '',
    generatedAt: initialRec.generated_at.slice(0, 16),
    status: initialRec.status,
    suitabilityScore: initialRec.suitability_score ?? '',
    explanation: initialRec.explanation,
    uncertaintyNotes: initialRec.uncertainty_notes,
    assumptionsText,
    sourceRefText,
    modelVersion: initialRec.model_version,
  }
}

export function RecommendationFormModal({
  isOpen,
  initialRec,
  farms,
  allFields,
  crops,
  allVarieties,
  onClose,
  onSuccess,
}: Props) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialRec, allFields),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const farmSelectRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialRec)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialRec, allFields))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialRec, allFields])

  useEffect(() => {
    if (isOpen) {
      farmSelectRef.current?.focus()
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

  if (!isOpen) return null

  const fieldsForFarm = values.selectedFarmId
    ? allFields.filter((f) => String(f.farm) === values.selectedFarmId)
    : []

  const varietiesForCrop = values.cropId
    ? allVarieties.filter((v) => String(v.crop) === values.cropId)
    : []

  function handleChange(key: keyof FormValues, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'selectedFarmId') {
        next.fieldId = ''
      }
      if (key === 'cropId') {
        next.varietyId = ''
      }
      return next
    })
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[key]
      if (key === 'selectedFarmId') delete updated.fieldId
      if (key === 'cropId') delete updated.varietyId
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const errors: Record<string, string> = {}

    if (!values.fieldId) errors.fieldId = 'Please select a field.'
    if (!values.cropId) errors.cropId = 'Please select a crop.'
    if (!values.generatedAt) errors.generatedAt = 'Generated at date/time is required.'

    if (values.suitabilityScore.trim()) {
      const score = parseFloat(values.suitabilityScore)
      if (isNaN(score) || score < 0 || score > 100) {
        errors.suitabilityScore = 'Suitability score must be a number between 0 and 100.'
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
      const generatedAtIso =
        values.generatedAt.length === 16
          ? values.generatedAt + ':00.000Z'
          : values.generatedAt

      const payload = {
        field: parseInt(values.fieldId, 10),
        crop: parseInt(values.cropId, 10),
        variety: values.varietyId ? parseInt(values.varietyId, 10) : null,
        generated_at: generatedAtIso,
        status: values.status,
        suitability_score: values.suitabilityScore.trim() || null,
        explanation: values.explanation.trim(),
        uncertainty_notes: values.uncertaintyNotes.trim(),
        assumptions: values.assumptionsText.trim()
          ? { text: values.assumptionsText.trim() }
          : {},
        source_reference: values.sourceRefText.trim()
          ? [values.sourceRefText.trim()]
          : [],
        model_version: values.modelVersion.trim(),
      }

      let result: CropRecommendation
      if (isEditing && initialRec) {
        result = await updateRecommendation(initialRec.id, payload)
      } else {
        result = await createRecommendation(payload)
      }

      onSuccess(result)
      onClose()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const nextErrors: Record<string, string> = {}
        for (const [key, msgs] of Object.entries(err.fields)) {
          if (msgs.length > 0) nextErrors[key] = msgs[0]
        }
        setFieldErrors(nextErrors)
        if (err.detail) {
          setGeneralError(err.detail)
        } else if (Object.keys(nextErrors).length === 0) {
          setGeneralError(err.message || 'Failed to save the recommendation.')
        }
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusOptions: { value: CropRecommendationStatus; label: string }[] = [
    { value: 'generated', label: 'Generated' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'superseded', label: 'Superseded' },
  ]

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => { if (!isSubmitting) onClose() }}
      />
      <div
        aria-labelledby="rec-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="rec-form-modal-title">
              {isEditing ? 'Edit Crop Recommendation' : 'Add Crop Recommendation'}
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

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="agri-modal-body">
              {generalError && (
                <div className="farms-alert" role="alert">
                  <i aria-hidden="true" className="bi bi-exclamation-triangle-fill" />
                  <div className="farms-alert-content">{generalError}</div>
                </div>
              )}

              {/* Farm */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-farm-select">
                  Farm
                </label>
                <select
                  className="agri-form-select"
                  disabled={isSubmitting}
                  id="rec-farm-select"
                  onChange={(e) => handleChange('selectedFarmId', e.target.value)}
                  ref={farmSelectRef}
                  value={values.selectedFarmId}
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
                <label className="agri-form-label" htmlFor="rec-field-select">
                  Field <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.fieldId)}
                  className={`agri-form-select${fieldErrors.fieldId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.selectedFarmId}
                  id="rec-field-select"
                  onChange={(e) => handleChange('fieldId', e.target.value)}
                  value={values.fieldId}
                >
                  <option value="">
                    {values.selectedFarmId ? '— Select a field —' : '— Select a farm first —'}
                  </option>
                  {fieldsForFarm.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.fieldId && (
                  <p className="agri-form-error">{fieldErrors.fieldId}</p>
                )}
              </div>

              {/* Crop */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-crop-select">
                  Crop <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.cropId)}
                  className={`agri-form-select${fieldErrors.cropId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="rec-crop-select"
                  onChange={(e) => handleChange('cropId', e.target.value)}
                  value={values.cropId}
                >
                  <option value="">— Select a crop —</option>
                  {crops.map((crop) => (
                    <option key={crop.id} value={String(crop.id)}>
                      {crop.common_name}
                    </option>
                  ))}
                </select>
                {fieldErrors.cropId && (
                  <p className="agri-form-error">{fieldErrors.cropId}</p>
                )}
              </div>

              {/* Variety */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-variety-select">
                  Variety
                </label>
                <select
                  className="agri-form-select"
                  disabled={isSubmitting || !values.cropId}
                  id="rec-variety-select"
                  onChange={(e) => handleChange('varietyId', e.target.value)}
                  value={values.varietyId}
                >
                  <option value="">— No specific variety —</option>
                  {varietiesForCrop.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}
                      {v.maturity_days != null ? ` (${v.maturity_days} days)` : ''}
                    </option>
                  ))}
                </select>
                {!values.cropId && (
                  <p className="agri-form-hint">Select a crop to see available varieties.</p>
                )}
              </div>

              {/* Generated At */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-generated-at">
                  Generated At <span className="required-star">*</span>
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.generatedAt)}
                  className={`agri-form-input${fieldErrors.generatedAt ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="rec-generated-at"
                  onChange={(e) => handleChange('generatedAt', e.target.value)}
                  type="datetime-local"
                  value={values.generatedAt}
                />
                {fieldErrors.generatedAt && (
                  <p className="agri-form-error">{fieldErrors.generatedAt}</p>
                )}
              </div>

              {/* Status */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-status-select">
                  Status <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.status)}
                  className={`agri-form-select${fieldErrors.status ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="rec-status-select"
                  onChange={(e) =>
                    handleChange('status', e.target.value as CropRecommendationStatus)
                  }
                  value={values.status}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.status && (
                  <p className="agri-form-error">{fieldErrors.status}</p>
                )}
              </div>

              {/* Suitability Score */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-suitability-score">
                  Suitability Score (0–100)
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.suitabilityScore)}
                  className={`agri-form-input${fieldErrors.suitabilityScore ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="rec-suitability-score"
                  max="100"
                  min="0"
                  onChange={(e) => handleChange('suitabilityScore', e.target.value)}
                  placeholder="Leave blank"
                  step="0.01"
                  type="number"
                  value={values.suitabilityScore}
                />
                {fieldErrors.suitabilityScore && (
                  <p className="agri-form-error">{fieldErrors.suitabilityScore}</p>
                )}
                <p className="agri-form-hint">
                  Enter only if you have a documented score. Do not estimate.
                </p>
              </div>

              {/* Explanation */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-explanation">
                  Explanation
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="rec-explanation"
                  onChange={(e) => handleChange('explanation', e.target.value)}
                  placeholder="Describe the basis for this recommendation..."
                  rows={3}
                  value={values.explanation}
                />
              </div>

              {/* Assumptions */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-assumptions">
                  Assumptions
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="rec-assumptions"
                  onChange={(e) => handleChange('assumptionsText', e.target.value)}
                  placeholder="Describe any assumptions made..."
                  rows={2}
                  value={values.assumptionsText}
                />
              </div>

              {/* Source Reference */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-source-ref">
                  Source Reference
                </label>
                <input
                  className="agri-form-input"
                  disabled={isSubmitting}
                  id="rec-source-ref"
                  onChange={(e) => handleChange('sourceRefText', e.target.value)}
                  placeholder="e.g. Kenya Agricultural Research Institute (KARI)"
                  type="text"
                  value={values.sourceRefText}
                />
              </div>

              {/* Uncertainty Notes */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-uncertainty-notes">
                  Uncertainty Notes
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="rec-uncertainty-notes"
                  onChange={(e) => handleChange('uncertaintyNotes', e.target.value)}
                  placeholder="Note any uncertainty or limitations in this recommendation..."
                  rows={2}
                  value={values.uncertaintyNotes}
                />
              </div>

              {/* Model Version */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="rec-model-version">
                  Model Version
                </label>
                <input
                  className="agri-form-input"
                  disabled={isSubmitting}
                  id="rec-model-version"
                  onChange={(e) => handleChange('modelVersion', e.target.value)}
                  placeholder="Leave blank"
                  type="text"
                  value={values.modelVersion}
                />
                <p className="agri-form-hint">
                  Leave blank unless a versioned model generated this.
                </p>
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
                  'Add Recommendation'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
