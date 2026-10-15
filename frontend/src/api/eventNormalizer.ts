import type {
  FocusSessionEvent,
  SentinelQuarantineEvent,
  SentinelStatusEvent,
} from './websocket'

/**
 * Safely parses any date/time representation into a valid ISO-8601 string.
 * Never throws and never returns "Invalid Date".
 */
export function toSafeIsoString(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return new Date().toISOString()
  }

  if (typeof raw === 'number') {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return new Date().toISOString()

    // If it's already an ISO or parsable date
    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

/**
 * Robustly formats a timestamp into a user-facing time string (HH:MM:SS AM/PM).
 * Guaranteed to never output "Invalid Date" under any condition.
 */
export function formatSafeTimeString(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    // If it's already a localized time string (e.g. "12:13:10 AM" or "14:20:00")
    if (/^\d{1,2}:\d{2}(:\d{2})?(\s?[AP]M)?$/i.test(trimmed)) {
      return trimmed
    }
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  }

  if (typeof raw === 'number') {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  }

  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Normalizes raw WebSocket FocusSession payloads across backend variations.
 */
export function normalizeFocusSessionEvent(raw: any): FocusSessionEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      id: 0,
      userId: 0,
      missionId: null,
      status: 'UNKNOWN',
      startTime: null,
      endTime: null,
      plannedDurationMinutes: 25,
      actualDurationMinutes: 0,
      interruptionCount: 0,
      debriefNotes: null,
      timestamp: new Date().toISOString(),
    }
  }

  const rawId = raw.id ?? raw.sessionId
  const parsedId = typeof rawId === 'number' ? rawId : Number(rawId) || 0

  const rawDur = raw.plannedDurationMinutes ?? raw.durationMinutes
  const parsedDur = typeof rawDur === 'number' ? rawDur : Number(rawDur) || 25

  return {
    id: parsedId,
    userId: Number(raw.userId) || 0,
    missionId: raw.missionId !== undefined && raw.missionId !== null ? Number(raw.missionId) : null,
    status: typeof raw.status === 'string' && raw.status.trim() ? raw.status.trim().toUpperCase() : 'UNKNOWN',
    startTime: raw.startedAt || raw.startTime || null,
    endTime: raw.endedAt || raw.endTime || null,
    plannedDurationMinutes: parsedDur,
    actualDurationMinutes: Number(raw.actualDurationMinutes ?? rawDur) || 0,
    interruptionCount: Number(raw.interruptionCount) || 0,
    debriefNotes: raw.debriefNotes || raw.intention || null,
    timestamp: toSafeIsoString(raw.timestamp),
  }
}

/**
 * Normalizes raw WebSocket SentinelStatus payloads across backend variations.
 */
export function normalizeSentinelStatusEvent(raw: any): SentinelStatusEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      userId: null,
      mode: 'STANDBY',
      isLocked: false,
      blockedCount: 0,
      allowedCount: 0,
      timestamp: new Date().toISOString(),
    }
  }

  const mode = raw.mode || raw.enforcementMode || 'STANDBY'
  const isLocked = Boolean(raw.isLocked ?? raw.policyLocked ?? false)
  const blockedCount = Number(raw.blockedCount) || 0
  const allowedCount = Number(raw.allowedCount) || 0

  return {
    userId: raw.userId !== undefined && raw.userId !== null ? Number(raw.userId) : null,
    mode: String(mode).toUpperCase(),
    isLocked,
    blockedCount,
    allowedCount,
    timestamp: toSafeIsoString(raw.timestamp),
  }
}

/**
 * Normalizes raw WebSocket Quarantine payloads across backend variations.
 */
export function normalizeSentinelQuarantineEvent(raw: any): SentinelQuarantineEvent {
  if (!raw || typeof raw !== 'object') {
    return {
      id: Date.now(),
      userId: null,
      focusSessionId: null,
      processName: 'Unknown Process',
      pid: 0,
      reason: 'Distraction blocked by Sentinel Shield',
      enforcementAction: 'TERMINATED',
      platform: 'linux',
      timestamp: new Date().toISOString(),
    }
  }

  const rawId = raw.id ?? Date.now()
  const rawSessionId = raw.focusSessionId ?? raw.sessionId

  return {
    id: Number(rawId) || Date.now(),
    userId: raw.userId !== undefined && raw.userId !== null ? Number(raw.userId) : null,
    focusSessionId: rawSessionId !== undefined && rawSessionId !== null ? Number(rawSessionId) : null,
    processName: String(raw.processName || 'Unknown Process'),
    pid: Number(raw.pid) || 0,
    reason: String(raw.reason || 'Distraction intercepted by Focus Protection'),
    enforcementAction: String(raw.enforcementAction || raw.policyAction || 'TERMINATED').toUpperCase(),
    platform: String(raw.platform || 'linux'),
    timestamp: toSafeIsoString(raw.timestamp),
  }
}

