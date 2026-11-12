import test from 'node:test'
import assert from 'node:assert/strict'
import type { FocusSessionStatus } from '../api/focusSessions.ts'
import { buildFocusContributionData } from './focusContributionData.ts'

const session = (id: number, endedAt: string | null, status: FocusSessionStatus = 'COMPLETED', activeSeconds = 60) => ({
  id,
  status,
  endedAt,
  activeSeconds,
})

test('annual focus contributions count only completed sessions in the local 365-day window', () => {
  const now = new Date(2026, 10, 9, 12)
  const values = buildFocusContributionData([
    session(1, new Date(2026, 10, 9, 9).toISOString(), 'COMPLETED', 10),
    session(2, new Date(2026, 10, 9, 10).toISOString(), 'COMPLETED', 90),
    session(3, new Date(2026, 10, 9, 11).toISOString(), 'ACTIVE', 500),
    session(4, new Date(2025, 10, 9, 12).toISOString(), 'COMPLETED', 100),
    session(5, null, 'COMPLETED', 100),
  ], now)

  assert.deepEqual(values, [{ date: '2026-11-09', count: 2, durationSeconds: 100 }])
})

test('annual contribution data is empty when there are no qualifying sessions', () => {
  assert.deepEqual(buildFocusContributionData([session(1, null), session(2, '2026-11-09', 'CANCELLED')], new Date(2026, 10, 9)), [])
})
