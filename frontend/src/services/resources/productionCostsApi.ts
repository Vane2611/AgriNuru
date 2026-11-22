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

export async function listProductionCosts(): Promise<ProductionCost[]> {
  const response =
    await productionCostRequest<ApiListResponse<ProductionCost>>(
      '/api/production/costs/',
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
