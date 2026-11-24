import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type HarvestRecord = {
  id: number
  growing_season: number
  harvested_on: string
  quantity: string
  quantity_unit: string
  quality_grade: string
  notes: string
  created_at: string
  updated_at: string
}

export type HarvestRecordCreateRequest = {
  growing_season: number
  harvested_on: string
  quantity: string
  quantity_unit: string
  quality_grade?: string
  notes?: string
}

export type HarvestRecordUpdateRequest =
  Partial<HarvestRecordCreateRequest>

export type HarvestRecordListParams = {
  farm_id?: number
  field_id?: number
  crop_id?: number
  growing_season_id?: number
  start_date?: string
  end_date?: string
}

async function harvestRecordRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listHarvestRecords(
  params?: HarvestRecordListParams,
): Promise<HarvestRecord[]> {
  const query = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const response =
    await harvestRecordRequest<ApiListResponse<HarvestRecord>>(
      `/api/production/harvest-records/${query}`,
    )
  return listResults(response)
}

export async function getHarvestRecord(id: number): Promise<HarvestRecord> {
  return harvestRecordRequest<HarvestRecord>(
    `/api/production/harvest-records/${id}/`,
  )
}

export async function createHarvestRecord(
  payload: HarvestRecordCreateRequest,
): Promise<HarvestRecord> {
  return harvestRecordRequest<HarvestRecord>(
    '/api/production/harvest-records/',
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function updateHarvestRecord(
  id: number,
  payload: HarvestRecordUpdateRequest,
): Promise<HarvestRecord> {
  return harvestRecordRequest<HarvestRecord>(
    `/api/production/harvest-records/${id}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteHarvestRecord(id: number): Promise<void> {
  return harvestRecordRequest<void>(
    `/api/production/harvest-records/${id}/`,
    {
      method: 'DELETE',
    },
  )
}
