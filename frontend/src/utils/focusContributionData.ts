import type { FocusSession } from '../api/focusSessions.ts'

export type FocusContributionDay = { date: string; count: number; durationSeconds: number }

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function buildFocusContributionData(
  sessions: Pick<FocusSession, 'status' | 'endedAt' | 'activeSeconds'>[],
  now = new Date(),
): FocusContributionDay[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - 364)
  const startMs = start.getTime()
  const nowMs = now.getTime()
  const daily = new Map<string, FocusContributionDay>()

  for (const session of sessions) {
    if (session.status !== 'COMPLETED' || !session.endedAt) continue
    const endMs = Date.parse(session.endedAt)
    if (!Number.isFinite(endMs) || endMs < startMs || endMs > nowMs) continue
    const key = localDateKey(new Date(endMs))
    const existing = daily.get(key) ?? { date: key, count: 0, durationSeconds: 0 }
    existing.count += 1
    existing.durationSeconds += Math.max(0, Number.isFinite(session.activeSeconds) ? session.activeSeconds : 0)
    daily.set(key, existing)
  }

  return [...daily.values()].sort((left, right) => left.date.localeCompare(right.date))
}
