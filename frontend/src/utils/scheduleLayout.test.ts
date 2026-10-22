import assert from 'node:assert/strict'
import test from 'node:test'
import { layoutOverlappingSessions } from './scheduleLayout.ts'

test('overlapping calendar entries receive separate readable lanes', () => {
  const layout = layoutOverlappingSessions([
    { id: 1, startMinute: 540, durationMinutes: 60 },
    { id: 2, startMinute: 570, durationMinutes: 60 },
    { id: 3, startMinute: 585, durationMinutes: 30 },
    { id: 4, startMinute: 645, durationMinutes: 30 },
  ])

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 3 })
  assert.deepEqual(layout.get(2), { lane: 1, laneCount: 3 })
  assert.deepEqual(layout.get(3), { lane: 2, laneCount: 3 })
  assert.deepEqual(layout.get(4), { lane: 0, laneCount: 1 })
})

test('entries that only touch at an endpoint do not overlap', () => {
  const layout = layoutOverlappingSessions([
    { id: 2, startMinute: 600, durationMinutes: 30 },
    { id: 1, startMinute: 570, durationMinutes: 30 },
  ])

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 1 })
  assert.deepEqual(layout.get(2), { lane: 0, laneCount: 1 })
})
