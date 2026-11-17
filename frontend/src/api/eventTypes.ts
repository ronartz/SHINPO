export interface SentinelQuarantineEvent {
  id: number
  userId: number | null
  focusSessionId: number | null
  processName: string
  pid: number
  reason: string
  enforcementAction: string
  platform: string
  timestamp: string
}

export interface SentinelStatusEvent {
  userId: number | null
  mode: string
  isLocked: boolean
  blockedCount: number
  allowedCount: number
  timestamp: string
}

export interface FocusSessionEvent {
  id: number
  userId: number
  missionId: number | null
  status: string
  startTime: string | null
  endTime: string | null
  plannedDurationMinutes: number
  actualDurationMinutes: number
  interruptionCount: number
  debriefNotes: string | null
  timestamp: string
}

export type QuarantineListener = (event: SentinelQuarantineEvent) => void
export type SentinelStatusListener = (event: SentinelStatusEvent) => void
export type FocusSessionListener = (event: FocusSessionEvent) => void
export type ConnectionListener = (connected: boolean) => void
