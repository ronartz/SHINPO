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
import { deriveOverallProtectionStatus, formatEnforcementMode } from '../utils/focusProtectionStatus'
import { guardianCapabilityLabel, guardianModeLabel } from '../utils/guardianCapability'
import { trackRender } from '../utils/renderTracker'
import { getTodayScheduleSessions, getSessionSecondaryInfo, isMissionInFocusSession } from '../utils/scheduleHelpers'
import { DashboardInsights } from '../components/dashboard/DashboardInsights'
import { getDashboardTaskState } from '../utils/dashboardTaskState'
import { formatCount } from '../utils/pluralize'

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
  onOpenAchievements?: () => void
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
  setActiveTab,
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
  onNavigateToTasks,
}) => {
  const protectionInfo = sentinelStatus ? deriveOverallProtectionStatus(sentinelStatus) : null
  trackRender('OverviewView')

  const totalMissionsCount = missions.length
  const completedMissionsCount = missions.filter((m) => m.status === 'COMPLETED').length
  const dashboardTaskState = getDashboardTaskState(missions)
  const totalFocusMinutesToday = analyticsData?.summary?.totalFocusMinutes ??
    sessions.filter((s) => s.status === 'COMPLETED').reduce((acc, s) => acc + (s.durationMinutes || 0), 0)

  const sortedSessions = React.useMemo(() => {
    return getTodayScheduleSessions(sessions, activeSession)
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
      if (isMissionInFocusSession(m, activeSession)) return true
    }
    return m.status === 'IN_PROGRESS'
  })


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
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const todayMissions = missions
    .filter((mission) => mission.scheduledDate?.slice(0, 10) === todayKey)
    .sort((a, b) => a.status === 'COMPLETED' ? 1 : b.status === 'COMPLETED' ? -1 : a.id - b.id)
  const activeGoals = goals.filter((goal) => goal.status.toUpperCase() !== 'COMPLETED')

  const renderFlightDeckCard = (task: Mission) => {
    const parentGoal = goals.find((g) => g.id === task.goalId)
    const isDone = task.status === 'COMPLETED'
    const isActive = isMissionInFocusSession(task, activeSession)
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
              className={`sentinel-badge-pill ${protectionInfo?.badgeVariant || 'offline'}`}
              onClick={() => setActiveTab('Task Manager')}
              title={sentinelStatus.interventionCapability !== undefined
                ? `Automatic Guardian: ${guardianModeLabel(sentinelStatus.guardianMode)} · ${sentinelStatus.guardianWarningCount ?? 0} app observations today · ${guardianCapabilityLabel(sentinelStatus.interventionCapability)}`
                : `Focus Protection: ${formatEnforcementMode(sentinelStatus.enforcementMode)} · ${sentinelStatus.totalInterceptedToday} reported today`}
            >
              <span className="sentinel-mini-dot" />
              <span>
                Protection: {protectionInfo?.badgeText}
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
        {/* Metric 1: Focus time */}
        <button
          type="button"
          className="dashboard-metric-card"
          onClick={() => setActiveTab('Analytics')}
          title="View focus analytics"
          aria-label={`View focus analytics: ${totalFocusMinutesToday} minutes recorded`}
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Focus time</span>
            <div className="metric-icon-box blue" aria-hidden="true"><Icon name="clock" size={20} /></div>
          </div>
          <div className="metric-card-value">{totalFocusMinutesToday >= 60 ? `${Math.floor(totalFocusMinutesToday / 60)}h ${totalFocusMinutesToday % 60}m` : `${totalFocusMinutesToday}m`}</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">Recorded focus time</span>
          </div>
        </button>

        {/* Metric 2: Tasks completed */}
        <button
          type="button"
          className="dashboard-metric-card metric-tasks"
          onClick={() => setActiveTab('Goals & Missions')}
          title="View tasks"
          aria-label={`View tasks: ${completedMissionsCount} of ${totalMissionsCount} complete`}
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Tasks completed</span>
            <div className="metric-icon-box blue" aria-hidden="true"><Icon name="check-circle" size={20} /></div>
          </div>
          <div className="metric-card-value">{completedMissionsCount} <small>/ {totalMissionsCount}</small></div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">Tasks finished in your workspace</span>
          </div>
        </button>

        {/* Metric 3: Active goals */}
        <button
          type="button"
          className="dashboard-metric-card"
          onClick={() => setActiveTab('Goals & Missions')}
          title="View active goals"
          aria-label={`View goals: ${activeGoals.length} active`}
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Active goals</span>
            <div className="metric-icon-box orange" aria-hidden="true"><Icon name="target" size={20} /></div>
          </div>
          <div className="metric-card-value">{activeGoals.length}</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">Goals in progress</span>
          </div>
        </button>

        {/* Metric 4: Open tasks */}
        <button
          type="button"
          className="dashboard-metric-card"
          onClick={() => onNavigateToTasks?.('PENDING')}
          title="View open tasks"
          aria-label={`${dashboardTaskState.remaining} open tasks`}
        >
          <div className="metric-card-top">
            <span className="metric-card-label">Open tasks</span>
            <div className="metric-icon-box purple" aria-hidden="true"><Icon name="target" size={20} /></div>
          </div>
          <div className="metric-card-value">{dashboardTaskState.remaining}</div>
          <div className="metric-card-footer">
            <span className="metric-card-sub">Tasks not yet completed</span>
          </div>
        </button>
      </section>

      {/* 3. Upper Cockpit Grid: Priority Hero Card + Today's Schedule & EONPAI Recommendations */}
      <section className="dashboard-cockpit-grid" aria-label="Dashboard">
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
                      <h2 className="hero-session-title">{dashboardTaskState.state === 'EMPTY' ? 'Nothing planned yet' : activeSession ? 'Focus session in progress' : dashboardTaskState.state === 'IN_PROGRESS' ? 'Open tasks need attention' : 'All planned tasks complete'}</h2>
                      <p className="hero-session-desc">
                        {dashboardTaskState.state === 'EMPTY'
                          ? 'Add a task to start planning your next step.'
                          : activeSession
                          ? `You have ${formatCount(dashboardTaskState.remaining, 'open task')}. Return to your current Focus session when you are ready.`
                            : dashboardTaskState.state === 'IN_PROGRESS'
                            ? `${formatCount(dashboardTaskState.remaining, 'task')} of ${dashboardTaskState.total} remain open. Review them in Goals & Tasks.`
                              : 'You have completed every task in your workspace.'}
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
                      <span>Add Task</span>
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
                            {isDone ? <Icon name="check" size={12} /> : s.status === 'PAUSED' ? <Icon name="pause" size={12} /> : isActive ? <Icon name="play" size={12} /> : idx + 1}
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
                          <span className="schedule-time-pill" aria-hidden="true"><Icon name="check" size={12} /></span>
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
                  <div className="sidecar-empty-icon" aria-hidden="true">
                    <Icon name="schedule" size={26} />
                  </div>
                  <strong className="sidecar-empty-title">No scheduled sessions</strong>
                  <p className="sidecar-empty-desc">Plan focus blocks to structure your deep work today.</p>
                  <button
                    className="sidecar-empty-action-btn"
                    onClick={() => setActiveTab('Schedule')}
                  >
                    Schedule Focus Block
                  </button>
                </div>
              )}
            </div>

            <div className="sidecar-footer">
              <span className="sidecar-footer-meta">
                {sortedSessions.length > 0 ? `${sortedSessions.length} total today` : 'Calendar sync active · Ready to plan'}
              </span>
              {sortedSessions.length > 0 && (
                <button
                  className="sidecar-footer-action"
                  onClick={() => setActiveTab('Schedule')}
                >
                  + Schedule Focus Block
                </button>
              )}
            </div>
          </section>

          <DashboardInsights analyticsData={analyticsData} setActiveTab={setActiveTab} />

          <section className="dashboard-sidecar-card dashboard-quick-actions" aria-label="Quick actions">
            <header className="dashboard-reference-card-heading">
              <h2>Quick actions</h2><span aria-hidden="true"><Icon name="sparkle" size={17} /></span>
            </header>
            <div className="dashboard-quick-action-grid">
              <button type="button" onClick={() => activeSession ? setActiveTab('Focus Engine') : primaryActionTask ? handleEngageNextAction ? handleEngageNextAction() : handleArmMissionAsSession(primaryActionTask.title, primaryActionTask.estimatedMinutes || undefined) : setActiveTab('Focus Engine')}>
                <span aria-hidden="true"><Icon name={activeSession ? 'clock' : 'play'} size={20} /></span><strong>{activeSession ? 'Return to focus' : 'Start focus'}</strong><small>{activeSession ? 'Open the live timer' : `${primaryActionTask?.estimatedMinutes || 25} min session`}</small>
              </button>
              <button type="button" onClick={() => setActiveTab('Schedule')}>
                <span aria-hidden="true"><Icon name="calendar" size={20} /></span><strong>Book session</strong><small>Schedule focus time</small>
              </button>
              <button type="button" onClick={() => goals.length ? (setQuickMissionGoalId(goals[0].id), setIsCreatingQuickMission(true)) : setActiveTab('Goals & Missions')}>
                <span aria-hidden="true"><Icon name="plus" size={20} /></span><strong>New task</strong><small>Add a task</small>
              </button>
              <button type="button" onClick={() => setActiveTab('Goals & Missions')}>
                <span aria-hidden="true"><Icon name="target" size={20} /></span><strong>New goal</strong><small>Set a goal</small>
              </button>
            </div>
          </section>
      </section>

      <section className="dashboard-bottom-grid" aria-label="Goals and today's tasks">
        <article className="dashboard-reference-panel">
          <header className="dashboard-reference-card-heading"><h2>Active goals</h2><button type="button" onClick={() => setActiveTab('Goals & Missions')}>View all <Icon name="arrow-up-right" size={13} /></button></header>
          {activeGoals.length ? <ul className="dashboard-goals-list">{activeGoals.slice(0, 3).map((goal) => {
            const goalTasks = missions.filter((mission) => mission.goalId === goal.id)
            const complete = goalTasks.filter((mission) => mission.status === 'COMPLETED').length
            const percent = goalTasks.length ? Math.round(complete / goalTasks.length * 100) : 0
            return <li key={goal.id}><div className="dashboard-goal-name"><span aria-hidden="true"><Icon name="target" size={17} /></span><strong title={goal.title}>{goal.title}</strong><b>{percent}%</b></div><small>{goal.description || 'Keep making progress toward this goal.'}</small><div className="dashboard-goal-bar"><span style={{ width: `${percent}%` }} /></div></li>
          })}</ul> : (
            <div className="dashboard-reference-empty">
              <div className="dashboard-empty-icon-wrap" aria-hidden="true">
                <Icon name="target" size={26} />
              </div>
              <strong className="dashboard-empty-title">No active goals yet</strong>
              <p className="dashboard-empty-desc">Define meaningful outcomes to orient your daily tasks and focus sessions.</p>
              <button type="button" className="dashboard-empty-btn" onClick={() => setActiveTab('Goals & Missions')}>Create a goal</button>
            </div>
          )}
        </article>

        <article className="dashboard-reference-panel dashboard-today-tasks">
          <header className="dashboard-reference-card-heading"><span><h2>Today's tasks</h2><small>{todayMissions.length} planned</small></span><button type="button" onClick={() => setActiveTab('Goals & Missions')}>View all <Icon name="arrow-up-right" size={13} /></button></header>
          {todayMissions.length ? <div className="dashboard-today-task-list">{todayMissions.slice(0, 5).map((task) => renderFlightDeckCard(task))}</div> : (
            <div className="dashboard-reference-empty">
              <div className="dashboard-empty-icon-wrap" aria-hidden="true">
                <Icon name="journal" size={26} />
              </div>
              <strong className="dashboard-empty-title">No tasks planned for today</strong>
              <p className="dashboard-empty-desc">Select an active goal and queue 25-minute focus sprints.</p>
              <button type="button" className="dashboard-empty-btn" onClick={() => goals.length ? (setQuickMissionGoalId(goals[0].id), setIsCreatingQuickMission(true)) : setActiveTab('Goals & Missions')}>Add a task</button>
            </div>
          )}
        </article>
      </section>

      {/* Task Details Modal */}
      {inspectingMission && (
        <div className="taskmaster-modal-overlay" onClick={() => setInspectingMission(null)}>
          <div className="taskmaster-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  handleAiSend?.(`Break this task into concrete next steps: "${inspectingMission.title}"`)
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
