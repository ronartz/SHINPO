import test from 'node:test'
import assert from 'node:assert/strict'
import type { FocusSession } from '../api/focusSessions'
import { sortFocusSessionsNewestFirst } from './focusSessionHistory.ts'

const session = (id: number, createdAt: string, startedAt: string | null = null): FocusSession => ({
  id, userId: 1, goalId: null, missionId: null, name: `Session ${id}`, intention: null,
  durationMinutes: 25, status: 'COMPLETED', scheduledAt: null, startedAt, pausedAt: null,
  accumulatedPausedSeconds: 0, activeSeconds: 0, endedAt: null, createdAt, updatedAt: createdAt,
})

test('history sorting uses the latest meaningful session timestamp and preserves input', () => {
  const source = [session(1, '2026-10-20T10:00:00Z'), session(2, '2026-10-19T10:00:00Z', '2026-10-21T10:00:00Z')]
  const sorted = sortFocusSessionsNewestFirst(source)
  assert.deepEqual(sorted.map(({ id }) => id), [2, 1])
  assert.deepEqual(source.map(({ id }) => id), [1, 2])
})
