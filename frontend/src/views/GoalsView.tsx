import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { GoalDecomposition, ProposedMission } from '../api/ai'
import { Icon } from '../components/common/Icon'
import { StudyResourcesPanel } from '../components/focus'

export interface GoalsViewProps {
  goals: Goal[]
  missions: Mission[]
  aiDecompResult: GoalDecomposition | null
  setAiDecompResult: (res: GoalDecomposition | null) => void
  decomposingGoalId: number | null
  handleDeconstructGoal: (id: number) => void
  handleCommitAiMissions: () => void
  handleDeleteGoal: (id: number, title: string) => void
  handleDeleteAllGoals: () => void
  handleDeleteMission: (id: number, title: string) => void
  handleDeleteMissionBulk: () => void
  handleToggleMissionComplete: (id: number) => void
  handleArmMissionAsSession: (title: string, duration?: number) => void
  setIsCreatingGoal: (creating: boolean) => void
  setIsCreatingQuickMission: (creating: boolean) => void
  quickMissionGoalId: number | null
  setQuickMissionGoalId: (id: number | null) => void
  onGoalRequired: () => void
  openEditGoalModal: (goal: Goal) => void
  openEditMissionModal: (mission: Mission) => void
  missionsFilter?: 'ALL' | 'PENDING' | 'COMPLETED'
  setMissionsFilter?: (filter: 'ALL' | 'PENDING' | 'COMPLETED') => void
}

import { trackRender } from '../utils/renderTracker'
import { ShinpoSelect } from '../components/ui'
import type { SelectOption } from '../components/ui/Select/types'

export type TaskStatusFilter = 'ALL' | 'IN_PROGRESS' | 'READY' | 'COMPLETED'
export type TaskSortOption = 'default' | 'date' | 'duration-asc' | 'duration-desc' | 'title'

const TASK_SORT_OPTIONS: SelectOption<TaskSortOption>[] = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'date', label: 'Sort: Due Date' },
  { value: 'duration-asc', label: 'Sort: Duration (Shortest)' },
  { value: 'duration-desc', label: 'Sort: Duration (Longest)' },
  { value: 'title', label: 'Sort: Title (A-Z)' },
]

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  missions,
  aiDecompResult,
  setAiDecompResult,
  decomposingGoalId,
  handleDeconstructGoal,
  handleCommitAiMissions,
  handleDeleteGoal,
  handleDeleteAllGoals,
  handleDeleteMission,
  handleDeleteMissionBulk,
  handleToggleMissionComplete,
  handleArmMissionAsSession,
  setIsCreatingGoal,
  setIsCreatingQuickMission,
  quickMissionGoalId,
  setQuickMissionGoalId,
  onGoalRequired,
  openEditGoalModal,
  openEditMissionModal,
  missionsFilter: propMissionsFilter,
  setMissionsFilter: propSetMissionsFilter,
}) => {
  trackRender('GoalsView')

  // Status Filter State (Default ALL; synchronized with prop if passed)
  const [internalStatusFilter, setInternalStatusFilter] = useState<TaskStatusFilter>('ALL')

  const activeStatusFilter: TaskStatusFilter = useMemo(() => {
    if (internalStatusFilter !== 'ALL') return internalStatusFilter
    if (propMissionsFilter === 'COMPLETED') return 'COMPLETED'
    if (propMissionsFilter === 'PENDING') return 'READY'
    return 'ALL'
  }, [internalStatusFilter, propMissionsFilter])

  const handleFilterChange = (filter: TaskStatusFilter) => {
    setInternalStatusFilter(filter)
    if (propSetMissionsFilter) {
      if (filter === 'COMPLETED') propSetMissionsFilter('COMPLETED')
      else if (filter === 'READY' || filter === 'IN_PROGRESS') propSetMissionsFilter('PENDING')
      else propSetMissionsFilter('ALL')
    }
  }

  // Primary Default View is LIST (as requested in Section 2)
  const [taskViewMode, setTaskViewMode] = useState<'board' | 'list'>('list')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<TaskSortOption>('default')

  // Secondary Destructive Overflow Menus
  const [showGoalMenu, setShowGoalMenu] = useState(false)
  const [showTaskMenu, setShowTaskMenu] = useState(false)
  const [resourceMission, setResourceMission] = useState<Mission | null>(null)
  const goalMenuRef = useRef<HTMLDivElement | null>(null)
  const taskMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (goalMenuRef.current && !goalMenuRef.current.contains(e.target as Node)) {
        setShowGoalMenu(false)
      }
      if (taskMenuRef.current && !taskMenuRef.current.contains(e.target as Node)) {
        setShowTaskMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!resourceMission) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setResourceMission(null)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [resourceMission])

  const handleConfirmDeleteAllGoals = () => {
    setShowGoalMenu(false)
    if (window.confirm('Are you sure you want to delete all goals and their associated tasks? This cannot be undone.')) {
      handleDeleteAllGoals()
    }
  }

  const handleConfirmClearAllTasks = () => {
    setShowTaskMenu(false)
    if (window.confirm('Are you sure you want to clear all tasks from the execution queue? This cannot be undone.')) {
      handleDeleteMissionBulk()
    }
  }

  // Real Counts
  const inProgressMissions = useMemo(
    () => missions.filter((m) => m.status === 'IN_PROGRESS'),
    [missions]
  )
  const readyMissions = useMemo(
    () => missions.filter((m) => m.status === 'PENDING' || (!m.status && m.status !== 'COMPLETED')),
    [missions]
  )
  const completedMissions = useMemo(
    () => missions.filter((m) => m.status === 'COMPLETED'),
    [missions]
  )

  const allCount = missions.length
  const inProgressCount = inProgressMissions.length
  const readyCount = readyMissions.length
  const completedCount = completedMissions.length

  // Filtered & Sorted Tasks for List View
  const filteredMissions = useMemo(() => {
    let result = missions.filter((m) => {
      if (activeStatusFilter === 'IN_PROGRESS') {
        if (m.status !== 'IN_PROGRESS') return false
      } else if (activeStatusFilter === 'READY') {
        if (m.status === 'COMPLETED' || m.status === 'IN_PROGRESS') return false
      } else if (activeStatusFilter === 'COMPLETED') {
        if (m.status !== 'COMPLETED') return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const parentGoal = goals.find((g) => g.id === m.goalId)
        const matchTitle = m.title.toLowerCase().includes(q)
        const matchDesc = m.description ? m.description.toLowerCase().includes(q) : false
        const matchGoal = parentGoal ? parentGoal.title.toLowerCase().includes(q) : false
        if (!matchTitle && !matchDesc && !matchGoal) return false
      }

      return true
    })

    if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'duration-asc') {
      result = [...result].sort((a, b) => (a.estimatedMinutes || 25) - (b.estimatedMinutes || 25))
    } else if (sortBy === 'duration-desc') {
      result = [...result].sort((a, b) => (b.estimatedMinutes || 25) - (a.estimatedMinutes || 25))
    } else if (sortBy === 'date') {
      result = [...result].sort((a, b) => {
        if (!a.scheduledDate) return 1
        if (!b.scheduledDate) return -1
        return a.scheduledDate.localeCompare(b.scheduledDate)
      })
    }

    return result
  }, [missions, activeStatusFilter, searchQuery, sortBy, goals])

  // Kanban Card Renderer (for Board Mode)
  const renderKanbanCard = (m: Mission) => {
    const parentGoal = goals.find((g) => g.id === m.goalId)
    const isDone = m.status === 'COMPLETED'
    return (
      <div key={m.id} className={`flight-deck-card ${isDone ? 'is-completed' : ''}`}>
        <div className="card-top-row">
          <div className="card-title-group" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, flex: 1, minWidth: 0 }}>
            <button
              type="button"
              className={`card-check-btn ${isDone ? 'checked' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleToggleMissionComplete(m.id)
              }}
              title={isDone ? 'Completed (click to reopen)' : 'Mark task complete'}
              aria-label={isDone ? 'Completed' : 'Mark task complete'}
            >
              {isDone && <Icon name="check" size={13} />}
            </button>
            <h4 className={`card-title ${isDone ? 'completed-title' : ''}`} style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.35 }}>
              {m.title}
            </h4>
          </div>
        </div>

        <div className="card-context-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          {parentGoal && (
            <span className="card-goal-tag" title={parentGoal.title}>
              🎯 {parentGoal.title}
            </span>
          )}
          <span className="card-duration-chip">
            <Icon name="clock" size={11} />
            <span>{m.estimatedMinutes || 25}m</span>
          </span>
          {m.scheduledDate && (
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
              📅 {m.scheduledDate}
            </span>
          )}
        </div>

        <div className="card-meta-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!isDone && (
              <button
                type="button"
                className="card-quick-arm-btn"
                onClick={() => handleArmMissionAsSession(m.title, m.estimatedMinutes || 25)}
                title="Start focus session with this task"
              >
                <Icon name="play" size={12} />
                <span>Focus</span>
              </button>
            )}
            <button
              type="button"
              className="card-resource-btn"
              onClick={() => setResourceMission(m)}
              title="Manage study resources"
            >
              <Icon name="journal" size={12} />
              <span>Resources</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn-icon-edit"
              title="Edit Task"
              onClick={() => openEditMissionModal(m)}
            >
              <Icon name="edit" size={13} />
            </button>
            <button
              type="button"
              className="btn-icon-delete"
              title="Delete Task"
              onClick={() => handleDeleteMission(m.id, m.title)}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Responsive Task Row Renderer (for Primary List View)
  const renderTaskRow = (m: Mission) => {
    const parentGoal = goals.find((g) => g.id === m.goalId)
    const isDone = m.status === 'COMPLETED'
    const isInProgress = m.status === 'IN_PROGRESS'

    return (
      <div key={m.id} className={`mission-list-row ${isDone ? 'is-completed' : ''}`}>
        <button
          type="button"
          className={`task-row-check-btn ${isDone ? 'checked' : ''}`}
          onClick={() => handleToggleMissionComplete(m.id)}
          title={isDone ? 'Completed (click to reopen)' : 'Mark task complete'}
          aria-label={isDone ? 'Completed' : 'Mark task complete'}
        >
          {isDone && <Icon name="check" size={13} />}
        </button>

        <div className="task-row-content">
          <div className={`task-row-title ${isDone ? 'completed-title' : ''}`}>
            {m.title}
          </div>
          {m.description && (
            <div className="task-row-desc">{m.description}</div>
          )}
        </div>

        <div className="task-row-meta">
          {parentGoal && (
            <span className="task-row-goal-pill" title={`Goal: ${parentGoal.title}`}>
              <Icon name="target" size={11} />
              <span>{parentGoal.title}</span>
            </span>
          )}
          <span className="task-row-chip duration">
            <Icon name="clock" size={11} />
            <span>{m.estimatedMinutes || 25}m</span>
          </span>
          {m.scheduledDate && (
            <span className="task-row-chip date">
              <Icon name="calendar" size={11} />
              <span>{m.scheduledDate}</span>
            </span>
          )}
          <span className={`task-row-status-pill ${isDone ? 'completed' : isInProgress ? 'in-progress' : 'ready'}`}>
            {isDone ? 'Completed' : isInProgress ? 'In Progress' : 'Ready'}
          </span>
        </div>

        <div className="task-row-actions">
          <button
            type="button"
            className="task-row-resource-btn"
            onClick={() => setResourceMission(m)}
            title="Manage study resources"
          >
            <Icon name="journal" size={12} />
            <span>Resources</span>
          </button>
          {!isDone && (
            <button
              type="button"
              className="task-row-focus-btn"
              onClick={() => handleArmMissionAsSession(m.title, m.estimatedMinutes || 25)}
              title="Start focus session with this task"
            >
              <Icon name="play" size={12} />
              <span>Focus</span>
            </button>
          )}
          <div className="task-row-icons-group">
            <button
              type="button"
              className="btn-icon-action"
              title="Edit Task"
              data-tutorial="edit-task"
              onClick={() => openEditMissionModal(m)}
            >
              <Icon name="edit" size={13} />
            </button>
            <button
              type="button"
              className="btn-icon-action danger"
              title="Delete Task"
              onClick={() => handleDeleteMission(m.id, m.title)}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="goals-view-deck">
      {/* =========================================================================
          SECTION 1: GOALS AREA (Balanced Single-Goal Summary or Multi-Goal Grid)
          ========================================================================= */}
      <div className="deck-section-header">
        <div className="deck-section-title">
          <Icon name="goals" size={17} />
          <span>Goals</span>
          <span className="deck-counter-badge">{goals.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <button
            type="button"
            className="btn-timer primary"
            onClick={() => setIsCreatingGoal(true)}
            data-tutorial="new-goal"
          >
            <Icon name="plus" size={14} />
            <span>New Goal</span>
          </button>

          {/* Secondary Destructive Overflow Menu */}
          {goals.length > 0 && (
            <div ref={goalMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-timer secondary btn-overflow-trigger"
                onClick={() => setShowGoalMenu((prev) => !prev)}
                title="Goal Options"
                aria-label="Goal Options"
                aria-expanded={showGoalMenu}
              >
                ···
              </button>
              {showGoalMenu && (
                <div className="overflow-menu-dropdown">
                  <button
                    type="button"
                    className="overflow-menu-item danger"
                    onClick={handleConfirmDeleteAllGoals}
                  >
                    <Icon name="trash" size={13} />
                    <span>Delete All Goals</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Breakdown Result Banner */}
      {aiDecompResult && (
        <div className="ai-decomp-banner" role="region" aria-label="EONPAI Goal Breakdown">
          <div className="decomp-header">
            <div className="decomp-header-left">
              <div className="decomp-sparkle-icon">
                <Icon name="sparkle" size={18} />
              </div>
              <div className="decomp-title-group">
                <h4 className="decomp-main-title">EONPAI Goal Breakdown</h4>
                <span className="decomp-goal-name">Target: {aiDecompResult.goalTitle}</span>
              </div>
            </div>
            <button
              type="button"
              className="decomp-close-btn"
              onClick={() => setAiDecompResult(null)}
              title="Dismiss breakdown"
              aria-label="Dismiss breakdown"
            >
              <Icon name="close" size={14} />
            </button>
          </div>

          {aiDecompResult.analysis && (
            <div className="decomp-analysis-box">
              <span className="decomp-analysis-label">AI Strategy & Reasoning</span>
              <p className="decomp-analysis-text">{aiDecompResult.analysis}</p>
            </div>
          )}

          <div className="decomp-items-container">
            <div className="decomp-items-header">
              <span className="decomp-items-count">
                Proposed Tasks ({aiDecompResult.proposedMissions?.length || 0})
              </span>
              <span className="decomp-items-hint">
                Review and approve into your task backlog
              </span>
            </div>

            <div className="decomp-items-grid">
              {aiDecompResult.proposedMissions?.map((pm: ProposedMission, idx: number) => (
                <div key={idx} className="decomp-mission-box">
                  <div className="decomp-mission-top">
                    <span className="decomp-step-badge">Step {idx + 1}</span>
                    <span className="decomp-duration-badge">
                      <Icon name="clock" size={11} />
                      <span>{pm.estimatedMinutes}m</span>
                    </span>
                  </div>
                  <div className="decomp-mission-content">
                    <div className="decomp-title">{pm.title}</div>
                    {pm.description && <div className="decomp-desc">{pm.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="decomp-footer-actions">
            <button
              type="button"
              className="btn-timer secondary"
              onClick={() => setAiDecompResult(null)}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn-timer primary"
              onClick={handleCommitAiMissions}
              data-tutorial="commit-missions"
            >
              <Icon name="check" size={14} />
              <span>Add {aiDecompResult.proposedMissions?.length || 0} Tasks to Backlog</span>
            </button>
          </div>
        </div>
      )}

      {/* Goals Display: Single Goal Summary vs Multiple Goals Grid vs Empty State */}
      {goals.length === 1 ? (
        (() => {
          const g = goals[0]
          const goalMissions = missions.filter((m) => m.goalId === g.id)
          const goalCompletedCount = goalMissions.filter((m) => m.status === 'COMPLETED').length
          const goalInProgCount = goalMissions.filter((m) => m.status === 'IN_PROGRESS').length
          const goalReadyCount = goalMissions.filter((m) => m.status === 'PENDING' || (!m.status && m.status !== 'COMPLETED')).length
          const progressPct = goalMissions.length > 0 ? Math.round((goalCompletedCount / goalMissions.length) * 100) : 0
          const pendingMinutes = goalMissions.reduce((acc, m) => acc + (m.status !== 'COMPLETED' ? (m.estimatedMinutes || 25) : 0), 0)
          const nextAction = goalMissions.find((m) => m.status === 'IN_PROGRESS') || goalMissions.find((m) => m.status !== 'COMPLETED')

          return (
            <div key={g.id} className="goal-single-summary-card">
              <div className="goal-summary-left">
                <div className="goal-summary-header">
                  <div className="goal-title-group">
                    <span className="goal-kicker">ACTIVE OBJECTIVE</span>
                    <h3 className="goal-summary-title">{g.title}</h3>
                  </div>
                  <div className="goal-summary-status-group">
                    <span className={`badge-tag ${g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'purple' : 'blue'}`}>
                      {g.status}
                    </span>
                    {g.targetDate ? (
                      <span className="goal-target-pill">
                        <Icon name="calendar" size={12} />
                        <span>Target: {g.targetDate}</span>
                      </span>
                    ) : (
                      <span className="goal-target-pill muted">No target date</span>
                    )}
                  </div>
                </div>

                {g.description && <p className="goal-summary-desc">{g.description}</p>}

                <div className="goal-summary-progress-wrap">
                  <div className="goal-progress-meta">
                    <span className="progress-title">Execution Progress</span>
                    <span className="progress-counts">
                      {goalCompletedCount} of {goalMissions.length} tasks completed ({progressPct}%)
                    </span>
                  </div>
                  <div className="goal-progress-bar-bg">
                    <div className="goal-progress-bar-fill" style={{ transform: `scaleX(${progressPct / 100})` }} />
                  </div>
                </div>

                <div className="goal-summary-actions">
                  <button
                    type="button"
                    className="btn-ai-deconstruct"
                    onClick={() => handleDeconstructGoal(g.id)}
                    disabled={decomposingGoalId === g.id}
                    data-tutorial="decompose-goal"
                    title="Deconstruct goal into actionable tasks using EONPAI"
                  >
                    <Icon name="sparkle" size={13} />
                    <span>{decomposingGoalId === g.id ? 'Analyzing...' : 'Plan Tasks with EONPAI'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-timer secondary"
                    onClick={() => openEditGoalModal(g)}
                    title="Edit Goal"
                    data-tutorial="edit-goal"
                  >
                    <Icon name="edit" size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="btn-timer danger-subtle"
                    onClick={() => handleDeleteGoal(g.id, g.title)}
                    title="Delete Goal"
                  >
                    <Icon name="trash" size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              <div className="goal-summary-companion">
                <div className="companion-header">
                  <Icon name="target" size={15} />
                  <span>Goal Execution Breakdown</span>
                </div>

                <div className="companion-stats-row">
                  <div className="companion-stat-item">
                    <span className="stat-value">{goalReadyCount}</span>
                    <span className="stat-label">Ready</span>
                  </div>
                  <div className="companion-stat-item">
                    <span className="stat-value">{goalInProgCount}</span>
                    <span className="stat-label">In Progress</span>
                  </div>
                  <div className="companion-stat-item">
                    <span className="stat-value">{goalCompletedCount}</span>
                    <span className="stat-label">Done</span>
                  </div>
                  <div className="companion-stat-item highlight">
                    <span className="stat-value">{pendingMinutes}m</span>
                    <span className="stat-label">Est. Time</span>
                  </div>
                </div>

                {nextAction && (
                  <div className="companion-next-action-card">
                    <div className="next-action-top">
                      <span className="next-action-label">Next Action</span>
                      <span className="next-action-badge">{nextAction.estimatedMinutes || 25}m</span>
                    </div>
                    <div className="next-action-title" title={nextAction.title}>
                      {nextAction.title}
                    </div>
                    <button
                      type="button"
                      className="companion-focus-btn"
                      onClick={() => handleArmMissionAsSession(nextAction.title, nextAction.estimatedMinutes || 25)}
                      title="Start focus session on this task"
                    >
                      <Icon name="play" size={12} />
                      <span>Start Focus Sprint</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })()
      ) : goals.length > 1 ? (
        <div className="goals-grid">
          {goals.map((g) => {
            const goalMissions = missions.filter((m) => m.goalId === g.id)
            const goalCompletedCount = goalMissions.filter((m) => m.status === 'COMPLETED').length
            const progressPct = goalMissions.length > 0 ? Math.round((goalCompletedCount / goalMissions.length) * 100) : 0

            return (
              <div key={g.id} className="goal-card-item">
                <div className="goal-top-row">
                  <span className="goal-item-title">{g.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`badge-tag ${g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'purple' : 'blue'}`}>
                      {g.status}
                    </span>
                    <button
                      type="button"
                      className="btn-icon-edit"
                      title="Edit Goal"
                      data-tutorial="edit-goal"
                      onClick={() => openEditGoalModal(g)}
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-delete"
                      title="Delete Goal"
                      onClick={() => handleDeleteGoal(g.id, g.title)}
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                </div>
                {g.description && <p className="goal-item-desc">{g.description}</p>}

                <div style={{ margin: '4px 0' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--text-3)',
                      marginBottom: 4,
                    }}
                  >
                    <span>
                      Tasks: {goalCompletedCount}/{goalMissions.length}
                    </span>
                    <span style={{ fontWeight: 700 }}>{progressPct}%</span>
                  </div>
                  <div className="goal-progress-bar-bg">
                    <div
                      className="goal-progress-bar-fill"
                      style={{ transform: `scaleX(${progressPct / 100})` }}
                    />
                  </div>
                </div>

                <div className="goal-card-footer">
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Target: {g.targetDate ? g.targetDate : 'No target date'}
                  </span>
                  <button
                    type="button"
                    className="btn-ai-deconstruct"
                    onClick={() => handleDeconstructGoal(g.id)}
                    disabled={decomposingGoalId === g.id}
                    data-tutorial="decompose-goal"
                  >
                    <Icon name="sparkle" size={13} />
                    <span>
                      {decomposingGoalId === g.id ? 'Analyzing...' : 'Plan Tasks'}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="goals-empty-card">
          <Icon name="goals" size={28} />
          <p className="empty-title">No Active Goals</p>
          <p className="empty-desc">
            Create your primary objectives, then let EONPAI break them down into actionable execution tasks.
          </p>
          <button type="button" className="btn-timer primary" onClick={() => setIsCreatingGoal(true)}>
            <Icon name="plus" size={14} />
            <span>Create First Goal</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: TASKS AREA (Primary List View with Status Tabs, Search & Sort)
          ========================================================================= */}
      <div className="deck-section-header" data-tutorial="missions-queue" style={{ marginTop: 24 }}>
        <div className="deck-section-title">
          <Icon name="target" size={17} />
          <span>Tasks</span>
          <span className="deck-counter-badge">{missions.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          <button
            type="button"
            className="btn-timer primary"
            onClick={() => {
              if (goals.length === 0) {
                onGoalRequired()
                return
              }
              if (!quickMissionGoalId && goals.length > 0) {
                setQuickMissionGoalId(goals[0].id)
              }
              setIsCreatingQuickMission(true)
            }}
            data-tutorial="new-task"
          >
            <Icon name="plus" size={13} />
            <span>New Task</span>
          </button>

          {/* Secondary Task Overflow Menu for Bulk Actions */}
          {missions.length > 0 && (
            <div ref={taskMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-timer secondary btn-overflow-trigger"
                onClick={() => setShowTaskMenu((prev) => !prev)}
                title="Task Options"
                aria-label="Task Options"
                aria-expanded={showTaskMenu}
              >
                ···
              </button>
              {showTaskMenu && (
                <div className="overflow-menu-dropdown">
                  <button
                    type="button"
                    className="overflow-menu-item danger"
                    onClick={handleConfirmClearAllTasks}
                  >
                    <Icon name="trash" size={13} />
                    <span>Clear All Tasks</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Filters, Search, Sort, and View Switcher */}
      <div className="tasks-filter-bar">
        {/* Status Filter Tabs with Real Counts */}
        <div className="tasks-status-tabs">
          <button
            type="button"
            className={`status-tab-btn ${activeStatusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => handleFilterChange('ALL')}
          >
            <span>All</span>
            <span className="tab-count-badge">{allCount}</span>
          </button>
          <button
            type="button"
            className={`status-tab-btn ${activeStatusFilter === 'IN_PROGRESS' ? 'active' : ''}`}
            onClick={() => handleFilterChange('IN_PROGRESS')}
          >
            <span className="status-dot-mini dot-coral" />
            <span>In Progress</span>
            <span className="tab-count-badge">{inProgressCount}</span>
          </button>
          <button
            type="button"
            className={`status-tab-btn ${activeStatusFilter === 'READY' ? 'active' : ''}`}
            onClick={() => handleFilterChange('READY')}
          >
            <span className="status-dot-mini dot-cyan" />
            <span>Ready</span>
            <span className="tab-count-badge">{readyCount}</span>
          </button>
          <button
            type="button"
            className={`status-tab-btn ${activeStatusFilter === 'COMPLETED' ? 'active' : ''}`}
            onClick={() => handleFilterChange('COMPLETED')}
          >
            <span className="status-dot-mini dot-emerald" />
            <span>Done</span>
            <span className="tab-count-badge">{completedCount}</span>
          </button>
        </div>

        {/* Search, Sort & View Mode Toggle */}
        <div className="tasks-controls-right">
          <div className="tasks-search-box">
            <Icon name="search" size={14} />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tasks-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="tasks-sort-wrap">
            <ShinpoSelect<TaskSortOption>
              id="tasks-sort-select"
              className="tasks-sort-select"
              size="sm"
              value={sortBy}
              onChange={setSortBy}
              options={TASK_SORT_OPTIONS}
              ariaLabel="Sort tasks"
              minWidth={190}
            />
          </div>

          {/* View Mode Toggle: List (Primary) vs Board */}
          <div className="view-mode-toggle">
            <button
              type="button"
              className={`view-mode-btn ${taskViewMode === 'list' ? 'active' : ''}`}
              onClick={() => setTaskViewMode('list')}
              title="List View"
            >
              List
            </button>
            <button
              type="button"
              className={`view-mode-btn ${taskViewMode === 'board' ? 'active' : ''}`}
              onClick={() => setTaskViewMode('board')}
              title="Board View"
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {/* Task Content: Primary List View OR Board Mode */}
      {taskViewMode === 'list' ? (
        <div className="missions-list-container">
          {filteredMissions.length === 0 ? (
            <div className="missions-empty-row">
              <Icon name="target" size={18} />
              <span>
                {missions.length === 0
                  ? 'No tasks in the execution queue. Create a task or click "Plan Tasks" from a goal.'
                  : 'No tasks matching the selected filter or search query.'}
              </span>
            </div>
          ) : (
            filteredMissions.map((m) => renderTaskRow(m))
          )}
        </div>
      ) : (
        /* Board Mode (Improved Symmetrical Kanban) */
        <div className="flight-deck-board-grid" style={{ width: '100%' }}>
          {/* Lane 1: In Progress */}
          <div className="status-column col-in-progress">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-coral" />
                <span className="column-title-text">In Progress</span>
              </div>
              <span className="column-count-badge">{inProgressMissions.length}</span>
            </div>
            <div className="status-column-cards" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {inProgressMissions.length > 0 ? (
                inProgressMissions.map(renderKanbanCard)
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="clock" size={16} />
                  </div>
                  <span className="empty-title">No active focus session</span>
                  <span className="empty-subtitle">Select a ready task to begin your focus sprint.</span>
                </div>
              )}
            </div>
          </div>

          {/* Lane 2: Ready */}
          <div className="status-column col-backlog">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-cyan" />
                <span className="column-title-text">Ready</span>
              </div>
              <span className="column-count-badge">{readyMissions.length}</span>
            </div>
            <div className="status-column-cards" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {readyMissions.length > 0 ? (
                readyMissions.map(renderKanbanCard)
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="target" size={16} />
                  </div>
                  <span className="empty-title">No tasks queued</span>
                  <span className="empty-subtitle">Create a task to build your execution plan.</span>
                </div>
              )}
            </div>
          </div>

          {/* Lane 3: Completed */}
          <div className="status-column col-completed">
            <div className="status-column-header">
              <div className="column-header-title">
                <span className="column-status-dot dot-emerald" />
                <span className="column-title-text">Completed</span>
              </div>
              <span className="column-count-badge">{completedMissions.length}</span>
            </div>
            <div className="status-column-cards" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {completedMissions.length > 0 ? (
                completedMissions.map(renderKanbanCard)
              ) : (
                <div className="status-column-empty">
                  <div className="empty-icon-circle">
                    <Icon name="check-circle" size={16} />
                  </div>
                  <span className="empty-title">No completed tasks yet</span>
                  <span className="empty-subtitle">Finished tasks from your focus sessions will appear here.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {resourceMission && (
        <div className="quick-modal-overlay" onClick={() => setResourceMission(null)}>
          <div
            className="quick-modal-card study-resources-dialog-card"
            role="dialog"
            aria-modal="true"
            aria-label={`Study Resources for ${resourceMission.title}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-modal-header">
              <div>
                <h3 className="quick-modal-title">Task Study Plan</h3>
                <p className="study-resource-dialog-subtitle">Add only the resources this task needs.</p>
              </div>
              <button
                type="button"
                className="quick-modal-close"
                onClick={() => setResourceMission(null)}
                aria-label="Close Study Resources"
              >
                ×
              </button>
            </div>
            <div className="quick-modal-body">
              <StudyResourcesPanel
                missionId={resourceMission.id}
                taskTitle={resourceMission.title}
                surface="plain"
                showProtectionControls={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
