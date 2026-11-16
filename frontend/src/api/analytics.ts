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
  focusSeconds?: number
  completedCount: number
}

export interface RecentDebrief {
  sessionId: number
  sessionName: string
  intention: string
  durationMinutes: number
  actualFocusMinutes: number
  actualFocusSeconds?: number
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
  timezone: string
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

  const ref = new Date()
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()

  const dateSet = new Set<string>()
  for (const session of completed) {
    const t = new Date(session.endedAt ?? session.createdAt)
    dateSet.add(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`)
  }
  const todayKey = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const yesterdayDate = new Date(y, m, d - 1)
  const yesterdayKey = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`
  const cursorDate = dateSet.has(todayKey) ? ref : dateSet.has(yesterdayKey) ? yesterdayDate : null
  let currentStreak = 0
  if (cursorDate) {
    let checkDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate())
    while (true) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
      if (dateSet.has(key)) {
        currentStreak++
        checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  const recentDebriefs = completed.filter((session) => session.accomplishment || session.reflectionNote)
    .sort((a, b) => (b.endedAt ?? b.createdAt).localeCompare(a.endedAt ?? a.createdAt)).slice(0, 20)
    .map((session) => ({
      sessionId: session.id,
      sessionName: session.name,
      intention: session.intention ?? '',
      durationMinutes: session.durationMinutes,
      actualFocusMinutes: Math.round(session.activeSeconds / 60),
      actualFocusSeconds: session.activeSeconds,
      quality: session.completionQuality ?? null,
      accomplishment: session.accomplishment ?? 'Session completed',
      reflectionNote: session.reflectionNote ?? '',
      completedAt: session.endedAt ?? session.createdAt,
    }))

  const weeklyVelocity = Array.from({ length: 7 }, (_, index) => {
    const dayOffset = 6 - index
    const start = new Date(y, m, d - dayOffset, 0, 0, 0, 0)
    const end = new Date(y, m, d - dayOffset + 1, 0, 0, 0, 0)
    const startMs = start.getTime()
    const endMs = end.getTime()
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    const daySessions = completed.filter((session) => {
      const time = new Date(session.endedAt ?? session.createdAt).getTime()
      return time >= startMs && time < endMs
    })
    return {
      date,
      dayName: start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      focusSeconds: daySessions.reduce((sum, session) => sum + session.activeSeconds, 0),
      focusMinutes: Math.round(daySessions.reduce((sum, session) => sum + session.activeSeconds, 0) / 60),
      completedCount: daySessions.length,
    }
  })

  const quality = completed.map((session) => session.completionQuality).filter((value): value is number => value != null && value > 0)

  return {
    summary: {
      totalFocusMinutes: Math.round(completed.reduce((sum, session) => sum + session.activeSeconds, 0) / 60),
      sessionsCompleted: completed.length,
      sessionsStarted: sessions.filter((session) => session.startedAt != null).length,
      missionsCompleted: completedMissions,
      missionsTotal: missions.length,
      avgQuality: quality.length ? Math.round(quality.reduce((sum, value) => sum + value, 0) / quality.length * 10) / 10 : null,
      completionRate: missions.length ? Math.round(completedMissions / missions.length * 100) : null,
      currentStreak,
      completionRatePopulation: 'MISSIONS',
      completionRateNumerator: completedMissions,
      completionRateDenominator: missions.length,
    },
    weeklyVelocity,
    recentDebriefs,
  }
}

async function localPeriod(range: AnalyticsRange): Promise<AnalyticsPeriodResponse> {
  const [{ getFocusSessions }, { aggregateSessionsIntoPeriod }] = await Promise.all([
    import('./focusSessions.ts'),
    import('../utils/analyticsEngine.ts'),
  ])
  const sessions = await getFocusSessions()
  return aggregateSessionsIntoPeriod(sessions, range)
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
