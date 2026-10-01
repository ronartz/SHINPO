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
  suggestionId?: number
}

export type SuggestionCommitRequest = {
  targetGoalId?: number
  selectedMissions?: ProposedMission[]
}

export type SuggestionCommitResponse = {
  suggestionId: number
  goalId: number
  committedMissionsCount: number
  committedMissions: Array<{
    id: number
    goalId: number
    title: string
    description?: string
    scheduledDate?: string
    estimatedMinutes?: number
    status?: string
  }>
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
  goalTitle?: string
  durationMinutes: number
  priority?: string
  scheduledStartTime?: string
  scheduledEndTime?: string
  energyWindow?: 'DEEP_FOCUS' | 'TACTICAL_SPRINT' | 'COGNITIVE_RECOVERY' | 'STRATEGIC_REVIEW' | string
  originalEstimatedMinutes?: number
  biasCorrectionFactor?: number
  isRestorativeBreak?: boolean
  goalId?: number | null
}

export type DailyPlan = {
  headline: string
  rationale: string
  planItems: DailyPlanItem[]
  totalPlannedMinutes?: number
  totalFocusMinutes?: number
  totalBreakMinutes?: number
  circadianPacingStrategy?: string
  userEstimationBiasPct?: number
  hasConflictsResolved?: boolean
  suggestionId?: number | null
}

export type CommitDailyPlanRequest = {
  suggestionId?: number
  selectedItems?: DailyPlanItem[]
}

export type CommitDailyPlanResponse = {
  scheduledSessionsCount: number
  totalScheduledMinutes: number
  createdSessionIds: number[]
  statusMessage: string
}

export type NextActionCard = {
  missionTitle: string
  recommendedAction?: string | null
  rationale?: string | null
  estimatedMinutes?: number | null
}

export type SessionDebriefAnalysis = {
  sessionId?: number | null
  sessionName: string
  accomplishment?: string
  reflectionNote?: string
  completionQuality?: string
  plannedMinutes: number
  actualMinutes: number
  estimationAccuracyPct: number
  velocityAssessment: string
  tacticalCritique: string
  nextSprintRecommendation: string
  suggestedNextSteps: RecoveryOption[]
}

export type StructuredCard =
  | ProposedMission[]
  | { proposedMissions: ProposedMission[] }
  | { planItems: DailyPlanItem[] }
  | DailyPlan
  | NextActionCard
  | SessionDebriefAnalysis
  | SessionRecovery

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
  structuredCard?: StructuredCard | null
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
  structuredCard: StructuredCard | null
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
    const error = new Error(msg) as Error & { status: number }
    error.status = res.status
    throw error
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
  sessionId?: number,
  _userId?: number,
): Promise<SessionRecovery> {
  const url = sessionId ? `${API_BASE}/recovery/${sessionId}` : `${API_BASE}/recovery/latest`
  const res = await fetch(url, {
    headers: authHeaders(),
  })
  return parseResponse<SessionRecovery>(res)
}

export async function analyzeSessionDebrief(
  sessionId?: number,
): Promise<SessionDebriefAnalysis> {
  const url = sessionId ? `${API_BASE}/debrief-analysis/${sessionId}` : `${API_BASE}/debrief-analysis/latest`
  const res = await fetch(url, {
    headers: authHeaders(),
  })
  return parseResponse<SessionDebriefAnalysis>(res)
}

export async function commitSuggestion(
  suggestionId: number,
  request?: SuggestionCommitRequest,
): Promise<SuggestionCommitResponse> {
  const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/commit`, {
    method: 'POST',
    headers: authHeaders(),
    body: request ? JSON.stringify(request) : undefined,
  })
  return parseResponse<SuggestionCommitResponse>(res)
}

export type UserExecutionProfile = {
  userId: number
  hasSufficientData: boolean
  completedSessionsCount: number
  totalMissionsCompleted: number
  totalFocusMinutes: number
  averageFocusMinutes: number | null
  estimationBiasPercentage: number | null
  estimationAccuracyCategory: string
  confidenceLevel: string
  completionVelocityPerDay: number | null
  statusMessage: string
}

export async function getUserExecutionProfile(): Promise<UserExecutionProfile> {
  const res = await fetch(`${API_BASE}/profile`, {
    headers: authHeaders(),
  })
  return parseResponse<UserExecutionProfile>(res)
}

export async function commitDailyPlan(
  request?: CommitDailyPlanRequest,
): Promise<CommitDailyPlanResponse> {
  const res = await fetch(`${API_BASE}/daily-plan/commit`, {
    method: 'POST',
    headers: authHeaders(),
    body: request ? JSON.stringify(request) : undefined,
  })
  return parseResponse<CommitDailyPlanResponse>(res)
}

export type ExecutiveBriefing = {
  executiveHeadline: string
  tacticalSummary: string
  primaryRecommendation: string
  activeGoalsCount: number
  pendingMissionsCount: number
  completedMissionsCount: number
  focusMinutesToday: number
  goalProgressAveragePct: number
  sentinelThreatPosture: 'SECURE' | 'CONTAINED' | 'ELEVATED' | string
  quarantinedDistractionsToday: number
  keyActionItems: string[]
  generatedAt: string
}

export async function getExecutiveBriefing(): Promise<ExecutiveBriefing> {
  const res = await fetch(`${API_BASE}/ai/briefing`, {
    headers: authHeaders(),
  })
  return parseResponse<ExecutiveBriefing>(res)
}