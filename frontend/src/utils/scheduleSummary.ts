import type { FocusSession } from '../api/focusSessions'

export function summarizeSchedule(sessions: FocusSession[]) {
  return sessions.reduce((summary, session) => {
    summary.actualSeconds += Math.max(0, Number(session.activeSeconds) || 0)
    if (session.status === 'CANCELLED' || session.status === 'EXPIRED' || session.status === 'FAILED') return summary
    summary.plannedMinutes += Number(session.durationMinutes) || 0
    summary.plannedCount += 1
    if (session.status === 'COMPLETED') summary.completed += 1
    if (session.status === 'SCHEDULED') summary.upcoming += 1
    return summary
  }, { plannedMinutes: 0, actualSeconds: 0, plannedCount: 0, completed: 0, upcoming: 0 })
}

export function formatScheduleDuration(minutes: number) {
  if (!Number.isFinite(minutes) || isNaN(minutes) || minutes <= 0) return '0m'
  const wholeMinutes = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(wholeMinutes / 60)
  const remainder = wholeMinutes % 60
  if (hours === 0) return `${remainder}m`
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}
