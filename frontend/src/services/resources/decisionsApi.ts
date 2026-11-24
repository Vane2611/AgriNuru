import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

// Re-export DecisionReport types from the existing file — do not duplicate
export type {
  DecisionReport,
  DecisionReportStatus,
  DecisionReportCreateRequest,
  DecisionReportUpdateRequest,
} from './decisionReportsApi'
export {
  listDecisionReports,
  getDecisionReport,
  createDecisionReport,
  updateDecisionReport,
  deleteDecisionReport,
} from './decisionReportsApi'

// ---------------------------------------------------------------------------
// Choice types
// ---------------------------------------------------------------------------

export type CropRecommendationStatus =
  | 'generated'
  | 'reviewed'
  | 'accepted'
  | 'dismissed'
  | 'superseded'

export type ProductionPlanStatus =
  | 'draft'
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'superseded'

// ---------------------------------------------------------------------------
// Resource types (mirror serializer field names exactly)
// ---------------------------------------------------------------------------

export type CropRecommendation = {
  id: number
  field: number
  crop: number
  variety: number | null
  generated_at: string
  status: CropRecommendationStatus
  suitability_score: string | null
  explanation: string
  supporting_factors: Record<string, unknown>
  assumptions: Record<string, unknown>
  source_reference: unknown[]
  uncertainty_notes: string
  model_version: string
  created_at: string
  updated_at: string
}

export type CropRecommendationCreateRequest = {
  field: number
  crop: number
  variety?: number | null
  generated_at: string
  status?: CropRecommendationStatus
  suitability_score?: string | null
  explanation?: string
  supporting_factors?: Record<string, unknown>
  assumptions?: Record<string, unknown>
  source_reference?: unknown[]
  uncertainty_notes?: string
  model_version?: string
}

export type CropRecommendationUpdateRequest =
  Partial<CropRecommendationCreateRequest>

export type ProductionPlan = {
  id: number
  field: number
  crop: number
  variety: number | null
  growing_season: number | null
  crop_recommendation: number | null
  estimated_cost: string | null
  currency: string
  expected_yield: string | null
  yield_unit: string
  assumptions: Record<string, unknown>
  source_references: unknown[]
  uncertainty_notes: string
  model_version: string
  status: ProductionPlanStatus
  created_at: string
  updated_at: string
}

export type ProductionPlanCreateRequest = {
  field: number
  crop: number
  variety?: number | null
  growing_season?: number | null
  crop_recommendation?: number | null
  estimated_cost?: string | null
  currency?: string
  expected_yield?: string | null
  yield_unit?: string
  assumptions?: Record<string, unknown>
  source_references?: unknown[]
  uncertainty_notes?: string
  model_version?: string
  status?: ProductionPlanStatus
}

export type ProductionPlanUpdateRequest = Partial<ProductionPlanCreateRequest>

export type MarketComparison = {
  id: number
  decision_report: number
  production_plan: number | null
  price_observation: number
  comparison_date: string
  quantity: string
  estimated_gross_sales_value: string | null
  estimated_transport_cost: string | null
  currency: string
  assumptions: Record<string, unknown>
  uncertainty_notes: string
  estimated_net_return: string | null
  created_at: string
  updated_at: string
}

export type MarketComparisonCreateRequest = {
  decision_report: number
  production_plan?: number | null
  price_observation: number
  comparison_date: string
  quantity: string
  estimated_gross_sales_value?: string | null
  estimated_transport_cost?: string | null
  currency: string
  assumptions?: Record<string, unknown>
  uncertainty_notes?: string
}

export type MarketComparisonUpdateRequest =
  Partial<MarketComparisonCreateRequest>

export type MlStatus = {
  mlp_crop_recommendation: string
  lstm_market_price: string
}

// ---------------------------------------------------------------------------
// Filter params
// ---------------------------------------------------------------------------

export type DecisionListParams = {
  farm_id?: number
  field_id?: number
  crop_id?: number
  status?: string
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function decisionRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

function buildQuery(
  params: Record<string, string | number | undefined> | undefined,
): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  )
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

// ---------------------------------------------------------------------------
// Crop Recommendations
// ---------------------------------------------------------------------------

export async function listRecommendations(
  params?: DecisionListParams,
): Promise<CropRecommendation[]> {
  const query = buildQuery(params)
  const response = await decisionRequest<ApiListResponse<CropRecommendation>>(
    `/api/decisions/recommendations/${query}`,
  )
  return listResults(response)
}

export async function getRecommendation(
  id: number,
): Promise<CropRecommendation> {
  return decisionRequest<CropRecommendation>(
    `/api/decisions/recommendations/${id}/`,
  )
}

export async function createRecommendation(
  payload: CropRecommendationCreateRequest,
): Promise<CropRecommendation> {
  return decisionRequest<CropRecommendation>(
    '/api/decisions/recommendations/',
    { method: 'POST', body: payload },
  )
}

export async function updateRecommendation(
  id: number,
  payload: CropRecommendationUpdateRequest,
): Promise<CropRecommendation> {
  return decisionRequest<CropRecommendation>(
    `/api/decisions/recommendations/${id}/`,
    { method: 'PATCH', body: payload },
  )
}

export async function deleteRecommendation(id: number): Promise<void> {
  return decisionRequest<void>(
    `/api/decisions/recommendations/${id}/`,
    { method: 'DELETE' },
  )
}

// ---------------------------------------------------------------------------
// Production Plans
// ---------------------------------------------------------------------------

export async function listProductionPlans(
  params?: DecisionListParams,
): Promise<ProductionPlan[]> {
  const query = buildQuery(params)
  const response = await decisionRequest<ApiListResponse<ProductionPlan>>(
    `/api/decisions/production-plans/${query}`,
  )
  return listResults(response)
}

export async function getProductionPlan(id: number): Promise<ProductionPlan> {
  return decisionRequest<ProductionPlan>(
    `/api/decisions/production-plans/${id}/`,
  )
}

export async function createProductionPlan(
  payload: ProductionPlanCreateRequest,
): Promise<ProductionPlan> {
  return decisionRequest<ProductionPlan>(
    '/api/decisions/production-plans/',
    { method: 'POST', body: payload },
  )
}

export async function updateProductionPlan(
  id: number,
  payload: ProductionPlanUpdateRequest,
): Promise<ProductionPlan> {
  return decisionRequest<ProductionPlan>(
    `/api/decisions/production-plans/${id}/`,
    { method: 'PATCH', body: payload },
  )
}

export async function deleteProductionPlan(id: number): Promise<void> {
  return decisionRequest<void>(
    `/api/decisions/production-plans/${id}/`,
    { method: 'DELETE' },
  )
}

// ---------------------------------------------------------------------------
// Market Comparisons
// ---------------------------------------------------------------------------

export async function listMarketComparisons(
  params?: DecisionListParams,
): Promise<MarketComparison[]> {
  const query = buildQuery(params)
  const response = await decisionRequest<ApiListResponse<MarketComparison>>(
    `/api/decisions/market-comparisons/${query}`,
  )
  return listResults(response)
}

export async function getMarketComparison(
  id: number,
): Promise<MarketComparison> {
  return decisionRequest<MarketComparison>(
    `/api/decisions/market-comparisons/${id}/`,
  )
}

export async function createMarketComparison(
  payload: MarketComparisonCreateRequest,
): Promise<MarketComparison> {
  return decisionRequest<MarketComparison>(
    '/api/decisions/market-comparisons/',
    { method: 'POST', body: payload },
  )
}

export async function updateMarketComparison(
  id: number,
  payload: MarketComparisonUpdateRequest,
): Promise<MarketComparison> {
  return decisionRequest<MarketComparison>(
    `/api/decisions/market-comparisons/${id}/`,
    { method: 'PATCH', body: payload },
  )
}

export async function deleteMarketComparison(id: number): Promise<void> {
  return decisionRequest<void>(
    `/api/decisions/market-comparisons/${id}/`,
    { method: 'DELETE' },
  )
}

// ---------------------------------------------------------------------------
// ML Status
// ---------------------------------------------------------------------------

export async function getMlStatus(): Promise<MlStatus> {
  return decisionRequest<MlStatus>('/api/decisions/ml-status/')
}
