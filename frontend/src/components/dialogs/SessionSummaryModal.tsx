import React from 'react'
import { Icon } from '../common/Icon'

export interface SessionSummaryModalProps {
  completingSessionId: number | null
  completionQuality: number
  setCompletionQuality: (rating: number) => void
  accomplishment: string
  setAccomplishment: (val: string) => void
  reflectionNotes: string
  setReflectionNotes: (val: string) => void
  markTaskCompleted?: boolean
  setMarkTaskCompleted?: (val: boolean) => void
  linkedTaskTitle?: string | null
  onCancel: () => void
  onSubmit: (e: React.FormEvent, triggerAiDebrief?: boolean) => void
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  completingSessionId,
  completionQuality,
  setCompletionQuality,
  accomplishment,
  setAccomplishment,
  reflectionNotes,
  setReflectionNotes,
  markTaskCompleted,
  setMarkTaskCompleted,
  linkedTaskTitle,
  onCancel,
  onSubmit,
}) => {
  if (!completingSessionId) return null

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3 className="modal-title">Session Summary</h3>
        <p className="modal-sub">
          Record your outcome and notes for this session.
        </p>

        <form onSubmit={(e) => onSubmit(e, false)}>
          <div className="star-rating-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                className={`star-btn ${star <= completionQuality ? 'active' : ''}`}
                onClick={() => setCompletionQuality(star)}
              >
                <span style={{ fontSize: 20 }}>★</span>
              </button>
            ))}
          </div>

          {linkedTaskTitle && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-hover)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 14,
                fontSize: 13,
                color: 'var(--text-1)',
              }}
            >
              <input
                type="checkbox"
                id="mark-task-completed-check"
                checked={markTaskCompleted ?? true}
                onChange={(e) => setMarkTaskCompleted?.(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent-red)' }}
              />
              <label htmlFor="mark-task-completed-check" style={{ cursor: 'pointer', flex: 1 }}>
                Mark connected task <strong style={{ color: 'var(--accent-coral)' }}>"{linkedTaskTitle}"</strong> as completed
              </label>
            </div>
          )}

          <input
            type="text"
            className="modal-field"
            placeholder="What outcome was achieved?"
            value={accomplishment}
            onChange={(e) => setAccomplishment(e.target.value)}
            required
          />

          <textarea
            className="modal-field"
            rows={3}
            placeholder="Session notes: Any distractions, blockers, or key insights? (optional)"
            value={reflectionNotes}
            onChange={(e) => setReflectionNotes(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-timer secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button type="submit" className="btn-timer primary">
              Save Summary
            </button>
            <button
              type="button"
              className="btn-timer debrief-ai-btn"
              onClick={(e) => {
                const form = e.currentTarget.form
                if (!form?.reportValidity()) return
                onSubmit(e, true)
              }}
              title="Save session summary and ask EONPAI for feedback"
            >
              <Icon name="sparkle" size={13} />
              <span>Save & Review with EONPAI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
