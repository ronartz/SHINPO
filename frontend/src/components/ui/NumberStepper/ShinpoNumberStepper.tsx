import React from 'react'
import { Icon } from '../../common/Icon'

export interface ShinpoNumberStepperProps {
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  ariaLabel?: string
  disabled?: boolean
  className?: string
  id?: string
}

export const ShinpoNumberStepper: React.FC<ShinpoNumberStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 120,
  step = 1,
  unit,
  ariaLabel,
  disabled = false,
  className = '',
  id,
}) => {
  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!disabled && value > min) {
      onChange(Math.max(min, value - step))
    }
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!disabled && value < max) {
      onChange(Math.min(max, value + step))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (value < max) onChange(Math.min(max, value + step))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (value > min) onChange(Math.max(min, value - step))
    }
  }

  return (
    <div className={`shinpo-number-stepper ${className}`} data-disabled={disabled}>
      <button
        type="button"
        className="stepper-btn stepper-dec"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${ariaLabel || 'value'}`}
        tabIndex={-1}
      >
        <Icon name="minus" size={14} />
      </button>

      <div className="stepper-input-wrapper">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const num = Number(e.target.value)
            if (!isNaN(num)) {
              onChange(Math.max(min, Math.min(max, num)))
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          className="stepper-input"
        />
        {unit && <span className="stepper-unit">{unit}</span>}
      </div>

      <button
        type="button"
        className="stepper-btn stepper-inc"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label={`Increase ${ariaLabel || 'value'}`}
        tabIndex={-1}
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}
