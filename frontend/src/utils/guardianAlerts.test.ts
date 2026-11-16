import test from 'node:test'
import assert from 'node:assert/strict'
import { takeRecentGuardianObservation } from './guardianAlerts.ts'
import type { GuardianObservation } from '../api/device'

const observation = (id: number, observedAt: string): GuardianObservation => ({
  id,
  sessionId: 7,
  pid: 42,
  processName: 'discord',
  catalogVersion: 'guardian-apps-v1',
  category: 'COMMUNICATION',
  rationale: 'Game and social chat platform',
  guardianMode: 'GUIDED',
  focusPhase: 'FOCUS',
  outcome: 'WARNING_LIGHT',
  observedAt,
})

test('Guardian alert consumes only fresh unseen observations', () => {
  const seen = new Set<number>()
  const fresh = observation(2, '2026-11-05T10:00:25.000Z')
  const old = observation(1, '2026-11-05T10:00:00.000Z')

  assert.equal(takeRecentGuardianObservation([fresh, old], seen, Date.parse('2026-11-05T10:00:30.000Z')), fresh)
  assert.equal(takeRecentGuardianObservation([fresh, old], seen, Date.parse('2026-11-05T10:00:31.000Z')), undefined)
})

test('Guardian alert ignores stale and invalid timestamps without replaying them later', () => {
  const seen = new Set<number>()
  const stale = observation(3, '2026-11-05T09:59:00.000Z')
  const invalid = observation(4, 'not-a-timestamp')

  assert.equal(takeRecentGuardianObservation([stale, invalid], seen, Date.parse('2026-11-05T10:00:00.000Z')), undefined)
  assert.equal(seen.has(3), true)
  assert.equal(seen.has(4), true)
})

test('Guardian alert does not warn for an app observed during an allowed break', () => {
  const seen = new Set<number>()
  const allowed = { ...observation(5, '2026-11-05T10:00:25.000Z'), outcome: 'ALLOWED_BREAK' }

  assert.equal(takeRecentGuardianObservation([allowed], seen, Date.parse('2026-11-05T10:00:30.000Z')), undefined)
  assert.equal(seen.has(5), true)
})
