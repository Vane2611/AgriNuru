import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createFarm,
  createField,
  deleteFarm,
  deleteField,
  listFarms,
  listFields,
  updateFarm,
  updateField,
  type Farm,
  type FarmCreateRequest,
  type Field,
  type FieldCreateRequest,
} from '../../services/resources/farmsApi'
import { FarmCard } from './FarmCard'
import { FarmDeleteModal } from './FarmDeleteModal'
import { FarmFormModal } from './FarmFormModal'
import { FieldDeleteModal } from './FieldDeleteModal'
import { FieldFormModal } from './FieldFormModal'
import { FieldsPanel } from './FieldsPanel'
import type { FarmFieldsState, ModalState } from './types'
import './farms-page.css'

export function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null)
  const [fieldsByFarm, setFieldsByFarm] = useState<Record<number, FarmFieldsState>>({})
  const [pageLoading, setPageLoading] = useState<boolean>(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const [modalState, setModalState] = useState<ModalState>({ type: 'none' })
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const isMountedRef = useRef(true)

  // Auto-dismiss success banner after 4 seconds
  useEffect(() => {
    if (!successBanner) {
      return
    }
    const timer = window.setTimeout(() => {
      setSuccessBanner(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [successBanner])

  const fetchFarmFields = useCallback(async (farmId: number) => {
    setFieldsByFarm((prev) => ({
      ...prev,
      [farmId]: { status: 'loading' },
    }))

    try {
      const fields = await listFields(farmId)
      if (isMountedRef.current) {
        setFieldsByFarm((prev) => ({
          ...prev,
          [farmId]: { status: 'success', fields },
        }))
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setFieldsByFarm((prev) => ({
          ...prev,
          [farmId]: {
            status: 'error',
            message:
              err instanceof Error ? err.message : 'Unable to retrieve fields for this farm.',
          },
        }))
      }
    }
  }, [])

  const loadAllFarmsAndFields = useCallback(async () => {
    try {
      const fetchedFarms = await listFarms()
      if (!isMountedRef.current) {
        return
      }

      setFarms(fetchedFarms)
      setPageLoading(false)

      if (fetchedFarms.length > 0) {
        setSelectedFarmId((prev) => {
          if (prev !== null && fetchedFarms.some((f) => f.id === prev)) {
            return prev
          }
          return fetchedFarms[0].id
        })

        // Fetch fields for each farm concurrently
        for (const farm of fetchedFarms) {
          void fetchFarmFields(farm.id)
        }
      } else {
        setSelectedFarmId(null)
      }
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setPageLoading(false)
        setPageError(
          err instanceof Error
            ? err.message
            : 'Could not load your farm records. Check your connection and try again.',
        )
      }
    }
  }, [fetchFarmFields])

  useEffect(() => {
    isMountedRef.current = true
    void loadAllFarmsAndFields()
    return () => {
      isMountedRef.current = false
    }
  }, [loadAllFarmsAndFields])

  function handleRetryLoad() {
    setPageLoading(true)
    setPageError(null)
    void loadAllFarmsAndFields()
  }

  // Farm CRUD Handlers
  async function handleCreateFarm(payload: FarmCreateRequest) {
    const created = await createFarm(payload)
    setFarms((prev) => [...prev, created])
    setSelectedFarmId(created.id)
    setFieldsByFarm((prev) => ({
      ...prev,
      [created.id]: { status: 'success', fields: [] },
    }))
    setSuccessBanner(`Farm "${created.name}" created successfully.`)
  }

  async function handleUpdateFarm(farmId: number, payload: FarmCreateRequest) {
    const updated = await updateFarm(farmId, payload)
    setFarms((prev) => prev.map((f) => (f.id === farmId ? updated : f)))
    setSuccessBanner(`Farm "${updated.name}" updated successfully.`)
  }

  async function handleDeleteFarm(farm: Farm) {
    await deleteFarm(farm.id)
    const remaining = farms.filter((f) => f.id !== farm.id)
    setFarms(remaining)
    if (selectedFarmId === farm.id) {
      setSelectedFarmId(remaining.length > 0 ? remaining[0].id : null)
    }
    setFieldsByFarm((prev) => {
      const next = { ...prev }
      delete next[farm.id]
      return next
    })
    setSuccessBanner(`Farm "${farm.name}" deleted successfully.`)
  }

  // Field CRUD Handlers
  async function handleCreateField(farmId: number, payload: FieldCreateRequest) {
    const created = await createField(farmId, payload)
    setFieldsByFarm((prev) => {
      const current = prev[farmId]
      const existingFields = current?.status === 'success' ? current.fields : []
      return {
        ...prev,
        [farmId]: {
          status: 'success',
          fields: [...existingFields, created],
        },
      }
    })
    setSuccessBanner(`Field "${created.name}" added successfully.`)
  }

  async function handleUpdateField(
    farmId: number,
    fieldId: number,
    payload: FieldCreateRequest,
  ) {
    const updated = await updateField(farmId, fieldId, payload)
    setFieldsByFarm((prev) => {
      const current = prev[farmId]
      if (current?.status === 'success') {
        return {
          ...prev,
          [farmId]: {
            status: 'success',
            fields: current.fields.map((f) => (f.id === fieldId ? updated : f)),
          },
        }
      }
      return prev
    })
    setSuccessBanner(`Field "${updated.name}" updated successfully.`)
  }

  async function handleDeleteField(farmId: number, field: Field) {
    await deleteField(farmId, field.id)
    setFieldsByFarm((prev) => {
      const current = prev[farmId]
      if (current?.status === 'success') {
        return {
          ...prev,
          [farmId]: {
            status: 'success',
            fields: current.fields.filter((f) => f.id !== field.id),
          },
        }
      }
      return prev
    })
    setSuccessBanner(`Field "${field.name}" deleted successfully.`)
  }

  const selectedFarm = farms.find((f) => f.id === selectedFarmId) ?? null
  const selectedFieldsState =
    selectedFarmId !== null ? fieldsByFarm[selectedFarmId] : undefined

  if (pageLoading) {
    return (
      <div aria-busy="true" aria-live="polite" className="farms-page">
        <div className="farms-header">
          <div>
            <p className="farms-eyebrow">Farm Management</p>
            <h2 className="farms-title">My Farms & Plots</h2>
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

  if (pageError) {
    return (
      <div className="farms-page">
        <div className="farms-header">
          <div>
            <p className="farms-eyebrow">Farm Management</p>
            <h2 className="farms-title">My Farms & Plots</h2>
          </div>
        </div>
        <div className="dashboard-error" role="alert">
          <span aria-hidden="true" className="dashboard-error-icon">
            <i className="bi bi-exclamation-circle" />
          </span>
          <div>
            <h2>Could not retrieve farms</h2>
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

  return (
    <div className="farms-page">
      <div className="farms-header">
        <div>
          <p className="farms-eyebrow">Farm Management</p>
          <h2 className="farms-title">My Farms & Plots</h2>
        </div>
        <button
          className="farms-btn-primary"
          onClick={() => setModalState({ type: 'createFarm' })}
          type="button"
        >
          <i aria-hidden="true" className="bi bi-plus-lg" />
          Add Farm
        </button>
      </div>

      {successBanner && (
        <div className="farms-alert farms-alert-success" role="status">
          <i aria-hidden="true" className="bi bi-check-circle-fill" />
          <div className="farms-alert-content">{successBanner}</div>
          <button
            aria-label="Dismiss message"
            className="farms-alert-dismiss"
            onClick={() => setSuccessBanner(null)}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="farms-alert" role="alert">
          <i aria-hidden="true" className="bi bi-exclamation-triangle-fill" />
          <div className="farms-alert-content">{errorBanner}</div>
          <button
            aria-label="Dismiss error"
            className="farms-alert-dismiss"
            onClick={() => setErrorBanner(null)}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-x-lg" />
          </button>
        </div>
      )}

      {farms.length === 0 ? (
        <div className="farms-empty-state">
          <div className="farms-empty-icon">
            <i aria-hidden="true" className="bi bi-geo-alt" />
          </div>
          <h3>No farms registered yet</h3>
          <p>
            Add your primary farm to get started. You will be able to organize
            individual plots, track crop rotations, and view market insights.
          </p>
          <button
            className="farms-btn-primary"
            onClick={() => setModalState({ type: 'createFarm' })}
            type="button"
          >
            <i aria-hidden="true" className="bi bi-plus-lg" />
            Register Your First Farm
          </button>
        </div>
      ) : (
        <div className="farms-layout">
          <div className="farms-sidebar-panel">
            <div className="farms-panel-header">
              <h3 className="farms-panel-title">Registered Farms</h3>
              <span className="farms-count-badge">
                {farms.length} {farms.length === 1 ? 'Farm' : 'Farms'}
              </span>
            </div>

            <div className="farms-cards-list">
              {farms.map((farm) => (
                <FarmCard
                  farm={farm}
                  fieldsState={fieldsByFarm[farm.id]}
                  isSelected={farm.id === selectedFarmId}
                  key={farm.id}
                  onDelete={() => setModalState({ type: 'deleteFarm', farm })}
                  onEdit={() => setModalState({ type: 'editFarm', farm })}
                  onRetryFields={() => void fetchFarmFields(farm.id)}
                  onSelect={() => setSelectedFarmId(farm.id)}
                />
              ))}
            </div>
          </div>

          <div className="farms-content-panel">
            <FieldsPanel
              farm={selectedFarm}
              fieldsState={selectedFieldsState}
              onAddField={() => {
                if (selectedFarm) {
                  setModalState({
                    type: 'createField',
                    farmId: selectedFarm.id,
                    farmName: selectedFarm.name,
                  })
                }
              }}
              onDeleteField={(field) => {
                if (selectedFarm) {
                  setModalState({
                    type: 'deleteField',
                    farmId: selectedFarm.id,
                    farmName: selectedFarm.name,
                    field,
                  })
                }
              }}
              onEditField={(field) => {
                if (selectedFarm) {
                  setModalState({
                    type: 'editField',
                    farmId: selectedFarm.id,
                    farmName: selectedFarm.name,
                    field,
                  })
                }
              }}
              onRetry={() => {
                if (selectedFarmId !== null) {
                  void fetchFarmFields(selectedFarmId)
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Farm Create Modal */}
      {modalState.type === 'createFarm' && (
        <FarmFormModal
          isOpen
          onClose={() => setModalState({ type: 'none' })}
          onSubmit={handleCreateFarm}
        />
      )}

      {/* Farm Edit Modal */}
      {modalState.type === 'editFarm' && (
        <FarmFormModal
          initialFarm={modalState.farm}
          isOpen
          onClose={() => setModalState({ type: 'none' })}
          onSubmit={async (payload) => {
            if (modalState.type === 'editFarm') {
              await handleUpdateFarm(modalState.farm.id, payload)
            }
          }}
        />
      )}

      {/* Farm Delete Modal */}
      {modalState.type === 'deleteFarm' && (
        <FarmDeleteModal
          farm={modalState.farm}
          onClose={() => setModalState({ type: 'none' })}
          onConfirm={handleDeleteFarm}
        />
      )}

      {/* Field Create Modal */}
      {modalState.type === 'createField' && (
        <FieldFormModal
          farmName={modalState.farmName}
          isOpen
          onClose={() => setModalState({ type: 'none' })}
          onSubmit={async (payload) => {
            if (modalState.type === 'createField') {
              await handleCreateField(modalState.farmId, payload)
            }
          }}
        />
      )}

      {/* Field Edit Modal */}
      {modalState.type === 'editField' && (
        <FieldFormModal
          farmName={modalState.farmName}
          initialField={modalState.field}
          isOpen
          onClose={() => setModalState({ type: 'none' })}
          onSubmit={async (payload) => {
            if (modalState.type === 'editField') {
              await handleUpdateField(
                modalState.farmId,
                modalState.field.id,
                payload,
              )
            }
          }}
        />
      )}

      {/* Field Delete Modal */}
      {modalState.type === 'deleteField' && (
        <FieldDeleteModal
          farmName={modalState.farmName}
          field={modalState.field}
          onClose={() => setModalState({ type: 'none' })}
          onConfirm={async (field) => {
            if (modalState.type === 'deleteField') {
              await handleDeleteField(modalState.farmId, field)
            }
          }}
        />
      )}
    </div>
  )
}
