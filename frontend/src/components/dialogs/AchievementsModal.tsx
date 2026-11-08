import React, { useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import type { ProgressResponse } from '../../api/progress'
import type { AnalyticsDashboardResponse } from '../../api/analytics'
import type { Mission, Goal } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'
import {
  deriveAchievements,
  computeDailyObjectives,
  type AchievementItem,
} from '../../utils/progressionEngine'

export interface AchievementsModalProps {
  isOpen: boolean
  onClose: () => void
  userProgress: ProgressResponse | null
  analyticsData: AnalyticsDashboardResponse | null
  missions: Mission[]
  goals: Goal[]
  sessions: FocusSession[]
  isOnboardingVerified?: boolean
}

export const AchievementsModal: React.FC<AchievementsModalProps> = ({
  isOpen,
  onClose,
  userProgress,
  analyticsData,
  missions,
  goals,
  sessions,
  isOnboardingVerified = false,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => closeBtnRef.current?.focus(), 50)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const achievements: AchievementItem[] = deriveAchievements(
    userProgress,
    analyticsData,
    missions,
    goals,
    sessions,
    isOnboardingVerified,
  )

  const dailySummary = computeDailyObjectives(sessions)
  const visibleAchievements = achievements.filter((achievement) => achievement.id !== 'level_2_practitioner' && achievement.id !== 'level_4_architect')
  const completedSessions = sessions.filter((session) => session.status === 'COMPLETED').length
  const unlockedCount = visibleAchievements.filter((achievement) => achievement.unlocked).length

  return (
    <div
      className="achievements-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievements-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="achievements-modal-card">
        {/* Modal Header */}
        <div className="achievements-header">
          <div className="achievements-header-left">
            <div>
              <h2 id="achievements-modal-title" className="achievements-title">Achievements &amp; milestones</h2>
              <span className="achievements-subtitle">
                {unlockedCount} of {visibleAchievements.length} milestones met
              </span>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="achievements-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Consistency & Daily Objectives Strip */}
        <div className="achievements-summary-strip">
          <div className="summary-strip-card">
            <span className="strip-label">Focus history</span>
            <div className="strip-value">
              <Icon name="focus" size={16} />
              <span>{completedSessions} completed {completedSessions === 1 ? 'session' : 'sessions'}</span>
            </div>
            <span className="strip-hint">Sessions saved in your Focus history</span>
          </div>

          <div className="summary-strip-card">
            <span className="strip-label">Today&apos;s Objectives</span>
            <div className="strip-value">
              <span>{dailySummary.completedCount} / {dailySummary.totalCount} Met</span>
            </div>
            <span className="strip-hint">
              {dailySummary.isAllCompleted ? 'Daily objectives complete' : 'Work in progress today'}
            </span>
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="achievements-grid-section">
          <h3 className="section-heading">Milestone Accomplishments</h3>
          <div className="achievements-grid">
            {visibleAchievements.map((ach) => (
              <div
                key={ach.id}
                className={`achievement-card ${ach.unlocked ? 'is-unlocked' : 'is-locked'}`}
              >
                <div className="achievement-icon-wrap">
                  <Icon name={ach.icon as 'check' | 'sparkle' | 'focus' | 'clock' | 'target'} size={18} />
                </div>
                <div className="achievement-details">
                  <div className="achievement-top-row">
                    <span className="achievement-name">{ach.title}</span>
                    <span className={`achievement-pill ${ach.unlocked ? 'unlocked' : 'locked'}`}>
                      {ach.progressLabel}
                    </span>
                  </div>
                  <p className="achievement-desc">{ach.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent progress history */}
        {userProgress?.recentEvents && userProgress.recentEvents.length > 0 && (
          <div className="achievements-ledger-section">
            <h3 className="section-heading">Recent activity</h3>
            <div className="ledger-list">
              {userProgress.recentEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="ledger-row">
                  <div className="ledger-left">
                    <span className="ledger-dot" />
                    <span className="ledger-event">{evt.eventType.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="achievements-footer">
          <button type="button" className="achievements-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
