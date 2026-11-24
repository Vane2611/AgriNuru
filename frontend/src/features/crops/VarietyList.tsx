import type { CropVariety } from '../../services/resources/cropsApi'

type VarietyListProps = {
  varieties: CropVariety[]
}

export function VarietyList({ varieties }: VarietyListProps) {
  if (varieties.length === 0) {
    return (
      <div className="crop-empty-notice" role="status">
        <i aria-hidden="true" className="bi bi-info-circle" />
        <span>No specific varieties have been catalogued for this crop yet.</span>
      </div>
    )
  }

  return (
    <div className="variety-list">
      {varieties.map((variety) => (
        <article className="variety-card" key={variety.id}>
          <div className="variety-card-header">
            <h5 className="variety-name">{variety.name}</h5>
            {variety.maturity_days !== null && variety.maturity_days > 0 ? (
              <span
                className="variety-maturity-badge variety-maturity-badge--documented"
                title={`Maturity duration: ${variety.maturity_days} days`}
              >
                <i aria-hidden="true" className="bi bi-clock-history" />
                {variety.maturity_days} days to maturity
              </span>
            ) : (
              <span
                className="variety-maturity-badge variety-maturity-badge--missing"
                title="Maturity duration is not yet documented"
              >
                <i aria-hidden="true" className="bi bi-question-circle" />
                Maturity period not documented
              </span>
            )}
          </div>

          {variety.description?.trim() && (
            <p className="variety-description">{variety.description.trim()}</p>
          )}
        </article>
      ))}
    </div>
  )
}
