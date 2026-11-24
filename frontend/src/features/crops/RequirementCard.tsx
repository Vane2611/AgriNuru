import type { CropRequirement } from '../../services/resources/cropsApi'

type RequirementCardProps = {
  requirements: CropRequirement[]
}

export function RequirementCard({ requirements }: RequirementCardProps) {
  if (requirements.length === 0) {
    return (
      <div className="crop-empty-notice" role="status">
        <i aria-hidden="true" className="bi bi-info-circle" />
        <span>Agronomic requirements have not yet been documented for this crop.</span>
      </div>
    )
  }

  function formatRange(
    min: string | null,
    max: string | null,
    unit: string,
  ): string | null {
    const hasMin = min != null && min.trim() !== ''
    const hasMax = max != null && max.trim() !== ''

    if (hasMin && hasMax) {
      if (min === max) {
        return `${min} ${unit}`
      }
      return `${min} – ${max} ${unit}`
    }
    if (hasMin) {
      return `≥ ${min} ${unit}`
    }
    if (hasMax) {
      return `≤ ${max} ${unit}`
    }
    return null
  }

  function formatRainfall(req: CropRequirement): string | null {
    const depthRange = formatRange(
      req.rainfall_minimum_mm,
      req.rainfall_maximum_mm,
      'mm',
    )
    if (!depthRange) {
      return null
    }

    if (req.rainfall_period_days !== null && req.rainfall_period_days > 0) {
      return `${depthRange} (over ${req.rainfall_period_days} days)`
    }
    return depthRange
  }

  return (
    <div className="requirements-container">
      {requirements.map((req, index) => {
        const phValue = formatRange(req.soil_ph_minimum, req.soil_ph_maximum, 'pH')
        const tempValue = formatRange(
          req.temperature_minimum_celsius,
          req.temperature_maximum_celsius,
          '°C',
        )
        const rainfallValue = formatRainfall(req)
        const soilType = req.soil_type?.trim()
        const agroZone = req.agro_ecological_zone?.trim()
        const otherNotes = req.other_requirements?.trim()
        const hasAnyMetric = Boolean(
          phValue || tempValue || rainfallValue || soilType || agroZone,
        )

        return (
          <article className="requirement-card" key={req.id}>
            {requirements.length > 1 && (
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: 'var(--app-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Requirement Profile #{index + 1}
              </div>
            )}

            {hasAnyMetric && (
              <div className="requirement-grid">
                {phValue && (
                  <div className="requirement-metric">
                    <span aria-hidden="true" className="requirement-metric-icon">
                      <i className="bi bi-droplet-half" />
                    </span>
                    <div className="requirement-metric-body">
                      <p className="requirement-metric-label">Soil pH</p>
                      <p className="requirement-metric-value">{phValue}</p>
                    </div>
                  </div>
                )}

                {tempValue && (
                  <div className="requirement-metric">
                    <span aria-hidden="true" className="requirement-metric-icon">
                      <i className="bi bi-thermometer-half" />
                    </span>
                    <div className="requirement-metric-body">
                      <p className="requirement-metric-label">Temperature</p>
                      <p className="requirement-metric-value">{tempValue}</p>
                    </div>
                  </div>
                )}

                {rainfallValue && (
                  <div className="requirement-metric">
                    <span aria-hidden="true" className="requirement-metric-icon">
                      <i className="bi bi-cloud-rain" />
                    </span>
                    <div className="requirement-metric-body">
                      <p className="requirement-metric-label">Rainfall Depth</p>
                      <p className="requirement-metric-value">{rainfallValue}</p>
                    </div>
                  </div>
                )}

                {soilType && (
                  <div className="requirement-metric">
                    <span aria-hidden="true" className="requirement-metric-icon">
                      <i className="bi bi-layers" />
                    </span>
                    <div className="requirement-metric-body">
                      <p className="requirement-metric-label">Soil Type</p>
                      <p className="requirement-metric-value">{soilType}</p>
                    </div>
                  </div>
                )}

                {agroZone && (
                  <div className="requirement-metric">
                    <span aria-hidden="true" className="requirement-metric-icon">
                      <i className="bi bi-globe2" />
                    </span>
                    <div className="requirement-metric-body">
                      <p className="requirement-metric-label">Agro-Ecological Zone</p>
                      <p className="requirement-metric-value">{agroZone}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {otherNotes && (
              <div className="requirement-notes">
                <strong style={{ color: 'var(--app-forest)', display: 'block', marginBottom: '4px' }}>
                  <i aria-hidden="true" className="bi bi-info-circle me-1" />
                  Additional Conditions:
                </strong>
                {otherNotes}
              </div>
            )}

            {req.source_reference?.trim() && (
              <p className="requirement-source" title={req.source_reference}>
                <i aria-hidden="true" className="bi bi-journal-bookmark" />
                <span>Source: {req.source_reference.trim()}</span>
              </p>
            )}
          </article>
        )
      })}
    </div>
  )
}
