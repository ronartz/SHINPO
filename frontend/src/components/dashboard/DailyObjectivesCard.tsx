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
    <section className="daily-objectives-card" aria-label="Daily Objectives & Momentum">
      <div className="daily-objectives-header">
        <div className="daily-objectives-title-box">
          <div className="daily-objectives-icon-wrap">
            <Icon name="sparkle" size={16} />
          </div>
          <div>
            <h3 className="daily-objectives-title">Daily Execution Flow</h3>
            <span className="daily-objectives-subtitle">
              {summary.completedCount} of {summary.totalCount} completed today
            </span>
          </div>
        </div>

        <div className="daily-objectives-header-right">
          {isStreakVisible && (
            <div
              className={`streak-capsule ${currentStreak > 0 ? 'is-active' : ''}`}
              title="Healthy streak: counts productive days without anxiety or penalties"
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
              title="View all milestone achievements & XP"
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
            onClick={() => {
              if (obj.id === 'daily_task' && onNavigateToTasks) {
                onNavigateToTasks()
              } else if (onNavigateToFocus) {
                onNavigateToFocus()
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
