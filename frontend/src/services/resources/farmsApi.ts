import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type Farm = {
  id: number
  farmer: number
  name: string
  county: string
  sub_county: string
  ward: string
  village: string
  description: string
  created_at: string
  updated_at: string
}

export type FarmCreateRequest = {
  name: string
  county?: string
  sub_county?: string
  ward?: string
  village?: string
  description?: string
}

export type FarmUpdateRequest = Partial<FarmCreateRequest>

export type Field = {
  id: number
  farm: number
  name: string
  area_hectares: string
  latitude: string | null
  longitude: string | null
  irrigation_available: boolean | null
  created_at: string
  updated_at: string
}

export type FieldCreateRequest = {
  name: string
  area_hectares: string
  latitude?: string | null
  longitude?: string | null
  irrigation_available?: boolean | null
}

export type FieldUpdateRequest = Partial<FieldCreateRequest>

export function validateFieldCoordinates(
  latitude: string | null | undefined,
  longitude: string | null | undefined,
): boolean {
  return (latitude == null) === (longitude == null)
}

async function farmRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listFarms(): Promise<Farm[]> {
  const response = await farmRequest<ApiListResponse<Farm>>('/api/farms/')
  return listResults(response)
}

export async function getFarm(farmId: number): Promise<Farm> {
  return farmRequest<Farm>(`/api/farms/${farmId}/`)
}

export async function createFarm(payload: FarmCreateRequest): Promise<Farm> {
  return farmRequest<Farm>('/api/farms/', {
    method: 'POST',
    body: payload,
  })
}

export async function updateFarm(
  farmId: number,
  payload: FarmUpdateRequest,
): Promise<Farm> {
  return farmRequest<Farm>(`/api/farms/${farmId}/`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteFarm(farmId: number): Promise<void> {
  return farmRequest<void>(`/api/farms/${farmId}/`, {
    method: 'DELETE',
  })
}

export async function listFields(farmId: number): Promise<Field[]> {
  const response = await farmRequest<ApiListResponse<Field>>(
    `/api/farms/${farmId}/fields/`,
  )
  return listResults(response)
}

export async function getField(
  farmId: number,
  fieldId: number,
): Promise<Field> {
  return farmRequest<Field>(
    `/api/farms/${farmId}/fields/${fieldId}/`,
  )
}

export async function createField(
  farmId: number,
  payload: FieldCreateRequest,
): Promise<Field> {
  return farmRequest<Field>(
    `/api/farms/${farmId}/fields/`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

export async function updateField(
  farmId: number,
  fieldId: number,
  payload: FieldUpdateRequest,
): Promise<Field> {
  return farmRequest<Field>(
    `/api/farms/${farmId}/fields/${fieldId}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteField(
  farmId: number,
  fieldId: number,
): Promise<void> {
  return farmRequest<void>(
    `/api/farms/${farmId}/fields/${fieldId}/`,
    {
      method: 'DELETE',
    },
  )
}
