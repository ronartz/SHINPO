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
  confirmationToken?: string
}

export type SuggestionCommitRequest = {
  confirmationToken?: string
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
    description?: string | null
    scheduledDate?: string
    estimatedMinutes?: number | null
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
  confirmationToken?: string
}

export type CommitDailyPlanRequest = {
  confirmationToken?: string
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
  | BugReportDraft

export type BugReportDraft = {
  feature: string
  summary?: string
  diagnosticsJson?: string
  diagnosticSummary?: {
    os?: string
    jvm?: string
    memory?: string
    session?: string
  }
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

export type AiProviderStatus = {
  enabled: boolean
  available: boolean
  provider: string
  model: string
  status: string
  message: string
}

import { authHeaders, getAuthenticatedUserId, isLocalVaultSession } from './auth.ts'
import { fetchWithoutRedirects, getBackendBaseUrl } from './config.ts'
import { invokeTauriCommand } from './tauri.ts'

const API_BASE = `${getBackendBaseUrl()}/api/ai`

function usesNativeAi(): boolean {
  return isLocalVaultSession() || (typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('shinpo_local_vault_account')))
}

function requireBackendAi(): void {
  if (usesNativeAi()) {
    throw new Error('This EONPAI operation is not available in local mode yet.')
  }
}

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
  if (usesNativeAi()) return invokeTauriCommand<Conversation>('local_eonpai_get_active')
  const res = await fetchWithoutRedirects(`${API_BASE}/conversation/active`, {
    headers: {
      ...authHeaders(),
      'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })
  return parseResponse<Conversation>(res)
}

export async function clearActiveConversation(): Promise<Conversation> {
  if (usesNativeAi()) return invokeTauriCommand<Conversation>('local_eonpai_clear_active')
  const res = await fetchWithoutRedirects(`${API_BASE}/conversation/active`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return parseResponse<Conversation>(res)
}

export async function sendAiChat(
  userId?: number,
  message: string = '',
  contextualGoalId?: number,
  contextualMissionId?: number,
  contextualSessionId?: number,
  conversationId?: string,
): Promise<AiChatResponse> {
  const effectiveUserId = userId ?? getAuthenticatedUserId() ?? 0
  if (usesNativeAi()) {
    return invokeTauriCommand<AiChatResponse>('local_eonpai_send', { request: { message, conversationId, contextualGoalId, contextualMissionId, contextualSessionId } })
  }
  const res = await fetchWithoutRedirects(`${API_BASE}/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      userId: effectiveUserId,
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
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'decompose', recordId: goalId })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/decompose-goal/${goalId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseResponse<GoalDecomposition>(res)
}

export async function getNextAction(_userId?: number): Promise<NextAction> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'next-action', recordId: undefined })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/next-action`, {
    headers: authHeaders(),
  })
  return parseResponse<NextAction>(res)
}

export async function getDailyPlan(_userId?: number): Promise<DailyPlan> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'daily-plan', recordId: undefined })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/daily-plan`, {
    headers: authHeaders(),
  })
  return parseResponse<DailyPlan>(res)
}

export async function getSessionRecovery(
  sessionId?: number,
  _userId?: number,
): Promise<SessionRecovery> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'recovery', recordId: sessionId })
  requireBackendAi()
  const url = sessionId ? `${API_BASE}/recovery/${sessionId}` : `${API_BASE}/recovery/latest`
  const res = await fetchWithoutRedirects(url, {
    headers: authHeaders(),
  })
  return parseResponse<SessionRecovery>(res)
}

export async function analyzeSessionDebrief(
  sessionId?: number,
): Promise<SessionDebriefAnalysis> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'debrief', recordId: sessionId })
  requireBackendAi()
  const url = sessionId ? `${API_BASE}/debrief-analysis/${sessionId}` : `${API_BASE}/debrief-analysis/latest`
  const res = await fetchWithoutRedirects(url, {
    headers: authHeaders(),
  })
  return parseResponse<SessionDebriefAnalysis>(res)
}

export async function commitSuggestion(
  suggestionId: number,
  request?: SuggestionCommitRequest,
): Promise<SuggestionCommitResponse> {
  if (usesNativeAi()) {
    if (!request?.confirmationToken) throw new Error('Review the native task proposal again before confirming.')
    if (request.selectedMissions) throw new Error('Confirm the complete native proposal; partial task selection is not supported.')
    const response = await invokeTauriCommand<AiActionExecutionResponse & { result: { taskIds: number[] } }>('local_eonpai_commit_plan', { suggestionId, confirmationToken: request.confirmationToken, targetGoalId: request.targetGoalId })
    const { getMissions } = await import('./goalsAndMissions.ts')
    const committedMissions = (await getMissions()).filter((task) => response.result.taskIds.includes(task.id))
    return { suggestionId, goalId: committedMissions[0]?.goalId ?? 0, committedMissionsCount: committedMissions.length, committedMissions }
  }
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/suggestions/${suggestionId}/commit`, {
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
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'profile', recordId: undefined })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/profile`, {
    headers: authHeaders(),
  })
  return parseResponse<UserExecutionProfile>(res)
}

export async function commitDailyPlan(
  request?: CommitDailyPlanRequest,
): Promise<CommitDailyPlanResponse> {
  if (usesNativeAi()) {
    if (!request?.suggestionId || !request.confirmationToken) throw new Error('Review the native schedule proposal again before confirming.')
    const response = await invokeTauriCommand<AiActionExecutionResponse & { result: { sessionIds: number[]; totalScheduledMinutes: number } }>('local_eonpai_commit_plan', { suggestionId: request.suggestionId, confirmationToken: request.confirmationToken })
    return { scheduledSessionsCount: response.result.sessionIds.length, totalScheduledMinutes: response.result.totalScheduledMinutes, createdSessionIds: response.result.sessionIds, statusMessage: response.resultSummary }
  }
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/daily-plan/commit`, {
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
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_read', { operation: 'briefing', recordId: undefined })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/briefing`, {
    headers: authHeaders(),
  })
  return parseResponse<ExecutiveBriefing>(res)
}

export type AiActionStatus = 'PROPOSED' | 'APPROVED' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'EXPIRED'

export type AiActionDto = {
  actionId: string
  confirmationToken?: string
  actionType: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  status: AiActionStatus
  description: string
  payloadJson: string
  expiresAt: string
  createdAt: string
}

export type AiActionExecutionResponse = {
  actionId: string
  status: string
  resultSummary: string
  errorMessage?: string
  executedAt: string
  partialCompletedItems?: string[]
  partialFailedItems?: string[]
}

export async function proposeAiAction(
  actionType: string,
  description: string,
  payload: Record<string, unknown>
): Promise<AiActionDto> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_propose', { request: { actionType, description, payload } })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/actions/propose`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ actionType, description, payload }),
  })
  return parseResponse<AiActionDto>(res)
}

export async function confirmAiAction(actionId: string, confirmationToken?: string): Promise<AiActionExecutionResponse> {
  if (usesNativeAi()) {
    if (!confirmationToken) throw new Error('Review the native action preview before confirming.')
    return invokeTauriCommand('local_eonpai_confirm', { actionId, confirmationToken })
  }
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/actions/${actionId}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseResponse<AiActionExecutionResponse>(res)
}

export async function rejectAiAction(actionId: string): Promise<AiActionDto> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_reject', { actionId })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/actions/${actionId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return parseResponse<AiActionDto>(res)
}

export async function getPendingAiActions(): Promise<AiActionDto[]> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_actions', { recent: false })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/actions/pending`, {
    headers: authHeaders(),
  })
  return parseResponse<AiActionDto[]>(res)
}

export async function getRecentAiActions(): Promise<AiActionDto[]> {
  if (usesNativeAi()) return invokeTauriCommand('local_eonpai_actions', { recent: true })
  requireBackendAi()
  const res = await fetchWithoutRedirects(`${API_BASE}/actions/recent`, {
    headers: authHeaders(),
  })
  return parseResponse<AiActionDto[]>(res)
}

export async function getAiProviderStatus(): Promise<AiProviderStatus> {
  if (usesNativeAi()) return invokeTauriCommand<AiProviderStatus>('local_eonpai_provider_status')
  const res = await fetchWithoutRedirects(`${API_BASE}/status`, {
    headers: authHeaders(),
  })
  return parseResponse<AiProviderStatus>(res)
}

export async function listLocalConversations(): Promise<Omit<Conversation, 'messages'>[]> {
  if (!usesNativeAi()) return []
  return invokeTauriCommand('local_eonpai_list')
}
export async function openLocalConversation(conversationId: string): Promise<Conversation> {
  if (!usesNativeAi()) throw new Error('Local conversation history requires a local vault.')
  return invokeTauriCommand('local_eonpai_open', { conversationId })
}
export async function deleteLocalConversation(conversationId: string): Promise<void> {
  if (!usesNativeAi()) throw new Error('Local conversation history requires a local vault.')
  return invokeTauriCommand('local_eonpai_delete', { conversationId })
}

export type NativeAiProviderConfig = { provider: 'none' | 'ollama' | 'openai'; model: string; endpoint: string; allowCloudContext: boolean; hasApiKey?: boolean }
export async function getNativeAiProviderConfig(): Promise<NativeAiProviderConfig> {
  return invokeTauriCommand('local_eonpai_provider_config')
}
export async function configureNativeAiProvider(config: NativeAiProviderConfig, apiKey?: string): Promise<void> {
  const { provider, model, endpoint, allowCloudContext } = config
  return invokeTauriCommand('local_eonpai_configure_provider', { config: { provider, model, endpoint, allowCloudContext }, apiKey })
}
export async function cancelNativeAiRequest(): Promise<void> {
  return invokeTauriCommand('local_eonpai_cancel', {})
}
