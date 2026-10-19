import React, { useState, useRef, useCallback, useId, useMemo } from 'react'
import { ShinpoPopover } from '../Popover/ShinpoPopover'
import type { ShinpoDatePickerProps } from './types'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const formatDateStr = (year: number, monthIndex: number, day: number): string => {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const parseDateStr = (str: string): { year: number; month: number; day: number } | null => {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null
  const [y, m, d] = str.split('-').map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return { year: y, month: m - 1, day: d }
}

export const ShinpoDatePicker: React.FC<ShinpoDatePickerProps> = ({
  value,
  onChange,
  id,
  name,
  label,
  placeholder = 'YYYY-MM-DD',
  helperText,
  errorMessage,
  disabled = false,
  required = false,
  minDate,
  maxDate,
  allowClear = true,
  className = '',
  style,
  'data-tutorial': dataTutorial,
  'data-testid': dataTestId,
}) => {
  const generatedId = useId()
  const datePickerId = id || `shinpo-date-${generatedId}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const parsed = useMemo(() => parseDateStr(value), [value])

  const today = useMemo(() => {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      str: formatDateStr(now.getFullYear(), now.getMonth(), now.getDate()),
    }
  }, [])

  // View state for calendar browsing (Year & Month)
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? today.year)
  const [viewMonth, setViewMonth] = useState(() => parsed?.month ?? today.month)


  const handleOpen = useCallback(() => {
    if (disabled) return
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    } else {
      setViewYear(today.year)
      setViewMonth(today.month)
    }
    setIsOpen(true)
  }, [disabled, parsed, today])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    triggerRef.current?.focus()
  }, [])

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleTodayClick = () => {
    handleSelectDate(today.str)
  }

  const handleClearClick = () => {
    onChange('')
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  // Generate 42 calendar grid cells (6 rows x 7 days, Monday-first)
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    // Convert Sunday=0 to Monday=0
    const startOffset = (firstDayOfWeek + 6) % 7

    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const cells: Array<{
      dateStr: string
      dayNum: number
      isOutside: boolean
      isDisabled: boolean
      isSelected: boolean
      isToday: boolean
    }> = []

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
      const dateStr = formatDateStr(prevYear, prevMonth, dayNum)
      const isDisabled = Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate))
      cells.push({
        dateStr,
        dayNum,
        isOutside: true,
        isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === today.str,
      })
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = formatDateStr(viewYear, viewMonth, dayNum)
      const isDisabled = Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate))
      cells.push({
        dateStr,
        dayNum,
        isOutside: false,
        isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === today.str,
      })
    }

    // Next month padding to fill 42 cells
    const remaining = 42 - cells.length
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
      const dateStr = formatDateStr(nextYear, nextMonth, dayNum)
      const isDisabled = Boolean((minDate && dateStr < minDate) || (maxDate && dateStr > maxDate))
      cells.push({
        dateStr,
        dayNum,
        isOutside: true,
        isDisabled,
        isSelected: dateStr === value,
        isToday: dateStr === today.str,
      })
    }

    return cells
  }, [viewYear, viewMonth, minDate, maxDate, value, today.str])

  return (
    <div className={`shinpo-field-group ${className}`} style={style}>
      {label && (
        <label htmlFor={datePickerId} className="shinpo-field-label">
          <span>
            {label}
            {required && <span className="shinpo-field-required">*</span>}
          </span>
        </label>
      )}

      {/* Styled Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={datePickerId}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label || 'Select Date'}
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
          <span style={{ color: 'var(--primary-violet, #9757FA)', display: 'flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
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

      {/* Hidden input for HTML form submissions */}
      {name && <input type="hidden" name={name} value={value} />}

      {/* Popover Calendar */}
      <ShinpoPopover
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
        minWidth={288}
        ariaLabel={label || 'Calendar'}
        className="shinpo-datepicker-popover"
      >
        <div className="shinpo-calendar-panel" role="dialog" aria-modal="false" aria-label="Date Picker">
          {/* Header Month / Year Navigation */}
          <div className="shinpo-calendar-header">
            <button
              type="button"
              className="shinpo-calendar-nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous Month"
            >
              ‹
            </button>
            <div className="shinpo-calendar-title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              className="shinpo-calendar-nav-btn"
              onClick={handleNextMonth}
              aria-label="Next Month"
            >
              ›
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="shinpo-calendar-weekdays" aria-hidden="true">
            {WEEKDAY_NAMES.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          {/* 7-Column Day Grid */}
          <div className="shinpo-calendar-days-grid" role="grid">
            {calendarCells.map((cell) => (
              <button
                key={cell.dateStr}
                type="button"
                disabled={cell.isDisabled}
                className={`shinpo-calendar-day-btn ${cell.isSelected ? 'is-selected' : ''} ${
                  cell.isToday ? 'is-today' : ''
                } ${cell.isOutside ? 'is-outside-month' : ''}`}
                onClick={() => handleSelectDate(cell.dateStr)}
                aria-label={cell.dateStr}
                aria-selected={cell.isSelected}
              >
                {cell.dayNum}
              </button>
            ))}
          </div>

          {/* Calendar Actions */}
          <div className="shinpo-calendar-footer">
            <button
              type="button"
              className="shinpo-btn variant-ghost size-sm"
              onClick={handleTodayClick}
              style={{ fontSize: 12, padding: '0 8px', height: 26 }}
            >
              Today
            </button>

            {allowClear && value && (
              <button
                type="button"
                className="shinpo-btn variant-ghost size-sm"
                onClick={handleClearClick}
                style={{ fontSize: 12, padding: '0 8px', height: 26, color: 'var(--brand-red, #F87171)' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </ShinpoPopover>

      {errorMessage && <div className="shinpo-field-error">{errorMessage}</div>}
      {!errorMessage && helperText && <div className="shinpo-field-helper">{helperText}</div>}
    </div>
  )
}
