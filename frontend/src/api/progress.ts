import { apiClient } from './client.ts'

export type ProgressEventDto = {
  id: number
  eventType: string
  amount: number
  createdAt: string | null
}

export type ProgressResponse = {
  userId: number
  totalProgress: number
  level: number
  levelTitle: string
  currentLevelXp: number
  nextLevelThreshold: number
  progressPercent: number
  recentEvents: ProgressEventDto[]
}

/**
 * Fetch the authenticated user's real-time progress and level status.
 */
export async function getCurrentUserProgress(): Promise<ProgressResponse> {
  return apiClient.get<ProgressResponse>('/progress')
}

/**
 * Claim the first-time onboarding certification reward (+50 XP). Idempotent on backend.
 */
export async function claimOnboardingReward(): Promise<ProgressResponse> {
  return apiClient.post<ProgressResponse>('/progress/onboarding', {})
}

/**
 * Helper to determine milestone reward title for toast/shimmer announcements.
 */
export function getRewardAnnouncement(eventType: string, amount: number): {
  headline: string
  detail: string
} {
  switch (eventType) {
    case 'FOCUS_SESSION_COMPLETED':
      return {
        headline: `+${amount} XP Earned • Focus Sprint Logged`,
        detail: 'Deep focus period successfully completed and persisted.',
      }
    case 'MISSION_COMPLETED':
      return {
        headline: `+${amount} XP Earned • Task Completed`,
        detail: 'Execution objective achieved.',
      }
    case 'GOAL_COMPLETED':
      return {
        headline: `+${amount} XP Earned • Goal Concluded`,
        detail: 'Major strategic milestone achieved.',
      }
    case 'STREAK_MILESTONE':
      return {
        headline: `+${amount} XP Earned • Consistency Milestone`,
        detail: 'Streak consistency threshold achieved.',
      }
    default:
      return {
        headline: `+${amount} Progress Points Earned`,
        detail: 'Execution progress recorded in ledger.',
      }
  }
}

