/**
 * SHINPO Progression & Rewards Engine
 * Universal reward coordination, daily objectives, achievements, and microinteractions.
 * Server-authoritative: Visual celebration only triggers after backend confirmation.
 */

import type { Mission, Goal } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { ProgressResponse } from '../api/progress'
import type { AnalyticsDashboardResponse } from '../api/analytics'
import type { AppView } from '../types/navigation'

export interface DailyObjective {
  id: string
  title: string
  target: number
  current: number
  unit: string
  isCompleted: boolean
  description: string
}

export interface DailyObjectivesSummary {
  objectives: DailyObjective[]
  completedCount: number
  totalCount: number
  isAllCompleted: boolean
  todayDateStr: string
}

export interface AchievementItem {
  id: string
  title: string
  category: 'focus' | 'tasks' | 'goals' | 'consistency' | 'mastery'
  description: string
  icon: string
  unlocked: boolean
  progressLabel: string
  progress: number | null
  target: number
  unit: string
  evidence: 'persisted' | 'current' | 'unavailable'
  nextActionTab?: AppView
}

export interface CelebrationPayload {
  id: string
  type: 'TASK' | 'FOCUS_SESSION' | 'GOAL' | 'LEVEL_UP' | 'ONBOARDING'
  headline: string
  detail: string
  xpEarned: number
  oldLevel?: number
  newLevel?: number
  levelTitle?: string
  streakDays?: number
  nextActionPrompt?: string
  nextActionTab?: string
}

/**
 * Format local date as YYYY-MM-DD to respect user's active timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Compute the 3 daily consistency objectives based on actual backend data today.
 */
function completedActiveSeconds(session: FocusSession): number {
  if (session.status !== 'COMPLETED') return 0
  const seconds = session.pomodoroEnabled
    ? session.focusActiveSeconds ?? session.activeSeconds
    : session.activeSeconds
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0
}

function completedOnLocalDate(session: FocusSession, date: string): boolean {
  if (!session.endedAt) return false
  const completedAt = new Date(session.endedAt)
  return !Number.isNaN(completedAt.getTime()) && getLocalDateString(completedAt) === date
}

export function computeDailyObjectives(
  sessions: FocusSession[],
  todayStr: string = getLocalDateString(),
): DailyObjectivesSummary {
  const completedToday = sessions.filter((session) => completedOnLocalDate(session, todayStr))
  const completedSprintsToday = completedToday.filter((session) => completedActiveSeconds(session) >= 15 * 60).length
  const activeFocusMinutesToday = Math.floor(completedToday.reduce((total, session) => total + completedActiveSeconds(session), 0) / 60)

  const objectives: DailyObjective[] = [
    {
      id: 'daily_focus_sprint',
      title: 'Complete 1 Focus Sprint',
      target: 1,
      current: Math.min(1, completedSprintsToday),
      unit: 'sprint',
      isCompleted: completedSprintsToday >= 1,
      description: 'Log at least 15 verified active focus minutes.',
    },
    {
      id: 'daily_focus_duration',
      title: '25m Deep Work',
      target: 25,
      current: Math.min(25, activeFocusMinutesToday),
      unit: 'min',
      isCompleted: activeFocusMinutesToday >= 25,
      description: 'Accumulate 25 minutes of verified deep flow.',
    },
  ]

  const completedCount = objectives.filter((o) => o.isCompleted).length

  return {
    objectives,
    completedCount,
    totalCount: objectives.length,
    isAllCompleted: completedCount === objectives.length,
    todayDateStr: todayStr,
  }
}

/**
 * Derive user achievements list truthfully from server-verified progress & stats.
 */
export function deriveAchievements(
  userProgress: ProgressResponse | null,
  analytics: AnalyticsDashboardResponse | null,
  missions: Mission[],
  goals: Goal[],
  sessions: FocusSession[],
  isOnboardingVerified: boolean = false,
): AchievementItem[] {
  const totalXp = userProgress?.totalProgress || 0
  const level = userProgress?.level || 1
  const completedMissions = missions.filter((m) => m.status === 'COMPLETED').length
  const completedGoals = goals.filter((g) => g.status === 'COMPLETED').length
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED')
  const totalFocusSeconds = completedSessions.reduce((total, session) => total + completedActiveSeconds(session), 0)
  const longestSprintSeconds = Math.max(0, ...completedSessions.map(completedActiveSeconds))
  const totalFocusMinutes = Math.floor(totalFocusSeconds / 60)
  const currentStreak = analytics?.summary?.currentStreak || 0
  const onboardingEventRecorded = (userProgress?.recentEvents || []).some((e) => e.eventType === 'ONBOARDING_COMPLETED')

  return [
    {
      id: 'first_task',
      title: 'First Step',
      category: 'tasks',
      description: 'Complete your first execution task.',
      icon: 'check',
      unlocked: completedMissions >= 1,
      progressLabel: completedMissions >= 1 ? 'Unlocked' : `${completedMissions}/1 tasks`,
      progress: Math.min(1, completedMissions), target: 1, unit: 'task', evidence: 'current',
    },
    {
      id: 'first_sprint',
      title: 'Focus Session Complete',
      category: 'focus',
      description: 'Complete a verified focus session of 15 or more minutes.',
      icon: 'focus',
      unlocked: longestSprintSeconds >= 15 * 60,
      progressLabel: longestSprintSeconds >= 15 * 60 ? 'Unlocked' : `${Math.floor(longestSprintSeconds / 60)}/15 min`,
      progress: Math.min(15, Math.floor(longestSprintSeconds / 60)), target: 15, unit: 'min', evidence: 'persisted', nextActionTab: 'Focus Engine',
    },
    {
      id: 'deep_flow_hour',
      title: 'Focused Hour',
      category: 'focus',
      description: 'Log 60+ minutes of verified deep focus time.',
      icon: 'clock',
      unlocked: totalFocusSeconds >= 60 * 60,
      progressLabel: totalFocusMinutes >= 60 ? 'Unlocked' : `${totalFocusMinutes}/60m`,
      progress: Math.min(60, totalFocusMinutes), target: 60, unit: 'min', evidence: 'persisted', nextActionTab: 'Focus Engine',
    },
    {
      id: 'level_2_practitioner',
      title: 'Disciplined Mind',
      category: 'mastery',
      description: 'Reach Level 2 by earning 100 XP.',
      icon: 'sparkle',
      unlocked: level >= 2 || totalXp >= 100,
      progressLabel: totalXp >= 100 ? 'Unlocked' : `${totalXp}/100 XP`,
      progress: Math.min(100, totalXp), target: 100, unit: 'XP', evidence: 'persisted', nextActionTab: 'Focus Engine',
    },
    {
      id: 'goal_concluded',
      title: 'Goal Complete',
      category: 'goals',
      description: 'Complete all tasks linked to a goal.',
      icon: 'target',
      unlocked: completedGoals >= 1,
      progressLabel: completedGoals >= 1 ? 'Unlocked' : `${completedGoals}/1 goal`,
      progress: Math.min(1, completedGoals), target: 1, unit: 'goal', evidence: 'current', nextActionTab: 'Goals & Missions',
    },
    {
      id: 'momentum_streak',
      title: 'Consistent Practice',
      category: 'consistency',
      description: 'Record Focus work on 3 consecutive days.',
      icon: 'sparkle',
      unlocked: currentStreak >= 3,
      progressLabel: currentStreak >= 3 ? 'Unlocked' : `${currentStreak}/3 days`,
      progress: Math.min(3, currentStreak), target: 3, unit: 'days', evidence: 'persisted', nextActionTab: 'Focus Engine',
    },
    {
      id: 'onboarding_certified',
      title: 'Onboarding Complete',
      category: 'mastery',
      description: 'Complete a verified goal-to-focus workflow.',
      icon: 'check',
      unlocked: isOnboardingVerified || onboardingEventRecorded,
      progressLabel: isOnboardingVerified || onboardingEventRecorded ? 'Unlocked' : 'Awaiting verified workflow',
      progress: isOnboardingVerified || onboardingEventRecorded ? 1 : null, target: 1, unit: 'workflow', evidence: onboardingEventRecorded ? 'persisted' : isOnboardingVerified ? 'current' : 'unavailable', nextActionTab: 'AI Assistant',
    },
    {
      id: 'level_4_architect',
      title: 'Consistent Progress',
      category: 'mastery',
      description: 'Reach Level 4 by earning 500 XP.',
      icon: 'sparkle',
      unlocked: level >= 4 || totalXp >= 500,
      progressLabel: totalXp >= 500 ? 'Unlocked' : `${totalXp}/500 XP`,
      progress: Math.min(500, totalXp), target: 500, unit: 'XP', evidence: 'persisted', nextActionTab: 'Focus Engine',
    },
  ]
}

export function findNewProgressEvents(previous: ProgressResponse | null, current: ProgressResponse | null) {
  if (!previous || !current || !Array.isArray(previous.recentEvents) || !Array.isArray(current.recentEvents)) return []
  const seen = new Set((previous.recentEvents || []).map((event) => event.id))
  return (current.recentEvents || []).filter((event) => !seen.has(event.id))
}

/**
 * Spawns elegant celebration particle sparkles in a non-intrusive viewport container.
 * Automatically respects `prefers-reduced-motion` and `shinpo_celebration_effects === 'minimal'`.
 */
export function spawnCelebrationSparkles(sourceRect?: DOMRect | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // Check reduced-motion media query
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  // Check user settings preference
  if (typeof localStorage !== 'undefined') {
    const effectPref = localStorage.getItem('shinpo_celebration_effects')
    if (effectPref === 'minimal') return
  }

  const container = document.createElement('div')
  container.className = 'shinpo-sparkles-container'
  container.setAttribute('aria-hidden', 'true')
  container.style.position = 'fixed'
  container.style.pointerEvents = 'none'
  container.style.zIndex = '9999'
  container.style.inset = '0'

  const originX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2
  const originY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight / 2

  const colors = ['#2788F5', '#66B8FF', '#18395F', '#112541', '#2788F5', '#66B8FF']
  const particleCount = sourceRect ? 18 : 28

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div')
    particle.className = 'shinpo-sparkle-dot'
    const color = colors[i % colors.length]
    const size = Math.floor(Math.random() * 6) + 4
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() * 0.2 - 0.1)
    const distance = Math.floor(Math.random() * 70) + 40
    const destX = Math.cos(angle) * distance
    const destY = Math.sin(angle) * distance

    particle.style.position = 'absolute'
    particle.style.left = `${originX}px`
    particle.style.top = `${originY}px`
    particle.style.width = `${size}px`
    particle.style.height = `${size}px`
    particle.style.borderRadius = '50%'
    particle.style.backgroundColor = color
    particle.style.boxShadow = `0 0 8px ${color}`
    particle.style.opacity = '1'
    particle.style.transition = 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.85s ease-out'
    particle.style.transform = 'translate(-50%, -50%) scale(0.5)'

    container.appendChild(particle)

    // Trigger animation next frame
    requestAnimationFrame(() => {
      particle.style.transform = `translate(calc(-50% + ${destX}px), calc(-50% + ${destY}px)) scale(1)`
      particle.style.opacity = '0'
    })
  }

  document.body.appendChild(container)

  setTimeout(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }, 950)
}
