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
  userId: number
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

import { authHeaders } from './auth'
import { getBackendBaseUrl } from './config'

const API_BASE = `${getBackendBaseUrl()}/api`

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {
      // ignore JSON parse error, fallback to status
    }
    const error = new Error(msg) as Error & { status: number }
    error.status = res.status
    throw error
  }
  return res.json() as Promise<T>
}

export async function getGoals(): Promise<Goal[]> {
  const res = await fetch(`${API_BASE}/goals`, {
    headers: authHeaders(),
  })
  return parseResponse<Goal[]>(res)
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  const res = await fetch(`${API_BASE}/goals`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  return parseResponse<Goal>(res)
}

export async function getMissions(): Promise<Mission[]> {
  const res = await fetch(`${API_BASE}/missions`, {
    headers: authHeaders(),
  })
  return parseResponse<Mission[]>(res)
}

export async function createMission(payload: CreateMissionPayload): Promise<Mission> {
  const res = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  return parseResponse<Mission>(res)
}

export async function completeMission(
  missionId: number,
  actualMinutes: number = 25,
): Promise<MissionCompletionResponse> {
  const res = await fetch(`${API_BASE}/missions/${missionId}/complete`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ actualMinutes }),
  })
  return parseResponse<MissionCompletionResponse>(res)
}

export async function updateGoal(goalId: number, payload: UpdateGoalPayload): Promise<Goal> {
  const res = await fetch(`${API_BASE}/goals/${goalId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  return parseResponse<Goal>(res)
}

export async function deleteGoal(goalId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/goals/${goalId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    let msg = `Failed to delete goal: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {
      // ignore JSON parse error, fallback to status
    }
    const error = new Error(msg) as Error & { status: number }
    error.status = res.status
    throw error
  }
}

export async function updateMission(missionId: number, payload: UpdateMissionPayload): Promise<Mission> {
  const res = await fetch(`${API_BASE}/missions/${missionId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  return parseResponse<Mission>(res)
}

export async function deleteMission(missionId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/missions/${missionId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    let msg = `Failed to delete mission: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {
      // ignore JSON parse error, fallback to status
    }
    const error = new Error(msg) as Error & { status: number }
    error.status = res.status
    throw error
  }
}
