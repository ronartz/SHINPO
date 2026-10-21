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

  const dailySummary = computeDailyObjectives(missions, sessions)
  const currentStreak = analyticsData?.summary?.currentStreak || 0
  const totalXp = userProgress?.totalProgress || 0
  const level = userProgress?.level || 1
  const levelTitle = userProgress?.levelTitle || 'Focus Initiate'
  const currentLevelXp = userProgress?.currentLevelXp || 0
  const nextLevelThreshold = userProgress?.nextLevelThreshold || 100
  const progressPercent = userProgress?.progressPercent || 0
  const unlockedCount = achievements.filter((a) => a.unlocked).length

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
            <div className="achievements-level-badge">
              <span>LVL {level}</span>
            </div>
            <div>
              <h2 id="achievements-modal-title" className="achievements-title">
                {levelTitle}
              </h2>
              <span className="achievements-subtitle">
                {totalXp} XP Total • {unlockedCount} of {achievements.length} Achievements Unlocked
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

        {/* Level Progression Progress Bar */}
        <div className="achievements-progress-section">
          <div className="progress-labels">
            <span>Level {level} Progress</span>
            <span>
              {currentLevelXp} / {nextLevelThreshold} XP ({progressPercent}%)
            </span>
          </div>
          <div className="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
          </div>
        </div>

        {/* Consistency & Daily Objectives Strip */}
        <div className="achievements-summary-strip">
          <div className="summary-strip-card">
            <span className="strip-label">Consistency Streak</span>
            <div className="strip-value">
              <span className="flame-icon">🔥</span>
              <span>{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</span>
            </div>
            <span className="strip-hint">Productive days logged without stress</span>
          </div>

          <div className="summary-strip-card">
            <span className="strip-label">Today&apos;s Objectives</span>
            <div className="strip-value">
              <span>{dailySummary.completedCount} / {dailySummary.totalCount} Met</span>
            </div>
            <span className="strip-hint">
              {dailySummary.isAllCompleted ? 'Daily execution fulfilled ✨' : 'Work in progress today'}
            </span>
          </div>
        </div>

        {/* Achievements Grid */}
        <div className="achievements-grid-section">
          <h3 className="section-heading">Milestone Accomplishments</h3>
          <div className="achievements-grid">
            {achievements.map((ach) => (
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

        {/* Recent XP History */}
        {userProgress?.recentEvents && userProgress.recentEvents.length > 0 && (
          <div className="achievements-ledger-section">
            <h3 className="section-heading">Recent XP Ledger</h3>
            <div className="ledger-list">
              {userProgress.recentEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="ledger-row">
                  <div className="ledger-left">
                    <span className="ledger-dot" />
                    <span className="ledger-event">{evt.eventType.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="ledger-amount">+{evt.amount} XP</span>
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
