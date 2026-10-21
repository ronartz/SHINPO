export type AuthUser = {
  id: number
  username: string
  email: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresInSeconds: number
  user: AuthUser
}

const TOKEN_KEY = 'shinpo_access_token'
const REFRESH_KEY = 'shinpo_refresh_token'
const USER_KEY = 'shinpo_auth_user'
let nativeAccessToken: string | null = null

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  if (isTauriEnvironment()) return nativeAccessToken
  return localStorage.getItem(TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (isTauriEnvironment()) {
    let stored: string | null
    try {
      stored = await invokeTauriCommand<string | null>('get_secure_refresh_token')
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      return null
    }
    if (stored) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      return stored
    }

    const legacyAccessToken = localStorage.getItem(TOKEN_KEY)
    const legacyRefreshToken = localStorage.getItem(REFRESH_KEY)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    if (!legacyRefreshToken) return null
    try {
      await invokeTauriCommand<void>('set_secure_refresh_token', { token: legacyRefreshToken })
      nativeAccessToken = legacyAccessToken
      return legacyRefreshToken
    } catch {
      return null
    }
  }
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const userJson = localStorage.getItem(USER_KEY)
  if (!userJson) return null
  try {
    const user = JSON.parse(userJson) as AuthUser
    if (user && typeof user.id === 'number' && !isNaN(user.id)) {
      return user
    }
    return null
  } catch {
    return null
  }
}

export function getAuthenticatedUser(): AuthUser | null {
  return getStoredUser()
}

export function getAuthenticatedUserId(): number | null {
  const user = getStoredUser()
  return user?.id ?? null
}

export async function setAuthSession(response: AuthResponse): Promise<void> {
  if (isTauriEnvironment()) {
    await invokeTauriCommand<void>('set_secure_refresh_token', { token: response.refreshToken })
    nativeAccessToken = response.accessToken
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  } else {
    localStorage.setItem(TOKEN_KEY, response.accessToken)
    localStorage.setItem(REFRESH_KEY, response.refreshToken)
  }
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
}

export async function clearAuthSession(): Promise<void> {
  nativeAccessToken = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  if (isTauriEnvironment()) await invokeTauriCommand<void>('delete_secure_refresh_token')
}

export function authHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

import { fetchWithoutRedirects, getBackendBaseUrl } from './config.ts'
import { invokeTauriCommand, isTauriEnvironment } from './tauri.ts'

const apiBase = () => `${getBackendBaseUrl()}/api`

async function persistAuthResponse(response: AuthResponse): Promise<void> {
  try {
    await setAuthSession(response)
  } catch {
    try {
      await fetchWithoutRedirects(`${apiBase()}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: response.refreshToken }),
      })
    } catch {
      // The local credential-store failure remains the primary error.
    }
    throw new Error('Could not save the session in secure storage. Please check your OS credential service and sign in again.')
  }
}

export async function login(usernameOrEmail: string, password: string): Promise<AuthResponse> {
  const res = await fetchWithoutRedirects(`${apiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail, password }),
  })

  if (!res.ok) {
    let errorMsg = `Login failed: ${res.status}`
    try {
      const data = await res.json()
      if (data.message) errorMsg = data.message
    } catch {
      // ignore parse error, fallback to status
    }
    throw new Error(errorMsg)
  }

  const data: AuthResponse = await res.json()
  await persistAuthResponse(data)
  return data
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetchWithoutRedirects(`${apiBase()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })

  if (!res.ok) {
    let errorMsg = `Registration failed: ${res.status}`
    try {
      const data = await res.json()
      if (data.message) errorMsg = data.message
    } catch {
      // ignore parse error, fallback to status
    }
    throw new Error(errorMsg)
  }

  const data: AuthResponse = await res.json()
  await persistAuthResponse(data)
  return data
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (!getAuthToken() && !(await refreshAccessToken())) return null

  try {
    const res = await fetchWithoutRedirects(`${apiBase()}/auth/me`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      if (res.status === 401) {
        await clearAuthSession()
      }
      return null
    }
    const user: AuthUser = await res.json()
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    return user
  } catch {
    return getStoredUser()
  }
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken().catch(() => null)
  if (refreshToken) {
    try {
      await fetchWithoutRedirects(`${apiBase()}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // ignore logout network failure on teardown
    }
  }
  await clearAuthSession()
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken().catch(() => null)
  if (!refreshToken) return null
  try {
    const res = await fetchWithoutRedirects(`${apiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) {
      await clearAuthSession()
      return null
    }
    const data: AuthResponse = await res.json()
    await persistAuthResponse(data)
    return data.accessToken
  } catch {
    return null
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetchWithoutRedirects(`${apiBase()}/auth/change-password`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new Error(errorData?.message || `Failed to change password (${res.status})`)
  }
  return res.json()
}

export async function updateUsername(username: string): Promise<AuthUser> {
  const res = await fetchWithoutRedirects(`${apiBase()}/users/me/username`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new Error(errorData?.message || `Failed to update username (${res.status})`)
  }
  const user: AuthUser = await res.json()
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
}
