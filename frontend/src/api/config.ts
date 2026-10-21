// Dynamic Backend Endpoint configuration for SHINPO Desktop (Tauri) & Local Dev
// In desktop mode, connects to the remote cloud server or local server via HTTPS/WSS.

export function getBackendBaseUrl(): string {
  const buildUrl = import.meta.env?.VITE_SHINPO_SERVER_URL || import.meta.env?.VITE_API_BASE_URL
  if (buildUrl) {
    if (isValidServerUrl(buildUrl).valid) return buildUrl.replace(/\/+$/, '')
    clearPersistedSession()
    return ''
  }

  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('shinpo_custom_server_url')
    if (customUrl?.trim()) {
      if (isValidServerUrl(customUrl).valid) return customUrl.trim().replace(/\/+$/, '')
      clearPersistedSession()
      return ''
    }
  }

  // An unsafe legacy endpoint is ignored; relative requests cannot leak credentials to it.
  if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
    return 'http://localhost:8080'
  }

  return ''
}

function clearPersistedSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('shinpo_access_token')
  localStorage.removeItem('shinpo_refresh_token')
  localStorage.removeItem('shinpo_auth_user')
}

export function getCustomServerUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('shinpo_custom_server_url') || ''
  }
  return ''
}

export async function setCustomServerUrl(url: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const current = localStorage.getItem('shinpo_custom_server_url') || ''
    const clean = url.trim().replace(/\/+$/, '')
    const validation = isValidServerUrl(clean)
    if (!validation.valid) throw new Error(validation.reason || 'Invalid server URL')
    if (clean !== current.trim().replace(/\/+$/, '')) {
      const { clearAuthSession } = await import('./auth.ts')
      await clearAuthSession()
    }
    if (clean) {
      localStorage.setItem('shinpo_custom_server_url', clean)
    } else {
      localStorage.removeItem('shinpo_custom_server_url')
    }
  }
}

export function isValidServerUrl(url: string): { valid: boolean; reason?: string } {
  const trimmed = url.trim()
  if (!trimmed) return { valid: true }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: 'URL must start with http:// or https://' }
    }
    if (parsed.username || parsed.password || trimmed.includes('@')) {
      return { valid: false, reason: 'Server URLs must not contain credentials' }
    }
    if (parsed.search || parsed.hash) {
      return { valid: false, reason: 'Server URLs must not contain a query or fragment' }
    }
    const loopback = parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === '[::1]'
    if (parsed.protocol === 'http:' && !loopback) {
      return { valid: false, reason: 'Secure connection required — remote servers must use HTTPS' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

export function getWsBaseUrl(): string {
  const configuredUrl = import.meta.env?.VITE_SHINPO_SERVER_URL || import.meta.env?.VITE_API_BASE_URL || getCustomServerUrl()
  if (configuredUrl && !isValidServerUrl(configuredUrl).valid) return ''
  if (import.meta.env?.VITE_SHINPO_WS_URL) {
    const wsUrl = import.meta.env.VITE_SHINPO_WS_URL as string
    return isValidWebSocketUrl(wsUrl).valid ? wsUrl.replace(/\/+$/, '') : ''
  }

  const backendBase = getBackendBaseUrl()
  if (backendBase.startsWith('http://')) {
    return backendBase.replace('http://', 'ws://') + '/ws'
  }
  if (backendBase.startsWith('https://')) {
    return backendBase.replace('https://', 'wss://') + '/ws'
  }
  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return 'ws://localhost:8080/ws'
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  return 'ws://localhost:8080/ws'
}

export function isValidWebSocketUrl(raw: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(raw.trim())
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return { valid: false, reason: 'WebSocket URL must use ws:// on loopback or wss://' }
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || raw.trim().includes('@')) {
      return { valid: false, reason: 'WebSocket URL must not contain credentials, a query, or a fragment' }
    }
    const loopback = parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname === '[::1]'
    if (parsed.protocol === 'ws:' && !loopback) {
      return { valid: false, reason: 'Secure WebSocket required — remote servers must use WSS' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid WebSocket URL format' }
  }
}

export function fetchWithoutRedirects(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, redirect: 'error' })
}

