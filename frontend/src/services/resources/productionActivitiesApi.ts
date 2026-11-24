import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type ActivityType =
  | 'land_preparation'
  | 'planting'
  | 'irrigation'
  | 'fertiliser_application'
  | 'pest_control'
  | 'weeding'
  | 'other'

export type ProductionActivity = {
  id: number
  growing_season: number
  activity_type: ActivityType
  activity_date: string
  notes: string
  created_at: string
  updated_at: string
}

export type ProductionActivityCreateRequest = {
  growing_season: number
  activity_type: ActivityType
  activity_date: string
  notes?: string
}

export type ProductionActivityUpdateRequest =
  Partial<ProductionActivityCreateRequest>

export type ProductionActivityListParams = {
  farm_id?: number
  field_id?: number
  crop_id?: number
  growing_season_id?: number
  start_date?: string
  end_date?: string
}

async function activityRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listProductionActivities(
  params?: ProductionActivityListParams,
): Promise<ProductionActivity[]> {
  const query = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const response =
    await activityRequest<ApiListResponse<ProductionActivity>>(
      `/api/production/activities/${query}`,
    )
  return listResults(response)
}

export async function getProductionActivity(
  id: number,
): Promise<ProductionActivity> {
  return activityRequest<ProductionActivity>(
    `/api/production/activities/${id}/`,
  )
}

export async function createProductionActivity(
  payload: ProductionActivityCreateRequest,
): Promise<ProductionActivity> {
  return activityRequest<ProductionActivity>('/api/production/activities/', {
    method: 'POST',
    body: payload,
  })
}

export async function updateProductionActivity(
  id: number,
  payload: ProductionActivityUpdateRequest,
): Promise<ProductionActivity> {
  return activityRequest<ProductionActivity>(
    `/api/production/activities/${id}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteProductionActivity(id: number): Promise<void> {
  return activityRequest<void>(`/api/production/activities/${id}/`, {
    method: 'DELETE',
  })
}
