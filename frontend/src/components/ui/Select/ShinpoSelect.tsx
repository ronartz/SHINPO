import React, { useState, useRef, useEffect, useCallback, useId } from 'react'
import { ShinpoPopover } from '../Popover/ShinpoPopover'
import type { ShinpoSelectProps, SelectOption } from './types'

export const ShinpoSelect = <T extends string | number>({
  value,
  onChange,
  options,
  id,
  name,
  label,
  placeholder = 'Select an option...',
  helperText,
  errorMessage,
  disabled = false,
  required = false,
  size = 'md',
  searchable = false,
  className = '',
  style,
  triggerClassName = '',
  minWidth,
  ariaLabel,
  'data-tutorial': dataTutorial,
  'data-testid': dataTestId,
}: ShinpoSelectProps<T>) => {
  const generatedId = useId()
  const selectId = id || `shinpo-select-${generatedId}`
  const listboxId = `${selectId}-listbox`

  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeaheadTimeoutRef = useRef<number | null>(null)
  const typeaheadBufferRef = useRef<string>('')

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options
    const q = searchQuery.toLowerCase()
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.secondaryLabel && opt.secondaryLabel.toLowerCase().includes(q))
    )
  }, [options, searchable, searchQuery])

  // Current selected option
  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )

  const handleOpen = useCallback(() => {
    if (disabled) return
    const idx = options.findIndex((opt) => opt.value === value)
    setHighlightedIndex(idx >= 0 ? idx : 0)
    setIsOpen(true)
    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [disabled, options, value, searchable])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
    setHighlightedIndex(-1)
    triggerRef.current?.focus()
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.shinpo-select-option')
      const target = items[highlightedIndex] as HTMLElement | undefined
      if (target) {
        target.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [isOpen, highlightedIndex])

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return
      onChange(option.value)
      setIsOpen(false)
      triggerRef.current?.focus()
    },
    [onChange]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return

      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleOpen()
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setHighlightedIndex((prev) => {
            let next = prev + 1
            while (next < filteredOptions.length && filteredOptions[next].disabled) {
              next++
            }
            return next < filteredOptions.length ? next : prev
          })
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setHighlightedIndex((prev) => {
            let next = prev - 1
            while (next >= 0 && filteredOptions[next].disabled) {
              next--
            }
            return next >= 0 ? next : prev
          })
          break
        }
        case 'Home': {
          e.preventDefault()
          const first = filteredOptions.findIndex((o) => !o.disabled)
          if (first >= 0) setHighlightedIndex(first)
          break
        }
        case 'End': {
          e.preventDefault()
          for (let i = filteredOptions.length - 1; i >= 0; i--) {
            if (!filteredOptions[i].disabled) {
              setHighlightedIndex(i)
              break
            }
          }
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightedIndex])
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          handleClose()
          break
        }
        case 'Tab': {
          setIsOpen(false)
          break
        }
        default: {
          // Typeahead support
          if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            if (typeaheadTimeoutRef.current) {
              window.clearTimeout(typeaheadTimeoutRef.current)
            }
            typeaheadBufferRef.current += e.key.toLowerCase()

            const matchIndex = filteredOptions.findIndex(
              (opt) => !opt.disabled && opt.label.toLowerCase().startsWith(typeaheadBufferRef.current)
            )
            if (matchIndex >= 0) {
              setHighlightedIndex(matchIndex)
            }

            typeaheadTimeoutRef.current = window.setTimeout(() => {
              typeaheadBufferRef.current = ''
            }, 600)
          }
        }
      }
    },
    [disabled, isOpen, handleOpen, handleClose, handleSelect, highlightedIndex, filteredOptions, searchable]
  )

  return (
    <div className={`shinpo-field-group ${className}`} style={style}>
      {label && (
        <label htmlFor={selectId} className="shinpo-field-label">
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
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={ariaLabel || label}
        aria-required={required}
        aria-invalid={Boolean(errorMessage)}
        disabled={disabled}
        data-tutorial={dataTutorial}
        data-testid={dataTestId}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
        className={`shinpo-select-trigger size-${size} ${isOpen ? 'is-open' : ''} ${
          errorMessage ? 'has-error' : ''
        } ${triggerClassName}`}
      >
        <div className="shinpo-select-value-wrap">
          {selectedOption ? (
            <>
              {selectedOption.icon && <span className="shinpo-select-icon">{selectedOption.icon}</span>}
              <span className="shinpo-select-value">{selectedOption.label}</span>
            </>
          ) : (
            <span className="shinpo-select-placeholder">{placeholder}</span>
          )}
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

      {/* Hidden input for HTML form compatibility */}
      {name && <input type="hidden" name={name} value={String(value ?? '')} />}

      {/* Popover Surface */}
      <ShinpoPopover
        isOpen={isOpen}
        onClose={handleClose}
        triggerRef={triggerRef}
        matchTriggerWidth
        minWidth={minWidth}
        ariaLabel={label || 'Select Options'}
        className="shinpo-select-popover"
      >
        {searchable && (
          <div className="shinpo-select-search-wrap">
            <input
              ref={searchInputRef}
              type="text"
              className="shinpo-select-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(0)
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${selectId}-opt-${highlightedIndex}` : undefined
          }
          className="shinpo-select-options-list"
        >
          {filteredOptions.length === 0 ? (
            <li className="shinpo-select-empty">No options available</li>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlightedIndex
              return (
                <li
                  key={String(opt.value)}
                  id={`${selectId}-opt-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  className={`shinpo-select-option ${isSelected ? 'is-selected' : ''} ${
                    isHighlighted ? 'is-highlighted' : ''
                  } ${opt.disabled ? 'is-disabled' : ''}`}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="shinpo-select-option-content">
                    {opt.icon && <span className="shinpo-select-option-icon">{opt.icon}</span>}
                    <span className="shinpo-select-option-label">{opt.label}</span>
                    {opt.secondaryLabel && (
                      <span className="shinpo-select-option-secondary">{opt.secondaryLabel}</span>
                    )}
                  </div>

                  {isSelected && (
                    <span className="shinpo-select-check-icon" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </li>
              )
            })
          )}
        </ul>
      </ShinpoPopover>

      {/* Helper and Error Messages */}
      {errorMessage && <div className="shinpo-field-error">{errorMessage}</div>}
      {!errorMessage && helperText && <div className="shinpo-field-helper">{helperText}</div>}
    </div>
  )
}
