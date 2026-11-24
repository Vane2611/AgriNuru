import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type Crop = {
  id: number
  common_name: string
  scientific_name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CropVariety = {
  id: number
  crop: number
  name: string
  description: string
  maturity_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CropRequirement = {
  id: number
  crop: number | null
  variety: number | null
  soil_ph_minimum: string | null
  soil_ph_maximum: string | null
  temperature_minimum_celsius: string | null
  temperature_maximum_celsius: string | null
  rainfall_minimum_mm: string | null
  rainfall_maximum_mm: string | null
  rainfall_period_days: number | null
  soil_type: string
  agro_ecological_zone: string
  other_requirements: string
  source_reference: string
  created_at: string
  updated_at: string
}

async function cropRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listCrops(): Promise<Crop[]> {
  const response = await cropRequest<ApiListResponse<Crop>>('/api/crops/')
  return listResults(response)
}

export async function getCrop(cropId: number): Promise<Crop> {
  return cropRequest<Crop>(`/api/crops/${cropId}/`)
}

export async function listVarietiesForCrop(
  cropId: number,
): Promise<CropVariety[]> {
  const response = await cropRequest<ApiListResponse<CropVariety>>(
    `/api/crops/${cropId}/varieties/`,
  )
  return listResults(response)
}

export async function listVarieties(): Promise<CropVariety[]> {
  const response = await cropRequest<ApiListResponse<CropVariety>>(
    '/api/crops/varieties/',
  )
  return listResults(response)
}

export async function listCropRequirements(
  cropId: number,
): Promise<CropRequirement[]> {
  const response = await cropRequest<ApiListResponse<CropRequirement>>(
    `/api/crops/requirements/?crop_id=${encodeURIComponent(cropId)}`,
  )
  return listResults(response)
}

export async function listVarietyRequirements(
  varietyId: number,
): Promise<CropRequirement[]> {
  const response = await cropRequest<ApiListResponse<CropRequirement>>(
    `/api/crops/requirements/?variety_id=${encodeURIComponent(varietyId)}`,
  )
  return listResults(response)
}
