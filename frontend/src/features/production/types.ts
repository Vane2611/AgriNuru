import type { GrowingSeason } from '../../services/resources/growingSeasonsApi'
import type { ProductionActivity } from '../../services/resources/productionActivitiesApi'
import type { ProductionCost } from '../../services/resources/productionCostsApi'
import type { HarvestEstimate } from '../../services/resources/harvestEstimatesApi'
import type { HarvestRecord } from '../../services/resources/harvestRecordsApi'

export type SeasonDetailTab =
  | 'activities'
  | 'costs'
  | 'estimates'
  | 'records'

export type SeasonModalState =
  | { type: 'none' }
  | { type: 'createSeason' }
  | { type: 'editSeason'; season: GrowingSeason }
  | { type: 'deleteSeason'; season: GrowingSeason }

export type ActivityModalState =
  | { type: 'none' }
  | { type: 'createActivity' }
  | { type: 'editActivity'; activity: ProductionActivity }
  | { type: 'deleteActivity'; activity: ProductionActivity }

export type CostModalState =
  | { type: 'none' }
  | { type: 'createCost' }
  | { type: 'editCost'; cost: ProductionCost }
  | { type: 'deleteCost'; cost: ProductionCost }

export type EstimateModalState =
  | { type: 'none' }
  | { type: 'createEstimate' }
  | { type: 'editEstimate'; estimate: HarvestEstimate }
  | { type: 'deleteEstimate'; estimate: HarvestEstimate }

export type HarvestModalState =
  | { type: 'none' }
  | { type: 'createRecord' }
  | { type: 'editRecord'; record: HarvestRecord }
  | { type: 'deleteRecord'; record: HarvestRecord }
