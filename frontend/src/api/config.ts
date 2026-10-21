// Dynamic Backend Endpoint configuration for SHINPO Desktop (Tauri) & Local Dev
// In desktop mode, connects to the remote cloud server or local server via HTTPS/WSS.

export function getBackendBaseUrl(): string {
  // 1. Environment variable baked during build (e.g. VITE_SHINPO_SERVER_URL or VITE_API_BASE_URL)
  if (import.meta.env?.VITE_SHINPO_SERVER_URL) {
    return (import.meta.env.VITE_SHINPO_SERVER_URL as string).replace(/\/+$/, '')
  }
  if (import.meta.env?.VITE_API_BASE_URL) {
    return (import.meta.env.VITE_API_BASE_URL as string).replace(/\/+$/, '')
  }

  // 2. Custom server URL configured by user in Desktop Settings / Login screen
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('shinpo_custom_server_url')
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, '')
    }
  }

  // 3. Desktop mode fallback (when running inside Tauri without explicit setting)
  if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
    return 'http://localhost:8080'
  }

  // 4. Default for local Vite dev proxy: empty string uses relative path /api
  return ''
}

export function getCustomServerUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('shinpo_custom_server_url') || ''
  }
  return ''
}

export function setCustomServerUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const current = localStorage.getItem('shinpo_custom_server_url') || ''
    const clean = url.trim().replace(/\/+$/, '')
    if (clean !== current.trim().replace(/\/+$/, '')) {
      // Security: Flush session tokens when switching endpoints to prevent credential leakage to unauthorized hosts
      localStorage.removeItem('shinpo_access_token')
      localStorage.removeItem('shinpo_refresh_token')
      localStorage.removeItem('shinpo_auth_user')
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
    return { valid: true }
  } catch {
    return { valid: false, reason: 'Invalid URL format' }
  }
}

export function getWsBaseUrl(): string {
  if (import.meta.env?.VITE_SHINPO_WS_URL) {
    return (import.meta.env.VITE_SHINPO_WS_URL as string).replace(/\/+$/, '')
  }

  const backendBase = getBackendBaseUrl()
  if (backendBase.startsWith('http://')) {
    return backendBase.replace('http://', 'ws://') + '/ws'
  }
  if (backendBase.startsWith('https://')) {
    return backendBase.replace('https://', 'wss://') + '/ws'
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/ws`
  }
  return 'ws://localhost:8080/ws'
}

