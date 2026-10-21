import React, { useState, useEffect } from 'react'
import type {
  ProcessSnapshot,
  SentinelStatus,
  PolicyRule,
  SentinelTamperEventItem,
  ProcessInfo,
} from '../api/device'
import {
  addSentinelRule,
  deleteSentinelRule,
  fetchSentinelStatus,
  triggerSentinelSweep,
  updateSentinelMode,
  emergencyOverride,
} from '../api/device'
import { Icon } from '../components/common/Icon'
import { ShinpoSelect } from '../components/ui'
import type { SelectOption } from '../components/ui/Select/types'
import {
  mapEnforcementOutcome,
  deriveOverallProtectionStatus,
  formatEnforcementMode,
  groupQuarantineEvents,
} from '../utils/focusProtectionStatus'

const RULE_POLICY_OPTIONS: SelectOption<'BLOCKED' | 'ALLOWED'>[] = [
  { value: 'BLOCKED', label: 'BLOCKED (Close during focus sessions)' },
  { value: 'ALLOWED', label: 'ALLOWED (Allow during focus sessions)' },
]

const OVERRIDE_MODE_OPTIONS: SelectOption<'CONTAINMENT' | 'AUDIT_ONLY'>[] = [
  { value: 'CONTAINMENT', label: 'Containment (Allow launch with warning logs)' },
  { value: 'AUDIT_ONLY', label: 'Monitoring Only (Passive telemetry monitoring only)' },
]

export interface TaskManagerViewProps {
  deviceSnapshot: ProcessSnapshot | null
  tmLoading: boolean
  tmSearch: string
  setTmSearch: (s: string) => void
  tmPolicy: string
  setTmPolicy: (p: string) => void
  setTmRefreshKey: React.Dispatch<React.SetStateAction<number>>
  sentinelStatus: SentinelStatus | null
  setSentinelStatus: React.Dispatch<React.SetStateAction<SentinelStatus | null>>
  sentinelRules: PolicyRule[]
  setSentinelRules: React.Dispatch<React.SetStateAction<PolicyRule[]>>
  handleTerminateProcess: (proc: ProcessInfo) => void
  tamperEvents: SentinelTamperEventItem[]
  setTamperEvents?: React.Dispatch<React.SetStateAction<SentinelTamperEventItem[]>>
  tamperEventsExpanded: boolean
  setTamperEventsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  tamperEventsLoading: boolean
  loadDeviceProcesses?: () => Promise<void>
  loadSentinelTamperEvents?: () => Promise<void>
  tmToast: string | null
  setTmToast: React.Dispatch<React.SetStateAction<string | null>>
}

import { trackRender } from '../utils/renderTracker'

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({
  deviceSnapshot,
  tmLoading,
  tmSearch,
  setTmSearch,
  tmPolicy,
  setTmPolicy,
  setTmRefreshKey,
  sentinelStatus,
  setSentinelStatus,
  sentinelRules,
  setSentinelRules,
  handleTerminateProcess,
  tamperEvents,
  setTamperEvents: _setTamperEvents,
  tamperEventsExpanded,
  setTamperEventsExpanded,
  tamperEventsLoading,
  loadDeviceProcesses,
  loadSentinelTamperEvents,
  tmToast,
  setTmToast,
}) => {
  trackRender('TaskManagerView')
  const [sentinelSweeping, setSentinelSweeping] = useState(false)
  const [showAddRuleModal, setShowAddRuleModal] = useState(false)
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleType, setNewRuleType] = useState<'BLOCKED' | 'ALLOWED'>('BLOCKED')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overridePassword, setOverridePassword] = useState('')
  const [showOverridePassword, setShowOverridePassword] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideTargetMode, setOverrideTargetMode] = useState<'CONTAINMENT' | 'AUDIT_ONLY'>('CONTAINMENT')
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [expandedActivityKeys, setExpandedActivityKeys] = useState<Set<string>>(new Set())

  const toggleActivityDetail = (key: string) => {
    setExpandedActivityKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const anyOpen = showAddRuleModal || showOverrideModal
        if (anyOpen && !overrideLoading) {
          setShowAddRuleModal(false)
          setShowOverrideModal(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddRuleModal, showOverrideModal, overrideLoading])

  const handleSentinelSweep = async () => {
    setSentinelSweeping(true)
    try {
      const res = await triggerSentinelSweep()
      setTmToast(res.message)
      setTimeout(() => setTmToast(null), 4500)
      const st = await fetchSentinelStatus().catch(() => null)
      if (st) setSentinelStatus(st)
      void loadDeviceProcesses?.()
    } catch (err: unknown) {
      setTmToast(err instanceof Error ? err.message : 'Sentinel sweep failed')
      setTimeout(() => setTmToast(null), 4000)
    } finally {
      setSentinelSweeping(false)
    }
  }

  const handleToggleSentinelMode = async () => {
    if (!sentinelStatus) return
    if (sentinelStatus.isPolicyLocked) {
      setTmToast('Focus Protection Locked: Protection mode cannot be changed during an active session. Use Emergency Override.')
      setShowOverrideModal(true)
      setTimeout(() => setTmToast(null), 4500)
      return
    }
    const nextMode =
      sentinelStatus.enforcementMode === 'STRICT'
        ? 'AUDIT_ONLY'
        : sentinelStatus.enforcementMode === 'AUDIT_ONLY'
          ? 'CONTAINMENT'
          : 'STRICT'
    try {
      const updated = await updateSentinelMode(nextMode)
      setSentinelStatus(updated)
      setTmToast(`Focus protection mode set to: ${nextMode}`)
      setTimeout(() => setTmToast(null), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update focus protection mode'
      setTmToast(msg)
      setTimeout(() => setTmToast(null), 4500)
      void loadSentinelTamperEvents?.()
    }
  }

  const handleAddSentinelRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRulePattern.trim()) return
    try {
      const created = await addSentinelRule(newRulePattern.trim(), newRuleType)
      setSentinelRules((prev) => [created, ...prev.filter((r) => r.id !== created.id)])
      setNewRulePattern('')
      setShowAddRuleModal(false)
      setTmToast(`Added "${created.processNamePattern}" to Sentinel distraction blocklist`)
      setTimeout(() => setTmToast(null), 3500)
      void loadDeviceProcesses?.()
    } catch (err: unknown) {
      setTmToast(err instanceof Error ? err.message : 'Failed to add rule')
      setTimeout(() => setTmToast(null), 3500)
    }
  }

  const handleDeleteSentinelRule = async (ruleId: number, pattern: string) => {
    try {
      await deleteSentinelRule(ruleId)
      setSentinelRules((prev) => prev.filter((r) => r.id !== ruleId))
      setTmToast(`Removed "${pattern}" from Sentinel blocklist`)
      setTimeout(() => setTmToast(null), 3500)
      void loadDeviceProcesses?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete rule'
      setTmToast(msg)
      setTimeout(() => setTmToast(null), 4500)
      void loadSentinelTamperEvents?.()
    }
  }

  const handleEmergencyOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!overridePassword) {
      setOverrideError('Administrator password is required')
      return
    }
    if (overrideReason.trim().length < 15) {
      setOverrideError('Justification must be at least 15 characters to satisfy audit requirements')
      return
    }
    setOverrideLoading(true)
    setOverrideError(null)
    try {
      const res = await emergencyOverride({
        password: overridePassword,
        reason: overrideReason.trim(),
        targetMode: overrideTargetMode,
      })
      setTmToast(`Emergency Override Approved: Mode set to ${res.newMode}`)
      setTimeout(() => setTmToast(null), 5000)
      setShowOverrideModal(false)
      setOverridePassword('')
      setOverrideReason('')
      const st = await fetchSentinelStatus().catch(() => null)
      if (st) setSentinelStatus(st)
      void loadDeviceProcesses?.()
      void loadSentinelTamperEvents?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Emergency override failed'
      setOverrideError(msg)
      void loadSentinelTamperEvents?.()
    } finally {
      setOverrideLoading(false)
    }
  }

  return (
    <div className="task-manager-view">
      {/* Top Telemetry Grid */}
      <div className="tm-telemetry-grid">
        {/* CPU Metric Card */}
        <div className="tm-metric-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">BACKEND CPU LOAD</span>
            <div className="tm-metric-icon">
              <Icon name="focus" size={16} />
            </div>
          </div>
          <div>
            <div className="tm-metric-val">
              {deviceSnapshot?.systemInfo.systemCpuLoad == null ? 'Unavailable' : `${deviceSnapshot.systemInfo.systemCpuLoad.toFixed(1)}%`}
            </div>
            <div className="tm-metric-sub">
              {deviceSnapshot?.systemInfo.availableProcessors ?? 4} Hardware Threads Active
            </div>
            <div className="tm-bar-track">
              <div
                className="tm-bar-fill terracotta"
                style={{
                  transform: `scaleX(${Math.min(1, Math.max(0, (deviceSnapshot?.systemInfo.systemCpuLoad ?? 0) / 100))})`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Memory Metric Card */}
        <div className="tm-metric-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">BACKEND MEMORY</span>
            <div className="tm-metric-icon">
              <Icon name="apps" size={16} />
            </div>
          </div>
          <div>
            <div className="tm-metric-val">
              {deviceSnapshot
                ? `${(
                  (deviceSnapshot.systemInfo.totalMemoryBytes -
                    deviceSnapshot.systemInfo.freeMemoryBytes) /
                  (1024 * 1024 * 1024)
                ).toFixed(1)} GB`
                : '0 GB'}
            </div>
            <div className="tm-metric-sub">
              {deviceSnapshot
                ? `of ${(deviceSnapshot.systemInfo.totalMemoryBytes / (1024 * 1024 * 1024)).toFixed(1)} GB Physical RAM`
                : 'Allocating'}
            </div>
            <div className="tm-bar-track">
              <div
                className="tm-bar-fill emerald"
                style={{
                  transform: `scaleX(${deviceSnapshot && deviceSnapshot.systemInfo.totalMemoryBytes > 0
                    ? Math.min(
                      1,
                      Math.max(
                        0.05,
                        (deviceSnapshot.systemInfo.totalMemoryBytes -
                          deviceSnapshot.systemInfo.freeMemoryBytes) /
                        deviceSnapshot.systemInfo.totalMemoryBytes,
                      ),
                    )
                    : 0
                    })`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Process Count Metric Card */}
        <div className="tm-metric-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">ACTIVE PROCESSES</span>
            <div className="tm-metric-icon">
              <Icon name="schedule" size={16} />
            </div>
          </div>
          <div>
            <div className="tm-metric-val">
              {deviceSnapshot?.systemInfo.processCount ?? 'Unavailable'}
            </div>
            <div className="tm-metric-sub">
              {deviceSnapshot?.systemInfo.processCount == null
                ? 'Server process scanning is disabled'
                : `${deviceSnapshot.processes.length} inspected in viewport`}
            </div>
            <div className="tm-bar-track">
              <div className="tm-bar-fill emerald" style={{ transform: 'scaleX(1)' }} />
            </div>
          </div>
        </div>

        {/* Sentinel Active Status Card */}
        <div className="tm-metric-card" data-tutorial="sentinel-status-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">FOCUS PROTECTION</span>
            <div className={`sentinel-radar-container ${sentinelStatus?.status === 'ACTIVE_DEFENSE' || sentinelStatus?.status === 'ACTIVE' ? 'active-pulse' : ''}`}>
              <div className="sentinel-radar-core" />
              <div className="sentinel-radar-ring" />
            </div>
          </div>
          {(() => {
            const isDefending = sentinelStatus?.status === 'ACTIVE_DEFENSE' || sentinelStatus?.status === 'ACTIVE'
            const isStandby = sentinelStatus?.status === 'STANDBY' || sentinelStatus?.status === 'READY'
            const isUnavailable = !sentinelStatus || sentinelStatus.status === 'UNAVAILABLE' || !sentinelStatus.daemonConnected

            const statusColor = isDefending
              ? 'var(--primary-coral)'
              : isStandby
                ? 'var(--primary-green)'
                : 'var(--text-3)'

            const barFillClass = isDefending ? 'terracotta' : isStandby ? 'emerald' : ''

            return (
              <div>
                <div
                  className="tm-metric-val"
                  style={{
                    fontSize: 18,
                    color: statusColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{sentinelStatus ? sentinelStatus.status.replace('_', ' ') : 'UNAVAILABLE'}</span>
                  <button
                    type="button"
                    className="sentinel-mode-badge"
                    title={sentinelStatus?.isPolicyLocked ? "Protection Locked: Click to request Emergency Override" : "Click to cycle mode: Strict → Monitoring Only → Containment"}
                    onClick={handleToggleSentinelMode}
                  >
                    {formatEnforcementMode(sentinelStatus?.enforcementMode)}
                  </button>
                  {sentinelStatus?.isPolicyLocked && (
                    <span className="sentinel-policy-locked-badge" title="Focus protection is locked during an active session">
                      <Icon name="lock" size={11} />
                      <span>PROTECTION LOCKED</span>
                    </span>
                  )}
                </div>
                <div className="tm-metric-sub">
                  {sentinelStatus?.activeFocusSessionName
                    ? `Protecting: "${sentinelStatus.activeFocusSessionName}"`
                    : `${sentinelStatus?.totalInterceptedToday ?? 0} Distractions Blocked Today`}
                </div>
                <div className="tm-bar-track">
                  <div
                    className={`tm-bar-fill ${barFillClass}`}
                    style={{ transform: `scaleX(${isUnavailable ? 0 : 1})` }}
                  />
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Notification Toast if present */}
      {tmToast && (
        <div
          style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--accent-terracotta)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 18px',
            color: 'var(--text-1)',
            fontWeight: 600,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <Icon name="sparkle" size={16} />
          <span>{tmToast}</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="tm-controls-card">
        <div className="tm-search-box">
          <Icon name="search" size={15} />
          <input
            type="text"
            className="tm-search-input"
            placeholder="Search process name, PID, or path..."
            value={tmSearch}
            onChange={(e) => {
              setTmSearch(e.target.value)
            }}
          />
        </div>

        <div className="tm-policy-filters">
          {(['ALL', 'ALLOWED', 'BLOCKED', 'PROTECTED'] as const).map((pol) => (
            <button
              key={pol}
              type="button"
              className={`tm-filter-chip ${tmPolicy === pol ? 'active' : ''}`}
              onClick={() => {
                setTmPolicy(pol)
              }}
            >
              {pol}
            </button>
          ))}
        </div>

        <div className="tm-actions-group">
          <button
            type="button"
            className="emergency-override-btn"
            onClick={() => {
              setOverrideError(null)
              setShowOverrideModal(true)
              setShowAddRuleModal(false)
            }}
            title="Authorize temporary protection override"
          >
            <Icon name="shield" size={14} />
            <span>Emergency Override</span>
          </button>

          <button
            type="button"
            className="tm-refresh-btn btn-spring"
            onClick={handleSentinelSweep}
            disabled={sentinelSweeping}
            style={{
              background: 'var(--accent-red-subtle)',
              borderColor: 'var(--accent-red-border)',
              color: 'var(--accent-red)',
            }}
            title="Close open distraction applications"
          >
            <Icon name="sparkle" size={14} />
            <span>{sentinelSweeping ? 'Closing...' : 'Close Distractions'}</span>
          </button>

          <button
            type="button"
            className="tm-refresh-btn btn-spring"
            onClick={() => {
              setShowAddRuleModal(true)
              setShowOverrideModal(false)
            }}
            title="Add application to blocked list"
          >
            <Icon name="plus" size={14} />
            <span>Block App</span>
          </button>

          <button
            type="button"
            className="tm-refresh-btn btn-spring"
            onClick={() => setTmRefreshKey((key) => key + 1)}
            disabled={tmLoading}
          >
            <Icon name="refresh" size={14} />
            <span>{tmLoading ? 'Scanning...' : 'Refresh Processes'}</span>
          </button>
        </div>
      </div>

      {/* Focus Protection Policy Rules & Activity Feed */}
      {(() => {
        const protectionInfo = deriveOverallProtectionStatus(sentinelStatus)
        const groupedActivities = groupQuarantineEvents(sentinelStatus?.recentQuarantines ?? [])
        const customRules = sentinelRules.filter((r) => r.isCustom)

        return (
          <div className="sentinel-panel">
            {/* Header: Title, Description, Operational Badges */}
            <div className="sentinel-panel-header">
              <div className="sentinel-title-block">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="shield" size={18} />
                  <h3 className="sentinel-panel-title">Focus Protection</h3>
                </div>
                <p className="sentinel-panel-subtitle">
                  Real-time workstation distraction defense and process containment.
                </p>
              </div>

              <div className="sentinel-header-badges">
                {/* Overall Operational Status Pill */}
                <div
                  className={`sentinel-status-pill ${protectionInfo.badgeVariant}`}
                  title={protectionInfo.description}
                >
                  <span
                    className={`sentinel-overview-dot ${protectionInfo.shieldConnected ? 'connected' : 'disconnected'}`}
                  />
                  <span>{protectionInfo.badgeText}</span>
                </div>

                {/* Mode Selector Pill */}
                <button
                  type="button"
                  className="sentinel-mode-badge"
                  title={
                    sentinelStatus?.isPolicyLocked
                      ? 'Protection Locked: Click to request Emergency Override'
                      : 'Click to cycle mode: Strict → Monitoring Only → Containment'
                  }
                  onClick={handleToggleSentinelMode}
                >
                  <span>{protectionInfo.mode}</span>
                  {sentinelStatus?.isPolicyLocked && <Icon name="lock" size={11} />}
                </button>
              </div>
            </div>

            {/* Overview Summary Strip */}
            <div className="sentinel-overview-strip">
              <div className="sentinel-overview-item">
                <span
                  className={`sentinel-overview-dot ${protectionInfo.shieldConnected ? 'connected' : 'disconnected'}`}
                />
                <span>
                  Native Shield:{' '}
                  <strong style={{ color: protectionInfo.shieldConnected ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {protectionInfo.shieldConnected ? 'Connected (Verified)' : 'Disconnected (Offline)'}
                  </strong>
                </span>
              </div>

              <div className="sentinel-overview-item">
                <Icon name="target" size={14} />
                <span>
                  <strong style={{ color: 'var(--text-1)' }}>{customRules.length}</strong> Custom Rule
                  {customRules.length === 1 ? '' : 's'} Active
                </span>
              </div>

              <div className="sentinel-overview-item">
                <Icon name="sparkle" size={14} />
                <span>
                  <strong style={{ color: 'var(--text-1)' }}>{sentinelStatus?.totalInterceptedToday ?? 0}</strong> Intercepted Today
                </span>
              </div>

              {sentinelStatus?.isPolicyLocked && (
                <button
                  type="button"
                  className="emergency-override-btn"
                  style={{ padding: '5px 12px', fontSize: 12 }}
                  onClick={() => {
                    setOverrideError(null)
                    setShowOverrideModal(true)
                    setShowAddRuleModal(false)
                  }}
                  title="Protection is locked during sprint. Click to request override."
                >
                  <Icon name="lock" size={12} />
                  <span>Override Locked</span>
                </button>
              )}
            </div>

            {/* Protection Rules Section */}
            <div className="sentinel-section-box">
              <div className="sentinel-section-top">
                <div className="sentinel-section-heading">Configured Distraction Rules</div>
                <button
                  type="button"
                  className="tm-refresh-btn btn-spring"
                  style={{ padding: '4px 12px', fontSize: 12, height: 'auto' }}
                  onClick={() => {
                    setShowAddRuleModal(true)
                    setShowOverrideModal(false)
                  }}
                  title="Add custom application rule"
                >
                  <Icon name="plus" size={12} />
                  <span>Block App</span>
                </button>
              </div>

              <div className="sentinel-rules-explainer">
                Built-in protection automatically suppresses known gaming platforms (Steam, Lutris, Epic). Custom rules target specific distracting workstation apps during active Focus sprints. Essential development, accessibility, and recording tools (OBS, IDEs, Terminal, Git) are never blocked by default.
              </div>

              <div className="sentinel-rules-list">
                {customRules.length > 0 ? (
                  customRules.map((rule) => (
                    <span
                      key={rule.id}
                      className={`sentinel-rule-chip ${rule.policyType.toLowerCase()}`}
                    >
                      <span className="sentinel-rule-action-tag">
                        {rule.policyType}
                      </span>
                      <span>{rule.processNamePattern}</span>
                      {sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED' ? (
                        <span
                          className="sentinel-rule-locked-indicator"
                          title="Focus protection rules are locked during an active session."
                          onClick={() => {
                            setTmToast('Focus protection rules are locked during active sessions. Use Emergency Override if needed.')
                            setTimeout(() => setTmToast(null), 4000)
                          }}
                        >
                          <Icon name="lock" size={11} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="sentinel-rule-del-btn"
                          onClick={() => handleDeleteSentinelRule(rule.id, rule.processNamePattern)}
                          title={`Remove rule "${rule.processNamePattern}"`}
                          aria-label={`Remove rule "${rule.processNamePattern}"`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: 12.5, color: 'var(--text-3)', padding: '4px 0' }}>
                    No custom application rules configured yet. Click "+ Block App" to target specific workstation apps.
                  </span>
                )}
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="sentinel-section-box" style={{ marginTop: 4 }}>
              <div className="sentinel-section-top">
                <div className="sentinel-section-heading">Recent Enforcement Activity</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {groupedActivities.length} Unique Event{groupedActivities.length === 1 ? '' : 's'}
                </div>
              </div>

              {groupedActivities.length === 0 ? (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-3)',
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="check-circle" size={15} />
                  <span>No distraction applications intercepted recently. Focus workspace is clear.</span>
                </div>
              ) : (
                <div className="sentinel-activity-timeline">
                  {groupedActivities.map((group) => {
                    const outcome = mapEnforcementOutcome(
                      group.primaryItem.policyAction,
                      group.primaryItem.reason
                    )
                    const isExpanded = expandedActivityKeys.has(group.groupKey)
                    const timeFormatted = new Date(group.primaryItem.detectedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })

                    return (
                      <div key={group.groupKey} className="sentinel-activity-card">
                        <div
                          className="sentinel-activity-main"
                          onClick={() => toggleActivityDetail(group.groupKey)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              toggleActivityDetail(group.groupKey)
                            }
                          }}
                          aria-expanded={isExpanded}
                        >
                          <div className="sentinel-activity-left">
                            <strong className="sentinel-activity-app-name">{group.processName}</strong>
                            {group.count > 1 && (
                              <span className="sentinel-activity-count-badge" title={`${group.count} attempts intercepted`}>
                                ×{group.count}
                              </span>
                            )}
                            <span className={`sentinel-activity-badge ${outcome.statusType}`}>
                              {outcome.badgeLabel}
                            </span>
                          </div>

                          <div className="sentinel-activity-summary" title={group.primaryItem.reason}>
                            {outcome.summaryExplanation}
                          </div>

                          <div className="sentinel-activity-right">
                            <span>{timeFormatted}</span>
                            <Icon name={isExpanded ? 'chevron' : 'chevron-right'} size={13} />
                          </div>
                        </div>

                        {/* Expandable Diagnostic Details Panel */}
                        {isExpanded && (
                          <div className="sentinel-activity-details-panel">
                            <div className="activity-detail-field">
                              <span className="activity-detail-label">PROCESS ID (PID)</span>
                              <span className="activity-detail-val">
                                {group.allPids.join(', ')}
                              </span>
                            </div>

                            <div className="activity-detail-field">
                              <span className="activity-detail-label">RAW BACKEND ACTION</span>
                              <span className="activity-detail-val">
                                {outcome.fullTechnicalAction}
                              </span>
                            </div>

                            <div className="activity-detail-field">
                              <span className="activity-detail-label">ENFORCEMENT MODE</span>
                              <span className="activity-detail-val">
                                {group.primaryItem.enforcementMode || 'STRICT'}
                              </span>
                            </div>

                            <div className="activity-detail-field">
                              <span className="activity-detail-label">ASSOCIATED FOCUS SESSION</span>
                              <span className="activity-detail-val">
                                {group.primaryItem.focusSessionId ? `#${group.primaryItem.focusSessionId}` : 'None'}
                              </span>
                            </div>

                            <div className="activity-detail-field" style={{ gridColumn: '1 / -1' }}>
                              <span className="activity-detail-label">FULL TECHNICAL REASON</span>
                              <span className="activity-detail-val" style={{ fontFamily: 'inherit', fontSize: '11.5px' }}>
                                {group.primaryItem.reason || 'No extended reason reported by backend'}
                              </span>
                            </div>

                            {group.primaryItem.commandLine && (
                              <div className="activity-detail-field" style={{ gridColumn: '1 / -1' }}>
                                <span className="activity-detail-label">EXECUTABLE COMMAND LINE</span>
                                <span className="activity-detail-val">
                                  {group.primaryItem.commandLine}
                                </span>
                              </div>
                            )}

                            <div className="activity-detail-field" style={{ gridColumn: '1 / -1' }}>
                              <span className="activity-detail-label">LAST DETECTED AT</span>
                              <span className="activity-detail-val">
                                {new Date(group.primaryItem.detectedAt).toLocaleString()} ({group.primaryItem.detectedAt})
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Technical Security & Tamper Audit Log Section */}
            <div className="sentinel-tamper-section">
              <div
                className="sentinel-tamper-header"
                onClick={() => setTamperEventsExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setTamperEventsExpanded((prev) => !prev)
                  }
                }}
                aria-expanded={tamperEventsExpanded}
              >
                <div className="sentinel-tamper-title">
                  <Icon name="shield" size={15} />
                  <span>Technical Security & Tamper Audit Log</span>
                  <span
                    className={`sentinel-tamper-badge-count ${tamperEvents.length === 0 ? 'clean' : 'alert'
                      }`}
                  >
                    {tamperEvents.length === 0
                      ? '0 Events Logged'
                      : `${tamperEvents.length} Event${tamperEvents.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <button
                  type="button"
                  aria-expanded={tamperEventsExpanded}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  tabIndex={-1}
                >
                  <span>{tamperEventsExpanded ? 'Collapse' : 'Expand Audit Log'}</span>
                  <Icon name={tamperEventsExpanded ? 'chevron' : 'chevron-right'} size={12} />
                </button>
              </div>

              {tamperEventsExpanded && (
                <div className="sentinel-tamper-timeline">
                  {tamperEventsLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
                      Loading audit logs...
                    </div>
                  ) : tamperEvents.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-2)',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        borderRadius: 'var(--radius-sm, 8px)',
                        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                      }}
                    >
                      No administrative override or policy tamper events recorded in current audit window.
                    </div>
                  ) : (
                    tamperEvents.map((evt) => (
                      <div key={evt.id} className="sentinel-tamper-item">
                        <div className="sentinel-tamper-item-top">
                          <div className="sentinel-tamper-item-left">
                            <span
                              className={`sentinel-severity-badge ${evt.severity.toLowerCase()}`}
                            >
                              {evt.severity}
                            </span>
                            <strong style={{ color: 'var(--text-1)' }}>
                              {evt.eventType.replace(/_/g, ' ')}
                            </strong>
                            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                              [{evt.enforcementMode}]
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {new Date(evt.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </div>
                        </div>
                        {evt.justification && (
                          <div className="sentinel-tamper-justification">
                            <strong>Justification:</strong> {evt.justification}
                          </div>
                        )}
                        {evt.details && (
                          <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                            {evt.details}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div className="quick-modal-overlay" onClick={() => setShowAddRuleModal(false)}>
          <div className="quick-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(520px, calc(100vw - 32px))' }}>
            <div className="quick-modal-header">
              <h3 className="quick-modal-title">Block Application</h3>
              <button type="button" className="quick-modal-close" onClick={() => setShowAddRuleModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddSentinelRule} className="quick-modal-body">
              <div className="quick-form-group">
                <label className="quick-form-label">PROCESS NAME OR EXECUTABLE PATTERN</label>
                <input
                  type="text"
                  className="quick-form-input"
                  placeholder="e.g. slack, minecraft, obs, brave"
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  autoFocus
                  required
                />
                <span style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 4 }}>
                  System core processes (systemd, shinpo, bash) are protected and cannot be blocked.
                </span>
              </div>

              <div className="quick-form-group">
                <ShinpoSelect<'BLOCKED' | 'ALLOWED'>
                  label="POLICY ACTION"
                  value={newRuleType}
                  onChange={setNewRuleType}
                  options={RULE_POLICY_OPTIONS}
                />
              </div>

              <div className="quick-modal-actions">
                <button
                  type="button"
                  className="quick-btn-cancel"
                  onClick={() => setShowAddRuleModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="quick-btn-submit"
                  disabled={!newRulePattern.trim()}
                >
                  Add Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Protection Change - Emergency Override Modal */}
      {showOverrideModal && (
        <div
          className="quick-modal-overlay"
          onClick={() => {
            if (!overrideLoading) setShowOverrideModal(false)
          }}
        >
          <div
            className="quick-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(500px, calc(100vw - 32px))',
              borderTop: '3px solid var(--accent-coral, #FF4D5E)',
            }}
          >
            <div className="quick-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="shield" size={18} />
                <h3 className="quick-modal-title" style={{ color: 'var(--accent-coral, #FF4D5E)' }}>
                  Confirm Protection Change
                </h3>
              </div>
              <button
                type="button"
                className="quick-modal-close"
                onClick={() => {
                  if (!overrideLoading) setShowOverrideModal(false)
                }}
                disabled={overrideLoading}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEmergencyOverrideSubmit} className="quick-modal-body">
              <div className="override-modal-warning">
                <strong>
                  <Icon name="lock" size={14} />
                  ACTIVE FOCUS PROTECTION
                </strong>
                <span>
                  An active focus session is currently in progress.
                  Changing focus protection requires your account password and a stated reason.
                </span>
              </div>

              {overrideError && (
                <div className="override-error-banner">
                  {overrideError}
                </div>
              )}

              <div className="quick-form-group">
                <ShinpoSelect<'CONTAINMENT' | 'AUDIT_ONLY'>
                  label="DESIRED ENFORCEMENT MODE"
                  value={overrideTargetMode}
                  onChange={setOverrideTargetMode}
                  options={OVERRIDE_MODE_OPTIONS}
                  disabled={overrideLoading}
                />
              </div>

              <div className="quick-form-group">
                <label className="quick-form-label">ACCOUNT PASSWORD</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showOverridePassword ? 'text' : 'password'}
                    className="quick-form-input"
                    placeholder="Enter your account password..."
                    value={overridePassword}
                    onChange={(e) => setOverridePassword(e.target.value)}
                    required
                    disabled={overrideLoading}
                    autoFocus
                    style={{ width: '100%', paddingRight: '38px' }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowOverridePassword((prev) => !prev)}
                    aria-label={showOverridePassword ? 'Hide password' : 'Show password'}
                    title={showOverridePassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary, #94a3b8)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                    }}
                  >
                    <Icon name={showOverridePassword ? 'eye-off' : 'eye'} size={15} />
                  </button>
                </div>
              </div>

              <div className="quick-form-group">
                <label className="quick-form-label">
                  REASON (MIN. 15 CHARACTERS)
                </label>
                <textarea
                  className="quick-form-input"
                  rows={3}
                  style={{ resize: 'vertical', minHeight: 70 }}
                  placeholder="Enter reason for changing protection during a session (e.g. Urgent email response required)..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                  disabled={overrideLoading}
                />
                <div
                  className={`override-char-counter ${overrideReason.trim().length >= 15 ? 'valid' : 'invalid'
                    }`}
                >
                  {overrideReason.trim().length} / 15 chars min
                </div>
              </div>

              <div className="quick-modal-actions">
                <button
                  type="button"
                  className="quick-btn-cancel"
                  onClick={() => setShowOverrideModal(false)}
                  disabled={overrideLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="quick-btn-submit"
                  disabled={
                    overrideLoading ||
                    !overridePassword ||
                    overrideReason.trim().length < 15
                  }
                  style={{
                    background:
                      overrideReason.trim().length >= 15 && overridePassword
                        ? 'linear-gradient(135deg, #FF4D5E 0%, #D92B3E 100%)'
                        : undefined,
                    borderColor: '#FF4D5E',
                  }}
                >
                  {overrideLoading ? 'Confirming...' : 'Confirm Protection Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Table Card */}
      <div className="tm-table-card">
        <div className="tm-table-header">
          <div>
            <h3 className="tm-table-title">Live Process Table</h3>
            <span className="tm-table-count">
              Showing {deviceSnapshot?.processes.length ?? 0} processes on {deviceSnapshot?.systemInfo.deviceName || 'Local Device'}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="tm-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>PID</th>
                <th>Process / Application</th>
                <th style={{ width: 110 }}>CPU (%)</th>
                <th style={{ width: 130 }}>Memory</th>
                <th style={{ width: 140 }}>Policy Status</th>
                <th style={{ width: 130, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {deviceSnapshot && deviceSnapshot.processes.length > 0 ? (
                deviceSnapshot.processes.map((proc: ProcessInfo, idx: number) => (
                  <tr key={proc.pid} className="proc-row-stagger" style={{ animationDelay: `${Math.min(idx * 0.02, 0.4)}s` }}>
                    <td>
                      <span className="tm-pid-badge">{proc.pid}</span>
                    </td>
                    <td>
                      <div className="tm-proc-name">
                        <span>{proc.name}</span>
                      </div>
                      {proc.executablePath && (
                        <div className="tm-proc-path" title={proc.executablePath}>
                          {proc.executablePath}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {proc.cpuPercent == null ? 'Unavailable' : `${proc.cpuPercent.toFixed(1)}%`}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {proc.memoryBytes == null ? 'Unavailable' : proc.memoryBytes > 0
                          ? proc.memoryBytes > 1024 * 1024 * 1024
                            ? `${(proc.memoryBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                            : `${Math.round(proc.memoryBytes / (1024 * 1024))} MB`
                          : '--'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`tm-policy-badge ${proc.shinpoPolicyState === 'ALLOWED'
                          ? 'allowed'
                          : proc.shinpoPolicyState === 'BLOCKED'
                            ? 'blocked'
                            : 'protected'
                          }`}
                      >
                        {proc.shinpoPolicyState === 'ALLOWED' && 'Allowed'}
                        {proc.shinpoPolicyState === 'BLOCKED' && 'Blocked'}
                        {proc.shinpoPolicyState === 'PROTECTED' && 'Protected'}
                        {proc.shinpoPolicyState === 'UNKNOWN' && 'Monitored'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {proc.canControl && proc.shinpoPolicyState !== 'PROTECTED' ? (
                        <button
                          type="button"
                          className="tm-btn-terminate btn-spring"
                          onClick={() => handleTerminateProcess(proc)}
                        >
                          Terminate
                        </button>
                      ) : (
                        <span className="tm-protected-label">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text-3)' }}>
                    {tmLoading ? 'Enumerating device processes...' : 'No matching processes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
