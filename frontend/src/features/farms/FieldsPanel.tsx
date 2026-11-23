import type { Farm, Field } from '../../services/resources/farmsApi'
import type { FarmFieldsState } from './types'

type FieldsPanelProps = {
  farm: Farm | null
  fieldsState?: FarmFieldsState
  onAddField: () => void
  onEditField: (field: Field) => void
  onDeleteField: (field: Field) => void
  onRetry: () => void
}

export function FieldsPanel({
  farm,
  fieldsState,
  onAddField,
  onEditField,
  onDeleteField,
  onRetry,
}: FieldsPanelProps) {
  if (!farm) {
    return (
      <section className="fields-panel">
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-geo" />
          </div>
          <h3>No farm selected</h3>
          <p>Select a farm on the left to view and manage its parcels and fields.</p>
        </div>
      </section>
    )
  }

  function renderIrrigationBadge(status: boolean | null) {
    if (status === true) {
      return (
        <span className="field-irrigation-tag field-irrigation-tag--yes">
          <i aria-hidden="true" className="bi bi-droplet-fill" />
          Available
        </span>
      )
    }
    if (status === false) {
      return (
        <span className="field-irrigation-tag field-irrigation-tag--no">
          <i aria-hidden="true" className="bi bi-droplet-slash" />
          None
        </span>
      )
    }
    return (
      <span className="field-irrigation-tag field-irrigation-tag--unknown">
        <i aria-hidden="true" className="bi bi-question-circle" />
        Unknown
      </span>
    )
  }

  function formatArea(hectares: string): string {
    const num = parseFloat(hectares)
    if (Number.isNaN(num)) {
      return hectares
    }
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha`
  }

  return (
    <section aria-labelledby="fields-panel-title" className="fields-panel">
      <div className="fields-panel-header">
        <div className="fields-panel-title-group">
          <h3 id="fields-panel-title">{farm.name} — Fields</h3>
          <p className="fields-panel-subtitle">
            {farm.county ? `${farm.county} • ` : ''}
            Manage parcel boundaries, areas, and irrigation infrastructure.
          </p>
        </div>
        <button
          className="farms-btn-primary"
          onClick={onAddField}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add Field
        </button>
      </div>

      {(!fieldsState || fieldsState.status === 'loading') && (
        <div
          aria-busy="true"
          aria-live="polite"
          style={{ padding: '32px 16px', textAlign: 'center' }}
        >
          <div
            className="spinner-border"
            role="status"
            style={{ color: 'var(--app-forest)' }}
          >
            <span className="visually-hidden">Loading fields...</span>
          </div>
          <p style={{ marginTop: '12px', color: 'var(--app-muted)', fontSize: '13px' }}>
            Retrieving fields for {farm.name}...
          </p>
        </div>
      )}

      {fieldsState?.status === 'error' && (
        <div className="farms-alert" role="alert">
          <i aria-hidden="true" className="bi bi-exclamation-circle-fill" />
          <div className="farms-alert-content">
            <strong>Unable to load fields:</strong> {fieldsState.message}
            <div style={{ marginTop: '8px' }}>
              <button
                className="farms-btn-secondary"
                onClick={onRetry}
                style={{ minHeight: '32px', padding: '4px 10px', fontSize: '12px' }}
                type="button"
              >
                <i aria-hidden="true" className="bi bi-arrow-clockwise" />
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {fieldsState?.status === 'success' && fieldsState.fields.length === 0 && (
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-layers" />
          </div>
          <h3>No fields recorded yet</h3>
          <p>
            Create your first field for <strong>{farm.name}</strong> to track plot
            areas, planting seasons, and crops.
          </p>
          <button
            className="farms-btn-primary"
            onClick={onAddField}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Add First Field
          </button>
        </div>
      )}

      {fieldsState?.status === 'success' && fieldsState.fields.length > 0 && (
        <div className="fields-table-wrapper">
          <table className="fields-table">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Area</th>
                <th>Irrigation</th>
                <th>Coordinates (Lat, Lng)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fieldsState.fields.map((field) => (
                <tr key={field.id}>
                  <td className="field-name-cell">{field.name}</td>
                  <td>{formatArea(field.area_hectares)}</td>
                  <td>{renderIrrigationBadge(field.irrigation_available)}</td>
                  <td>
                    {field.latitude != null && field.longitude != null ? (
                      <span className="field-coord-badge">
                        <i aria-hidden="true" className="bi bi-crosshair" />
                        {parseFloat(field.latitude).toFixed(4)},{' '}
                        {parseFloat(field.longitude).toFixed(4)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--app-muted)' }}>Not set</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <button
                        aria-label={`Edit field ${field.name}`}
                        className="farm-card-btn"
                        onClick={() => onEditField(field)}
                        title="Edit field"
                        type="button"
                      >
                        <i aria-hidden="true" className="bi bi-pencil" />
                      </button>
                      <button
                        aria-label={`Delete field ${field.name}`}
                        className="farm-card-btn farm-card-btn--danger"
                        onClick={() => onDeleteField(field)}
                        title="Delete field"
                        type="button"
                      >
                        <i aria-hidden="true" className="bi bi-trash3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
