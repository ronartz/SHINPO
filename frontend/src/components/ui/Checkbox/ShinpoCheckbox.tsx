import React, { useId } from 'react'

export interface ShinpoCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  id?: string
  name?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export const ShinpoCheckbox: React.FC<ShinpoCheckboxProps> = ({
  checked,
  onChange,
  label,
  id,
  name,
  disabled = false,
  className = '',
  style,
}) => {
  const generatedId = useId()
  const checkboxId = id || `shinpo-checkbox-${generatedId}`

  return (
    <label
      htmlFor={checkboxId}
      className={`shinpo-checkbox-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        id={checkboxId}
        name={name}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          margin: 0,
          pointerEvents: 'none',
        }}
      />

      <div
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: checked ? 'none' : '1px solid var(--border-strong, rgba(255, 255, 255, 0.2))',
          backgroundColor: checked
            ? 'var(--primary-violet, #3156D8)'
            : 'var(--surface-card, #1D1E24)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          transition: 'all 0.14s ease',
          boxShadow: checked ? '0 2px 8px rgba(49, 86, 216, 0.35)' : 'none',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>

      {label && (
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #F3F4F6)' }}>
          {label}
        </span>
      )}
    </label>
  )
}

