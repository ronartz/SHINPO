import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react'
import { ShinpoPopover } from '../Popover/ShinpoPopover'
import type { ShinpoTimePickerProps } from './types'

export const ShinpoTimePicker: React.FC<ShinpoTimePickerProps> = ({
  value,
  onChange,
  id,
  name,
  label,
  placeholder = 'HH:mm',
  helperText,
  errorMessage,
  disabled = false,
  required = false,
  stepMinutes = 5,
  className = '',
  style,
  'data-tutorial': dataTutorial,
  'data-testid': dataTestId,
}) => {
  const generatedId = useId()
  const timePickerId = id || `shinpo-time-${generatedId}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const hourColRef = useRef<HTMLDivElement>(null)
  const minColRef = useRef<HTMLDivElement>(null)

  const [isOpen, setIsOpen] = useState(false)

  // Parse HH:mm
  const { currentHour, currentMinute } = useMemo(() => {
    if (value && /^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':').map(Number)
      return { currentHour: h, currentMinute: m }
    }
    return { currentHour: 9, currentMinute: 0 }
  }, [value])

  const hoursList = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i)
  }, [])

  const minutesList = useMemo(() => {
    const list: number[] = []
    const step = Math.max(1, Math.min(30, stepMinutes))
    for (let m = 0; m < 60; m += step) {
      list.push(m)
    }
    return list
  }, [stepMinutes])

  const handleOpen = useCallback(() => {
    if (disabled) return
    setIsOpen(true)
  }, [disabled])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  // Scroll to active hour/minute when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hourColRef.current) {
          const activeH = hourColRef.current.querySelector('.is-selected') as HTMLElement | null
          activeH?.scrollIntoView({ block: 'center' })
        }
        if (minColRef.current) {
          const activeM = minColRef.current.querySelector('.is-selected') as HTMLElement | null
          activeM?.scrollIntoView({ block: 'center' })
        }
      }, 50)
    }
  }, [isOpen])

  const handleSelectHour = (h: number) => {
    const hStr = String(h).padStart(2, '0')
    const mStr = String(currentMinute).padStart(2, '0')
    onChange(`${hStr}:${mStr}`)
  }

  const handleSelectMinute = (m: number) => {
    const hStr = String(currentHour).padStart(2, '0')
    const mStr = String(m).padStart(2, '0')
    onChange(`${hStr}:${mStr}`)
  }

  const handleSetPreset = (presetTime: string) => {
    onChange(presetTime)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleSetNow = () => {
    const now = new Date()
    const hStr = String(now.getHours()).padStart(2, '0')
    const roundedM = Math.floor(now.getMinutes() / stepMinutes) * stepMinutes
    const mStr = String(roundedM).padStart(2, '0')
    onChange(`${hStr}:${mStr}`)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={`shinpo-field-group ${className}`} style={style}>
      {label && (
        <label htmlFor={timePickerId} className="shinpo-field-label">
          <span>
            {label}
            {required && <span className="shinpo-field-required">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={timePickerId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label || 'Select Time'}
        aria-invalid={Boolean(errorMessage)}
        disabled={disabled}
        data-tutorial={dataTutorial}
        data-testid={dataTestId}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={`shinpo-datepicker-trigger ${isOpen ? 'is-open' : ''} ${
          errorMessage ? 'has-error' : ''
        }`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--primary-violet, #3156D8)', display: 'flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <span style={{ fontWeight: value ? 600 : 400, color: value ? 'inherit' : 'var(--text-3, #9096A4)' }}>
            {value || placeholder}
          </span>
        </div>

        <span className="shinpo-select-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 5.293a1 1 0 011.414 0L8 7.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Hidden form input */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Popover Surface */}
      <ShinpoPopover
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
        minWidth={240}
        ariaLabel={label || 'Time Picker'}
        className="shinpo-timepicker-popover"
      >
        <div className="shinpo-timepicker-panel" role="dialog" aria-modal="false" aria-label="Time Picker">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-2, #B0B5C2)' }}>
            <span>Hours</span>
            <span>Minutes</span>
          </div>

          <div className="shinpo-timepicker-columns">
            {/* Hours column */}
            <div ref={hourColRef} className="shinpo-timepicker-col" tabIndex={-1}>
              {hoursList.map((h) => {
                const isSelected = Boolean(value && currentHour === h)
                return (
                  <button
                    key={h}
                    type="button"
                    className={`shinpo-timepicker-unit-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectHour(h)}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                )
              })}
            </div>

            {/* Minutes column */}
            <div ref={minColRef} className="shinpo-timepicker-col" tabIndex={-1}>
              {minutesList.map((m) => {
                const isSelected = Boolean(value && currentMinute === m)
                return (
                  <button
                    key={m}
                    type="button"
                    className={`shinpo-timepicker-unit-btn ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelectMinute(m)}
                  >
                    {String(m).padStart(2, '0')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))' }}>
            <button
              type="button"
              className="shinpo-btn variant-ghost size-sm"
              onClick={handleSetNow}
              style={{ fontSize: 12, padding: '0 8px', height: 26 }}
            >
              Now
            </button>
            {['09:00', '12:00', '14:00', '18:00'].map((p) => (
              <button
                key={p}
                type="button"
                className="shinpo-btn variant-ghost size-sm"
                onClick={() => handleSetPreset(p)}
                style={{ fontSize: 12, padding: '0 8px', height: 26 }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </ShinpoPopover>

      {errorMessage && <div className="shinpo-field-error">{errorMessage}</div>}
      {!errorMessage && helperText && <div className="shinpo-field-helper">{helperText}</div>}
    </div>
  )
}
