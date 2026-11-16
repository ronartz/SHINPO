import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeDailyObjectives,
  deriveAchievements,
  findNewProgressEvents,
  getLocalDateString,
  spawnCelebrationSparkles,
} from './progressionEngine.ts'
import type { Mission, Goal } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { ProgressResponse } from '../api/progress'
import type { AnalyticsDashboardResponse } from '../api/analytics'

function createMockSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 1,
    userId: 42,
    goalId: null,
    missionId: null,
    name: 'Test Sprint',
    intention: 'Testing flow',
    durationMinutes: 25,
    status: 'COMPLETED',
    scheduledAt: null,
    startedAt: '2026-10-21T10:00:00Z',
    pausedAt: null,
    accumulatedPausedSeconds: 0,
    activeSeconds: 1500,
    remainingSeconds: 0,
    serverTime: '2026-10-21T10:25:00Z',
    endedAt: '2026-10-21T10:25:00Z',
    createdAt: '2026-10-21T10:00:00Z',
    updatedAt: '2026-10-21T10:25:00Z',
    ...overrides,
  }
}

test('computeDailyObjectives correctly evaluates zero progress on a fresh day', () => {
  const summary = computeDailyObjectives([], '2026-10-21')

  assert.equal(summary.totalCount, 2)
  assert.equal(summary.completedCount, 0)
  assert.equal(summary.isAllCompleted, false)
  assert.equal(summary.objectives[0].id, 'daily_focus_sprint')
  assert.equal(summary.objectives[0].isCompleted, false)
  assert.equal(summary.objectives[1].id, 'daily_focus_duration')
  assert.equal(summary.objectives[1].isCompleted, false)
})

test('computeDailyObjectives completes focus objectives from same-day completed session evidence', () => {
  const mockSessions: FocusSession[] = [
    createMockSession({
      id: 101,
      name: 'Sprint Alpha',
      durationMinutes: 30,
      activeSeconds: 1800, // 30 active minutes
      status: 'COMPLETED',
      startedAt: '2026-10-21T10:00:00Z',
    }),
  ]

  const summary = computeDailyObjectives(mockSessions, '2026-10-21')

  assert.equal(summary.completedCount, 2)
  assert.equal(summary.isAllCompleted, true)
  assert.equal(summary.objectives[0].isCompleted, true)
  assert.equal(summary.objectives[1].isCompleted, true)
  assert.equal(summary.objectives[1].current, 25)
})

test('computeDailyObjectives ignores sessions under 15 active minutes for sprint objective', () => {
  const mockSessions: FocusSession[] = [
    createMockSession({
      id: 102,
      name: 'Quick check',
      durationMinutes: 10,
      activeSeconds: 600, // 10 active minutes (< 15)
      status: 'COMPLETED',
      startedAt: '2026-10-21T10:00:00Z',
    }),
  ]

  const summary = computeDailyObjectives(mockSessions, '2026-10-21')

  assert.equal(summary.objectives[0].isCompleted, false)
  assert.equal(summary.objectives[1].current, 10)
  assert.equal(summary.objectives[1].isCompleted, false)
})

test('daily objectives exclude completed sessions without completion-date evidence or from another day', () => {
  const summary = computeDailyObjectives([
    createMockSession({ endedAt: null, activeSeconds: 3600 }),
    createMockSession({ endedAt: '2026-10-20T10:00:00Z', activeSeconds: 3600 }),
  ], '2026-10-21')
  assert.equal(summary.completedCount, 0)
})

test('deriveAchievements truthfully reports unlocked milestones from backend stats', () => {
  const mockProgress: ProgressResponse = {
    userId: 1,
    totalProgress: 120,
    level: 2,
    levelTitle: 'Focused Learner',
    currentLevelXp: 20,
    nextLevelThreshold: 150,
    progressPercent: 13.3,
    recentEvents: [
      { id: 1, eventType: 'ONBOARDING_COMPLETED', amount: 50, createdAt: '2026-10-20T12:00:00Z' },
    ],
  }

  const mockAnalytics: AnalyticsDashboardResponse = {
    summary: {
      totalFocusMinutes: 75,
      sessionsCompleted: 3,
      sessionsStarted: 3,
      missionsCompleted: 2,
      missionsTotal: 5,
      avgQuality: 4.5,
      completionRate: 40,
      currentStreak: 4,
      completionRatePopulation: 'MISSIONS',
      completionRateNumerator: 2,
      completionRateDenominator: 5,
    },
    weeklyVelocity: [],
    recentDebriefs: [],
  }

  const mockMissions: Mission[] = [
    { id: 1, goalId: 10, title: 'T1', description: '', status: 'COMPLETED', estimatedMinutes: 15, scheduledDate: '2026-10-21', createdAt: '2026-10-21T09:00:00Z' },
  ]
  const mockGoals: Goal[] = [
    { id: 10, title: 'G1', description: '', status: 'COMPLETED', startDate: '2026-10-01', targetDate: '2026-10-31', createdAt: '2026-10-01T00:00:00Z' },
  ]
  const mockSessions: FocusSession[] = [
    createMockSession({ id: 1, name: 'S1', durationMinutes: 25, activeSeconds: 1500, status: 'COMPLETED', startedAt: '2026-10-21T10:00:00Z' }),
    createMockSession({ id: 2, name: 'S2', durationMinutes: 25, activeSeconds: 1500, status: 'COMPLETED', startedAt: '2026-10-22T10:00:00Z' }),
    createMockSession({ id: 3, name: 'S3', durationMinutes: 25, activeSeconds: 1500, status: 'COMPLETED', startedAt: '2026-10-23T10:00:00Z' }),
  ]

  const achievements = deriveAchievements(mockProgress, mockAnalytics, mockMissions, mockGoals, mockSessions)

  const firstStep = achievements.find((a) => a.id === 'first_task')
  assert.equal(firstStep?.unlocked, true)

  const deepFlow = achievements.find((a) => a.id === 'deep_flow_hour')
  assert.equal(deepFlow?.unlocked, true) // 75m >= 60m

  const level2 = achievements.find((a) => a.id === 'level_2_practitioner')
  assert.equal(level2?.unlocked, true) // level 2, 120 XP >= 100 XP

  const goalConcluded = achievements.find((a) => a.id === 'goal_concluded')
  assert.equal(goalConcluded?.unlocked, true)

  const streak = achievements.find((a) => a.id === 'momentum_streak')
  assert.equal(streak?.unlocked, true) // 4 >= 3

  const onboarding = achievements.find((a) => a.id === 'onboarding_certified')
  assert.equal(onboarding?.unlocked, true)
})

test('onboarding achievement requires its server-recorded workflow event', () => {
  const onboarding = deriveAchievements(null, null, [], [], [])
    .find((item) => item.id === 'onboarding_certified')
  assert.equal(onboarding?.unlocked, false)
  assert.equal(onboarding?.evidence, 'unavailable')
})

test('focus-session achievement requires at least 15 active minutes in one completed session', () => {
  const make = (activeSeconds: number) => deriveAchievements(null, null, [], [], [
    createMockSession({ status: 'COMPLETED', activeSeconds }),
  ]).find((item) => item.id === 'first_sprint')!

  assert.equal(make(60).unlocked, false)
  assert.equal(make(899).unlocked, false)
  assert.equal(make(900).unlocked, true)
})

test('new progress events are detected by stable ledger IDs exactly once', () => {
  const previous: ProgressResponse = {
    userId: 1, totalProgress: 10, level: 1, levelTitle: 'Getting Started', currentLevelXp: 10,
    nextLevelThreshold: 100, progressPercent: 10,
    recentEvents: [{ id: 7, eventType: 'MISSION_COMPLETED', amount: 10, createdAt: '2026-10-20T10:00:00Z' }],
  }
  const current = { ...previous, totalProgress: 25, recentEvents: [
    { id: 9, eventType: 'FOCUS_SESSION_COMPLETED', amount: 15, createdAt: '2026-10-20T11:00:00Z' },
    ...previous.recentEvents,
  ] }
  assert.deepEqual(findNewProgressEvents(previous, current).map((event) => event.id), [9])
  assert.deepEqual(findNewProgressEvents(current, current), [])
  assert.deepEqual(findNewProgressEvents(null, current), [])
})

test('celebration visuals execute safely in non-browser or test environments', () => {
  assert.doesNotThrow(() => spawnCelebrationSparkles())
})

test('getLocalDateString returns valid YYYY-MM-DD pattern', () => {
  const dateStr = getLocalDateString(new Date(2026, 9, 21)) // Oct 21 2026
  assert.equal(dateStr, '2026-10-21')
})
