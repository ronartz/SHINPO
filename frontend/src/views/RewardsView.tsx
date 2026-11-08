import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ProgressResponse } from '../api/progress'
import type { AnalyticsDashboardResponse } from '../api/analytics'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { AppView, IconName } from '../types/navigation'
import { Icon } from '../components/common/Icon'
import { ShinpoLogo } from '../components/ShinpoLogo'
import { computeDailyObjectives, deriveAchievements, findNewProgressEvents, type AchievementItem } from '../utils/progressionEngine'

interface RewardsViewProps {
  progress: ProgressResponse | null
  analytics: AnalyticsDashboardResponse | null
  goals: Goal[]
  missions: Mission[]
  sessions: FocusSession[]
  onboardingVerified: boolean
  onNavigate: (tab: AppView) => void
}

const achievementIcons: Record<string, IconName> = {
  first_task: 'check',
  first_sprint: 'focus',
  deep_flow_hour: 'clock',
  level_2_practitioner: 'sparkle',
  goal_concluded: 'target',
  momentum_streak: 'zap',
  onboarding_certified: 'shield-check',
  level_4_architect: 'rewards',
}

const eventTitle = (type: string) => ({
  FOCUS_SESSION_COMPLETED: 'Focus session completed',
  MISSION_COMPLETED: 'Task completed',
  GOAL_COMPLETED: 'Goal completed',
  STREAK_MILESTONE: 'Consistency milestone',
  ONBOARDING_COMPLETED: 'Getting started',
  LATE_RETURN_PENALTY: 'Late return adjustment',
}[type] ?? type.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()))

const eventIcons: Record<string, IconName> = {
  FOCUS_SESSION_COMPLETED: 'focus',
  MISSION_COMPLETED: 'check',
  GOAL_COMPLETED: 'target',
  STREAK_MILESTONE: 'zap',
  ONBOARDING_COMPLETED: 'shield-check',
  LATE_RETURN_PENALTY: 'clock',
}
const eventIcon = (type: string): IconName => eventIcons[type] ?? 'check'

const eventDate = (value: string | null) => {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function evidenceDescription(item: AchievementItem) {
  if (item.evidence === 'persisted') return 'Verified from SHINPO’s saved task, Focus, or consistency records.'
  if (item.evidence === 'current') return 'Based on current app state; this may change if that state is reopened or reset.'
  return 'The required historical record is not available, so SHINPO will not claim this milestone as earned.'
}

export const RewardsView: React.FC<RewardsViewProps> = ({ progress, analytics, goals, missions, sessions, onboardingVerified, onNavigate }) => {
  const achievements = useMemo(
    () => deriveAchievements(progress, analytics, missions, goals, sessions, onboardingVerified)
      .filter((item) => item.id !== 'level_2_practitioner' && item.id !== 'level_4_architect'),
    [progress, analytics, missions, goals, sessions, onboardingVerified],
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAllEvents, setShowAllEvents] = useState(false)
  const [freshEventIds, setFreshEventIds] = useState<number[]>([])
  const [freshAchievementIds, setFreshAchievementIds] = useState<string[]>([])
  const previousRewardState = useRef<{ progress: ProgressResponse; achievements: AchievementItem[] } | null>(null)
  const freshTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!progress) return
    const previous = previousRewardState.current
    if (previous) {
      const newEvents = findNewProgressEvents(previous.progress, progress)
      if (newEvents.length) {
        setFreshEventIds(newEvents.map((event) => event.id))
        const wasUnlocked = new Set(previous.achievements.filter((item) => item.unlocked).map((item) => item.id))
        setFreshAchievementIds(achievements.filter((item) => item.unlocked && !wasUnlocked.has(item.id)).map((item) => item.id))
        if (freshTimer.current !== null) window.clearTimeout(freshTimer.current)
        freshTimer.current = window.setTimeout(() => {
          setFreshEventIds([])
          setFreshAchievementIds([])
          freshTimer.current = null
        }, 2200)
      }
    }
    previousRewardState.current = { progress, achievements }
  }, [progress, achievements])

  useEffect(() => () => {
    if (freshTimer.current !== null) window.clearTimeout(freshTimer.current)
  }, [])

  const completedTasks = missions.filter((mission) => mission.status === 'COMPLETED').length
  const completedGoals = goals.filter((goal) => goal.status === 'COMPLETED').length
  const completedSessions = sessions.filter((session) => session.status === 'COMPLETED')
  const focusedMinutes = completedSessions.reduce((total, session) => total + Math.max(0, session.focusActiveSeconds ?? session.activeSeconds ?? 0), 0) / 60
  const percent = missions.length ? Math.round(completedTasks / missions.length * 100) : 0
  const nextMilestone = achievements.find((item) => !item.unlocked && item.progress !== null) ?? achievements.find((item) => !item.unlocked)
  const selected = achievements.find((item) => item.id === selectedId) ?? nextMilestone ?? achievements[0]
  const unlockedCount = achievements.filter((item) => item.unlocked).length
  const daily = useMemo(() => computeDailyObjectives(sessions), [sessions])
  const objectives = daily.objectives
  const circumference = 2 * Math.PI * 54
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const recentEvents = progress?.recentEvents ?? []
  const visibleEvents = showAllEvents ? recentEvents : recentEvents.slice(0, 3)

  return (
    <main className="rewards-view">
      <header className="rewards-heading">
        <div>
          <span className="rewards-eyebrow">Progress built through real work</span>
          <h1>Progress &amp; milestones</h1>
          <p>Review completed work, Focus history and milestones verified from your saved activity.</p>
        </div>
        <span className="rewards-ledger-trust"><Icon name="shield-check" size={18} /><span><strong>Verified progress</strong><small>Synced from your sessions</small></span></span>
      </header>

      <section className={`rewards-hero${freshEventIds.length ? ' has-new-xp' : ''}`} aria-label="Work progress">
        <div className="rewards-hero-orbit" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="rewards-level-ring" role="img" aria-label={`${completedTasks} of ${missions.length} tasks completed`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle className="rewards-ring-track" cx="60" cy="60" r="54" />
            <circle className="rewards-ring-progress" cx="60" cy="60" r="54" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)} />
          </svg>
          <div className="rewards-level-emblem"><ShinpoLogo size={58} variant="icon" monochrome /><span>WORK</span></div>
        </div>
        <div className="rewards-hero-copy">
          <span className="rewards-eyebrow">Task completion</span>
          <h2>{completedTasks} of {missions.length} tasks complete</h2>
          <p className="rewards-hero-summary">{completedGoals} {completedGoals === 1 ? 'goal' : 'goals'} complete · {completedSessions.length} completed {completedSessions.length === 1 ? 'Focus session' : 'Focus sessions'}</p>
          <div className="rewards-hero-progress" role="progressbar" aria-label="Task completion" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="rewards-hero-progress-labels"><span>{percent}% complete</span><span>{missions.length - completedTasks} open {missions.length - completedTasks === 1 ? 'task' : 'tasks'}</span></div>
          <div className="rewards-hero-next"><span>Next milestone</span><strong>{nextMilestone?.title ?? 'All milestones met'}</strong><span>{nextMilestone?.progressLabel ?? 'Continue your work at a steady pace'}</span></div>
        </div>
        <div className="rewards-streak-card">
          <span className="rewards-streak-icon"><Icon name="zap" size={18} /></span>
          <strong>{Math.floor(focusedMinutes)}</strong>
          <span>Focus minutes</span>
          <small>Recorded across {completedSessions.length} completed {completedSessions.length === 1 ? 'session' : 'sessions'}.</small>
        </div>
      </section>

      <section className="rewards-daily" aria-labelledby="rewards-daily-title">
        <div className="rewards-section-heading">
          <div><h2 id="rewards-daily-title">Today’s progress</h2></div>
          <div className="rewards-daily-meta"><time>{todayLabel}</time><span className="rewards-count">{daily.completedCount} / {daily.totalCount} complete</span></div>
        </div>
        <div className="rewards-objectives-grid">
          {objectives.map((objective) => {
            const value = Math.min(100, Math.round(objective.current / objective.target * 100))
            return <button key={objective.id} type="button" className={`rewards-objective${objective.isCompleted ? ' is-complete' : ''}`} onClick={() => onNavigate('Focus Engine')}>
              <span className="rewards-objective-icon"><Icon name={objective.isCompleted ? 'check' : 'focus'} size={17} /></span>
              <span className="rewards-objective-copy"><strong>{objective.title}</strong><small>{objective.description}</small><span className="rewards-objective-track"><i style={{ width: `${value}%` }} /></span></span>
              <span className="rewards-objective-value">{objective.current} / {objective.target}<small> {objective.unit}</small></span>
            </button>
          })}
        </div>
      </section>

      <section className="rewards-journey" aria-labelledby="rewards-journey-title">
        <div className="rewards-section-heading">
          <div><span className="rewards-eyebrow">Earned through verified progress</span><h2 id="rewards-journey-title">Milestones</h2><p>Choose a milestone to see what counts and where to continue.</p></div>
          <span className="rewards-count">{unlockedCount} / {achievements.length} met</span>
        </div>
        <div className="rewards-journey-grid">
          {achievements.map((item, index) => {
            const amount = item.progress === null ? 0 : Math.min(item.target, item.progress)
            const ratio = item.target > 0 ? amount / item.target : 0
            return <button
              type="button"
              key={item.id}
              aria-pressed={selected?.id === item.id}
              className={`rewards-milestone ${item.unlocked ? 'is-earned' : item.evidence === 'unavailable' ? 'is-unknown' : 'is-locked'}${selected?.id === item.id ? ' is-selected' : ''}${freshAchievementIds.includes(item.id) ? ' is-newly-earned' : ''}`}
              style={{ '--milestone-order': index } as React.CSSProperties}
              onClick={() => setSelectedId(item.id)}
            >
              <span className={`rewards-badge badge-${item.id}`}><Icon name={achievementIcons[item.id]} size={22} />{item.unlocked && <i><Icon name="check" size={10} /></i>}</span>
              <span className="rewards-milestone-content"><strong>{item.title}</strong><small>{item.description}</small></span>
              <span className="rewards-milestone-progress"><i><span style={{ width: item.progress === null ? '0%' : `${ratio * 100}%` }} /></i><small>{item.unlocked ? 'Record met' : item.progressLabel}</small></span>
              <span className="rewards-milestone-state">{item.unlocked ? item.evidence === 'persisted' ? 'Earned' : 'Currently met' : item.evidence === 'unavailable' ? 'Unverified' : 'In progress'}</span>
            </button>
          })}
        </div>
        {selected && <aside className="rewards-detail-panel" aria-live="polite" aria-labelledby="rewards-detail-title">
          <span className={`rewards-detail-badge badge-${selected.id}`}><Icon name={achievementIcons[selected.id]} size={27} /></span>
          <div className="rewards-detail-copy">
            <span className="rewards-eyebrow">{selected.unlocked ? selected.evidence === 'persisted' ? 'Milestone earned' : 'Currently met' : selected.evidence === 'unavailable' ? 'Verification unavailable' : 'Next steps'}</span>
            <h3 id="rewards-detail-title">{selected.title}</h3>
            <p>{selected.description}</p>
            <p className="rewards-evidence-note">{evidenceDescription(selected)}</p>
            {selected.progress !== null && <div className="rewards-detail-progress"><span>{selected.progressLabel}</span><span>{selected.unlocked ? 'Complete' : `${Math.max(0, selected.target - selected.progress)} ${selected.unit} remaining`}</span><i><b style={{ width: `${Math.min(100, selected.progress / selected.target * 100)}%` }} /></i></div>}
          </div>
          {selected.nextActionTab && <button type="button" className="rewards-continue-button" onClick={() => onNavigate(selected.nextActionTab!)}>{selected.unlocked ? 'Keep going' : selected.evidence === 'unavailable' ? 'Open guide' : 'Continue progress'}<Icon name="arrow-up-right" size={15} /></button>}
        </aside>}
      </section>

      <section className="rewards-history" aria-labelledby="rewards-history-title">
        <header className="rewards-history-heading"><span><strong id="rewards-history-title">Recent activity</strong><small>Saved task, Focus and milestone updates.</small></span>
          {recentEvents.length > 3 && <button type="button" aria-expanded={showAllEvents} onClick={() => setShowAllEvents((show) => !show)}>{showAllEvents ? 'Show recent' : 'View all activity'}<Icon name="arrow-up-right" size={14} /></button>}
        </header>
        {visibleEvents.length ? <ol className="rewards-ledger">
          {visibleEvents.map((event) => <li key={event.id} className={freshEventIds.includes(event.id) ? 'is-new-event' : ''}>
            <span className="rewards-event-mark"><Icon name={eventIcon(event.eventType)} size={15} /></span>
            <span className="rewards-event-copy"><strong>{eventTitle(event.eventType)}</strong><small>{eventTitle(event.eventType)} recorded in your progress ledger.</small></span>
            <time dateTime={event.createdAt ?? undefined}>{eventDate(event.createdAt)}</time>
          </li>)}
        </ol> : <p className="rewards-empty">Recorded activity will appear here as you complete tasks and Focus sessions.</p>}
      </section>
    </main>
  )
}
