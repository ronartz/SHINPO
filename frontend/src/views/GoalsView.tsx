import React, { useState } from 'react'
import type { Goal, Mission } from '../api/goalsAndMissions'
import type { GoalDecomposition, ProposedMission } from '../api/ai'
import { Icon } from '../components/common/Icon'

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
}

import { trackRender } from '../utils/renderTracker'

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
}) => {
  trackRender('GoalsView')
  const [missionsFilter, setMissionsFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL')

  return (
    <div className="bento-grid">
      {/* Goals Header */}
      <div className="deck-section-header" style={{ marginBottom: 12 }}>
        <div className="deck-section-title">
          <Icon name="goals" size={18} />
          <span>Goals</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-timer primary"
            data-tutorial="new-goal"
          >
            <Icon name="plus" size={14} />
            <span>New Goal</span>
          </button>
          {goals.length > 0 && (
            <button className="btn-timer danger" onClick={handleDeleteAllGoals}>
              <Icon name="trash" size={13} />
              <span>Delete All Goals</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Breakdown Result Banner */}
      {aiDecompResult && (
        <div className="ai-decomp-banner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkle" size={18} />
              <span style={{ fontWeight: 800, fontSize: 16 }}>
                AI Breakdown: {aiDecompResult.goalTitle}
              </span>
            </div>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setAiDecompResult(null)}
              title="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '8px 0 12px', lineHeight: 1.5 }}>
            {aiDecompResult.analysis}
          </p>

          <div className="decomp-items-grid">
            {aiDecompResult.proposedMissions?.map((pm: ProposedMission, idx: number) => (
              <div key={idx} className="decomp-mission-box">
                <div>
                  <div className="decomp-title">{pm.title}</div>
                  <div className="decomp-desc">{pm.description}</div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                  }}
                >
                  <span className="badge-tag blue">{pm.estimatedMinutes}m</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 700 }}>
                    Task #{idx + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="btn-timer secondary"
              onClick={() => setAiDecompResult(null)}
            >
              Discard
            </button>
            <button
              className="btn-timer primary"
              onClick={handleCommitAiMissions}
              data-tutorial="commit-missions"
            >
              <Icon name="check" size={14} />
              <span>Add {aiDecompResult.proposedMissions.length} Tasks</span>
            </button>
          </div>
        </div>
      )}

      <div className="goals-grid">
        {goals.length === 0 ? (
          <div
            className="bento-card"
            style={{ gridColumn: 'span 12', padding: 32, textAlign: 'center' }}
          >
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 12 }}>
              No goals created yet. Create a goal to get started.
            </p>
            <button className="btn-timer primary" onClick={() => setIsCreatingGoal(true)}>
              <Icon name="plus" size={14} />
              <span>Create Goal</span>
            </button>
          </div>
        ) : (
          goals.map((g) => {
            const goalMissions = missions.filter((m) => m.goalId === g.id)
            const completedCount = goalMissions.filter(
              (m) => m.status === 'COMPLETED',
            ).length
            const progressPct =
              goalMissions.length > 0
                ? Math.round((completedCount / goalMissions.length) * 100)
                : 0

            return (
              <div key={g.id} className="goal-card-item">
                <div className="goal-top-row">
                  <span className="goal-item-title">{g.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`badge-tag ${g.status === 'ACTIVE' ? 'green' : g.status === 'COMPLETED' ? 'purple' : 'blue'}`}>
                      {g.status}
                    </span>
                    <button
                      className="btn-icon-edit"
                      title="Edit Goal"
                      onClick={() => openEditGoalModal(g)}
                    >
                      <Icon name="edit" size={13} />
                    </button>
                    <button
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
                      Tasks: {completedCount}/{goalMissions.length}
                    </span>
                    <span style={{ fontWeight: 700 }}>{progressPct}%</span>
                  </div>
                  <div className="goal-progress-bar-bg">
                    <div
                      className="goal-progress-bar-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="goal-card-footer">
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Target: {g.targetDate ? g.targetDate : 'No target date'}
                  </span>
                  <button
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
          })
        )}
      </div>

      {/* Section 2: Tasks List */}
      <div className="deck-section-header" style={{ marginTop: 12 }} data-tutorial="missions-queue">
        <div className="deck-section-title">
          <Icon name="target" size={18} />
          <span>Tasks</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-timer secondary"
            style={{ padding: '6px 12px', fontSize: 13 }}
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
          >
            <Icon name="plus" size={13} />
            <span>New Task</span>
          </button>
          {missions.length > 0 && (
            <button
              className="btn-timer danger"
              style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={handleDeleteMissionBulk}
              title="Clear all tasks"
            >
              <Icon name="trash" size={13} />
              <span>Clear All Tasks</span>
            </button>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['ALL', 'PENDING', 'COMPLETED'] as const).map((filter) => (
              <button
                key={filter}
                className={`filter-chip ${missionsFilter === filter ? 'active' : ''}`}
                onClick={() => setMissionsFilter(filter)}
              >
                {filter === 'ALL' ? 'All' : filter === 'PENDING' ? 'Pending' : 'Completed'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="missions-list-container">
        {missions
          .filter((m) => {
            if (missionsFilter === 'PENDING') return m.status !== 'COMPLETED'
            if (missionsFilter === 'COMPLETED') return m.status === 'COMPLETED'
            return true
          })
          .map((m) => {
            const parentGoal = goals.find((g) => g.id === m.goalId)
            const isDone = m.status === 'COMPLETED'

            return (
              <div
                key={m.id}
                className={`mission-deck-row ${isDone ? 'completed' : ''}`}
              >
                <div className="mission-deck-left">
                  <button
                    className={`mission-check-btn ${isDone ? 'checked' : ''}`}
                    onClick={() => !isDone && handleToggleMissionComplete(m.id)}
                    title={isDone ? 'Completed' : 'Mark as complete'}
                  >
                    {isDone && <Icon name="check" size={14} />}
                  </button>
                  <div className="mission-deck-meta">
                    <div
                      className="mission-deck-title"
                      style={{ textDecoration: isDone ? 'line-through' : 'none' }}
                    >
                      {m.title}
                    </div>
                    <div className="mission-deck-sub">
                      {parentGoal && <span>Goal: {parentGoal.title}</span>}
                      <span>• {m.estimatedMinutes || 25}m estimated</span>
                      <span>• {m.scheduledDate}</span>
                      <span className={`badge-tag ${isDone ? 'purple' : m.status === 'IN_PROGRESS' ? 'green' : 'blue'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!isDone && (
                    <button
                      className="btn-timer secondary"
                      style={{ padding: '8px 16px', fontSize: 13 }}
                      onClick={() => handleArmMissionAsSession(m.title, m.estimatedMinutes || 25)}
                    >
                      <Icon name="play" size={12} />
                      <span>Start focus</span>
                    </button>
                  )}
                  <button
                    className="btn-icon-edit"
                    title="Edit Task"
                    onClick={() => openEditMissionModal(m)}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    className="btn-icon-delete"
                    title="Delete Task"
                    onClick={() => handleDeleteMission(m.id, m.title)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
