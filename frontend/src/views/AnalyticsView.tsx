import React, { useEffect, useState } from 'react'
import { fetchAnalyticsPeriod, type AnalyticsDashboardResponse, type AnalyticsPeriodResponse, type AnalyticsRange, type RecentDebrief } from '../api/analytics'
import { Icon } from '../components/common/Icon'
import { formatCount } from '../utils/pluralize'
import { trackRender } from '../utils/renderTracker'
import { buildAnalyticsCsv } from '../utils/analyticsCsv'

export interface AnalyticsViewProps {
  analyticsData: AnalyticsDashboardResponse | null
  analyticsLoading: boolean
  analyticsError: boolean
  loadAnalytics: () => void
  onNavigateFocus: () => void
  userId?: number | null
}

const ranges: AnalyticsRange[] = ['24h', '7d', '30d', '90d']
const labels: Record<AnalyticsRange, string> = { '24h': 'Last 24 hours', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' }
const minutes = (seconds: number) => Math.round(seconds / 60)
const formatDuration = (seconds: number) => {
  const value = minutes(seconds)
  const hours = Math.floor(value / 60)
  const remainder = value % 60
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${value}m`
}
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const bucketLabel = (value: string, range: AnalyticsRange) => range === '24h'
  ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  : dateLabel(value)
const formatCompletedAt = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Completion date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function comparison(current: number, previous: number) {
  if (current === previous) return { label: 'No change', tone: 'neutral' }
  if (previous === 0) return { label: 'New activity', tone: 'positive' }
  const delta = Math.round(((current - previous) / previous) * 100)
  return { label: `${delta > 0 ? '+' : ''}${delta}%`, tone: delta > 0 ? 'positive' : 'negative' }
}

function ActivityChart({ data, range, onNavigateFocus }: { data: AnalyticsPeriodResponse; range: AnalyticsRange; onNavigateFocus: () => void }) {
  const current = data?.currentBuckets ?? []
  const previous = data?.previousBuckets ?? []
  const count = Math.max(current.length, previous.length)
  const currentValues = Array.from({ length: count }, (_, i) => minutes(current[i]?.activeSeconds ?? 0))
  const previousValues = Array.from({ length: count }, (_, i) => minutes(previous[i]?.activeSeconds ?? 0))
  const maxValue = Math.max(...currentValues, ...previousValues, 0)
  const axisMax = maxValue === 0 ? 5 : Math.max(5, Math.ceil(maxValue * 1.2 / 5) * 5)
  const left = 52, right = 884, top = 18, bottom = 222
  const x = (i: number) => count === 1 ? (left + right) / 2 : left + (right - left) * i / (count - 1)
  const y = (value: number) => bottom - (bottom - top) * value / axisMax
  const line = (values: number[]) => values.map((value, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(value)}`).join(' ')
  const area = `${line(currentValues)} L ${x(count - 1)} ${bottom} L ${x(0)} ${bottom} Z`
  const allZero = maxValue === 0
  if (allZero || count === 0) return <div className="analytics-activity-empty" role="status">
    <span>No completed Focus time in this period yet.</span>
    <button type="button" onClick={onNavigateFocus}>Start a Focus session</button>
  </div>
  const labelIndexes = Array.from(new Set([0, Math.floor((count - 1) / 2), count - 1]))
  const currentPeriod = `${dateLabel(data.currentStart)} – ${dateLabel(data.currentEnd)}`
  const previousPeriod = `${dateLabel(data.previousStart)} – ${dateLabel(data.previousEnd)}`

  return <div className="analytics-chart-wrap">
    <div className="analytics-chart-legend"><span><i className="is-current" />Current · {currentPeriod}</span><span><i className="is-previous" />Previous · {previousPeriod}</span></div>
    <svg className="analytics-activity-chart" viewBox="0 0 920 270" role="img" aria-label={`${labels[range]} Focus activity compared with the immediately preceding period. Current total ${formatDuration(data.currentActiveSeconds)}.`}>
      <defs><linearGradient id="analytics-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-primary)" stopOpacity=".34" /><stop offset="100%" stopColor="var(--color-primary)" stopOpacity=".015" /></linearGradient></defs>
      {[0, .5, 1].map((fraction) => {
        const value = axisMax * fraction
        const yy = y(value)
        return <g key={fraction}><line x1={left} x2={right} y1={yy} y2={yy} className="analytics-chart-gridline" /><text x="42" y={yy + 4} textAnchor="end" className="analytics-chart-axis">{Math.round(value)}m</text></g>
      })}
      <>
        <path d={area} fill="url(#analytics-area)" />
        <path d={line(previousValues)} className="analytics-line-previous" />
        <path d={line(currentValues)} className="analytics-line-current" />
        {currentValues.map((value, i) => <circle key={`c${i}`} cx={x(i)} cy={y(value)} r="4" className="analytics-point-current" tabIndex={0} aria-label={`${bucketLabel(current[i]?.start, range)} current: ${value} focus minutes, ${current[i]?.completedSessions ?? 0} completed sessions`}><title>{`${bucketLabel(current[i]?.start, range)} · ${value}m · ${current[i]?.completedSessions ?? 0} sessions`}</title></circle>)}
        {previousValues.map((value, i) => <circle key={`p${i}`} cx={x(i)} cy={y(value)} r="3" className="analytics-point-previous" tabIndex={0} aria-label={`${bucketLabel(previous[i]?.start, range)} previous: ${value} focus minutes, ${previous[i]?.completedSessions ?? 0} completed sessions`}><title>{`${bucketLabel(previous[i]?.start, range)} · previous ${value}m`}</title></circle>)}
      </>
      {labelIndexes.map((index) => <text key={index} x={x(index)} y="252" textAnchor={index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle'} className="analytics-chart-axis">{bucketLabel(current[index]?.start, range)}</text>)}
    </svg>
  </div>
}

function FocusedDays({ analyticsData }: { analyticsData: AnalyticsDashboardResponse | null }) {
  const days = [...(analyticsData?.weeklyVelocity ?? [])]
    .filter((day) => day.focusMinutes > 0)
    .sort((left, right) => right.focusMinutes - left.focusMinutes)
    .slice(0, 3)
  const maxMinutes = Math.max(...days.map((day) => day.focusMinutes), 1)

  return <section className="analytics-panel analytics-focused-days" aria-labelledby="analytics-focused-days-title">
    <div className="analytics-panel-heading"><div><h2 id="analytics-focused-days-title">Most focused days</h2><p>Based on your recorded Focus time this week.</p></div></div>
    {days.length > 0 ? <ol className="analytics-focused-days-list">
      {days.map((day, index) => <li key={day.date}>
        <span className="analytics-focused-rank">{index + 1}</span>
        <span className="analytics-focused-date">{dateLabel(day.date)}</span>
        <span className="analytics-focused-track" aria-hidden="true"><span style={{ width: `${day.focusMinutes / maxMinutes * 100}%` }} /></span>
        <strong>{formatDuration(day.focusMinutes * 60)}</strong>
      </li>)}
    </ol> : <p className="analytics-focused-empty">Your focused days will appear here after you complete a session.</p>}
  </section>
}

function Reflection({ entry }: { entry: RecentDebrief }) {
  const rating = Math.min(5, Math.max(0, entry.quality ?? 0))
  return <article className="analytics-debrief-card">
    <div className="analytics-debrief-main">
      <div className="analytics-debrief-title">{entry.sessionName}</div>
      <time className="analytics-debrief-date" dateTime={entry.completedAt}>{formatCompletedAt(entry.completedAt)}</time>
      <details className="analytics-reflection-details">
        <summary>{entry.accomplishment || entry.reflectionNote ? 'Read reflection' : 'View session details'}</summary>
        {entry.accomplishment && <p><strong>Outcome</strong><span>{entry.accomplishment}</span></p>}
        {entry.reflectionNote && <p><strong>Reflection</strong><span>{entry.reflectionNote}</span></p>}
        {!entry.accomplishment && !entry.reflectionNote && entry.intention && <p><strong>Intention</strong><span>{entry.intention}</span></p>}
      </details>
    </div>
    <div className="analytics-debrief-meta">
      <span className="analytics-duration-chip"><strong>{formatDuration(entry.actualFocusMinutes * 60)}</strong><small>actual focus</small></span>
      <span className="analytics-duration-chip analytics-planned-chip"><strong>{formatDuration(entry.durationMinutes * 60)}</strong><small>planned</small></span>
      <span className="analytics-quality" aria-label={entry.quality != null ? `Rated ${rating} out of 5` : 'Not rated'}>{entry.quality != null ? <><span className="analytics-quality-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Icon key={index} name="star" size={12} className={index < rating ? 'is-filled' : undefined} />)}</span><small>{rating}/5</small></> : 'Not rated'}</span>
    </div>
  </article>
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analyticsData, analyticsLoading, analyticsError, loadAnalytics, onNavigateFocus, userId }) => {
  trackRender('AnalyticsView')
  const storageKey = userId == null ? null : `shinpo_analytics_range_${userId}`
  const [range, setRange] = useState<AnalyticsRange>(() => {
    const stored = storageKey ? localStorage.getItem(storageKey) : null
    return ranges.includes(stored as AnalyticsRange) ? stored as AnalyticsRange : '7d'
  })
  const [period, setPeriod] = useState<AnalyticsPeriodResponse | null>(null)
  const [periodErrorFor, setPeriodErrorFor] = useState<AnalyticsRange | null>(null)

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, range)
    const controller = new AbortController()
    fetchAnalyticsPeriod(range, controller.signal).then((result) => setPeriod(result)).catch(() => {
      if (!controller.signal.aborted) setPeriodErrorFor(range)
    })
    return () => controller.abort()
  }, [range, storageKey])

  const visiblePeriod = period?.range === range ? period : null
  const periodLoading = !visiblePeriod && periodErrorFor !== range
  const periodError = periodErrorFor === range
  const dailyAverage = visiblePeriod ? formatDuration(visiblePeriod.currentActiveSeconds / (range === '24h' ? 1 : Number(range.replace('d', '')))) : '—'
  const strongest = visiblePeriod?.currentBuckets?.reduce<(typeof visiblePeriod.currentBuckets)[number] | null>((best, item) => !best || item.activeSeconds > best.activeSeconds ? item : best, null) ?? null
  const completedRate = analyticsData?.summary?.completionRate ?? null
  const chartCurrent = comparison(visiblePeriod?.currentActiveSeconds ?? 0, visiblePeriod?.previousActiveSeconds ?? 0)
  const chartSessions = comparison(visiblePeriod?.currentCompletedSessions ?? 0, visiblePeriod?.previousCompletedSessions ?? 0)

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
    setPeriod(null)
    setPeriodErrorFor(null)
    fetchAnalyticsPeriod(range).then(setPeriod).catch(() => setPeriodErrorFor(range))
  }

  return <main className="analytics-view" aria-busy={analyticsLoading}>
    <header className="analytics-page-heading">
      <div className="analytics-heading-copy"><span className="analytics-heading-icon"><Icon name="analytics" size={21} /></span><div><h1>Analytics</h1>
        <p>{visiblePeriod ? `${labels[range]} · ${dateLabel(visiblePeriod.currentStart)} – ${dateLabel(visiblePeriod.currentEnd)} UTC, compared with the prior ${range}.` : 'A clear view of your focus, consistency, and completed work.'}</p>
      </div></div>
      <div className="analytics-heading-actions">
        <div className="analytics-range-selector" role="group" aria-label="Analytics period">
          {ranges.map((value) => <button type="button" key={value} aria-pressed={range === value} className={range === value ? 'is-selected' : ''} onClick={() => { setPeriodErrorFor(null); setRange(value) }}>{value}</button>)}
        </div>
        <button type="button" className="analytics-export-button" onClick={exportCsv} disabled={!visiblePeriod}>Export CSV</button>
        <button type="button" className="analytics-refresh-button" onClick={refresh} disabled={analyticsLoading || periodLoading}><Icon name="refresh" size={15} />Refresh</button>
      </div>
    </header>

    {analyticsError && <div className="analytics-load-state" role="alert">
      <span>{analyticsData ? 'Analytics could not be refreshed. Showing the last loaded values.' : 'Analytics could not be loaded. Your saved data has not been changed.'}</span>
      <button type="button" onClick={loadAnalytics} disabled={analyticsLoading}>Try again</button>
    </div>}
    {!analyticsData && analyticsLoading && <p className="analytics-load-state is-loading" role="status">Loading saved analytics…</p>}

    <section className="analytics-metrics-grid" aria-label="Analytics summary">
      <article className="analytics-card analytics-card-focus"><span className="analytics-metric-icon is-blue"><Icon name="clock" size={21} /></span><div className="analytics-metric-content"><div className="analytics-metric-heading"><span>Focus time</span></div>
        <strong>{visiblePeriod ? formatDuration(visiblePeriod.currentActiveSeconds) : '—'}</strong><div className="analytics-metric-support"><small>{labels[range]} · active time</small>{visiblePeriod && <span className={`analytics-comparison is-${chartCurrent.tone}`}>{chartCurrent.label}</span>}</div></div></article>
      <article className="analytics-card"><span className="analytics-metric-icon is-blue"><Icon name="analytics" size={21} /></span><div className="analytics-metric-content"><div className="analytics-metric-heading"><span>Completed sessions</span></div>
        <strong>{visiblePeriod?.currentCompletedSessions ?? '—'}</strong><div className="analytics-metric-support"><small>In {range}</small>{visiblePeriod && <span className={`analytics-comparison is-${chartSessions.tone}`}>{chartSessions.label}</span>}</div></div></article>
      <article className="analytics-card"><span className="analytics-metric-icon is-green"><Icon name="check" size={21} /></span><div className="analytics-metric-content"><div className="analytics-metric-heading"><span>Tasks completed</span></div>
        <strong>{analyticsData ? <>{analyticsData.summary.missionsCompleted}<i> / {analyticsData.summary.missionsTotal}</i></> : '—'}</strong>
        <div className="analytics-metric-support"><small>Current completed tasks · all time</small></div>
        <div className="analytics-task-progress" role="img" aria-label={completedRate == null ? 'No tasks yet' : `${completedRate}% of all tasks completed`}><span style={{ transform: `scaleX(${Math.min(100, Math.max(0, completedRate ?? 0)) / 100})` }} /></div></div></article>
      <article className="analytics-card"><span className="analytics-metric-icon is-success"><Icon name="sparkle" size={21} /></span><div className="analytics-metric-content"><div className="analytics-metric-heading"><span>Focus consistency</span></div>
        <strong>{analyticsData ? formatCount(analyticsData.summary.currentStreak, 'day') : '—'}</strong>
        <div className="analytics-metric-support"><small>Consecutive UTC days with completed Focus</small></div>
      </div></article>
    </section>

    <section className="analytics-main-grid">
      <article className="analytics-panel analytics-activity-panel"><div className="analytics-panel-heading"><div><span className="analytics-eyebrow">{labels[range]}</span><h2>Focus activity</h2><p>Actual active Focus time · UTC bucket boundaries</p></div>
        <div className="analytics-chart-total"><strong>{period ? formatDuration(period.currentActiveSeconds) : '—'}</strong><small>in this period</small></div></div>
        {visiblePeriod ? <ActivityChart data={visiblePeriod} range={range} onNavigateFocus={onNavigateFocus} /> : <div className="analytics-chart-placeholder" aria-live="polite">{periodError ? <><span>Analytics could not load.</span><button type="button" onClick={refresh}>Try again</button></> : 'Loading activity…'}</div>}
      </article>
      <aside className="analytics-panel analytics-insights-panel"><div className="analytics-panel-heading"><div><span className="analytics-eyebrow">Selected period</span><h2>Your rhythm</h2></div><span className="analytics-rhythm-icon"><Icon name="analytics" size={17} /></span></div>
        <div className="analytics-week-stat"><span>Completed Focus sessions</span><strong>{visiblePeriod?.currentCompletedSessions ?? '—'}</strong></div>
        <div className="analytics-week-stat"><span>Daily average</span><strong>{dailyAverage}</strong></div>
        <div className="analytics-week-stat"><span>Strongest {range === '24h' ? 'block' : range === '90d' ? 'week' : 'day'}</span><strong>{strongest && strongest.activeSeconds > 0 ? bucketLabel(strongest.start, range) : '—'}</strong></div>
        <div className="analytics-week-stat"><span>Average session rating · all time</span><strong>{analyticsData?.summary.avgQuality != null ? `${analyticsData.summary.avgQuality.toFixed(1)} / 5` : '—'}</strong></div>
        <div className="analytics-week-progress"><div className="analytics-week-progress-heading"><span>Tasks completed · all time</span><strong>{completedRate == null ? 'No tasks' : `${completedRate}%`}</strong></div><div className="analytics-progress-track"><span style={{ transform: `scaleX(${Math.min(100, Math.max(0, completedRate ?? 0)) / 100})` }} /></div></div>
        <p className="analytics-week-note">Period comparisons use the immediately preceding interval. Analytics periods and streak dates use UTC.</p>
      </aside>
    </section>

    <section className="analytics-lower-grid" aria-label="Focus history">
      <FocusedDays analyticsData={analyticsData} />
      <section className="analytics-panel analytics-recent-panel" aria-labelledby="analytics-reflections-title"><div className="analytics-panel-heading"><div><h2 id="analytics-reflections-title">Recent reflections</h2><p>Outcomes and notes from completed Focus sessions.</p></div><span className="analytics-recent-count">{analyticsData?.recentDebriefs?.length ?? 0} {(analyticsData?.recentDebriefs?.length ?? 0) === 1 ? 'session' : 'sessions'}</span></div>
        <div className="analytics-debrief-list">{analyticsData?.recentDebriefs?.length ? analyticsData.recentDebriefs.map((entry) => <Reflection key={entry.sessionId} entry={entry} />) : <div className="analytics-debrief-empty">Completed session reflections will appear here.</div>}</div>
      </section>
    </section>
  </main>
}
