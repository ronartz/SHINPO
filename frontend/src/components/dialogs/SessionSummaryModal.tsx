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
              onClick={(e) => onSubmit(e, true)}
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

