import React, { useEffect } from 'react'
import type { Goal } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'

export interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  goals: Goal[]
  goalId: number | null
  setGoalId: (val: number) => void
  title: string
  setTitle: (val: string) => void
  duration: number
  setDuration: (val: number) => void
  isSubmitting: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  goals,
  goalId,
  setGoalId,
  title,
  setTitle,
  duration,
  setDuration,
  isSubmitting,
  error,
  onSubmit,
}) => {
  // Ensure default goal selection if goalId is uninitialized
  useEffect(() => {
    if (isOpen && goals.length > 0) {
      if (!goalId || !goals.some((g) => g.id === goalId)) {
        setGoalId(goals[0].id)
      }
    }
  }, [isOpen, goals, goalId, setGoalId])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="create-task-title">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 id="create-task-title" className="modal-title" style={{ margin: 0 }}>Create Task</h3>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={onClose}
            title="Close"
            aria-label="Close modal"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <p className="modal-sub">
          Define an actionable task and link it to an active goal.
        </p>

        <form onSubmit={onSubmit}>
          {error && (
            <div className="quick-modal-error" role="alert" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Associated Goal
            </label>
            {goals.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--brand-coral)', margin: 0 }}>
                No goals available. Please create a goal first.
              </p>
            ) : (
              <select
                className="modal-field"
                style={{ marginBottom: 0 }}
                value={goalId ?? ''}
                onChange={(e) => setGoalId(Number(e.target.value))}
                required
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Task Title
            </label>
            <input
              type="text"
              className="modal-field"
              placeholder="e.g. Refactor API endpoint, Write test suite..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Estimated Duration ({duration} min)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[15, 25, 45, 60].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  className={`btn-timer ${duration === dur ? 'primary' : 'secondary'}`}
                  style={{ flex: 1, padding: '6px 0', fontSize: 13 }}
                  onClick={() => setDuration(dur)}
                >
                  {dur}m
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-timer secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-timer primary"
              disabled={isSubmitting || !title.trim() || goals.length === 0}
            >
              <Icon name="plus" size={14} />
              <span>{isSubmitting ? 'Creating...' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

