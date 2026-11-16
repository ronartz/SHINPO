import React from 'react'
import { Icon } from '../common/Icon'
import { useUpdater, updaterService } from '../../services/updater/index.ts'

export interface UpdateNotificationProps {
  onOpenModal: () => void
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ onOpenModal }) => {
  const state = useUpdater()

  if (state.isDismissed) {
    return null
  }

  const { status, availableUpdate, packageInfo, channel, currentVersion } = state

  if (status !== 'update-available' && status !== 'unsupported-package' && status !== 'restart-required') {
    return null
  }

  const handleDismiss = () => {
    updaterService.dismissNotification()
  }

  const handleUpdateNow = () => {
    onOpenModal()
    if (status === 'update-available' && (!packageInfo || packageInfo.supportsInAppUpdate)) {
      void updaterService.downloadAndInstall().catch(() => {
        // Error state handled inside updaterService
      })
    }
  }

  const handleRestartNow = async () => {
    try {
      await updaterService.restartApp()
    } catch {
      // Focus session in progress or other guardrail - open modal to prompt
      onOpenModal()
    }
  }

  const targetVersion = availableUpdate?.version || 'new version'
  const isBeta = channel === 'beta'

  return (
    <aside
      className="shinpo-update-notification"
      role="region"
      aria-label="Software Update Notification"
      data-testid="updater-notification-banner"
    >
      <div className="shinpo-update-notification-header">
        <div className="shinpo-update-header-left">
          <div className="shinpo-update-icon-badge" aria-hidden="true">
            <Icon name={status === 'restart-required' ? 'check-circle' : 'refresh'} size={18} />
          </div>
          <div>
            <h4 className="shinpo-update-title">
              {status === 'restart-required'
                ? 'Update Ready to Install'
                : status === 'unsupported-package'
                  ? `New Release: v${targetVersion}`
                  : `Update Available: v${targetVersion}`}
            </h4>
            <div className="shinpo-update-version-label">
              SHINPO v{currentVersion} → v{targetVersion}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            className={`shinpo-update-channel-pill ${isBeta ? 'pill-beta' : 'pill-stable'}`}
            data-testid="updater-channel-pill"
          >
            {isBeta ? 'Beta' : 'Stable'}
          </span>
          <button
            type="button"
            className="shinpo-update-dismiss-btn"
            onClick={handleDismiss}
            title="Dismiss notification"
            aria-label="Dismiss update notification"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      <p className="shinpo-update-desc">
        {status === 'restart-required'
          ? 'The update has been downloaded and staged. Restart SHINPO now to complete the installation.'
          : status === 'unsupported-package'
            ? `Your installation (${packageInfo?.packageType.toUpperCase() || 'system'}) does not support automatic in-app updates. Download the latest installer package from GitHub.`
            : availableUpdate?.body
              ? availableUpdate.body.slice(0, 120) + (availableUpdate.body.length > 120 ? '...' : '')
              : 'A new version of SHINPO is ready with performance improvements, bug fixes, and feature updates.'}
      </p>

      <div className="shinpo-update-actions">
        {status === 'unsupported-package' ? (
          <>
            <button
              type="button"
              className="shinpo-update-btn btn-secondary"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
            <a
              href="https://github.com/ronartz/SHINPO/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="shinpo-update-btn btn-primary"
            >
              <span>Download Package</span>
              <Icon name="arrow-up-right" size={13} />
            </a>
          </>
        ) : status === 'restart-required' ? (
          <>
            <button
              type="button"
              className="shinpo-update-btn btn-secondary"
              onClick={handleDismiss}
            >
              Later
            </button>
            <button
              type="button"
              className="shinpo-update-btn btn-primary"
              onClick={handleRestartNow}
            >
              <span>Restart Now</span>
              <Icon name="refresh" size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="shinpo-update-btn btn-secondary"
              onClick={() => onOpenModal()}
            >
              Release Notes
            </button>
            <button
              type="button"
              className="shinpo-update-btn btn-primary"
              onClick={handleUpdateNow}
            >
              <span>Update Now</span>
              <Icon name="arrow-down" size={13} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
