import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNiceAxis,
  formatAxisTick,
  formatFocusDuration,
  formatDailyAverage,
  formatDateRange,
  formatBucketLabel,
  calculateComparison,
  generatePeriodBuckets,
  aggregateSessionsIntoPeriod,
} from './analyticsEngine.ts'
import { buildAnalyticsCsv } from './analyticsCsv.ts'
import type { FocusSession } from '../api/focusSessions.ts'

function createFakeSession(
  id: number,
  endedAt: string,
  activeSeconds: number
): FocusSession {
  return {
    id,
    userId: 1,
    goalId: null,
    missionId: null,
    name: `Session ${id}`,
    intention: 'Deep focus',
    durationMinutes: Math.round(activeSeconds / 60),
    activeSeconds,
    accumulatedPausedSeconds: 0,
    status: 'COMPLETED',
    scheduledAt: null,
    startedAt: new Date(new Date(endedAt).getTime() - activeSeconds * 1000).toISOString(),
    pausedAt: null,
    endedAt,
    createdAt: endedAt,
    updatedAt: endedAt,
    completionQuality: 5,
    accomplishment: 'Finished milestone task',
    reflectionNote: 'Smooth focus flow',
  }
}

test('1. All-zero dataset: aggregateSessionsIntoPeriod produces 0 totals and zero buckets', () => {
  const ref = new Date('2026-11-08T12:00:00.000Z')
  const res = aggregateSessionsIntoPeriod([], '7d', ref)

  assert.equal(res.currentActiveSeconds, 0)
  assert.equal(res.currentCompletedSessions, 0)
  assert.equal(res.previousActiveSeconds, 0)
  assert.equal(res.previousCompletedSessions, 0)
  assert.equal(res.currentBuckets.length, 7)
  assert.ok(res.currentBuckets.every((b) => b.activeSeconds === 0 && b.completedSessions === 0))
})

test('2. One active day: aggregates exactly into the matching day bucket', () => {
  const ref = new Date(2026, 10, 8, 14, 0, 0) // Nov 8 2026
  const sessionTime = new Date(2026, 10, 5, 10, 30, 0).toISOString() // Nov 5
  const sessions = [createFakeSession(1, sessionTime, 1800)] // 30m

  const res = aggregateSessionsIntoPeriod(sessions, '7d', ref)

  assert.equal(res.currentActiveSeconds, 1800)
  assert.equal(res.currentCompletedSessions, 1)

  // Find Nov 5 bucket
  const nov5Bucket = res.currentBuckets.find((b) => {
    const d = new Date(b.start)
    return d.getDate() === 5 && d.getMonth() === 10
  })
  assert.ok(nov5Bucket, 'Nov 5 bucket should exist in 7d window')
  assert.equal(nov5Bucket?.activeSeconds, 1800)
  assert.equal(nov5Bucket?.completedSessions, 1)

  // Other buckets should remain 0
  const otherBuckets = res.currentBuckets.filter((b) => b !== nov5Bucket)
  assert.ok(otherBuckets.every((b) => b.activeSeconds === 0))
})

test('3. Seven active days: each day accumulates its respective focus duration', () => {
  const ref = new Date(2026, 10, 8, 18, 0, 0)
  const sessions: FocusSession[] = []

  // Add 1 session for each of the 7 days (Nov 2 to Nov 8)
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(2026, 10, 2 + i, 11, 0, 0).toISOString()
    sessions.push(createFakeSession(i + 1, dayDate, (i + 1) * 600)) // 10m, 20m, ..., 70m
  }

  const res = aggregateSessionsIntoPeriod(sessions, '7d', ref)

  assert.equal(res.currentCompletedSessions, 7)
  const expectedTotalSeconds = (10 + 20 + 30 + 40 + 50 + 60 + 70) * 60
  assert.equal(res.currentActiveSeconds, expectedTotalSeconds)
  assert.ok(res.currentBuckets.every((b) => b.activeSeconds > 0 && b.completedSessions === 1))
})

test('4. Very small Focus durations: formatted meaningfully without rounding to false 0m', () => {
  assert.equal(formatFocusDuration(0), '0m')
  assert.equal(formatFocusDuration(18, { showSecondsIfSmall: true }), '18s')
  assert.equal(formatFocusDuration(45, { showSecondsIfSmall: true }), '45s')
  assert.equal(formatFocusDuration(45), '<1m')
  assert.equal(formatFocusDuration(120), '2m')

  // Daily average for 120s over 7 days is 17.14s -> should display '17s', NOT '0m'
  assert.equal(formatDailyAverage(120, 7), '17s')
  assert.equal(formatDailyAverage(0, 7), '0m')
})

test('5. Large Focus durations: formatted cleanly into hours and minutes', () => {
  assert.equal(formatFocusDuration(3600), '1h')
  assert.equal(formatFocusDuration(3600 + 15 * 60), '1h 15m')
  assert.equal(formatFocusDuration(5 * 3600), '5h')
  assert.equal(formatFocusDuration(12 * 3600 + 30 * 60), '12h 30m')
})

test('6. Previous-period comparison: accurately computes delta and tone', () => {
  assert.deepEqual(calculateComparison(120, 120), { label: 'No change', tone: 'neutral' })
  assert.deepEqual(calculateComparison(120, 0), { label: 'New activity', tone: 'positive' })
  assert.deepEqual(calculateComparison(150, 100), { label: '+50%', tone: 'positive' })
  assert.deepEqual(calculateComparison(80, 100), { label: '-20%', tone: 'negative' })
})

test('7. Midnight boundary: sessions at 23:59:50 vs 00:00:10 land in distinct adjacent days', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const sessionBeforeMidnight = createFakeSession(1, new Date(2026, 10, 4, 23, 59, 50).toISOString(), 300)
  const sessionAfterMidnight = createFakeSession(2, new Date(2026, 10, 5, 0, 0, 10).toISOString(), 300)

  const res = aggregateSessionsIntoPeriod([sessionBeforeMidnight, sessionAfterMidnight], '7d', ref)

  const nov4Bucket = res.currentBuckets.find((b) => new Date(b.start).getDate() === 4)
  const nov5Bucket = res.currentBuckets.find((b) => new Date(b.start).getDate() === 5)

  assert.equal(nov4Bucket?.activeSeconds, 300)
  assert.equal(nov4Bucket?.completedSessions, 1)
  assert.equal(nov5Bucket?.activeSeconds, 300)
  assert.equal(nov5Bucket?.completedSessions, 1)
})

test('8. Month boundary: transitions from October 31 to November 1 without missing days', () => {
  const ref = new Date(2026, 10, 3, 12, 0, 0) // Nov 3, 2026
  const buckets = generatePeriodBuckets('7d', ref).currentBuckets

  assert.equal(buckets.length, 7)
  const dates = buckets.map((b) => {
    const d = new Date(b.start)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })

  // 7 days ending Nov 3 are: Oct 28, Oct 29, Oct 30, Oct 31, Nov 1, Nov 2, Nov 3
  assert.deepEqual(dates, ['10/28', '10/29', '10/30', '10/31', '11/1', '11/2', '11/3'])
})

test('9. Timezone boundary: bucket starts at local 00:00:00', () => {
  const ref = new Date(2026, 10, 8, 15, 30, 0)
  const period = generatePeriodBuckets('7d', ref)

  for (const b of period.currentBuckets) {
    const start = new Date(b.start)
    assert.equal(start.getHours(), 0, 'Local start hours must be 0')
    assert.equal(start.getMinutes(), 0, 'Local start minutes must be 0')
    assert.equal(start.getSeconds(), 0, 'Local start seconds must be 0')
  }
})

test('10. Daylight-saving boundary: day buckets correctly step across calendar dates', () => {
  // Spring DST in US is in March (e.g. March 8, 2026)
  const ref = new Date(2026, 2, 10, 12, 0, 0)
  const period = generatePeriodBuckets('7d', ref)

  const dates = period.currentBuckets.map((b) => new Date(b.start).getDate())
  assert.deepEqual(dates, [4, 5, 6, 7, 8, 9, 10])
})

test('11. 24-hour bucketing: generates exactly 12 2-hour buckets', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const period = generatePeriodBuckets('24h', ref)

  assert.equal(period.currentBuckets.length, 12)
  assert.equal(period.previousBuckets.length, 12)

  // Verify total span is exactly 24 hours (86,400,000 ms)
  const startMs = new Date(period.currentStart).getTime()
  const endMs = new Date(period.currentEnd).getTime()
  assert.equal(endMs - startMs, 24 * 3600 * 1000)
})

test('12. Seven-day bucketing: generates 7 calendar days and truthful date range labels', () => {
  const ref = new Date(2026, 10, 8, 23, 41, 0) // Sunday Nov 8
  const period = generatePeriodBuckets('7d', ref)

  assert.equal(period.currentBuckets.length, 7)
  assert.equal(period.previousBuckets.length, 7)

  const currentLabel = formatDateRange(
    period.currentStart,
    period.currentEnd,
    '7d',
    period.currentBuckets[6].start
  )
  const prevLabel = formatDateRange(
    period.previousStart,
    period.previousEnd,
    '7d',
    period.previousBuckets[6].start
  )

  // Truthful ranges: "Nov 2 – Nov 8" and "Oct 26 – Nov 1"
  assert.equal(currentLabel, 'Nov 2 – Nov 8')
  assert.equal(prevLabel, 'Oct 26 – Nov 1')
})

test('13. Thirty-day bucketing: generates exactly 30 daily buckets', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const period = generatePeriodBuckets('30d', ref)

  assert.equal(period.currentBuckets.length, 30)
  assert.equal(period.previousBuckets.length, 30)
})

test('14. Ninety-day aggregation: generates 13 weekly buckets covering exactly 90 days', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const period = generatePeriodBuckets('90d', ref)

  assert.equal(period.currentBuckets.length, 13)
  assert.equal(period.previousBuckets.length, 13)

  // Sum of bucket days = 6 + 12 * 7 = 90 days
  let totalDays = 0
  for (const b of period.currentBuckets) {
    const s = new Date(b.start).getTime()
    const e = new Date(b.end).getTime()
    const days = Math.round((e - s) / 86400000)
    totalDays += days
  }
  assert.equal(totalDays, 90)
})

test('15. Chart axis accuracy: no middle tick rounding distortion (2.5m is not rounded to 3m)', () => {
  // Test zero data
  const zeroAxis = calculateNiceAxis(0)
  assert.deepEqual(zeroAxis.ticks, [0, 5, 10])
  assert.equal(formatAxisTick(zeroAxis.ticks[1]), '5m')

  // Test 2 minutes
  const twoMinAxis = calculateNiceAxis(2)
  assert.deepEqual(twoMinAxis.ticks, [0, 1, 2])
  assert.equal(formatAxisTick(1), '1m')

  // Test 2.5 minutes
  const halfMinAxis = calculateNiceAxis(2.5)
  // With calculateNiceAxis, maxMinutes <= 5 produces [0, 2, 4, 6]
  assert.deepEqual(halfMinAxis.ticks, [0, 2, 4, 6])
  assert.equal(formatAxisTick(2), '2m')
  assert.equal(formatAxisTick(4), '4m')

  // Fractional tick formatting test
  assert.equal(formatAxisTick(2.5), '2.5m')
  assert.notEqual(formatAxisTick(2.5), '3m', '2.5m must NEVER be rounded to 3m!')

  // Hours formatting
  assert.equal(formatAxisTick(60), '1h')
  assert.equal(formatAxisTick(120), '2h')
  assert.equal(formatAxisTick(90), '1h 30m')
})

test('16. Chart-total accuracy: currentActiveSeconds matches sum of bucket activeSeconds', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const sessions = [
    createFakeSession(1, new Date(2026, 10, 3, 10, 0, 0).toISOString(), 1500),
    createFakeSession(2, new Date(2026, 10, 5, 14, 0, 0).toISOString(), 2700),
    createFakeSession(3, new Date(2026, 10, 8, 9, 30, 0).toISOString(), 3600),
  ]

  const res = aggregateSessionsIntoPeriod(sessions, '7d', ref)

  const bucketSum = res.currentBuckets.reduce((sum, b) => sum + b.activeSeconds, 0)
  assert.equal(res.currentActiveSeconds, bucketSum)
  assert.equal(res.currentActiveSeconds, 1500 + 2700 + 3600)
  assert.equal(res.currentCompletedSessions, 3)
})

test('17. CSV export consistency: exports all bucket rows and totals accurately', () => {
  const ref = new Date(2026, 10, 8, 12, 0, 0)
  const sessions = [
    createFakeSession(1, new Date(2026, 10, 8, 10, 0, 0).toISOString(), 1800), // 30.00 mins
  ]
  const period = aggregateSessionsIntoPeriod(sessions, '7d', ref)

  const csv = buildAnalyticsCsv(period)
  assert.ok(csv.includes('"period","bucket_start_utc","bucket_end_utc","focus_minutes","completed_focus_sessions"'))
  assert.ok(csv.includes('"current"'))
  assert.ok(csv.includes('"previous"'))
  assert.ok(csv.includes('"30.00"'))
})

test('18. formatBucketLabel formats range labels properly', () => {
  const d = new Date(2026, 10, 8, 14, 0, 0).toISOString()
  const label24h = formatBucketLabel(d, '24h')
  assert.ok(label24h.length > 0)
  const label7d = formatBucketLabel(d, '7d')
  assert.ok(label7d.length > 0)
})
