import type { FocusSession } from '../api/focusSessions.js'

export function getSortedScheduleSessions(
  sessions: FocusSession[],
  activeSession?: FocusSession | null
): FocusSession[] {
  if (!sessions || sessions.length === 0) return []

  return [...sessions].sort((a, b) => {
    // 1. ACTIVE or PAUSED sessions first
    const aIsActive = a.status === 'ACTIVE' || a.status === 'PAUSED' || (activeSession && activeSession.id === a.id)
    const bIsActive = b.status === 'ACTIVE' || b.status === 'PAUSED' || (activeSession && activeSession.id === b.id)
    if (aIsActive && !bIsActive) return -1
    if (!aIsActive && bIsActive) return 1

    // 2. SCHEDULED sessions next (ordered by scheduledAt if present, or id)
    const aIsScheduled = a.status === 'SCHEDULED'
    const bIsScheduled = b.status === 'SCHEDULED'
    if (aIsScheduled && !bIsScheduled) return -1
    if (!aIsScheduled && bIsScheduled) return 1

    if (a.scheduledAt && b.scheduledAt) {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    }

    // 3. COMPLETED sessions last
    const aIsDone = a.status === 'COMPLETED'
    const bIsDone = b.status === 'COMPLETED'
    if (aIsDone && !bIsDone) return 1
    if (!aIsDone && bIsDone) return -1

    return a.id - b.id
  })
}

export function getSessionSecondaryInfo(s: FocusSession): string {
  // 1. If active
  if (s.status === 'ACTIVE') {
    return 'In Progress • Focus Sprint Active'
  }
  if (s.status === 'PAUSED') {
    return 'Paused • Ready to resume'
  }
  // 2. If scheduled with a scheduledAt date/time
  if (s.scheduledAt) {
    try {
      const d = new Date(s.scheduledAt)
      if (!isNaN(d.getTime())) {
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
        if (s.intention && s.intention.trim().toLowerCase() !== s.name.trim().toLowerCase()) {
          return `${timeStr} • ${s.intention.trim()}`
        }
        return `Scheduled for ${timeStr}`
      }
    } catch {
      // Fallback
    }
  }
  // 3. If completed
  if (s.status === 'COMPLETED') {
    if (s.accomplishment && s.accomplishment.trim().toLowerCase() !== s.name.trim().toLowerCase()) {
      return `Completed • ${s.accomplishment.trim()}`
    }
    return `Completed • ${s.durationMinutes}m logged`
  }
  // 4. Default
  return s.intention && s.intention.trim().toLowerCase() !== s.name.trim().toLowerCase()
    ? s.intention.trim()
    : `${s.durationMinutes}m sprint`
}

