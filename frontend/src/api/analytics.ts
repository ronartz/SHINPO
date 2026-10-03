import { authHeaders } from './auth'

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

import { getBackendBaseUrl } from './config'

const API_BASE = `${getBackendBaseUrl()}/api/analytics`

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboardResponse> {
  const res = await fetch(`${API_BASE}/dashboard`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch analytics dashboard: ${res.status}`)
  return res.json()
}
