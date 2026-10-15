import React from 'react'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { PomodoroPlan } from '../../utils/focusTimer'
import { Icon } from '../common/Icon'

export interface ScheduleSessionModalProps {
  isOpen: boolean
  onClose: () => void
  missions: Mission[]
  goals: Goal[]
  missionId: number | null
  setMissionId: (val: number | null) => void
  name: string
  setName: (val: string) => void
  intention: string
  setIntention: (val: string) => void
  date: string
  setDate: (val: string) => void
  time: string
  setTime: (val: string) => void
  pomodoroPlans: PomodoroPlan[]
  planName: string | null
  setPlanName: (val: string | null) => void
  duration: number
  setDuration: (val: number) => void
  onSubmit: (e: React.FormEvent) => void
  isEditing?: boolean
}

export const ScheduleSessionModal: React.FC<ScheduleSessionModalProps> = ({
  isOpen,
  onClose,
  missions,
  goals,
  missionId,
  setMissionId,
  name,
  setName,
  intention,
  setIntention,
  date,
  setDate,
  time,
  setTime,
  pomodoroPlans,
  planName,
  setPlanName,
  duration,
  setDuration,
  onSubmit,
  isEditing = false,
}) => {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(520px, calc(100vw - 32px))' }}>
        <h3 className="modal-title">{isEditing ? 'Edit Scheduled Session' : 'Schedule Focus Session'}</h3>
        <p className="modal-sub">
          {isEditing
            ? 'Update the timing, task connection, or intention for this scheduled focus session.'
            : 'Schedule a dedicated focus session on your calendar. Focus protection will activate automatically when the session starts.'}
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Associated Task (Optional)
            </label>
            <select
              className="modal-field"
              value={missionId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                setMissionId(id)
                const m = missions.find((item) => item.id === id)
                if (m) {
                  setName(m.title)
                  setIntention(m.title)
                  if (m.estimatedMinutes) setDuration(m.estimatedMinutes)
                }
              }}
            >
              <option value="">-- Independent Session --</option>
              {missions
                .filter((m) => m.status !== 'COMPLETED')
                .map((m) => {
                  const g = goals.find((item) => item.id === m.goalId)
                  return (
                    <option key={m.id} value={m.id}>
                      {m.title} {g ? `(Goal: ${g.title})` : ''}
                    </option>
                  )
                })}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Session Name
            </label>
            <input
              type="text"
              placeholder="e.g. Deep Work Session, Refactoring..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="modal-field"
              required
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Session Intention (Optional)
            </label>
            <input
              type="text"
              placeholder="What do you plan to achieve?"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              className="modal-field"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="modal-field"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="modal-field"
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Focus Plan (Optional)
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {pomodoroPlans.map((plan) => (
                <button
                  type="button"
                  key={plan.name}
                  className={`auth-tab-btn ${planName === plan.name ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => {
                    setPlanName(plan.name)
                    setDuration(plan.totalMinutes)
                    if (!name) setName(plan.name)
                  }}
                >
                  {plan.name} ({plan.totalMinutes}m)
                </button>
              ))}
              <button
                type="button"
                className={`auth-tab-btn ${planName === null ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setPlanName(null)}
              >
                Custom Single Session
              </button>
            </div>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6 }}>
              Duration Preset ({duration} min)
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[15, 25, 30, 45, 50, 60, 90, 120].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  className={`auth-tab-btn ${duration === mins ? 'active' : ''}`}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                  onClick={() => setDuration(mins)}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              className="btn-timer secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn-timer primary">
              <Icon name="check" size={14} />
              <span>{isEditing ? 'Save Changes' : 'Schedule Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
