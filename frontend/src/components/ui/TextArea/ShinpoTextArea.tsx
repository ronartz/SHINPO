import React, { useId } from 'react'

export interface ShinpoTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  errorMessage?: string
}

export const ShinpoTextArea: React.FC<ShinpoTextAreaProps> = ({
  id,
  label,
  helperText,
  errorMessage,
  required,
  disabled,
  className = '',
  style,
  rows = 3,
  ...props
}) => {
  const generatedId = useId()
  const textareaId = id || `shinpo-textarea-${generatedId}`

  return (
    <div className={`shinpo-field-group ${className}`} style={style}>
      {label && (
        <label htmlFor={textareaId} className="shinpo-field-label">
          <span>
            {label}
            {required && <span className="shinpo-field-required">*</span>}
          </span>
        </label>
      )}

      <textarea
        id={textareaId}
        disabled={disabled}
        required={required}
        rows={rows}
        aria-invalid={Boolean(errorMessage)}
        className="shinpo-textarea"
        style={{
          borderColor: errorMessage ? 'var(--brand-red, #F87171)' : undefined,
        }}
        {...props}
      />

      {errorMessage && <div className="shinpo-field-error">{errorMessage}</div>}
      {!errorMessage && helperText && <div className="shinpo-field-helper">{helperText}</div>}
    </div>
  )
}

