import React from 'react'
import { Icon } from '../common/Icon'
import type { FocusSession } from '../../api/focusSessions'
import { computeDailyObjectives } from '../../utils/progressionEngine'

export interface DailyObjectivesCardProps {
  sessions: FocusSession[]
  currentStreak?: number
  onOpenAchievements?: () => void
  onNavigateToFocus?: () => void
}

export const DailyObjectivesCard: React.FC<DailyObjectivesCardProps> = ({
  sessions,
  currentStreak = 0,
  onOpenAchievements,
  onNavigateToFocus,
}) => {
  const summary = computeDailyObjectives(sessions)

  const isStreakVisible = (() => {
    try {
      return typeof localStorage !== 'undefined'
        ? localStorage.getItem('shinpo_streak_display') !== 'hidden'
        : true
    } catch {
      return true
    }
  })()

  return (
    <section className={`daily-objectives-card ${summary.isAllCompleted ? 'is-all-completed' : ''}`} aria-label="Today's progress">
      <div className="daily-objectives-header">
        <div className="daily-objectives-title-box">
          <div className={`daily-objectives-icon-wrap ${summary.isAllCompleted ? 'is-all-completed' : ''}`}>
            <Icon name="sparkle" size={16} />
          </div>
          <div>
            <h3 className="daily-objectives-title">Today's progress</h3>
            <span className="daily-objectives-subtitle">
              {summary.isAllCompleted
                ? 'Everything important is done for today'
                : `${summary.completedCount} of ${summary.totalCount} completed today`}
            </span>
          </div>
        </div>

        <div className="daily-objectives-header-right">
          {isStreakVisible && (
            <div
              className={`streak-capsule ${currentStreak > 0 ? 'is-active' : ''}`}
              title="Consecutive days with completed focus work"
            >
              <Icon name="zap" size={14} className="streak-flame" />
              <span className="streak-text">{currentStreak} {currentStreak === 1 ? 'consistent day' : 'consistent days'}</span>
            </div>
          )}

          {onOpenAchievements && (
            <button
              type="button"
              className="btn-view-achievements"
              onClick={onOpenAchievements}
              title="View verified progress and milestones"
            >
              <Icon name="target" size={13} />
              <span>Progress</span>
            </button>
          )}
        </div>
      </div>

      <div className="daily-objectives-list">
        {summary.objectives.map((obj) => {
          const progress = Math.min(1, Math.max(0, obj.current / Math.max(1, obj.target)))
          const circumference = 56.55
          return (
          <div
            key={obj.id}
            className={`objective-item ${obj.isCompleted ? 'is-completed' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${obj.title}: ${obj.current} of ${obj.target} ${obj.unit}`}
            onClick={() => {
              if (onNavigateToFocus) {
                onNavigateToFocus()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.currentTarget.click()
              }
            }}
          >
            <div className="objective-left">
              <svg className={`microkit-progress-ring${obj.isCompleted ? ' is-complete' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
                <circle className="microkit-progress-track" cx="12" cy="12" r="9" />
                <circle className="microkit-progress-arc" cx="12" cy="12" r="9" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
                {obj.isCompleted && <path className="microkit-progress-check" d="m8.5 12.25 2.3 2.3 4.8-5.1" />}
              </svg>
              <div className={`objective-text${obj.isCompleted ? ' microkit-objective-done' : ''}`}>
                <span className="objective-title">{obj.title}</span>
                <span className="objective-desc">{obj.description}</span>
              </div>
            </div>

            <div className="objective-right">
              <span className="objective-count">
                {obj.current} / {obj.target} {obj.unit}
              </span>
              <div className="objective-mini-bar" role="progressbar" aria-valuenow={obj.current} aria-valuemin={0} aria-valuemax={obj.target}>
                <div
                  className="objective-mini-fill"
                  style={{
                    width: `${Math.min(100, Math.max(0, (obj.current / obj.target) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>
          )
        })}
      </div>
    </section>
  )
}
