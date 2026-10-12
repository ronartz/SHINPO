import React from 'react'
import { Icon } from '../common/Icon'

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
          <input
            type="text"
            placeholder="Goal title (e.g. Master Distributed Systems)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="modal-field"
            required
            autoFocus
          />

          <textarea
            placeholder="Description or target outcome (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="modal-field"
            rows={3}
          />

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-3)',
                marginBottom: 6,
              }}
            >
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

