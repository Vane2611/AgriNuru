import { useCallback, useEffect, useRef, useState } from 'react'

import {
  listFarms,
  listFields,
  type Farm,
  type Field,
} from '../../services/resources/farmsApi'
import {
  listCrops,
  listVarieties,
  type Crop,
  type CropVariety,
} from '../../services/resources/cropsApi'
import {
  listGrowingSeasons,
  type GrowingSeason,
} from '../../services/resources/growingSeasonsApi'
import {
  listMarkets,
  listPriceSeries,
  listObservations,
  type Market,
  type MarketPrice,
  type MarketPriceObservation,
} from '../../services/resources/marketsApi'
import {
  listRecommendations,
  listProductionPlans,
  listMarketComparisons,
  listDecisionReports,
  getMlStatus,
  type CropRecommendation,
  type ProductionPlan,
  type MarketComparison,
  type DecisionReport,
  type MlStatus,
} from '../../services/resources/decisionsApi'

import { RecommendationFormModal } from './RecommendationFormModal'
import { RecommendationDeleteModal } from './RecommendationDeleteModal'
import { ProductionPlanFormModal } from './ProductionPlanFormModal'
import { ProductionPlanDeleteModal } from './ProductionPlanDeleteModal'
import { MarketComparisonFormModal } from './MarketComparisonFormModal'
import { MarketComparisonDeleteModal } from './MarketComparisonDeleteModal'
import { DecisionReportFormModal } from './DecisionReportFormModal'
import { DecisionReportDeleteModal } from './DecisionReportDeleteModal'

import type {
  DecisionTab,
  RecommendationModalState,
  PlanModalState,
  ComparisonModalState,
  ReportModalState,
} from './types'

import './decisions-page.css'
import '../farms/farms-page.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCropName(cropId: number, crops: Crop[]): string {
  return crops.find((c) => c.id === cropId)?.common_name ?? 'Unknown crop'
}

function getVarietyName(
  varietyId: number | null,
  varieties: CropVariety[],
): string | null {
  if (varietyId == null) return null
  return varieties.find((v) => v.id === varietyId)?.name ?? null
}

function getFieldName(fieldId: number, allFields: Field[]): string {
  return allFields.find((f) => f.id === fieldId)?.name ?? 'Unknown field'
}

function getFarmName(fieldId: number, allFields: Field[], farms: Farm[]): string {
  const field = allFields.find((f) => f.id === fieldId)
  if (!field) return 'Unknown farm'
  return farms.find((farm) => farm.id === field.farm)?.name ?? 'Unknown farm'
}

function getMarketName(
  priceSeriesId: number,
  priceSeries: MarketPrice[],
  markets: Market[],
): string {
  const series = priceSeries.find((s) => s.id === priceSeriesId)
  if (!series) return 'Unknown market'
  return markets.find((m) => m.id === series.market)?.name ?? 'Unknown market'
}

function getCropNameForSeries(
  priceSeriesId: number,
  priceSeries: MarketPrice[],
  crops: Crop[],
): string {
  const series = priceSeries.find((s) => s.id === priceSeriesId)
  if (!series) return 'Unknown crop'
  return getCropName(series.crop, crops)
}

function getSeriesForObservation(
  observationId: number,
  observations: MarketPriceObservation[],
  priceSeries: MarketPrice[],
): MarketPrice | null {
  const obs = observations.find((o) => o.id === observationId)
  if (!obs) return null
  return priceSeries.find((s) => s.id === obs.market_price) ?? null
}

function formatDecimal(value: string | null, decimals = 2): string {
  if (value == null) return '—'
  const num = parseFloat(value)
  if (isNaN(num)) return '—'
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return isoString
  }
}

function statusBadgeClass(status: string): string {
  const normalized = status.replace(/_/g, '-')
  return `decisions-status-badge decisions-status--${normalized}`
}

// ---------------------------------------------------------------------------
// DecisionsPage
// ---------------------------------------------------------------------------

export function DecisionsPage() {
  // ── Data ─────────────────────────────────────────────────────────────────
  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([])
  const [plans, setPlans] = useState<ProductionPlan[]>([])
  const [comparisons, setComparisons] = useState<MarketComparison[]>([])
  const [reports, setReports] = useState<DecisionReport[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [allFields, setAllFields] = useState<Field[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [allVarieties, setAllVarieties] = useState<CropVariety[]>([])
  const [growingSeasons, setGrowingSeasons] = useState<GrowingSeason[]>([])
  const [markets, setMarkets] = useState<Market[]>([])
  const [allPriceSeries, setAllPriceSeries] = useState<MarketPrice[]>([])
  const [allObservations, setAllObservations] = useState<MarketPriceObservation[]>([])
  const [mlStatus, setMlStatus] = useState<MlStatus | null>(null)

  // ── Page state ────────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DecisionTab>('recommendations')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectedRecId, setSelectedRecId] = useState<number | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [selectedComparisonId, setSelectedComparisonId] = useState<number | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)

  // ── Modal state ───────────────────────────────────────────────────────────
  const [recModalState, setRecModalState] = useState<RecommendationModalState>({
    type: 'none',
  })
  const [planModalState, setPlanModalState] = useState<PlanModalState>({
    type: 'none',
  })
  const [comparisonModalState, setComparisonModalState] =
    useState<ComparisonModalState>({ type: 'none' })
  const [reportModalState, setReportModalState] = useState<ReportModalState>({
    type: 'none',
  })

  const isMountedRef = useRef(true)

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  const loadPageData = useCallback(async () => {
    setPageLoading(true)
    setPageError(null)

    try {
      const [
        fetchedRecs,
        fetchedPlans,
        fetchedComparisons,
        fetchedReports,
        fetchedFarms,
        fetchedCrops,
        fetchedVarieties,
        fetchedSeasons,
        fetchedMarkets,
        fetchedPriceSeries,
        fetchedObservations,
        fetchedMlStatus,
      ] = await Promise.all([
        listRecommendations(),
        listProductionPlans(),
        listMarketComparisons(),
        listDecisionReports(),
        listFarms(),
        listCrops(),
        listVarieties(),
        listGrowingSeasons(),
        listMarkets(),
        listPriceSeries(),
        listObservations(),
        getMlStatus().catch(() => null),
      ])

      if (!isMountedRef.current) return

      // Load fields per farm
      const fieldArrays = await Promise.all(
        fetchedFarms.map((farm) =>
          listFields(farm.id).catch(() => [] as Field[]),
        ),
      )

      if (!isMountedRef.current) return

      setRecommendations(fetchedRecs)
      setPlans(fetchedPlans)
      setComparisons(fetchedComparisons)
      setReports(fetchedReports)
      setFarms(fetchedFarms)
      setAllFields(fieldArrays.flat())
      setCrops(fetchedCrops)
      setAllVarieties(fetchedVarieties)
      setGrowingSeasons(fetchedSeasons)
      setMarkets(fetchedMarkets)
      setAllPriceSeries(fetchedPriceSeries)
      setAllObservations(fetchedObservations)
      setMlStatus(fetchedMlStatus)
      setPageLoading(false)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      setPageLoading(false)
      setPageError(
        err instanceof Error
          ? err.message
          : 'Could not load decision data. Check your connection and try again.',
      )
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    void loadPageData()
    return () => {
      isMountedRef.current = false
    }
  }, [loadPageData])

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  function handleRecommendationSuccess(rec: CropRecommendation) {
    setRecommendations((prev) => {
      const existing = prev.find((r) => r.id === rec.id)
      if (existing) return prev.map((r) => (r.id === rec.id ? rec : r))
      return [...prev, rec]
    })
    setSelectedRecId(rec.id)
    setSuccessMessage(
      recModalState.type === 'editRec' ? 'Recommendation updated.' : 'Recommendation added.',
    )
    setRecModalState({ type: 'none' })
  }

  function handleRecommendationDeleted(id: number) {
    setRecommendations((prev) => prev.filter((r) => r.id !== id))
    if (selectedRecId === id) setSelectedRecId(null)
    setSuccessMessage('Recommendation deleted.')
    setRecModalState({ type: 'none' })
  }

  function handlePlanSuccess(plan: ProductionPlan) {
    setPlans((prev) => {
      const existing = prev.find((p) => p.id === plan.id)
      if (existing) return prev.map((p) => (p.id === plan.id ? plan : p))
      return [...prev, plan]
    })
    setSelectedPlanId(plan.id)
    setSuccessMessage(
      planModalState.type === 'editPlan' ? 'Production plan updated.' : 'Production plan added.',
    )
    setPlanModalState({ type: 'none' })
  }

  function handlePlanDeleted(id: number) {
    setPlans((prev) => prev.filter((p) => p.id !== id))
    if (selectedPlanId === id) setSelectedPlanId(null)
    setSuccessMessage('Production plan deleted.')
    setPlanModalState({ type: 'none' })
  }

  function handleComparisonSuccess(mc: MarketComparison) {
    setComparisons((prev) => {
      const existing = prev.find((c) => c.id === mc.id)
      if (existing) return prev.map((c) => (c.id === mc.id ? mc : c))
      return [...prev, mc]
    })
    setSelectedComparisonId(mc.id)
    setSuccessMessage(
      comparisonModalState.type === 'editComparison'
        ? 'Market comparison updated.'
        : 'Market comparison added.',
    )
    setComparisonModalState({ type: 'none' })
  }

  function handleComparisonDeleted(id: number) {
    setComparisons((prev) => prev.filter((c) => c.id !== id))
    if (selectedComparisonId === id) setSelectedComparisonId(null)
    setSuccessMessage('Market comparison deleted.')
    setComparisonModalState({ type: 'none' })
  }

  function handleReportSuccess(report: DecisionReport) {
    setReports((prev) => {
      const existing = prev.find((r) => r.id === report.id)
      if (existing) return prev.map((r) => (r.id === report.id ? report : r))
      return [...prev, report]
    })
    setSelectedReportId(report.id)
    setSuccessMessage(
      reportModalState.type === 'editReport'
        ? 'Decision report updated.'
        : 'Decision report created.',
    )
    setReportModalState({ type: 'none' })
  }

  function handleReportDeleted(id: number) {
    setReports((prev) => prev.filter((r) => r.id !== id))
    if (selectedReportId === id) setSelectedReportId(null)
    setSuccessMessage('Decision report deleted.')
    setReportModalState({ type: 'none' })
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="decisions-page">
        <div className="decisions-header">
          <div>
            <p className="decisions-eyebrow">Decision Support</p>
            <h2 className="decisions-title">Decision Support</h2>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)',
            gap: '20px',
          }}
        >
          <div className="dashboard-skeleton" style={{ minHeight: '360px', borderRadius: '12px' }} />
          <div className="dashboard-skeleton" style={{ minHeight: '360px', borderRadius: '12px' }} />
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (pageError) {
    return (
      <div className="decisions-page">
        <div className="decisions-header">
          <div>
            <p className="decisions-eyebrow">Decision Support</p>
            <h2 className="decisions-title">Decision Support</h2>
          </div>
        </div>
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>Could not load decision data</h2>
            <p>{pageError}</p>
          </div>
          <button
            className="dashboard-secondary-button"
            onClick={() => void loadPageData()}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-arrow-clockwise" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const selectedRec =
    recommendations.find((r) => r.id === selectedRecId) ?? null
  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) ?? null
  const selectedComparison =
    comparisons.find((c) => c.id === selectedComparisonId) ?? null
  const selectedReport =
    reports.find((r) => r.id === selectedReportId) ?? null

  const TABS: { id: DecisionTab; label: string; icon: string }[] = [
    { id: 'recommendations', label: 'Recommendations', icon: 'bi-lightbulb' },
    { id: 'plans', label: 'Production Plans', icon: 'bi-clipboard-data' },
    { id: 'comparisons', label: 'Market Comparisons', icon: 'bi-shop' },
    { id: 'reports', label: 'Decision Reports', icon: 'bi-file-earmark-text' },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="decisions-page">
      {/* Header */}
      <div className="decisions-header">
        <div>
          <p className="decisions-eyebrow">Decision Support</p>
          <h2 className="decisions-title">Decision Support</h2>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="farms-alert farms-alert-success" role="status">
          <i aria-hidden="true" className="bi bi-check-circle-fill" />
          <div className="farms-alert-content">{successMessage}</div>
          <button
            aria-label="Dismiss message"
            className="farms-alert-dismiss"
            onClick={() => setSuccessMessage(null)}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {/* Tab strip */}
      <div
        aria-label="Decision support sections"
        className="decisions-tabs"
        role="tablist"
      >
        {TABS.map((tab) => (
          <button
            aria-controls={`decisions-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className={`decisions-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
            id={`decisions-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            <i aria-hidden="true" className={`bi ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div
        aria-labelledby={`decisions-tab-${activeTab}`}
        id={`decisions-panel-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === 'recommendations' && (
          <RecommendationsTab
            allFields={allFields}
            allPriceSeries={allPriceSeries}
            allVarieties={allVarieties}
            comparisons={comparisons}
            crops={crops}
            farms={farms}
            mlStatus={mlStatus}
            modalState={recModalState}
            observations={allObservations}
            onModalStateChange={setRecModalState}
            onRecDeleted={handleRecommendationDeleted}
            onRecSuccess={handleRecommendationSuccess}
            onSelectRec={setSelectedRecId}
            recommendations={recommendations}
            selectedRec={selectedRec}
          />
        )}
        {activeTab === 'plans' && (
          <PlansTab
            allFields={allFields}
            allVarieties={allVarieties}
            crops={crops}
            farms={farms}
            growingSeasons={growingSeasons}
            modalState={planModalState}
            onModalStateChange={setPlanModalState}
            onPlanDeleted={handlePlanDeleted}
            onPlanSuccess={handlePlanSuccess}
            onSelectPlan={setSelectedPlanId}
            plans={plans}
            recommendations={recommendations}
            selectedPlan={selectedPlan}
          />
        )}
        {activeTab === 'comparisons' && (
          <ComparisonsTab
            allFields={allFields}
            allObservations={allObservations}
            allPriceSeries={allPriceSeries}
            comparisons={comparisons}
            crops={crops}
            markets={markets}
            modalState={comparisonModalState}
            onComparisonDeleted={handleComparisonDeleted}
            onComparisonSuccess={handleComparisonSuccess}
            onModalStateChange={setComparisonModalState}
            onSelectComparison={setSelectedComparisonId}
            plans={plans}
            reports={reports}
            selectedComparison={selectedComparison}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab
            allFields={allFields}
            crops={crops}
            farms={farms}
            modalState={reportModalState}
            onModalStateChange={setReportModalState}
            onReportDeleted={handleReportDeleted}
            onReportSuccess={handleReportSuccess}
            onSelectReport={setSelectedReportId}
            plans={plans}
            productionPlans={plans}
            recommendations={recommendations}
            reports={reports}
            selectedReport={selectedReport}
          />
        )}
      </div>

      {/* Recommendations modals */}
      <RecommendationFormModal
        allFields={allFields}
        allVarieties={allVarieties}
        crops={crops}
        farms={farms}
        initialRec={recModalState.type === 'editRec' ? recModalState.rec : null}
        isOpen={
          recModalState.type === 'createRec' || recModalState.type === 'editRec'
        }
        onClose={() => setRecModalState({ type: 'none' })}
        onSuccess={handleRecommendationSuccess}
      />
      <RecommendationDeleteModal
        cropName={
          recModalState.type === 'deleteRec'
            ? getCropName(recModalState.rec.crop, crops)
            : ''
        }
        fieldName={
          recModalState.type === 'deleteRec'
            ? getFieldName(recModalState.rec.field, allFields)
            : ''
        }
        isOpen={recModalState.type === 'deleteRec'}
        onClose={() => setRecModalState({ type: 'none' })}
        onSuccess={handleRecommendationDeleted}
        rec={recModalState.type === 'deleteRec' ? recModalState.rec : null}
      />

      {/* Plans modals */}
      <ProductionPlanFormModal
        allFields={allFields}
        allVarieties={allVarieties}
        crops={crops}
        farms={farms}
        growingSeasons={growingSeasons}
        initialPlan={planModalState.type === 'editPlan' ? planModalState.plan : null}
        isOpen={
          planModalState.type === 'createPlan' || planModalState.type === 'editPlan'
        }
        onClose={() => setPlanModalState({ type: 'none' })}
        onSuccess={handlePlanSuccess}
        recommendations={recommendations}
      />
      <ProductionPlanDeleteModal
        cropName={
          planModalState.type === 'deletePlan'
            ? getCropName(planModalState.plan.crop, crops)
            : ''
        }
        fieldName={
          planModalState.type === 'deletePlan'
            ? getFieldName(planModalState.plan.field, allFields)
            : ''
        }
        isOpen={planModalState.type === 'deletePlan'}
        onClose={() => setPlanModalState({ type: 'none' })}
        onSuccess={handlePlanDeleted}
        plan={planModalState.type === 'deletePlan' ? planModalState.plan : null}
      />

      {/* Comparisons modals */}
      <MarketComparisonFormModal
        crops={crops}
        initialComparison={
          comparisonModalState.type === 'editComparison'
            ? comparisonModalState.comparison
            : null
        }
        isOpen={
          comparisonModalState.type === 'createComparison' ||
          comparisonModalState.type === 'editComparison'
        }
        markets={markets}
        observations={allObservations}
        onClose={() => setComparisonModalState({ type: 'none' })}
        onSuccess={handleComparisonSuccess}
        priceSeries={allPriceSeries}
        productionPlans={plans}
        reports={reports}
      />
      <MarketComparisonDeleteModal
        comparison={
          comparisonModalState.type === 'deleteComparison'
            ? comparisonModalState.comparison
            : null
        }
        cropName={
          comparisonModalState.type === 'deleteComparison'
            ? getCropNameForSeries(
                getSeriesForObservation(
                  comparisonModalState.comparison.price_observation,
                  allObservations,
                  allPriceSeries,
                )?.id ?? 0,
                allPriceSeries,
                crops,
              )
            : ''
        }
        isOpen={comparisonModalState.type === 'deleteComparison'}
        marketName={
          comparisonModalState.type === 'deleteComparison'
            ? getMarketName(
                getSeriesForObservation(
                  comparisonModalState.comparison.price_observation,
                  allObservations,
                  allPriceSeries,
                )?.id ?? 0,
                allPriceSeries,
                markets,
              )
            : ''
        }
        onClose={() => setComparisonModalState({ type: 'none' })}
        onSuccess={handleComparisonDeleted}
      />

      {/* Reports modals */}
      <DecisionReportFormModal
        allFields={allFields}
        farms={farms}
        initialReport={
          reportModalState.type === 'editReport' ? reportModalState.report : null
        }
        isOpen={
          reportModalState.type === 'createReport' ||
          reportModalState.type === 'editReport'
        }
        onClose={() => setReportModalState({ type: 'none' })}
        onSuccess={handleReportSuccess}
        productionPlans={plans}
        recommendations={recommendations}
      />
      <DecisionReportDeleteModal
        fieldName={
          reportModalState.type === 'deleteReport'
            ? getFieldName(reportModalState.report.field, allFields)
            : ''
        }
        isOpen={reportModalState.type === 'deleteReport'}
        onClose={() => setReportModalState({ type: 'none' })}
        onSuccess={handleReportDeleted}
        report={
          reportModalState.type === 'deleteReport' ? reportModalState.report : null
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recommendations Tab
// ---------------------------------------------------------------------------

type RecommendationsTabProps = {
  recommendations: CropRecommendation[]
  selectedRec: CropRecommendation | null
  crops: Crop[]
  allFields: Field[]
  farms: Farm[]
  allVarieties: CropVariety[]
  mlStatus: MlStatus | null
  modalState: RecommendationModalState
  onModalStateChange: (state: RecommendationModalState) => void
  onSelectRec: (id: number) => void
  onRecSuccess: (rec: CropRecommendation) => void
  onRecDeleted: (id: number) => void
  // unused but required by parent — keep consistent prop interface
  allPriceSeries: MarketPrice[]
  comparisons: MarketComparison[]
  observations: MarketPriceObservation[]
}

function RecommendationsTab({
  recommendations,
  selectedRec,
  crops,
  allFields,
  farms,
  allVarieties,
  mlStatus,
  onModalStateChange,
  onSelectRec,
}: RecommendationsTabProps) {
  const showMlWarning =
    mlStatus === null || mlStatus.mlp_crop_recommendation === 'not_trained'

  if (recommendations.length === 0) {
    return (
      <div className="decisions-empty">
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-lightbulb" />
        </div>
        <h3 style={{ color: 'var(--app-forest)', margin: '0 0 6px' }}>
          No crop recommendations yet
        </h3>
        <p
          style={{
            maxWidth: '380px',
            margin: '0 0 18px',
            color: 'var(--app-muted)',
            fontSize: '13px',
          }}
        >
          Record your first crop recommendation to begin your decision-support workflow.
        </p>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createRec' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add First Recommendation
        </button>
      </div>
    )
  }

  return (
    <div className="decisions-layout">
      {/* Sidebar list */}
      <div className="decisions-sidebar-panel">
        <div className="farms-panel-header">
          <h3 className="farms-panel-title">Recommendations</h3>
          <span className="farms-count-badge">
            {recommendations.length}
          </span>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createRec' })}
          style={{ width: '100%' }}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          New Recommendation
        </button>
        <div className="farms-cards-list">
          {recommendations.map((rec) => (
            <button
              className={`decisions-item-card${rec.id === selectedRec?.id ? ' is-selected' : ''}`}
              key={rec.id}
              onClick={() => onSelectRec(rec.id)}
              type="button"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <p className="decisions-item-card-title">
                  {getCropName(rec.crop, crops)}
                </p>
                <span className={statusBadgeClass(rec.status)}>{rec.status}</span>
              </div>
              <div className="decisions-item-card-meta">
                <span>
                  <i aria-hidden="true" className="bi bi-geo-alt" />
                  {getFieldName(rec.field, allFields)}
                </span>
                <span>
                  <i aria-hidden="true" className="bi bi-calendar-event" />
                  {formatDateTime(rec.generated_at)}
                </span>
              </div>
              <div className="decisions-item-card-actions">
                <button
                  className="farms-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'editRec', rec })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-pencil" />
                  Edit
                </button>
                <button
                  className="farms-btn-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'deleteRec', rec })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-trash" />
                  Delete
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="decisions-content-panel">
        {showMlWarning && (
          <div className="decisions-ml-warning">
            <i aria-hidden="true" className="bi bi-info-circle-fill" />
            <span>
              ML crop recommendation model is not yet active. Recommendations record
              manually entered or rule-based information only.
            </span>
          </div>
        )}
        {!selectedRec ? (
          <div className="decisions-no-selection">
            <i aria-hidden="true" className="bi bi-arrow-left-circle" />
            <p>Select a recommendation from the list to view its details.</p>
          </div>
        ) : (
          <div className="decisions-detail-panel">
            <h3 className="decisions-detail-title">
              {getCropName(selectedRec.crop, crops)}
            </h3>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Status</span>
              <span className={statusBadgeClass(selectedRec.status)}>
                {selectedRec.status}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Field</span>
              <span className="decisions-detail-value">
                {getFieldName(selectedRec.field, allFields)}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Farm</span>
              <span className="decisions-detail-value">
                {getFarmName(selectedRec.field, allFields, farms)}
              </span>
            </div>
            {selectedRec.variety != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Variety</span>
                <span className="decisions-detail-value">
                  {getVarietyName(selectedRec.variety, allVarieties) ?? '—'}
                </span>
              </div>
            )}
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Generated At</span>
              <span className="decisions-detail-value">
                {formatDateTime(selectedRec.generated_at)}
              </span>
            </div>
            {selectedRec.suitability_score != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Suitability Score (0–100)</span>
                <span className="decisions-detail-value">
                  {selectedRec.suitability_score} — manually entered
                </span>
              </div>
            )}
            {selectedRec.explanation && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Explanation</span>
                <span className="decisions-detail-value">{selectedRec.explanation}</span>
              </div>
            )}
            {selectedRec.uncertainty_notes && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Uncertainty Notes</span>
                <span className="decisions-detail-value">
                  {selectedRec.uncertainty_notes}
                </span>
              </div>
            )}
            {selectedRec.model_version && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Model Version</span>
                <span className="decisions-detail-value">{selectedRec.model_version}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plans Tab
// ---------------------------------------------------------------------------

type PlansTabProps = {
  plans: ProductionPlan[]
  selectedPlan: ProductionPlan | null
  crops: Crop[]
  allFields: Field[]
  farms: Farm[]
  allVarieties: CropVariety[]
  growingSeasons: GrowingSeason[]
  recommendations: CropRecommendation[]
  modalState: PlanModalState
  onModalStateChange: (state: PlanModalState) => void
  onSelectPlan: (id: number) => void
  onPlanSuccess: (plan: ProductionPlan) => void
  onPlanDeleted: (id: number) => void
}

function PlansTab({
  plans,
  selectedPlan,
  crops,
  allFields,
  farms,
  allVarieties,
  onModalStateChange,
  onSelectPlan,
}: PlansTabProps) {
  if (plans.length === 0) {
    return (
      <div className="decisions-empty">
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-clipboard-data" />
        </div>
        <h3 style={{ color: 'var(--app-forest)', margin: '0 0 6px' }}>
          No production plans yet
        </h3>
        <p
          style={{
            maxWidth: '380px',
            margin: '0 0 18px',
            color: 'var(--app-muted)',
            fontSize: '13px',
          }}
        >
          Create a production plan to record estimated costs and expected yields.
        </p>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createPlan' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add First Plan
        </button>
      </div>
    )
  }

  return (
    <div className="decisions-layout">
      {/* Sidebar */}
      <div className="decisions-sidebar-panel">
        <div className="farms-panel-header">
          <h3 className="farms-panel-title">Production Plans</h3>
          <span className="farms-count-badge">{plans.length}</span>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createPlan' })}
          style={{ width: '100%' }}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          New Plan
        </button>
        <div className="farms-cards-list">
          {plans.map((plan) => (
            <button
              className={`decisions-item-card${plan.id === selectedPlan?.id ? ' is-selected' : ''}`}
              key={plan.id}
              onClick={() => onSelectPlan(plan.id)}
              type="button"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <p className="decisions-item-card-title">
                  {getCropName(plan.crop, crops)}
                </p>
                <span className={statusBadgeClass(plan.status)}>{plan.status}</span>
              </div>
              <div className="decisions-item-card-meta">
                <span>
                  <i aria-hidden="true" className="bi bi-geo-alt" />
                  {getFieldName(plan.field, allFields)}
                </span>
                {plan.estimated_cost && (
                  <span>
                    <i aria-hidden="true" className="bi bi-cash" />
                    Est. {plan.estimated_cost} {plan.currency}
                  </span>
                )}
              </div>
              <div className="decisions-item-card-actions">
                <button
                  className="farms-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'editPlan', plan })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-pencil" />
                  Edit
                </button>
                <button
                  className="farms-btn-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'deletePlan', plan })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-trash" />
                  Delete
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="decisions-content-panel">
        {!selectedPlan ? (
          <div className="decisions-no-selection">
            <i aria-hidden="true" className="bi bi-arrow-left-circle" />
            <p>Select a production plan from the list to view its details.</p>
          </div>
        ) : (
          <div className="decisions-detail-panel">
            <h3 className="decisions-detail-title">
              {getCropName(selectedPlan.crop, crops)}
            </h3>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Status</span>
              <span className={statusBadgeClass(selectedPlan.status)}>
                {selectedPlan.status}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Field</span>
              <span className="decisions-detail-value">
                {getFieldName(selectedPlan.field, allFields)}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Farm</span>
              <span className="decisions-detail-value">
                {getFarmName(selectedPlan.field, allFields, farms)}
              </span>
            </div>
            {selectedPlan.variety != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Variety</span>
                <span className="decisions-detail-value">
                  {getVarietyName(selectedPlan.variety, allVarieties) ?? '—'}
                </span>
              </div>
            )}
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Estimated Cost</span>
              <span className="decisions-detail-value">
                {selectedPlan.estimated_cost != null
                  ? `${selectedPlan.estimated_cost} ${selectedPlan.currency} (estimate)`
                  : '—'}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Expected Yield</span>
              <span className="decisions-detail-value">
                {selectedPlan.expected_yield != null
                  ? `${selectedPlan.expected_yield} ${selectedPlan.yield_unit} (estimate)`
                  : '—'}
              </span>
            </div>
            {selectedPlan.growing_season != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Linked Season</span>
                <span className="decisions-detail-value">
                  Season #{selectedPlan.growing_season}
                </span>
              </div>
            )}
            {selectedPlan.crop_recommendation != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Linked Recommendation</span>
                <span className="decisions-detail-value">
                  Recommendation #{selectedPlan.crop_recommendation}
                </span>
              </div>
            )}
            {selectedPlan.uncertainty_notes && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Uncertainty Notes</span>
                <span className="decisions-detail-value">
                  {selectedPlan.uncertainty_notes}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparisons Tab
// ---------------------------------------------------------------------------

type ComparisonsTabProps = {
  comparisons: MarketComparison[]
  selectedComparison: MarketComparison | null
  crops: Crop[]
  allFields: Field[]
  markets: Market[]
  allPriceSeries: MarketPrice[]
  allObservations: MarketPriceObservation[]
  reports: DecisionReport[]
  plans: ProductionPlan[]
  modalState: ComparisonModalState
  onModalStateChange: (state: ComparisonModalState) => void
  onSelectComparison: (id: number) => void
  onComparisonSuccess: (mc: MarketComparison) => void
  onComparisonDeleted: (id: number) => void
}

function ComparisonsTab({
  comparisons,
  selectedComparison,
  crops,
  allObservations,
  allPriceSeries,
  markets,
  onModalStateChange,
  onSelectComparison,
}: ComparisonsTabProps) {
  if (comparisons.length === 0) {
    return (
      <div className="decisions-empty">
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-shop" />
        </div>
        <h3 style={{ color: 'var(--app-forest)', margin: '0 0 6px' }}>
          No market comparisons yet
        </h3>
        <p
          style={{
            maxWidth: '380px',
            margin: '0 0 18px',
            color: 'var(--app-muted)',
            fontSize: '13px',
          }}
        >
          Add a market comparison to evaluate prices for your crop at different markets.
        </p>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createComparison' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add First Comparison
        </button>
      </div>
    )
  }

  return (
    <div className="decisions-layout">
      {/* Sidebar */}
      <div className="decisions-sidebar-panel">
        <div className="farms-panel-header">
          <h3 className="farms-panel-title">Market Comparisons</h3>
          <span className="farms-count-badge">{comparisons.length}</span>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createComparison' })}
          style={{ width: '100%' }}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          New Comparison
        </button>
        <div className="farms-cards-list">
          {comparisons.map((mc) => {
            const series = getSeriesForObservation(
              mc.price_observation,
              allObservations,
              allPriceSeries,
            )
            const obs = allObservations.find((o) => o.id === mc.price_observation)
            const marketName = series
              ? (markets.find((m) => m.id === series.market)?.name ?? '—')
              : '—'
            const cropName = series
              ? getCropName(series.crop, crops)
              : '—'

            return (
              <button
                className={`decisions-item-card${mc.id === selectedComparison?.id ? ' is-selected' : ''}`}
                key={mc.id}
                onClick={() => onSelectComparison(mc.id)}
                type="button"
              >
                <p className="decisions-item-card-title">{marketName}</p>
                <div className="decisions-item-card-meta">
                  <span>{cropName}</span>
                  <span>Qty: {mc.quantity}</span>
                  {obs && <span>{obs.observation_date}</span>}
                  {mc.estimated_net_return != null && (
                    <span>
                      Net return: {formatDecimal(mc.estimated_net_return)} {mc.currency}
                    </span>
                  )}
                </div>
                <div className="decisions-item-card-actions">
                  <button
                    className="farms-btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      onModalStateChange({ type: 'editComparison', comparison: mc })
                    }}
                    style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                    type="button"
                  >
                    <i aria-hidden="true" className="bi bi-pencil" />
                    Edit
                  </button>
                  <button
                    className="farms-btn-danger"
                    onClick={(e) => {
                      e.stopPropagation()
                      onModalStateChange({ type: 'deleteComparison', comparison: mc })
                    }}
                    style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                    type="button"
                  >
                    <i aria-hidden="true" className="bi bi-trash" />
                    Delete
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="decisions-content-panel">
        {!selectedComparison ? (
          <div className="decisions-no-selection">
            <i aria-hidden="true" className="bi bi-arrow-left-circle" />
            <p>Select a market comparison from the list to view its details.</p>
          </div>
        ) : (
          <div className="decisions-detail-panel">
            {(() => {
              const series = getSeriesForObservation(
                selectedComparison.price_observation,
                allObservations,
                allPriceSeries,
              )
              const obs = allObservations.find(
                (o) => o.id === selectedComparison.price_observation,
              )
              const marketName = series
                ? (markets.find((m) => m.id === series.market)?.name ?? '—')
                : '—'
              const cropName = series ? getCropName(series.crop, crops) : '—'

              return (
                <>
                  <h3 className="decisions-detail-title">{marketName}</h3>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Crop</span>
                    <span className="decisions-detail-value">{cropName}</span>
                  </div>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Report</span>
                    <span className="decisions-detail-value">
                      #{selectedComparison.decision_report}
                    </span>
                  </div>
                  {obs && (
                    <>
                      <div className="decisions-detail-row">
                        <span className="decisions-detail-label">Observation Date</span>
                        <span className="decisions-detail-value">
                          {obs.observation_date}
                        </span>
                      </div>
                      <div className="decisions-detail-row">
                        <span className="decisions-detail-label">Price</span>
                        <span className="decisions-detail-value">
                          {obs.price} {obs.currency}
                          {obs.grade ? ` (${obs.grade})` : ''}
                        </span>
                      </div>
                      {obs.source_name && (
                        <div className="decisions-detail-row">
                          <span className="decisions-detail-label">Price Source</span>
                          <span className="decisions-detail-value">{obs.source_name}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Quantity</span>
                    <span className="decisions-detail-value">
                      {selectedComparison.quantity}
                      {series ? ` ${series.quantity_unit}` : ''}
                    </span>
                  </div>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Currency</span>
                    <span className="decisions-detail-value">
                      {selectedComparison.currency}
                    </span>
                  </div>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Est. Gross Sales</span>
                    <span className="decisions-detail-value">
                      {selectedComparison.estimated_gross_sales_value != null
                        ? `${formatDecimal(selectedComparison.estimated_gross_sales_value)} ${selectedComparison.currency}`
                        : '—'}
                    </span>
                  </div>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Transport Cost</span>
                    <span className="decisions-detail-value">
                      {selectedComparison.estimated_transport_cost != null
                        ? `${formatDecimal(selectedComparison.estimated_transport_cost)} ${selectedComparison.currency}`
                        : 'Unknown'}
                    </span>
                  </div>
                  <div className="decisions-detail-row">
                    <span className="decisions-detail-label">Est. Net Return</span>
                    <span className="decisions-detail-value">
                      {selectedComparison.estimated_net_return != null
                        ? `${formatDecimal(selectedComparison.estimated_net_return)} ${selectedComparison.currency}`
                        : 'Cannot calculate — transport cost unknown'}
                    </span>
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '11.5px',
                      color: 'var(--app-muted)',
                    }}
                  >
                    Net return does not include production costs or other expenses.
                  </div>
                  {selectedComparison.uncertainty_notes && (
                    <div className="decisions-detail-row" style={{ marginTop: '8px' }}>
                      <span className="decisions-detail-label">Uncertainty Notes</span>
                      <span className="decisions-detail-value">
                        {selectedComparison.uncertainty_notes}
                      </span>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reports Tab
// ---------------------------------------------------------------------------

type ReportsTabProps = {
  reports: DecisionReport[]
  selectedReport: DecisionReport | null
  crops: Crop[]
  allFields: Field[]
  farms: Farm[]
  recommendations: CropRecommendation[]
  plans: ProductionPlan[]
  modalState: ReportModalState
  onModalStateChange: (state: ReportModalState) => void
  onSelectReport: (id: number) => void
  onReportSuccess: (report: DecisionReport) => void
  onReportDeleted: (id: number) => void
  productionPlans: ProductionPlan[]
}

function ReportsTab({
  reports,
  selectedReport,
  allFields,
  farms,
  onModalStateChange,
  onSelectReport,
}: ReportsTabProps) {
  if (reports.length === 0) {
    return (
      <div className="decisions-empty">
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-file-earmark-text" />
        </div>
        <h3 style={{ color: 'var(--app-forest)', margin: '0 0 6px' }}>
          No decision reports yet
        </h3>
        <p
          style={{
            maxWidth: '380px',
            margin: '0 0 18px',
            color: 'var(--app-muted)',
            fontSize: '13px',
          }}
        >
          Create a decision report to bring together your recommendations, plans, and market comparisons.
        </p>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createReport' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Create First Report
        </button>
      </div>
    )
  }

  return (
    <div className="decisions-layout">
      {/* Sidebar */}
      <div className="decisions-sidebar-panel">
        <div className="farms-panel-header">
          <h3 className="farms-panel-title">Decision Reports</h3>
          <span className="farms-count-badge">{reports.length}</span>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => onModalStateChange({ type: 'createReport' })}
          style={{ width: '100%' }}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          New Report
        </button>
        <div className="farms-cards-list">
          {reports.map((report) => (
            <button
              className={`decisions-item-card${report.id === selectedReport?.id ? ' is-selected' : ''}`}
              key={report.id}
              onClick={() => onSelectReport(report.id)}
              type="button"
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <p className="decisions-item-card-title">
                  Report #{report.id}
                </p>
                <span className={statusBadgeClass(report.status)}>{report.status}</span>
              </div>
              <div className="decisions-item-card-meta">
                <span>
                  <i aria-hidden="true" className="bi bi-geo-alt" />
                  {getFieldName(report.field, allFields)}
                </span>
                <span>
                  <i aria-hidden="true" className="bi bi-calendar-event" />
                  {formatDateTime(report.created_at)}
                </span>
              </div>
              <div className="decisions-item-card-actions">
                <button
                  className="farms-btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'editReport', report })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-pencil" />
                  Edit
                </button>
                <button
                  className="farms-btn-danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    onModalStateChange({ type: 'deleteReport', report })
                  }}
                  style={{ flex: 1, fontSize: '12px', minHeight: '30px' }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-trash" />
                  Delete
                </button>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="decisions-content-panel">
        {!selectedReport ? (
          <div className="decisions-no-selection">
            <i aria-hidden="true" className="bi bi-arrow-left-circle" />
            <p>Select a decision report from the list to view its details.</p>
          </div>
        ) : (
          <div className="decisions-detail-panel">
            <h3 className="decisions-detail-title">Report #{selectedReport.id}</h3>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Status</span>
              <span className={statusBadgeClass(selectedReport.status)}>
                {selectedReport.status}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Field</span>
              <span className="decisions-detail-value">
                {getFieldName(selectedReport.field, allFields)}
              </span>
            </div>
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Farm</span>
              <span className="decisions-detail-value">
                {getFarmName(selectedReport.field, allFields, farms)}
              </span>
            </div>
            {selectedReport.crop_recommendation != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Recommendation</span>
                <span className="decisions-detail-value">
                  #{selectedReport.crop_recommendation}
                </span>
              </div>
            )}
            {selectedReport.production_plan != null && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Production Plan</span>
                <span className="decisions-detail-value">
                  #{selectedReport.production_plan}
                </span>
              </div>
            )}
            {selectedReport.summary && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Summary</span>
                <span className="decisions-detail-value">{selectedReport.summary}</span>
              </div>
            )}
            {selectedReport.recommendation_text && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Recommendation</span>
                <span className="decisions-detail-value">
                  {selectedReport.recommendation_text}
                </span>
              </div>
            )}
            {selectedReport.model_version && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Model Version</span>
                <span className="decisions-detail-value">
                  {selectedReport.model_version}
                </span>
              </div>
            )}
            {selectedReport.generated_at && (
              <div className="decisions-detail-row">
                <span className="decisions-detail-label">Generated At</span>
                <span className="decisions-detail-value">
                  {formatDateTime(selectedReport.generated_at)}
                </span>
              </div>
            )}
            <div className="decisions-detail-row">
              <span className="decisions-detail-label">Created</span>
              <span className="decisions-detail-value">
                {formatDateTime(selectedReport.created_at)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
