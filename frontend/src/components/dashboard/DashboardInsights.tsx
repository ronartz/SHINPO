import React from 'react'
import type { AnalyticsDashboardResponse } from '../../api/analytics'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { AppView } from '../../types/navigation'
import { Icon } from '../common/Icon'

interface DashboardInsightsProps {
  goals: Goal[]
  missions: Mission[]
  analyticsData?: AnalyticsDashboardResponse | null
  setActiveTab: (tab: AppView) => void
}

export const DashboardInsights: React.FC<DashboardInsightsProps> = ({ goals, missions, analyticsData, setActiveTab }) => {
  const weeklyActivity = analyticsData?.weeklyVelocity ?? []
  const weeklyFocusMinutes = weeklyActivity.reduce((total, day) => total + day.focusMinutes, 0)
  const weeklyFocusLabel = weeklyFocusMinutes >= 60
    ? `${Math.floor(weeklyFocusMinutes / 60)}h ${weeklyFocusMinutes % 60}m`
    : `${weeklyFocusMinutes}m`
  const weeklyFocusScale = Math.max(1, ...weeklyActivity.map((day) => day.focusMinutes))
  const activeGoals = goals.filter((goal) => goal.status.toUpperCase() !== 'COMPLETED').slice(0, 3)

  return (
    <section className="dashboard-insight-grid" aria-label="Weekly execution overview">
      <article className="dashboard-insight-card dashboard-activity-card">
        <header className="dashboard-insight-header">
          <div>
            <span className="dashboard-insight-eyebrow">LAST 7 DAYS</span>
            <h2>Focus activity</h2>
            <p>Actual focused time recorded each day.</p>
          </div>
          <div className="dashboard-insight-total">
            <strong>{weeklyFocusLabel}</strong>
            <span>this week</span>
          </div>
        </header>
        {weeklyActivity.length > 0 ? (
          <div className="dashboard-activity-chart" role="img" aria-label={`Focus time over the last seven days: ${weeklyActivity.map((day) => `${day.dayName} ${day.focusMinutes} minutes`).join(', ')}`}>
            <div className="dashboard-chart-bars">
              {weeklyActivity.map((day, index) => (
                <div className={`dashboard-chart-day${index === weeklyActivity.length - 1 ? ' is-today' : ''}`} key={day.date} title={`${day.dayName}: ${day.focusMinutes}m focused, ${day.completedCount} completed tasks`}>
                  <div className="dashboard-chart-bar-track">
                    <span className="dashboard-chart-bar" style={{ height: `${day.focusMinutes ? Math.max(5, day.focusMinutes / weeklyFocusScale * 100) : 2}%` }} />
                  </div>
                  <span className="dashboard-chart-day-label">{day.dayName.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="dashboard-insight-empty">Focus activity will appear here after your first session.</p>
        )}
        <button type="button" className="dashboard-insight-link" onClick={() => setActiveTab('Analytics')}>View analytics <Icon name="arrow-up-right" size={13} /></button>
      </article>

      <article className="dashboard-insight-card dashboard-goal-progress-card">
        <header className="dashboard-insight-header">
          <div>
            <span className="dashboard-insight-eyebrow">GOALS IN MOTION</span>
            <h2>Goal progress</h2>
            <p>Progress from tasks completed under each goal.</p>
          </div>
          <button type="button" className="dashboard-insight-icon" aria-label="Open goals" onClick={() => setActiveTab('Goals & Missions')}><Icon name="target" size={16} /></button>
        </header>
        {activeGoals.length > 0 ? (
          <div className="dashboard-goal-progress-list">
            {activeGoals.map((goal) => {
              const goalTasks = missions.filter((mission) => mission.goalId === goal.id)
              const completed = goalTasks.filter((mission) => mission.status === 'COMPLETED').length
              const progress = goalTasks.length ? Math.round(completed / goalTasks.length * 100) : 0
              return (
                <div className="dashboard-goal-progress-item" key={goal.id}>
                  <div className="dashboard-goal-progress-copy"><strong title={goal.title}>{goal.title}</strong><span>{goalTasks.length ? `${completed} of ${goalTasks.length} tasks` : 'No tasks linked yet'}</span></div>
                  <div className="dashboard-goal-progress-track" role="progressbar" aria-label={`${goal.title} task progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="dashboard-insight-empty">Create a goal to see its task progress here.</p>
        )}
        <button type="button" className="dashboard-insight-link" onClick={() => setActiveTab('Goals & Missions')}>View all goals <Icon name="arrow-up-right" size={13} /></button>
      </article>
    </section>
  )
}
