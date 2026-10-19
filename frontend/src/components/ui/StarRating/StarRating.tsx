import React, { useState, useCallback } from 'react'

export interface StarRatingProps {
  value: number
  onChange?: (rating: number) => void
  disabled?: boolean
  readOnly?: boolean
  size?: number
  showLabel?: boolean
  className?: string
  id?: string
}

const STAR_RATING_LABELS: Record<number, string> = {
  1: 'Needs Work',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Exceptional',
}

const StarIcon: React.FC<{ filled: boolean; size: number }> = ({ filled, size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={filled ? '1' : '1.75'}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shinpo-star-svg ${filled ? 'filled' : 'empty'}`}
    aria-hidden="true"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  size = 26,
  showLabel = true,
  className = '',
  id,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const isInteractive = !disabled && !readOnly && !!onChange
  const displayRating = hoverValue !== null ? hoverValue : value

  const handleSelect = useCallback(
    (star: number) => {
      if (!isInteractive) return
      onChange(star)
    },
    [isInteractive, onChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, star: number) => {
      if (!isInteractive) return

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.min(5, (value || 0) + 1)
        onChange(next)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        const prev = Math.max(1, (value || 2) - 1)
        onChange(prev)
      } else if (e.key >= '1' && e.key <= '5') {
        e.preventDefault()
        onChange(Number(e.key))
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        onChange(star)
      } else if (e.key === 'Home') {
        e.preventDefault()
        onChange(1)
      } else if (e.key === 'End') {
        e.preventDefault()
        onChange(5)
      }
    },
    [isInteractive, onChange, value]
  )

  const activeLabel = displayRating > 0 ? `${displayRating}/5 · ${STAR_RATING_LABELS[displayRating] || ''}` : 'Rate session quality'

  return (
    <div
      id={id}
      className={`shinpo-star-rating-control ${disabled ? 'is-disabled' : ''} ${className}`}
      onMouseLeave={() => isInteractive && setHoverValue(null)}
    >
      <div
        className="shinpo-star-group"
        role="radiogroup"
        aria-label="Session quality rating"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= displayRating
          const isCurrentChoice = star === value
          const isHovered = hoverValue !== null && star <= hoverValue

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={isCurrentChoice}
              aria-label={`${star} star${star > 1 ? 's' : ''} - ${STAR_RATING_LABELS[star]}`}
              disabled={disabled}
              tabIndex={disabled ? -1 : value === star || (value === 0 && star === 1) ? 0 : -1}
              className={`shinpo-star-btn ${isFilled ? 'is-filled' : 'is-empty'} ${isHovered ? 'is-hovered' : ''} ${isCurrentChoice ? 'is-selected' : ''}`}
              onClick={() => handleSelect(star)}
              onMouseEnter={() => isInteractive && setHoverValue(star)}
              onKeyDown={(e) => handleKeyDown(e, star)}
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
              }}
            >
              <StarIcon filled={isFilled} size={size} />
            </button>
          )
        })}
      </div>

      {showLabel && (
        <div
          className={`shinpo-star-label-badge ${displayRating > 0 ? 'has-rating' : 'empty'}`}
          aria-live="polite"
        >
          {activeLabel}
        </div>
      )}
    </div>
  )
}
