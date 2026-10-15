import React from 'react'
import type { LiveAlertItem } from '../../types/telemetry'
import { Icon } from '../common/Icon'
import { formatSafeTimeString } from '../../api/eventNormalizer'

export interface TelemetryDrawerProps {
  isOpen: boolean
  onClose: () => void
  isWsConnected: boolean
  liveAlerts: LiveAlertItem[]
  onRequestClearHistory: () => void
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  isOpen,
  onClose,
  isWsConnected,
  liveAlerts,
  onRequestClearHistory,
}) => {
  if (!isOpen) return null

  return (
    <div className="telemetry-drawer-backdrop" onClick={onClose}>
      <div className="telemetry-drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="telemetry-drawer-header">
          <div className="telemetry-drawer-title-wrap">
            <span className={`telemetry-live-dot ${isWsConnected ? 'connected' : ''}`} />
            <span className="telemetry-drawer-title">Real-Time Telemetry Feed</span>
          </div>
          <div className="telemetry-drawer-header-actions">
            {liveAlerts.length > 0 && (
              <button
                className="telemetry-clear-btn"
                onClick={onRequestClearHistory}
              >
                Clear History
              </button>
            )}
            <button
              className="telemetry-close-btn"
              onClick={onClose}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
        <div className="telemetry-drawer-list">
          {liveAlerts.length === 0 ? (
            <div className="telemetry-empty-state">
              <Icon name="shield" size={24} />
              <span>No telemetry events recorded yet. Distraction intercepts and focus session state changes stream here live via STOMP WebSocket.</span>
            </div>
          ) : (
            liveAlerts.map((item) => (
              <div key={item.id} className={`telemetry-item item-${item.type}`}>
                <div className="telemetry-item-icon">
                  <Icon
                    name={item.type === 'quarantine' ? 'shield' : item.type === 'focus' ? 'zap' : 'sparkle'}
                    size={16}
                  />
                </div>
                <div className="telemetry-item-body">
                  <div className="telemetry-item-top">
                    <span className="telemetry-item-title">{item.title}</span>
                    {item.badge && <span className="telemetry-item-badge">{item.badge}</span>}
                  </div>
                  {item.description && <div className="telemetry-item-desc">{item.description}</div>}
                  <span className="telemetry-item-time">
                    {formatSafeTimeString(item.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
