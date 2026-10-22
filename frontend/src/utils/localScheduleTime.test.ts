import assert from 'node:assert/strict'
import test from 'node:test'
import { toLocalScheduleIso } from './localScheduleTime.ts'

test('local schedule time is converted using local timezone and rejects invalid dates', () => {
  assert.equal(toLocalScheduleIso('2026-10-22', '23:45'), new Date(2026, 9, 22, 23, 45).toISOString())
  assert.equal(toLocalScheduleIso('2026-02-30', '09:00'), null)
  assert.equal(toLocalScheduleIso('2026-10-22', '25:00'), null)
})

test('nonexistent daylight-saving local times are rejected rather than silently shifted', () => {
  const previousTimezone = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    assert.equal(toLocalScheduleIso('2026-03-08', '02:30'), null)
    assert.equal(toLocalScheduleIso('2026-03-08', '03:30'), new Date('2026-03-08T07:30:00.000Z').toISOString())
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
})
