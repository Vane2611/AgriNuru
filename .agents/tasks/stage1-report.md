# Stage 1 — Production Management Frontend API Services

**Date:** 2026-11-24  
**Task:** Create three API service files and one feature types file for Production Management.

---

## Files Created

### 1. `frontend/src/services/resources/productionActivitiesApi.ts`

**Types exported:**
- `ActivityType` — string union of all 7 Django `ActivityType` choices:
  `'land_preparation' | 'planting' | 'irrigation' | 'fertiliser_application' | 'pest_control' | 'weeding' | 'other'`
- `ProductionActivity` — full response shape matching `ProductionActivitySerializer` fields:
  `id`, `growing_season`, `activity_type`, `activity_date`, `notes`, `created_at`, `updated_at`
- `ProductionActivityCreateRequest` — required: `growing_season`, `activity_type`, `activity_date`; optional: `notes`
- `ProductionActivityUpdateRequest` — `Partial<ProductionActivityCreateRequest>`
- `ProductionActivityListParams` — filter params: `farm_id`, `field_id`, `crop_id`, `growing_season_id`, `start_date`, `end_date`

**Functions exported:**
- `listProductionActivities(params?)` → `Promise<ProductionActivity[]>`
- `getProductionActivity(id)` → `Promise<ProductionActivity>`
- `createProductionActivity(payload)` → `Promise<ProductionActivity>`
- `updateProductionActivity(id, payload)` → `Promise<ProductionActivity>`
- `deleteProductionActivity(id)` → `Promise<void>`

**Backend endpoint:** `/api/production/activities/` and `/api/production/activities/<pk>/`

---

### 2. `frontend/src/services/resources/harvestEstimatesApi.ts`

**Types exported:**
- `EstimateSource` — string union of all 4 Django `EstimateSource` choices:
  `'farmer' | 'extension' | 'model' | 'other'`
- `HarvestEstimate` — full response shape matching `HarvestEstimateSerializer` fields:
  `id`, `growing_season`, `estimated_on`, `estimated_quantity`, `quantity_unit`, `estimate_source`, `source_reference`, `notes`, `created_at`, `updated_at`
- `HarvestEstimateCreateRequest` — required: `growing_season`, `estimated_on`, `estimated_quantity`, `quantity_unit`; optional: `estimate_source`, `source_reference`, `notes`
- `HarvestEstimateUpdateRequest` — `Partial<HarvestEstimateCreateRequest>`
- `HarvestEstimateListParams` — filter params: `farm_id`, `field_id`, `crop_id`, `growing_season_id`, `start_date`, `end_date`

**Functions exported:**
- `listHarvestEstimates(params?)` → `Promise<HarvestEstimate[]>`
- `getHarvestEstimate(id)` → `Promise<HarvestEstimate>`
- `createHarvestEstimate(payload)` → `Promise<HarvestEstimate>`
- `updateHarvestEstimate(id, payload)` → `Promise<HarvestEstimate>`
- `deleteHarvestEstimate(id)` → `Promise<void>`

**Backend endpoint:** `/api/production/harvest-estimates/` and `/api/production/harvest-estimates/<pk>/`

---

### 3. `frontend/src/services/resources/harvestRecordsApi.ts`

**Types exported:**
- `HarvestRecord` — full response shape matching `HarvestRecordSerializer` fields:
  `id`, `growing_season`, `harvested_on`, `quantity`, `quantity_unit`, `quality_grade`, `notes`, `created_at`, `updated_at`
- `HarvestRecordCreateRequest` — required: `growing_season`, `harvested_on`, `quantity`, `quantity_unit`; optional: `quality_grade`, `notes`
- `HarvestRecordUpdateRequest` — `Partial<HarvestRecordCreateRequest>`
- `HarvestRecordListParams` — filter params: `farm_id`, `field_id`, `crop_id`, `growing_season_id`, `start_date`, `end_date`

**Functions exported:**
- `listHarvestRecords(params?)` → `Promise<HarvestRecord[]>`
- `getHarvestRecord(id)` → `Promise<HarvestRecord>`
- `createHarvestRecord(payload)` → `Promise<HarvestRecord>`
- `updateHarvestRecord(id, payload)` → `Promise<HarvestRecord>`
- `deleteHarvestRecord(id)` → `Promise<void>`

**Backend endpoint:** `/api/production/harvest-records/` and `/api/production/harvest-records/<pk>/`

---

### 4. `frontend/src/features/production/types.ts`

**Types exported:**
- `SeasonDetailTab` — `'activities' | 'costs' | 'estimates' | 'records'`
- `SeasonModalState` — discriminated union: `none | createSeason | editSeason(season) | deleteSeason(season)`
- `ActivityModalState` — discriminated union: `none | createActivity | editActivity(activity) | deleteActivity(activity)`
- `CostModalState` — discriminated union: `none | createCost | editCost(cost) | deleteCost(cost)`
- `EstimateModalState` — discriminated union: `none | createEstimate | editEstimate(estimate) | deleteEstimate(estimate)`
- `HarvestModalState` — discriminated union: `none | createRecord | editRecord(record) | deleteRecord(record)`

Imports from: `growingSeasonsApi`, `productionActivitiesApi`, `productionCostsApi`, `harvestEstimatesApi`, `harvestRecordsApi`.

---

## Backend Endpoints Matched

| File | List/Create | Retrieve/Update/Delete |
|------|-------------|------------------------|
| productionActivitiesApi.ts | `GET/POST /api/production/activities/` | `GET/PATCH/DELETE /api/production/activities/<pk>/` |
| harvestEstimatesApi.ts | `GET/POST /api/production/harvest-estimates/` | `GET/PATCH/DELETE /api/production/harvest-estimates/<pk>/` |
| harvestRecordsApi.ts | `GET/POST /api/production/harvest-records/` | `GET/PATCH/DELETE /api/production/harvest-records/<pk>/` |

Filter parameters supported by all three: `farm_id`, `field_id`, `crop_id`, `growing_season_id`, `start_date`, `end_date` (read from `views.py` `apply_filters` method).

---

## Build Result

```
npx tsc --noEmit
```

**Exit code: 0 — no TypeScript errors.**

---

## Assumptions and Notes

- `estimate_source` is modelled as `EstimateSource | ''` because the Django field has `blank=True` and no `default`, meaning the serializer can return an empty string.
- `quality_grade` in `HarvestRecord` is `string` (not `string | null`) because the Django field is a `CharField(blank=True)` — it stores empty string, not NULL.
- The `listProductionActivities`, `listHarvestEstimates`, and `listHarvestRecords` functions build a query string from the params object, consistent with how the existing backend filter params are consumed. The existing `growingSeasonsApi.ts` and `productionCostsApi.ts` did not implement filter params (their list functions take no arguments), but the backend views do support them, so params were added per the task requirements.
- No new npm dependencies were introduced. All files use the existing `authenticatedJsonRequest` helper from `authApi.ts`.
