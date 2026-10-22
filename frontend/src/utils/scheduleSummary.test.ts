import assert from 'node:assert/strict'
import test from 'node:test'
import type { FocusSession } from '../api/focusSessions.ts'
import { formatScheduleDuration, summarizeSchedule } from './scheduleSummary.ts'

const session = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  id: 1, userId: 1, goalId: null, missionId: null, name: 'Focus', intention: null,
  durationMinutes: 25, status: 'SCHEDULED', scheduledAt: null, startedAt: null,
  pausedAt: null, accumulatedPausedSeconds: 0, activeSeconds: 0, endedAt: null,
  createdAt: '2026-10-22T08:00:00Z', updatedAt: '2026-10-22T08:00:00Z',
  ...overrides,
})

test('weekly summary separates planned time from persisted actual focus', () => {
  const summary = summarizeSchedule([
    session({ status: 'COMPLETED', activeSeconds: 1128 }),
    session({ id: 2, status: 'ACTIVE', activeSeconds: 300 }),
    session({ id: 3, status: 'SCHEDULED' }),
    session({ id: 4, status: 'CANCELLED', activeSeconds: 60 }),
  ])

  assert.deepEqual(summary, { plannedMinutes: 75, actualSeconds: 1488, plannedCount: 3, completed: 1, upcoming: 1 })
})

test('cancelled, expired, and failed bookings do not inflate the live plan', () => {
  const summary = summarizeSchedule([
    session({ status: 'CANCELLED', activeSeconds: 60 }),
    session({ id: 2, status: 'EXPIRED' }),
    session({ id: 3, status: 'FAILED' }),
  ])

  assert.deepEqual(summary, { plannedMinutes: 0, actualSeconds: 60, plannedCount: 0, completed: 0, upcoming: 0 })
})

test('empty summary and duration labels remain explicit and compact', () => {
  assert.deepEqual(summarizeSchedule([]), { plannedMinutes: 0, actualSeconds: 0, plannedCount: 0, completed: 0, upcoming: 0 })
  assert.equal(formatScheduleDuration(0), '0m')
  assert.equal(formatScheduleDuration(59), '59m')
  assert.equal(formatScheduleDuration(60), '1h')
  assert.equal(formatScheduleDuration(125), '2h 5m')
})
