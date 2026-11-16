import React, { useCallback, useEffect, useState } from 'react'
import { Icon } from '../common/Icon'
import { useUpdater, updaterService } from '../../services/updater/index.ts'

export interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const state = useUpdater()
  const [showFocusWarning, setShowFocusWarning] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)

  const handleClose = useCallback(() => {
    setShowFocusWarning(false)
    setIsRestarting(false)
    onClose()
  }, [onClose])

  // Close on Escape unless currently downloading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && state.status !== 'downloading' && state.status !== 'installing') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, state.status, handleClose])

  if (!isOpen) return null

  const { status, availableUpdate, packageInfo, channel, currentVersion, progress, error } = state
  const targetVersion = availableUpdate?.version || 'latest'
  const isBeta = channel === 'beta'

  const handleStartDownload = async () => {
    try {
      await updaterService.downloadAndInstall()
    } catch (err) {
      console.error('[UpdateModal] Download and install error:', err)
    }
  }

  const handleRestartAttempt = async () => {
    try {
      const active = await updaterService.hasActiveFocusSession()
      if (active) {
        setShowFocusWarning(true)
        return
      }
      setIsRestarting(true)
      await updaterService.restartApp(false)
    } catch {
      setShowFocusWarning(true)
      setIsRestarting(false)
    }
  }

  const handleForceRestart = async () => {
    try {
      setIsRestarting(true)
      await updaterService.restartApp(true)
    } catch (err) {
      console.error('[UpdateModal] Force restart failed:', err)
      setIsRestarting(false)
    }
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <div
      className="shinpo-update-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'downloading' && status !== 'installing') {
          handleClose()
        }
      }}
    >
      <div
        className="shinpo-update-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="updater-modal-title"
        data-testid="updater-modal-dialog"
      >
        {/* Header */}
        <div className="shinpo-update-modal-header">
          <div className="shinpo-update-modal-title-group">
            <h3 id="updater-modal-title" className="shinpo-update-modal-title">
              <Icon name={status === 'restart-required' ? 'check-circle' : 'refresh'} size={20} />
              <span>
                {status === 'restart-required'
                  ? 'Update Ready to Install'
                  : status === 'downloading'
                    ? 'Downloading Update'
                    : status === 'installing'
                      ? 'Installing Update'
                      : 'SHINPO Software Update'}
              </span>
            </h3>
            <div className="shinpo-update-version-flow">
              <span className="curr">v{currentVersion}</span>
              <span className="arrow">→</span>
              <span className="next">v{targetVersion}</span>
              <span className={`shinpo-update-channel-pill ${isBeta ? 'pill-beta' : 'pill-stable'}`}>
                {isBeta ? 'Beta' : 'Stable'}
              </span>
            </div>
          </div>

          {status !== 'downloading' && status !== 'installing' && (
            <button
              type="button"
              className="shinpo-update-dismiss-btn"
              onClick={handleClose}
              title="Close modal"
              aria-label="Close modal"
            >
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        {/* Focus Safety Alert */}
        {showFocusWarning && (
          <div className="shinpo-update-focus-alert" role="alert">
            <div className="shinpo-update-focus-alert-icon">
              <Icon name="shield" size={20} />
            </div>
            <div className="shinpo-update-focus-alert-content">
              <div className="shinpo-update-focus-alert-title">Active Focus Session in Progress</div>
              <p className="shinpo-update-focus-alert-desc">
                An active or paused Focus session is currently running. Restarting now will end or interrupt your focus session. We recommend waiting until your session completes.
              </p>
            </div>
          </div>
        )}

        {/* Release Notes */}
        {availableUpdate?.body && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>
              Release Highlights:
            </div>
            <div className="shinpo-update-notes-container" tabIndex={0}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {availableUpdate.body}
              </pre>
            </div>
          </div>
        )}

        {/* Progress Display */}
        {(status === 'downloading' || status === 'installing') && (
          <div className="shinpo-update-progress-card">
            <div className="shinpo-update-progress-labels">
              <span>{status === 'downloading' ? 'Downloading payload...' : 'Verifying & Installing...'}</span>
              <span>
                {status === 'downloading'
                  ? `${progress?.percentage ?? 0}% (${formatBytes(progress?.downloadedBytes)} / ${formatBytes(progress?.totalBytes)})`
                  : 'Staging files...'}
              </span>
            </div>
            <div className="shinpo-update-progress-bar-track">
              <div
                className={`shinpo-update-progress-bar-fill ${status === 'installing' ? 'indeterminate' : ''}`}
                style={status === 'downloading' ? { width: `${progress?.percentage ?? 0}%` } : undefined}
              />
            </div>
          </div>
        )}

        {/* Restart Required Banner */}
        {status === 'restart-required' && (
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'color-mix(in srgb, var(--status-success) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-success) 40%, transparent)',
              color: 'var(--color-text-primary)',
              fontSize: '13.5px',
              lineHeight: 1.5,
            }}
          >
            <strong>Update verified and staged successfully!</strong> Restart SHINPO to launch the new version. Your encrypted local vault and offline state will remain completely intact.
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'color-mix(in srgb, var(--status-danger) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--status-danger) 40%, transparent)',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
            }}
          >
            <strong>Update Error:</strong> {error || 'An unexpected error occurred while processing the update.'}
          </div>
        )}

        {/* Unsupported Package Notice */}
        {status === 'unsupported-package' && (
          <div
            style={{
              padding: '14px',
              borderRadius: '10px',
              background: 'color-mix(in srgb, var(--color-surface-2) 60%, transparent)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-text-secondary)',
              fontSize: '13px',
              lineHeight: 1.5,
            }}
          >
            Your installation type (<strong>{packageInfo?.packageType.toUpperCase()}</strong>) manages updates externally. Please update via your system package manager or download the latest package from GitHub Releases.
          </div>
        )}

        {/* Footer Actions */}
        <div className="shinpo-update-modal-actions">
          {showFocusWarning ? (
            <>
              <button
                type="button"
                className="shinpo-update-btn btn-secondary"
                onClick={handleClose}
              >
                Wait & Restart Later
              </button>
              <button
                type="button"
                className="shinpo-update-btn btn-warning"
                onClick={handleForceRestart}
                disabled={isRestarting}
              >
                {isRestarting ? 'Restarting...' : 'Restart Anyway'}
              </button>
            </>
          ) : status === 'restart-required' ? (
            <>
              <button
                type="button"
                className="shinpo-update-btn btn-secondary"
                onClick={handleClose}
              >
                Restart Later
              </button>
              <button
                type="button"
                className="shinpo-update-btn btn-primary"
                onClick={handleRestartAttempt}
                disabled={isRestarting}
              >
                <Icon name="refresh" size={14} />
                <span>{isRestarting ? 'Restarting...' : 'Restart Now'}</span>
              </button>
            </>
          ) : status === 'downloading' || status === 'installing' ? (
            <button
              type="button"
              className="shinpo-update-btn btn-secondary"
              onClick={handleClose}
            >
              Run in Background
            </button>
          ) : status === 'unsupported-package' ? (
            <>
              <button
                type="button"
                className="shinpo-update-btn btn-secondary"
                onClick={handleClose}
              >
                Close
              </button>
              <a
                href="https://github.com/ronartz/SHINPO/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="shinpo-update-btn btn-primary"
              >
                <span>Download from GitHub</span>
                <Icon name="arrow-up-right" size={14} />
              </a>
            </>
          ) : (
            <>
              <button
                type="button"
                className="shinpo-update-btn btn-secondary"
                onClick={handleClose}
              >
                Later
              </button>
              <button
                type="button"
                className="shinpo-update-btn btn-primary"
                onClick={handleStartDownload}
              >
                <Icon name="arrow-down" size={14} />
                <span>Download & Install</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
