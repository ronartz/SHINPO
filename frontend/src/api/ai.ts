export type ProposedMission = {
  title: string
  description: string
  estimatedMinutes: number
}

export type GoalDecomposition = {
  goalId: number
  goalTitle: string
  analysis: string
  proposedMissions: ProposedMission[]
}

export type NextAction = {
  goalId: number | null
  goalTitle: string
  missionId: number | null
  missionTitle: string
  recommendedAction: string
  estimatedMinutes: number
  rationale: string
}

export type DailyPlanItem = {
  missionId: number
  missionTitle: string
  goalTitle: string
  durationMinutes: number
  priority: string
}

export type DailyPlan = {
  headline: string
  rationale: string
  planItems: DailyPlanItem[]
}

export type RecoveryOption = {
  code: string
  label: string
  suggestedAction: string
}

export type SessionRecovery = {
  sessionId: number
  sessionName: string
  plannedMinutes: number
  actualMinutes: number
  diagnosticMessage: string
  recoveryOptions: RecoveryOption[]
}

export type AiChatResponse = {
  reply: string
  suggestionType: string
  structuredCard: any
}

const API_BASE = '/api/ai'

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `AI service error: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function sendAiChat(
  userId: number,
  message: string,
  contextualGoalId?: number,
  contextualMissionId?: number,
  contextualSessionId?: number,
): Promise<AiChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      message,
      contextualGoalId,
      contextualMissionId,
      contextualSessionId,
    }),
  })
  return parseResponse<AiChatResponse>(res)
}

export async function decomposeGoal(
  goalId: number,
  userId: number,
): Promise<GoalDecomposition> {
  const res = await fetch(`${API_BASE}/decompose-goal/${goalId}?userId=${userId}`, {
    method: 'POST',
  })
  return parseResponse<GoalDecomposition>(res)
}

export async function getNextAction(userId: number): Promise<NextAction> {
  const res = await fetch(`${API_BASE}/next-action?userId=${userId}`)
  return parseResponse<NextAction>(res)
}

export async function getDailyPlan(userId: number): Promise<DailyPlan> {
  const res = await fetch(`${API_BASE}/daily-plan?userId=${userId}`)
  return parseResponse<DailyPlan>(res)
}

export async function getSessionRecovery(
  sessionId: number,
  userId: number,
): Promise<SessionRecovery> {
  const res = await fetch(`${API_BASE}/recovery/${sessionId}?userId=${userId}`)
  return parseResponse<SessionRecovery>(res)
}