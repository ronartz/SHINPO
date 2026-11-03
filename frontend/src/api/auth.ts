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
  recoveryKey?: string
}

const TOKEN_KEY = 'shinpo_access_token'
const REFRESH_KEY = 'shinpo_refresh_token'
const USER_KEY = 'shinpo_auth_user'
const LOCAL_VAULT_KEY = 'shinpo_local_vault_account'
const LOCAL_VAULT_EMAIL_KEY = 'shinpo_local_vault_email'
let nativeAccessToken: string | null = null
let authRefreshTimer: number | null = null

function scheduleTokenRefresh(delayMs: number): void {
  if (typeof window === 'undefined') return
  if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer)
  authRefreshTimer = window.setTimeout(async () => {
    authRefreshTimer = null
    const token = await refreshAccessToken()
    if (token) return
    if (getAuthToken()) {
      scheduleTokenRefresh(30_000)
    } else {
      window.dispatchEvent(new CustomEvent('shinpo:unauthorized'))
    }
  }, delayMs)
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  if (isLocalVaultSession()) return null
  if (isTauriEnvironment()) return nativeAccessToken
  return localStorage.getItem(TOKEN_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (isLocalVaultSession()) return null
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

export function isLocalVaultSession(): boolean {
  return isTauriEnvironment() && typeof window !== 'undefined' && Boolean(localStorage.getItem(LOCAL_VAULT_KEY))
}

export async function touchLocalVaultActivity(): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    await invokeTauriCommand<void>('touch_local_vault_activity')
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
  if (isTauriEnvironment() && response.accessToken === 'local-vault') {
    localStorage.setItem(LOCAL_VAULT_KEY, response.user.username)
    localStorage.setItem(LOCAL_VAULT_EMAIL_KEY, response.user.email)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    return
  }
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
  const expiresInSeconds = Number.isFinite(response.expiresInSeconds)
    ? Math.max(1, response.expiresInSeconds)
    : 3600
  scheduleTokenRefresh(Math.max(1000, (expiresInSeconds - 60) * 1000))
}

export async function clearAuthSession(): Promise<void> {
  if (authRefreshTimer !== null) window.clearTimeout(authRefreshTimer)
  authRefreshTimer = null
  nativeAccessToken = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  if (isTauriEnvironment() && isLocalVaultSession()) {
    await invokeTauriCommand<void>('lock_local_account')
  } else if (isTauriEnvironment()) await invokeTauriCommand<void>('delete_secure_refresh_token')
}

export async function setCustomServerUrl(url: string): Promise<void> {
  if (typeof window === 'undefined') return
  const clean = url.trim().replace(/\/+$/, '')
  const validation = isValidServerUrl(clean)
  if (!validation.valid) throw new Error(validation.reason || 'Invalid server URL')
  if (clean !== getCustomServerUrl().trim().replace(/\/+$/, '')) await clearAuthSession()
  if (clean) localStorage.setItem('shinpo_custom_server_url', clean)
  else localStorage.removeItem('shinpo_custom_server_url')
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

import { fetchWithoutRedirects, getBackendBaseUrl, getCustomServerUrl, isValidServerUrl } from './config.ts'
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
  if (isTauriEnvironment() && localStorage.getItem(LOCAL_VAULT_KEY)) {
    const stored = getStoredUser()
    const localEmail = localStorage.getItem(LOCAL_VAULT_EMAIL_KEY)
    const username = usernameOrEmail.includes('@') && (stored?.email ?? localEmail)?.toLowerCase() === usernameOrEmail.toLowerCase()
      ? stored?.username ?? localStorage.getItem(LOCAL_VAULT_KEY)!
      : usernameOrEmail.trim().replace(/@local\.shinpo$/i, '')
    const status = await invokeTauriCommand<{ unlocked: boolean; username: string | null }>('unlock_local_account', { username, password })
    await invokeTauriCommand('local_sync_browser_policy').catch(() => undefined)
    const user: AuthUser = { id: 1, username: status.username || username, email: stored?.email || localEmail || `${username}@local.shinpo` }
    const response: AuthResponse = { accessToken: 'local-vault', refreshToken: '', tokenType: 'Local', expiresInSeconds: Number.MAX_SAFE_INTEGER, user }
    await setAuthSession(response)
    return response
  }
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
  if (isTauriEnvironment()) {
    const created = await invokeTauriCommand<{ username: string; recoveryKey: string }>('create_local_account', { username, password })
    const response: AuthResponse = {
      accessToken: 'local-vault', refreshToken: '', tokenType: 'Local', expiresInSeconds: Number.MAX_SAFE_INTEGER,
      user: { id: 1, username: created.username, email }, recoveryKey: created.recoveryKey,
    }
    await setAuthSession(response)
    return response
  }
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

export async function recoverLocalAccount(
  username: string,
  recoveryKey: string,
  newPassword: string,
): Promise<AuthResponse> {
  if (!isTauriEnvironment() || !localStorage.getItem(LOCAL_VAULT_KEY)) {
    throw new Error('Local account recovery is available only for an existing desktop vault.')
  }
  const normalizedUsername = username.trim().toLowerCase()
  await invokeTauriCommand<void>('recover_local_account', {
    username: normalizedUsername,
    recoveryKey: recoveryKey.trim(),
    newPassword,
  })
  const status = await invokeTauriCommand<{ unlocked: boolean; username: string | null }>('local_vault_status')
  if (!status.unlocked || status.username !== normalizedUsername) {
    throw new Error('Recovery completed, but the local vault did not unlock. Sign in with the new password.')
  }
  const existingUser = getStoredUser()
  const user: AuthUser = {
    id: 1,
    username: status.username,
    email: existingUser?.email ?? localStorage.getItem(LOCAL_VAULT_EMAIL_KEY) ?? `${normalizedUsername}@local.shinpo`,
  }
  const response: AuthResponse = {
    accessToken: 'local-vault',
    refreshToken: '',
    tokenType: 'Local',
    expiresInSeconds: Number.MAX_SAFE_INTEGER,
    user,
  }
  await setAuthSession(response)
  return response
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (isLocalVaultSession()) {
    try {
      const status = await invokeTauriCommand<{ unlocked: boolean; username: string | null }>('local_vault_status')
      const user = getStoredUser()
      return status.unlocked && user?.username === status.username ? user : null
    } catch { return null }
  }
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
  if (isLocalVaultSession()) {
    await clearAuthSession()
    return
  }
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
  if (isLocalVaultSession()) return null
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
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const username = localStorage.getItem(LOCAL_VAULT_KEY)
    if (!username) throw new Error('Local account is unavailable')
    await invokeTauriCommand<void>('change_local_password', { username, currentPassword, newPassword })
    return { message: 'Password successfully updated.' }
  }
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
  if (isLocalVaultSession()) {
    throw new Error('Local vault usernames are fixed because they are part of the encrypted account identity.')
  }
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

export async function deleteAccount(): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const username = localStorage.getItem(LOCAL_VAULT_KEY)
    if (!username) throw new Error('Local account is unavailable')
    await invokeTauriCommand<void>('delete_local_account', { username })
    await clearAuthSession()
    localStorage.removeItem(LOCAL_VAULT_KEY)
    localStorage.removeItem(LOCAL_VAULT_EMAIL_KEY)
    return
  }
  const res = await fetchWithoutRedirects(`${apiBase()}/users/me`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new Error(errorData?.message || `Failed to delete account (${res.status})`)
  }
  await clearAuthSession()
}
