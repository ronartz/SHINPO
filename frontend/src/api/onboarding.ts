import { apiClient } from './client.ts'
import { isLocalVaultSession } from './auth.ts'
import { invokeTauriCommand, isTauriEnvironment } from './tauri.ts'

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'SKIPPED' | 'COMPLETED'

export type OnboardingResponse = {
  userId: number
  status: OnboardingStatus
  currentStep: number
  completedStepsCount: number
  verifiedSteps: string
  completedAt: string | null
  isCompleted: boolean
  canClaimReward: boolean
}

/**
 * Fetch authenticated user's current onboarding state from PostgreSQL ledger.
 */
export async function getOnboardingState(): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_get_onboarding_state')
  return apiClient.get<OnboardingResponse>('/onboarding')
}

/**
 * Begin or resume guided onboarding from a specific step.
 */
export async function startOnboarding(fromStep?: number): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_start_onboarding', { fromStep })
  return apiClient.post<OnboardingResponse>('/onboarding/start', { fromStep: fromStep ?? 0 })
}

/**
 * Record interactive progress for a specific walkthrough step.
 */
export async function recordOnboardingStep(
  stepIndex: number
): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_record_onboarding_step', { stepIndex })
  return apiClient.post<OnboardingResponse>('/onboarding/step', { stepIndex })
}

export async function finishOnboarding(): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_finish_onboarding')
  return apiClient.post<OnboardingResponse>('/onboarding/finish', {})
}

/**
 * Explicitly pause onboarding with current step index persisted.
 */
export async function pauseOnboarding(stepIndex: number): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_pause_onboarding', { stepIndex })
  return apiClient.post<OnboardingResponse>('/onboarding/pause', { stepIndex })
}

/**
 * Explicitly skip onboarding. Sets status to SKIPPED and guarantees 0 reward XP.
 */
export async function skipOnboarding(): Promise<OnboardingResponse> {
  if (isTauriEnvironment() && isLocalVaultSession()) return invokeTauriCommand<OnboardingResponse>('local_skip_onboarding')
  return apiClient.post<OnboardingResponse>('/onboarding/skip', {})
}

