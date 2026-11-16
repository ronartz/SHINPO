import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAnalyticsCsv } from './analyticsCsv.ts'

test('analytics CSV exports current and previous period buckets with escaped cells', () => {
  const csv = buildAnalyticsCsv({
    range: '7d', timezone: 'UTC',
    currentStart: '2026-10-20T00:00:00Z', currentEnd: '2026-10-27T00:00:00Z',
    previousStart: '2026-10-13T00:00:00Z', previousEnd: '2026-10-20T00:00:00Z',
    currentBuckets: [{ start: '2026-10-20T00:00:00Z', end: '2026-10-21T00:00:00Z', activeSeconds: 90, completedSessions: 2 }],
    previousBuckets: [{ start: '2026-10-13T00:00:00Z', end: '2026-10-14T00:00:00Z', activeSeconds: 0, completedSessions: 0 }],
    currentActiveSeconds: 90, currentCompletedSessions: 2, previousActiveSeconds: 0, previousCompletedSessions: 0,
  })
  assert.match(csv, /^"period","bucket_start_utc","bucket_end_utc","focus_minutes","completed_focus_sessions"/)
  assert.match(csv, /"current","2026-10-20T00:00:00Z","2026-10-21T00:00:00Z","1\.50","2"/)
  assert.match(csv, /"previous","2026-10-13T00:00:00Z"/)
})
