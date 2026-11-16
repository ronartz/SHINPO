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

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(2), { lane: 1, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(3), { lane: 2, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(4), { lane: 0, laneCount: 1, laneSpan: 1 })
})

test('entries that only touch at an endpoint do not overlap', () => {
  const layout = layoutOverlappingSessions([
    { id: 2, startMinute: 600, durationMinutes: 30 },
    { id: 1, startMinute: 570, durationMinutes: 30 },
  ])

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 1, laneSpan: 1 })
  assert.deepEqual(layout.get(2), { lane: 0, laneCount: 1, laneSpan: 1 })
})

test('short events in the same overlap cluster expand when later lanes are free', () => {
  const layout = layoutOverlappingSessions([
    { id: 1, startMinute: 540, durationMinutes: 100 },
    { id: 2, startMinute: 550, durationMinutes: 40 },
    { id: 3, startMinute: 560, durationMinutes: 10 },
    { id: 4, startMinute: 590, durationMinutes: 10 },
  ])

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(2), { lane: 1, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(3), { lane: 2, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(4), { lane: 1, laneCount: 3, laneSpan: 2 })
})

test('one-minute stagger and nested intervals never share a lane while overlapping', () => {
  const layout = layoutOverlappingSessions([
    { id: 1, startMinute: 17 * 60 + 59, durationMinutes: 50 },
    { id: 2, startMinute: 18 * 60, durationMinutes: 90 },
    { id: 3, startMinute: 18 * 60 + 10, durationMinutes: 8 },
  ])

  assert.deepEqual(layout.get(1), { lane: 0, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(2), { lane: 1, laneCount: 3, laneSpan: 1 })
  assert.deepEqual(layout.get(3), { lane: 2, laneCount: 3, laneSpan: 1 })
})
