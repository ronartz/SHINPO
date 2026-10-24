import React from 'react'
import type { ProgressResponse } from '../api/progress'
import type { AnalyticsDashboardResponse } from '../api/analytics'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import { Icon } from '../components/common/Icon'
import type { IconName } from '../types/navigation'
import { deriveAchievements } from '../utils/progressionEngine'

interface RewardsViewProps {
  progress: ProgressResponse | null
  analytics: AnalyticsDashboardResponse | null
  goals: Goal[]
  missions: Mission[]
  sessions: FocusSession[]
  onboardingVerified: boolean
}

const eventTitle = (type: string) => ({
  FOCUS_SESSION_COMPLETED: 'Focus session completed',
  MISSION_COMPLETED: 'Task completed',
  GOAL_COMPLETED: 'Goal completed',
  STREAK_MILESTONE: 'Consistency milestone',
  ONBOARDING_COMPLETED: 'Getting started',
}[type] ?? type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))

export const RewardsView: React.FC<RewardsViewProps> = ({ progress, analytics, goals, missions, sessions, onboardingVerified }) => {
  const achievements = deriveAchievements(progress, analytics, missions, goals, sessions, onboardingVerified)
  const percent = Math.min(100, Math.max(0, progress?.progressPercent ?? 0))
  const remaining = Math.max(0, (progress?.nextLevelThreshold ?? 0) - (progress?.currentLevelXp ?? 0))
  const streak = analytics?.summary.currentStreak ?? 0

  return (
    <main className="rewards-view">
      <header className="rewards-heading">
        <div><span className="rewards-eyebrow">Your progress</span><h1>Rewards &amp; Progress</h1><p>Real milestones earned through the work you complete in SHINPO.</p></div>
      </header>
      <section className="rewards-overview" aria-label="Current level progress">
        <div className="rewards-level-mark" aria-hidden="true"><Icon name="rewards" size={25} /></div>
        <div className="rewards-level-copy"><span>LEVEL {progress?.level ?? 1}</span><h2>{progress?.levelTitle ?? 'Focus Initiate'}</h2><p>{progress?.totalProgress ?? 0} XP earned · {remaining} XP to next level</p>
          <div className="rewards-progress-track" role="progressbar" aria-label="Progress to next level" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
          <div className="rewards-progress-caption"><span>{progress?.currentLevelXp ?? 0} XP</span><span>{progress?.nextLevelThreshold ?? 100} XP</span></div>
        </div>
        <div className="rewards-streak"><Icon name="sparkle" size={18} /><strong>{streak}</strong><span>{streak === 1 ? 'day' : 'days'} current streak</span></div>
      </section>
      <div className="rewards-content-grid">
        <section className="rewards-panel" aria-labelledby="rewards-ledger-title">
          <div className="rewards-panel-heading"><div><span className="rewards-eyebrow">Server-recorded activity</span><h2 id="rewards-ledger-title">XP activity</h2></div></div>
          {progress?.recentEvents.length ? <ol className="rewards-ledger">
            {progress.recentEvents.map((event) => (
              <li key={event.id}><span className="rewards-event-mark"><Icon name="check" size={15} /></span><div className="rewards-event-copy"><strong>{eventTitle(event.eventType)}</strong><time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Recorded'}</time></div><b>+{event.amount} XP</b></li>
            ))}
          </ol> : <p className="rewards-empty">Progress events will appear here when you complete a qualifying task or focus session.</p>}
        </section>
        <section className="rewards-panel" aria-labelledby="rewards-achievements-title">
          <div className="rewards-panel-heading"><div><span className="rewards-eyebrow">Earned milestones</span><h2 id="rewards-achievements-title">Achievements</h2></div><span className="rewards-count">{achievements.filter((item) => item.unlocked).length} / {achievements.length}</span></div>
          <ul className="rewards-achievements">
            {achievements.map((achievement) => <li key={achievement.id} className={achievement.unlocked ? 'is-unlocked' : ''}>
              <span className="rewards-achievement-icon"><Icon name={achievement.icon as IconName} size={16} /></span>
              <span><strong>{achievement.title}</strong><small>{achievement.unlocked ? achievement.description : achievement.progressLabel}</small></span>
              <span className="rewards-achievement-state">{achievement.unlocked ? 'Earned' : 'In progress'}</span>
            </li>)}
          </ul>
        </section>
      </div>
    </main>
  )
}
