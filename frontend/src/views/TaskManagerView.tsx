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
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideTargetMode, setOverrideTargetMode] = useState<'CONTAINMENT' | 'AUDIT_ONLY'>('CONTAINMENT')
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideError, setOverrideError] = useState<string | null>(null)

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
            <span className="tm-metric-label">CPU LOAD</span>
            <div className="tm-metric-icon">
              <Icon name="focus" size={16} />
            </div>
          </div>
          <div>
            <div className="tm-metric-val">
              {deviceSnapshot ? `${deviceSnapshot.systemInfo.systemCpuLoad.toFixed(1)}%` : '0%'}
            </div>
            <div className="tm-metric-sub">
              {deviceSnapshot?.systemInfo.availableProcessors ?? 4} Hardware Threads Active
            </div>
            <div className="tm-bar-track">
              <div
                className="tm-bar-fill terracotta"
                style={{
                  transform: `scaleX(${Math.min(1, Math.max(0.05, (deviceSnapshot?.systemInfo.systemCpuLoad ?? 0) / 100))})`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Memory Metric Card */}
        <div className="tm-metric-card">
          <div className="tm-metric-top">
            <span className="tm-metric-label">MEMORY USAGE</span>
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
                  transform: `scaleX(${
                    deviceSnapshot
                      ? Math.min(
                          1,
                          Math.max(
                            0.05,
                            (deviceSnapshot.systemInfo.totalMemoryBytes -
                              deviceSnapshot.systemInfo.freeMemoryBytes) /
                              deviceSnapshot.systemInfo.totalMemoryBytes,
                          ),
                        )
                      : 0.3
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
              {deviceSnapshot ? deviceSnapshot.systemInfo.processCount : '...'}
            </div>
            <div className="tm-metric-sub">
              {deviceSnapshot?.processes.length ?? 0} Inspected in Viewport
            </div>
            <div className="tm-bar-track">
              <div className="tm-bar-fill emerald" style={{ transform: 'scaleX(1)' }} />
            </div>
          </div>
        </div>

        {/* Sentinel Active Status Card */}
        <div className="tm-metric-card">
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
                      title={sentinelStatus?.isPolicyLocked ? "Protection Locked: Click to request Emergency Override" : "Click to toggle mode: STRICT -> AUDIT_ONLY -> CONTAINMENT"}
                      onClick={handleToggleSentinelMode}
                    >
                      {sentinelStatus?.enforcementMode ?? 'STRICT'}
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

      {/* Focus Protection Policy Rules & Activity Feed */}
      <div className="sentinel-panel">
        <div className="sentinel-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="focus" size={16} />
            <h3 className="sentinel-panel-title">Focus Protection Rules & History</h3>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            {sentinelRules.length} Custom Rules • Mode: {sentinelStatus?.enforcementMode ?? 'STRICT'}
          </div>
        </div>

        {/* Rules list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>
            BLOCKED APPLICATIONS
          </div>
          <div className="sentinel-rules-list">
            {sentinelRules.length > 0 ? (
              sentinelRules.map((rule) => (
                <span key={rule.id} className={`sentinel-rule-chip ${rule.policyType.toLowerCase()}`}>
                  <span>{rule.processNamePattern}</span>
                  {rule.isCustom && (
                    sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED' ? (
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
                        title="Remove rule"
                      >
                        ×
                      </button>
                    )
                  )}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Default heuristics active (discord, steam, spotify, telegram, games, etc.)
              </span>
            )}
          </div>
        </div>

        {/* Recent Quarantines if any */}
        {sentinelStatus?.recentQuarantines && sentinelStatus.recentQuarantines.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>
              RECENT BLOCKED ATTEMPTS
            </div>
            <div className="sentinel-audit-timeline">
              {sentinelStatus.recentQuarantines.map((item) => {
                const actionLabel = item.policyAction === 'TERMINATE_ATTEMPTED'
                  ? 'Terminated'
                  : item.policyAction === 'WARNED'
                  ? 'Warning'
                  : item.policyAction === 'QUARANTINED'
                  ? 'Blocked'
                  : item.policyAction
                const cleanReason = item.reason
                  ? item.reason.replace(/\[WARNING_EXPIRED\]/g, '(Expired)').replace(/\[.*?\]/g, '').trim()
                  : ''

                return (
                  <div key={item.id} className="sentinel-audit-item">
                    <div className="sentinel-audit-left">
                      <span className={`sentinel-audit-badge ${actionLabel.toLowerCase()}`}>{actionLabel}</span>
                      <strong style={{ color: 'var(--text-1)' }}>{item.processName}</strong>
                      <span style={{ color: 'var(--text-3)' }}>(PID {item.pid})</span>
                    </div>
                    {cleanReason && (
                      <div style={{ color: 'var(--text-2)', fontSize: 11 }}>
                        {cleanReason}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Protection Audit Feed */}
        <div className="sentinel-tamper-section">
          <div
            className="sentinel-tamper-header"
          >
            <div className="sentinel-tamper-title">
              <Icon name="shield" size={15} />
              <span>PROTECTION AUDIT LOG</span>
              <span
                className={`sentinel-tamper-badge-count ${
                  tamperEvents.length === 0 ? 'clean' : 'alert'
                }`}
              >
                {tamperEvents.length === 0
                  ? 'Protected'
                  : `${tamperEvents.length} Event${tamperEvents.length > 1 ? 's' : ''}`}
              </span>
            </div>
            <button
              type="button"
              aria-expanded={tamperEventsExpanded}
              onClick={() => setTamperEventsExpanded((prev) => !prev)}
              title="Toggle audit events"
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
                    color: 'var(--accent-emerald)',
                    padding: '10px 12px',
                    background: 'rgba(46, 213, 115, 0.05)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: '1px solid rgba(46, 213, 115, 0.15)',
                  }}
                >
                  No unauthorized override attempts detected. Focus protection is operating normally.
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
                        <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                          [{evt.enforcementMode}]
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
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
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
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
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  System core processes (systemd, shinpo, bash) are protected and cannot be blocked.
                </span>
              </div>

              <div className="quick-form-group">
                <label className="quick-form-label">POLICY ACTION</label>
                <select
                  className="quick-form-input"
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as 'BLOCKED' | 'ALLOWED')}
                >
                  <option value="BLOCKED">BLOCKED (Close during focus sessions)</option>
                  <option value="ALLOWED">ALLOWED (Allow during focus sessions)</option>
                </select>
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
                <label className="quick-form-label">DESIRED ENFORCEMENT MODE</label>
                <select
                  className="quick-form-input"
                  value={overrideTargetMode}
                  onChange={(e) =>
                    setOverrideTargetMode(e.target.value as 'CONTAINMENT' | 'AUDIT_ONLY')
                  }
                  disabled={overrideLoading}
                >
                  <option value="CONTAINMENT">
                    CONTAINMENT (Allow launch with warning logs)
                  </option>
                  <option value="AUDIT_ONLY">
                    AUDIT_ONLY (Passive telemetry monitoring only)
                  </option>
                </select>
              </div>

              <div className="quick-form-group">
                <label className="quick-form-label">ACCOUNT PASSWORD</label>
                <input
                  type="password"
                  className="quick-form-input"
                  placeholder="Enter your account password..."
                  value={overridePassword}
                  onChange={(e) => setOverridePassword(e.target.value)}
                  required
                  disabled={overrideLoading}
                  autoFocus
                />
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
                  className={`override-char-counter ${
                    overrideReason.trim().length >= 15 ? 'valid' : 'invalid'
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
                        {proc.cpuPercent > 0 ? `${proc.cpuPercent.toFixed(1)}%` : '< 0.1%'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {proc.memoryBytes > 0
                          ? proc.memoryBytes > 1024 * 1024 * 1024
                            ? `${(proc.memoryBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                            : `${Math.round(proc.memoryBytes / (1024 * 1024))} MB`
                          : '--'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`tm-policy-badge ${
                          proc.shinpoPolicyState === 'ALLOWED'
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
