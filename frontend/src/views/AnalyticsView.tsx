import React, { useEffect, useState } from 'react'
import {
  fetchAnalyticsPeriod,
  type AnalyticsDashboardResponse,
  type AnalyticsPeriodResponse,
  type AnalyticsRange,
  type RecentDebrief,
} from '../api/analytics'
import { Icon } from '../components/common/Icon'
import { formatCount } from '../utils/pluralize'
import { trackRender } from '../utils/renderTracker'
import { buildAnalyticsCsv } from '../utils/analyticsCsv'
import { buildFocusContributionData } from '../utils/focusContributionData'
import { FocusContributionSkyline } from '../components/analytics/FocusContributionSkyline'
import {
  calculateActivityAxis,
  formatActivityAxisTick,
  formatFocusDuration,
  formatDailyAverage,
  formatDateRange,
  formatBucketLabel,
  formatCalendarDate,
  calculateComparison,
} from '../utils/analyticsEngine'

export interface AnalyticsViewProps {
  analyticsData: AnalyticsDashboardResponse | null
  analyticsLoading: boolean
  analyticsError: boolean
  loadAnalytics: () => void
  onNavigateFocus: () => void
  userId?: number | null
}

const ranges: AnalyticsRange[] = ['24h', '7d', '30d', '90d']
const labels: Record<AnalyticsRange, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const formatCompletedAt = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Completion date unavailable'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

interface TooltipState {
  index: number
  x: number
  y: number
  title: string
  currentDuration: string
  currentSessions: number
  previousDuration: string
}

function ActivityChart({
  data,
  range,
  onNavigateFocus,
}: {
  data: AnalyticsPeriodResponse
  range: AnalyticsRange
  onNavigateFocus: () => void
}) {
  const current = data?.currentBuckets ?? []
  const previous = data?.previousBuckets ?? []
  const count = Math.max(current.length, previous.length)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const currentSeconds = current.map((b) => b.activeSeconds || 0)
  const previousSeconds = previous.map((b) => b.activeSeconds || 0)
  const maxSeconds = Math.max(...currentSeconds, ...previousSeconds, 0)
  const { axisMax, ticks, unit: axisUnit } = calculateActivityAxis(maxSeconds)

  // Chart coordinate boundaries (viewBox 0 0 920 280)
  const left = 56
  const right = 890
  const top = 22
  const bottom = 236
  const plotWidth = right - left
  const plotHeight = bottom - top

  const slotWidth = count > 0 ? plotWidth / count : plotWidth
  const barWidth =
    range === '7d'
      ? Math.min(52, Math.max(28, slotWidth * 0.44))
      : range === '24h'
      ? Math.min(36, Math.max(18, slotWidth * 0.52))
      : range === '30d'
      ? Math.min(16, Math.max(8, slotWidth * 0.6))
      : Math.min(38, Math.max(16, slotWidth * 0.52))

  const yCoord = (tickValue: number) => bottom - plotHeight * Math.min(1, Math.max(0, axisMax > 0 ? tickValue / axisMax : 0))

  const allZero = maxSeconds === 0

  const currentRangeLabel = formatDateRange(
    data.currentStart,
    data.currentEnd,
    range,
    current[current.length - 1]?.start
  )
  const prevRangeLabel = formatDateRange(
    data.previousStart,
    data.previousEnd,
    range,
    previous[previous.length - 1]?.start
  )

  const handlePointerEnter = (i: number, bx: number, by: number) => {
    const bucket = current[i]
    const prevBucket = previous[i]
    const title = formatBucketLabel(bucket?.start ?? '', range, bucket?.end)
    const currentDuration = formatFocusDuration(bucket?.activeSeconds ?? 0, { showSecondsIfSmall: true })
    const currentSessions = bucket?.completedSessions ?? 0
    const previousDuration = formatFocusDuration(prevBucket?.activeSeconds ?? 0, { showSecondsIfSmall: true })

    setTooltip({
      index: i,
      x: bx + barWidth / 2,
      y: Math.max(top + 10, by - 12),
      title,
      currentDuration,
      currentSessions,
      previousDuration,
    })
  }

  const handlePointerLeave = () => {
    setTooltip(null)
  }

  // Determine x-axis label visibility to prevent overlap
  const shouldShowLabel = (i: number): boolean => {
    if (range === '7d') return true
    if (range === '24h') return i % 2 === 0 || i === count - 1
    if (range === '30d') return i % 5 === 0 || i === count - 1
    // 90d (13 weeks)
    return i % 2 === 0 || i === count - 1
  }

  return (
    <div className="analytics-chart-wrap" onMouseLeave={handlePointerLeave}>
      <div className="analytics-chart-legend">
        <span>
          <i className="is-current" />
          Current · {currentRangeLabel}
        </span>
        <span>
          <i className="is-previous" />
          Previous · {prevRangeLabel}
        </span>
      </div>

      <div className="analytics-chart-canvas-container">
        <svg
          className="analytics-activity-chart"
          viewBox="0 0 920 280"
          role="img"
          aria-label={`${labels[range]} Focus activity compared with the immediately preceding period. Current total ${formatFocusDuration(data.currentActiveSeconds, { showSecondsIfSmall: true })}.`}
        >
          <defs>
            <linearGradient id="analytics-bar-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--analytics-chart-bar)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--analytics-chart-bar)" stopOpacity="0.82" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels */}
          {ticks.map((tick) => {
            const yy = yCoord(tick)
            return (
              <g key={`tick-${tick}`}>
                <line x1={left} x2={right} y1={yy} y2={yy} className="analytics-chart-gridline" />
                <text x={left - 10} y={yy + 4} textAnchor="end" className="analytics-chart-axis">
                  {formatActivityAxisTick(tick, axisUnit)}
                </text>
              </g>
            )
          })}

          {/* Baseline zero line */}
          <line x1={left} x2={right} y1={bottom} y2={bottom} className="analytics-chart-baseline" />

          {/* Data Buckets */}
          {Array.from({ length: count }, (_, i) => {
            const slotCenter = left + i * slotWidth + slotWidth / 2
            const bx = slotCenter - barWidth / 2
            const cSeconds = currentSeconds[i] ?? 0
            const pSeconds = previousSeconds[i] ?? 0
            const b = current[i]

            const axisMaxSeconds = axisUnit === 'minutes' ? axisMax * 60 : axisMax
            const cHeight = axisMaxSeconds > 0 ? (cSeconds / axisMaxSeconds) * plotHeight : 0
            const pHeight = axisMaxSeconds > 0 ? (pSeconds / axisMaxSeconds) * plotHeight : 0

            const currentBarHeight = cSeconds > 0 ? Math.min(plotHeight, Math.max(4, cHeight)) : 2
            const currentBarY = bottom - currentBarHeight

            const prevBarHeight = pSeconds > 0 ? Math.min(plotHeight, Math.max(4, pHeight)) : 0
            const prevBarY = bottom - prevBarHeight

            const labelText = formatBucketLabel(b?.start ?? '', range, b?.end)
            const showLabel = shouldShowLabel(i)

            const ariaLabel = `${labelText}: ${formatFocusDuration(b?.activeSeconds ?? 0, { showSecondsIfSmall: true })} focus, ${b?.completedSessions ?? 0} sessions.`

            return (
              <g key={`bucket-${i}`} className="analytics-bucket-group">
                {/* Previous period benchmark ghost bar */}
                {pSeconds > 0 && (
                  <rect
                    x={bx - 2}
                    y={prevBarY}
                    width={barWidth + 4}
                    height={prevBarHeight}
                    rx="5"
                    className="analytics-bar-previous"
                    aria-hidden="true"
                  />
                )}

                {/* Current period bar or subtle zero slot indicator */}
                <rect
                  x={bx}
                  y={currentBarY}
                  width={barWidth}
                  height={currentBarHeight}
                    rx={cSeconds > 0 ? 5 : 1}
                    className={cSeconds > 0 ? 'analytics-bar-current' : 'analytics-bar-zero'}
                  tabIndex={0}
                  role="graphics-symbol"
                  aria-label={ariaLabel}
                  onMouseEnter={() => handlePointerEnter(i, bx, currentBarY)}
                  onFocus={() => handlePointerEnter(i, bx, currentBarY)}
                  onBlur={handlePointerLeave}
                >
                  <title>{ariaLabel}</title>
                </rect>

                {/* X-Axis Tick Label */}
                {showLabel && (
                  <text
                    x={slotCenter}
                    y={bottom + 22}
                    textAnchor="middle"
                    className="analytics-chart-axis-x"
                  >
                    {labelText}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Informative overlay when period has zero activity */}
        {allZero && (
          <div className="analytics-activity-zero-overlay" role="status">
            <span className="analytics-zero-copy">No Focus time recorded in this period yet.</span>
            <button type="button" className="analytics-zero-btn" onClick={onNavigateFocus}>
              Start a Focus session
            </button>
          </div>
        )}

        {/* Interactive Floating Tooltip */}
        {tooltip && (
          <div
            className="analytics-chart-tooltip"
            style={{
              left: `${(tooltip.x / 920) * 100}%`,
              top: `${(tooltip.y / 280) * 100}%`,
            }}
            role="tooltip"
            aria-live="polite"
          >
            <div className="analytics-tooltip-title">{tooltip.title}</div>
            <div className="analytics-tooltip-row">
              <span className="analytics-tooltip-badge is-current" />
              <span className="analytics-tooltip-label">Current:</span>
              <strong>{tooltip.currentDuration}</strong>
              <small>({tooltip.currentSessions} {tooltip.currentSessions === 1 ? 'session' : 'sessions'})</small>
            </div>
            {tooltip.previousDuration !== '0m' && (
              <div className="analytics-tooltip-row is-prev">
                <span className="analytics-tooltip-badge is-prev" />
                <span className="analytics-tooltip-label">Previous:</span>
                <span>{tooltip.previousDuration}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FocusedDays({ analyticsData }: { analyticsData: AnalyticsDashboardResponse | null }) {
  const days = [...(analyticsData?.weeklyVelocity ?? [])]
    .filter((day) => (day.focusSeconds ?? day.focusMinutes * 60) > 0)
    .sort((left, right) => (right.focusSeconds ?? right.focusMinutes * 60) - (left.focusSeconds ?? left.focusMinutes * 60))
    .slice(0, 3)
  const maxSeconds = Math.max(...days.map((day) => day.focusSeconds ?? day.focusMinutes * 60), 1)

  return (
    <section className="analytics-panel analytics-focused-days" aria-labelledby="analytics-focused-days-title">
      <div className="analytics-panel-heading">
        <div>
          <h2 id="analytics-focused-days-title">Most focused days</h2>
          <p>Based on your recorded Focus time this week.</p>
        </div>
      </div>
      {days.length > 0 ? (
        <ol className="analytics-focused-days-list">
          {days.map((day, index) => (
            <li key={day.date}>
              <span className="analytics-focused-rank">{index + 1}</span>
              <span className="analytics-focused-date">{formatCalendarDate(day.date)}</span>
              <span className="analytics-focused-track" aria-hidden="true">
                <span style={{ width: `${((day.focusSeconds ?? day.focusMinutes * 60) / maxSeconds) * 100}%` }} />
              </span>
              <strong>{formatFocusDuration(day.focusSeconds ?? day.focusMinutes * 60, { showSecondsIfSmall: true })}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="analytics-focused-empty">Your focused days will appear here after you complete a session.</p>
      )}
    </section>
  )
}

function Reflection({ entry }: { entry: RecentDebrief }) {
  const rating = Math.min(5, Math.max(0, entry.quality ?? 0))
  return (
    <article className="analytics-debrief-card">
      <div className="analytics-debrief-main">
        <div className="analytics-debrief-title">{entry.sessionName}</div>
        <time className="analytics-debrief-date" dateTime={entry.completedAt}>
          {formatCompletedAt(entry.completedAt)}
        </time>
        <details className="analytics-reflection-details">
          <summary>
            {entry.accomplishment || entry.reflectionNote ? 'Read reflection' : 'View session details'}
          </summary>
          {entry.accomplishment && (
            <p>
              <strong>Outcome</strong>
              <span>{entry.accomplishment}</span>
            </p>
          )}
          {entry.reflectionNote && (
            <p>
              <strong>Reflection</strong>
              <span>{entry.reflectionNote}</span>
            </p>
          )}
          {!entry.accomplishment && !entry.reflectionNote && entry.intention && (
            <p>
              <strong>Intention</strong>
              <span>{entry.intention}</span>
            </p>
          )}
        </details>
      </div>
      <div className="analytics-debrief-meta">
        <span className="analytics-duration-chip">
          <strong>{formatFocusDuration(entry.actualFocusSeconds ?? entry.actualFocusMinutes * 60, { showSecondsIfSmall: true })}</strong>
          <small>actual focus</small>
        </span>
        <span className="analytics-duration-chip analytics-planned-chip">
          <strong>{formatFocusDuration(entry.durationMinutes * 60)}</strong>
          <small>planned</small>
        </span>
        <span
          className="analytics-quality"
          aria-label={entry.quality != null ? `Rated ${rating} out of 5` : 'Not rated'}
        >
          {entry.quality != null ? (
            <><Icon name="star" size={14} /><small>{rating}/5</small></>
          ) : (
            'Not rated'
          )}
        </span>
      </div>
    </article>
  )
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analyticsData,
  analyticsLoading,
  analyticsError,
  loadAnalytics,
  onNavigateFocus,
  userId,
}) => {
  trackRender('AnalyticsView')
  const storageKey = userId == null ? null : `shinpo_analytics_range_${userId}`
  const [range, setRange] = useState<AnalyticsRange>(() => {
    const stored = storageKey ? localStorage.getItem(storageKey) : null
    return ranges.includes(stored as AnalyticsRange) ? (stored as AnalyticsRange) : '7d'
  })
  const [period, setPeriod] = useState<AnalyticsPeriodResponse | null>(null)
  const [periodErrorFor, setPeriodErrorFor] = useState<AnalyticsRange | null>(null)
  const [contributionData, setContributionData] = useState<ReturnType<typeof buildFocusContributionData> | null>(null)
  const [contributionError, setContributionError] = useState(false)
  const [contributionRefresh, setContributionRefresh] = useState(0)

  useEffect(() => {
    let cancelled = false
    import('../api/focusSessions.ts').then(({ getFocusSessions }) => getFocusSessions())
      .then((sessions) => {
        if (!cancelled) {
          setContributionData(buildFocusContributionData(sessions))
          setContributionError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setContributionError(true)
      })
    return () => { cancelled = true }
  }, [userId, contributionRefresh])

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, range)
    const controller = new AbortController()
    fetchAnalyticsPeriod(range, controller.signal)
      .then((result) => setPeriod(result))
      .catch(() => {
        if (!controller.signal.aborted) setPeriodErrorFor(range)
      })
    return () => controller.abort()
  }, [range, storageKey])

  const visiblePeriod = period?.range === range ? period : null
  const periodLoading = !visiblePeriod && periodErrorFor !== range
  const periodError = periodErrorFor === range

  const dayCount = range === '24h' ? 1 : Number(range.replace('d', ''))
  const dailyAverage = visiblePeriod
    ? formatDailyAverage(visiblePeriod.currentActiveSeconds, dayCount)
    : '—'

  const strongest =
    visiblePeriod?.currentBuckets?.reduce<(typeof visiblePeriod.currentBuckets)[number] | null>(
      (best, item) => (!best || item.activeSeconds > best.activeSeconds ? item : best),
      null
    ) ?? null

  const completedRate = analyticsData?.summary?.completionRate ?? null
  const chartCurrent = calculateComparison(
    visiblePeriod?.currentActiveSeconds ?? 0,
    visiblePeriod?.previousActiveSeconds ?? 0
  )
  const chartSessions = calculateComparison(
    visiblePeriod?.currentCompletedSessions ?? 0,
    visiblePeriod?.previousCompletedSessions ?? 0
  )

  const exportCsv = () => {
    if (!visiblePeriod) return
    const blob = new Blob([buildAnalyticsCsv(visiblePeriod)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `shinpo-analytics-${range}-${new Date(visiblePeriod.currentEnd).toISOString().slice(0, 10)}.csv`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const refresh = () => {
    loadAnalytics()
    setContributionRefresh((value) => value + 1)
    setPeriod(null)
    setPeriodErrorFor(null)
    fetchAnalyticsPeriod(range).then(setPeriod).catch(() => setPeriodErrorFor(range))
  }

  const currentHeaderRange = visiblePeriod
    ? formatDateRange(
        visiblePeriod.currentStart,
        visiblePeriod.currentEnd,
        range,
        visiblePeriod.currentBuckets[visiblePeriod.currentBuckets.length - 1]?.start
      )
    : ''

  return (
    <main className="analytics-view" aria-busy={analyticsLoading}>
      <header className="analytics-page-heading">
        <div className="analytics-heading-copy">
          <span className="analytics-heading-icon">
            <Icon name="analytics" size={21} />
          </span>
          <div>
            <h1>Analytics</h1>
            <p>
              {visiblePeriod
                ? `${labels[range]} · ${currentHeaderRange}, compared with the prior ${range}.`
                : 'A clear view of your focus, consistency, and completed work.'}
            </p>
          </div>
        </div>
        <div className="analytics-heading-actions">
          <div className="analytics-range-selector" role="group" aria-label="Analytics period">
            {ranges.map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={range === value}
                className={range === value ? 'is-selected' : ''}
                onClick={() => {
                  setPeriodErrorFor(null)
                  setRange(value)
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <button type="button" className="analytics-export-button" onClick={exportCsv} disabled={!visiblePeriod}>
            Export CSV
          </button>
          <button
            type="button"
            className="analytics-refresh-button"
            onClick={refresh}
            disabled={analyticsLoading || periodLoading}
          >
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        </div>
      </header>

      {analyticsError && (
        <div className="analytics-load-state" role="alert">
          <span>
            {analyticsData
              ? 'Analytics could not be refreshed. Showing the last loaded values.'
              : 'Analytics could not be loaded. Your saved data has not been changed.'}
          </span>
          <button type="button" onClick={loadAnalytics} disabled={analyticsLoading}>
            Try again
          </button>
        </div>
      )}
      {!analyticsData && analyticsLoading && (
        <p className="analytics-load-state is-loading" role="status">
          Loading saved analytics…
        </p>
      )}

      <section className="analytics-metrics-grid" aria-label="Analytics summary">
        <article className="analytics-card analytics-card-focus">
          <span className="analytics-metric-icon is-blue">
            <Icon name="clock" size={21} />
          </span>
          <div className="analytics-metric-content">
            <div className="analytics-metric-heading">
              <span>Focus time</span>
            </div>
            <strong>
              {visiblePeriod
                ? formatFocusDuration(visiblePeriod.currentActiveSeconds, { showSecondsIfSmall: true })
                : '—'}
            </strong>
            <div className="analytics-metric-support">
              <small>{labels[range]} · active time</small>
              {visiblePeriod && <span className={`analytics-comparison is-${chartCurrent.tone}`}>{chartCurrent.label}</span>}
            </div>
          </div>
        </article>

        <article className="analytics-card">
          <span className="analytics-metric-icon is-blue">
            <Icon name="analytics" size={21} />
          </span>
          <div className="analytics-metric-content">
            <div className="analytics-metric-heading">
              <span>Completed sessions</span>
            </div>
            <strong>{visiblePeriod?.currentCompletedSessions ?? '—'}</strong>
            <div className="analytics-metric-support">
              <small>In {range}</small>
              {visiblePeriod && (
                <span className={`analytics-comparison is-${chartSessions.tone}`}>{chartSessions.label}</span>
              )}
            </div>
          </div>
        </article>

        <article className="analytics-card">
          <span className="analytics-metric-icon is-green">
            <Icon name="check" size={21} />
          </span>
          <div className="analytics-metric-content">
            <div className="analytics-metric-heading">
              <span>Tasks completed</span>
            </div>
            <strong>
              {analyticsData ? (
                <>
                  {analyticsData.summary.missionsCompleted}
                  <i> / {analyticsData.summary.missionsTotal}</i>
                </>
              ) : (
                '—'
              )}
            </strong>
            <div className="analytics-metric-support">
              <small>Current completed tasks · all time</small>
            </div>
          {completedRate != null && <div
              className="analytics-task-progress"
              role="img"
              aria-label={`${completedRate}% of all tasks completed`}
            >
              <span
                style={{
                  transform: `scaleX(${Math.min(100, Math.max(0, completedRate ?? 0)) / 100})`,
                }}
              />
            </div>}
          </div>
        </article>

        <article className="analytics-card">
          <span className="analytics-metric-icon is-success">
            <Icon name="sparkle" size={21} />
          </span>
          <div className="analytics-metric-content">
            <div className="analytics-metric-heading">
              <span>Focus consistency</span>
            </div>
            <strong>
              {analyticsData ? formatCount(analyticsData.summary.currentStreak, 'day') : '—'}
            </strong>
            <div className="analytics-metric-support">
              <small>Consecutive days with completed Focus</small>
            </div>
          </div>
        </article>
      </section>

      {contributionData ? (
        <FocusContributionSkyline data={contributionData} />
      ) : (
        <section className="analytics-panel focus-contribution-skyline" aria-live="polite" aria-busy={!contributionError}>
          <h2>Focus contribution skyline</h2>
          <p>{contributionError ? 'Yearly Focus history could not be loaded.' : 'Loading your Focus history…'}</p>
          {contributionError && <button type="button" onClick={() => { setContributionError(false); setContributionRefresh((value) => value + 1); }}>Try again</button>}
        </section>
      )}

      <section className="analytics-main-grid">
        <article className="analytics-panel analytics-activity-panel">
          <div className="analytics-panel-heading">
            <div>
              <span className="analytics-eyebrow">{labels[range]}</span>
              <h2>Focus activity</h2>
              <p>Actual active Focus time · verified records</p>
            </div>
            <div className="analytics-chart-total">
              <strong>
                {period
                  ? formatFocusDuration(period.currentActiveSeconds, { showSecondsIfSmall: true })
                  : '—'}
              </strong>
              <small>in this period</small>
            </div>
          </div>
          {visiblePeriod ? (
            <ActivityChart data={visiblePeriod} range={range} onNavigateFocus={onNavigateFocus} />
          ) : (
            <div className="analytics-chart-placeholder" aria-live="polite">
              {periodError ? (
                <>
                  <span>Analytics could not load.</span>
                  <button type="button" onClick={refresh}>
                    Try again
                  </button>
                </>
              ) : (
                'Loading activity…'
              )}
            </div>
          )}
        </article>

        <aside className="analytics-panel analytics-insights-panel">
          <div className="analytics-panel-heading">
            <div>
              <span className="analytics-eyebrow">Selected period</span>
              <h2>Your rhythm</h2>
            </div>
            <span className="analytics-rhythm-icon">
              <Icon name="analytics" size={17} />
            </span>
          </div>
          <div className="analytics-week-stat">
            <span>Completed Focus sessions</span>
            <strong>{visiblePeriod?.currentCompletedSessions ?? '—'}</strong>
          </div>
          <div className="analytics-week-stat">
            <span>Daily average</span>
            <strong>{dailyAverage}</strong>
          </div>
          <div className="analytics-week-stat">
            <span>Strongest {range === '24h' ? 'block' : range === '90d' ? 'week' : 'day'}</span>
            <strong>
              {strongest && strongest.activeSeconds > 0
                ? `${formatBucketLabel(strongest.start, range, strongest.end)} (${formatFocusDuration(strongest.activeSeconds)})`
                : '—'}
            </strong>
          </div>
          <div className="analytics-week-stat">
            <span>Average session rating · all time</span>
            <strong>
              {analyticsData?.summary.avgQuality != null
                ? `${analyticsData.summary.avgQuality.toFixed(1)} / 5`
                : '—'}
            </strong>
          </div>
          <div className="analytics-week-progress">
            <div className="analytics-week-progress-heading">
              <span>Tasks completed · all time</span>
              <strong>{completedRate == null ? 'No tasks' : `${completedRate}%`}</strong>
            </div>
            {completedRate != null && <div className="analytics-progress-track">
              <span style={{ transform: `scaleX(${Math.min(100, Math.max(0, completedRate)) / 100})` }} />
            </div>}
          </div>
          <p className="analytics-week-note">
            Period comparisons use the immediately preceding interval of equal duration. Daily buckets derive from your local calendar days.
          </p>
        </aside>
      </section>

      <section className="analytics-lower-grid" aria-label="Focus history">
        <FocusedDays analyticsData={analyticsData} />
        <section className="analytics-panel analytics-recent-panel" aria-labelledby="analytics-reflections-title">
          <div className="analytics-panel-heading">
            <div>
              <h2 id="analytics-reflections-title">Recent reflections</h2>
              <p>Outcomes and notes from completed Focus sessions.</p>
            </div>
            <span className="analytics-recent-count">
              {analyticsData?.recentDebriefs?.length ?? 0}{' '}
              {(analyticsData?.recentDebriefs?.length ?? 0) === 1 ? 'session' : 'sessions'}
            </span>
          </div>
          <div className="analytics-debrief-list">
            {analyticsData?.recentDebriefs?.length ? (
              analyticsData.recentDebriefs.map((entry) => <Reflection key={entry.sessionId} entry={entry} />)
            ) : (
              <div className="analytics-debrief-empty">Completed session reflections will appear here.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
