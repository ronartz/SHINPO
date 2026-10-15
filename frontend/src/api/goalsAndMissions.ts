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
  progressId: number
  earnedXp: number
  totalUserXp: number
}

import { getAuthenticatedUserId } from './auth'
import { apiClient } from './client'

export async function getGoals(): Promise<Goal[]> {
  return apiClient.get<Goal[]>('/goals')
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  const effectiveUserId = payload.userId ?? getAuthenticatedUserId() ?? undefined
  const body = effectiveUserId !== undefined ? { ...payload, userId: effectiveUserId } : payload
  return apiClient.post<Goal>('/goals', body)
}

export async function getMissions(): Promise<Mission[]> {
  return apiClient.get<Mission[]>('/missions')
}

export async function createMission(payload: CreateMissionPayload): Promise<Mission> {
  return apiClient.post<Mission>('/missions', payload)
}

export async function completeMission(
  missionId: number,
  actualMinutes: number = 25,
): Promise<MissionCompletionResponse> {
  return apiClient.post<MissionCompletionResponse>(`/missions/${missionId}/complete`, { actualMinutes })
}

export async function updateGoal(goalId: number, payload: UpdateGoalPayload): Promise<Goal> {
  return apiClient.put<Goal>(`/goals/${goalId}`, payload)
}

export async function deleteGoal(goalId: number): Promise<void> {
  return apiClient.delete<void>(`/goals/${goalId}`)
}

export async function deleteAllGoals(): Promise<void> {
  return apiClient.delete<void>('/goals/all')
}

export async function updateMission(missionId: number, payload: UpdateMissionPayload): Promise<Mission> {
  return apiClient.put<Mission>(`/missions/${missionId}`, payload)
}

export async function deleteMission(missionId: number): Promise<void> {
  return apiClient.delete<void>(`/missions/${missionId}`)
}

export async function deleteAllMissions(): Promise<void> {
  return apiClient.delete<void>('/missions/all')
}

