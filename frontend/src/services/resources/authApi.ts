export const AUTH_API_BASE_URL = 'http://localhost:8000'

export type AuthenticationUser = {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
}

export type FarmerProfile = {
  phone_number: string
  preferred_language: string
}

export type AnonymousSessionResponse = {
  is_authenticated: false
}

export type AuthenticatedSessionResponse = {
  is_authenticated: true
  user: AuthenticationUser
  farmer_profile: FarmerProfile | null
}

export type SessionResponse =
  | AnonymousSessionResponse
  | AuthenticatedSessionResponse

export type RegistrationRequest = {
  full_name: string
  username: string
  email: string
  phone_number: string
  password: string
  confirm_password: string
}

export type RegistrationResponse = {
  detail: string
  user: AuthenticationUser
  farmer_profile: FarmerProfile
}

export type LoginRequest = {
  username_or_email: string
  password: string
}

export type LogoutResponse = {
  detail: string
}

type ApiFieldErrors = Record<string, string[]>

let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler
}

export class ApiError extends Error {
  readonly status: number
  readonly fields: ApiFieldErrors
  readonly detail?: string

  constructor(
    message: string,
    status: number,
    fields: ApiFieldErrors = {},
    detail?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
    this.detail = detail
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('csrftoken='))

  if (!cookie) {
    return null
  }

  return decodeURIComponent(cookie.slice('csrftoken='.length))
}

async function readResponseBody(
  response: Response,
): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function normalizeApiError(
  status: number,
  body: unknown,
): ApiError {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    const fields: ApiFieldErrors = {}
    let detail: string | undefined

    for (const [key, value] of Object.entries(record)) {
      if (key === 'detail') {
        if (typeof value === 'string') {
          detail = value
        } else if (
          Array.isArray(value) &&
          value.every((item) => typeof item === 'string')
        ) {
          detail = value.join(' ')
        }
        continue
      }

      if (Array.isArray(value)) {
        const messages = value.filter(
          (item): item is string => typeof item === 'string',
        )
        if (messages.length > 0) {
          fields[key] = messages
        }
      } else if (typeof value === 'string') {
        fields[key] = [value]
      }
    }

    const firstFieldMessage = Object.values(fields)[0]?.[0]
    return new ApiError(
      detail ?? firstFieldMessage ?? 'The request could not be completed.',
      status,
      fields,
      detail,
    )
  }

  if (typeof body === 'string' && body.trim()) {
    return new ApiError(
      'The server returned an unexpected response.',
      status,
      {},
    )
  }

  return new ApiError(
    'The request could not be completed.',
    status,
  )
}

async function fetchJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
    })
  } catch {
    throw new ApiError(
      'Unable to reach Grinab. Check your connection and try again.',
      0,
    )
  }
  const body = await readResponseBody(response)

  if (!response.ok) {
    const apiError = normalizeApiError(response.status, body)
    const isAuthenticationRequest =
      path === '/api/auth/login/'
      || path === '/api/auth/register/'
      || path === '/api/auth/csrf/'
      || path === '/api/auth/session/'

    if (response.status === 401 && !isAuthenticationRequest) {
      sessionExpiredHandler?.()
    }
    throw apiError
  }

  if (init.method === 'DELETE' && body === null) {
    return undefined as T
  }

  if (body === null) {
    throw new ApiError(
      'The server returned an empty response.',
      response.status,
    )
  }

  if (typeof body !== 'object') {
    throw new ApiError(
      'The server returned an unexpected response.',
      response.status,
    )
  }

  return body as T
}

export type JsonApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export type JsonApiRequestOptions = {
  method?: JsonApiMethod
  body?: unknown
  headers?: HeadersInit
}

async function prepareJsonRequestInit(
  options: JsonApiRequestOptions,
): Promise<RequestInit> {
  const method = options.method ?? 'GET'
  const headers = new Headers(options.headers)

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    const csrfToken = await getCsrfTokenBeforeUnsafeRequest()
    headers.set('X-CSRFToken', csrfToken)
  }

  return {
    method,
    headers,
    body: options.body === undefined
      ? undefined
      : JSON.stringify(options.body),
  }
}

export async function authenticatedJsonRequest<T>(
  path: string,
  options: JsonApiRequestOptions = {},
): Promise<T> {
  const init = await prepareJsonRequestInit(options)
  return fetchJson<T>(path, init)
}

export async function getCsrfCookie(): Promise<void> {
  await authenticatedJsonRequest<{ detail: string }>('/api/auth/csrf/', {
    method: 'GET',
  })
}

async function getCsrfTokenBeforeUnsafeRequest(): Promise<string> {
  await getCsrfCookie()
  const csrfToken = readCsrfCookie()

  if (!csrfToken) {
    throw new ApiError(
      'The CSRF cookie could not be initialized.',
      0,
    )
  }

  return csrfToken
}

export async function register(
  payload: RegistrationRequest,
): Promise<RegistrationResponse> {
  return authenticatedJsonRequest<RegistrationResponse>('/api/auth/register/', {
    method: 'POST',
    body: payload,
  })
}

export async function login(
  payload: LoginRequest,
): Promise<AuthenticatedSessionResponse> {
  return authenticatedJsonRequest<AuthenticatedSessionResponse>('/api/auth/login/', {
    method: 'POST',
    body: payload,
  })
}

export async function getSession(): Promise<SessionResponse> {
  return authenticatedJsonRequest<SessionResponse>('/api/auth/session/', {
    method: 'GET',
  })
}

export async function logout(): Promise<LogoutResponse> {
  return authenticatedJsonRequest<LogoutResponse>('/api/auth/logout/', {
    method: 'POST',
  })
}
