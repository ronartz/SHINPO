import React from 'react'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'
import { ShinpoSelect, ShinpoDatePicker } from '../ui'

const MISSION_STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

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
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-task-heading"
      >
        <h3 id="edit-task-heading" className="modal-title">Edit Task</h3>
        <p className="modal-sub">
          Update task details, associated goal, estimated duration, or status.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <ShinpoSelect<number>
              id="edit-task-goal-select"
              label="Associated Goal"
              value={goalId ?? goals[0]?.id ?? 0}
              onChange={setGoalId}
              options={goals.map((g) => ({ value: g.id, label: g.title }))}
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="edit-task-title-input"
              style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}
            >
              Task Title
            </label>
            <input
              id="edit-task-title-input"
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
              htmlFor="edit-task-desc-input"
              style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}
            >
              Task Notes (optional)
            </label>
            <textarea
              id="edit-task-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="modal-field"
              rows={2}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div>
              <ShinpoDatePicker
                id="edit-task-date-input"
                label="Scheduled Date"
                value={scheduledDate}
                onChange={setScheduledDate}
                required
              />
            </div>
            <div>
              <label
                htmlFor="edit-task-duration-input"
                style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}
              >
                Estimated Minutes
              </label>
              <input
                id="edit-task-duration-input"
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
              <ShinpoSelect
                id="edit-task-status-select"
                label="Status"
                value={status}
                onChange={setStatus}
                options={MISSION_STATUS_OPTIONS}
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
