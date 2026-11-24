import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

import {
  listMarkets,
  listObservations,
  listPriceSeries,
  type Market,
  type MarketPrice,
  type MarketPriceObservation,
} from '../../services/resources/marketsApi'
import { listCrops, type Crop } from '../../services/resources/cropsApi'
import type { MarketDetailTab } from './types'
import './markets-page.css'
import '../farms/farms-page.css'

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabDef = {
  id: MarketDetailTab
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { id: 'prices', label: 'Prices', icon: 'bi-tag' },
  { id: 'observations', label: 'Observations', icon: 'bi-clock-history' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function marketTypeLabel(type: Market['market_type']): string {
  switch (type) {
    case 'wholesale':
      return 'Wholesale'
    case 'retail':
      return 'Retail'
    case 'collection_centre':
      return 'Collection Centre'
    default:
      return type
  }
}

function marketTypeBadgeClass(type: Market['market_type']): string {
  switch (type) {
    case 'wholesale':
      return 'market-type-badge market-type--wholesale'
    case 'retail':
      return 'market-type-badge market-type--retail'
    case 'collection_centre':
      return 'market-type-badge market-type--collection-centre'
    default:
      return 'market-type-badge market-type--wholesale'
  }
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getLatestObservation(
  seriesId: number,
  observations: MarketPriceObservation[],
): MarketPriceObservation | null {
  const forSeries = observations.filter((o) => o.market_price === seriesId)
  if (forSeries.length === 0) return null
  // Sort by observation_date DESC, then created_at DESC — do NOT rely on array order
  return [...forSeries].sort((a, b) => {
    const dateDiff = b.observation_date.localeCompare(a.observation_date)
    return dateDiff !== 0 ? dateDiff : b.created_at.localeCompare(a.created_at)
  })[0]
}

function isValidUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [allCrops, setAllCrops] = useState<Crop[]>([])
  const [allSeries, setAllSeries] = useState<MarketPrice[]>([])
  const [observations, setObservations] = useState<MarketPriceObservation[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<MarketDetailTab>('prices')
  const [obsLoading, setObsLoading] = useState(false)
  const [obsError, setObsError] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  // ─── Derived values ───────────────────────────────────────────────────────

  const selectedMarket = markets.find((m) => m.id === selectedMarketId) ?? null

  const cropMap = useMemo(
    () => new Map(allCrops.map((c) => [c.id, c])),
    [allCrops],
  )

  const marketSeriesForSelected = useMemo(
    () => allSeries.filter((s) => s.market === selectedMarketId),
    [allSeries, selectedMarketId],
  )

  // ─── Page data load ───────────────────────────────────────────────────────

  const loadPageData = useCallback(async () => {
    setPageLoading(true)
    setPageError(null)

    try {
      const [fetchedMarkets, fetchedCrops, fetchedSeries] = await Promise.all([
        listMarkets(),
        listCrops(),
        listPriceSeries(),
      ])

      if (!isMountedRef.current) return

      setMarkets(fetchedMarkets)
      setAllCrops(fetchedCrops)
      setAllSeries(fetchedSeries)
      setPageLoading(false)

      // Auto-select first market
      setSelectedMarketId((prev) => {
        if (prev !== null && fetchedMarkets.some((m) => m.id === prev)) {
          return prev
        }
        return fetchedMarkets.length > 0 ? fetchedMarkets[0].id : null
      })
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      setPageLoading(false)
      setPageError(
        err instanceof Error
          ? err.message
          : 'Could not load market data. Check your connection and try again.',
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

  // ─── Observations load on market selection ────────────────────────────────

  useEffect(() => {
    setActiveTab('prices')
    setObservations([])
    setObsError(null)

    if (selectedMarketId === null) return

    let cancelled = false

    async function fetchObs() {
      setObsLoading(true)
      setObsError(null)
      try {
        const fetched = await listObservations({ market_id: selectedMarketId! })
        if (!cancelled && isMountedRef.current) {
          setObservations(fetched)
        }
      } catch (err: unknown) {
        if (!cancelled && isMountedRef.current) {
          setObsError(
            err instanceof Error
              ? err.message
              : 'Could not load price observations.',
          )
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setObsLoading(false)
        }
      }
    }

    void fetchObs()

    return () => {
      cancelled = true
    }
  }, [selectedMarketId])

  // ─── Retry handler ────────────────────────────────────────────────────────

  function handleRetryLoad() {
    void loadPageData()
  }

  // ─── Tab keyboard navigation ──────────────────────────────────────────────

  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextIndex = (index + 1) % TABS.length
      document.getElementById(`markets-tab-${TABS[nextIndex].id}`)?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevIndex = (index - 1 + TABS.length) % TABS.length
      document.getElementById(`markets-tab-${TABS[prevIndex].id}`)?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setActiveTab(TABS[index].id)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="markets-page">
        <div className="markets-header">
          <div>
            <p className="markets-eyebrow">Market Intelligence</p>
            <h2 className="markets-title">Market Prices</h2>
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
      <div className="markets-page">
        <div className="markets-header">
          <div>
            <p className="markets-eyebrow">Market Intelligence</p>
            <h2 className="markets-title">Market Prices</h2>
          </div>
        </div>
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>Could not load market data</h2>
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

  // ─── Observations filtered to the selected market's series ───────────────

  const selectedSeriesIds = new Set(marketSeriesForSelected.map((s) => s.id))
  const visibleObservations = observations.filter((o) =>
    selectedSeriesIds.has(o.market_price),
  )

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="markets-page">
      <div className="markets-header">
        <div>
          <p className="markets-eyebrow">Market Intelligence</p>
          <h2 className="markets-title">Market Prices</h2>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-shop" />
          </div>
          <h3>No active markets found</h3>
          <p>
            No market data has been recorded yet. Check back later for updated
            market prices.
          </p>
        </div>
      ) : (
        <div className="markets-layout">
          {/* ── Left: market list ── */}
          <div className="markets-sidebar-panel">
            <div className="farms-panel-header">
              <h3 className="farms-panel-title">Markets</h3>
              <span className="farms-count-badge">
                {markets.length} {markets.length === 1 ? 'Market' : 'Markets'}
              </span>
            </div>

            <div className="farms-cards-list">
              {markets.map((market) => {
                const seriesCount = allSeries.filter(
                  (s) => s.market === market.id,
                ).length
                const isSelected = market.id === selectedMarketId
                return (
                  <button
                    aria-pressed={isSelected}
                    className={`market-card${isSelected ? ' is-selected' : ''}`}
                    key={market.id}
                    onClick={() => setSelectedMarketId(market.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedMarketId(market.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    type="button"
                  >
                    <div className="market-card-header">
                      <p className="market-card-name">{market.name}</p>
                      <span className={marketTypeBadgeClass(market.market_type)}>
                        {marketTypeLabel(market.market_type)}
                      </span>
                    </div>
                    <div className="market-card-meta">
                      {(market.county || market.sub_county) && (
                        <span>
                          <i aria-hidden="true" className="bi bi-geo-alt" />
                          {[market.county, market.sub_county]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      )}
                      <span>
                        <i aria-hidden="true" className="bi bi-bar-chart-line" />
                        {seriesCount}{' '}
                        {seriesCount === 1 ? 'crop series' : 'crop series'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Right: detail panel ── */}
          <div className="markets-content-panel">
            {!selectedMarket ? (
              <div className="markets-no-selection">
                <i aria-hidden="true" className="bi bi-arrow-left-circle" />
                <p>Select a market from the list to view prices.</p>
              </div>
            ) : (
              <>
                {/* Market detail header */}
                <div className="market-detail-header">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h3 className="market-detail-title">{selectedMarket.name}</h3>
                    <span className={marketTypeBadgeClass(selectedMarket.market_type)}>
                      {marketTypeLabel(selectedMarket.market_type)}
                    </span>
                  </div>
                  <div className="market-detail-meta">
                    {(selectedMarket.county || selectedMarket.sub_county) && (
                      <span>
                        <i aria-hidden="true" className="bi bi-geo-alt" />
                        {[selectedMarket.county, selectedMarket.sub_county]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                    {selectedMarket.description && (
                      <span>
                        <i aria-hidden="true" className="bi bi-info-circle" />
                        {selectedMarket.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tab strip */}
                <div
                  aria-label="Market detail sections"
                  className="markets-tabs"
                  role="tablist"
                >
                  {TABS.map((tab, index) => (
                    <button
                      aria-controls={`markets-panel-${tab.id}`}
                      aria-selected={activeTab === tab.id}
                      className={`markets-tab-btn${activeTab === tab.id ? ' is-active' : ''}`}
                      id={`markets-tab-${tab.id}`}
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

                {/* Tab panel */}
                <div
                  aria-labelledby={`markets-tab-${activeTab}`}
                  id={`markets-panel-${activeTab}`}
                  role="tabpanel"
                >
                  {activeTab === 'prices' && (
                    <PricesPanel
                      cropMap={cropMap}
                      obsLoading={obsLoading}
                      observations={observations}
                      series={marketSeriesForSelected}
                    />
                  )}
                  {activeTab === 'observations' && (
                    <ObservationsPanel
                      allSeries={allSeries}
                      cropMap={cropMap}
                      obsError={obsError}
                      obsLoading={obsLoading}
                      observations={visibleObservations}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prices tab panel
// ---------------------------------------------------------------------------

type PricesPanelProps = {
  series: MarketPrice[]
  observations: MarketPriceObservation[]
  cropMap: Map<number, Crop>
  obsLoading: boolean
}

function PricesPanel({
  series,
  observations,
  cropMap,
  obsLoading,
}: PricesPanelProps) {
  if (series.length === 0) {
    return (
      <div className="farms-empty-state" style={{ marginTop: '8px' }}>
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-tag" />
        </div>
        <h3>No price series recorded</h3>
        <p>No price series have been recorded for this market yet.</p>
      </div>
    )
  }

  return (
    <div className="fields-panel" style={{ marginTop: '8px' }}>
      <div className="fields-table-wrapper">
        <table className="fields-table">
          <thead>
            <tr>
              <th scope="col">Crop</th>
              <th scope="col">Unit</th>
              <th scope="col">Latest Price</th>
              <th scope="col">As Of</th>
              <th scope="col">Grade</th>
            </tr>
          </thead>
          <tbody>
            {obsLoading && observations.length === 0 ? (
              <>
                {[0, 1, 2].map((i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <div
                        className="dashboard-skeleton"
                        style={{ height: '20px', borderRadius: '6px' }}
                      />
                    </td>
                  </tr>
                ))}
              </>
            ) : (
              series.map((s) => {
                const latest = getLatestObservation(s.id, observations)
                const cropName =
                  cropMap.get(s.crop)?.common_name ?? 'Unknown crop'
                return (
                  <tr key={s.id}>
                    <td className="field-name-cell">{cropName}</td>
                    <td>{s.quantity_unit}</td>
                    <td>
                      {latest != null ? (
                        <span>
                          {parseFloat(latest.price).toFixed(2)} {latest.currency}
                        </span>
                      ) : (
                        <span className="price-no-data">
                          — No price recorded —
                        </span>
                      )}
                    </td>
                    <td>
                      {latest != null ? formatDate(latest.observation_date) : '—'}
                    </td>
                    <td>{latest?.grade || '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Observations tab panel
// ---------------------------------------------------------------------------

type ObservationsPanelProps = {
  observations: MarketPriceObservation[]
  allSeries: MarketPrice[]
  cropMap: Map<number, Crop>
  obsLoading: boolean
  obsError: string | null
}

function ObservationsPanel({
  observations,
  allSeries,
  cropMap,
  obsLoading,
  obsError,
}: ObservationsPanelProps) {
  if (obsLoading && observations.length === 0) {
    return (
      <div className="fields-panel" style={{ marginTop: '8px' }}>
        <div className="fields-table-wrapper">
          <table className="fields-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Crop</th>
                <th scope="col">Unit</th>
                <th scope="col">Price</th>
                <th scope="col">Currency</th>
                <th scope="col">Grade</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={7}>
                    <div
                      className="dashboard-skeleton"
                      style={{ height: '20px', borderRadius: '6px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (obsError) {
    return (
      <div className="farms-alert" role="alert" style={{ marginTop: '8px' }}>
        <i aria-hidden="true" className="bi bi-exclamation-triangle-fill" />
        <div className="farms-alert-content">{obsError}</div>
      </div>
    )
  }

  if (observations.length === 0) {
    return (
      <div className="farms-empty-state" style={{ marginTop: '8px' }}>
        <div className="farms-empty-icon">
          <i aria-hidden="true" className="bi bi-clock-history" />
        </div>
        <h3>No observations recorded</h3>
        <p>No price observations have been recorded for this market yet.</p>
      </div>
    )
  }

  // Sort observations by date descending
  const sorted = [...observations].sort((a, b) =>
    b.observation_date.localeCompare(a.observation_date),
  )

  return (
    <div className="fields-panel" style={{ marginTop: '8px' }}>
      <div className="fields-table-wrapper">
        <table className="fields-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Crop</th>
              <th scope="col">Unit</th>
              <th scope="col">Price</th>
              <th scope="col">Currency</th>
              <th scope="col">Grade</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((obs) => {
              const parentSeries = allSeries.find(
                (s) => s.id === obs.market_price,
              )
              const cropName = parentSeries
                ? (cropMap.get(parentSeries.crop)?.common_name ?? 'Unknown crop')
                : 'Unknown crop'
              const quantityUnit = parentSeries?.quantity_unit ?? '—'

              return (
                <tr key={obs.id}>
                  <td>{formatDate(obs.observation_date)}</td>
                  <td className="field-name-cell">{cropName}</td>
                  <td>{quantityUnit}</td>
                  <td>{parseFloat(obs.price).toFixed(2)}</td>
                  <td>{obs.currency}</td>
                  <td>{obs.grade || '—'}</td>
                  <td>
                    {obs.source_name && <span>{obs.source_name}</span>}
                    {obs.source_reference && (
                      <>
                        {obs.source_name && ' '}
                        {isValidUrl(obs.source_reference) ? (
                          <a
                            href={obs.source_reference}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            View source
                          </a>
                        ) : (
                          <span className="obs-source-ref">
                            {obs.source_reference}
                          </span>
                        )}
                      </>
                    )}
                    {!obs.source_name && !obs.source_reference && '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
