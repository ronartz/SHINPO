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

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const userJson = localStorage.getItem(USER_KEY)
  if (!userJson) return null
  try {
    return JSON.parse(userJson) as AuthUser
  } catch {
    return null
  }
}

export function setAuthSession(response: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, response.accessToken)
  localStorage.setItem(REFRESH_KEY, response.refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(response.user))
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
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

const API_BASE = '/api'

export async function login(usernameOrEmail: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
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
  setAuthSession(data)
  return data
}

export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
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
  setAuthSession(data)
  return data
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getAuthToken()
  if (!token) return null

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: authHeaders(),
    })
    if (!res.ok) {
      if (res.status === 401) {
        clearAuthSession()
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
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // ignore logout network failure on teardown
    }
  }
  clearAuthSession()
}
