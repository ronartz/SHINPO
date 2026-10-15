import React from 'react'
import type {
  AnalyticsDashboardResponse,
  DailyFocusVelocity,
  RecentDebrief,
} from '../api/analytics'
import { Icon } from '../components/common/Icon'

export interface AnalyticsViewProps {
  analyticsData: AnalyticsDashboardResponse | null
  analyticsLoading: boolean
  loadAnalytics: () => void
}

import { trackRender } from '../utils/renderTracker'

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  analyticsData,
  analyticsLoading,
  loadAnalytics,
}) => {
  trackRender('AnalyticsView')
  return (
    <div className="analytics-view">
      {/* Top Metrics Row */}
      <div className="analytics-metrics-grid">
        {/* Metric 1: Focus Minutes & Hours */}
        <div className="analytics-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">FOCUS TIME</span>
            <div className="tm-metric-icon">
              <Icon name="clock" size={16} />
            </div>
          </div>
          <div className="tm-metric-val">
            {analyticsData ? `${analyticsData.summary.totalFocusMinutes}m` : '0m'}
          </div>
          <div className="tm-metric-sub">
            {analyticsData
              ? `${(analyticsData.summary.totalFocusMinutes / 60).toFixed(1)} Hours Total Focus`
              : 'Awaiting sessions'}
          </div>
        </div>

        {/* Metric 2: Sessions Completed */}
        <div className="analytics-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">COMPLETION RATE</span>
            <div className="tm-metric-icon">
              <Icon name="check" size={16} />
            </div>
          </div>
          <div className="tm-metric-val" style={{ color: 'var(--accent-emerald)' }}>
            {analyticsData?.summary.completionRate != null
              ? `${analyticsData.summary.completionRate}%`
              : '—'}
          </div>
          <div className="tm-metric-sub">
            {analyticsData
              ? `${analyticsData.summary.completionRateNumerator} completed of ${
                  analyticsData.summary.completionRateDenominator
                } tasks`
              : 'No task data'}
          </div>
        </div>

        {/* Metric 3: Tasks Completed */}
        <div className="analytics-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">TASKS COMPLETED</span>
            <div className="tm-metric-icon">
              <Icon name="target" size={16} />
            </div>
          </div>
          <div className="tm-metric-val">
            {analyticsData
              ? `${analyticsData.summary.missionsCompleted} / ${analyticsData.summary.missionsTotal}`
              : '0 / 0'}
          </div>
          <div className="tm-metric-sub">
            Tasks finished
          </div>
        </div>

        {/* Metric 4: Average Quality & Streak */}
        <div className="analytics-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">STREAK & RATING</span>
            <div className="tm-metric-icon">
              <Icon name="sparkle" size={16} />
            </div>
          </div>
          <div className="tm-metric-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>
              {analyticsData?.summary.avgQuality != null
                ? analyticsData.summary.avgQuality.toFixed(1)
                : '—'}
            </span>
            <span style={{ fontSize: 18, color: 'var(--accent-amber)' }}>★</span>
          </div>
          <div className="tm-metric-sub">
            {analyticsData ? `${analyticsData.summary.currentStreak}-Day Focus Streak` : 'No streak data'}
          </div>
        </div>
      </div>

      {/* 7-Day Activity Interactive Bar Chart */}
      <div className="analytics-velocity-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="tm-table-title">7-Day Focus Activity</h3>
            <span className="analytics-subtitle">Daily focus minutes completed</span>
          </div>
          <button
            type="button"
            className="tm-refresh-btn btn-spring"
            onClick={loadAnalytics}
            disabled={analyticsLoading}
          >
            <Icon name="refresh" size={14} />
            <span>{analyticsLoading ? 'Refreshing...' : 'Refresh Activity'}</span>
          </button>
        </div>

        {analyticsData && analyticsData.weeklyVelocity.reduce((sum, v) => sum + v.focusMinutes, 0) === 0 && (
          <div className="analytics-empty-hint">
            <Icon name="clock" size={14} />
            <span>No focus logged in the past 7 days. Completed focus sprints will display here.</span>
          </div>
        )}

        <div className="analytics-chart-container">
          {analyticsData && analyticsData.weeklyVelocity.length > 0 ? (
            (() => {
              const maxMins = Math.max(...analyticsData.weeklyVelocity.map((v: DailyFocusVelocity) => v.focusMinutes), 60)
              return analyticsData.weeklyVelocity.map((day: DailyFocusVelocity) => {
                const pct = Math.max(day.focusMinutes > 0 ? 8 : 2, Math.round((day.focusMinutes / maxMins) * 100))
                return (
                  <div key={day.date} className="analytics-bar-col">
                    <div className="analytics-bar-tooltip">
                      {day.focusMinutes}m • {day.completedCount} sessions
                    </div>
                    <div
                      className="analytics-bar bar-animated"
                      style={{
                        transform: `scaleY(${Math.max(0.03, pct / 100)})`,
                        background:
                          day.focusMinutes > 0
                            ? 'var(--brand-coral-gradient, linear-gradient(180deg, #9757FA 0%, #4D77F9 100%))'
                            : 'var(--surface-hover)',
                      }}
                    />
                    <span className="analytics-day-label">{day.dayName}</span>
                  </div>
                )
              })
            })()
          ) : (
            <div style={{ width: '100%', textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
              Loading activity metrics...
            </div>
          )}
        </div>
      </div>

      {/* Recent Session Summaries */}
      <div className="analytics-velocity-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="tm-table-title">Recent Session Summaries</h3>
            <span className="analytics-subtitle">Session reflections and feedback</span>
          </div>
        </div>

        <div className="analytics-debrief-list">
          {analyticsData && analyticsData.recentDebriefs.length > 0 ? (
            analyticsData.recentDebriefs.map((deb: RecentDebrief) => (
              <div key={deb.sessionId} className="analytics-debrief-card">
                <div className="analytics-debrief-top">
                  <div className="analytics-debrief-title">{deb.sessionName}</div>
                  <div className="analytics-debrief-stars">
                    {deb.quality != null
                      ? Array.from({ length: deb.quality }).map((_, i) => (
                          <span key={i} style={{ color: 'var(--accent-amber, #F59E0B)' }}>★</span>
                        ))
                      : '—'}
                    <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 6 }}>
                      ({deb.durationMinutes}m)
                    </span>
                  </div>
                </div>
                {deb.accomplishment && (
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>
                    Outcome: {deb.accomplishment}
                  </div>
                )}
                {deb.reflectionNote && (
                  <div className="analytics-debrief-note">
                    "{deb.reflectionNote}"
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
              No session summaries recorded yet. Complete a focus session to review your reflections here.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
