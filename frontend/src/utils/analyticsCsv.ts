import type { AnalyticsPeriodResponse } from '../api/analytics.ts'

const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export function buildAnalyticsCsv(period: AnalyticsPeriodResponse): string {
  const rows: (string | number)[][] = [['period', 'bucket_start_utc', 'bucket_end_utc', 'focus_minutes', 'completed_focus_sessions']]
  for (const [name, buckets] of [['current', period.currentBuckets], ['previous', period.previousBuckets]] as const) {
    for (const bucket of buckets) rows.push([name, bucket.start, bucket.end, (bucket.activeSeconds / 60).toFixed(2), bucket.completedSessions])
  }
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}
