import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { listFarms, listFields, type Farm, type Field } from '../../services/resources/farmsApi'
import { listCrops, listVarieties, type Crop, type CropVariety } from '../../services/resources/cropsApi'
import { listGrowingSeasons, type GrowingSeason } from '../../services/resources/growingSeasonsApi'
import { GrowingSeasonCard } from './GrowingSeasonCard'
import { GrowingSeasonFormModal } from './GrowingSeasonFormModal'
import { GrowingSeasonDeleteModal } from './GrowingSeasonDeleteModal'
import { ProductionActivitiesPanel } from './ProductionActivitiesPanel'
import { ProductionCostsPanel } from './ProductionCostsPanel'
import { HarvestEstimatesPanel } from './HarvestEstimatesPanel'
import { HarvestRecordsPanel } from './HarvestRecordsPanel'
import type { SeasonDetailTab, SeasonModalState } from './types'
import './production-page.css'
import '../farms/farms-page.css'

type TabDef = {
  id: SeasonDetailTab
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { id: 'activities', label: 'Activities', icon: 'bi-calendar-check' },
  { id: 'costs', label: 'Costs', icon: 'bi-cash-coin' },
  { id: 'estimates', label: 'Estimates', icon: 'bi-bar-chart-line' },
  { id: 'records', label: 'Harvest Records', icon: 'bi-basket' },
]

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusLabel(status: string): string {
  switch (status) {
    case 'planned':
      return 'Planned'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'abandoned':
      return 'Abandoned'
    default:
      return status
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'planned':
      return 'season-status-badge season-status--planned'
    case 'in_progress':
      return 'season-status-badge season-status--in-progress'
    case 'completed':
      return 'season-status-badge season-status--completed'
    case 'abandoned':
      return 'season-status-badge season-status--abandoned'
    default:
      return 'season-status-badge season-status--planned'
  }
}

export function ProductionPage() {
  const [seasons, setSeasons] = useState<GrowingSeason[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [allFields, setAllFields] = useState<Field[]>([])
  const [crops, setCrops] = useState<Crop[]>([])
  const [allVarieties, setAllVarieties] = useState<CropVariety[]>([])
  const [pageLoading, setPageLoading] = useState<boolean>(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<SeasonDetailTab>('activities')
  const [seasonModalState, setSeasonModalState] = useState<SeasonModalState>({ type: 'none' })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
      // Load seasons, farms, crops and varieties concurrently
      const [fetchedSeasons, fetchedFarms, fetchedCrops, fetchedVarieties] =
        await Promise.all([
          listGrowingSeasons(),
          listFarms(),
          listCrops(),
          listVarieties(),
        ])

      if (!isMountedRef.current) return

      // Fetch fields for all farms concurrently
      const fieldArrays = await Promise.all(
        fetchedFarms.map((farm) =>
          listFields(farm.id).catch(() => [] as Field[]),
        ),
      )

      if (!isMountedRef.current) return

      const allFetchedFields = fieldArrays.flat()

      setSeasons(fetchedSeasons)
      setFarms(fetchedFarms)
      setAllFields(allFetchedFields)
      setCrops(fetchedCrops)
      setAllVarieties(fetchedVarieties)
      setPageLoading(false)

      // Auto-select first season if none selected yet
      setSelectedSeasonId((prev) => {
        if (prev !== null && fetchedSeasons.some((s) => s.id === prev)) {
          return prev
        }
        return fetchedSeasons.length > 0 ? fetchedSeasons[0].id : null
      })
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      setPageLoading(false)
      setPageError(
        err instanceof Error
          ? err.message
          : 'Could not load production data. Check your connection and try again.',
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

  // Reset tab to activities when selected season changes
  useEffect(() => {
    setActiveTab('activities')
  }, [selectedSeasonId])

  function handleRetryLoad() {
    void loadPageData()
  }

  // ─── Lookup helpers ───────────────────────────────────────────────────────

  function getCropName(cropId: number): string {
    return crops.find((c) => c.id === cropId)?.common_name ?? 'Unknown crop'
  }

  function getVarietyName(varietyId: number | null): string | null {
    if (varietyId == null) return null
    return allVarieties.find((v) => v.id === varietyId)?.name ?? null
  }

  function getFieldName(fieldId: number): string {
    return allFields.find((f) => f.id === fieldId)?.name ?? 'Unknown field'
  }

  function getFarmName(fieldId: number): string {
    const field = allFields.find((f) => f.id === fieldId)
    if (!field) return 'Unknown farm'
    return farms.find((farm) => farm.id === field.farm)?.name ?? 'Unknown farm'
  }

  // ─── Season CRUD handlers ─────────────────────────────────────────────────

  function handleSeasonSuccess(season: GrowingSeason) {
    if (seasonModalState.type === 'editSeason') {
      setSeasons((prev) => prev.map((s) => (s.id === season.id ? season : s)))
      setSuccessMessage('Season updated.')
    } else {
      setSeasons((prev) => [...prev, season])
      setSelectedSeasonId(season.id)
      setSuccessMessage('Season added.')
    }
    setSeasonModalState({ type: 'none' })
  }

  function handleSeasonDeleted(id: number) {
    setSeasons((prev) => {
      const remaining = prev.filter((s) => s.id !== id)
      setSelectedSeasonId((currentId) => {
        if (currentId === id) {
          return remaining.length > 0 ? remaining[0].id : null
        }
        return currentId
      })
      return remaining
    })
    setSuccessMessage('Season deleted.')
    setSeasonModalState({ type: 'none' })
  }

  // ─── Tab keyboard navigation ──────────────────────────────────────────────

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % TABS.length
      const nextTab = document.getElementById(`prod-tab-${TABS[nextIndex].id}`)
      nextTab?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + TABS.length) % TABS.length
      const prevTab = document.getElementById(`prod-tab-${TABS[prevIndex].id}`)
      prevTab?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setActiveTab(TABS[index].id)
    }
  }

  // ─── Derived values ───────────────────────────────────────────────────────

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null

  // ─── Loading state ────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="production-page">
        <div className="production-header">
          <div>
            <p className="production-eyebrow">Production Management</p>
            <h2 className="production-title">Growing Seasons</h2>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)',
            gap: '20px',
            marginTop: '12px',
          }}
        >
          <div
            className="dashboard-skeleton"
            style={{ minHeight: '360px', borderRadius: '12px' }}
          />
          <div
            className="dashboard-skeleton"
            style={{ minHeight: '360px', borderRadius: '12px' }}
          />
        </div>
      </div>
    )
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  if (pageError) {
    return (
      <div className="production-page">
        <div className="production-header">
          <div>
            <p className="production-eyebrow">Production Management</p>
            <h2 className="production-title">Growing Seasons</h2>
          </div>
        </div>
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>Could not load production data</h2>
            <p>{pageError}</p>
          </div>
          <button
            className="dashboard-secondary-button"
            onClick={handleRetryLoad}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-arrow-clockwise" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="production-page">
      <div className="production-header">
        <div>
          <p className="production-eyebrow">Production Management</p>
          <h2 className="production-title">Growing Seasons</h2>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => setSeasonModalState({ type: 'createSeason' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add Season
        </button>
      </div>

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

      {seasons.length === 0 ? (
        <div className="production-empty">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-calendar-plus" />
          </div>
          <h3 style={{ color: 'var(--app-forest)', margin: '0 0 6px' }}>
            No growing seasons yet
          </h3>
          <p
            style={{
              maxWidth: '380px',
              margin: '0 0 18px',
              color: 'var(--app-muted)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Add your first growing season to start tracking production activities,
            costs, and harvest records.
          </p>
          <button
            className="farms-btn-primary"
            onClick={() => setSeasonModalState({ type: 'createSeason' })}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Add First Season
          </button>
        </div>
      ) : (
        <div className="production-layout">
          {/* Season list sidebar */}
          <div className="production-sidebar-panel">
            <div className="farms-panel-header">
              <h3 className="farms-panel-title">Your Seasons</h3>
              <span className="farms-count-badge">
                {seasons.length} {seasons.length === 1 ? 'Season' : 'Seasons'}
              </span>
            </div>

            <div className="farms-cards-list">
              {seasons.map((season) => (
                <GrowingSeasonCard
                  cropName={getCropName(season.crop)}
                  farmName={getFarmName(season.field)}
                  fieldName={getFieldName(season.field)}
                  isSelected={season.id === selectedSeasonId}
                  key={season.id}
                  onDelete={(s) =>
                    setSeasonModalState({ type: 'deleteSeason', season: s })
                  }
                  onEdit={(s) =>
                    setSeasonModalState({ type: 'editSeason', season: s })
                  }
                  onSelect={() => setSelectedSeasonId(season.id)}
                  season={season}
                  varietyName={getVarietyName(season.variety)}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="production-content-panel">
            {!selectedSeason ? (
              <div className="production-no-season">
                <i aria-hidden="true" className="bi bi-arrow-left-circle" />
                <p>Select a growing season from the list to view its details.</p>
              </div>
            ) : (
              <>
                {/* Season detail header */}
                <div className="season-detail-header">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <h3 className="season-detail-title">
                        {getCropName(selectedSeason.crop)}
                        {getVarietyName(selectedSeason.variety) && (
                          <span
                            style={{
                              fontWeight: 400,
                              color: 'var(--app-muted)',
                              fontSize: '14px',
                              marginLeft: '8px',
                            }}
                          >
                            {getVarietyName(selectedSeason.variety)}
                          </span>
                        )}
                      </h3>
                    </div>
                    <span className={statusBadgeClass(selectedSeason.status)}>
                      {statusLabel(selectedSeason.status)}
                    </span>
                  </div>
                  <div className="season-detail-meta">
                    <span>
                      <i aria-hidden="true" className="bi bi-geo-alt" />
                      {getFarmName(selectedSeason.field)} → {getFieldName(selectedSeason.field)}
                    </span>
                    <span>
                      <i aria-hidden="true" className="bi bi-calendar-event" />
                      Planted {formatDate(selectedSeason.planting_date)}
                    </span>
                    {selectedSeason.expected_harvest_date && (
                      <span>
                        <i aria-hidden="true" className="bi bi-calendar-check" />
                        Expected harvest {formatDate(selectedSeason.expected_harvest_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tab strip */}
                <div
                  aria-label="Season detail sections"
                  className="production-tabs"
                  role="tablist"
                >
                  {TABS.map((tab, index) => (
                    <button
                      aria-controls={`prod-panel-${tab.id}`}
                      aria-selected={activeTab === tab.id}
                      className={`production-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
                      id={`prod-tab-${tab.id}`}
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      onKeyDown={(e) => handleTabKeyDown(e, index)}
                      role="tab"
                      tabIndex={activeTab === tab.id ? 0 : -1}
                      type="button"
                    >
                      <i aria-hidden="true" className={`bi ${tab.icon}`} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Active panel */}
                <div
                  aria-labelledby={`prod-tab-${activeTab}`}
                  id={`prod-panel-${activeTab}`}
                  role="tabpanel"
                >
                  {activeTab === 'activities' && (
                    <ProductionActivitiesPanel season={selectedSeason} />
                  )}
                  {activeTab === 'costs' && (
                    <ProductionCostsPanel season={selectedSeason} />
                  )}
                  {activeTab === 'estimates' && (
                    <HarvestEstimatesPanel season={selectedSeason} />
                  )}
                  {activeTab === 'records' && (
                    <HarvestRecordsPanel season={selectedSeason} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Season Form Modal */}
      <GrowingSeasonFormModal
        allFields={allFields}
        allVarieties={allVarieties}
        crops={crops}
        farms={farms}
        initialSeason={
          seasonModalState.type === 'editSeason' ? seasonModalState.season : null
        }
        isOpen={
          seasonModalState.type === 'createSeason' ||
          seasonModalState.type === 'editSeason'
        }
        onClose={() => setSeasonModalState({ type: 'none' })}
        onSuccess={handleSeasonSuccess}
      />

      {/* Season Delete Modal */}
      <GrowingSeasonDeleteModal
        cropName={
          seasonModalState.type === 'deleteSeason'
            ? getCropName(seasonModalState.season.crop)
            : ''
        }
        farmName={
          seasonModalState.type === 'deleteSeason'
            ? getFarmName(seasonModalState.season.field)
            : ''
        }
        fieldName={
          seasonModalState.type === 'deleteSeason'
            ? getFieldName(seasonModalState.season.field)
            : ''
        }
        isOpen={seasonModalState.type === 'deleteSeason'}
        onClose={() => setSeasonModalState({ type: 'none' })}
        onSuccess={handleSeasonDeleted}
        season={
          seasonModalState.type === 'deleteSeason' ? seasonModalState.season : null
        }
      />
    </div>
  )
}
