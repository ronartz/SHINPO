import React, { useState, useRef, useEffect } from 'react'
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
  onHoverChange?: (hovered: boolean) => void
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
  onHoverChange,
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
  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (!sidebarExpanded) {
      setIsHovered(true)
      onHoverChange?.(true)
    }
  }

  const handleMouseLeave = () => {
    if (!sidebarExpanded) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false)
        onHoverChange?.(false)
      }, 220)
    }
  }

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isHovered || sidebarExpanded) return
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHovered(false)
        onHoverChange?.(false)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isHovered, sidebarExpanded, onHoverChange])

  const isVisuallyExpanded = sidebarExpanded || isHovered

  // Truthful Protection Status Computation
  const isWarning = !!pendingWarning
  const isGrace = !isWarning && !!activeGraceWarning
  const isSessionActive = !isWarning && !isGrace && !!activeSession
  const isDaemonConnected = Boolean(sentinelStatus?.daemonConnected)
  const sentinelState = sentinelStatus?.status
  const enforcementMode = sentinelStatus?.enforcementMode

  let statusTitle: string
  let statusSub: string
  let dotClass: string
  let statusTooltip: string
  let shieldStateClass: 'shield-offline' | 'shield-ready' | 'shield-active' | 'shield-warning'

  if (isWarning) {
    statusTitle = 'Warning'
    statusSub = `${pendingWarning?.processName || 'Distraction'} detected`
    dotClass = 'warning-engaged'
    shieldStateClass = 'shield-warning'
    statusTooltip = `Focus Protection: Distraction detected (${pendingWarning?.processName})`
  } else if (isGrace) {
    statusTitle = 'Grace Period'
    statusSub = `${formatTimerDigits(graceSecondsLeft)} left`
    dotClass = 'grace-engaged'
    shieldStateClass = 'shield-warning'
    statusTooltip = 'Focus Protection: Grace period active'
  } else if (isSessionActive) {
    if (isDaemonConnected || sentinelState === 'ACTIVE' || sentinelState === 'ACTIVE_DEFENSE') {
      statusTitle = 'Protection Active'
      statusSub = 'Distractions blocked'
      dotClass = 'focus-engaged'
      shieldStateClass = 'shield-active'
      statusTooltip = 'Focus Protection: Active (Shield enforcer engaged)'
    } else {
      statusTitle = 'Protection Degraded'
      statusSub = 'Daemon disconnected'
      dotClass = 'status-dot-degraded'
      shieldStateClass = 'shield-offline'
      statusTooltip = 'Focus Protection: Degraded (Session active, daemon offline)'
    }
  } else {
    if (isDaemonConnected || sentinelState === 'READY' || sentinelState === 'STANDBY') {
      statusTitle = sentinelState === 'STANDBY' ? 'Protection Standby' : 'Protection Ready'
      statusSub = 'Shield Standby'
      dotClass = 'status-dot-ready'
      shieldStateClass = 'shield-ready'
      statusTooltip = 'Focus Protection: Ready (Shield enforcer standby)'
    } else {
      statusTitle = 'Protection Unavailable'
      statusSub = 'Daemon offline'
      dotClass = 'status-dot-unavailable'
      shieldStateClass = 'shield-offline'
      statusTooltip = 'Focus Protection: Unavailable (Shield daemon offline)'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !sidebarExpanded && isHovered) {
      e.stopPropagation()
      setIsHovered(false)
      onHoverChange?.(false)
    }
  }

  return (
    <aside
      className={`icon-sidebar ${isVisuallyExpanded ? 'expanded' : ''} ${isHovered && !sidebarExpanded ? 'hover-expanded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      aria-label="Application Sidebar"
    >
      <div className="sidebar-header">
        <div
          className="brand-badge"
          onClick={onToggleExpanded}
          title={sidebarExpanded ? 'Unpin Sidebar' : 'Pin Sidebar'}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleExpanded()
            }
          }}
        >
          <ShinpoLogo
            size={isVisuallyExpanded ? 30 : 34}
            variant={isVisuallyExpanded ? 'full' : 'icon'}
          />
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleExpanded}
          title={sidebarExpanded ? 'Unpin Sidebar (Pinned)' : 'Pin Sidebar (Collapsed)'}
          data-tooltip={sidebarExpanded ? 'Unpin' : 'Pin'}
          aria-label={sidebarExpanded ? 'Unpin sidebar' : 'Pin sidebar'}
          aria-expanded={sidebarExpanded}
        >
          <Icon name={sidebarExpanded ? 'chevron-left' : 'chevron-right'} size={15} />
        </button>
      </div>

      {isVisuallyExpanded && (
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
        {isVisuallyExpanded && (
          <div className="sidebar-section-header">
            <span>Menu</span>
          </div>
        )}
        {NAVIGATION_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            title={item.label}
            data-tooltip={item.label}
            data-tutorial={item.tut}
          >
            <span className="sidebar-btn-icon">
              <Icon name={item.icon} size={19} />
            </span>
            {isVisuallyExpanded && <span className="sidebar-btn-label">{item.label}</span>}
            {isVisuallyExpanded && item.hasBadge && scheduledCount > 0 && (
              <span className="sidebar-nav-badge">
                +{scheduledCount}
              </span>
            )}
            {isVisuallyExpanded && activeTab === item.id && (
              <span className="sidebar-active-arrow">↗</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {isVisuallyExpanded ? (
          <div className={`sidebar-protection-panel ${shieldStateClass}`} role="region" aria-label="Focus Protection Status">
            <div className="protection-panel-top">
              <div className={`protection-shield-box ${shieldStateClass}`}>
                <Icon name={shieldStateClass === 'shield-ready' || shieldStateClass === 'shield-active' ? 'shield-check' : 'shield'} size={20} />
                <span className={`protection-status-dot ${dotClass}`} />
              </div>
              <div className="protection-panel-titles">
                <span className="protection-title">{statusTitle}</span>
                <span className="protection-sub-text">{statusSub}</span>
                {enforcementMode && isDaemonConnected && (
                  <span className="protection-mode-badge">{enforcementMode}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              className="protection-view-btn"
              onClick={() => onSelectTab('Task Manager')}
              title="Open Protection Details & Process Rules"
              aria-label="View Focus Protection details"
            >
              <span>View Protection</span>
              <span className="btn-arrow">→</span>
            </button>
          </div>
        ) : (
          <div
            className={`sidebar-protection-collapsed ${shieldStateClass}`}
            onClick={() => onSelectTab('Task Manager')}
            title={statusTooltip}
            data-tooltip={statusTooltip}
            role="button"
            tabIndex={0}
            aria-label={statusTooltip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectTab('Task Manager')
              }
            }}
          >
            <div className={`protection-shield-box collapsed ${shieldStateClass}`}>
              <Icon name={shieldStateClass === 'shield-ready' || shieldStateClass === 'shield-active' ? 'shield-check' : 'shield'} size={18} />
              <span className={`protection-status-dot ${dotClass}`} />
            </div>
          </div>
        )}
      </div>
    </aside>
  )
})
