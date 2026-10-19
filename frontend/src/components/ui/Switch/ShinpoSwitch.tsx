import React, { useId } from 'react'

export interface ShinpoSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  id?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export const ShinpoSwitch: React.FC<ShinpoSwitchProps> = ({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = '',
  style,
}) => {
  const generatedId = useId()
  const switchId = id || `shinpo-switch-${generatedId}`

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      onChange(!checked)
    }
  }

  return (
    <label
      htmlFor={switchId}
      className={`shinpo-switch-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <input
        id={switchId}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        onKeyDown={handleKeyDown}
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
          width: 38,
          height: 22,
          borderRadius: 12,
          backgroundColor: checked
            ? 'var(--primary-violet, #9757FA)'
            : 'var(--surface-subtle, #24252D)',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
          position: 'relative',
          transition: 'background-color 0.16s ease',
          boxShadow: checked ? '0 2px 8px rgba(151, 87, 250, 0.35)' : 'none',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            transition: 'left 0.16s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        />
      </div>

      {label && (
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text, #F3F4F6)' }}>
          {label}
        </span>
      )}
    </label>
  )
}

