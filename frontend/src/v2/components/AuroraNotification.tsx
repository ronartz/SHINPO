import React from 'react'
import { createPortal } from 'react-dom'
import type { LiveAlertItem } from '../../types/telemetry'
import { Icon } from '../../components/common/Icon'
import { formatSafeTimeString } from '../../api/eventNormalizer'

export interface AuroraNotificationProps {
  toastAlerts: LiveAlertItem[]
  onDismiss: (id: string) => void
}

export const AuroraNotification: React.FC<AuroraNotificationProps> = ({
  toastAlerts,
  onDismiss,
}) => {
  if (typeof document === 'undefined' || toastAlerts.length === 0) return null

  // Restrict to max 2 items
  const visible = toastAlerts.slice(0, 2)

  return createPortal(
    <div className="shinpo-toast-container" aria-live="polite">
      {visible.map((alert) => {
        const cleanBadge =
          alert.badge && !alert.badge.toLowerCase().includes('undefined')
            ? alert.badge
            : null

        return (
          <div
            key={alert.id}
            className={`shinpo-toast-item toast-${alert.type} aurora-glass`}
            role="alert"
          >
            <div className="shinpo-toast-icon">
              <Icon
                name={
                  alert.type === 'quarantine'
                    ? 'shield'
                    : alert.type === 'focus'
                      ? 'zap'
                      : 'sparkle'
                }
                size={18}
              />
            </div>
            <div className="shinpo-toast-content">
              <div className="shinpo-toast-header">
                <span className="shinpo-toast-title">{alert.title}</span>
                {cleanBadge && (
                  <span className="shinpo-toast-badge">{cleanBadge}</span>
                )}
              </div>
              {alert.description && (
                <div className="shinpo-toast-desc">{alert.description}</div>
              )}
              <div className="shinpo-toast-time">
                {formatSafeTimeString(alert.timestamp)}
              </div>
            </div>
            <button
              className="shinpo-toast-dismiss"
              onClick={() => onDismiss(alert.id)}
              title="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

