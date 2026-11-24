import type { MouseEvent } from 'react'

import type { Crop } from '../../services/resources/cropsApi'

type CropCardProps = {
  crop: Crop
  isSelected: boolean
  varietyCount?: number
  onSelect: () => void
}

export function CropCard({
  crop,
  isSelected,
  varietyCount,
  onSelect,
}: CropCardProps) {
  const scientificName = crop.scientific_name?.trim()

  function handleCardClick(e: MouseEvent<HTMLElement>) {
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    onSelect()
  }

  function renderVarietyBadge() {
    if (varietyCount === undefined) {
      return (
        <span className="crop-variety-badge" title="Varieties count">
          <i aria-hidden="true" className="bi bi-layers" />
          Varieties
        </span>
      )
    }

    if (varietyCount === 0) {
      return (
        <span
          className="crop-variety-badge crop-variety-badge--zero"
          title="No recorded varieties"
        >
          <i aria-hidden="true" className="bi bi-layers" />
          0 varieties
        </span>
      )
    }

    return (
      <span
        className="crop-variety-badge"
        title={`${varietyCount} documented varieties`}
      >
        <i aria-hidden="true" className="bi bi-layers-fill" />
        {varietyCount} {varietyCount === 1 ? 'variety' : 'varieties'}
      </span>
    )
  }

  return (
    <article
      aria-current={isSelected ? 'true' : undefined}
      className={`crop-card${isSelected ? ' is-selected' : ''}`}
      onClick={handleCardClick}
    >
      <div className="crop-card-header">
        <div className="crop-card-title-group">
          <h3 className="crop-card-name" title={crop.common_name}>
            <button
              aria-pressed={isSelected}
              className="crop-card-title-btn"
              onClick={onSelect}
              type="button"
            >
              {crop.common_name}
            </button>
          </h3>
          {scientificName && (
            <p className="crop-card-scientific" title={scientificName}>
              {scientificName}
            </p>
          )}
        </div>
      </div>

      {crop.description?.trim() && (
        <p className="crop-card-description">{crop.description.trim()}</p>
      )}

      <div className="crop-card-footer">
        {renderVarietyBadge()}
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
            <span aria-hidden="true" className="crop-card-select-btn">
              View crop
            </span>
          )}
        </span>
      </div>
    </article>
  )
}
