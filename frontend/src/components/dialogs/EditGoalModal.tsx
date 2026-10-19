import React from 'react'
import type { Goal } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'
import { ShinpoSelect, ShinpoDatePicker } from '../ui'

const GOAL_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export interface EditGoalModalProps {
  editingGoal: Goal | null
  onClose: () => void
  title: string
  setTitle: (val: string) => void
  description: string
  setDescription: (val: string) => void
  targetDate: string
  setTargetDate: (val: string) => void
  status: string
  setStatus: (val: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({
  editingGoal,
  onClose,
  title,
  setTitle,
  description,
  setDescription,
  targetDate,
  setTargetDate,
  status,
  setStatus,
  onSubmit,
}) => {
  if (!editingGoal) return null

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-goal-heading"
      >
        <h3 id="edit-goal-heading" className="modal-title">Edit Goal</h3>
        <p className="modal-sub">
          Update the goal details, target date, or status.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="edit-goal-title-input"
              style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}
            >
              Goal Title
            </label>
            <input
              id="edit-goal-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-field"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="edit-goal-desc-input"
              style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}
            >
              Description
            </label>
            <textarea
              id="edit-goal-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-field"
              rows={3}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <ShinpoDatePicker
                id="edit-goal-date-input"
                label="Target Date"
                value={targetDate}
                onChange={setTargetDate}
              />
            </div>
            <div>
              <ShinpoSelect
                id="edit-goal-status-select"
                label="Status"
                value={status}
                onChange={setStatus}
                options={GOAL_STATUS_OPTIONS}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-timer secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn-timer primary">
              <Icon name="check" size={14} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
