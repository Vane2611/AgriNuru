import type { Farm, Field } from '../../services/resources/farmsApi'

export type FarmFieldsState =
  | { status: 'loading' }
  | { status: 'success'; fields: Field[] }
  | { status: 'error'; message: string }

export type ModalState =
  | { type: 'none' }
  | { type: 'createFarm' }
  | { type: 'editFarm'; farm: Farm }
  | { type: 'deleteFarm'; farm: Farm }
  | { type: 'createField'; farmId: number; farmName: string }
  | { type: 'editField'; farmId: number; farmName: string; field: Field }
  | { type: 'deleteField'; farmId: number; farmName: string; field: Field }
