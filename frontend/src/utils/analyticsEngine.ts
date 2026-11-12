import type { AnalyticsActivityBucket, AnalyticsPeriodResponse, AnalyticsRange } from '../api/analytics'
import type { FocusSession } from '../api/focusSessions'

export interface AxisScale {
  axisMax: number
  ticks: number[]
}

export interface ActivityAxisScale extends AxisScale {
  unit: 'seconds' | 'minutes'
}

export function calculateActivityAxis(maxSeconds: number): ActivityAxisScale {
  if (maxSeconds > 0 && maxSeconds < 60) {
    const axisMax = [5, 10, 15, 30, 45, 60].find((limit) => maxSeconds <= limit) ?? 60
    return { axisMax, ticks: [0, axisMax / 2, axisMax], unit: 'seconds' }
  }
  return { ...calculateNiceAxis(Math.max(0, maxSeconds) / 60), unit: 'minutes' }
}

export function formatActivityAxisTick(value: number, unit: ActivityAxisScale['unit']): string {
  if (unit === 'seconds') return value === 0 ? '0s' : `${Number.isInteger(value) ? value : value.toFixed(1)}s`
  return formatAxisTick(value)
}

/**
 * Format a focus duration cleanly.
 * Never outputs '0m' for nonzero seconds.
 */
export function formatFocusDuration(
  seconds: number,
  options?: { showSecondsIfSmall?: boolean; precision?: number }
): string {
  if (!seconds || seconds <= 0) return '0m'
  if (seconds < 60) {
    return options?.showSecondsIfSmall ? `${Math.round(seconds)}s` : '<1m'
  }
  if (options?.showSecondsIfSmall && seconds < 600 && seconds % 60 !== 0) {
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  }
  const totalMinutes = seconds / 60
  if (totalMinutes < 60) {
    if (options?.precision && totalMinutes % 1 !== 0) {
      return `${totalMinutes.toFixed(options.precision)}m`
    }
    const mins = Math.round(totalMinutes)
    return `${mins}m`
  }
  const hours = Math.floor(totalMinutes / 60)
  const remainderMinutes = Math.round(totalMinutes % 60)
  if (remainderMinutes === 0) return `${hours}h`
  return `${hours}h ${remainderMinutes}m`
}

/**
 * Format a daily average without deceptive '0m' for small nonzero activity.
 */
export function formatDailyAverage(activeSeconds: number, dayCount: number): string {
  if (!activeSeconds || activeSeconds <= 0) return '0m'
  const count = Math.max(1, dayCount)
  const avgSeconds = activeSeconds / count
  if (avgSeconds < 60) {
    return `${Math.max(1, Math.round(avgSeconds))}s`
  }
  const avgMinutes = avgSeconds / 60
  if (avgMinutes < 10 && avgMinutes % 1 !== 0) {
    return `${avgMinutes.toFixed(1)}m`
  }
  return formatFocusDuration(avgSeconds)
}

/**
 * Calculate nice axis ticks without rounding fractional ticks into false integer labels.
 */
export function calculateNiceAxis(maxMinutes: number): AxisScale {
  if (maxMinutes <= 0) {
    return { axisMax: 10, ticks: [0, 5, 10] }
  }
  if (maxMinutes <= 1) {
    return { axisMax: 1, ticks: [0, 0.5, 1] }
  }
  if (maxMinutes <= 2) {
    return { axisMax: 2, ticks: [0, 1, 2] }
  }
  if (maxMinutes <= 5) {
    return { axisMax: 6, ticks: [0, 2, 4, 6] }
  }
  if (maxMinutes <= 10) {
    return { axisMax: 12, ticks: [0, 4, 8, 12] }
  }
  if (maxMinutes <= 20) {
    return { axisMax: 20, ticks: [0, 10, 20] }
  }
  if (maxMinutes <= 30) {
    return { axisMax: 30, ticks: [0, 15, 30] }
  }
  if (maxMinutes <= 60) {
    return { axisMax: 60, ticks: [0, 20, 40, 60] }
  }
  if (maxMinutes <= 120) {
    return { axisMax: 120, ticks: [0, 60, 120] }
  }
  if (maxMinutes <= 240) {
    return { axisMax: 240, ticks: [0, 120, 240] }
  }
  if (maxMinutes <= 480) {
    return { axisMax: 480, ticks: [0, 240, 480] }
  }

  const target = maxMinutes * 1.15
  const magnitude = Math.pow(10, Math.floor(Math.log10(target)))
  const normalized = target / magnitude
  let step = magnitude
  if (normalized <= 2) step = 0.5 * magnitude
  else if (normalized <= 5) step = 1 * magnitude
  else step = 2 * magnitude

  const tickCount = Math.max(3, Math.min(6, Math.ceil(target / step)))
  const axisMax = tickCount * step
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * step)
  return { axisMax, ticks }
}

/**
 * Format a y-axis tick label accurately.
 */
export function formatAxisTick(valueMinutes: number): string {
  if (valueMinutes === 0) return '0m'
  if (valueMinutes < 60) {
    return Number.isInteger(valueMinutes) ? `${valueMinutes}m` : `${valueMinutes.toFixed(1)}m`
  }
  const hours = Math.floor(valueMinutes / 60)
  const remainder = Math.round(valueMinutes % 60)
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}

/**
 * Derive date label (e.g. "Nov 8") using the local calendar boundary.
 */
export function formatCalendarDate(isoValue: string): string {
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Format date range for headers (e.g. "Nov 2 – Nov 8").
 * For daily and weekly ranges, formats the first day to the last inclusive day.
 */
export function formatDateRange(
  startIso: string,
  endIso: string,
  range: AnalyticsRange,
  lastBucketStartIso?: string
): string {
  if (range === '24h') {
    const s = new Date(startIso)
    const e = new Date(endIso)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return ''
    const sTime = s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    const eTime = e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${formatCalendarDate(startIso)} ${sTime} – ${formatCalendarDate(endIso)} ${eTime}`
  }

  const sLabel = formatCalendarDate(startIso)
  // For calendar views, endIso is the start of the next day (exclusive midnight).
  // The last inclusive day is lastBucketStartIso if provided, or endIso minus 1 day.
  const targetEndIso = lastBucketStartIso ?? endIso
  const eLabel = formatCalendarDate(targetEndIso)
  return `${sLabel} – ${eLabel}`
}

/**
 * Format bucket x-axis label.
 */
export function formatBucketLabel(
  startIso: string,
  range: AnalyticsRange,
  endIso?: string
): string {
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return ''

  if (range === '24h') {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (range === '7d') {
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
    const day = d.getDate()
    return `${weekday} ${day}`
  }
  if (range === '30d') {
    return formatCalendarDate(startIso)
  }
  // 90d weekly
  const sLabel = formatCalendarDate(startIso)
  if (endIso) {
    const e = new Date(endIso)
    // inclusive end is 1 day before endIso
    const inclusiveEnd = new Date(e.getTime() - 86400000)
    return `${sLabel} – ${formatCalendarDate(inclusiveEnd.toISOString())}`
  }
  return sLabel
}

/**
 * Calculate comparison metric between current and previous periods.
 */
export function calculateComparison(current: number, previous: number): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (current === previous) return { label: 'No change', tone: 'neutral' }
  if (previous === 0) return { label: 'New activity', tone: 'positive' }
  const delta = Math.round(((current - previous) / previous) * 100)
  return {
    label: `${delta > 0 ? '+' : ''}${delta}%`,
    tone: delta > 0 ? 'positive' : 'negative',
  }
}

/**
 * Generate period buckets for current and previous intervals based on local calendar dates.
 */
export function generatePeriodBuckets(
  range: AnalyticsRange,
  referenceDate?: Date
): {
  currentBuckets: AnalyticsActivityBucket[]
  previousBuckets: AnalyticsActivityBucket[]
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
  timezone: string
} {
  const ref = referenceDate ? new Date(referenceDate) : new Date()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  if (range === '24h') {
    const nowMs = ref.getTime()
    const bucketCount = 12
    const bucketSpanMs = 2 * 3600 * 1000
    const currentStartMs = nowMs - bucketCount * bucketSpanMs
    const previousStartMs = currentStartMs - bucketCount * bucketSpanMs

    const make24hBuckets = (startMs: number): AnalyticsActivityBucket[] =>
      Array.from({ length: bucketCount }, (_, i) => {
        const bStart = startMs + i * bucketSpanMs
        const bEnd = bStart + bucketSpanMs
        return {
          start: new Date(bStart).toISOString(),
          end: new Date(bEnd).toISOString(),
          activeSeconds: 0,
          completedSessions: 0,
        }
      })

    const currentBuckets = make24hBuckets(currentStartMs)
    const previousBuckets = make24hBuckets(previousStartMs)

    return {
      currentBuckets,
      previousBuckets,
      currentStart: new Date(currentStartMs).toISOString(),
      currentEnd: new Date(nowMs).toISOString(),
      previousStart: new Date(previousStartMs).toISOString(),
      previousEnd: new Date(currentStartMs).toISOString(),
      timezone,
    }
  }

  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()

  if (range === '7d' || range === '30d') {
    const days = range === '7d' ? 7 : 30

    const makeDayBuckets = (offsetDays: number): AnalyticsActivityBucket[] =>
      Array.from({ length: days }, (_, i) => {
        const dayFromEnd = days - 1 - i + offsetDays
        const bStart = new Date(y, m, d - dayFromEnd, 0, 0, 0, 0)
        const bEnd = new Date(y, m, d - dayFromEnd + 1, 0, 0, 0, 0)
        return {
          start: bStart.toISOString(),
          end: bEnd.toISOString(),
          activeSeconds: 0,
          completedSessions: 0,
        }
      })

    const currentBuckets = makeDayBuckets(0)
    const previousBuckets = makeDayBuckets(days)

    return {
      currentBuckets,
      previousBuckets,
      currentStart: currentBuckets[0].start,
      currentEnd: currentBuckets[days - 1].end,
      previousStart: previousBuckets[0].start,
      previousEnd: previousBuckets[days - 1].end,
      timezone,
    }
  }

  // range === '90d'
  // 90 calendar days total: 12 weeks of 7 days (84 days) + 1 week of 6 days (oldest week).
  // Total 13 weekly buckets.
  const weekSpans = [6, ...Array(12).fill(7)] // sum = 90
  const bucketCount = 13

  const make90dBuckets = (offsetDays: number): AnalyticsActivityBucket[] => {
    let daysBeforeToday = 90 + offsetDays
    return Array.from({ length: bucketCount }, (_, i) => {
      const span = weekSpans[i]
      const bStart = new Date(y, m, d - daysBeforeToday + 1, 0, 0, 0, 0)
      daysBeforeToday -= span
      const bEnd = new Date(y, m, d - daysBeforeToday + 1, 0, 0, 0, 0)
      return {
        start: bStart.toISOString(),
        end: bEnd.toISOString(),
        activeSeconds: 0,
        completedSessions: 0,
      }
    })
  }

  const currentBuckets = make90dBuckets(0)
  const previousBuckets = make90dBuckets(90)

  return {
    currentBuckets,
    previousBuckets,
    currentStart: currentBuckets[0].start,
    currentEnd: currentBuckets[bucketCount - 1].end,
    previousStart: previousBuckets[0].start,
    previousEnd: previousBuckets[bucketCount - 1].end,
    timezone,
  }
}

/**
 * Place completed focus sessions into period buckets.
 */
export function aggregateSessionsIntoPeriod(
  sessions: FocusSession[],
  range: AnalyticsRange,
  referenceDate?: Date
): AnalyticsPeriodResponse {
  const completed = sessions.filter((s) => s.status === 'COMPLETED')
  const period = generatePeriodBuckets(range, referenceDate)

  let currentActiveSeconds = 0
  let currentCompletedSessions = 0
  let previousActiveSeconds = 0
  let previousCompletedSessions = 0

  for (const session of completed) {
    const rawTime = session.endedAt ?? session.createdAt
    const endedMs = new Date(rawTime).getTime()
    if (Number.isNaN(endedMs)) continue

    // Check current buckets
    for (const b of period.currentBuckets) {
      const sMs = new Date(b.start).getTime()
      const eMs = new Date(b.end).getTime()
      if (endedMs >= sMs && endedMs < eMs) {
        b.activeSeconds += session.activeSeconds
        b.completedSessions += 1
        currentActiveSeconds += session.activeSeconds
        currentCompletedSessions += 1
        break
      }
    }

    // Check previous buckets
    for (const b of period.previousBuckets) {
      const sMs = new Date(b.start).getTime()
      const eMs = new Date(b.end).getTime()
      if (endedMs >= sMs && endedMs < eMs) {
        b.activeSeconds += session.activeSeconds
        b.completedSessions += 1
        previousActiveSeconds += session.activeSeconds
        previousCompletedSessions += 1
        break
      }
    }
  }

  return {
    range,
    timezone: period.timezone,
    currentStart: period.currentStart,
    currentEnd: period.currentEnd,
    previousStart: period.previousStart,
    previousEnd: period.previousEnd,
    currentBuckets: period.currentBuckets,
    previousBuckets: period.previousBuckets,
    currentActiveSeconds,
    currentCompletedSessions,
    previousActiveSeconds,
    previousCompletedSessions,
  }
}
