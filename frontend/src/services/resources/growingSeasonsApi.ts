import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type GrowingSeasonStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'abandoned'

export type GrowingSeason = {
  id: number
  field: number
  crop: number
  variety: number | null
  planting_date: string
  expected_harvest_date: string | null
  actual_harvest_date: string | null
  area_planted_hectares: string | null
  status: GrowingSeasonStatus
  notes: string
  created_at: string
  updated_at: string
}

export type GrowingSeasonCreateRequest = {
  field: number
  crop: number
  variety?: number | null
  planting_date: string
  expected_harvest_date?: string | null
  actual_harvest_date?: string | null
  area_planted_hectares?: string | null
  status?: GrowingSeasonStatus
  notes?: string
}

export type GrowingSeasonUpdateRequest =
  Partial<GrowingSeasonCreateRequest>

async function growingSeasonRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listGrowingSeasons(): Promise<GrowingSeason[]> {
  const response =
    await growingSeasonRequest<ApiListResponse<GrowingSeason>>(
      '/api/production/seasons/',
    )
  return listResults(response)
}

export async function getGrowingSeason(seasonId: number): Promise<GrowingSeason> {
  return growingSeasonRequest<GrowingSeason>(
    `/api/production/seasons/${seasonId}/`,
  )
}

export async function createGrowingSeason(
  payload: GrowingSeasonCreateRequest,
): Promise<GrowingSeason> {
  return growingSeasonRequest<GrowingSeason>('/api/production/seasons/', {
    method: 'POST',
    body: payload,
  })
}

export async function updateGrowingSeason(
  seasonId: number,
  payload: GrowingSeasonUpdateRequest,
): Promise<GrowingSeason> {
  return growingSeasonRequest<GrowingSeason>(
    `/api/production/seasons/${seasonId}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteGrowingSeason(seasonId: number): Promise<void> {
  return growingSeasonRequest<void>(
    `/api/production/seasons/${seasonId}/`,
    {
      method: 'DELETE',
    },
  )
}
