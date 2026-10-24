/**
 * SHINPO (進歩) — Scalable API Client Foundation
 * Centralized HTTP client with typed responses, automatic authentication,
 * unified error handling, and timeout safeguards.
 */

import { authHeaders } from './auth.ts'
import { fetchWithoutRedirects, getBackendBaseUrl } from './config.ts'

/**
 * Standardized API Error matching backend ApiErrorResponse
 */
export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown
  public readonly timestamp: string
  public readonly path?: string

  constructor(params: {
    message: string
    status: number
    code?: string
    details?: unknown
    timestamp?: string
    path?: string
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.details = params.details
    this.timestamp = params.timestamp || new Date().toISOString()
    this.path = params.path
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  /**
   * Helper to identify specific HTTP status errors
   */
  public isUnauthorized(): boolean {
    return this.status === 401
  }

  public isForbidden(): boolean {
    return this.status === 403
  }

  public isNotFound(): boolean {
    return this.status === 404
  }

  public isConflict(): boolean {
    return this.status === 409
  }

  public isValidationError(): boolean {
    return this.status === 400 || this.code === 'VALIDATION_FAILED'
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number
  skipAuth?: boolean
  params?: Record<string, string | number | boolean | undefined | null>
}

/**
 * Core Request Dispatcher
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = 15000, skipAuth = false, params, ...fetchOptions } = options

  // 1. Build Target URL
  const baseUrl = `${getBackendBaseUrl()}/api`
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  let url = `${baseUrl}${cleanEndpoint}`

  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    }
    const queryString = searchParams.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  // 2. Prepare Headers
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  const auth = skipAuth ? {} : authHeaders()
  const mergedHeaders = {
    ...defaultHeaders,
    ...auth,
    ...(fetchOptions.headers as Record<string, string>),
  }

  // 3. Timeout Controller
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchWithoutRedirects(url, {
      ...fetchOptions,
      headers: mergedHeaders,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 4. Handle HTTP Errors
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`
      let errorCode: string | undefined
      let details: unknown
      let timestamp: string | undefined
      let path: string | undefined

      try {
        const errorBody = await response.json()
        if (errorBody) {
          errorMessage = errorBody.message || errorBody.error || errorMessage
          errorCode = errorBody.code || errorBody.error
          details = errorBody.details || errorBody.errors
          timestamp = errorBody.timestamp
          path = errorBody.path
        }
      } catch {
        // Fall back to HTTP status text if response is not JSON
      }

      // If Unauthorized (401), broadcast token expiration event
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shinpo:unauthorized'))
      }

      throw new ApiError({
        message: errorMessage,
        status: response.status,
        code: errorCode,
        details,
        timestamp,
        path,
      })
    }

    // 5. Handle Empty Responses (204 No Content, etc.)
    if (response.status === 204) {
      return null as unknown as T
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T
    }

    return (await response.text()) as unknown as T
  } catch (err: unknown) {
    clearTimeout(timeoutId)

    if (err instanceof ApiError) {
      throw err
    }

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError({
        message: `Request timeout after ${timeoutMs}ms: ${endpoint}`,
        status: 408,
        code: 'TIMEOUT',
      })
    }

    throw new ApiError({
      message: 'Unable to reach SHINPO. Check your connection and try again.',
      status: 0,
      code: 'NETWORK_ERROR',
    })
  }
}

/**
 * Standard HTTP Methods
 */
export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),
}

export default apiClient
