export type FocusSessionStatus =
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'

export type FocusSession = {
  id: number
  userId: number
  goalId: number | null
  missionId: number | null
  name: string
  intention: string | null
  durationMinutes: number
  status: FocusSessionStatus
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CreateFocusSessionRequest = {
  userId: number
  goalId?: number
  missionId?: number
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
): Promise<FocusSession> {
  const response = await fetch(
    `${API_BASE}/${id}/complete?userId=${userId}`,
    {
      method: 'POST',
    },
  )

  return parseResponse<FocusSession>(response)
}