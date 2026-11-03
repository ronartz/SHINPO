import { invokeTauriCommand, isTauriEnvironment } from './tauri'
export { invokeTauriCommand, isTauriEnvironment } from './tauri'

export interface NativeGuardianStatus {
  status: 'LOCKED' | 'READY' | 'ACTIVE' | 'PAUSED' | string
  activeFocusSessionId: number | null
  activeFocusSessionName: string | null
  guardianMode: string | null
  focusPhase: string | null
  observationsToday: number
  lastObservationAt: string | null
  appCatalogVersion: string
  domainCatalogVersion: string
  warningOnly: boolean
}

export async function getNativeGuardianStatus(): Promise<NativeGuardianStatus | null> {
  if (!isTauriEnvironment()) return null
  return invokeTauriCommand<NativeGuardianStatus>('local_get_guardian_status')
}
