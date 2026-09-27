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

export type MissionCompletionResponse = {
  progressId: number
  earnedXp: number
  totalUserXp: number
}

const API_BASE = '/api'

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function getGoals(): Promise<Goal[]> {
  const res = await fetch(`${API_BASE}/goals`)
  return parseResponse<Goal[]>(res)
}

export async function createGoal(payload: CreateGoalPayload): Promise<Goal> {
  const res = await fetch(`${API_BASE}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<Goal>(res)
}

export async function getMissions(): Promise<Mission[]> {
  const res = await fetch(`${API_BASE}/missions`)
  return parseResponse<Mission[]>(res)
}

export async function createMission(payload: CreateMissionPayload): Promise<Mission> {
  const res = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actualMinutes }),
  })
  return parseResponse<MissionCompletionResponse>(res)
}

export async function deleteGoal(goalId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/goals/${goalId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    let msg = `Failed to delete goal: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
}

export async function deleteMission(missionId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/missions/${missionId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    let msg = `Failed to delete mission: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
}
