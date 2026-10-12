import React from 'react'
import type { Goal } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit Goal</h3>
        <p className="modal-sub">
          Update the goal details, target date, or status.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Goal Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-field"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-field"
              rows={3}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="modal-field"
                style={{ marginBottom: 0 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Status
              </label>
              <select
                className="modal-field"
                style={{ marginBottom: 0 }}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAUSED">PAUSED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
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
