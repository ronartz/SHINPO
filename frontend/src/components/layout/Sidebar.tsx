import React from 'react'
import type { AppView } from '../../types/navigation'
import { NAVIGATION_ITEMS } from '../../types/navigation'
import { ShinpoLogo } from '../ShinpoLogo'
import { Icon } from '../common/Icon'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import { formatTimerDigits } from '../../utils/focusTimer'
import type { FocusSession } from '../../api/focusSessions'
import type { SentinelWarningItem } from '../../api/device'

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
            size={sidebarExpanded ? 28 : 34}
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
            <Icon name={item.icon} size={18} />
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
        <div
          className="sidebar-status-quiet"
          title={
            pendingWarning
              ? 'Focus Protection: Distraction detected'
              : activeGraceWarning
              ? 'Focus Protection: Grace period active'
              : activeSession
              ? 'Focus Protection: Distractions blocked'
              : 'Focus Protection: Standby'
          }
        >
          <span
            className={`status-dot-active ${
              pendingWarning
                ? 'warning-engaged'
                : activeGraceWarning
                ? 'grace-engaged'
                : activeSession
                ? 'focus-engaged'
                : ''
            }`}
          />
          {sidebarExpanded && (
            <div className="status-quiet-text">
              <span className="status-quiet-title">
                {pendingWarning
                  ? 'Warning'
                  : activeGraceWarning
                  ? 'Grace Period'
                  : activeSession
                  ? 'Protection Active'
                  : 'Protection Standby'}
              </span>
              <span className="status-quiet-sub">
                {pendingWarning
                  ? `${pendingWarning.processName} detected`
                  : activeGraceWarning
                  ? `${formatTimerDigits(graceSecondsLeft)} left`
                  : activeSession
                  ? 'Distractions blocked'
                  : 'Ready'}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
})

