import assert from 'node:assert/strict'
import test from 'node:test'
import type { FocusSession } from '../api/focusSessions.ts'
import { getTodayScheduleSessions, isMissionInFocusSession } from './scheduleHelpers.ts'

const session = (id: number, overrides: Partial<FocusSession> = {}): FocusSession => ({
  id, userId: 1, goalId: null, missionId: null, name: `Session ${id}`, intention: null,
  durationMinutes: 25, status: 'SCHEDULED', scheduledAt: null, startedAt: null,
  pausedAt: null, accumulatedPausedSeconds: 0, activeSeconds: 0, endedAt: null,
  createdAt: '2026-10-22T04:00:00.000Z', updatedAt: '2026-10-22T04:00:00.000Z',
  ...overrides,
})

test('dashboard schedule is local-day scoped, excludes inactive bookings, and retains active focus', () => {
  const now = new Date(2026, 9, 22, 12)
  const items = getTodayScheduleSessions([
    session(1, { scheduledAt: new Date(2026, 9, 22, 23, 30).toISOString() }),
    session(2, { scheduledAt: new Date(2026, 9, 23, 0, 15).toISOString() }),
    session(3, { status: 'CANCELLED', scheduledAt: new Date(2026, 9, 22, 13).toISOString() }),
    session(4, { status: 'ACTIVE', scheduledAt: null, startedAt: new Date(2026, 9, 22, 11).toISOString() }),
    session(5, { status: 'COMPLETED', scheduledAt: null, endedAt: new Date(2026, 9, 22, 10).toISOString() }),
  ], null, now)

  assert.deepEqual(items.map(({ id }) => id), [4, 1, 5])
})

test('active task matching prefers the persisted mission link after a task rename', () => {
  const active = session(10, { missionId: 4, name: 'Original task', status: 'ACTIVE' })
  assert.equal(isMissionInFocusSession({ id: 4, title: 'Renamed task' }, active), true)
  assert.equal(isMissionInFocusSession({ id: 5, title: 'Original task' }, active), false)
  assert.equal(isMissionInFocusSession({ id: 4, title: 'Original task' }, session(11, { name: 'Original task' })), true)
})
