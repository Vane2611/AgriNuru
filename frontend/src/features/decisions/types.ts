import type {
  CropRecommendation,
  CropRecommendationStatus,
  ProductionPlan,
  ProductionPlanStatus,
  MarketComparison,
  MlStatus,
} from '../../services/resources/decisionsApi'
import type {
  DecisionReport,
  DecisionReportStatus,
} from '../../services/resources/decisionReportsApi'

export type {
  CropRecommendation,
  CropRecommendationStatus,
  ProductionPlan,
  ProductionPlanStatus,
  MarketComparison,
  MlStatus,
  DecisionReport,
  DecisionReportStatus,
}

export type DecisionTab =
  | 'recommendations'
  | 'plans'
  | 'comparisons'
  | 'reports'

export type RecommendationModalState =
  | { type: 'none' }
  | { type: 'createRec' }
  | { type: 'editRec'; rec: CropRecommendation }
  | { type: 'deleteRec'; rec: CropRecommendation }

export type PlanModalState =
  | { type: 'none' }
  | { type: 'createPlan' }
  | { type: 'editPlan'; plan: ProductionPlan }
  | { type: 'deletePlan'; plan: ProductionPlan }

export type ComparisonModalState =
  | { type: 'none' }
  | { type: 'createComparison' }
  | { type: 'editComparison'; comparison: MarketComparison }
  | { type: 'deleteComparison'; comparison: MarketComparison }

export type ReportModalState =
  | { type: 'none' }
  | { type: 'createReport' }
  | { type: 'editReport'; report: DecisionReport }
  | { type: 'deleteReport'; report: DecisionReport }
