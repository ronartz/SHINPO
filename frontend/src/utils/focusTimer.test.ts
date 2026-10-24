import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRemainingSeconds, formatTimerDigits, pomodoroPlans } from './focusTimer.ts'
import type { FocusSession } from '../api/focusSessions.ts'

function createMockSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 1,
    userId: 42,
    goalId: null,
    missionId: null,
    name: 'Test Sprint',
    intention: 'Testing timing',
    durationMinutes: 25,
    status: 'ACTIVE',
    scheduledAt: null,
    startedAt: '2026-10-10T12:00:00Z',
    pausedAt: null,
    accumulatedPausedSeconds: 0,
    activeSeconds: 0,
    remainingSeconds: 1500,
    serverTime: '2026-10-10T12:00:00Z',
    endedAt: null,
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z',
    ...overrides,
  }
}

test('formatTimerDigits formats minutes and seconds correctly', () => {
  assert.equal(formatTimerDigits(1500), '25:00')
  assert.equal(formatTimerDigits(65), '01:05')
  assert.equal(formatTimerDigits(5), '00:05')
  assert.equal(formatTimerDigits(0), '00:00')
  assert.equal(formatTimerDigits(-10), '00:00')
})

test('focus presets describe the actual single-session behavior without promising breaks', () => {
  assert.deepEqual(pomodoroPlans.map(({ totalMinutes }) => totalMinutes), [55, 60, 90])
  assert.ok(pomodoroPlans.every(({ schedule }) => schedule === 'One continuous focus session'))
})

test('calculateRemainingSeconds returns fallback duration when no active session exists', () => {
  const result = calculateRemainingSeconds(null, Date.now(), 30)
  assert.equal(result, 1800)
})

test('calculateRemainingSeconds counts down accurately for ACTIVE session using server anchor', () => {
  const serverTime = '2026-10-10T12:00:00.000Z'
  const serverTimeMs = new Date(serverTime).getTime()
  const session = createMockSession({
    status: 'ACTIVE',
    durationMinutes: 25,
    remainingSeconds: 1500,
    serverTime,
  })

  // At the moment of serverTime: 1500s remaining
  assert.equal(calculateRemainingSeconds(session, serverTimeMs), 1500)

  // 10 seconds later: 1490s remaining
  assert.equal(calculateRemainingSeconds(session, serverTimeMs + 10_000), 1490)

  // 5 minutes later: 1200s remaining
  assert.equal(calculateRemainingSeconds(session, serverTimeMs + 300_000), 1200)
})

test('Pomodoro break countdown uses the backend phase remaining-time anchor', () => {
  const serverTime = '2026-10-23T12:00:00.000Z'
  const anchor = new Date(serverTime).getTime()
  const session = createMockSession({
    pomodoroEnabled: true,
    currentPhase: 'SHORT_BREAK',
    remainingSeconds: 300,
    serverTime,
  })
  assert.equal(calculateRemainingSeconds(session, anchor + 12_000), 288)
})

test('calculateRemainingSeconds freezes countdown in PAUSED state', () => {
  const session = createMockSession({
    status: 'PAUSED',
    durationMinutes: 25,
    remainingSeconds: 1350, // paused with 22:30 left
    pausedAt: '2026-10-10T12:02:30.000Z',
    serverTime: '2026-10-10T12:02:30.000Z',
  })

  const pauseMs = new Date('2026-10-10T12:02:30.000Z').getTime()

  // Immediately at pause: 1350s
  assert.equal(calculateRemainingSeconds(session, pauseMs), 1350)

  // 30 seconds after pause: still frozen at 1350s
  assert.equal(calculateRemainingSeconds(session, pauseMs + 30_000), 1350)

  // 10 minutes after pause: still frozen at 1350s
  assert.equal(calculateRemainingSeconds(session, pauseMs + 600_000), 1350)
})

test('calculateRemainingSeconds uses the full budget for PAUSED sessions without remainingSeconds', () => {
  const session = createMockSession({
    status: 'PAUSED',
    remainingSeconds: undefined,
    activeSeconds: 300,
  })

  assert.equal(calculateRemainingSeconds(session, Date.now()), 1200)
})

test('calculateRemainingSeconds falls back to startedAt when serverTime is invalid', () => {
  const startedAt = '2026-10-10T12:00:00.000Z'
  const session = createMockSession({
    status: 'ACTIVE',
    startedAt,
    serverTime: 'not-a-time',
    remainingSeconds: 1500,
  })

  assert.equal(
    calculateRemainingSeconds(session, new Date('2026-10-10T12:10:00.000Z').getTime()),
    900,
  )
})

test('calculateRemainingSeconds freezes when client time precedes serverTime', () => {
  const serverTime = '2026-10-10T12:00:00.000Z'
  const session = createMockSession({ serverTime, remainingSeconds: 1500 })

  assert.equal(
    calculateRemainingSeconds(session, new Date('2026-10-10T11:59:00.000Z').getTime()),
    1500,
  )
})

test('calculateRemainingSeconds resumes seamlessly from frozen value', () => {
  // Session was resumed at 12:12:30 with remainingSeconds = 1350
  const resumeServerTime = '2026-10-10T12:12:30.000Z'
  const resumeMs = new Date(resumeServerTime).getTime()
  const session = createMockSession({
    status: 'ACTIVE',
    durationMinutes: 25,
    remainingSeconds: 1350,
    serverTime: resumeServerTime,
    accumulatedPausedSeconds: 600, // 10 minutes paused
  })

  // At moment of resume: exactly 1350s
  assert.equal(calculateRemainingSeconds(session, resumeMs), 1350)

  // 5 seconds after resume: 1345s
  assert.equal(calculateRemainingSeconds(session, resumeMs + 5000), 1345)

  // 60 seconds after resume: 1290s
  assert.equal(calculateRemainingSeconds(session, resumeMs + 60_000), 1290)
})

test('calculateRemainingSeconds handles background-tab throttling without cumulative drift', () => {
  const serverTime = '2026-10-10T12:00:00.000Z'
  const startMs = new Date(serverTime).getTime()
  const session = createMockSession({
    status: 'ACTIVE',
    durationMinutes: 25,
    remainingSeconds: 1500,
    serverTime,
  })

  // Simulate tab throttled for 15 minutes (900 seconds)
  const wakeUpMs = startMs + 900_000
  const remaining = calculateRemainingSeconds(session, wakeUpMs)

  // Must accurately reflect 900s elapsed (1500 - 900 = 600s remaining = 10:00)
  assert.equal(remaining, 600)
})

test('calculateRemainingSeconds falls back gracefully when serverTime is absent', () => {
  const startedAt = '2026-10-10T12:00:00.000Z'
  const startMs = new Date(startedAt).getTime()
  const session = createMockSession({
    status: 'ACTIVE',
    durationMinutes: 25,
    startedAt,
    accumulatedPausedSeconds: 120, // 2 minutes paused
    serverTime: undefined as unknown as string,
    remainingSeconds: undefined as unknown as number,
  })

  // 10 minutes (600s) elapsed wall-clock, 2 minutes paused = 8 minutes (480s) active
  // Remaining = 25m (1500s) - 480s = 1020s (17:00)
  const checkMs = startMs + 600_000
  assert.equal(calculateRemainingSeconds(session, checkMs), 1020)
})

test('calculateRemainingSeconds floors at 0 for completed/expired or overtime sessions', () => {
  const sessionOvertime = createMockSession({
    status: 'ACTIVE',
    durationMinutes: 25,
    remainingSeconds: 10,
    serverTime: '2026-10-10T12:00:00.000Z',
  })
  const startMs = new Date('2026-10-10T12:00:00.000Z').getTime()
  assert.equal(calculateRemainingSeconds(sessionOvertime, startMs + 30_000), 0)

  const sessionCompleted = createMockSession({ status: 'COMPLETED' })
  assert.equal(calculateRemainingSeconds(sessionCompleted, Date.now()), 0)

  const sessionExpired = createMockSession({ status: 'EXPIRED' })
  assert.equal(calculateRemainingSeconds(sessionExpired, Date.now()), 0)
})
