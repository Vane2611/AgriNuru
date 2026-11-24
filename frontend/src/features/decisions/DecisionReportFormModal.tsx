import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Farm, Field } from '../../services/resources/farmsApi'
import {
  createDecisionReport,
  updateDecisionReport,
  type CropRecommendation,
  type DecisionReport,
  type DecisionReportStatus,
  type ProductionPlan,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  initialReport: DecisionReport | null
  farms: Farm[]
  allFields: Field[]
  recommendations: CropRecommendation[]
  productionPlans: ProductionPlan[]
  onClose: () => void
  onSuccess: (report: DecisionReport) => void
}

type FormValues = {
  selectedFarmId: string
  fieldId: string
  cropRecommendationId: string
  productionPlanId: string
  status: DecisionReportStatus
  summary: string
  recommendationText: string
  assumptionsText: string
  sourcesText: string
  modelVersion: string
  generatedAt: string
}

function deriveInitialValues(
  initialReport: DecisionReport | null,
  allFields: Field[],
): FormValues {
  if (!initialReport) {
    return {
      selectedFarmId: '',
      fieldId: '',
      cropRecommendationId: '',
      productionPlanId: '',
      status: 'draft',
      summary: '',
      recommendationText: '',
      assumptionsText: '',
      sourcesText: '',
      modelVersion: '',
      generatedAt: '',
    }
  }

  const matchingField = allFields.find((f) => f.id === initialReport.field)
  const farmId = matchingField ? String(matchingField.farm) : ''

  const assumptionsText =
    initialReport.assumptions &&
    typeof initialReport.assumptions === 'object' &&
    'text' in initialReport.assumptions &&
    typeof initialReport.assumptions.text === 'string'
      ? initialReport.assumptions.text
      : initialReport.assumptions &&
        Object.keys(initialReport.assumptions).length > 0
      ? JSON.stringify(initialReport.assumptions)
      : ''

  const sourcesText =
    Array.isArray(initialReport.sources) &&
    initialReport.sources.length > 0 &&
    typeof initialReport.sources[0] === 'string'
      ? initialReport.sources[0]
      : ''

  return {
    selectedFarmId: farmId,
    fieldId: String(initialReport.field),
    cropRecommendationId:
      initialReport.crop_recommendation != null
        ? String(initialReport.crop_recommendation)
        : '',
    productionPlanId:
      initialReport.production_plan != null
        ? String(initialReport.production_plan)
        : '',
    status: initialReport.status,
    summary: initialReport.summary,
    recommendationText: initialReport.recommendation_text,
    assumptionsText,
    sourcesText,
    modelVersion: initialReport.model_version,
    generatedAt: initialReport.generated_at
      ? initialReport.generated_at.slice(0, 16)
      : '',
  }
}

export function DecisionReportFormModal({
  isOpen,
  initialReport,
  farms,
  allFields,
  recommendations,
  productionPlans,
  onClose,
  onSuccess,
}: Props) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialReport, allFields),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const farmSelectRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialReport)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialReport, allFields))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialReport, allFields])

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

  const recsForField = values.fieldId
    ? recommendations.filter((r) => String(r.field) === values.fieldId)
    : []

  const plansForField = values.fieldId
    ? productionPlans.filter((p) => String(p.field) === values.fieldId)
    : []

  function handleChange(key: keyof FormValues, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'selectedFarmId') {
        next.fieldId = ''
        next.cropRecommendationId = ''
        next.productionPlanId = ''
      }
      if (key === 'fieldId') {
        next.cropRecommendationId = ''
        next.productionPlanId = ''
      }
      return next
    })
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[key]
      if (key === 'selectedFarmId') {
        delete updated.fieldId
        delete updated.cropRecommendationId
        delete updated.productionPlanId
      }
      if (key === 'fieldId') {
        delete updated.cropRecommendationId
        delete updated.productionPlanId
      }
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    const errors: Record<string, string> = {}
    if (!values.fieldId) errors.fieldId = 'Please select a field.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    setFieldErrors({})
    setGeneralError('')

    try {
      const generatedAtIso =
        values.generatedAt.trim()
          ? values.generatedAt.length === 16
            ? values.generatedAt + ':00.000Z'
            : values.generatedAt
          : null

      const payload = {
        field: parseInt(values.fieldId, 10),
        crop_recommendation: values.cropRecommendationId
          ? parseInt(values.cropRecommendationId, 10)
          : null,
        production_plan: values.productionPlanId
          ? parseInt(values.productionPlanId, 10)
          : null,
        status: values.status,
        summary: values.summary.trim(),
        recommendation_text: values.recommendationText.trim(),
        assumptions: values.assumptionsText.trim()
          ? { text: values.assumptionsText.trim() }
          : {},
        sources: values.sourcesText.trim() ? [values.sourcesText.trim()] : [],
        model_version: values.modelVersion.trim(),
        generated_at: generatedAtIso,
      }

      let result: DecisionReport
      if (isEditing && initialReport) {
        result = await updateDecisionReport(initialReport.id, payload)
      } else {
        result = await createDecisionReport(payload)
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
          setGeneralError(err.message || 'Failed to save the decision report.')
        }
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusOptions: { value: DecisionReportStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'ready', label: 'Ready' },
    { value: 'shared', label: 'Shared' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => { if (!isSubmitting) onClose() }}
      />
      <div
        aria-labelledby="report-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="report-form-modal-title">
              {isEditing ? 'Edit Decision Report' : 'Create Decision Report'}
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
                <label className="agri-form-label" htmlFor="report-farm-select">
                  Farm
                </label>
                <select
                  className="agri-form-select"
                  disabled={isSubmitting}
                  id="report-farm-select"
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
                <label className="agri-form-label" htmlFor="report-field-select">
                  Field <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.fieldId)}
                  className={`agri-form-select${fieldErrors.fieldId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.selectedFarmId}
                  id="report-field-select"
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

              {/* Crop Recommendation */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-rec-select">
                  Linked Crop Recommendation (optional)
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.cropRecommendationId)}
                  className={`agri-form-select${fieldErrors.cropRecommendationId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.fieldId}
                  id="report-rec-select"
                  onChange={(e) => handleChange('cropRecommendationId', e.target.value)}
                  value={values.cropRecommendationId}
                >
                  <option value="">— No linked recommendation —</option>
                  {recsForField.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.generated_at.slice(0, 10)} — {r.status}
                    </option>
                  ))}
                </select>
                {fieldErrors.cropRecommendationId && (
                  <p className="agri-form-error">{fieldErrors.cropRecommendationId}</p>
                )}
              </div>

              {/* Production Plan */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-plan-select">
                  Linked Production Plan (optional)
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.productionPlanId)}
                  className={`agri-form-select${fieldErrors.productionPlanId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.fieldId}
                  id="report-plan-select"
                  onChange={(e) => handleChange('productionPlanId', e.target.value)}
                  value={values.productionPlanId}
                >
                  <option value="">— No linked production plan —</option>
                  {plansForField.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      Plan #{p.id} — {p.status}
                      {p.estimated_cost ? ` — ${p.estimated_cost} ${p.currency}` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.productionPlanId && (
                  <p className="agri-form-error">{fieldErrors.productionPlanId}</p>
                )}
              </div>

              {/* Status */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-status-select">
                  Status <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.status)}
                  className={`agri-form-select${fieldErrors.status ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="report-status-select"
                  onChange={(e) =>
                    handleChange('status', e.target.value as DecisionReportStatus)
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

              {/* Summary */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-summary">
                  Summary
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="report-summary"
                  onChange={(e) => handleChange('summary', e.target.value)}
                  placeholder="Summarise the key factors considered in this decision."
                  rows={3}
                  value={values.summary}
                />
              </div>

              {/* Recommendation Text */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-rec-text">
                  Recommendation
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="report-rec-text"
                  onChange={(e) => handleChange('recommendationText', e.target.value)}
                  placeholder="State the recommendation and explain the reasoning."
                  rows={3}
                  value={values.recommendationText}
                />
              </div>

              {/* Assumptions */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-assumptions">
                  Assumptions
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="report-assumptions"
                  onChange={(e) => handleChange('assumptionsText', e.target.value)}
                  placeholder="Describe any assumptions used in this report..."
                  rows={2}
                  value={values.assumptionsText}
                />
              </div>

              {/* Sources */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-sources">
                  Sources
                </label>
                <input
                  className="agri-form-input"
                  disabled={isSubmitting}
                  id="report-sources"
                  onChange={(e) => handleChange('sourcesText', e.target.value)}
                  placeholder="e.g. County extension office"
                  type="text"
                  value={values.sourcesText}
                />
              </div>

              {/* Model Version */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-model-version">
                  Model Version
                </label>
                <input
                  className="agri-form-input"
                  disabled={isSubmitting}
                  id="report-model-version"
                  onChange={(e) => handleChange('modelVersion', e.target.value)}
                  placeholder="Leave blank"
                  type="text"
                  value={values.modelVersion}
                />
                <p className="agri-form-hint">
                  Leave blank unless a versioned model contributed to this report.
                </p>
              </div>

              {/* Generated At */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="report-generated-at">
                  Generated At
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.generatedAt)}
                  className={`agri-form-input${fieldErrors.generatedAt ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="report-generated-at"
                  onChange={(e) => handleChange('generatedAt', e.target.value)}
                  type="datetime-local"
                  value={values.generatedAt}
                />
                {fieldErrors.generatedAt && (
                  <p className="agri-form-error">{fieldErrors.generatedAt}</p>
                )}
                <p className="agri-form-hint">
                  Only fill if this report was produced by an automated process.
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
                  'Create Report'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
