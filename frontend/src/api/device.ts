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

const API_BASE = '/api/device'

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
