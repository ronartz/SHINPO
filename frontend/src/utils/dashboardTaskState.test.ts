import test from 'node:test'
import assert from 'node:assert/strict'
import { getDashboardTaskState } from './dashboardTaskState.ts'
import type { Mission } from '../api/goalsAndMissions.ts'

const task = (id: number, status: Mission['status']): Mission => ({
  id, goalId: 1, title: `Task ${id}`, description: '', scheduledDate: '2026-11-07', estimatedMinutes: 25, status,
} as Mission)

test('dashboard task state distinguishes empty, incomplete and fully completed scopes', () => {
  assert.deepEqual(getDashboardTaskState([]), { total: 0, completed: 0, remaining: 0, state: 'EMPTY' })
  assert.equal(getDashboardTaskState([task(1, 'PENDING')]).state, 'IN_PROGRESS')
  assert.equal(getDashboardTaskState([task(1, 'COMPLETED'), task(2, 'PENDING')]).remaining, 1)
  assert.equal(getDashboardTaskState([task(1, 'COMPLETED')]).state, 'COMPLETE')
})
