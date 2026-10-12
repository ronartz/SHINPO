import React from 'react'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'

export interface EditTaskModalProps {
  editingMission: Mission | null
  onClose: () => void
  goals: Goal[]
  goalId: number | null
  setGoalId: (val: number) => void
  title: string
  setTitle: (val: string) => void
  description: string
  setDescription: (val: string) => void
  scheduledDate: string
  setScheduledDate: (val: string) => void
  estimatedMinutes: number
  setEstimatedMinutes: (val: number) => void
  status: string
  setStatus: (val: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  editingMission,
  onClose,
  goals,
  goalId,
  setGoalId,
  title,
  setTitle,
  description,
  setDescription,
  scheduledDate,
  setScheduledDate,
  estimatedMinutes,
  setEstimatedMinutes,
  status,
  setStatus,
  onSubmit,
}) => {
  if (!editingMission) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit Task</h3>
        <p className="modal-sub">
          Update task details, associated goal, estimated duration, or status.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Associated Goal
            </label>
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
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Task Title
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
              Task Notes (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-field"
              rows={2}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Scheduled Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="modal-field"
                style={{ marginBottom: 0 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Estimated Minutes
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="modal-field"
                style={{ marginBottom: 0 }}
                required
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
                <option value="PENDING">PENDING</option>
                <option value="IN_PROGRESS">IN PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
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
