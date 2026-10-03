import { authHeaders } from './auth'

export type ShinpoPolicyState = 'ALLOWED' | 'BLOCKED' | 'PROTECTED' | 'UNKNOWN'

export interface ProcessInfo {
  pid: number
  name: string
  executablePath: string
  cpuPercent: number
  memoryBytes: number
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
  systemCpuLoad: number
  totalMemoryBytes: number
  freeMemoryBytes: number
  processCount: number
}

export interface ProcessSnapshot {
  systemInfo: DeviceSystemInfo
  processes: ProcessInfo[]
  timestamp: string
}

import { getBackendBaseUrl } from './config'

const API_BASE = `${getBackendBaseUrl()}/api/device`

export async function fetchDeviceSystemInfo(): Promise<DeviceSystemInfo> {
  const res = await fetch(`${API_BASE}/system-info`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch system info: ${res.status}`)
  return res.json()
}

export async function fetchProcesses(search?: string, policy?: string): Promise<ProcessInfo[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (policy && policy !== 'ALL') params.set('policy', policy)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await fetch(`${API_BASE}/processes${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch processes: ${res.status}`)
  return res.json()
}

export async function fetchDeviceSnapshot(search?: string, policy?: string): Promise<ProcessSnapshot> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (policy && policy !== 'ALL') params.set('policy', policy)
  const qs = params.toString() ? `?${params.toString()}` : ''

  const res = await fetch(`${API_BASE}/snapshot${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch device snapshot: ${res.status}`)
  return res.json()
}

export async function terminateProcess(pid: number, force: boolean = false): Promise<ProcessControlResult> {
  const res = await fetch(`${API_BASE}/processes/${pid}/terminate?force=${force}`, {
    method: 'POST',
    headers: authHeaders(),
  })
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
  status: 'ACTIVE_DEFENSE' | 'STANDBY' | 'IDLE' | string
  activeFocusSessionId: number | null
  activeFocusSessionName: string | null
  enforcementMode: 'STRICT' | 'AUDIT_ONLY' | 'CONTAINMENT' | string
  totalInterceptedToday: number
  activePolicyRulesCount: number
  tamperEventsCount?: number
  isPolicyLocked?: boolean
  recentQuarantines: SentinelQuarantineItem[]
  lastSweepAt: string | null
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
  const res = await fetch(`${SENTINEL_BASE}/status`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch Sentinel status: ${res.status}`)
  return res.json()
}

export async function triggerSentinelSweep(): Promise<SentinelSweepResult> {
  const res = await fetch(`${SENTINEL_BASE}/sweep`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to trigger Sentinel sweep: ${res.status}`)
  return res.json()
}

export async function fetchSentinelQuarantines(sessionId?: number): Promise<SentinelQuarantineItem[]> {
  const qs = sessionId ? `?sessionId=${sessionId}` : ''
  const res = await fetch(`${SENTINEL_BASE}/quarantines${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch quarantines: ${res.status}`)
  return res.json()
}

export async function fetchSentinelRules(): Promise<PolicyRule[]> {
  const res = await fetch(`${SENTINEL_BASE}/rules`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch policy rules: ${res.status}`)
  return res.json()
}

export async function addSentinelRule(processNamePattern: string, policyType: string = 'BLOCKED'): Promise<PolicyRule> {
  const res = await fetch(`${SENTINEL_BASE}/rules`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ processNamePattern, policyType }),
  })
  if (!res.ok) throw new Error(`Failed to add policy rule: ${res.status}`)
  return res.json()
}

export async function deleteSentinelRule(ruleId: number): Promise<void> {
  const res = await fetch(`${SENTINEL_BASE}/rules/${ruleId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.message || `Failed to delete policy rule: ${res.status}`)
  }
}

export async function updateSentinelMode(enforcementMode: string): Promise<SentinelStatus> {
  const res = await fetch(`${SENTINEL_BASE}/mode`, {
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
  const res = await fetch(`${SENTINEL_BASE}/emergency-override`, {
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
  const qs = sessionId ? `?sessionId=${sessionId}` : ''
  const res = await fetch(`${SENTINEL_BASE}/tamper-events${qs}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch tamper events: ${res.status}`)
  return res.json()
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
  const res = await fetch(`${SENTINEL_BASE}/warnings`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch active warnings: ${res.status}`)
  return res.json()
}

export async function respondToWarning(
  warningId: string,
  action: 'GRANT_GRACE' | 'TERMINATE_NOW',
  graceMinutes?: number,
): Promise<SentinelWarningItem> {
  const res = await fetch(`${SENTINEL_BASE}/warnings/${warningId}/respond`, {
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
