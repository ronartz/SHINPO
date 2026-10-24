import React, { useState } from 'react'
import { Icon } from '../common/Icon'
import { StarRating } from '../ui/StarRating'

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
  isSubmitting?: boolean
  errorMessage?: string | null
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
  isSubmitting = false,
  errorMessage = null,
  onCancel,
  onSubmit,
}) => {
  const [submittingDebrief, setSubmittingDebrief] = useState(false)

  if (!completingSessionId) return null

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setSubmittingDebrief(false)
    onSubmit(e, false)
  }

  const handleDebriefClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (isSubmitting) return
    const form = e.currentTarget.form
    if (!form?.reportValidity()) return
    setSubmittingDebrief(true)
    onSubmit(e, true)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-summary-title">
      <div className="modal-box">
        <h3 id="session-summary-title" className="modal-title">Session Summary</h3>
        <p className="modal-sub">
          Record your outcome, quality rating, and notes for this session.
        </p>

        {errorMessage && (
          <div className="modal-error-banner" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          {/* Quality Rating Section */}
          <div style={{ marginBottom: 16 }}>
            <div className="modal-section-label">
              <span>Session Quality</span>
            </div>
            <StarRating
              value={completionQuality}
              onChange={setCompletionQuality}
              disabled={isSubmitting}
            />
          </div>

          {/* Connected Task Checkbox */}
          {linkedTaskTitle && (
            <div className="modal-task-badge-row">
              <input
                type="checkbox"
                id="mark-task-completed-check"
                checked={markTaskCompleted ?? true}
                onChange={(e) => setMarkTaskCompleted?.(e.target.checked)}
                disabled={isSubmitting}
                style={{ width: 16, height: 16, cursor: isSubmitting ? 'not-allowed' : 'pointer', accentColor: 'var(--primary-coral, #3156D8)' }}
              />
              <label htmlFor="mark-task-completed-check" style={{ cursor: isSubmitting ? 'not-allowed' : 'pointer', flex: 1, userSelect: 'none' }}>
                Mark connected task <strong style={{ color: 'var(--accent-coral, #F97316)' }}>"{linkedTaskTitle}"</strong> as completed
              </label>
            </div>
          )}

          {/* Outcome Achieved Input */}
          <div style={{ marginBottom: 14 }}>
            <div className="modal-section-label">
              <span>Outcome Achieved</span>
              <span className="required-star">*</span>
            </div>
            <input
              type="text"
              className="modal-field"
              placeholder="What outcome was achieved during this block?"
              value={accomplishment}
              onChange={(e) => setAccomplishment(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Session Notes Textarea */}
          <div style={{ marginBottom: 18 }}>
            <div className="modal-section-label">
              <span>Session Notes</span>
              <span className="optional-tag">(Optional)</span>
            </div>
            <textarea
              className="modal-field"
              rows={3}
              placeholder="Any distractions, blockers, or key insights?"
              value={reflectionNotes}
              onChange={(e) => setReflectionNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-timer secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-timer primary"
              disabled={isSubmitting}
            >
              {isSubmitting && !submittingDebrief ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Summary'
              )}
            </button>
            <button
              type="button"
              className="btn-timer debrief-ai-btn"
              onClick={handleDebriefClick}
              disabled={isSubmitting}
              title="Save session summary and ask EONPAI for feedback"
            >
              {isSubmitting && submittingDebrief ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                  </svg>
                  Saving & Reviewing...
                </span>
              ) : (
                <>
                  <Icon name="sparkle" size={13} />
                  <span>Save & Review with EONPAI</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
