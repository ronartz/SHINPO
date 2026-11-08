import React from 'react'
import { Icon } from '../../common/Icon'

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
        return 'var(--primary-green, var(--brand-primary))'
      case 'warning':
        return 'var(--accent-orange, var(--brand-primary))'
      case 'error':
        return 'var(--brand-red, var(--brand-primary))'
      case 'info':
      default:
        return 'var(--primary-violet, var(--brand-primary))'
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
        backgroundColor: 'var(--surface-elevated, #050505)',
        border: '1px solid var(--border-strong, rgba(255,255,255, 0.14))',
        borderLeft: `2px solid ${getBorderColor()}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0,0,0, 0.4)',
        minWidth: 280,
        maxWidth: 400,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text, #e7e7e7)' }}>
          {title}
        </span>
        {message && (
          <span style={{ fontSize: 12, color: 'var(--text-2, #767676)', lineHeight: 1.4 }}>
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
            color: 'var(--text-3, #4e4e4e)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}

