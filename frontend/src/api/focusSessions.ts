export type FocusSessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'

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
}

import { getAuthenticatedUserId } from './auth'
import { apiClient } from './client'

const timezoneHeader = () => ({
  'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
})

export async function createFocusSession(
  request: CreateFocusSessionRequest,
): Promise<FocusSession> {
  const effectiveUserId = request.userId ?? getAuthenticatedUserId() ?? undefined
  const payload = effectiveUserId !== undefined ? { ...request, userId: effectiveUserId } : request
  return apiClient.post<FocusSession>('/focus-sessions', payload)
}

export async function getFocusSessions(
  _userId?: number,
): Promise<FocusSession[]> {
  return apiClient.get<FocusSession[]>('/focus-sessions')
}

export async function getFocusSessionsByDate(date: string): Promise<FocusSession[]> {
  return apiClient.get<FocusSession[]>('/focus-sessions/by-date', {
    params: { date },
    headers: timezoneHeader(),
  })
}

export async function getFocusSessionsAgenda(
  startDate: string,
  endDate: string,
): Promise<FocusSession[]> {
  return apiClient.get<FocusSession[]>('/focus-sessions/agenda', {
    params: { startDate, endDate },
    headers: timezoneHeader(),
  })
}

export async function getFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  return apiClient.get<FocusSession>(`/focus-sessions/${id}`)
}

export async function startFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/start`)
}

export async function pauseFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/pause`)
}

export async function resumeFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/resume`)
}

export async function updateFocusSession(
  id: number,
  payload: UpdateFocusSessionPayload,
): Promise<FocusSession> {
  return apiClient.put<FocusSession>(`/focus-sessions/${id}`, payload)
}

export async function completeFocusSession(
  id: number,
  _userId?: number,
  payload?: CompleteFocusSessionPayload,
): Promise<FocusSession> {
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/complete`, payload)
}

export async function cancelFocusSession(
  id: number,
  _userId?: number,
): Promise<FocusSession> {
  return apiClient.post<FocusSession>(`/focus-sessions/${id}/cancel`)
}

export async function deleteFocusSession(
  id: number,
  _userId?: number,
): Promise<void> {
  return apiClient.delete<void>(`/focus-sessions/${id}`)
}