export type RequestInput = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  auth?: boolean
  root?: boolean
  headers?: Record<string, string>
}

export type PagedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
  hasPrev: boolean
}

export type ApiClient = {
  request<T = unknown>(input: RequestInput): Promise<T>
  pagedRequest<T = unknown>(input: RequestInput): Promise<PagedResult<T>>
  baseUrl: string
  rootUrl: string
}

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ClientConfig = {
  baseUrl?: string
  getToken: () => string | null | undefined
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '')
}

function parseResponse(response: Response) {
  if (response.status === 204) {
    return undefined
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
}

export function createApiClient(config: ClientConfig): ApiClient {
  const baseUrl = trimTrailingSlash(config.baseUrl ?? 'http://localhost:8080/v1')
  const rootUrl = baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl

  async function request<T = unknown>(input: RequestInput): Promise<T> {
    const url = new URL(`${input.root ? rootUrl : baseUrl}${input.path}`)
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value === undefined || value === null || value === '') {
          continue
        }
        url.searchParams.set(key, String(value))
      }
    }

    const headers = new Headers(input.headers)
    headers.set('Accept', 'application/json')
    if (input.body !== undefined && input.body !== null) {
      headers.set('Content-Type', 'application/json')
    }
    if (input.auth) {
      const token = config.getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    const response = await fetch(url, {
      method: input.method,
      headers,
      body: input.body === undefined || input.body === null ? undefined : typeof input.body === 'string' ? input.body : JSON.stringify(input.body),
    })

    const data = await parseResponse(response)
    if (!response.ok) {
      const payload = data as ApiEnvelope<unknown> | string | undefined
      const error = typeof payload === 'string' ? undefined : payload?.error
      const message =
        typeof payload === 'string'
          ? payload
          : error?.message ?? JSON.stringify(payload ?? {})
      throw new ApiError(message || `Request failed with ${response.status}`, response.status, error?.code, error?.details)
    }

    if (data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
      return ((data as ApiEnvelope<T>).data ?? data) as T
    }

    return data as T
  }

  async function pagedRequest<T = unknown>(input: RequestInput): Promise<PagedResult<T>> {
    const url = new URL(`${input.root ? rootUrl : baseUrl}${input.path}`)
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value === undefined || value === null || value === '') continue
        url.searchParams.set(key, String(value))
      }
    }
    const headers = new Headers(input.headers)
    headers.set('Accept', 'application/json')
    if (input.body !== undefined && input.body !== null) {
      headers.set('Content-Type', 'application/json')
    }
    if (input.auth) {
      const token = config.getToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }
    const response = await fetch(url, {
      method: input.method,
      headers,
      body: input.body === undefined || input.body === null ? undefined : JSON.stringify(input.body),
    })
    const data = await parseResponse(response)
    if (!response.ok) {
      const payload = data as ApiEnvelope<unknown> | string | undefined
      const error = typeof payload === 'string' ? undefined : payload?.error
      const message =
        typeof payload === 'string'
          ? payload
          : error?.message ?? JSON.stringify(payload ?? {})
      throw new ApiError(message || `Request failed with ${response.status}`, response.status, error?.code, error?.details)
    }
    const envelope = data as { success?: boolean; data?: T[]; pagination?: { total: number; page: number; page_size: number; has_next: boolean; has_prev: boolean } }
    return {
      items: envelope.data ?? [],
      total: envelope.pagination?.total ?? 0,
      page: envelope.pagination?.page ?? 1,
      pageSize: envelope.pagination?.page_size ?? 20,
      hasNext: envelope.pagination?.has_next ?? false,
      hasPrev: envelope.pagination?.has_prev ?? false,
    }
  }

  return {
    request,
    pagedRequest,
    baseUrl,
    rootUrl,
  }
}
