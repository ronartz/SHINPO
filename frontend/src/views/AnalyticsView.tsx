import React from 'react'
import type { AnalyticsDashboardResponse, DailyFocusVelocity, RecentDebrief } from '../api/analytics'
import { Icon } from '../components/common/Icon'
import { trackRender } from '../utils/renderTracker'

export interface AnalyticsViewProps {
  analyticsData: AnalyticsDashboardResponse | null
  analyticsLoading: boolean
  loadAnalytics: () => void
}

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${minutes}m`
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ analyticsData, analyticsLoading, loadAnalytics }) => {
  trackRender('AnalyticsView')

  const week = analyticsData?.weeklyVelocity ?? []
  const weekMinutes = week.reduce((sum, day) => sum + day.focusMinutes, 0)
  const weekSessions = week.reduce((sum, day) => sum + day.completedCount, 0)
  const bestDay = week.reduce<DailyFocusVelocity | null>((best, day) =>
    !best || day.focusMinutes > best.focusMinutes ? day : best, null)
  const maxMinutes = Math.max(...week.map(day => day.focusMinutes), 60)
  const completionRate = analyticsData?.summary.completionRate ?? null

  return (
    <main className="analytics-view">
      <header className="analytics-page-heading">
        <div>
          <span className="analytics-eyebrow">Your progress</span>
          <h1>Analytics</h1>
          <p>A clearer view of your focus, consistency, and completed work.</p>
        </div>
        <button type="button" className="analytics-refresh-button" onClick={loadAnalytics} disabled={analyticsLoading}>
          <Icon name="refresh" size={15} />
          {analyticsLoading ? 'Updating…' : 'Refresh'}
        </button>
      </header>

      <section className="analytics-metrics-grid" aria-label="All-time summary">
        <article className="analytics-card analytics-metric-focus">
          <div className="analytics-metric-heading"><span>Focus time</span><Icon name="clock" size={16} /></div>
          <strong>{formatDuration(analyticsData?.summary.totalFocusMinutes ?? 0)}</strong>
          <small>{analyticsData
            ? analyticsData.summary.totalFocusMinutes === 0
              ? 'No focus time recorded yet'
              : analyticsData.summary.totalFocusMinutes < 60
                ? `${analyticsData.summary.totalFocusMinutes} min invested`
                : `${(analyticsData.summary.totalFocusMinutes / 60).toFixed(1)} hours invested`
            : 'Total recorded focus'}</small>
        </article>
        <article className="analytics-card">
          <div className="analytics-metric-heading"><span>Completed sessions</span><Icon name="check" size={16} /></div>
          <strong>{analyticsData?.summary.sessionsCompleted ?? 0}</strong>
          <small>{analyticsData
            ? analyticsData.summary.sessionsStarted === 0
              ? 'No sessions started yet'
              : `${analyticsData.summary.sessionsStarted} ${analyticsData.summary.sessionsStarted === 1 ? 'session' : 'sessions'} started`
            : 'Completed focus sessions'}</small>
        </article>
        <article className="analytics-card">
          <div className="analytics-metric-heading"><span>Tasks completed</span><Icon name="target" size={16} /></div>
          <strong>{analyticsData ? <>{analyticsData.summary.missionsCompleted}<i> / {analyticsData.summary.missionsTotal}</i></> : '0'}</strong>
          <small>Progress across your goals</small>
        </article>
        <article className="analytics-card">
          <div className="analytics-metric-heading"><span>Focus streak</span><Icon name="sparkle" size={16} /></div>
          <strong>{analyticsData?.summary.currentStreak ?? 0}<i> {analyticsData?.summary.currentStreak === 1 ? 'day' : 'days'}</i></strong>
          <small>{analyticsData?.summary.avgQuality != null ? `Average session rating ${analyticsData.summary.avgQuality.toFixed(1)} / 5` : 'Keep showing up consistently'}</small>
        </article>
      </section>

      <section className="analytics-main-grid">
        <article className="analytics-panel analytics-velocity-card">
          <div className="analytics-panel-heading">
            <div>
              <span className="analytics-eyebrow">Last 7 days</span>
              <h2>Focus activity</h2>
              <p>Your daily focus time, measured in minutes.</p>
            </div>
            <div className="analytics-week-total"><strong>{formatDuration(weekMinutes)}</strong><span>this week</span></div>
          </div>

          {week.length > 0 ? (
            <div className="analytics-chart" role="img" aria-label={`Focus activity for the last seven days. ${weekMinutes} minutes total.`}>
              <div className="analytics-chart-guides" aria-hidden="true"><span>{maxMinutes}m</span><span>{Math.round(maxMinutes / 2)}m</span><span>0</span></div>
              <div className="analytics-chart-columns">
                {week.map((day, index) => (
                  <div className={`analytics-bar-col${day === bestDay && day.focusMinutes > 0 ? ' is-best' : ''}`} key={day.date}>
                    <div className="analytics-bar-value">{day.focusMinutes ? formatDuration(day.focusMinutes) : '—'}</div>
                    <div className="analytics-bar-track">
                      {day.focusMinutes > 0 && <div className="analytics-bar" style={{ height: `${Math.max(8, day.focusMinutes / maxMinutes * 100)}%`, '--bar-height': `${Math.max(8, day.focusMinutes / maxMinutes * 100)}%`, animationDelay: `${index * 45}ms` } as React.CSSProperties} />}
                    </div>
                    <span className="analytics-day-label">{day.dayName}</span>
                  </div>
                ))}
                {weekMinutes === 0 && <div className="analytics-chart-zero-state">No tracked focus time this week yet</div>}
              </div>
            </div>
          ) : (
            <div className="analytics-chart-empty">{analyticsLoading ? 'Loading your activity…' : 'Focus sessions from the last 7 days will appear here.'}</div>
          )}
        </article>

        <aside className="analytics-panel analytics-week-panel">
          <div className="analytics-panel-heading">
            <div><span className="analytics-eyebrow">Week at a glance</span><h2>Your rhythm</h2></div>
            <span className="analytics-rhythm-icon"><Icon name="target" size={17} /></span>
          </div>
          <div className="analytics-week-stat"><span>Focus sessions</span><strong>{weekSessions}</strong></div>
          <div className="analytics-week-stat"><span>Daily average</span><strong>{formatDuration(Math.round(weekMinutes / Math.max(week.length, 1)))}</strong></div>
          <div className="analytics-week-stat"><span>Most focused day</span><strong>{bestDay?.focusMinutes ? bestDay.dayName : '—'}</strong></div>
          <div className="analytics-week-progress" aria-label={completionRate == null ? 'All-time task completion: no tasks yet' : `All-time task completion: ${completionRate}%`}>
            <div className="analytics-week-progress-heading"><span>All-time task completion</span><strong>{completionRate == null ? 'No tasks yet' : `${completionRate}%`}</strong></div>
            <div className="analytics-progress-track"><span style={{ width: `${Math.min(100, Math.max(0, completionRate ?? 0))}%` }} /></div>
          </div>
          <p className="analytics-week-note">Small, repeatable sessions build lasting momentum. Keep your next focus block achievable.</p>
        </aside>
      </section>

      <section className="analytics-panel analytics-recent-panel">
        <div className="analytics-panel-heading">
          <div><span className="analytics-eyebrow">Looking back</span><h2>Recent reflections</h2><p>Notes and outcomes from your completed sessions.</p></div>
          <span className="analytics-recent-count">{analyticsData?.recentDebriefs.length ?? 0} sessions</span>
        </div>
        <div className="analytics-debrief-list">
          {analyticsData?.recentDebriefs.length ? analyticsData.recentDebriefs.map((deb: RecentDebrief) => (
            <article key={deb.sessionId} className="analytics-debrief-card">
              <div className="analytics-debrief-main">
                <div className="analytics-debrief-title">{deb.sessionName}</div>
                {deb.accomplishment && <p className="analytics-debrief-outcome"><span>Outcome</span>{deb.accomplishment}</p>}
                {deb.reflectionNote && <p className="analytics-debrief-note"><span>Reflection</span>{deb.reflectionNote}</p>}
                {!deb.accomplishment && !deb.reflectionNote && deb.intention && <p className="analytics-debrief-note"><span>Intention</span>{deb.intention}</p>}
              </div>
              <div className="analytics-debrief-meta">
                <span className="analytics-duration-chip">{formatDuration(deb.actualFocusMinutes)} active</span>
                <span className="analytics-planned-duration">Planned {formatDuration(deb.durationMinutes)}</span>
                <span className="analytics-quality">{deb.quality != null ? `${'★'.repeat(Math.min(5, Math.max(0, deb.quality)))}${'☆'.repeat(Math.max(0, 5 - deb.quality))}` : 'Not rated'}</span>
              </div>
            </article>
          )) : <div className="analytics-debrief-empty">Your session reflections will show up here after a focus block.</div>}
        </div>
      </section>
    </main>
  )
}
