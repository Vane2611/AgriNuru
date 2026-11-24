import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

// ---------------------------------------------------------------------------
// Choice types
// ---------------------------------------------------------------------------

export type MarketType = 'wholesale' | 'retail' | 'collection_centre'

// ---------------------------------------------------------------------------
// Resource types (mirror backend serializer field shapes exactly)
// ---------------------------------------------------------------------------

export type Market = {
  id: number
  name: string
  market_type: MarketType
  county: string
  sub_county: string
  latitude: string | null
  longitude: string | null
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MarketPrice = {
  id: number
  market: number       // FK id — join against Market list client-side
  crop: number         // FK id — join against Crop list client-side
  quantity_unit: string
  created_at: string
  updated_at: string
}

export type MarketPriceObservation = {
  id: number
  market_price: number // FK id — join against MarketPrice list client-side
  observation_date: string
  price: string        // Decimal returned as string by DRF
  currency: string
  source_name: string
  source_reference: string
  grade: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Filter parameter types (match backend query param names exactly)
// ---------------------------------------------------------------------------

export type MarketListParams = {
  county?: string
  sub_county?: string
}

export type MarketPriceListParams = {
  market_id?: number
  crop_id?: number
  quantity_unit?: string
}

export type MarketPriceObservationListParams = {
  market_price_id?: number
  market_id?: number
  crop_id?: number
  start_date?: string
  end_date?: string
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

async function marketRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

// ---------------------------------------------------------------------------
// Utility: build a query string from a params object, omitting undefined values
// ---------------------------------------------------------------------------

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
// Markets
// ---------------------------------------------------------------------------

export async function listMarkets(
  params?: MarketListParams,
): Promise<Market[]> {
  const query = buildQuery(params)
  const response = await marketRequest<ApiListResponse<Market>>(
    `/api/markets/${query}`,
  )
  return listResults(response)
}

export async function getMarket(marketId: number): Promise<Market> {
  return marketRequest<Market>(`/api/markets/${marketId}/`)
}

// ---------------------------------------------------------------------------
// Market price series
// ---------------------------------------------------------------------------

export async function listPriceSeries(
  params?: MarketPriceListParams,
): Promise<MarketPrice[]> {
  const query = buildQuery(params)
  const response = await marketRequest<ApiListResponse<MarketPrice>>(
    `/api/markets/prices/${query}`,
  )
  return listResults(response)
}

export async function getPriceSeries(seriesId: number): Promise<MarketPrice> {
  return marketRequest<MarketPrice>(`/api/markets/prices/${seriesId}/`)
}

// ---------------------------------------------------------------------------
// Market price observations
// ---------------------------------------------------------------------------

export async function listObservations(
  params?: MarketPriceObservationListParams,
): Promise<MarketPriceObservation[]> {
  const query = buildQuery(params)
  const response = await marketRequest<ApiListResponse<MarketPriceObservation>>(
    `/api/markets/observations/${query}`,
  )
  return listResults(response)
}

export async function getObservation(
  observationId: number,
): Promise<MarketPriceObservation> {
  return marketRequest<MarketPriceObservation>(
    `/api/markets/observations/${observationId}/`,
  )
}
