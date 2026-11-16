export type Goal = {
  id: number
  title: string
  description?: string | null
  startDate: string
  targetDate?: string | null
  status: string
  createdAt: string
}

export type CreateGoalPayload = {
  userId?: number
  title: string
  description?: string
  startDate: string
  targetDate?: string
}

export type UpdateGoalPayload = {
  title: string
  description?: string | null
  startDate: string
  targetDate?: string | null
  status?: string
}

export type Mission = {
  id: number
  goalId: number
  title: string
  description?: string | null
  scheduledDate: string
  estimatedMinutes?: number | null
  status: string
  createdAt: string
}

export type CreateMissionPayload = {
  goalId: number
  title: string
  description?: string
  scheduledDate: string
  estimatedMinutes?: number
}

export type UpdateMissionPayload = {
  goalId?: number
  title: string
  description?: string | null
  scheduledDate: string
  estimatedMinutes?: number | null
  status?: string
}

export type MissionCompletionResponse = {
  id: number
  missionId: number
  startedAt: string | null
  completedAt: string
  actualMinutes: number | null
  result: string
  earnedProgress: number
}

import { getAuthenticatedUserId, isLocalVaultSession } from './auth.ts'
import { apiClient } from './client.ts'
import { invokeTauriCommand, isTauriEnvironment } from './tauri.ts'

export async function getGoals(): Promise<Goal[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<Goal[]>('local_get_goals')
  return apiClient.get<Goal[]>('/goals')
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<Goal>('local_create_goal', { title: payload.title, description: payload.description, startDate: payload.startDate, targetDate: payload.targetDate })
  const effectiveUserId = payload.userId ?? getAuthenticatedUserId() ?? undefined
  const body = effectiveUserId !== undefined ? { ...payload, userId: effectiveUserId } : payload
  return apiClient.post<Goal>('/goals', body)
}

export async function getMissions(): Promise<Mission[]> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<Mission[]>('local_get_tasks')
  return apiClient.get<Mission[]>('/missions')
}

export async function createMission(payload: CreateMissionPayload): Promise<Mission> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<Mission>('local_create_task', { goalId: payload.goalId, title: payload.title, description: payload.description, scheduledDate: payload.scheduledDate, estimatedMinutes: payload.estimatedMinutes })
  return apiClient.post<Mission>('/missions', payload)
}

export async function completeMission(
  missionId: number,
  actualMinutes: number = 25,
): Promise<MissionCompletionResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<MissionCompletionResponse>('local_complete_task', { taskId: missionId, actualMinutes })
  return apiClient.post<MissionCompletionResponse>(`/missions/${missionId}/complete`, { actualMinutes })
}

export async function updateGoal(goalId: number, payload: UpdateGoalPayload): Promise<Goal> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<Goal>('local_update_goal', { goalId, title: payload.title, description: payload.description, startDate: payload.startDate, targetDate: payload.targetDate, status: payload.status })
  return apiClient.put<Goal>(`/goals/${goalId}`, payload)
}

export async function deleteGoal(goalId: number): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<void>('local_delete_goal', { goalId })
  return apiClient.delete<void>(`/goals/${goalId}`)
}

export async function deleteAllGoals(): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<void>('local_delete_all_goals')
  return apiClient.delete<void>('/goals/all')
}

export async function updateMission(missionId: number, payload: UpdateMissionPayload): Promise<Mission> {
  if (isTauriEnvironment() && isLocalVaultSession()) {
    const existing = (await getMissions()).find((item) => item.id === missionId)
    if (!existing) throw new Error(`Task ${missionId} was not found in the local vault`)
    return invokeTauriCommand<Mission>('local_update_task', { request: { taskId: missionId, goalId: payload.goalId ?? existing.goalId, title: payload.title, description: payload.description, scheduledDate: payload.scheduledDate, estimatedMinutes: payload.estimatedMinutes, status: payload.status } })
  }
  return apiClient.put<Mission>(`/missions/${missionId}`, payload)
}

export async function deleteMission(missionId: number): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<void>('local_delete_task', { taskId: missionId })
  return apiClient.delete<void>(`/missions/${missionId}`)
}

export async function deleteAllMissions(): Promise<void> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<void>('local_delete_all_tasks')
  return apiClient.delete<void>('/missions/all')
}

