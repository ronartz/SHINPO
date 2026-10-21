import React from 'react'
import { Icon } from '../common/Icon'
import { ShinpoDatePicker } from '../ui'

export interface CreateGoalModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  setTitle: (val: string) => void
  description: string
  setDescription: (val: string) => void
  targetDate: string
  setTargetDate: (val: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  isOpen,
  onClose,
  title,
  setTitle,
  description,
  setDescription,
  targetDate,
  setTargetDate,
  onSubmit,
}) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Create Goal</h3>
        <p className="modal-sub">
          Set a high-level goal. You can break it down into tasks later with EONPAI.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="create-goal-title" className="shinpo-field-label" style={{ marginBottom: 6 }}>
              Goal Title
            </label>
            <input
              id="create-goal-title"
              type="text"
              placeholder="e.g. Master Distributed Systems, Finish Q3 Milestone..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="modal-field"
              required
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="create-goal-desc" className="shinpo-field-label" style={{ marginBottom: 6 }}>
              Description (optional)
            </label>
            <textarea
              id="create-goal-desc"
              placeholder="Description or target outcome..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-field"
              rows={3}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <ShinpoDatePicker
              label="Target Date"
              value={targetDate}
              onChange={setTargetDate}
            />
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
              <Icon name="plus" size={14} />
              <span>Create Goal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

