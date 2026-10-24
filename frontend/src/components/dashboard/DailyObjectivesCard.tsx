import React from 'react'
import { Icon } from '../common/Icon'
import type { Mission } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'
import { computeDailyObjectives } from '../../utils/progressionEngine'

export interface DailyObjectivesCardProps {
  missions: Mission[]
  sessions: FocusSession[]
  currentStreak?: number
  onOpenAchievements?: () => void
  onNavigateToTasks?: () => void
  onNavigateToFocus?: () => void
}

export const DailyObjectivesCard: React.FC<DailyObjectivesCardProps> = ({
  missions,
  sessions,
  currentStreak = 0,
  onOpenAchievements,
  onNavigateToTasks,
  onNavigateToFocus,
}) => {
  const summary = computeDailyObjectives(missions, sessions)

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
              <span className="streak-flame">🔥</span>
              <span className="streak-text">{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            </div>
          )}

          {onOpenAchievements && (
            <button
              type="button"
              className="btn-view-achievements"
              onClick={onOpenAchievements}
              title="View achievements and experience points"
            >
              <Icon name="target" size={13} />
              <span>Progress</span>
            </button>
          )}
        </div>
      </div>

      <div className="daily-objectives-list">
        {summary.objectives.map((obj) => (
          <div
            key={obj.id}
            className={`objective-item ${obj.isCompleted ? 'is-completed' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${obj.title}: ${obj.current} of ${obj.target} ${obj.unit}`}
            onClick={() => {
              if (obj.id === 'daily_task' && onNavigateToTasks) {
                onNavigateToTasks()
              } else if (onNavigateToFocus) {
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
              <div className={`objective-checkbox ${obj.isCompleted ? 'checked' : ''}`}>
                {obj.isCompleted ? <Icon name="check" size={12} /> : null}
              </div>
              <div className="objective-text">
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
        ))}
      </div>
    </section>
  )
}
