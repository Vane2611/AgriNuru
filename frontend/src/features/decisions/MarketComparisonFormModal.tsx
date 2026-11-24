import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError } from '../../services/resources/authApi'
import type { Crop } from '../../services/resources/cropsApi'
import type { Market, MarketPrice, MarketPriceObservation } from '../../services/resources/marketsApi'
import {
  createMarketComparison,
  updateMarketComparison,
  type DecisionReport,
  type MarketComparison,
  type ProductionPlan,
} from '../../services/resources/decisionsApi'

type Props = {
  isOpen: boolean
  initialComparison: MarketComparison | null
  reports: DecisionReport[]
  productionPlans: ProductionPlan[]
  markets: Market[]
  priceSeries: MarketPrice[]
  observations: MarketPriceObservation[]
  crops: Crop[]
  onClose: () => void
  onSuccess: (mc: MarketComparison) => void
}

type FormValues = {
  decisionReportId: string
  productionPlanId: string
  marketId: string
  priceSeriesId: string
  observationId: string
  quantity: string
  estimatedTransportCost: string
  comparisonDate: string
  uncertaintyNotes: string
  assumptionsText: string
}

function deriveInitialValues(
  initialComparison: MarketComparison | null,
  priceSeries: MarketPrice[],
  observations: MarketPriceObservation[],
): FormValues {
  if (!initialComparison) {
    return {
      decisionReportId: '',
      productionPlanId: '',
      marketId: '',
      priceSeriesId: '',
      observationId: '',
      quantity: '',
      estimatedTransportCost: '',
      comparisonDate: new Date().toISOString().slice(0, 16),
      uncertaintyNotes: '',
      assumptionsText: '',
    }
  }

  const obs = observations.find((o) => o.id === initialComparison.price_observation)
  const series = obs ? priceSeries.find((s) => s.id === obs.market_price) : undefined

  const assumptionsText =
    initialComparison.assumptions &&
    typeof initialComparison.assumptions === 'object' &&
    'text' in initialComparison.assumptions &&
    typeof initialComparison.assumptions.text === 'string'
      ? initialComparison.assumptions.text
      : initialComparison.assumptions &&
        Object.keys(initialComparison.assumptions).length > 0
      ? JSON.stringify(initialComparison.assumptions)
      : ''

  return {
    decisionReportId: String(initialComparison.decision_report),
    productionPlanId:
      initialComparison.production_plan != null
        ? String(initialComparison.production_plan)
        : '',
    marketId: series ? String(series.market) : '',
    priceSeriesId: obs ? String(obs.market_price) : '',
    observationId: String(initialComparison.price_observation),
    quantity: initialComparison.quantity,
    estimatedTransportCost: initialComparison.estimated_transport_cost ?? '',
    comparisonDate: initialComparison.comparison_date.slice(0, 16),
    uncertaintyNotes: initialComparison.uncertainty_notes,
    assumptionsText,
  }
}

export function MarketComparisonFormModal({
  isOpen,
  initialComparison,
  reports,
  productionPlans,
  markets,
  priceSeries,
  observations,
  crops,
  onClose,
  onSuccess,
}: Props) {
  const [values, setValues] = useState<FormValues>(() =>
    deriveInitialValues(initialComparison, priceSeries, observations),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const reportSelectRef = useRef<HTMLSelectElement>(null)
  const isEditing = Boolean(initialComparison)

  useEffect(() => {
    if (isOpen) {
      setValues(deriveInitialValues(initialComparison, priceSeries, observations))
      setFieldErrors({})
      setGeneralError('')
      setIsSubmitting(false)
    }
  }, [isOpen, initialComparison, priceSeries, observations])

  useEffect(() => {
    if (isOpen) {
      reportSelectRef.current?.focus()
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

  // Derived / computed values
  const selectedObservation =
    values.observationId
      ? observations.find((o) => String(o.id) === values.observationId) ?? null
      : null

  const selectedSeries =
    values.priceSeriesId
      ? priceSeries.find((s) => String(s.id) === values.priceSeriesId) ?? null
      : null

  const currency = selectedObservation?.currency ?? ''

  const qtyNum = parseFloat(values.quantity)
  const priceNum = parseFloat(selectedObservation?.price ?? '')
  const grossSalesValue =
    !isNaN(qtyNum) && !isNaN(priceNum) && qtyNum > 0 ? qtyNum * priceNum : null

  const transportNum = values.estimatedTransportCost.trim()
    ? parseFloat(values.estimatedTransportCost)
    : null
  const netReturn =
    grossSalesValue !== null &&
    transportNum !== null &&
    !isNaN(transportNum)
      ? grossSalesValue - transportNum
      : null

  // Filtered lists
  const seriesForMarket = values.marketId
    ? priceSeries.filter((s) => String(s.market) === values.marketId)
    : []

  const observationsForSeries = values.priceSeriesId
    ? observations.filter((o) => String(o.market_price) === values.priceSeriesId)
    : []

  const selectedReport = values.decisionReportId
    ? reports.find((r) => String(r.id) === values.decisionReportId) ?? null
    : null

  const plansForReport = selectedReport
    ? productionPlans.filter((p) => p.field === selectedReport.field)
    : []

  function handleChange(key: keyof FormValues, value: string) {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'marketId') {
        next.priceSeriesId = ''
        next.observationId = ''
      }
      if (key === 'priceSeriesId') {
        next.observationId = ''
      }
      if (key === 'decisionReportId') {
        next.productionPlanId = ''
      }
      return next
    })
    setFieldErrors((prev) => {
      const updated = { ...prev }
      delete updated[key]
      if (key === 'marketId') {
        delete updated.priceSeriesId
        delete updated.observationId
      }
      if (key === 'priceSeriesId') delete updated.observationId
      return updated
    })
    setGeneralError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isSubmitting) return

    if (!selectedObservation) {
      setGeneralError('Please select a price observation before submitting.')
      return
    }

    const errors: Record<string, string> = {}

    if (!values.decisionReportId) errors.decisionReportId = 'Please select a decision report.'
    if (!values.observationId) errors.observationId = 'Please select a price observation.'
    if (!values.quantity.trim()) {
      errors.quantity = 'Quantity is required.'
    } else {
      const qty = parseFloat(values.quantity)
      if (isNaN(qty) || qty <= 0) {
        errors.quantity = 'Quantity must be a positive number.'
      }
    }
    if (!values.comparisonDate) errors.comparisonDate = 'Comparison date is required.'

    if (values.estimatedTransportCost.trim()) {
      const tc = parseFloat(values.estimatedTransportCost)
      if (isNaN(tc) || tc < 0) {
        errors.estimatedTransportCost = 'Transport cost must be a non-negative number.'
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
      const comparisonDateIso =
        values.comparisonDate.length === 16
          ? values.comparisonDate + ':00.000Z'
          : values.comparisonDate

      const payload = {
        decision_report: parseInt(values.decisionReportId, 10),
        production_plan: values.productionPlanId
          ? parseInt(values.productionPlanId, 10)
          : null,
        price_observation: parseInt(values.observationId, 10),
        comparison_date: comparisonDateIso,
        quantity: parseFloat(values.quantity).toString(),
        estimated_gross_sales_value:
          grossSalesValue !== null
            ? grossSalesValue.toFixed(2)
            : null,
        estimated_transport_cost:
          transportNum !== null && !isNaN(transportNum)
            ? transportNum.toFixed(2)
            : null,
        currency: selectedObservation.currency,
        assumptions: values.assumptionsText.trim()
          ? { text: values.assumptionsText.trim() }
          : {},
        uncertainty_notes: values.uncertaintyNotes.trim(),
      }

      let result: MarketComparison
      if (isEditing && initialComparison) {
        result = await updateMarketComparison(initialComparison.id, payload)
      } else {
        result = await createMarketComparison(payload)
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
          setGeneralError(err.message || 'Failed to save the market comparison.')
        }
      } else {
        setGeneralError('An unexpected network error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function getCropNameForSeries(series: MarketPrice | null): string {
    if (!series) return ''
    return crops.find((c) => c.id === series.crop)?.common_name ?? 'Unknown crop'
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="agri-modal-backdrop"
        onClick={() => { if (!isSubmitting) onClose() }}
      />
      <div
        aria-labelledby="comparison-form-modal-title"
        aria-modal="true"
        className="agri-modal"
        role="dialog"
      >
        <div className="agri-modal-dialog">
          <div className="agri-modal-header">
            <h4 id="comparison-form-modal-title">
              {isEditing ? 'Edit Market Comparison' : 'Add Market Comparison'}
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

              {/* Decision Report */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-report-select">
                  Decision Report <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.decisionReportId)}
                  className={`agri-form-select${fieldErrors.decisionReportId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="mc-report-select"
                  onChange={(e) => handleChange('decisionReportId', e.target.value)}
                  ref={reportSelectRef}
                  value={values.decisionReportId}
                >
                  <option value="">— Select a report —</option>
                  {reports.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      Report #{r.id} — {r.status}
                    </option>
                  ))}
                </select>
                {fieldErrors.decisionReportId && (
                  <p className="agri-form-error">{fieldErrors.decisionReportId}</p>
                )}
              </div>

              {/* Production Plan */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-plan-select">
                  Production Plan (optional)
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.productionPlanId)}
                  className={`agri-form-select${fieldErrors.productionPlanId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.decisionReportId}
                  id="mc-plan-select"
                  onChange={(e) => handleChange('productionPlanId', e.target.value)}
                  value={values.productionPlanId}
                >
                  <option value="">— No linked production plan —</option>
                  {plansForReport.map((p) => (
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

              {/* Market */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-market-select">
                  Market <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.marketId)}
                  className={`agri-form-select${fieldErrors.marketId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="mc-market-select"
                  onChange={(e) => handleChange('marketId', e.target.value)}
                  value={values.marketId}
                >
                  <option value="">— Select a market —</option>
                  {markets.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name} ({m.county})
                    </option>
                  ))}
                </select>
                {fieldErrors.marketId && (
                  <p className="agri-form-error">{fieldErrors.marketId}</p>
                )}
              </div>

              {/* Price Series */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-series-select">
                  Price Series
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.priceSeriesId)}
                  className={`agri-form-select${fieldErrors.priceSeriesId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.marketId}
                  id="mc-series-select"
                  onChange={(e) => handleChange('priceSeriesId', e.target.value)}
                  value={values.priceSeriesId}
                >
                  <option value="">
                    {values.marketId ? '— Select a price series —' : '— Select a market first —'}
                  </option>
                  {seriesForMarket.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {getCropNameForSeries(s)} per {s.quantity_unit}
                    </option>
                  ))}
                </select>
                {fieldErrors.priceSeriesId && (
                  <p className="agri-form-error">{fieldErrors.priceSeriesId}</p>
                )}
              </div>

              {/* Observation */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-obs-select">
                  Price Observation <span className="required-star">*</span>
                </label>
                <select
                  aria-invalid={Boolean(fieldErrors.observationId)}
                  className={`agri-form-select${fieldErrors.observationId ? ' is-invalid' : ''}`}
                  disabled={isSubmitting || !values.priceSeriesId}
                  id="mc-obs-select"
                  onChange={(e) => handleChange('observationId', e.target.value)}
                  value={values.observationId}
                >
                  <option value="">
                    {values.priceSeriesId
                      ? '— Select an observation —'
                      : '— Select a price series first —'}
                  </option>
                  {observationsForSeries.map((o) => (
                    <option key={o.id} value={String(o.id)}>
                      {o.observation_date} — {o.price} {o.currency}
                      {o.grade ? ` (${o.grade})` : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.observationId && (
                  <p className="agri-form-error">{fieldErrors.observationId}</p>
                )}
                {selectedObservation?.source_name && (
                  <p className="agri-form-hint">
                    Source: {selectedObservation.source_name}
                    {selectedObservation.source_reference
                      ? ` — ${selectedObservation.source_reference}`
                      : ''}
                  </p>
                )}
              </div>

              {/* Currency (derived read-only) */}
              {currency && (
                <div className="agri-form-group">
                  <label className="agri-form-label">Currency</label>
                  <div
                    className="decisions-computed-section"
                    style={{ padding: '8px 12px' }}
                  >
                    {currency} (derived from price observation — cannot be changed)
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-quantity">
                  Quantity
                  {selectedSeries ? ` (${selectedSeries.quantity_unit})` : ''}
                  {' '}<span className="required-star">*</span>
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className={`agri-form-input${fieldErrors.quantity ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="mc-quantity"
                  min="0.001"
                  onChange={(e) => handleChange('quantity', e.target.value)}
                  placeholder="Enter quantity"
                  step="0.001"
                  type="number"
                  value={values.quantity}
                />
                {fieldErrors.quantity && (
                  <p className="agri-form-error">{fieldErrors.quantity}</p>
                )}
              </div>

              {/* Estimated Transport Cost */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-transport-cost">
                  Estimated Transport Cost {currency ? `(${currency})` : ''}
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.estimatedTransportCost)}
                  className={`agri-form-input${fieldErrors.estimatedTransportCost ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="mc-transport-cost"
                  min="0"
                  onChange={(e) => handleChange('estimatedTransportCost', e.target.value)}
                  placeholder="Leave blank if unknown"
                  step="0.01"
                  type="number"
                  value={values.estimatedTransportCost}
                />
                {fieldErrors.estimatedTransportCost && (
                  <p className="agri-form-error">{fieldErrors.estimatedTransportCost}</p>
                )}
                <p className="agri-form-hint">
                  Leave blank if transport cost is unknown — do not enter 0 as a substitute for unknown cost.
                </p>
              </div>

              {/* Computed section */}
              {(grossSalesValue !== null || selectedObservation) && (
                <div className="decisions-computed-section">
                  {grossSalesValue !== null && (
                    <div className="decisions-computed-row">
                      <span>Estimated gross sales value:</span>
                      <strong>
                        {grossSalesValue.toFixed(2)} {currency}
                      </strong>
                    </div>
                  )}
                  {grossSalesValue !== null && selectedObservation && (
                    <div
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--app-muted)',
                        marginBottom: '6px',
                      }}
                    >
                      = {values.quantity} × {selectedObservation.price} {currency}
                    </div>
                  )}
                  {netReturn !== null && (
                    <div className="decisions-computed-row">
                      <span>Estimated net return after transport:</span>
                      <strong>
                        {netReturn.toFixed(2)} {currency}
                      </strong>
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11.5px',
                      color: 'var(--app-muted)',
                    }}
                  >
                    Gross sales value is estimated. Transport cost is an estimate.
                    Net return does not include production costs or other expenses.
                    {!values.estimatedTransportCost.trim() && (
                      <> Transport cost not entered — net return cannot be calculated.</>
                    )}
                  </div>
                </div>
              )}

              {/* Comparison Date */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-comparison-date">
                  Comparison Date <span className="required-star">*</span>
                </label>
                <input
                  aria-invalid={Boolean(fieldErrors.comparisonDate)}
                  className={`agri-form-input${fieldErrors.comparisonDate ? ' is-invalid' : ''}`}
                  disabled={isSubmitting}
                  id="mc-comparison-date"
                  onChange={(e) => handleChange('comparisonDate', e.target.value)}
                  type="datetime-local"
                  value={values.comparisonDate}
                />
                {fieldErrors.comparisonDate && (
                  <p className="agri-form-error">{fieldErrors.comparisonDate}</p>
                )}
              </div>

              {/* Assumptions */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-assumptions">
                  Assumptions
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="mc-assumptions"
                  onChange={(e) => handleChange('assumptionsText', e.target.value)}
                  placeholder="Describe any assumptions used in this comparison..."
                  rows={2}
                  value={values.assumptionsText}
                />
              </div>

              {/* Uncertainty Notes */}
              <div className="agri-form-group">
                <label className="agri-form-label" htmlFor="mc-uncertainty-notes">
                  Uncertainty Notes
                </label>
                <textarea
                  className="agri-form-textarea"
                  disabled={isSubmitting}
                  id="mc-uncertainty-notes"
                  onChange={(e) => handleChange('uncertaintyNotes', e.target.value)}
                  placeholder={
                    !values.estimatedTransportCost.trim()
                      ? 'Transport cost not entered — net return cannot be calculated.'
                      : 'Note any uncertainty in this market comparison...'
                  }
                  rows={2}
                  value={values.uncertaintyNotes}
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
                  'Add Comparison'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
