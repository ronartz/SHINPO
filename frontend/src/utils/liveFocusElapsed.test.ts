import test from 'node:test'
import assert from 'node:assert/strict'
import { getLiveFocusElapsedSeconds } from './liveFocusElapsed.ts'
import type { FocusSession } from '../api/focusSessions.ts'

const session = (overrides: Partial<FocusSession> = {}) => ({
  id: 1, userId: 1, goalId: null, missionId: null, name: 'Focus', intention: null, durationMinutes: 25,
  status: 'ACTIVE', scheduledAt: null, startedAt: null, pausedAt: null, accumulatedPausedSeconds: 0,
  activeSeconds: 0, remainingSeconds: 1500, endedAt: null, createdAt: '', updatedAt: '', currentPhase: 'FOCUS',
  ...overrides,
} as FocusSession)

test('live Focus time advances from the native timing snapshot and freezes outside active Focus', () => {
  assert.equal(getLiveFocusElapsedSeconds(session(), 1495), 5)
  assert.equal(getLiveFocusElapsedSeconds(session({ activeSeconds: 100, remainingSeconds: 1400 }), 1390), 110)
  assert.equal(getLiveFocusElapsedSeconds(session({ status: 'PAUSED', activeSeconds: 42 }), 0), 42)
  assert.equal(getLiveFocusElapsedSeconds(session({ currentPhase: 'BREAK', activeSeconds: 100 }), 50), 100)
})
