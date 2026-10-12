import React from 'react'
import { createPortal } from 'react-dom'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { FocusSession } from '../api/focusSessions'
import type { ExecutiveBriefing } from '../api/ai'
import type { AnalyticsDashboardResponse } from '../api/analytics'
import type { SentinelStatus, SentinelWarningItem } from '../api/device'
import type { AppView } from '../types/navigation'
import { Icon } from '../components/common/Icon'
import { formatTimerDigits } from '../utils/focusTimer'

export interface OverviewViewProps {
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
  isCreatingQuickMission: boolean
  setIsCreatingQuickMission: (creating: boolean) => void
  quickMissionTitle: string
  setQuickMissionTitle: (title: string) => void
  quickMissionGoalId: number | null
  setQuickMissionGoalId: (goalId: number | null) => void
  quickMissionDuration: number
  setQuickMissionDuration: (duration: number) => void
  isSubmittingQuickMission: boolean
  quickMissionError: string | null
  setQuickMissionError?: (err: string | null) => void
  handleQuickCreateMission: (e: React.FormEvent) => void
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
}

import { trackRender } from '../utils/renderTracker'

export const OverviewView: React.FC<OverviewViewProps> = ({
  missions,
  goals,
  sessions,
  activeSession,
  sentinelStatus,
  executiveBriefing,
  isBriefingExpanded,
  setIsBriefingExpanded,
  briefingLoading,
  analyticsData,
  topSearchQuery,
  setTopSearchQuery,
  setActiveTab,
  handleArmMissionAsSession,
  handleToggleMissionComplete,
  handleDeleteMission,
  deletingMissionId,
  handleStartFromSchedule,
  isCreatingQuickMission,
  setIsCreatingQuickMission,
  quickMissionTitle,
  setQuickMissionTitle,
  quickMissionGoalId,
  setQuickMissionGoalId,
  quickMissionDuration,
  setQuickMissionDuration,
  isSubmittingQuickMission,
  quickMissionError,
  setQuickMissionError,
  handleQuickCreateMission,
  inspectingMission,
  setInspectingMission,
  activeTaskMenu,
  setActiveTaskMenu,
  handleAiSend,
  refreshBriefing,
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

  const gaugeCircumference = 235.62
  const gaugeOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, velocityRate)) / 100)

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
        className={`flight-deck-card ${isActive ? 'is-active-sprint' : ''} ${hasOpenMenu ? 'has-open-menu' : ''}`}
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
          <h3 className={`card-title ${isDone ? 'completed-title' : ''}`}>
            {task.title}
          </h3>
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
            <span className="card-goal-tag">{parentGoal.title}</span>
          ) : (
            <span className="card-goal-tag">Task</span>
          )}
        </div>

        <div className="card-meta-row">
          <div className="card-meta-left">
            <span className="card-duration-chip">
              <Icon name="clock" size={11} />
              <span>{task.estimatedMinutes || 25}m</span>
            </span>
            <span className="card-priority-chip">
              {isDone ? 'Completed' : isActive ? 'Active Focus' : 'High Priority'}
            </span>
          </div>

          {!isDone && (
            <button
              className="card-quick-arm-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleArmMissionAsSession(task.title, task.estimatedMinutes || undefined)
              }}
              title="Start Focus Session"
            >
              <Icon name="play" size={11} />
              <span>Focus</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="shinpo-flight-deck">
      {/* Task Actions Floating Portal Menu - Completely immune to overflow/scroll clipping */}
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

      {/* AI.9: Executive Command Briefing Card */}
      {executiveBriefing && (
        <section
          className="executive-briefing-banner"
          aria-label="Executive Intelligence Briefing"
          style={{
            marginBottom: 20,
            padding: '18px 24px',
            borderRadius: 'var(--radius-lg, 16px)',
            background: 'linear-gradient(135deg, rgba(255, 77, 94, 0.08) 0%, rgba(20, 22, 28, 0.95) 100%)',
            border: '1px solid rgba(255, 77, 94, 0.22)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--accent-coral, #FF4D5E), #D92B3E)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: '0 0 16px rgba(255, 77, 94, 0.35)',
                }}
              >
                <Icon name="sparkle" size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1, #fff)' }}>
                    {executiveBriefing.executiveHeadline}
                  </span>
                  <span
                    className={`badge-tag ${
                      executiveBriefing.sentinelThreatPosture === 'SECURE'
                        ? 'green'
                        : executiveBriefing.sentinelThreatPosture === 'CONTAINED'
                        ? 'blue'
                        : 'coral'
                    }`}
                    style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700 }}
                  >
                    PROTECTION: {executiveBriefing.sentinelThreatPosture}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3, #8E929E)' }}>
                  EONPAI Executive Briefing • Generated {new Date(executiveBriefing.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn-timer secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={refreshBriefing}
                disabled={briefingLoading}
                title="Refresh Briefing"
              >
                <Icon name="refresh" size={12} />
                <span>{briefingLoading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                className="sidebar-toggle-btn"
                onClick={() => setIsBriefingExpanded((prev) => !prev)}
                title={isBriefingExpanded ? 'Collapse Briefing' : 'Expand Briefing'}
              >
                <Icon name={isBriefingExpanded ? 'chevron' : 'chevron-right'} size={14} />
              </button>
            </div>
          </div>

          {isBriefingExpanded && (
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 14, color: 'var(--text-2, #C5C8D4)', lineHeight: 1.55, margin: '0 0 14px' }}>
                {executiveBriefing.tacticalSummary}
              </p>

              {/* Executive Vital Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Active Goals
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1, #fff)', marginTop: 2 }}>
                    {executiveBriefing.activeGoalsCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Queued Tasks
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                    {executiveBriefing.pendingMissionsCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Focus Logged
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80', marginTop: 2 }}>
                    {executiveBriefing.focusMinutesToday}m
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Goal Progress
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa', marginTop: 2 }}>
                    {executiveBriefing.goalProgressAveragePct}%
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3, #8E929E)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Blocked Distractions
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: executiveBriefing.quarantinedDistractionsToday > 0 ? '#fb7185' : 'var(--text-2, #C5C8D4)', marginTop: 2 }}>
                    {executiveBriefing.quarantinedDistractionsToday}
                  </div>
                </div>
              </div>

              {/* Primary Recommendation Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255, 77, 94, 0.06)',
                  border: '1px solid rgba(255, 77, 94, 0.16)',
                  borderRadius: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="target" size={16} />
                  <span style={{ fontSize: 13, color: 'var(--text-1, #fff)' }}>
                    <strong style={{ color: 'var(--accent-coral, #FF4D5E)' }}>Priority Action:</strong> {executiveBriefing.primaryRecommendation}
                  </span>
                </div>
                <button
                  className="btn-timer primary"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={() => {
                    if (executiveBriefing.pendingMissionsCount > 0) {
                      setActiveTab('Focus Engine')
                    } else {
                      setActiveTab('Goals & Missions')
                    }
                  }}
                >
                  <Icon name="play" size={12} />
                  <span>Start</span>
                </button>
              </div>

              {/* Key Action Items */}
              {executiveBriefing.keyActionItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {executiveBriefing.keyActionItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: 'var(--text-3, #8E929E)',
                      }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-coral, #FF4D5E)' }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Top Tier: Multi-Column Kanban Work Board */}
      <section className="flight-deck-board-panel" aria-label="Tasks Board">
        <div className="board-panel-header">
          <div className="board-header-left">
            <h2 className="board-panel-title">All Tasks</h2>
            <div className="board-status-summary">
              <span className="summary-pill active">
                {displayInProgress.length + displayPending.length} in progress & ready
              </span>
              <span className="summary-pill completed">
                {compM.length} completed
              </span>
              {sentinelStatus && (
                <span
                  className={`summary-pill sentinel-pill ${sentinelStatus.status === 'ACTIVE_DEFENSE' ? 'active-defense' : 'standby'}`}
                  title={`Focus Protection: ${sentinelStatus.enforcementMode} • ${sentinelStatus.totalInterceptedToday} intercepted today.`}
                  onClick={() => setActiveTab('Task Manager')}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="sentinel-mini-dot" />
                  <span>Protection: {sentinelStatus.status.replace('_', ' ')}</span>
                  {sentinelStatus.totalInterceptedToday > 0 && (
                    <span className="sentinel-interception-badge">
                      {sentinelStatus.totalInterceptedToday}
                    </span>
                  )}
                </span>
              )}
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
                  setQuickMissionError?.(null)
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
                displayInProgress.map((t) => renderFlightDeckCard(t))
              ) : (
                <div className="status-column-empty">
                  <span>No task currently running</span>
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
                displayPending.map((t) => renderFlightDeckCard(t))
              ) : (
                <div className="status-column-empty">
                  <span>No tasks queued</span>
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
                compM.map((t) => renderFlightDeckCard(t))
              ) : (
                <div className="status-column-empty">
                  <span>No completed tasks yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Tier: Supporting Cockpit Panels (4 Bento Cards) */}
      <section className="flight-deck-cockpit-grid" aria-label="Supporting Overview Panels">
        {/* PANEL 1: CURRENT FOCUS HERO */}
        <div className="cockpit-panel cockpit-hero-panel">
          <div className="cockpit-panel-header">
            <div className="cockpit-panel-header-left">
              <div className="cockpit-panel-icon">
                <Icon name="focus" size={16} />
              </div>
              <h3 className="cockpit-panel-title">Current Focus</h3>
            </div>
            {pendingWarning ? (
              <span className="hero-session-tag" style={{ background: 'rgba(255, 77, 94, 0.2)', border: '1px solid #FF4D5E', color: '#FF4D5E' }}>
                <span className="hero-pulse-dot" style={{ background: '#FF4D5E' }} />
                <span>WARNING</span>
              </span>
            ) : activeGraceWarning ? (
              <span className="hero-session-tag" style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #F59E0B', color: '#F59E0B' }}>
                <span className="hero-pulse-dot" style={{ background: '#F59E0B' }} />
                <span>GRACE PERIOD ({formatTimerDigits(graceSecondsLeft)})</span>
              </span>
            ) : activeSession?.status === 'ACTIVE' && timerSeconds === 0 ? (
              <span className="hero-session-tag" style={{ background: 'rgba(168, 85, 247, 0.2)', border: '1px solid #A855F7', color: '#A855F7' }}>
                <span>COMPLETE</span>
              </span>
            ) : activeSession ? (
              <span className="hero-session-tag">
                <span className="hero-pulse-dot" />
                <span>{activeSession.status === 'PAUSED' ? 'PAUSED' : 'PROTECTION ACTIVE'}</span>
              </span>
            ) : (
              <span className="hero-idle-shield-tag">
                <span>PROTECTION READY</span>
              </span>
            )}
          </div>

          {activeSession ? (
            <div className="hero-body-active">
              <div className="hero-session-name">{activeSession.name}</div>
              {activeSession.intention && (
                <div className="hero-session-intention">{activeSession.intention}</div>
              )}

              {/* Live Grace Period Countdown Banner in Cockpit */}
              {activeGraceWarning && (
                <div className="sentinel-grace-banner">
                  <div className="grace-banner-left">
                    <span className="grace-banner-icon"><Icon name="clock" size={14} /></span>
                    <div>
                      <div className="grace-banner-title">
                        Grace Window: {activeGraceWarning.processName}
                      </div>
                      <div className="grace-banner-subtitle">
                        Distraction app allowed until countdown expires.
                      </div>
                    </div>
                  </div>
                  <div className="grace-banner-countdown">
                    {formatTimerDigits(graceSecondsLeft)}
                  </div>
                </div>
              )}

              {activeSession.status === 'ACTIVE' && timerSeconds === 0 ? (
                <div className="hero-timer-display" style={{ fontSize: 13, color: 'var(--accent-coral, #FF4D5E)' }}>
                  Session Complete
                </div>
              ) : (
                <div className={`hero-timer-display${activeSession.status === 'PAUSED' ? ' timer-paused' : ''}`}>
                  {formatTimerDigits(timerSeconds)}
                </div>
              )}
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
                    className="hero-btn secondary"
                    onClick={() => handlePause(activeSession.id)}
                  >
                    <Icon name="pause" size={12} />
                    <span>Pause</span>
                  </button>
                )}
                {activeSession.status === 'PAUSED' && (
                  <button
                    className="hero-btn primary"
                    onClick={() => handleResume(activeSession.id)}
                  >
                    <Icon name="play" size={12} />
                    <span>Resume</span>
                  </button>
                )}
                <button
                  className="hero-btn primary"
                  onClick={() => setCompletingSessionId(activeSession.id)}
                >
                  <Icon name="check" size={12} />
                  <span>Summarize</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="hero-body-idle">
              <div className="hero-idle-headline">Focus Protection Ready</div>
              <div className="hero-idle-task-preview">
                <span className="hero-preview-label">Next Task</span>
                <span className="hero-preview-title">
                  {nextActionMission?.title || (missions.length > 0 ? missions[0].title : 'Plan your next session')}
                </span>
              </div>
              <button
                className="hero-arm-btn"
                onClick={handleEngageNextAction}
                title="Start focus on highest priority task"
              >
                <Icon name="play" size={13} />
                <span>Start Focus</span>
              </button>
            </div>
          )}
        </div>

        {/* PANEL 2: TASK COMPLETION RATE GAUGE */}
        <div className="cockpit-panel cockpit-velocity-panel">
          <div className="cockpit-panel-header">
            <div className="cockpit-panel-header-left">
              <div className="cockpit-panel-icon">
                <Icon name="analytics" size={16} />
              </div>
              <h3 className="cockpit-panel-title">Task Completion Rate</h3>
            </div>
            <button
              className="cockpit-panel-action-icon"
              onClick={() => setActiveTab('Analytics')}
              title="View Analytics"
            >
              <Icon name="arrow-up-right" size={13} />
            </button>
          </div>

          <div className="velocity-body">
            <div className="velocity-score-row">
              <div className="velocity-score-num">{velocityRate}%</div>
              <div className="velocity-score-label">Task Completion Rate</div>
            </div>

            <div className="velocity-gauge-wrap">
              <svg className="velocity-gauge-svg" viewBox="0 0 200 115" width="100%" height="115">
                <defs>
                  <linearGradient id="velocityGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#FF4D5E" />
                  </linearGradient>
                </defs>
                {/* Background track arc */}
                <path
                  d="M 25 95 A 75 75 0 0 1 175 95"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="11"
                  strokeLinecap="round"
                />
                {/* Foreground progress arc */}
                <path
                  d="M 25 95 A 75 75 0 0 1 175 95"
                  fill="none"
                  stroke="url(#velocityGaugeGrad)"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
              </svg>
              <div className="velocity-tick-labels">
                <span>• Mon</span>
                <span>• Tue</span>
                <span>• Wed</span>
                <span>• Thu</span>
                <span>• Fri</span>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 3: SCHEDULE */}
        <div className="cockpit-panel cockpit-timesheet-panel">
          <div className="cockpit-panel-header">
            <div className="cockpit-panel-header-left">
              <div className="cockpit-panel-icon">
                <Icon name="schedule" size={16} />
              </div>
              <h3 className="cockpit-panel-title">Schedule</h3>
            </div>
            <button
              className="cockpit-panel-action-icon"
              onClick={() => setActiveTab('Schedule')}
              title="Open Calendar"
            >
              <Icon name="arrow-up-right" size={13} />
            </button>
          </div>

          <div className="timesheet-list">
            {sessions.length > 0 ? (
              sessions.slice(0, 4).map((s, idx) => {
                const canStart = s.status === 'SCHEDULED' && !activeSession
                const title = canStart
                  ? 'Click to start session'
                  : s.status === 'COMPLETED'
                    ? 'Completed session'
                    : activeSession
                      ? 'Finish the active focus session before starting another'
                      : `Session is ${s.status.toLowerCase()}`
                return (
                <div
                  key={s.id}
                  className={`timesheet-item ${idx === 0 ? 'rank-first' : ''}`}
                  onClick={() => {
                    if (canStart) void handleStartFromSchedule(s.id)
                  }}
                  style={{ cursor: canStart ? 'pointer' : 'default' }}
                  title={title}
                >
                  <div className="timesheet-item-left">
                    <span className="timesheet-rank-pill">{idx + 1}</span>
                    <div className="timesheet-meta">
                      <span className="timesheet-name">{s.name}</span>
                      <span className="timesheet-sub">{s.intention || 'Focus Session'}</span>
                    </div>
                  </div>
                  <div className="timesheet-item-right">
                    <span className="timesheet-duration-badge">{s.durationMinutes}m</span>
                  </div>
                </div>
                )
              })
            ) : (
              <div className="status-column-empty" style={{ padding: '16px' }}>
                <span>No focus sessions recorded yet</span>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 4: ACTIVITY FEED */}
        <div className="cockpit-panel cockpit-activity-panel">
          <div className="cockpit-panel-header">
            <div className="cockpit-panel-header-left">
              <div className="cockpit-panel-icon">
                <Icon name="sparkle" size={16} />
              </div>
              <h3 className="cockpit-panel-title">Activity</h3>
            </div>
            <span className="card-goal-tag" style={{ fontSize: '10.5px' }}>Today</span>
          </div>

          <div className="activity-feed-list">
            {recentDebriefsList.length > 0 ? (
              recentDebriefsList.slice(0, 3).map((d) => (
                <div key={d.sessionId} className="activity-feed-item">
                  <div className="activity-feed-top">
                    <span className="activity-feed-name">{d.sessionName}</span>
                    <span className="activity-feed-time">
                      {d.completedAt ? new Date(d.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                    </span>
                  </div>
                  <span className="activity-feed-note">
                    {d.accomplishment || d.reflectionNote || 'Completed focus session and recorded summary'}
                  </span>
                  <span className="activity-feed-tag">Session Summary ({d.durationMinutes}m)</span>
                </div>
              ))
            ) : sessions.filter((s) => s.status === 'COMPLETED').length > 0 ? (
              sessions
                .filter((s) => s.status === 'COMPLETED')
                .slice(0, 3)
                .map((s) => (
                  <div key={s.id} className="activity-feed-item">
                    <div className="activity-feed-top">
                      <span className="activity-feed-name">{s.name}</span>
                      <span className="activity-feed-time">Completed</span>
                    </div>
                    <span className="activity-feed-note">{s.intention || 'Focus session completed successfully'}</span>
                    <span className="activity-feed-tag">{s.durationMinutes}m Focus Completed</span>
                  </div>
                ))
            ) : (
              <div className="status-column-empty" style={{ padding: '16px' }}>
                <span>No recent session summaries</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Quick Task Creator Modal */}
      {isCreatingQuickMission && (
        <div className="flight-deck-quick-modal-overlay" onClick={() => setIsCreatingQuickMission(false)}>
          <div className="flight-deck-quick-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="quick-modal-header">
              <h3 className="quick-modal-title">Create Task</h3>
              <button className="quick-modal-close" onClick={() => setIsCreatingQuickMission(false)}>
                <Icon name="close" size={14} />
              </button>
            </div>

            <form className="quick-modal-form" onSubmit={handleQuickCreateMission}>
              {quickMissionError && (
                <div className="quick-modal-error" role="alert">{quickMissionError}</div>
              )}
              <div className="quick-field-group">
                <label className="quick-field-label">Associated Goal</label>
                <select
                  className="quick-field-select"
                  value={quickMissionGoalId ?? ''}
                  onChange={(e) => setQuickMissionGoalId(Number(e.target.value))}
                  required
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="quick-field-group">
                <label className="quick-field-label">Task Title</label>
                <input
                  type="text"
                  className="quick-field-input"
                  placeholder="e.g. Refactor API endpoint, Write test suite..."
                  value={quickMissionTitle}
                  onChange={(e) => setQuickMissionTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="quick-field-group">
                <label className="quick-field-label">Estimated Duration</label>
                <div className="quick-duration-presets">
                  {[15, 25, 45, 60].map((dur) => (
                    <button
                      type="button"
                      key={dur}
                      className={`quick-preset-btn ${quickMissionDuration === dur ? 'active' : ''}`}
                      onClick={() => setQuickMissionDuration(dur)}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="quick-modal-actions">
                <button
                  type="button"
                  className="board-action-btn secondary"
                  onClick={() => setIsCreatingQuickMission(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="board-action-btn primary"
                  disabled={isSubmittingQuickMission || !quickMissionTitle.trim()}
                >
                  {isSubmittingQuickMission ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
