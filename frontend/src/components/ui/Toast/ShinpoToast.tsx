import React from 'react'

export interface ShinpoToastProps {
  type?: 'success' | 'info' | 'warning' | 'error'
  title: string
  message?: string
  onClose?: () => void
}

export const ShinpoToast: React.FC<ShinpoToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'var(--primary-green, #10B981)'
      case 'warning':
        return 'var(--accent-orange, #FB923C)'
      case 'error':
        return 'var(--brand-red, #F87171)'
      case 'info':
      default:
        return 'var(--primary-violet, #3156D8)'
    }
  }

  return (
    <div
      role="status"
      className="shinpo-toast-item"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: 'var(--surface-elevated, #24252D)',
        border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
        borderLeft: `4px solid ${getBorderColor()}`,
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        minWidth: 280,
        maxWidth: 400,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text, #F3F4F6)' }}>
          {title}
        </span>
        {message && (
          <span style={{ fontSize: 12, color: 'var(--text-2, #B0B5C2)', lineHeight: 1.4 }}>
            {message}
          </span>
        )}
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-3, #9096A4)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

