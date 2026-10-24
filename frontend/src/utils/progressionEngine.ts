/**
 * SHINPO Progression & Rewards Engine
 * Universal reward coordination, daily objectives, achievements, and microinteractions.
 * Server-authoritative: Visual celebration only triggers after backend confirmation.
 */

import type { Mission, Goal } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { ProgressResponse } from '../api/progress'
import type { AnalyticsDashboardResponse } from '../api/analytics'

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
export function computeDailyObjectives(
  missions: Mission[],
  sessions: FocusSession[],
  todayStr: string = getLocalDateString(),
): DailyObjectivesSummary {
  // 1. Task Objective: Complete 1 planned task today
  // A mission is completed today if status is COMPLETED
  const completedMissionsToday = missions.filter((m) => {
    if (m.status !== 'COMPLETED') return false
    // If mission has an updated or created timestamp from today, or completed status
    return true
  }).length

  // 2. Focus Sprint Objective: Complete 1 verified focus sprint (>= 15 active min)
  const completedSprintsToday = sessions.filter((s) => {
    if (s.status !== 'COMPLETED') return false
    const sessionDate = s.startedAt ? s.startedAt.slice(0, 10) : ''
    if (sessionDate && sessionDate !== todayStr) return false
    const activeMins = Math.floor((s.activeSeconds || 0) / 60)
    return activeMins >= 15
  }).length

  // 3. Focus Duration Target: Reach 25 verified active minutes today
  const activeFocusMinutesToday = sessions
    .filter((s) => {
      if (s.status !== 'COMPLETED') return false
      const sessionDate = s.startedAt ? s.startedAt.slice(0, 10) : ''
      return !sessionDate || sessionDate === todayStr
    })
    .reduce((sum, s) => {
      const activeMins = Math.floor((s.activeSeconds || 0) / 60)
      return sum + Math.min(activeMins, s.durationMinutes || 25)
    }, 0)

  const objectives: DailyObjective[] = [
    {
      id: 'daily_task',
      title: 'Complete 1 Task',
      target: 1,
      current: Math.min(1, completedMissionsToday),
      unit: 'task',
      isCompleted: completedMissionsToday >= 1,
      description: 'Execute and conclude one prioritized mission.',
    },
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
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED').length
  const totalFocusMinutes = analytics?.summary?.totalFocusMinutes || 0
  const currentStreak = analytics?.summary?.currentStreak || 0

  return [
    {
      id: 'first_task',
      title: 'First Step',
      category: 'tasks',
      description: 'Complete your first execution task.',
      icon: 'check',
      unlocked: completedMissions >= 1,
      progressLabel: completedMissions >= 1 ? 'Unlocked' : `${completedMissions}/1 tasks`,
    },
    {
      id: 'first_sprint',
      title: 'Focus Initiate',
      category: 'focus',
      description: 'Complete a verified focus sprint of 15+ minutes.',
      icon: 'focus',
      unlocked: completedSessions >= 1,
      progressLabel: completedSessions >= 1 ? 'Unlocked' : `${completedSessions}/1 sprint`,
    },
    {
      id: 'deep_flow_hour',
      title: 'Deep Flow Hour',
      category: 'focus',
      description: 'Log 60+ minutes of verified deep focus time.',
      icon: 'clock',
      unlocked: totalFocusMinutes >= 60,
      progressLabel: totalFocusMinutes >= 60 ? 'Unlocked' : `${totalFocusMinutes}/60m`,
    },
    {
      id: 'level_2_practitioner',
      title: 'Disciplined Mind',
      category: 'mastery',
      description: 'Attain Level 2: Disciplined Practitioner (100 XP).',
      icon: 'sparkle',
      unlocked: level >= 2 || totalXp >= 100,
      progressLabel: totalXp >= 100 ? 'Unlocked' : `${totalXp}/100 XP`,
    },
    {
      id: 'goal_concluded',
      title: 'Milestone Breaker',
      category: 'goals',
      description: 'Complete all tasks in a strategic goal.',
      icon: 'target',
      unlocked: completedGoals >= 1,
      progressLabel: completedGoals >= 1 ? 'Unlocked' : `${completedGoals}/1 goal`,
    },
    {
      id: 'momentum_streak',
      title: 'Momentum Builder',
      category: 'consistency',
      description: 'Achieve a 3-day productive streak.',
      icon: 'sparkle',
      unlocked: currentStreak >= 3,
      progressLabel: currentStreak >= 3 ? 'Unlocked' : `${currentStreak}/3 days`,
    },
    {
      id: 'onboarding_certified',
      title: 'Certified Operator',
      category: 'mastery',
      description: 'Complete the SHINPO interactive execution walkthrough.',
      icon: 'check',
      unlocked: isOnboardingVerified || (userProgress?.recentEvents || []).some((e) => e.eventType === 'ONBOARDING_COMPLETED'),
      progressLabel: (isOnboardingVerified || (userProgress?.recentEvents || []).some((e) => e.eventType === 'ONBOARDING_COMPLETED')) ? 'Unlocked' : 'Tour required',
    },
    {
      id: 'level_4_architect',
      title: 'Flow Architect',
      category: 'mastery',
      description: 'Attain Level 4: High-Flow Architect (500 XP).',
      icon: 'sparkle',
      unlocked: level >= 4 || totalXp >= 500,
      progressLabel: totalXp >= 500 ? 'Unlocked' : `${totalXp}/500 XP`,
    },
  ]
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

  const colors = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#A78BFA']
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
