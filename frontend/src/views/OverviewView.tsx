import React from 'react'
import { createPortal } from 'react-dom'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { ExecutiveBriefing } from '../api/ai'
import type { AnalyticsDashboardResponse } from '../api/analytics'
import type { SentinelStatus, SentinelWarningItem } from '../api/device'
import type { AppView } from '../types/navigation'
import type { AuthUser } from '../api/auth'
import { Icon } from '../components/common/Icon'
import { LiveClock } from '../components/common/LiveClock'
import { formatTimerDigits } from '../utils/focusTimer'
import { trackRender } from '../utils/renderTracker'
import { getSortedScheduleSessions, getSessionSecondaryInfo } from '../utils/scheduleHelpers'

export interface OverviewViewProps {
  currentUser?: AuthUser | null
  missions: Mission[]
  goals: Goal[]
  sessions: FocusSession[]
  activeSession?: FocusSession | null
  sentinelStatus?: SentinelStatus | null
  executiveBriefing: ExecutiveBriefing | null
  isBriefingExpanded: boolean
  setIsBriefingExpanded: (expanded: boolean | ((prev: boolean) => boolean)) => void
  briefingLoading: boolean
  analyticsData: AnalyticsDashboardResponse | null
  topSearchQuery: string
  setTopSearchQuery?: (query: string) => void
  setActiveTab: (tab: AppView) => void
  handleArmMissionAsSession: (title: string, duration?: number) => void
  handleToggleMissionComplete: (id: number) => void
  handleDeleteMission: (id: number, title: string) => void
  deletingMissionId: number | null
  handleStartFromSchedule: (id: number) => void
  setIsCreatingQuickMission: (creating: boolean) => void
  setQuickMissionGoalId: (goalId: number | null) => void
  inspectingMission: Mission | null
  setInspectingMission: (mission: Mission | null) => void
  activeTaskMenu: { task: Mission; rect: DOMRect } | null
  setActiveTaskMenu: React.Dispatch<React.SetStateAction<{ task: Mission; rect: DOMRect } | null>>
  handleAiSend?: (msg: string) => void
  refreshBriefing?: () => void
  handleEngageNextAction?: () => void
  pendingWarning?: SentinelWarningItem | null
  activeGraceWarning?: SentinelWarningItem | null
  graceSecondsLeft?: number
  timerSeconds?: number
  handlePause?: (id: number) => void
  handleResume?: (id: number) => void
  setCompletingSessionId?: (id: number | null) => void
  nextActionMission?: Mission | null
  onNavigateToTasks?: (filter: 'ALL' | 'PENDING' | 'COMPLETED') => void
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentUser,
  missions,
  goals,
  sessions,
  activeSession,
  sentinelStatus,
  analyticsData,
  topSearchQuery,
  setTopSearchQuery,
  setActiveTab,
  onNavigateToTasks,
  handleArmMissionAsSession,
  handleToggleMissionComplete,
  handleDeleteMission,
  deletingMissionId,
  handleStartFromSchedule,
  setIsCreatingQuickMission,
  setQuickMissionGoalId,
  inspectingMission,
  setInspectingMission,
  activeTaskMenu,
  setActiveTaskMenu,
  handleAiSend,
  handleEngageNextAction,
  pendingWarning,
  activeGraceWarning,
  graceSecondsLeft = 0,
  timerSeconds = 0,
  handlePause = () => {},
  handleResume = () => {},
  setCompletingSessionId = () => {},
  nextActionMission,
}) => {
  trackRender('OverviewView')

  const totalMissionsCount = missions.length
  const completedMissionsCount = missions.filter((m) => m.status === 'COMPLETED').length
  const velocityRate = totalMissionsCount > 0
    ? Math.round((completedMissionsCount / totalMissionsCount) * 100)
    : (analyticsData?.summary?.completionRate ? Math.round(analyticsData.summary.completionRate) : 0)

  const totalFocusMinutesToday = analyticsData?.summary?.totalFocusMinutes ??
    sessions.filter((s) => s.status === 'COMPLETED').reduce((acc, s) => acc + (s.durationMinutes || 0), 0)

  const completedSessionsCount = analyticsData?.summary?.sessionsCompleted ??
    sessions.filter((s) => s.status === 'COMPLETED').length

  const sortedSessions = React.useMemo(() => {
    return getSortedScheduleSessions(sessions, activeSession)
  }, [sessions, activeSession])


  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const q = topSearchQuery.trim().toLowerCase()
  const searchFilter = (m: Mission) => {
    if (!q) return true
    return m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q))
  }

  const inProgM = missions.filter((m) => {
    if (!searchFilter(m)) return false
    if (activeSession) {
      const matchesActive =
        m.title.toLowerCase() === activeSession.name.toLowerCase() ||
        (activeSession.intention && m.title.toLowerCase() === activeSession.intention.toLowerCase())
      if (matchesActive) return true
    }
    return m.status === 'IN_PROGRESS'
  })

  const compM = missions.filter((m) => m.status === 'COMPLETED' && searchFilter(m))
  const inProgIds = new Set(inProgM.map((m) => m.id))
  const pendM = missions.filter((m) => m.status !== 'COMPLETED' && !inProgIds.has(m.id) && searchFilter(m))

  const displayInProgress = inProgM.length > 0 ? inProgM : (activeSession && pendM.length > 0 ? [pendM[0]] : [])
  const displayPending = displayInProgress.length > 0 && pendM.length > 0 && displayInProgress[0].id === pendM[0].id
    ? pendM.slice(1)
    : pendM

  const completedGoalIds = new Set(goals.filter((goal) => goal.status === 'COMPLETED').map((goal) => goal.id))
  const firstActionableMission = missions.find(
    (mission) => mission.status !== 'COMPLETED' && !completedGoalIds.has(mission.goalId),
  ) || null

  const primaryActionTask = activeSession
    ? null
    : (nextActionMission || (displayPending.find((mission) => !completedGoalIds.has(mission.goalId)) || firstActionableMission))
  const primaryActionGoal = primaryActionTask ? goals.find((g) => g.id === primaryActionTask.goalId) : null

  const recentDebriefsList = analyticsData?.recentDebriefs && analyticsData.recentDebriefs.length > 0
    ? analyticsData.recentDebriefs
    : []

  const renderFlightDeckCard = (task: Mission) => {
    const parentGoal = goals.find((g) => g.id === task.goalId)
    const isDone = task.status === 'COMPLETED'
    const isActive = activeSession && (
      task.title.toLowerCase() === activeSession.name.toLowerCase() ||
      (activeSession.intention && task.title.toLowerCase() === activeSession.intention.toLowerCase())
    )
    const hasOpenMenu = activeTaskMenu?.task.id === task.id

    return (
      <div
        key={task.id}
        className={`flight-deck-card ${isActive ? 'is-active-sprint' : ''} ${hasOpenMenu ? 'has-open-menu' : ''} ${isDone ? 'is-completed' : ''}`}
        onClick={() => {
          if (hasOpenMenu) {
            setActiveTaskMenu(null)
            return
          }
          setInspectingMission(task)
        }}
        title="Click to view task details"
      >
        <div className="card-top-row">
          <div className="card-title-group">
            <button
              type="button"
              className={`card-check-btn ${isDone ? 'checked' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleMissionComplete(task.id)
              }}
              title={isDone ? 'Completed (click to toggle)' : 'Mark task complete'}
              aria-label={isDone ? 'Completed' : 'Mark task complete'}
            >
              {isDone && <Icon name="check" size={14} />}
            </button>
            <h3 className={`card-title ${isDone ? 'completed-title' : ''}`}>
              {task.title}
            </h3>
          </div>
          <div className="card-menu-container" onClick={(e) => e.stopPropagation()}>
            <button
              className={`card-menu-btn ${hasOpenMenu ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setActiveTaskMenu((prev) => (prev?.task.id === task.id ? null : { task, rect }))
              }}
              title="Task actions"
              aria-label="Task actions"
              aria-expanded={hasOpenMenu}
            >
              ···
            </button>
          </div>
        </div>

        <div className="card-context-row">
          {parentGoal ? (
            <span className="card-goal-tag" title={`Goal: ${parentGoal.title}`}>
              <Icon name="target" size={11} />
              <span>{parentGoal.title}</span>
            </span>
          ) : (
            <span className="card-goal-tag">General</span>
          )}
        </div>

        <div className="card-meta-row">
          <div className="card-meta-left">
            <span className="card-duration-chip">
              <Icon name="clock" size={12} />
              <span>{task.estimatedMinutes || 25}m</span>
            </span>
            <span className={`card-priority-chip ${isDone ? 'done' : isActive ? 'active' : ''}`}>
              {isDone ? 'Completed' : isActive ? 'Active' : 'Ready'}
            </span>
          </div>

          {!isDone ? (
            <button
              className="card-quick-arm-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleArmMissionAsSession(task.title, task.estimatedMinutes || undefined)
              }}
              title="Start Focus Session"
            >
              <Icon name="play" size={12} />
              <span>Start Focus</span>
            </button>
          ) : (
            <span className="card-done-badge" title="Task Completed">
              <Icon name="check" size={12} />
              <span>Done</span>
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="shinpo-flight-deck shinpo-dashboard">
      {/* Floating Task Actions Portal Menu */}
      {activeTaskMenu && typeof document !== 'undefined' && createPortal(
        (() => {
          const { task, rect } = activeTaskMenu
          const isDone = task.status === 'COMPLETED'
          const menuWidth = 175
          const menuHeight = 160
          const spaceBelow = window.innerHeight - rect.bottom
          const openUp = spaceBelow < menuHeight + 12

          const top = openUp ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6
          const left = Math.max(10, Math.min(window.innerWidth - menuWidth - 16, rect.right - menuWidth))

          return (
            <>
              <div
                className="card-menu-backdrop-overlay"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveTaskMenu(null)
                }}
              />
              <div
                className={`flight-deck-card-menu portal-menu ${openUp ? 'menu-open-up' : 'menu-open-down'}`}
                style={{
                  position: 'fixed',
                  top: `${top}px`,
                  left: `${left}px`,
                  width: `${menuWidth}px`,
                  right: 'auto',
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="card-menu-item"
                  onClick={() => {
                    setActiveTaskMenu(null)
                    setInspectingMission(task)
                  }}
                >
                  <Icon name="sparkle" size={13} />
                  <span>View Details</span>
                </button>
                {!isDone && (
                  <button
                    className="card-menu-item"
                    onClick={() => {
                      setActiveTaskMenu(null)
                      handleArmMissionAsSession(task.title, task.estimatedMinutes || undefined)
                    }}
                  >
                    <Icon name="play" size={13} />
                    <span>Start Focus</span>
                  </button>
                )}
                {!isDone && (
                  <button
                    className="card-menu-item"
                    onClick={() => {
                      setActiveTaskMenu(null)
                      handleToggleMissionComplete(task.id)
                    }}
                  >
                    <Icon name="check" size={13} />
                    <span>Mark Done</span>
                  </button>
                )}
                <div className="card-menu-divider" />
                <button
                  className="card-menu-item action-delete"
                  onClick={() => {
                    setActiveTaskMenu(null)
                    handleDeleteMission(task.id, task.title)
                  }}
                  disabled={deletingMissionId === task.id}
                >
                  <Icon name="trash" size={13} />
                  <span>{deletingMissionId === task.id ? 'Deleting...' : 'Delete Task'}</span>
                </button>
              </div>
            </>
          )
        })(),
        document.body
      )}

      {/* 1. Header Bar: Compact Greeting, Live Clock & Direct Actions */}
      <header className="dashboard-header-bar">
        <div className="header-greeting-block">
          <h1 className="header-greeting-title">
            {greeting}, <span className="greeting-highlight">{currentUser?.username || 'Executive'}</span>
            {currentUser?.username?.startsWith('user_s1_') && (
              <span className="test-data-badge" title="Automated Verification Account">Test Account</span>
            )}
          </h1>
          <p className="header-greeting-sub">
            Here is your priority focus and execution plan for today.
          </p>
        </div>

        <LiveClock />

        <div className="header-actions-group">
          {sentinelStatus && (
            <div
              className={`sentinel-badge-pill ${sentinelStatus.status === 'ACTIVE_DEFENSE' ? 'active-defense' : 'standby'}`}
              onClick={() => setActiveTab('Task Manager')}
              title={`Focus Protection: ${sentinelStatus.enforcementMode} • ${sentinelStatus.totalInterceptedToday} intercepted today`}
            >
              <span className="sentinel-mini-dot" />
              <span>
                {sentinelStatus.status === 'ACTIVE_DEFENSE'
                  ? 'Protection: Active Defense'
                  : 'Protection: Standby'}
              </span>
            </div>
          )}

          <button
            className="btn-header-action secondary"
            onClick={() => {
              if (goals.length > 0) {
                setQuickMissionGoalId(goals[0].id)
                setIsCreatingQuickMission(true)
              } else {
                setActiveTab('Goals & Missions')
              }
            }}
            title="Create a new task"
          >
            <Icon name="plus" size={13} />
            <span>New Task</span>
          </button>
        </div>
      </header>

      {/* 2. Performance Summary Metrics (4 Balanced Cards) */}
      <section className="dashboard-metrics-grid" aria-label="Performance Metrics">
        {/* Metric 1: Active Goals */}
        <div
          className="dashboard-metric-card"
          onClick={() => setActiveTab('Goals & Missions')}
          title="View all goals"
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Active Goals</span>
            <div className="metric-icon-box coral">
              <Icon name="target" size={16} />
            </div>
          </div>
          <div className="metric-card-value">{goals.length}</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">
              {completedMissionsCount} {completedMissionsCount === 1 ? 'task' : 'tasks'} completed
            </span>
          </div>
        </div>

        {/* Metric 2: Focus Logged */}
        <div
          className="dashboard-metric-card"
          onClick={() => setActiveTab('Analytics')}
          title="View Focus Analytics"
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Focus Logged</span>
            <div className="metric-icon-box green">
              <Icon name="focus" size={16} />
            </div>
          </div>
          <div className="metric-card-value">{totalFocusMinutesToday}m</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">{completedSessionsCount} sessions completed</span>
          </div>
        </div>

        {/* Metric 3: Tasks in Queue */}
        <div
          className="dashboard-metric-card"
          onClick={() => {
            const board = document.querySelector('.flight-deck-board-panel')
            if (board) board.scrollIntoView({ behavior: 'smooth' })
          }}
          title="View Tasks Board"
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Tasks In Queue</span>
            <div className="metric-icon-box cyan">
              <Icon name="clock" size={16} />
            </div>
          </div>
          <div className="metric-card-value">{displayInProgress.length + displayPending.length}</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">{compM.length} finished today</span>
          </div>
        </div>

        {/* Metric 4: Task Completion Rate */}
        <div
          className="dashboard-metric-card"
          onClick={() => setActiveTab('Analytics')}
          title="View Execution Analytics"
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Completion Rate</span>
            <div className="metric-icon-box purple">
              <Icon name="analytics" size={16} />
            </div>
          </div>
          <div className="metric-card-value">{velocityRate}%</div>
          <div className="metric-card-footer completion-footer">
            <span className="metric-card-sub">Velocity rate this week</span>
            <div className="metric-progress-track">
              <div
                className="metric-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, velocityRate))}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Upper Cockpit Grid: Priority Hero Card + Today's Schedule & EONPAI Recommendations */}
      <section className="dashboard-cockpit-grid" aria-label="Execution Cockpit">
        {/* Priority Hero Card (Primary Execution Anchor) */}
        <section
          className={`priority-hero-card ${!activeSession && !primaryActionTask ? 'is-complete-state' : ''}`}
          aria-label="Today's Priority"
        >
            {activeSession ? (
              <div className="hero-content active-sprint">
                <div className="hero-card-header">
                  <div className="hero-tag-group">
                    <span className="hero-status-pill active">
                      <span className="hero-pulse-dot" />
                      <span>{activeSession.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE FOCUS SPRINT'}</span>
                    </span>
                    {activeGraceWarning && (
                      <span className="hero-status-pill grace">
                        <Icon name="clock" size={12} />
                        <span>Grace: {formatTimerDigits(graceSecondsLeft)} ({activeGraceWarning.processName})</span>
                      </span>
                    )}
                    {pendingWarning && (
                      <span className="hero-status-pill warning">
                        <span>Tamper Alert</span>
                      </span>
                    )}
                  </div>
                  <span className="hero-duration-chip">
                    {activeSession.durationMinutes || 25}m Sprint
                  </span>
                </div>

                <div className="hero-session-info">
                  <h2 className="hero-session-title">{activeSession.name}</h2>
                  {activeSession.intention && (
                    <p className="hero-session-intention">{activeSession.intention}</p>
                  )}
                </div>

                <div className="hero-timer-block">
                  <div className="hero-timer-display">
                    {formatTimerDigits(timerSeconds)}
                  </div>
                  <div className="hero-timer-meta">
                    <span>remaining</span>
                  </div>
                </div>

                <div className="hero-progress-track">
                  <div
                    className="hero-progress-bar"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (1 - timerSeconds / ((activeSession.durationMinutes || 25) * 60)) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>

                <div className="hero-actions-row">
                  {activeSession.status === 'ACTIVE' && (
                    <button
                      className="btn-hero-action secondary"
                      onClick={() => handlePause(activeSession.id)}
                      title="Pause focus session"
                    >
                      <Icon name="pause" size={13} />
                      <span>Pause</span>
                    </button>
                  )}
                  {activeSession.status === 'PAUSED' && (
                    <button
                      className="btn-hero-action primary"
                      onClick={() => handleResume(activeSession.id)}
                      title="Resume focus session"
                    >
                      <Icon name="play" size={13} />
                      <span>Resume</span>
                    </button>
                  )}
                  <button
                    className="btn-hero-action primary"
                    onClick={() => setCompletingSessionId(activeSession.id)}
                    title="Complete and record summary"
                  >
                    <Icon name="check" size={13} />
                    <span>Complete & Summarize</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className={`hero-content idle-priority ${!primaryActionTask ? 'completed-priority' : ''}`}>
                <div className="hero-card-header">
                  <div className="hero-tag-group">
                    <span className="hero-status-pill priority">
                      <Icon name="target" size={12} />
                      <span>Today's Priority</span>
                    </span>
                  </div>
                  {primaryActionTask && (
                    <span className="hero-duration-chip">
                      <Icon name="clock" size={12} />
                      <span>{primaryActionTask.estimatedMinutes || 25}m estimated</span>
                    </span>
                  )}
                </div>

                <div className="hero-session-info">
                  {primaryActionTask ? (
                    <>
                      <h2 className="hero-session-title">{primaryActionTask.title}</h2>
                      {primaryActionTask.description ? (
                        <p className="hero-session-desc">{primaryActionTask.description}</p>
                      ) : (
                        <p className="hero-session-desc">Ready for focused execution. Block distraction apps and start your timer.</p>
                      )}
                      <div className="hero-context-line">
                        <span className="hero-goal-tag">
                          <Icon name="target" size={12} />
                          <span>Goal: {primaryActionGoal?.title || 'Execution System'}</span>
                        </span>
                        <span className="hero-scheduled-date">
                          Scheduled for today
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="hero-session-title">All Planned Tasks Complete</h2>
                      <p className="hero-session-desc">
                        You're all caught up! Add a new task or review your goals to maintain momentum.
                      </p>
                    </>
                  )}
                </div>

                <div className="hero-actions-row">
                  {primaryActionTask ? (
                    <button
                      className="btn-hero-action primary"
                      onClick={() => {
                        if (handleEngageNextAction) {
                          handleEngageNextAction()
                        } else if (primaryActionTask) {
                          handleArmMissionAsSession(primaryActionTask.title, primaryActionTask.estimatedMinutes || undefined)
                        }
                      }}
                      title="Start focus session on this task"
                    >
                      <Icon name="play" size={14} />
                      <span>Start Focus Session</span>
                    </button>
                  ) : (
                    <button
                      className="btn-hero-action primary"
                      onClick={() => {
                        if (goals.length > 0) {
                          setQuickMissionGoalId(goals[0].id)
                          setIsCreatingQuickMission(true)
                        } else {
                          setActiveTab('Goals & Missions')
                        }
                      }}
                      title="Add new task"
                    >
                      <Icon name="plus" size={14} />
                      <span>Add New Task</span>
                    </button>
                  )}
                  <button
                    className="btn-hero-action secondary"
                    onClick={() => {
                      const board = document.getElementById('tasks-board')
                      if (board) {
                        board.scrollIntoView({ behavior: 'smooth' })
                      } else {
                        setActiveTab('Goals & Missions')
                      }
                    }}
                    title="View all tasks in board"
                  >
                    <span>View All Tasks</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Today's Schedule Card */}
          <section className="dashboard-sidecar-card schedule-card" aria-label="Today's Schedule">
            <div className="sidecar-card-header">
              <div className="sidecar-header-left">
                <div className="sidecar-icon-box blue">
                  <Icon name="schedule" size={16} />
                </div>
                <h3 className="sidecar-card-title">Today's Schedule</h3>
              </div>
              <button
                className="sidecar-icon-btn"
                onClick={() => setActiveTab('Schedule')}
                title="Open Schedule"
              >
                <Icon name="arrow-up-right" size={13} />
              </button>
            </div>

            <div className="sidecar-body">
              {sortedSessions.length > 0 ? (
                <div className="schedule-sessions-list">
                  {sortedSessions.slice(0, 4).map((s, idx) => {
                    const isActive = s.status === 'ACTIVE' || s.status === 'PAUSED' || (activeSession && activeSession.id === s.id)
                    const isDone = s.status === 'COMPLETED'
                    const canStart = s.status === 'SCHEDULED' && !activeSession
                    const secondaryInfo = getSessionSecondaryInfo(s)

                    return (
                      <div
                        key={s.id}
                        className={`schedule-session-item ${canStart ? 'is-startable' : ''} ${isDone ? 'is-completed' : ''} ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          if (canStart) void handleStartFromSchedule(s.id)
                        }}
                      >
                        <div className="schedule-item-time">
                          <span className={`schedule-time-pill ${isDone ? 'done' : s.status === 'PAUSED' ? 'paused' : isActive ? 'active' : ''}`}>
                            {isDone ? '✓' : s.status === 'PAUSED' ? '❚❚' : isActive ? '▶' : idx + 1}
                          </span>
                        </div>
                        <div className="schedule-item-details">
                          <span className="schedule-session-name" title={s.name}>{s.name}</span>
                          <span className="schedule-session-sub" title={secondaryInfo}>
                            {secondaryInfo}
                          </span>
                        </div>
                        <div className="schedule-item-badge">
                          <span className={`duration-pill ${isDone ? 'done' : s.status === 'PAUSED' ? 'paused' : isActive ? 'active' : ''}`}>
                            {isDone ? 'Done' : s.status === 'PAUSED' ? 'Paused' : isActive ? 'Active' : `${s.durationMinutes}m`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : recentDebriefsList.length > 0 ? (
                <div className="schedule-sessions-list">
                  {recentDebriefsList.slice(0, 4).map((d) => {
                    const secondaryText =
                      d.accomplishment &&
                      d.accomplishment.trim().toLowerCase() !== d.sessionName.trim().toLowerCase()
                        ? d.accomplishment.trim()
                        : `${d.durationMinutes}m focus logged`

                    return (
                      <div
                        key={d.sessionId}
                        className="schedule-session-item is-completed"
                      >
                        <div className="schedule-item-time">
                          <span className="schedule-time-pill">✓</span>
                        </div>
                        <div className="schedule-item-details">
                          <span className="schedule-session-name" title={d.sessionName}>{d.sessionName}</span>
                          <span className="schedule-session-sub" title={secondaryText}>
                            {secondaryText}
                          </span>
                        </div>
                        <div className="schedule-item-badge">
                          <span className="duration-pill done">{d.durationMinutes}m</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="sidecar-empty-state">
                  <span>No scheduled sessions today</span>
                  <button
                    className="empty-action-link"
                    onClick={() => setActiveTab('Schedule')}
                  >
                    Schedule Focus Block
                  </button>
                </div>
              )}
            </div>

            <div className="sidecar-footer">
              <span className="sidecar-footer-meta">
                {sortedSessions.length > 0 ? `${sortedSessions.length} total today` : 'Ready to plan'}
              </span>
              <button
                className="sidecar-footer-action"
                onClick={() => setActiveTab('Schedule')}
              >
                + Schedule Focus Block
              </button>
            </div>
          </section>
      </section>

      {/* 4. Full-Width Tasks Board (Uses 100% available width beneath priority & schedule) */}
      <section className="flight-deck-board-panel full-width-board" id="tasks-board" aria-label="Tasks Board">
        <div className="board-panel-header">
          <div className="board-header-left">
            <h2 className="board-panel-title">Tasks Board</h2>
            <div className="board-status-summary">
              <span className="summary-pill active">
                {displayInProgress.length + displayPending.length} in progress & ready
              </span>
              <span className="summary-pill completed">
                {compM.length} completed
              </span>
            </div>
          </div>

          <div className="board-header-actions">
            {topSearchQuery && (
              <div className="board-filter-indicator">
                <span>Filtering: "{topSearchQuery}"</span>
                <button onClick={() => setTopSearchQuery?.('')} title="Clear filter">×</button>
              </div>
            )}
            <button
              className="board-action-btn primary"
              onClick={() => {
                if (goals.length > 0) {
                  setQuickMissionGoalId(goals[0].id)
                  setIsCreatingQuickMission(true)
                } else {
                  setActiveTab('Goals & Missions')
                }
              }}
              title="Add a new task"
            >
              <Icon name="plus" size={13} />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        <div className="flight-deck-board-grid">
          {/* Column 1: In Progress */}
          <div className="status-column col-in-progress">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-coral" />
                <span className="column-title-text">In Progress</span>
              </div>
              <span className="column-count-badge">{displayInProgress.length}</span>
            </div>

            <div className="status-column-cards">
              {displayInProgress.length > 0 ? (
                <>
                  {displayInProgress.slice(0, 3).map((t) => renderFlightDeckCard(t))}
                  {displayInProgress.length > 3 && (
                    <button
                      type="button"
                      className="board-view-remaining-btn"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('PENDING') : setActiveTab('Goals & Missions')}
                    >
                      View {displayInProgress.length - 3} remaining {displayInProgress.length - 3 === 1 ? 'task' : 'tasks'} →
                    </button>
                  )}
                </>
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="clock" size={16} />
                  </div>
                  <span className="empty-title">No active focus session</span>
                  <span className="empty-subtitle">Select a ready task below or start your priority session.</span>
                  {displayPending.length > 0 && (
                    <button
                      className="empty-action-link"
                      onClick={() => handleArmMissionAsSession(displayPending[0].title, displayPending[0].estimatedMinutes || 25)}
                    >
                      Start Next Focus Session
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Ready */}
          <div className="status-column col-backlog">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-cyan" />
                <span className="column-title-text">Ready</span>
              </div>
              <span className="column-count-badge">{displayPending.length}</span>
            </div>

            <div className="status-column-cards">
              {displayPending.length > 0 ? (
                <>
                  {displayPending.slice(0, 3).map((t) => renderFlightDeckCard(t))}
                  {displayPending.length > 3 && (
                    <button
                      type="button"
                      className="board-view-remaining-btn"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('PENDING') : setActiveTab('Goals & Missions')}
                    >
                      View {displayPending.length - 3} remaining {displayPending.length - 3 === 1 ? 'task' : 'tasks'} →
                    </button>
                  )}
                </>
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="target" size={16} />
                  </div>
                  <span className="empty-title">No tasks queued</span>
                  <span className="empty-subtitle">Create a task to plan your next session.</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="status-column col-completed">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-emerald" />
                <span className="column-title-text">Completed</span>
              </div>
              <span className="column-count-badge">{compM.length}</span>
            </div>

            <div className="status-column-cards">
              {compM.length > 0 ? (
                <>
                  {compM.slice(0, 3).map((t) => renderFlightDeckCard(t))}
                  {compM.length > 3 && (
                    <button
                      type="button"
                      className="board-view-remaining-btn"
                      onClick={() => onNavigateToTasks ? onNavigateToTasks('COMPLETED') : setActiveTab('Goals & Missions')}
                    >
                      View {compM.length - 3} remaining {compM.length - 3 === 1 ? 'task' : 'tasks'} →
                    </button>
                  )}
                </>
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="check-circle" size={16} />
                  </div>
                  <span className="empty-title">No completed tasks yet</span>
                  <span className="empty-subtitle">Finished tasks from your focus sessions will be cataloged here.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Task Details Modal */}
      {inspectingMission && (
        <div className="taskmaster-modal-overlay" onClick={() => setInspectingMission(null)}>
          <div className="taskmaster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge-tag red">TASK DETAILS</span>
                <span className="badge-tag blue">{inspectingMission.estimatedMinutes || 25}m Session</span>
              </div>
              <button className="modal-close-icon-btn" onClick={() => setInspectingMission(null)}>
                <Icon name="close" size={14} />
              </button>
            </div>

            <h3 className="modal-mission-title">{inspectingMission.title}</h3>
            {inspectingMission.description && (
              <p className="modal-mission-desc">{inspectingMission.description}</p>
            )}

            <div className="modal-meta-grid">
              <div className="modal-meta-item">
                <span className="meta-label">STATUS</span>
                <span className="meta-val">{inspectingMission.status || 'PENDING'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="meta-label">FOCUS DURATION</span>
                <span className="meta-val">{inspectingMission.estimatedMinutes || 25} Minutes</span>
              </div>
              <div className="modal-meta-item">
                <span className="meta-label">FOCUS PROTECTION</span>
                <span className="meta-val highlight-red">READY</span>
              </div>
            </div>

            <div className="modal-action-footer">
              <button
                className="modal-btn-arm-sprint"
                onClick={() => {
                  handleArmMissionAsSession(inspectingMission.title, inspectingMission.estimatedMinutes ?? undefined)
                  setInspectingMission(null)
                }}
              >
                <Icon name="play" size={14} />
                <span>Start Focus Session</span>
              </button>
              {inspectingMission.id > 0 && inspectingMission.status !== 'COMPLETED' && (
                <button
                  className="modal-btn-complete"
                  onClick={() => {
                    handleToggleMissionComplete(inspectingMission.id)
                    setInspectingMission(null)
                  }}
                >
                  <Icon name="check" size={14} />
                  <span>Mark Done</span>
                </button>
              )}
              <button
                className="modal-btn-deconstruct"
                onClick={() => {
                  setActiveTab('AI Assistant')
                  handleAiSend?.(`Deconstruct this task into concrete micro-steps: "${inspectingMission.title}"`)
                  setInspectingMission(null)
                }}
              >
                <span>Ask EONPAI</span>
              </button>
              {inspectingMission.id > 0 && (
                <button
                  className="modal-btn-delete"
                  onClick={() => {
                    handleDeleteMission(inspectingMission.id, inspectingMission.title)
                  }}
                  disabled={deletingMissionId === inspectingMission.id}
                  title="Delete this task permanently"
                >
                  <Icon name="trash" size={14} />
                  <span>{deletingMissionId === inspectingMission.id ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
