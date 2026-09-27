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
  remainingSeconds: number
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
}

export type CreateFocusSessionRequest = {
  userId: number
  goalId?: number
  missionId?: number
  planId?: number
  name: string
  intention?: string
  durationMinutes: number
  scheduledAt?: string
}

const API_BASE = '/api/focus-sessions'

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed: ${response.status}`

    try {
      const errorBody = await response.json()

      if (errorBody.message) {
        message = errorBody.message
      }
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function createFocusSession(
  request: CreateFocusSessionRequest,
): Promise<FocusSession> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  return parseResponse<FocusSession>(response)
}

export async function getFocusSessions(
  userId: number,
): Promise<FocusSession[]> {
  const response = await fetch(`${API_BASE}?userId=${userId}`)

  return parseResponse<FocusSession[]>(response)
}

export async function getFocusSession(
  id: number,
  userId: number,
): Promise<FocusSession> {
  const response = await fetch(`${API_BASE}/${id}?userId=${userId}`)

  return parseResponse<FocusSession>(response)
}

export async function startFocusSession(
  id: number,
  userId: number,
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/start?userId=${userId}`,
    {
      method: 'POST',
    },
  )

  return parseResponse<FocusSession>(response)
}

export async function pauseFocusSession(
  id: number,
  userId: number,
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/pause?userId=${userId}`,
    {
      method: 'POST',
    },
  )

  return parseResponse<FocusSession>(response)
}

export async function resumeFocusSession(
  id: number,
  userId: number,
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/resume?userId=${userId}`,
    {
      method: 'POST',
    },
  )

  return parseResponse<FocusSession>(response)
}

export async function completeFocusSession(
  id: number,
  userId: number,
  payload?: CompleteFocusSessionPayload,
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/complete?userId=${userId}`,
    {
      method: 'POST',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    },
  )

  return parseResponse<FocusSession>(response)
}

export async function cancelFocusSession(
  id: number,
  userId: number,
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/cancel?userId=${userId}`,
    {
      method: 'POST',
    },
  )

  return parseResponse<FocusSession>(response)
}

export async function deleteFocusSession(
  id: number,
  userId?: number,
): Promise<void> {
  const url = userId != null ? `${API_BASE}/${id}?userId=${userId}` : `${API_BASE}/${id}`
  const response = await fetch(url, {
    method: 'DELETE',
  })
  if (!response.ok) {
    let msg = `Failed to delete session ${id}: ${response.status}`
    try {
      const body = await response.json()
      if (body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
}