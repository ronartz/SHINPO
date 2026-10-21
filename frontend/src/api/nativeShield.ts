import { getAuthToken } from './auth'
import { getBackendBaseUrl } from './config'
import { invokeTauriCommand, isTauriEnvironment } from './tauri'

export { invokeTauriCommand, isTauriEnvironment } from './tauri'

export interface NativeShieldStatus {
  isActive: boolean
  isConnected: boolean
  enforcementMode: string | null
  activeSessionId: number | null
  lastError: string | null
}

export async function startNativeShield(apiUrl?: string): Promise<string | null> {
  if (!isTauriEnvironment()) {
    return null
  }
  try {
    const token = getAuthToken() || undefined
    const targetUrl = apiUrl || getBackendBaseUrl() || 'http://localhost:8080'
    const res = await invokeTauriCommand<string>('start_shield_service', {
      apiUrl: targetUrl,
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

