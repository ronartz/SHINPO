import { authHeaders, isLocalVaultSession } from './auth.ts'

export interface AnalyticsSummary {
  totalFocusMinutes: number
  sessionsCompleted: number
  sessionsStarted: number
  missionsCompleted: number
  missionsTotal: number
  avgQuality: number | null
  completionRate: number | null
  currentStreak: number
  completionRatePopulation: 'MISSIONS'
  completionRateNumerator: number
  completionRateDenominator: number
}

export interface DailyFocusVelocity {
  date: string
  dayName: string
  focusMinutes: number
  completedCount: number
}

export interface RecentDebrief {
  sessionId: number
  sessionName: string
  intention: string
  durationMinutes: number
  actualFocusMinutes: number
  quality: number | null
  accomplishment: string
  reflectionNote: string
  completedAt: string
}

export interface AnalyticsDashboardResponse {
  summary: AnalyticsSummary
  weeklyVelocity: DailyFocusVelocity[]
  recentDebriefs: RecentDebrief[]
}

export type AnalyticsRange = '24h' | '7d' | '30d' | '90d'

export interface AnalyticsActivityBucket {
  start: string
  end: string
  activeSeconds: number
  completedSessions: number
}

export interface AnalyticsPeriodResponse {
  range: AnalyticsRange
  timezone: 'UTC'
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
  currentBuckets: AnalyticsActivityBucket[]
  previousBuckets: AnalyticsActivityBucket[]
  currentActiveSeconds: number
  currentCompletedSessions: number
  previousActiveSeconds: number
  previousCompletedSessions: number
}

import { fetchWithoutRedirects, getBackendBaseUrl } from './config.ts'
function localCompletedSessions(sessions: import('./focusSessions.ts').FocusSession[]) {
  return sessions.filter((session) => session.status === 'COMPLETED')
}

async function localDashboard(): Promise<AnalyticsDashboardResponse> {
  const [{ getFocusSessions }, { getMissions }] = await Promise.all([import('./focusSessions.ts'), import('./goalsAndMissions.ts')])
  const [sessions, missions] = await Promise.all([getFocusSessions(), getMissions()])
  const completed = localCompletedSessions(sessions)
  const completedMissions = missions.filter((mission) => mission.status.toUpperCase() === 'COMPLETED').length
  const dates = new Set(completed.map((session) => (session.endedAt ?? session.createdAt).slice(0, 10)))
  const today = new Date().toISOString().slice(0, 10)
  let cursor = dates.has(today) ? today : dates.has(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)) ? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) : ''
  let currentStreak = 0
  while (cursor && dates.has(cursor)) {
    currentStreak++
    cursor = new Date(Date.parse(`${cursor}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  }
  const recentDebriefs = completed.filter((session) => session.accomplishment || session.reflectionNote)
    .sort((a, b) => (b.endedAt ?? b.createdAt).localeCompare(a.endedAt ?? a.createdAt)).slice(0, 20)
    .map((session) => ({ sessionId: session.id, sessionName: session.name, intention: session.intention ?? '', durationMinutes: session.durationMinutes,
      actualFocusMinutes: Math.round(session.activeSeconds / 60), quality: session.completionQuality ?? null,
      accomplishment: session.accomplishment ?? 'Session completed', reflectionNote: session.reflectionNote ?? '', completedAt: session.endedAt ?? session.createdAt }))
  const weeklyVelocity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86_400_000).toISOString().slice(0, 10)
    const day = completed.filter((session) => (session.endedAt ?? session.createdAt).slice(0, 10) === date)
    return { date, dayName: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(),
      focusMinutes: day.reduce((sum, session) => sum + Math.round(session.activeSeconds / 60), 0), completedCount: day.length }
  })
  const quality = completed.map((session) => session.completionQuality).filter((value): value is number => value != null && value > 0)
  return { summary: { totalFocusMinutes: Math.round(completed.reduce((sum, session) => sum + session.activeSeconds, 0) / 60),
    sessionsCompleted: completed.length, sessionsStarted: sessions.filter((session) => session.startedAt != null).length,
    missionsCompleted: completedMissions, missionsTotal: missions.length,
    avgQuality: quality.length ? Math.round(quality.reduce((sum, value) => sum + value, 0) / quality.length * 10) / 10 : null,
    completionRate: missions.length ? Math.round(completedMissions / missions.length * 100) : null, currentStreak,
    completionRatePopulation: 'MISSIONS', completionRateNumerator: completedMissions, completionRateDenominator: missions.length }, weeklyVelocity, recentDebriefs }
}

async function localPeriod(range: AnalyticsRange): Promise<AnalyticsPeriodResponse> {
  const { getFocusSessions } = await import('./focusSessions.ts')
  const sessions = localCompletedSessions(await getFocusSessions())
  const nowMs = Date.now()
  const bucketCount = range === '24h' ? 12 : range === '90d' ? 13 : range === '30d' ? 30 : 7
  const rangeSeconds = range === '90d' ? 90 * 86400 : bucketCount * (range === '24h' ? 7200 : 86400)
  const currentStartMs = nowMs - rangeSeconds * 1000
  const previousStartMs = currentStartMs - rangeSeconds * 1000
  const makeBuckets = (startMs: number, endMs: number): AnalyticsActivityBucket[] => Array.from({ length: bucketCount }, (_, index) => {
    const firstSpan = range === '90d' ? 6 * 86400 : range === '24h' ? 7200 : 86400
    const span = range === '90d' && index > 0 ? 7 * 86400 : firstSpan
    const start = startMs + (range === '90d' && index > 0 ? (6 + (index - 1) * 7) * 86400_000 : index * span * 1000)
    const end = index === bucketCount - 1 ? endMs : start + span * 1000
    return { start: new Date(start).toISOString(), end: new Date(end).toISOString(), activeSeconds: 0, completedSessions: 0 }
  })
  const currentBuckets = makeBuckets(currentStartMs, nowMs)
  const previousBuckets = makeBuckets(previousStartMs, currentStartMs)
  let currentActiveSeconds = 0, previousActiveSeconds = 0, currentCompletedSessions = 0, previousCompletedSessions = 0
  for (const session of sessions) {
    const ended = Date.parse(session.endedAt ?? session.createdAt)
    const isCurrent = ended >= currentStartMs && ended < nowMs
    if (!isCurrent && !(ended >= previousStartMs && ended < currentStartMs)) continue
    const start = isCurrent ? currentStartMs : previousStartMs
    const index = Math.min(bucketCount - 1, Math.max(0, range === '90d' ? ended - start < 6 * 86400_000 ? 0 : 1 + Math.floor((ended - start - 6 * 86400_000) / (7 * 86400_000)) : Math.floor((ended - start) / (range === '24h' ? 7200_000 : 86400_000))))
    const buckets = isCurrent ? currentBuckets : previousBuckets
    buckets[index].activeSeconds += session.activeSeconds
    buckets[index].completedSessions++
    if (isCurrent) { currentActiveSeconds += session.activeSeconds; currentCompletedSessions++ }
    else { previousActiveSeconds += session.activeSeconds; previousCompletedSessions++ }
  }
  return { range, timezone: 'UTC', currentStart: new Date(currentStartMs).toISOString(), currentEnd: new Date(nowMs).toISOString(),
    previousStart: new Date(previousStartMs).toISOString(), previousEnd: new Date(currentStartMs).toISOString(), currentBuckets, previousBuckets,
    currentActiveSeconds, currentCompletedSessions, previousActiveSeconds, previousCompletedSessions }
}

const API_BASE = `${getBackendBaseUrl()}/api/analytics`

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardResponse> {
  if (isLocalVaultSession()) return localDashboard()
  const res = await fetchWithoutRedirects(`${API_BASE}/dashboard`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch analytics dashboard: ${res.status}`)
  return res.json()
}

export async function fetchAnalyticsPeriod(range: AnalyticsRange, signal?: AbortSignal): Promise<AnalyticsPeriodResponse> {
  if (isLocalVaultSession()) {
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
    return localPeriod(range)
  }
  const res = await fetchWithoutRedirects(`${API_BASE}/period?range=${range}`, {
    headers: authHeaders(),
    signal,
  })
  if (!res.ok) throw new Error(`Failed to fetch analytics period: ${res.status}`)
  return res.json()
}
