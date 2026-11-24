import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type EstimateSource =
  | 'farmer'
  | 'extension'
  | 'model'
  | 'other'

export type HarvestEstimate = {
  id: number
  growing_season: number
  estimated_on: string
  estimated_quantity: string
  quantity_unit: string
  estimate_source: EstimateSource | ''
  source_reference: string
  notes: string
  created_at: string
  updated_at: string
}

export type HarvestEstimateCreateRequest = {
  growing_season: number
  estimated_on: string
  estimated_quantity: string
  quantity_unit: string
  estimate_source?: EstimateSource | ''
  source_reference?: string
  notes?: string
}

export type HarvestEstimateUpdateRequest =
  Partial<HarvestEstimateCreateRequest>

export type HarvestEstimateListParams = {
  farm_id?: number
  field_id?: number
  crop_id?: number
  growing_season_id?: number
  start_date?: string
  end_date?: string
}

async function estimateRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listHarvestEstimates(
  params?: HarvestEstimateListParams,
): Promise<HarvestEstimate[]> {
  const query = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const response =
    await estimateRequest<ApiListResponse<HarvestEstimate>>(
      `/api/production/harvest-estimates/${query}`,
    )
  return listResults(response)
}

export async function getHarvestEstimate(
  id: number,
): Promise<HarvestEstimate> {
  return estimateRequest<HarvestEstimate>(
    `/api/production/harvest-estimates/${id}/`,
  )
}

export async function createHarvestEstimate(
  payload: HarvestEstimateCreateRequest,
): Promise<HarvestEstimate> {
  return estimateRequest<HarvestEstimate>(
    '/api/production/harvest-estimates/',
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function updateHarvestEstimate(
  id: number,
  payload: HarvestEstimateUpdateRequest,
): Promise<HarvestEstimate> {
  return estimateRequest<HarvestEstimate>(
    `/api/production/harvest-estimates/${id}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteHarvestEstimate(id: number): Promise<void> {
  return estimateRequest<void>(
    `/api/production/harvest-estimates/${id}/`,
    {
      method: 'DELETE',
    },
  )
}
