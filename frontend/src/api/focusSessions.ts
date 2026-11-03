export type FocusSessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'

export type GuardianMode = 'GUIDED' | 'PROTECTED' | 'STRICT'

export type SessionResult = {
  quality?: number
  reflectionNote?: string
  accomplishment?: string
}

export type FocusSession = {
  id: number
  userId: number
  goalId: number | null
  missionId: number | null
  planId?: number | null
  name: string
  intention: string | null
  durationMinutes: number
  pomodoroEnabled?: boolean
  pomodoroFocusCycles?: number
  pomodoroShortBreakMinutes?: number
  pomodoroLongBreakMinutes?: number
  completedFocusCycles?: number
  pomodoroGraceMinutes?: number
  latePenaltyEnabled?: boolean
  latePenaltyXp?: number
  latePenaltyDailyCapXp?: number
  guardianMode?: GuardianMode
  guardianAppMonitoring?: boolean
  currentPhase?: 'FOCUS' | 'BREAK' | 'SHORT_BREAK' | 'LONG_BREAK' | 'GRACE' | 'RETURN_REQUIRED' | 'COMPLETE'
  phaseDeadlineAt?: number | null
  phaseRevision?: number
  interruptionCount?: number
  focusActiveSeconds?: number
  breakActiveSeconds?: number
  status: FocusSessionStatus
  scheduledAt: string | null
  startedAt: string | null
  pausedAt: string | null
  accumulatedPausedSeconds: number
  activeSeconds: number
  remainingSeconds?: number
  serverTime?: string
  endedAt: string | null
  createdAt: string
  updatedAt: string
  completionQuality?: number | null
  reflectionNote?: string | null
  accomplishment?: string | null
  result?: SessionResult | null
}

export type CompleteFocusSessionPayload = {
  quality?: number
  reflectionNote?: string
  accomplishment?: string
  markMissionCompleted?: boolean
}

export type UpdateFocusSessionPayload = {
  goalId?: number | null
  missionId?: number | null
  unlinkTask?: boolean
  name?: string
  intention?: string
  durationMinutes?: number
  scheduledAt?: string
}

export type CreateFocusSessionRequest = {
  userId?: number
  goalId?: number
  missionId?: number
  planId?: number
  name: string
  intention?: string
  durationMinutes: number
  scheduledAt?: string
  pomodoroEnabled?: boolean
  pomodoroFocusCycles?: number
  pomodoroShortBreakMinutes?: number
  pomodoroLongBreakMinutes?: number
  pomodoroGraceMinutes?: number
  latePenaltyEnabled?: boolean
  latePenaltyXp?: number
  latePenaltyDailyCapXp?: number
  guardianMode?: GuardianMode
  guardianAppMonitoring?: boolean
}

export type { GuardianObservation } from './device.ts'
import type { GuardianObservation } from './device.ts'

import { getAuthenticatedUserId, isLocalVaultSession } from './auth.ts'
import { apiClient } from './client.ts'
import { invokeTauriCommand, isTauriEnvironment } from './tauri.ts'

const isLocalFocusMode = () => isTauriEnvironment() && isLocalVaultSession()

async function refreshLocalBrowserPolicy(): Promise<void> {
  if (isLocalFocusMode()) await invokeTauriCommand('local_sync_browser_policy').catch(() => undefined)
}

function localSessionDate(session: FocusSession): string {
  const value = session.scheduledAt ?? session.startedAt ?? session.createdAt
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const timezoneHeader = () => ({
  'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
})

export async function createFocusSession(
  request: CreateFocusSessionRequest,
): Promise<FocusSession> {
  if (isLocalFocusMode()) return invokeTauriCommand('local_create_focus_session', { request: {
    goalId: request.goalId ?? null, missionId: request.missionId ?? null, name: request.name,
    intention: request.intention ?? null, durationMinutes: request.durationMinutes,
    scheduledAt: request.scheduledAt ?? null, pomodoroEnabled: request.pomodoroEnabled ?? false,
    pomodoroFocusCycles: request.pomodoroFocusCycles, pomodoroShortBreakMinutes: request.pomodoroShortBreakMinutes,
    pomodoroLongBreakMinutes: request.pomodoroLongBreakMinutes, pomodoroGraceMinutes: request.pomodoroGraceMinutes,
    latePenaltyEnabled: request.latePenaltyEnabled ?? false, latePenaltyXp: request.latePenaltyXp ?? 5,
    latePenaltyDailyCapXp: request.latePenaltyDailyCapXp ?? 20,
    guardianMode: request.guardianMode ?? 'PROTECTED', guardianAppMonitoring: request.guardianAppMonitoring ?? false,
  } })
  const effectiveUserId = request.userId ?? getAuthenticatedUserId() ?? undefined
  const payload = effectiveUserId !== undefined ? { ...request, userId: effectiveUserId } : request
  return apiClient.post<FocusSession>('/focus-sessions', payload)
}

export async function getFocusSessions(
  _userId?: number,
): Promise<FocusSession[]> {
  if (isLocalFocusMode()) return invokeTauriCommand('local_get_focus_sessions')
  return apiClient.get<FocusSession[]>('/focus-sessions')
}

export async function getGuardianObservations(sessionId: number): Promise<GuardianObservation[]> {
  if (!isLocalFocusMode()) return []
  return invokeTauriCommand('local_get_guardian_observations', { sessionId })
}

export async function getFocusSessionsByDate(date: string): Promise<FocusSession[]> {
  if (isLocalFocusMode()) return (await getFocusSessions()).filter((session) => localSessionDate(session) === date)
  return apiClient.get<FocusSession[]>('/focus-sessions/by-date', {
    params: { date },
    headers: timezoneHeader(),
  })
}

export async function getFocusSessionsAgenda(
  startDate: string,
  endDate: string,
): Promise<FocusSession[]> {
  if (isLocalFocusMode()) {
    const sessions = await getFocusSessions()
    return sessions.filter((session) => {
      const day = localSessionDate(session)
      return day >= startDate && day <= endDate
    })
  }
  return apiClient.get<FocusSession[]>('/focus-sessions/agenda', {
    params: { startDate, endDate },
    headers: timezoneHeader(),
  })
}

export async function getFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = (await getFocusSessions()).find((item) => item.id === id)
    if (!session) throw new Error('Focus session not found in this local vault')
    return session
  }
  return apiClient.get<FocusSession>(`/focus-sessions/${id}`)
}

export async function startFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_start_focus_session', { sessionId: id })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/start`)
}

export async function pauseFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_pause_focus_session', { sessionId: id })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/pause`)
}

export async function resumeFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_resume_focus_session', { sessionId: id })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/resume`)
}

export async function updateFocusSession(
  id: number,
  payload: UpdateFocusSessionPayload,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const current = await getFocusSession(id)
    const unlink = payload.unlinkTask === true
    return invokeTauriCommand('local_update_focus_session', {
      request: {
      sessionId: id, goalId: unlink ? null : payload.goalId ?? current.goalId,
      missionId: unlink ? null : payload.missionId ?? current.missionId,
      name: payload.name ?? current.name, intention: payload.intention ?? current.intention,
      durationMinutes: payload.durationMinutes ?? current.durationMinutes,
      scheduledAt: payload.scheduledAt ?? current.scheduledAt,
      },
    })
  }
  return apiClient.put<FocusSession>(`/focus-sessions/${id}`, payload)
}

export async function completeFocusSession(
  id: number,
  _userId?: number,
  payload?: CompleteFocusSessionPayload,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_complete_focus_session', {
      sessionId: id, quality: payload?.quality ?? null, reflectionNote: payload?.reflectionNote ?? null,
      accomplishment: payload?.accomplishment ?? null, markMissionCompleted: payload?.markMissionCompleted ?? false,
    })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/complete`, payload)
}

export async function cancelFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_cancel_focus_session', { sessionId: id })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/cancel`)
}

export async function skipFocusBreak(id: number): Promise<FocusSession> {
  if (isLocalFocusMode()) return returnToFocus(id)
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/skip-break`)
}

export async function returnToFocus(id: number): Promise<FocusSession> {
  if (isLocalFocusMode()) {
    const session = await invokeTauriCommand<FocusSession>('local_return_to_focus', { sessionId: id })
    await refreshLocalBrowserPolicy()
    return session
  }
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/return-to-focus`)
}

export async function deleteFocusSession(
  id: number,
  _userId?: number,
): Promise<void> {
  if (isLocalFocusMode()) return invokeTauriCommand('local_delete_focus_session', { sessionId: id })
  return apiClient.delete<void>(`/focus-sessions/${id}`)
}
