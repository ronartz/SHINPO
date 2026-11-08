import type { FocusSession } from '../api/focusSessions'

export function sortFocusSessionsNewestFirst(sessions: FocusSession[]): FocusSession[] {
  if (!Array.isArray(sessions)) return []
  return [...sessions].sort((left, right) => {
    const timestamp = (session: FocusSession) => Date.parse(session.startedAt || session.scheduledAt || session.createdAt)
    const leftTime = timestamp(left)
    const rightTime = timestamp(right)
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
  })
}
