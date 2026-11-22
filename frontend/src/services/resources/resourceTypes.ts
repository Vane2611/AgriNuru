export type PaginatedResponse<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type ApiListResponse<T> = T[] | PaginatedResponse<T>

export function listResults<T>(response: ApiListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.results
}
