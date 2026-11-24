import type { KeyboardEvent, MouseEvent } from 'react'

import type { GrowingSeason } from '../../services/resources/growingSeasonsApi'

type GrowingSeasonCardProps = {
  season: GrowingSeason
  cropName: string
  varietyName: string | null
  fieldName: string
  farmName: string
  isSelected: boolean
  onSelect: () => void
  onEdit: (season: GrowingSeason) => void
  onDelete: (season: GrowingSeason) => void
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

export function GrowingSeasonCard({
  season,
  cropName,
  varietyName,
  fieldName,
  farmName,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: GrowingSeasonCardProps) {
  function handleCardClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onSelect()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    } else if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  return (
    <div
      aria-current={isSelected ? 'true' : undefined}
      aria-pressed={isSelected}
      className={`season-card${isSelected ? ' is-selected' : ''}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="season-card-header">
        <h3 className="season-card-title">{cropName}</h3>
        <span className={statusBadgeClass(season.status)}>
          {statusLabel(season.status)}
        </span>
      </div>

      {varietyName && (
        <p className="season-card-variety">{varietyName}</p>
      )}

      <div className="season-card-meta">
        <span>
          <i aria-hidden="true" className="bi bi-geo-alt" />
          {' '}{farmName} → {fieldName}
        </span>
        <span>
          <i aria-hidden="true" className="bi bi-calendar-event" />
          {' '}Planted {formatDate(season.planting_date)}
        </span>
        {season.expected_harvest_date && (
          <span>
            <i aria-hidden="true" className="bi bi-calendar-check" />
            {' '}Expected {formatDate(season.expected_harvest_date)}
          </span>
        )}
      </div>

      <div className="season-card-actions">
        <button
          aria-label={`Edit growing season for ${cropName}`}
          className="farm-card-btn"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(season)
          }}
          title="Edit season"
          type="button"
        >
          <i aria-hidden="true" className="bi bi-pencil" />
        </button>
        <button
          aria-label={`Delete growing season for ${cropName}`}
          className="farm-card-btn farm-card-btn--danger"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(season)
          }}
          title="Delete season"
          type="button"
        >
          <i aria-hidden="true" className="bi bi-trash3" />
        </button>
      </div>
    </div>
  )
}
