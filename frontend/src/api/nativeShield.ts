import { getAuthToken } from './auth'

export interface NativeShieldStatus {
  isActive: boolean
  isConnected: boolean
  enforcementMode: string | null
  activeSessionId: number | null
  lastError: string | null
}

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w
}

export async function invokeTauriCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('Tauri invocation unavailable in non-browser context')
  }
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> }
    __TAURI__?: {
      core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> }
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<T>
    }
  }

  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(cmd, args)
  }
  if (w.__TAURI__?.core?.invoke) {
    return w.__TAURI__.core.invoke(cmd, args)
  }
  if (w.__TAURI__?.invoke) {
    return w.__TAURI__.invoke(cmd, args)
  }
  throw new Error(`Tauri invoke not found on window object for command: ${cmd}`)
}

export async function startNativeShield(apiUrl?: string): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null
  }
  try {
    const token = getAuthToken() || undefined
    const res = await invokeTauriCommand<string>('start_shield_service', {
      apiUrl: apiUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'),
      token,
    })
    console.info('[NativeShield] Shield service started:', res)
    return res
  } catch (err) {
    console.warn('[NativeShield] Failed to start native shield service:', err)
    return null
  }
}

export async function stopNativeShield(): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null
  }
  try {
    const res = await invokeTauriCommand<string>('stop_shield_service')
    console.info('[NativeShield] Shield service stopped:', res)
    return res
  } catch (err) {
    console.warn('[NativeShield] Failed to stop native shield service:', err)
    return null
  }
}

export async function getNativeShieldStatus(): Promise<NativeShieldStatus | null> {
  if (!isTauriEnvironment()) {
    return null
  }
  try {
    const status = await invokeTauriCommand<{
      is_active: boolean
      is_connected: boolean
      enforcement_mode?: string | null
      active_session_id?: number | null
      last_error?: string | null
    }>('get_shield_status')

    return {
      isActive: status.is_active,
      isConnected: status.is_connected,
      enforcementMode: status.enforcement_mode ?? null,
      activeSessionId: status.active_session_id ?? null,
      lastError: status.last_error ?? null,
    }
  } catch (err) {
    console.warn('[NativeShield] Failed to query shield status:', err)
    return null
  }
}

