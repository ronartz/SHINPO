import React from 'react'
import type { SentinelWarningItem } from '../../api/device'
import { Icon } from '../common/Icon'

export interface DistractionWarningModalProps {
  pendingWarning: SentinelWarningItem | null
  warningSecondsLeft: number
  selectedGraceMinutes: number
  setSelectedGraceMinutes: (mins: number) => void
  warningSubmitting: boolean
  warningError: string | null
  onRespond: (action: 'GRANT_GRACE' | 'TERMINATE_NOW') => void
}

export const DistractionWarningModal: React.FC<DistractionWarningModalProps> = ({
  pendingWarning,
  warningSecondsLeft,
  selectedGraceMinutes,
  setSelectedGraceMinutes,
  warningSubmitting,
  warningError,
  onRespond,
}) => {
  if (!pendingWarning) return null

  return (
    <div className="quick-modal-overlay sentinel-warning-overlay">
      <div
        className="quick-modal-card sentinel-warning-card"
        style={{ maxWidth: 'min(480px, calc(100vw - 32px))', borderTop: '3px solid var(--accent-coral, #FF4D5E)' }}
      >
        <div className="quick-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={24} />
            <div>
              <h3 className="quick-modal-title" style={{ color: 'var(--accent-coral, #FF4D5E)', margin: 0 }}>
                Distraction Alert
              </h3>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                Distraction detected during focus session
              </div>
            </div>
          </div>
        </div>

        <div className="sentinel-warning-body">
          <div className="sentinel-warning-meta">
            <div className="warning-proc-tag">
              <Icon name="shield" size={14} />
              <span className="warning-proc-name">{pendingWarning.processName}</span>
            </div>
            {pendingWarning.commandLine && (
              <div className="warning-cmdline" title={pendingWarning.commandLine}>
                {pendingWarning.commandLine}
              </div>
            )}
          </div>

          <div className="sentinel-warning-countdown-box">
            <div className="warning-countdown-label">Time Remaining</div>
            <div className="warning-countdown-digits">
              {String(warningSecondsLeft).padStart(2, '0')}s
            </div>
            <div className="warning-countdown-sub">
              Choose a grace period or close the application immediately.
            </div>
          </div>

          <div className="quick-form-group">
            <label className="quick-form-label">
              Request Grace Period
            </label>
            <div className="grace-selector-row">
              {[2, 5, 10, 15, 20].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  className={`grace-chip ${selectedGraceMinutes === mins ? 'selected' : ''}`}
                  onClick={() => setSelectedGraceMinutes(mins)}
                  disabled={warningSubmitting}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {warningError && (
            <div className="override-error-banner" style={{ marginTop: 8 }}>
              {warningError}
            </div>
          )}

          <div className="quick-modal-actions" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="quick-btn-cancel"
              style={{ borderColor: 'var(--accent-coral, #FF4D5E)', color: 'var(--accent-coral, #FF4D5E)' }}
              disabled={warningSubmitting}
              onClick={() => onRespond('TERMINATE_NOW')}
            >
              {warningSubmitting ? 'Closing...' : 'Close App'}
            </button>
            <button
              type="button"
              className="quick-btn-submit"
              disabled={warningSubmitting || warningSecondsLeft <= 0}
              onClick={() => onRespond('GRANT_GRACE')}
            >
              {warningSubmitting ? 'Granting...' : `Allow ${selectedGraceMinutes}m Grace`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
