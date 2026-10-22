import React from 'react'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { PomodoroPlan } from '../../utils/focusTimer'
import { Icon } from '../common/Icon'
import { ShinpoSelect, ShinpoDatePicker, ShinpoTimePicker } from '../ui'

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
  isSubmitting?: boolean
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
  isSubmitting = false,
}) => {
  const taskOptions = React.useMemo(() => {
    const list: Array<{ value: number | ''; label: string; secondaryLabel?: string }> = [
      { value: '', label: '-- Independent Session --' },
    ]
    missions
      .filter((m) => m.status !== 'COMPLETED')
      .forEach((m) => {
        const g = goals.find((item) => item.id === m.goalId)
        list.push({
          value: m.id,
          label: m.title,
          secondaryLabel: g ? `Goal: ${g.title}` : undefined,
        })
      })
    return list
  }, [missions, goals])

  const handleTaskChange = (val: number | '') => {
    const id = val === '' ? null : Number(val)
    const currentMission = missions.find((item) => item.id === missionId)
    setMissionId(id)
    const m = missions.find((item) => item.id === id)
    if (m) {
      if (!name.trim() || name === currentMission?.title) setName(m.title)
      if (!intention.trim() || intention === currentMission?.title) setIntention(m.title)
      if (m.estimatedMinutes && (duration === 25 || duration === currentMission?.estimatedMinutes)) setDuration(m.estimatedMinutes)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={() => { if (!isSubmitting) onClose() }} role="presentation">
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-session-heading"
        style={{ maxWidth: 'min(520px, calc(100vw - 32px))' }}
      >
        <h3 id="schedule-session-heading" className="modal-title">{isEditing ? 'Edit Scheduled Session' : 'Schedule Focus Session'}</h3>
        <p className="modal-sub">
          {isEditing
            ? 'Update the timing, task connection, or intention for this scheduled focus session.'
            : 'Schedule a dedicated focus session on your calendar. Focus protection will activate automatically when the session starts.'}
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <ShinpoSelect<number | ''>
              id="schedule-session-task-select"
              label="Associated Task (Optional)"
              value={missionId ?? ''}
              onChange={handleTaskChange}
              options={taskOptions}
              searchable
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="shinpo-field-label" style={{ marginBottom: 6 }}>
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
            <label className="shinpo-field-label" style={{ marginBottom: 6 }}>
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
              <ShinpoDatePicker
                id="schedule-session-date-picker"
                label="Date"
                value={date}
                onChange={setDate}
                required
              />
            </div>
            <div>
              <ShinpoTimePicker
                id="schedule-session-time-picker"
                label="Time"
                value={time}
                onChange={setTime}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="shinpo-field-label" style={{ marginBottom: 6 }}>
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

            <label className="shinpo-field-label" style={{ marginBottom: 6 }}>
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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn-timer primary" disabled={isSubmitting}>
              <Icon name="check" size={14} />
              <span>{isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Schedule Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
