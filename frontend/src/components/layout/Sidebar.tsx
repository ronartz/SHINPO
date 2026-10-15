import React from 'react'
import type { AppView } from '../../types/navigation'
import { NAVIGATION_ITEMS } from '../../types/navigation'
import { ShinpoLogo } from '../ShinpoLogo'
import { Icon } from '../common/Icon'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import { formatTimerDigits } from '../../utils/focusTimer'
import type { FocusSession } from '../../api/focusSessions'
import type { SentinelWarningItem, SentinelStatus } from '../../api/device'

export interface SidebarProps {
  sidebarExpanded: boolean
  onToggleExpanded: () => void
  activeTab: AppView
  onSelectTab: (tab: AppView) => void
  scheduledCount: number
  shinpoMessage: ShinpoMessage
  onRefreshShinpoMessage: () => void
  pendingWarning?: SentinelWarningItem | null
  activeGraceWarning?: SentinelWarningItem | null
  activeSession?: FocusSession | null
  graceSecondsLeft?: number
  sentinelStatus?: SentinelStatus | null
}

import { trackRender } from '../../utils/renderTracker'

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  sidebarExpanded,
  onToggleExpanded,
  activeTab,
  onSelectTab,
  scheduledCount,
  shinpoMessage,
  onRefreshShinpoMessage,
  pendingWarning,
  activeGraceWarning,
  activeSession,
  graceSecondsLeft = 0,
  sentinelStatus,
}) => {
  trackRender('Sidebar')
  return (
    <aside className={`icon-sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
      <div className="sidebar-header">
        <div
          className="brand-badge"
          onClick={onToggleExpanded}
          title={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <ShinpoLogo
            size={sidebarExpanded ? 30 : 34}
            variant={sidebarExpanded ? 'full' : 'icon'}
          />
        </div>
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleExpanded}
          title={sidebarExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
          data-tooltip={sidebarExpanded ? 'Collapse' : 'Expand'}
        >
          <Icon name={sidebarExpanded ? 'chevron-left' : 'chevron-right'} size={15} />
        </button>
      </div>

      {sidebarExpanded && (
        <div className="sidebar-upper-quote" role="region" aria-label="Motivational Quote">
          <div className="sidebar-upper-quote-header">
            <span className="sidebar-upper-quote-tag">SHINPO</span>
            <button
              type="button"
              className="sidebar-quote-refresh-btn"
              onClick={onRefreshShinpoMessage}
              title="Next message"
              aria-label="Cycle motivational quote"
            >
              <Icon name="refresh" size={12} />
            </button>
          </div>
          <p className="sidebar-upper-quote-text">
            "{shinpoMessage.text}"
          </p>
        </div>
      )}

      <nav className="sidebar-nav-stack">
        {sidebarExpanded && (
          <div className="sidebar-section-header">
            <span>Menu</span>
          </div>
        )}
        {NAVIGATION_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            title={item.label}
            data-tooltip={item.label}
            data-tutorial={item.tut}
          >
            <Icon name={item.icon} size={19} />
            {sidebarExpanded && <span>{item.label}</span>}
            {sidebarExpanded && item.hasBadge && scheduledCount > 0 && (
              <span className="sidebar-nav-badge">
                +{scheduledCount}
              </span>
            )}
            {sidebarExpanded && activeTab === item.id && (
              <span className="sidebar-active-arrow">↗</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {(() => {
          const isWarning = !!pendingWarning
          const isGrace = !isWarning && !!activeGraceWarning
          const isSessionActive = !isWarning && !isGrace && !!activeSession
          const isDaemonConnected = Boolean(sentinelStatus?.daemonConnected)
          const sentinelState = sentinelStatus?.status

          let statusTitle: string
          let statusSub: string
          let dotClass: string
          let statusTooltip: string

          if (isWarning) {
            statusTitle = 'Warning'
            statusSub = `${pendingWarning?.processName} detected`
            dotClass = 'warning-engaged'
            statusTooltip = `Focus Protection: Distraction detected (${pendingWarning?.processName})`
          } else if (isGrace) {
            statusTitle = 'Grace Period'
            statusSub = `${formatTimerDigits(graceSecondsLeft)} left`
            dotClass = 'grace-engaged'
            statusTooltip = 'Focus Protection: Grace period active'
          } else if (isSessionActive) {
            if (isDaemonConnected || sentinelState === 'ACTIVE') {
              statusTitle = 'Protection Active'
              statusSub = 'Distractions blocked'
              dotClass = 'focus-engaged'
              statusTooltip = 'Focus Protection: Active (Shield enforcer engaged)'
            } else {
              statusTitle = 'Protection Degraded'
              statusSub = 'Daemon disconnected'
              dotClass = 'status-dot-degraded'
              statusTooltip = 'Focus Protection: Degraded (Session active, daemon offline)'
            }
          } else {
            if (isDaemonConnected || sentinelState === 'READY' || sentinelState === 'STANDBY') {
              statusTitle = sentinelState === 'STANDBY' ? 'Protection Standby' : 'Protection Ready'
              statusSub = 'Ready'
              dotClass = 'status-dot-ready'
              statusTooltip = 'Focus Protection: Ready (Shield enforcer standby)'
            } else {
              statusTitle = 'Protection Unavailable'
              statusSub = 'Daemon offline'
              dotClass = 'status-dot-unavailable'
              statusTooltip = 'Focus Protection: Unavailable (Shield daemon offline)'
            }
          }

          return (
            <div className="sidebar-status-quiet" title={statusTooltip}>
              <span className={`status-dot-active ${dotClass}`} />
              {sidebarExpanded && (
                <div className="status-quiet-text">
                  <span className="status-quiet-title">{statusTitle}</span>
                  <span className="status-quiet-sub">{statusSub}</span>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </aside>
  )
})

