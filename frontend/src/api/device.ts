import { authHeaders, isLocalVaultSession } from './auth.ts'
import { invokeTauriCommand, isTauriEnvironment } from './tauri.ts'

export type ShinpoPolicyState = 'ALLOWED' | 'BLOCKED' | 'PROTECTED' | 'UNKNOWN'

export interface ProcessInfo {
  pid: number
  name: string
  executablePath: string
  cpuPercent: number | null
  memoryBytes: number | null
  status: string
  startedAt: string | null
  user: string
  shinpoPolicyState: ShinpoPolicyState
  policyReason: string
  canControl: boolean
}

export interface ProcessControlResult {
  pid: number
  action: string
  status: string
  message: string
}

export interface DeviceSystemInfo {
  deviceName: string
  osName: string
  osVersion: string
  osArch: string
  availableProcessors: number
  systemCpuLoad: number | null
  totalMemoryBytes: number
  freeMemoryBytes: number
  processCount: number | null
}

export interface CoreTelemetry {
  name: string
  usagePercent: number
  frequencyMhz: number
}

export interface DiskTelemetry {
  name: string
  mountPoint: string
  totalBytes: number
  availableBytes: number
  fileSystem: string
}

export interface NetworkTelemetry {
  interfaceName: string
  rxBytes: number
  txBytes: number
}

export interface SystemTelemetry {
  deviceName: string
  osName: string
  osVersion: string
  osArch: string
  availableProcessors: number
  cpuUsagePercent: number
  cores: CoreTelemetry[]
  totalMemoryBytes: number
  usedMemoryBytes: number
  freeMemoryBytes: number
  availableMemoryBytes: number
  totalSwapBytes: number
  usedSwapBytes: number
  freeSwapBytes: number
  disks: DiskTelemetry[]
  networks: NetworkTelemetry[]
  processCount: number
  timestamp: string
}

export interface ProcessSnapshot {
  systemInfo: DeviceSystemInfo
  processes: ProcessInfo[]
  telemetry?: SystemTelemetry
  timestamp: string
}

import { fetchWithoutRedirects, getBackendBaseUrl } from './config.ts'

const API_BASE = `${getBackendBaseUrl()}/api/device`

function requireBackendDeviceApi(): void {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    throw new Error('Sentinel device controls are not available for this local account yet. No backend request was made.')
  }
}

export async function fetchLocalSystemTelemetry(): Promise<SystemTelemetry> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<SystemTelemetry>('local_get_system_telemetry')
  }
  const sysInfo = await fetchDeviceSystemInfo()
  return {
    deviceName: sysInfo.deviceName,
    osName: sysInfo.osName,
    osVersion: sysInfo.osVersion,
    osArch: sysInfo.osArch,
    availableProcessors: sysInfo.availableProcessors,
    cpuUsagePercent: sysInfo.systemCpuLoad ?? 0,
    cores: [],
    totalMemoryBytes: sysInfo.totalMemoryBytes,
    usedMemoryBytes: sysInfo.totalMemoryBytes - sysInfo.freeMemoryBytes,
    freeMemoryBytes: sysInfo.freeMemoryBytes,
    availableMemoryBytes: sysInfo.freeMemoryBytes,
    totalSwapBytes: 0,
    usedSwapBytes: 0,
    freeSwapBytes: 0,
    disks: [],
    networks: [],
    processCount: sysInfo.processCount ?? 0,
    timestamp: new Date().toISOString(),
  }
}

export async function fetchDeviceSystemInfo(): Promise<DeviceSystemInfo> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const snapshot = await invokeTauriCommand<ProcessSnapshot>('local_get_process_snapshot', {})
    return snapshot.systemInfo
  }
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${API_BASE}/system-info`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch system info: ${res.status}`)
  return res.json()
}

export async function fetchProcesses(search?: string, policy?: string): Promise<ProcessInfo[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const snapshot = await invokeTauriCommand<ProcessSnapshot>('local_get_process_snapshot', { search, policy })
    return snapshot.processes
  }
  requireBackendDeviceApi()
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (policy && policy !== 'ALL') params.set('policy', policy)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await fetchWithoutRedirects(`${API_BASE}/processes${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch processes: ${res.status}`)
  return res.json()
}

export async function fetchDeviceSnapshot(search?: string, policy?: string): Promise<ProcessSnapshot> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<ProcessSnapshot>('local_get_process_snapshot', { search, policy })
  }
  requireBackendDeviceApi()
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (policy && policy !== 'ALL') params.set('policy', policy)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await fetchWithoutRedirects(`${API_BASE}/snapshot${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch device snapshot: ${res.status}`)
  return res.json()
}

export async function terminateProcess(pid: number, force: boolean = false): Promise<ProcessControlResult> {
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${API_BASE}/processes/${pid}/terminate?force=${force}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (res.status === 403 || res.status === 409 || res.status === 400 || res.status === 501) {
    try {
      return await res.json()
    } catch {
      // fallback
    }
  }
  if (!res.ok) throw new Error(`Failed to terminate process: ${res.status}`)
  return res.json()
}

export interface SentinelQuarantineItem {
  id: number
  focusSessionId: number | null
  pid: number
  processName: string
  commandLine: string | null
  policyAction: string
  enforcementMode: string
  reason: string
  detectedAt: string
}

export interface SentinelStatus {
  status: 'ACTIVE_DEFENSE' | 'STANDBY' | 'IDLE' | 'ACTIVE' | 'DEGRADED' | 'UNAVAILABLE' | 'READY' | string
  activeFocusSessionId: number | null
  activeFocusSessionName: string | null
  enforcementMode: 'STRICT' | 'AUDIT_ONLY' | 'CONTAINMENT' | string
  totalInterceptedToday: number
  activePolicyRulesCount: number
  tamperEventsCount?: number
  isPolicyLocked?: boolean
  recentQuarantines: SentinelQuarantineItem[]
  lastSweepAt: string | null
  daemonConnected?: boolean
  lastDaemonSyncAt?: string | null
  guardianMode?: string | null
  focusPhase?: string | null
  guardianWarningCount?: number
  guardianAppCatalogVersion?: string
  guardianDomainCatalogVersion?: string
  warningOnly?: boolean
  guardianCapability?: 'OBSERVE_AND_WARN' | 'UNAVAILABLE'
  browserCompanionSupported?: boolean
  interventionCapability?: string
  standardAllowanceSeconds?: number | null
  lastGuardianObservationAt?: string | null
  observerStatus?: string
  applicationPolicyStatus?: string
  guardianApplicationCatalog?: GuardianCatalogEntry[]
  guardianObservations?: GuardianObservation[]
}

export interface GuardianCatalogEntry {
  processName: string
  category: string
  rationale: string
}

export interface GuardianObservation {
  id: number
  sessionId: number
  pid: number
  processName: string
  catalogVersion: string
  category: string
  rationale: string
  guardianMode: string
  focusPhase: string
  outcome: string
  observedAt: string
}

export interface SentinelTamperEventItem {
  id: number
  focusSessionId: number | null
  eventType: string
  severity: string
  enforcementMode: string
  justification: string | null
  details: string | null
  createdAt: string
}

export interface EmergencyOverrideRequest {
  password: string
  reason: string
  targetMode?: string
}

export interface EmergencyOverrideResponse {
  success: boolean
  message: string
  newMode: string
  timestamp: string
}

export interface SentinelSweepResult {
  scannedProcessCount: number
  interceptedCount: number
  interceptedPids: number[]
  interceptedNames: string[]
  message: string
  timestamp: string
}

export interface PolicyRule {
  id: number
  processNamePattern: string
  policyType: 'BLOCKED' | 'ALLOWED' | string
  isCustom: boolean
  createdAt: string
}

const SENTINEL_BASE = `${API_BASE}/sentinel`

export async function fetchSentinelStatus(): Promise<SentinelStatus> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const capabilities = await invokeTauriCommand<{
      guardian: 'OBSERVE_AND_WARN' | 'UNAVAILABLE'
      browserCompanionSupported: boolean
    }>('local_platform_capabilities')
    if (capabilities.guardian === 'UNAVAILABLE') {
      return {
        status: 'UNAVAILABLE', activeFocusSessionId: null, activeFocusSessionName: null,
        enforcementMode: 'AUDIT_ONLY', totalInterceptedToday: 0, activePolicyRulesCount: 0,
        isPolicyLocked: false, recentQuarantines: [], lastSweepAt: null, daemonConnected: false,
        warningOnly: true, guardianCapability: capabilities.guardian,
        browserCompanionSupported: capabilities.browserCompanionSupported,
        interventionCapability: 'UNAVAILABLE', observerStatus: 'UNAVAILABLE',
        applicationPolicyStatus: 'UNAVAILABLE', guardianWarningCount: 0,
        guardianApplicationCatalog: [], guardianObservations: [],
      }
    }
    const local = await invokeTauriCommand<{
      status: 'LOCKED' | 'READY' | 'ACTIVE' | 'PAUSED'
      activeFocusSessionId: number | null
      activeFocusSessionName: string | null
      guardianMode: string | null
      focusPhase: string | null
      observationsToday: number
      lastObservationAt: string | null
      appCatalogVersion: string
      domainCatalogVersion: string
      warningOnly: boolean
      interventionCapability: string
      standardAllowanceSeconds: number | null
      observerStatus: string
      applicationPolicyStatus: string
      applicationCatalog: GuardianCatalogEntry[]
    }>('local_get_guardian_status')
    const guardianObservations = local.status === 'LOCKED' || local.activeFocusSessionId === null
      ? []
      : await invokeTauriCommand<GuardianObservation[]>(
        'local_get_guardian_observations',
        { sessionId: local.activeFocusSessionId ?? undefined },
      )
    return {
      status: local.status === 'ACTIVE' ? 'ACTIVE' : local.status === 'PAUSED' ? 'STANDBY' : local.status === 'LOCKED' ? 'UNAVAILABLE' : 'READY',
      activeFocusSessionId: local.activeFocusSessionId,
      activeFocusSessionName: local.activeFocusSessionName,
      enforcementMode: 'AUDIT_ONLY',
      totalInterceptedToday: 0,
      activePolicyRulesCount: 0,
      isPolicyLocked: local.status === 'ACTIVE',
      recentQuarantines: [],
      lastSweepAt: null,
      daemonConnected: local.status !== 'LOCKED',
      guardianMode: local.guardianMode,
      focusPhase: local.focusPhase,
      guardianWarningCount: local.observationsToday,
      guardianAppCatalogVersion: local.appCatalogVersion,
      guardianDomainCatalogVersion: local.domainCatalogVersion,
      warningOnly: local.warningOnly,
      guardianCapability: capabilities.guardian,
      browserCompanionSupported: capabilities.browserCompanionSupported,
      interventionCapability: local.interventionCapability,
      standardAllowanceSeconds: local.standardAllowanceSeconds,
      lastGuardianObservationAt: local.lastObservationAt,
      observerStatus: local.observerStatus,
      applicationPolicyStatus: local.applicationPolicyStatus,
      guardianApplicationCatalog: local.applicationCatalog,
      guardianObservations,
    }
  }
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/status`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch Sentinel status: ${res.status}`)
  return res.json()
}

export async function triggerSentinelSweep(): Promise<SentinelSweepResult> {
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/sweep`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to trigger Sentinel sweep: ${res.status}`)
  return res.json()
}

export async function fetchSentinelQuarantines(sessionId?: number): Promise<SentinelQuarantineItem[]> {
  requireBackendDeviceApi()
  const qs = sessionId ? `?sessionId=${sessionId}` : ''
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/quarantines${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch quarantines: ${res.status}`)
  return res.json()
}

export async function fetchSentinelRules(): Promise<PolicyRule[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    try {
      const policies = await fetchGuardianAppPolicies()
      return policies.map((p) => ({
        id: p.id,
        processNamePattern: p.execName,
        policyType: p.policyType,
        isCustom: true,
        createdAt: p.createdAt,
      }))
    } catch {
      return []
    }
  }
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/rules`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch policy rules: ${res.status}`)
  return res.json()
}

export async function addSentinelRule(processNamePattern: string, policyType: string = 'BLOCKED'): Promise<PolicyRule> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const p = await saveGuardianAppPolicy({
      appId: processNamePattern.trim().toLowerCase(),
      appName: processNamePattern.trim(),
      execName: processNamePattern.trim().toLowerCase(),
      policyType: policyType === 'ALLOWED' ? 'ALLOWED' : 'BLOCKED',
      source: 'custom',
    })
    return {
      id: p.id,
      processNamePattern: p.execName,
      policyType: p.policyType,
      isCustom: true,
      createdAt: p.createdAt,
    }
  }
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/rules`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ processNamePattern, policyType }),
  })
  if (!res.ok) throw new Error(`Failed to add policy rule: ${res.status}`)
  return res.json()
}

export async function deleteSentinelRule(ruleId: number): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const policies = await fetchGuardianAppPolicies()
    const target = policies.find((p) => p.id === ruleId)
    if (target) {
      await removeGuardianAppPolicy(target.appId)
    }
    return
  }
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/rules/${ruleId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.message || `Failed to delete policy rule: ${res.status}`)
  }
}

export interface DiscoveredApp {
  id: string
  name: string
  platform: string
  source: string
  icon?: string | null
  execName?: string | null
  isRunning: boolean
  policy: 'BLOCKED' | 'ALLOWED' | 'NONE'
  enforcementCapability: 'TERMINATE' | 'MONITOR_ONLY' | 'UNSUPPORTED'
  unsupportedReason?: string | null
}

export interface GuardianAppPolicy {
  id: number
  appId: string
  appName: string
  execName: string
  policyType: 'BLOCKED' | 'ALLOWED'
  source: string
  createdAt: string
  updatedAt: string
}

export interface SaveAppPolicyRequest {
  appId: string
  appName: string
  execName: string
  policyType: 'BLOCKED' | 'ALLOWED'
  source?: string
}

export async function fetchDiscoveredApps(): Promise<DiscoveredApp[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<DiscoveredApp[]>('local_get_discovered_apps')
  }
  return []
}

export async function fetchGuardianAppPolicies(): Promise<GuardianAppPolicy[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<GuardianAppPolicy[]>('local_get_app_policies')
  }
  return []
}

export async function saveGuardianAppPolicy(payload: SaveAppPolicyRequest): Promise<GuardianAppPolicy> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<GuardianAppPolicy>('local_save_app_policy', { request: payload })
  }
  throw new Error('Local policy save is unavailable in this environment')
}

export async function removeGuardianAppPolicy(appId: string): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    return invokeTauriCommand<void>('local_remove_app_policy', { appId })
  }
  throw new Error('Local policy deletion is unavailable in this environment')
}

export async function updateSentinelMode(enforcementMode: string): Promise<SentinelStatus> {
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/mode`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ enforcementMode }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.message || `Failed to update enforcement mode: ${res.status}`)
  }
  return res.json()
}

export async function emergencyOverride(request: EmergencyOverrideRequest): Promise<EmergencyOverrideResponse> {
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/emergency-override`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.message || `Emergency override failed: ${res.status}`)
  }
  return res.json()
}

export async function fetchSentinelTamperEvents(sessionId?: number): Promise<SentinelTamperEventItem[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) return []
  requireBackendDeviceApi()
  const qs = sessionId ? `?sessionId=${sessionId}` : ''
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/tamper-events${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch tamper events: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export interface SentinelWarningItem {
  warningId: string
  sessionId: number | null
  processName: string
  commandLine: string | null
  issuedAt: string
  decisionDeadline: string
  status: 'ISSUED' | 'GRACE_ACTIVE' | 'TERMINATE_NOW' | 'EXPIRED' | 'CANCELLED' | string
  graceExpiresAt: string | null
  effectiveGraceMinutes: number | null
}

export async function fetchActiveWarnings(): Promise<SentinelWarningItem[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) return []
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/warnings`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch active warnings: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function respondToWarning(
  warningId: string,
  action: 'GRANT_GRACE' | 'TERMINATE_NOW',
  graceMinutes?: number,
): Promise<SentinelWarningItem> {
  requireBackendDeviceApi()
  const res = await fetchWithoutRedirects(`${SENTINEL_BASE}/warnings/${warningId}/respond`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action, graceMinutes }),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.message || `Failed to respond to warning: ${res.status}`)
  }
  return res.json()
}
