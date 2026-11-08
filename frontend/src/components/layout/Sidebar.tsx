import React, { useRef, useLayoutEffect, useEffect, useState } from 'react'
import type { AppView } from '../../types/navigation'
import { NAVIGATION_ITEMS } from '../../types/navigation'
import { ShinpoLogo } from '../ShinpoLogo'
import { Icon } from '../common/Icon'
import type { ShinpoMessage } from '../../utils/shinpoMessages'
import { formatTimerDigits } from '../../utils/focusTimer'
import type { FocusSession } from '../../api/focusSessions'
import type { ProgressResponse } from '../../api/progress'
import type { SentinelWarningItem, SentinelStatus } from '../../api/device'
import { guardianCanRequestClose, guardianInterventionDescription, guardianModeLabel } from '../../utils/guardianCapability'
import { formatEnforcementMode } from '../../utils/focusProtectionStatus'

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
  userProgress: ProgressResponse | null
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
  const navRef = useRef<HTMLElement>(null)
  const activeIndicatorRef = useRef<HTMLSpanElement>(null)
  const hoverDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPointerHovered, setIsPointerHovered] = useState(false)
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false)
  const isVisuallyExpanded = sidebarExpanded || isPointerHovered || isKeyboardFocused
  const isHoverExpanded = isVisuallyExpanded && !sidebarExpanded
  const wasExpandedRef = useRef(sidebarExpanded)
  const rewardsItem = NAVIGATION_ITEMS.find((item) => item.id === 'Rewards')

  useEffect(() => () => {
    if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
  }, [])

  useLayoutEffect(() => {
    const nav = navRef.current
    const indicator = activeIndicatorRef.current
    const active = nav?.querySelector<HTMLElement>('.sidebar-btn.active')
    if (!nav || !indicator) return
    if (!active) {
      indicator.style.opacity = '0'
      wasExpandedRef.current = isVisuallyExpanded
      return
    }
    indicator.style.opacity = '1'
    const expansionChanged = wasExpandedRef.current !== isVisuallyExpanded
    if (expansionChanged) indicator.style.transition = 'none'
    indicator.style.transform = `translateY(${active.offsetTop}px)`
    indicator.style.height = `${active.offsetHeight}px`
    wasExpandedRef.current = isVisuallyExpanded
    if (expansionChanged) {
      const frame = window.requestAnimationFrame(() => indicator.style.removeProperty('transition'))
      return () => window.cancelAnimationFrame(frame)
    }
  }, [activeTab, isVisuallyExpanded])

  // Truthful Protection Status Computation
  const isWarning = !!pendingWarning
  const isGrace = !isWarning && !!activeGraceWarning
  const isSessionActive = !isWarning && !isGrace && activeSession?.status === 'ACTIVE'
  const isSessionPaused = !isWarning && !isGrace && activeSession?.status === 'PAUSED'
  const isDaemonConnected = Boolean(sentinelStatus?.daemonConnected)
  const sentinelState = sentinelStatus?.status
  const enforcementMode = sentinelStatus?.enforcementMode
  const localCloseAvailable = guardianCanRequestClose(sentinelStatus?.interventionCapability, sentinelStatus?.warningOnly)

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
    if (isDaemonConnected) {
      const nativeStatusAvailable = Boolean(sentinelStatus?.interventionCapability)
      const isMonitoringOnly = enforcementMode?.toUpperCase() === 'AUDIT_ONLY' || (nativeStatusAvailable && !localCloseAvailable)
      statusTitle = sentinelStatus?.warningOnly || (nativeStatusAvailable && !localCloseAvailable) ? 'Guardian monitoring' : isMonitoringOnly ? 'Protection monitoring' : 'Focus protection active'
      statusSub = nativeStatusAvailable
        ? localCloseAvailable ? 'Consented graceful close may be requested' : 'Monitoring only · no close request is armed'
        : sentinelStatus?.warningOnly ? `${sentinelStatus.guardianMode ?? 'Standard'} · warning-only` : isMonitoringOnly ? 'Apps are not blocked' : 'Distracting apps are blocked'
      dotClass = 'focus-engaged'
      shieldStateClass = nativeStatusAvailable && !localCloseAvailable ? 'shield-ready' : 'shield-active'
      statusTooltip = nativeStatusAvailable
        ? `${guardianInterventionDescription(sentinelStatus?.interventionCapability)} Browser site restrictions are reported separately.`
        : sentinelStatus?.warningOnly
        ? `Automatic ${sentinelStatus.guardianMode ?? 'Standard'} Guardian records recognized app names in warning-only mode. Site rules depend on Browser Companion.`
        : isMonitoringOnly
        ? 'Focus protection is monitoring only; no applications are blocked.'
        : 'Focus protection is connected and blocking distracting apps. Browser protection is reported separately.'
    } else {
      statusTitle = 'Protection Degraded'
      statusSub = 'Protection service disconnected'
      dotClass = 'status-dot-degraded'
      shieldStateClass = 'shield-offline'
      statusTooltip = 'Focus protection is limited because its background service is offline.'
    }
  } else if (isSessionPaused) {
    statusTitle = 'Focus paused'
    statusSub = 'Guardian app observation is paused'
    dotClass = 'status-dot-ready'
    shieldStateClass = 'shield-ready'
    statusTooltip = 'The Focus session is paused. Automatic app observations resume when Focus resumes.'
  } else {
    if (isDaemonConnected) {
      const nativeStatusAvailable = Boolean(sentinelStatus?.interventionCapability)
      const isMonitoringOnly = enforcementMode?.toUpperCase() === 'AUDIT_ONLY' || (nativeStatusAvailable && !localCloseAvailable)
      statusTitle = sentinelStatus?.warningOnly || isMonitoringOnly
        ? 'Monitoring only'
        : sentinelState === 'STANDBY' ? 'Protection on standby' : 'Protection ready'
      statusSub = nativeStatusAvailable
        ? 'Warnings and intervention depend on Focus phase, consent, and platform capability'
        : sentinelStatus?.warningOnly ? 'Warnings begin with a Focus session' : isMonitoringOnly ? 'Apps are not blocked' : 'No active focus session'
      dotClass = 'status-dot-ready'
      shieldStateClass = 'shield-ready'
      statusTooltip = nativeStatusAvailable
        ? `${guardianInterventionDescription(sentinelStatus?.interventionCapability)} Browser policy is managed separately by Browser Companion.`
        : sentinelStatus?.warningOnly
        ? 'App observations run during Focus only; browser policy is managed by Browser Companion.'
        : isMonitoringOnly
        ? 'Focus protection is monitoring only; no applications are blocked.'
        : 'Focus protection is connected and ready. Browser protection is reported separately.'
    } else {
      statusTitle = 'Protection Unavailable'
      statusSub = 'Protection service offline'
      dotClass = 'status-dot-unavailable'
      shieldStateClass = 'shield-offline'
      statusTooltip = 'Focus protection is unavailable because its background service is offline.'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isVisuallyExpanded) {
      e.stopPropagation()
      if (sidebarExpanded) onToggleExpanded()
      setIsPointerHovered(false)
      setIsKeyboardFocused(false)
    }
  }

  const handleFocusCapture = (e: React.FocusEvent<HTMLElement>) => {
    if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) setIsKeyboardFocused(true)
  }

  const handleBlurCapture = (e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsKeyboardFocused(false)
  }

  return (
    <aside
      className={`icon-sidebar ${isVisuallyExpanded ? 'expanded' : ''} ${isHoverExpanded ? 'hover-expanded' : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return
        hoverDelayRef.current = setTimeout(() => {
          setIsPointerHovered(true)
          hoverDelayRef.current = null
        }, 80)
      }}
      onPointerLeave={() => {
        if (hoverDelayRef.current) clearTimeout(hoverDelayRef.current)
        hoverDelayRef.current = null
        setIsPointerHovered(false)
      }}
      onPointerDownCapture={() => setIsKeyboardFocused(false)}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      onKeyDown={handleKeyDown}
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <div className="brand-badge">
          <span className="sidebar-brand-mark"><ShinpoLogo size={24} variant="icon" /></span>
          <span className="sidebar-brand-name">SHINPO</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggleExpanded}
          title={sidebarExpanded ? 'Unpin sidebar' : isVisuallyExpanded ? 'Pin sidebar open' : 'Expand sidebar'}
          aria-label={sidebarExpanded ? 'Unpin sidebar' : isVisuallyExpanded ? 'Pin sidebar open' : 'Expand sidebar'}
          aria-expanded={sidebarExpanded}
        >
          <Icon name={isVisuallyExpanded ? 'chevron-left' : 'chevron-right'} size={16} />
        </button>
      </div>

      <div className="sidebar-upper-quote" role="region" aria-label="Perspective Quote" aria-hidden={!isVisuallyExpanded}>
          <div className="sidebar-upper-quote-header">
            <span className="sidebar-upper-quote-eyebrow">PERSPECTIVE</span>
            <button
              type="button"
              className="sidebar-quote-refresh-btn"
              onClick={onRefreshShinpoMessage}
              title="Next message"
              aria-label="Cycle motivational quote"
            >
              <Icon name="refresh" size={13} />
            </button>
          </div>
          <p className="sidebar-upper-quote-text">
            “{shinpoMessage.text}”
          </p>
      </div>

      <nav className="sidebar-nav-stack has-active-marker" ref={navRef}>
        <span className="sidebar-active-indicator" ref={activeIndicatorRef} aria-hidden="true" />
        <div className="sidebar-section-header"><span>Navigation</span></div>
        {NAVIGATION_ITEMS.filter((item) => item.id !== 'Rewards').map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar-btn ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onSelectTab(item.id)}
            title={sidebarExpanded || isVisuallyExpanded ? undefined : (item.hasBadge && scheduledCount > 0 ? `${item.label} · ${scheduledCount} scheduled sessions` : item.label)}
            aria-label={item.hasBadge && scheduledCount > 0 ? `${item.label}, ${scheduledCount} scheduled sessions` : item.label}
            aria-current={activeTab === item.id ? 'page' : undefined}
            data-tab={item.id}
            data-tutorial={item.tut}
          >
            <span className="sidebar-btn-icon">
              <Icon name={item.icon} size={19} />
            </span>
            <span className="sidebar-btn-label">{item.label}</span>
            {item.hasBadge && scheduledCount > 0 && (
              <span className="sidebar-nav-badge" aria-label={`${scheduledCount} scheduled sessions`}>
                {scheduledCount}
              </span>
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
                {isDaemonConnected && (sentinelStatus?.guardianMode || enforcementMode) && (
                  <span className="protection-mode-badge">
                    {sentinelStatus?.guardianMode
                      ? guardianModeLabel(sentinelStatus.guardianMode)
                      : formatEnforcementMode(enforcementMode)}
                  </span>
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

        <button
          type="button"
          className={`sidebar-rewards-card ${activeTab === 'Rewards' ? 'active' : ''}`}
          onClick={() => onSelectTab('Rewards')}
          data-tab="Rewards"
          data-tutorial={rewardsItem?.tut}
          aria-label="Rewards and milestones"
          aria-current={activeTab === 'Rewards' ? 'page' : undefined}
          title={!isVisuallyExpanded ? 'Rewards and milestones' : undefined}
        >
          <span className="sidebar-rewards-emblem"><Icon name="rewards" size={19} /></span>
          <span className="sidebar-rewards-details">
            <strong>Rewards &amp; milestones</strong>
            <small>Achievements from completed work</small>
          </span>
        </button>

      </div>
    </aside>
  )
})
