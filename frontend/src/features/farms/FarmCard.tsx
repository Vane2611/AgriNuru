import type { MouseEvent } from 'react'

import type { Farm } from '../../services/resources/farmsApi'
import type { FarmFieldsState } from './types'

type FarmCardProps = {
  farm: Farm
  isSelected: boolean
  fieldsState?: FarmFieldsState
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onRetryFields: () => void
}

export function FarmCard({
  farm,
  isSelected,
  fieldsState,
  onSelect,
  onEdit,
  onDelete,
  onRetryFields,
}: FarmCardProps) {
  const locationParts = [
    farm.village,
    farm.ward,
    farm.sub_county,
    farm.county,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))

  const locationDisplay =
    locationParts.length > 0 ? locationParts.join(', ') : 'Location not specified'

  function handleCardClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onSelect()
  }

  function renderFieldBadge() {
    if (!fieldsState || fieldsState.status === 'loading') {
      return (
        <span
          className="farm-field-badge farm-field-badge--loading"
          title="Loading field count"
        >
          <span
            aria-hidden="true"
            className="spinner-border spinner-border-sm"
            role="status"
            style={{ width: '0.75rem', height: '0.75rem' }}
          />
          Loading fields...
        </span>
      )
    }

    if (fieldsState.status === 'error') {
      return (
        <span className="farm-field-badge farm-field-badge--unavailable">
          <i aria-hidden="true" className="bi bi-exclamation-triangle" />
          Fields unavailable
          <button
            aria-label={`Retry loading fields for ${farm.name}`}
            className="farm-field-badge-retry"
            onClick={(e) => {
              e.stopPropagation()
              onRetryFields()
            }}
            type="button"
          >
            Retry
          </button>
        </span>
      )
    }

    const count = fieldsState.fields.length
    if (count === 0) {
      return (
        <span className="farm-field-badge farm-field-badge--zero">
          <i aria-hidden="true" className="bi bi-layers" />
          0 fields
        </span>
      )
    }

    return (
      <span className="farm-field-badge farm-field-badge--success">
        <i aria-hidden="true" className="bi bi-layers-fill" />
        {count} {count === 1 ? 'field' : 'fields'}
      </span>
    )
  }

  return (
    <article
      aria-current={isSelected ? 'true' : undefined}
      className={`farm-card${isSelected ? ' is-selected' : ''}`}
      onClick={handleCardClick}
    >
      <div className="farm-card-header">
        <div className="farm-card-title-group">
          <h3 className="farm-card-name" title={farm.name}>
            <button
              aria-pressed={isSelected}
              className="farm-card-title-btn"
              onClick={onSelect}
              type="button"
            >
              {farm.name}
            </button>
          </h3>
          <p className="farm-card-location" title={locationDisplay}>
            <i aria-hidden="true" className="bi bi-geo-alt" />
            <span>{locationDisplay}</span>
          </p>
        </div>
        <div className="farm-card-actions">
          <button
            aria-label={`Edit ${farm.name}`}
            className="farm-card-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            title="Edit farm details"
            type="button"
          >
            <i aria-hidden="true" className="bi bi-pencil" />
          </button>
          <button
            aria-label={`Delete ${farm.name}`}
            className="farm-card-btn farm-card-btn--danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            title="Delete farm"
            type="button"
          >
            <i aria-hidden="true" className="bi bi-trash3" />
          </button>
        </div>
      </div>

      {farm.description && (
        <p className="farm-card-description">{farm.description}</p>
      )}

      <div className="farm-card-footer">
        {renderFieldBadge()}
        <span
          className="text-muted"
          style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {isSelected ? (
            <span style={{ color: 'var(--app-forest)', fontWeight: 650 }}>
              <i aria-hidden="true" className="bi bi-check2-circle me-1" />
              Active
            </span>
          ) : (
            <button
              className="farm-card-select-btn"
              onClick={onSelect}
              type="button"
            >
              View fields
            </button>
          )}
        </span>
      </div>
    </article>
  )
}
