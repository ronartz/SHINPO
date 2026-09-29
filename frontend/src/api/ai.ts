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

export type TutorialStep = {
  tutorialId: string
  stepId: number
  targetTab: string
  instruction: string
  completionCondition: string
}

export type BugReportInfo = {
  bugId: string
  summary: string
  feature: string
  status: string
  diagnostics: string
}

export type ConversationMessage = {
  id?: number
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  suggestionType?: string
  structuredCard?: any
  tutorial?: TutorialStep | null
  bugReport?: BugReportInfo | null
  createdAt?: string
}

export type Conversation = {
  conversationId: string
  title: string
  status: string
  messages: ConversationMessage[]
  updatedAt: string
}

export type AiChatResponse = {
  reply: string
  suggestionType: string
  structuredCard: any
  tutorial?: TutorialStep | null
  bugReport?: BugReportInfo | null
  conversationId?: string
}

import { authHeaders } from './auth'

const API_BASE = '/api/ai'

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `AI service error: ${res.status}`
    try {
      const body = await res.json()
      if (body.message) msg = body.message
    } catch {
      // ignore json parse error, fallback to status
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function getActiveConversation(): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversation/active`, {
    headers: authHeaders(),
  })
  return parseResponse<Conversation>(res)
}

export async function clearActiveConversation(): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/conversation/active`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return parseResponse<Conversation>(res)
}

export async function sendAiChat(
  userId: number,
  message: string,
  contextualGoalId?: number,
  contextualMissionId?: number,
  contextualSessionId?: number,
  conversationId?: string,
): Promise<AiChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      userId,
      message,
      contextualGoalId,
      contextualMissionId,
      contextualSessionId,
      conversationId,
    }),
  })
  return parseResponse<AiChatResponse>(res)
}


export async function decomposeGoal(
  goalId: number,
  _userId?: number,
): Promise<GoalDecomposition> {
  const res = await fetch(`${API_BASE}/decompose-goal/${goalId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseResponse<GoalDecomposition>(res)
}

export async function getNextAction(_userId?: number): Promise<NextAction> {
  const res = await fetch(`${API_BASE}/next-action`, {
    headers: authHeaders(),
  })
  return parseResponse<NextAction>(res)
}

export async function getDailyPlan(_userId?: number): Promise<DailyPlan> {
  const res = await fetch(`${API_BASE}/daily-plan`, {
    headers: authHeaders(),
  })
  return parseResponse<DailyPlan>(res)
}

export async function getSessionRecovery(
  sessionId: number,
  _userId?: number,
): Promise<SessionRecovery> {
  const res = await fetch(`${API_BASE}/recovery/${sessionId}`, {
    headers: authHeaders(),
  })
  return parseResponse<SessionRecovery>(res)
}