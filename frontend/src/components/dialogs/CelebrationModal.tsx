import React, { useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import type { CelebrationPayload } from '../../utils/progressionEngine'

export interface CelebrationModalProps {
  payload: CelebrationPayload | null
  onClose: () => void
  onNextAction?: () => void
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  payload,
  onClose,
  onNextAction,
}) => {
  const continueBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!payload) return

    // Focus the primary continue button for swift keyboard navigation
    const timer = setTimeout(() => {
      continueBtnRef.current?.focus()
    }, 80)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [payload, onClose])

  if (!payload) return null

  const isLevelUp = payload.type === 'LEVEL_UP'

  return (
    <div
      className="celebration-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`celebration-card ${isLevelUp ? 'is-level-up' : ''}`}>
        {/* Glow Shimmer Background */}
        <div className="celebration-glow" aria-hidden="true" />

        {/* Header Icon / Badge */}
        <div className="celebration-badge-container">
          <div className="celebration-badge-burst">
            <Icon name={isLevelUp ? 'sparkle' : 'check'} size={32} />
          </div>
          {payload.xpEarned > 0 && (
            <div className="celebration-xp-pill">
              +{payload.xpEarned} XP
            </div>
          )}
        </div>

        {/* Content */}
        <div className="celebration-body">
          <h2 id="celebration-title" className="celebration-title">
            {payload.headline}
          </h2>
          <p className="celebration-detail">
            {payload.detail}
          </p>

          {isLevelUp && payload.newLevel && (
            <div className="celebration-level-announcement">
              <span className="level-number">Tier {payload.newLevel}</span>
              <span className="level-title">{payload.levelTitle || 'Master of Flow'}</span>
            </div>
          )}

          {payload.streakDays !== undefined && payload.streakDays > 1 && (
            <div className="celebration-streak-note">
              <span>🔥 {payload.streakDays}-Day Momentum Active</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="celebration-actions">
          {payload.nextActionPrompt && onNextAction ? (
            <button
              type="button"
              className="celebration-btn secondary"
              onClick={() => {
                onClose()
                onNextAction()
              }}
            >
              <span>{payload.nextActionPrompt}</span>
              <Icon name="chevron-right" size={14} />
            </button>
          ) : null}

          <button
            ref={continueBtnRef}
            type="button"
            className="celebration-btn primary"
            onClick={onClose}
          >
            <span>Continue</span>
          </button>
        </div>
      </div>
    </div>
  )
}
