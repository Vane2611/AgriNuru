import type { Crop } from '../../services/resources/cropsApi'
import type {
  Market,
  MarketPrice,
  MarketPriceObservation,
} from '../../services/resources/marketsApi'

// ---------------------------------------------------------------------------
// Re-export API types so page components only need to import from one place
// ---------------------------------------------------------------------------

export type { Market, MarketPrice, MarketPriceObservation, Crop }

// ---------------------------------------------------------------------------
// View-model types (client-side joins — no new backend fields)
// ---------------------------------------------------------------------------

/**
 * A MarketPrice with its related Market and Crop resolved from the client-side
 * lookup maps.  Used for display in tables and cards.
 */
export type EnrichedPriceSeries = MarketPrice & {
  marketName: string
  marketType: Market['market_type']
  cropName: string
}

/**
 * A MarketPriceObservation with the parent series details resolved.
 * Used when displaying observations without having to re-join every row.
 */
export type EnrichedObservation = MarketPriceObservation & {
  marketName: string
  cropName: string
  quantityUnit: string
}

/**
 * The latest price observation attached to a price series, used to show a
 * "current price" summary on the market detail view.  null when the series
 * has no observations yet.
 */
export type LatestPrice = {
  price: string
  currency: string
  observation_date: string
  grade: string
} | null

// ---------------------------------------------------------------------------
// Tab state for the market detail panel
// ---------------------------------------------------------------------------

/** Tabs rendered in the right-hand detail panel for a selected market. */
export type MarketDetailTab = 'prices' | 'observations'

// ---------------------------------------------------------------------------
// Page-level loading state shape
// ---------------------------------------------------------------------------

/**
 * Tracks which async data is in flight at page load.
 * Kept as a simple flag rather than a discriminated union because the three
 * sources load in parallel and we only need to know when all are done.
 */
export type MarketsPageLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' }
