import React, { useEffect, useState } from 'react'
import type { Goal } from '../../api/goalsAndMissions'
import { Icon } from '../common/Icon'
import { ShinpoSelect } from '../ui'

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

const DURATION_PRESETS = [10, 15, 20, 25, 30, 45, 60, 90, 120] as const
const MIN_DURATION = 5
const MAX_DURATION = 480

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
  const isPreset = (DURATION_PRESETS as readonly number[]).includes(duration)
  const [userSelectedCustom, setUserSelectedCustom] = useState<boolean>(false)
  const isCustom = userSelectedCustom || !isPreset
  const [customInput, setCustomInput] = useState<string>(() => String(duration || 25))

  // Ensure default goal selection if goalId is uninitialized
  useEffect(() => {
    if (isOpen && goals.length > 0) {
      if (!goalId || !goals.some((g) => g.id === goalId)) {
        setGoalId(goals[0].id)
      }
    }
  }, [isOpen, goals, goalId, setGoalId])

  if (!isOpen) return null

  const parsedCustom = parseInt(customInput, 10)
  const isCustomValid = !isNaN(parsedCustom) && parsedCustom >= MIN_DURATION && parsedCustom <= MAX_DURATION
  const isDurationValid = isCustom ? isCustomValid : duration >= MIN_DURATION && duration <= MAX_DURATION

  const handlePresetSelect = (dur: number) => {
    setUserSelectedCustom(false)
    setCustomInput(String(dur))
    setDuration(dur)
  }

  const handleCustomToggle = () => {
    setUserSelectedCustom(true)
    if (isCustomValid) {
      setDuration(parsedCustom)
    }
  }

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value
    setCustomInput(valStr)
    const num = parseInt(valStr, 10)
    if (!isNaN(num) && num >= MIN_DURATION && num <= MAX_DURATION) {
      setDuration(num)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="create-task-title">
      <div className="modal-box create-task-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="create-task-modal-header">
          <h3 id="create-task-title" className="modal-title">Create Task</h3>
          <button
            type="button"
            className="modal-close-button"
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
            <label htmlFor="create-task-goal" className="shinpo-field-label" style={{ marginBottom: 6 }}>
              Associated Goal
            </label>
            {goals.length === 0 ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255, 77, 94, 0.1)', border: '1px solid rgba(255, 77, 94, 0.3)' }}>
                <p style={{ fontSize: 13.5, color: 'var(--brand-coral, #FF4D5E)', margin: 0, fontWeight: 600 }}>
                  No goals available. Please create a goal first.
                </p>
              </div>
            ) : (
              <ShinpoSelect<number>
                id="create-task-goal"
                value={goalId ?? goals[0]?.id ?? 0}
                onChange={setGoalId}
                options={goals.map((g) => ({ value: g.id, label: g.title }))}
                required
              />
            )}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="create-task-title-input" className="shinpo-field-label" style={{ marginBottom: 6 }}>
              Task Title
            </label>
            <input
              id="create-task-title-input"
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
            <label className="shinpo-field-label" style={{ marginBottom: 8 }}>
              Estimated Duration ({isCustom ? `${isCustomValid ? parsedCustom : 'Custom'} min` : `${duration} min`})
            </label>

            {/* 10-Option Duration Selector Grid (5x2) */}
            <div
              className="create-task-duration-grid"
              role="group"
              aria-label="Duration Presets"
            >
              {DURATION_PRESETS.map((dur) => {
                const isSelected = !isCustom && duration === dur
                return (
                  <button
                    key={dur}
                    type="button"
                    className={`btn-timer ${isSelected ? 'primary' : 'secondary'} create-task-duration-button`}
                    onClick={() => handlePresetSelect(dur)}
                    aria-pressed={isSelected}
                  >
                    {dur}m
                  </button>
                )
              })}
              <button
                type="button"
                className={`btn-timer ${isCustom ? 'primary' : 'secondary'} create-task-duration-button`}
                onClick={handleCustomToggle}
                aria-pressed={isCustom}
              >
                Custom
              </button>
            </div>

            {/* Custom Input Block */}
            {isCustom && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="number"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step={5}
                    value={customInput}
                    onChange={handleCustomInputChange}
                    placeholder="Enter 5 to 480"
                    className="modal-field"
                    style={{
                      marginBottom: 0,
                      paddingRight: 60,
                      borderColor: !isCustomValid ? 'var(--brand-coral, #FF4D5E)' : undefined,
                    }}
                    aria-label="Custom duration in minutes"
                    aria-invalid={!isCustomValid}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--text-3)',
                      pointerEvents: 'none',
                    }}
                  >
                    min
                  </span>
                </div>
                {!isCustomValid ? (
                  <span style={{ fontSize: 12, color: 'var(--brand-coral, #FF4D5E)', fontWeight: 600 }}>
                    Please enter a duration between {MIN_DURATION} and {MAX_DURATION} minutes.
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    Sensible boundary: {MIN_DURATION}m to {MAX_DURATION}m (up to 8 hours).
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="create-task-modal-actions">
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
              disabled={isSubmitting || !title.trim() || goals.length === 0 || !isDurationValid}
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

