import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type ProductionCostCategory =
  | 'seeds'
  | 'fertiliser'
  | 'labour'
  | 'irrigation'
  | 'pest_control'
  | 'land_preparation'
  | 'machinery'
  | 'other'

export type ProductionCostBasis = 'actual' | 'estimated'

export type ProductionCost = {
  id: number
  growing_season: number
  category: ProductionCostCategory
  cost_basis: ProductionCostBasis
  amount: string
  currency: string
  cost_date: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type ProductionCostCreateRequest = {
  growing_season: number
  category: ProductionCostCategory
  cost_basis?: ProductionCostBasis
  amount: string
  currency: string
  cost_date?: string | null
  notes?: string
}

export type ProductionCostUpdateRequest =
  Partial<ProductionCostCreateRequest>

async function productionCostRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export interface ProductionCostListParams {
  farm_id?: number
  field_id?: number
  crop_id?: number
  growing_season_id?: number
  start_date?: string
  end_date?: string
}

export async function listProductionCosts(params?: ProductionCostListParams): Promise<ProductionCost[]> {
  const query = params
    ? '?' + new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const response =
    await productionCostRequest<ApiListResponse<ProductionCost>>(
      `/api/production/costs/${query}`,
    )
  return listResults(response)
}

export async function getProductionCost(costId: number): Promise<ProductionCost> {
  return productionCostRequest<ProductionCost>(
    `/api/production/costs/${costId}/`,
  )
}

export async function createProductionCost(
  payload: ProductionCostCreateRequest,
): Promise<ProductionCost> {
  return productionCostRequest<ProductionCost>('/api/production/costs/', {
    method: 'POST',
    body: payload,
  })
}

export async function updateProductionCost(
  costId: number,
  payload: ProductionCostUpdateRequest,
): Promise<ProductionCost> {
  return productionCostRequest<ProductionCost>(
    `/api/production/costs/${costId}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteProductionCost(costId: number): Promise<void> {
  return productionCostRequest<void>(`/api/production/costs/${costId}/`, {
    method: 'DELETE',
  })
}
