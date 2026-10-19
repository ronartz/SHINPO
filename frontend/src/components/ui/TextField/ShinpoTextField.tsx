import React, { useId } from 'react'

export interface ShinpoTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  errorMessage?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const ShinpoTextField: React.FC<ShinpoTextFieldProps> = ({
  id,
  label,
  helperText,
  errorMessage,
  leftIcon,
  rightIcon,
  required,
  disabled,
  className = '',
  style,
  ...props
}) => {
  const generatedId = useId()
  const inputId = id || `shinpo-input-${generatedId}`

  return (
    <div className={`shinpo-field-group ${className}`} style={style}>
      {label && (
        <label htmlFor={inputId} className="shinpo-field-label">
          <span>
            {label}
            {required && <span className="shinpo-field-required">*</span>}
          </span>
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {leftIcon && (
          <span
            style={{
              position: 'absolute',
              left: 12,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-3, #9096A4)',
              pointerEvents: 'none',
            }}
          >
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(errorMessage)}
          className="shinpo-input"
          style={{
            paddingLeft: leftIcon ? 36 : 14,
            paddingRight: rightIcon ? 36 : 14,
            borderColor: errorMessage ? 'var(--brand-red, #F87171)' : undefined,
          }}
          {...props}
        />

        {rightIcon && (
          <span
            style={{
              position: 'absolute',
              right: 12,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-3, #9096A4)',
              pointerEvents: 'none',
            }}
          >
            {rightIcon}
          </span>
        )}
      </div>

      {errorMessage && <div className="shinpo-field-error">{errorMessage}</div>}
      {!errorMessage && helperText && <div className="shinpo-field-helper">{helperText}</div>}
    </div>
  )
}

