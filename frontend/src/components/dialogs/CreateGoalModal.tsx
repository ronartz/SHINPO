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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="create-goal-title">
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 id="create-goal-title" className="modal-title">Create Goal</h3>
        <p className="modal-sub">
          Set an outcome you want to achieve. You can turn it into smaller tasks later.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="create-goal-title" className="shinpo-field-label" style={{ marginBottom: 6 }}>
              Goal name
            </label>
            <input
              id="create-goal-title"
              type="text"
              placeholder="e.g. Master Distributed Systems, Finish Q3 Milestone..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
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
              placeholder="What does success look like?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              className="modal-field"
              rows={3}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <ShinpoDatePicker
              label="Target date"
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
