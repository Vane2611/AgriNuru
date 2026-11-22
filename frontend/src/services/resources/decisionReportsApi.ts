import {
  authenticatedJsonRequest,
  type JsonApiRequestOptions,
} from './authApi'
import { listResults, type ApiListResponse } from './resourceTypes'

export type DecisionReportStatus =
  | 'draft'
  | 'ready'
  | 'shared'
  | 'archived'

export type DecisionReport = {
  id: number
  field: number
  crop_recommendation: number | null
  production_plan: number | null
  status: DecisionReportStatus
  summary: string
  recommendation_text: string
  assumptions: Record<string, unknown>
  sources: unknown[]
  model_version: string
  generated_at: string | null
  created_at: string
  updated_at: string
}

export type DecisionReportCreateRequest = {
  field: number
  crop_recommendation?: number | null
  production_plan?: number | null
  status?: DecisionReportStatus
  summary?: string
  recommendation_text?: string
  assumptions?: Record<string, unknown>
  sources?: unknown[]
  model_version?: string
  generated_at?: string | null
}

export type DecisionReportUpdateRequest =
  Partial<DecisionReportCreateRequest>

async function decisionReportRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  return authenticatedJsonRequest<T>(path, options)
}

export async function listDecisionReports(): Promise<DecisionReport[]> {
  const response =
    await decisionReportRequest<ApiListResponse<DecisionReport>>(
      '/api/decisions/reports/',
    )
  return listResults(response)
}

export async function getDecisionReport(
  reportId: number,
): Promise<DecisionReport> {
  return decisionReportRequest<DecisionReport>(
    `/api/decisions/reports/${reportId}/`,
  )
}

export async function createDecisionReport(
  payload: DecisionReportCreateRequest,
): Promise<DecisionReport> {
  return decisionReportRequest<DecisionReport>('/api/decisions/reports/', {
    method: 'POST',
    body: payload,
  })
}

export async function updateDecisionReport(
  reportId: number,
  payload: DecisionReportUpdateRequest,
): Promise<DecisionReport> {
  return decisionReportRequest<DecisionReport>(
    `/api/decisions/reports/${reportId}/`,
    {
      method: 'PATCH',
      body: payload,
    },
  )
}

export async function deleteDecisionReport(reportId: number): Promise<void> {
  return decisionReportRequest<void>(
    `/api/decisions/reports/${reportId}/`,
    {
      method: 'DELETE',
    },
  )
}
