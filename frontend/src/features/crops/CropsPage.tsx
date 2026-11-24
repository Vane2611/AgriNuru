import { useEffect, useMemo, useRef, useState } from 'react'

import {
  listCropRequirements,
  listCrops,
  listVarieties,
  listVarietyRequirements,
  type Crop,
  type CropRequirement,
  type CropVariety,
} from '../../services/resources/cropsApi'
import { CropCard } from './CropCard'
import { CropDetailPanel } from './CropDetailPanel'
import './crops-page.css'

type VarietyFilter = 'all' | 'with_varieties'

type CropDetails = {
  varieties: CropVariety[]
  requirements: CropRequirement[]
}

export function CropsPage() {
  const [crops, setCrops] = useState<Crop[]>([])
  const [varieties, setVarieties] = useState<CropVariety[]>([])
  const [userSelectedCropId, setUserSelectedCropId] = useState<number | null>(null)
  const [pageLoading, setPageLoading] = useState<boolean>(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [varietyFilter, setVarietyFilter] = useState<VarietyFilter>('all')

  const [cropDetailsCache, setCropDetailsCache] = useState<Record<number, CropDetails>>({})
  const [loadingCropId, setLoadingCropId] = useState<number | null>(null)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const activeCropIdRef = useRef<number | null>(null)

  // Map varieties by parent crop ID
  const varietiesByCropId = useMemo(() => {
    const map = new Map<number, CropVariety[]>()
    for (const v of varieties) {
      const list = map.get(v.crop) ?? []
      list.push(v)
      map.set(v.crop, list)
    }
    return map
  }, [varieties])

  // Filter crops based on search query and variety filter
  const filteredCrops = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return crops.filter((crop) => {
      const cropVarieties = varietiesByCropId.get(crop.id) ?? []
      const varietyCount = cropVarieties.length

      if (varietyFilter === 'with_varieties' && varietyCount === 0) {
        return false
      }

      if (!query) {
        return true
      }

      const matchesCommon = crop.common_name.toLowerCase().includes(query)
      const matchesScientific = crop.scientific_name?.toLowerCase().includes(query)
      const matchesVariety = cropVarieties.some((v) =>
        v.name.toLowerCase().includes(query),
      )

      return matchesCommon || matchesScientific || matchesVariety
    })
  }, [crops, varietiesByCropId, varietyFilter, searchQuery])

  // Derive active crop selection: prefer explicit selection if in filtered crops, otherwise default to first filtered crop
  const activeSelectedCropId = useMemo(() => {
    if (filteredCrops.length === 0) {
      return null
    }
    if (
      userSelectedCropId !== null &&
      filteredCrops.some((c) => c.id === userSelectedCropId)
    ) {
      return userSelectedCropId
    }
    return filteredCrops[0].id
  }, [filteredCrops, userSelectedCropId])

  // Load catalog on initial mount
  useEffect(() => {
    isMountedRef.current = true

    async function loadCatalog() {
      try {
        const [cropsData, varietiesData] = await Promise.all([
          listCrops(),
          listVarieties(),
        ])

        if (!isMountedRef.current) {
          return
        }

        setCrops(cropsData)
        setVarieties(varietiesData)
        setPageLoading(false)
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return
        }
        setPageLoading(false)
        setPageError(
          err instanceof Error
            ? err.message
            : 'Could not load the crop catalogue. Please check your network and try again.',
        )
      }
    }

    void loadCatalog()

    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Fetch requirements for active crop with caching and race-condition prevention
  useEffect(() => {
    if (activeSelectedCropId === null || cropDetailsCache[activeSelectedCropId]) {
      return
    }

    const targetCropId = activeSelectedCropId
    activeCropIdRef.current = targetCropId

    async function fetchCropDetails() {
      setLoadingCropId(targetCropId)
      setRequirementsError(null)

      try {
        const cropVarieties = varietiesByCropId.get(targetCropId) ?? []

        // Load crop-level requirements and variety requirements concurrently
        const [cropReqs, varietyReqsArrays] = await Promise.all([
          listCropRequirements(targetCropId),
          Promise.all(
            cropVarieties.map((v) =>
              listVarietyRequirements(v.id).catch(() => [] as CropRequirement[]),
            ),
          ),
        ])

        if (!isMountedRef.current) {
          return
        }

        const combinedReqs = [...cropReqs, ...varietyReqsArrays.flat()]

        setCropDetailsCache((prev) => ({
          ...prev,
          [targetCropId]: {
            varieties: cropVarieties,
            requirements: combinedReqs,
          },
        }))
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return
        }
        if (activeCropIdRef.current === targetCropId) {
          setRequirementsError(
            err instanceof Error
              ? err.message
              : 'Could not retrieve agronomic requirements for this crop.',
          )
        }
      } finally {
        if (isMountedRef.current && activeCropIdRef.current === targetCropId) {
          setLoadingCropId(null)
        }
      }
    }

    void fetchCropDetails()
  }, [activeSelectedCropId, cropDetailsCache, varietiesByCropId])

  function handleRetryCatalog() {
    setPageLoading(true)
    setPageError(null)
    void (async () => {
      try {
        const [cropsData, varietiesData] = await Promise.all([
          listCrops(),
          listVarieties(),
        ])
        if (!isMountedRef.current) {
          return
        }
        setCrops(cropsData)
        setVarieties(varietiesData)
        setPageLoading(false)
      } catch (err: unknown) {
        if (!isMountedRef.current) {
          return
        }
        setPageLoading(false)
        setPageError(
          err instanceof Error
            ? err.message
            : 'Could not load the crop catalogue. Please check your network and try again.',
        )
      }
    })()
  }

  function handleRetryRequirements() {
    if (activeSelectedCropId === null) {
      return
    }
    // Remove from cache to force reload
    setCropDetailsCache((prev) => {
      const next = { ...prev }
      delete next[activeSelectedCropId]
      return next
    })
  }

  const selectedCrop = useMemo(() => {
    if (activeSelectedCropId === null) {
      return null
    }
    return crops.find((c) => c.id === activeSelectedCropId) ?? null
  }, [crops, activeSelectedCropId])

  const selectedVarieties = useMemo(() => {
    if (activeSelectedCropId === null) {
      return []
    }
    return (
      cropDetailsCache[activeSelectedCropId]?.varieties ??
      varietiesByCropId.get(activeSelectedCropId) ??
      []
    )
  }, [activeSelectedCropId, cropDetailsCache, varietiesByCropId])

  const selectedRequirements = useMemo(() => {
    if (activeSelectedCropId === null) {
      return []
    }
    return cropDetailsCache[activeSelectedCropId]?.requirements ?? []
  }, [activeSelectedCropId, cropDetailsCache])

  const isLoadingRequirements =
    activeSelectedCropId !== null &&
    !cropDetailsCache[activeSelectedCropId] &&
    loadingCropId === activeSelectedCropId

  // Initial catalogue loading skeleton
  if (pageLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="crops-page">
        <div className="crops-header">
          <div>
            <p className="crops-eyebrow">Agronomic Knowledge Base</p>
            <h2 className="crops-title">Crop Library</h2>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            gap: '20px',
            marginTop: '12px',
          }}
        >
          <div
            className="dashboard-skeleton"
            style={{ minHeight: '400px', borderRadius: '12px' }}
          />
          <div
            className="dashboard-skeleton"
            style={{ minHeight: '400px', borderRadius: '14px' }}
          />
        </div>
      </div>
    )
  }

  // Catalogue load error
  if (pageError) {
    return (
      <div className="crops-page">
        <div className="crops-header">
          <div>
            <p className="crops-eyebrow">Agronomic Knowledge Base</p>
            <h2 className="crops-title">Crop Library</h2>
          </div>
        </div>
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>Could not retrieve crop catalogue</h2>
            <p>{pageError}</p>
          </div>
          <button
            className="dashboard-secondary-button"
            onClick={handleRetryCatalog}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-arrow-clockwise" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Entire catalogue empty
  if (crops.length === 0) {
    return (
      <div className="crops-page">
        <div className="crops-header">
          <div>
            <p className="crops-eyebrow">Agronomic Knowledge Base</p>
            <h2 className="crops-title">Crop Library</h2>
          </div>
        </div>
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-flower1" />
          </div>
          <h3>No crops catalogued yet</h3>
          <p>
            Agronomic crops and growing requirements will appear here once registered
            by agricultural specialists.
          </p>
        </div>
      </div>
    )
  }

  const cropsWithVarietiesCount = crops.filter(
    (c) => (varietiesByCropId.get(c.id) ?? []).length > 0,
  ).length

  return (
    <div className="crops-page">
      <div className="crops-header">
        <div>
          <p className="crops-eyebrow">Agronomic Knowledge Base</p>
          <h2 className="crops-title">Crop Library</h2>
        </div>
      </div>

      <div className="crops-layout">
        {/* Left Column: Search, Filters & Crop Cards */}
        <section aria-label="Crop directory" className="crops-sidebar-panel">
          <div className="crops-controls">
            <div className="crops-search-box">
              <i aria-hidden="true" className="bi bi-search crops-search-icon" />
              <input
                aria-label="Search crops by common name, scientific name, or variety"
                className="crops-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search common, scientific or variety..."
                type="search"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  aria-label="Clear search input"
                  className="crops-search-clear"
                  onClick={() => setSearchQuery('')}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-x-lg" />
                </button>
              )}
            </div>

            <div
              aria-label="Filter crops by variety status"
              className="crops-filter-group"
              role="radiogroup"
            >
              <button
                aria-checked={varietyFilter === 'all'}
                className={`crops-filter-btn${varietyFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setVarietyFilter('all')}
                role="radio"
                type="button"
              >
                All Crops ({crops.length})
              </button>
              <button
                aria-checked={varietyFilter === 'with_varieties'}
                className={`crops-filter-btn${varietyFilter === 'with_varieties' ? ' is-active' : ''}`}
                onClick={() => setVarietyFilter('with_varieties')}
                role="radio"
                type="button"
              >
                With Varieties ({cropsWithVarietiesCount})
              </button>
            </div>
          </div>

          <div className="crops-panel-header">
            <h3 className="crops-panel-title">Documented Crops</h3>
            <span
              aria-label={`${filteredCrops.length} of ${crops.length} crops showing`}
              className="crops-count-badge"
            >
              {filteredCrops.length} / {crops.length}
            </span>
          </div>

          {filteredCrops.length === 0 ? (
            <div className="crop-empty-notice" role="status">
              <i aria-hidden="true" className="bi bi-search" />
              <div>
                <strong style={{ display: 'block', color: 'var(--app-forest)' }}>
                  No matching crops found
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#62756a' }}>
                  No catalogued crops match your current search and filter criteria.
                </p>
              </div>
            </div>
          ) : (
            <div className="crops-cards-list">
              {filteredCrops.map((crop) => {
                const cropVarieties = varietiesByCropId.get(crop.id) ?? []
                return (
                  <CropCard
                    crop={crop}
                    isSelected={crop.id === activeSelectedCropId}
                    key={crop.id}
                    onSelect={() => setUserSelectedCropId(crop.id)}
                    varietyCount={cropVarieties.length}
                  />
                )
              })}
            </div>
          )}
        </section>

        {/* Right Column: Selected Crop Detail Panel */}
        <div className="crops-detail-wrapper">
          <CropDetailPanel
            crop={selectedCrop}
            loadingRequirements={isLoadingRequirements}
            onRetryRequirements={handleRetryRequirements}
            requirements={selectedRequirements}
            requirementsError={requirementsError}
            varieties={selectedVarieties}
          />
        </div>
      </div>
    </div>
  )
}
