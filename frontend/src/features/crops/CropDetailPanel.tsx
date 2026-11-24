import type { Crop, CropRequirement, CropVariety } from '../../services/resources/cropsApi'
import { RequirementCard } from './RequirementCard'
import { VarietyList } from './VarietyList'

type CropDetailPanelProps = {
  crop: Crop | null
  varieties: CropVariety[]
  requirements: CropRequirement[]
  loadingVarieties?: boolean
  loadingRequirements?: boolean
  requirementsError?: string | null
  onRetryRequirements?: () => void
}

export function CropDetailPanel({
  crop,
  varieties,
  requirements,
  loadingVarieties = false,
  loadingRequirements = false,
  requirementsError = null,
  onRetryRequirements,
}: CropDetailPanelProps) {
  if (!crop) {
    return (
      <section className="crop-detail-panel">
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-flower1" />
          </div>
          <h3>No crop selected</h3>
          <p>
            Select a crop from the library on the left to view botanical
            characteristics, catalogued varieties, and agronomic growing conditions.
          </p>
        </div>
      </section>
    )
  }

  const scientificName = crop.scientific_name?.trim()

  return (
    <section aria-labelledby="crop-detail-title" className="crop-detail-panel">
      <div className="crop-detail-header">
        <div className="crop-detail-title-group">
          <h3 id="crop-detail-title">{crop.common_name}</h3>
          {scientificName && (
            <p className="crop-detail-scientific">{scientificName}</p>
          )}
        </div>
      </div>

      <div className="crop-detail-section">
        <h4 className="crop-detail-section-title">
          <i aria-hidden="true" className="bi bi-card-text" />
          Overview
        </h4>
        {crop.description?.trim() ? (
          <p className="crop-detail-description">{crop.description.trim()}</p>
        ) : (
          <p className="crop-detail-description crop-detail-description--empty">
            No general botanical description has been recorded for this crop.
          </p>
        )}
      </div>

      <div className="crop-detail-section">
        <h4 className="crop-detail-section-title">
          <i aria-hidden="true" className="bi bi-thermometer-sun" />
          Agronomic Requirements
        </h4>
        {requirementsError ? (
          <div
            className="crop-empty-notice"
            role="alert"
            style={{
              borderColor: '#e8cbca',
              background: '#fdf7f7',
              color: '#7a2720',
            }}
          >
            <i
              aria-hidden="true"
              className="bi bi-exclamation-triangle"
              style={{ color: '#b53a30' }}
            />
            <div style={{ flex: 1 }}>
              <strong style={{ display: 'block', marginBottom: '2px' }}>
                Could not retrieve requirements
              </strong>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px' }}>
                {requirementsError}
              </p>
              {onRetryRequirements && (
                <button
                  className="farms-btn-secondary"
                  onClick={onRetryRequirements}
                  style={{
                    minHeight: '28px',
                    padding: '3px 10px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                  }}
                  type="button"
                >
                  <i aria-hidden="true" className="bi bi-arrow-clockwise me-1" />
                  Retry
                </button>
              )}
            </div>
          </div>
        ) : loadingRequirements ? (
          <div
            aria-busy="true"
            aria-live="polite"
            style={{ padding: '24px 16px', textAlign: 'center' }}
          >
            <div
              className="spinner-border spinner-border-sm"
              role="status"
              style={{ color: 'var(--app-forest)' }}
            >
              <span className="visually-hidden">Loading requirements...</span>
            </div>
            <p style={{ marginTop: '8px', color: 'var(--app-muted)', fontSize: '12.5px' }}>
              Retrieving documented requirements...
            </p>
          </div>
        ) : (
          <RequirementCard requirements={requirements} />
        )}
      </div>

      <div className="crop-detail-section">
        <h4 className="crop-detail-section-title">
          <i aria-hidden="true" className="bi bi-layers" />
          Documented Varieties ({varieties.length})
        </h4>
        {loadingVarieties ? (
          <div
            aria-busy="true"
            aria-live="polite"
            style={{ padding: '24px 16px', textAlign: 'center' }}
          >
            <div
              className="spinner-border spinner-border-sm"
              role="status"
              style={{ color: 'var(--app-forest)' }}
            >
              <span className="visually-hidden">Loading varieties...</span>
            </div>
            <p style={{ marginTop: '8px', color: 'var(--app-muted)', fontSize: '12.5px' }}>
              Retrieving catalogued varieties...
            </p>
          </div>
        ) : (
          <VarietyList varieties={varieties} />
        )}
      </div>
    </section>
  )
}
