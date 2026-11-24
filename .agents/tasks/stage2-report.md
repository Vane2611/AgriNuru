# Stage 2 Report — Growing Season Modals

## Files Created

### 1. `frontend/src/features/production/GrowingSeasonFormModal.tsx`

**Props interface**
```typescript
interface GrowingSeasonFormModalProps {
  isOpen: boolean
  initialSeason?: GrowingSeason | null   // null/undefined = create, populated = edit
  farms: Farm[]
  allFields: Field[]
  crops: Crop[]
  allVarieties: CropVariety[]
  onClose: () => void
  onSuccess: (season: GrowingSeason) => void
}
```

**Form fields (in render order)**

| # | Label | Backend field | Type | Required |
|---|-------|--------------|------|----------|
| 1 | Farm | (derived — filters Field list) | select | yes |
| 2 | Field | `field` | select | yes |
| 3 | Crop | `crop` | select | yes |
| 4 | Variety | `variety` | select | no |
| 5 | Planting Date | `planting_date` | date | yes |
| 6 | Expected Harvest Date | `expected_harvest_date` | date | no |
| 7 | Actual Harvest Date | `actual_harvest_date` | date | no |
| 8 | Area Planted (ha) | `area_planted_hectares` | number (step=0.01, min=0.01) | no |
| 9 | Status | `status` | select | yes |
| 10 | Notes | `notes` | textarea (3 rows) | no |

**Mode behaviour**
- Create mode: title "Add Growing Season", button "Add Season", all fields blank, status defaulted to `planned`.
- Edit mode: title "Edit Growing Season", button "Save Changes", all fields pre-populated from `initialSeason`. Farm is derived from `allFields` by matching `initialSeason.field` → `Field.farm`.

**Cascading dependencies**
- Farm → Field: changing farm resets field, variety and area_planted_hectares.
- Crop → Variety: changing crop resets variety.
- Field area hint updates dynamically when field selection changes.

---

### 2. `frontend/src/features/production/GrowingSeasonDeleteModal.tsx`

**Props interface**
```typescript
interface GrowingSeasonDeleteModalProps {
  isOpen: boolean
  season: GrowingSeason | null
  cropName: string
  fieldName: string
  farmName: string
  onClose: () => void
  onSuccess: (deletedId: number) => void
}
```

**Body content**
- Confirmation question
- Detail card: crop name, field name, farm name, planting date (formatted "14 March 2025"), status (humanised label)
- Warning box listing all child records that will be deleted

**HTTP 409 handling**
- Error shown above footer buttons; modal stays open.
- Shows `err.detail` or a detailed fallback explaining FK constraints.

---

## CSS Classes Used

### Modal structure
- `.agri-modal-backdrop`
- `.agri-modal`
- `.agri-modal-dialog`
- `.agri-modal-header`
- `.agri-modal-close`
- `.agri-modal-body`
- `.agri-modal-footer`

### Form elements
- `.agri-form-group`
- `.agri-form-label` / `.required-star`
- `.agri-form-input` / `.is-invalid`
- `.agri-form-select` / `.is-invalid`
- `.agri-form-textarea`
- `.agri-form-error`
- `.agri-form-hint`

### Alerts and buttons
- `.farms-alert` / `.farms-alert-content`
- `.farms-btn-primary`
- `.farms-btn-secondary`
- `.farms-btn-danger`

### Spinner (Bootstrap)
- `.spinner-border spinner-border-sm`

---

## Validations Implemented

### Client-side (GrowingSeasonFormModal)
- Field is required (non-empty selection).
- Crop is required.
- Planting date is required.
- Status is required.
- If `area_planted_hectares` is provided: must be ≥ 0.0001.
- If `area_planted_hectares` is provided and selected field has a known area: planted area ≤ field area (matches backend `GrowingSeasonSerializer.validate`).

### API error mapping (both modals)
- `err.fields` entries mapped to per-field `fieldErrors` state shown below each input.
- `err.detail` shown in `generalError` alert in the modal body / above footer.
- If neither is present and status is not 409, `err.message` used as general error.

### Backend constraints respected
- `variety.crop == crop` validated server-side; frontend filters variety list by selected crop to prevent the error at source, but backend errors are surfaced if they occur.
- Harvest dates ≥ planting date: validated server-side; `agri-form-hint` communicates the rule.
- Area check duplicated both client-side and server-side.
- HTTP 409 on delete triggers a detailed, non-dismissing error message.

---

## Build Result

```
npx tsc --noEmit
Exit Code: 0   (zero errors)
```

---

## Assumptions and Notes

1. **`onSuccess` + `onClose` are both called on success.** The form modal calls `onSuccess(result)` then `onClose()`. The delete modal calls `onSuccess(season.id)` then `onClose()`. The parent page is responsible for updating its own state inside `onSuccess`.
2. **APIs called directly.** `createGrowingSeason` / `updateGrowingSeason` / `deleteGrowingSeason` are called inside the modals (same pattern as `FarmFormModal` calling `onSubmit` which is an `async` prop). The form modal accepts `onSuccess` returning `void` rather than delegating the API call to the parent — this keeps the modal self-contained and matches how the delete modal works.
3. **Field `area_hectares` is a decimal string.** Parsed with `parseFloat` for display and comparison, consistent with how `FieldFormModal` handles the same field.
4. **`notes` is non-nullable on `GrowingSeason`.** Stored as `""` when empty, matching the Django model's `blank=True` TextField.
5. **`isMountedRef` guard not used in these modals.** The existing farm modals do not use it either; the ref is used in `FarmsPage` for page-level async data loads, not inside individual modal components.
