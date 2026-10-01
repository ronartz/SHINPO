// Dynamic Backend Endpoint configuration for SHINPO Desktop (Tauri) & Local Dev
// In desktop mode, connects to the remote cloud server or local server via HTTPS/WSS.

export function getBackendBaseUrl(): string {
  // 1. Environment variable baked during build (e.g. VITE_SHINPO_SERVER_URL=https://api.yourdomain.com)
  if (import.meta.env.VITE_SHINPO_SERVER_URL) {
    return (import.meta.env.VITE_SHINPO_SERVER_URL as string).replace(/\/+$/, '')
  }

  // 2. Custom server URL configured by user in Desktop Settings
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('shinpo_custom_server_url')
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/+$/, '')
    }
  }

  // 3. Desktop mode fallback (when running inside Tauri without explicit setting)
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'http://localhost:8080'
  }

  // 4. Default for local Vite dev proxy: empty string uses relative path /api
  return ''
}

export function getWsBaseUrl(): string {
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
