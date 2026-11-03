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
  updateSentinelMode,
  emergencyOverride,
} from '../api/device'
import { Icon } from '../components/common/Icon'
import { ShinpoSelect } from '../components/ui'
import type { SelectOption } from '../components/ui/Select/types'
import {
  mapEnforcementOutcome,
  deriveOverallProtectionStatus,
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
  isAurora?: boolean
  localVaultMode?: boolean
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
  tamperEvents: SentinelTamperEventItem[]
  setTamperEvents?: React.Dispatch<React.SetStateAction<SentinelTamperEventItem[]>>
  tamperEventsExpanded: boolean
  setTamperEventsExpanded: React.Dispatch<React.SetStateAction<boolean>>
  tamperEventsLoading: boolean
  loadDeviceProcesses?: () => Promise<void>
  loadSentinelTamperEvents?: () => Promise<void>
  tmToast: string | null
  setTmToast: React.Dispatch<React.SetStateAction<string | null>>
  onOpenCompanionSettings?: () => void
}

import { trackRender } from '../utils/renderTracker'

export const TaskManagerView: React.FC<TaskManagerViewProps> = ({
  isAurora = false,
  localVaultMode = false,
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
  tamperEvents,
  setTamperEvents: _setTamperEvents,
  tamperEventsExpanded,
  setTamperEventsExpanded,
  tamperEventsLoading,
  loadDeviceProcesses,
  loadSentinelTamperEvents,
  tmToast,
  setTmToast,
  onOpenCompanionSettings,
}) => {
  trackRender('TaskManagerView')
  const [ruleSearch, setRuleSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState<'ALL' | 'BLOCKED' | 'ALLOWED' | 'PROTECTED'>('ALL')
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

  const protectionInfo = deriveOverallProtectionStatus(sentinelStatus)
  const monitoringOnly = sentinelStatus?.enforcementMode.toUpperCase() === 'AUDIT_ONLY'
  const enforcementAvailable = protectionInfo.shieldConnected && !monitoringOnly
  const handleToggleSentinelMode = async () => {
    if (!sentinelStatus) return
    if (sentinelStatus.isPolicyLocked) {
      if (!protectionInfo.shieldConnected) {
        setTmToast('This policy is locked. Emergency override is unavailable while desktop protection is disconnected.')
        setTimeout(() => setTmToast(null), 4500)
        return
      }
      setTmToast('Focus protection is locked during an active session. Use Emergency Override to change it.')
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
      setTmToast(`Added "${created.processNamePattern}" to blocked applications`)
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
      setTmToast(`Removed "${pattern}" from blocked applications`)
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
    if (!protectionInfo.shieldConnected) {
      setOverrideError('Emergency override is unavailable while desktop protection is disconnected.')
      return
    }
    if (!overridePassword) {
      setOverrideError('Administrator password is required')
      return
    }
    if (overrideReason.trim().length < 15) {
      setOverrideError('Explain why you need this change in at least 15 characters.')
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

  const visibleRules = sentinelRules.filter((rule) => {
    const matchesSearch = rule.processNamePattern.toLowerCase().includes(ruleSearch.trim().toLowerCase())
    const matchesFilter = ruleFilter === 'ALL'
      || (ruleFilter === 'PROTECTED' ? !rule.isCustom : rule.policyType === ruleFilter)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="task-manager-view">
      {localVaultMode && <p role="status" className="tm-local-limit-note">
        Automatic Guardian records recognized distracting app names in your encrypted vault during Focus. It is warning-only and never closes apps; application inventory and custom app rules are not available. Local mode does not contact a backend.
      </p>}
      <section className={`protection-hero status-${protectionInfo.statusKey.toLowerCase()}`} aria-labelledby="protection-hero-title">
        <div className="protection-hero-main">
          <span className="protection-shield-emblem"><Icon name="shield" size={23} /></span>
          <div>
            <span className="protection-eyebrow">WORKSPACE SECURITY</span>
            <h1 id="protection-hero-title">Focus Protection</h1>
            <p>Review Guardian warnings, website policy state, and Browser Companion setup.</p>
          </div>
        </div>
        <div className="protection-hero-actions">
          <span className={`protection-live-state ${protectionInfo.shieldConnected && !monitoringOnly ? 'is-active' : protectionInfo.shieldConnected ? 'is-monitoring' : 'is-offline'}`}>
            <i aria-hidden="true" />{protectionInfo.badgeText}
          </span>
          {onOpenCompanionSettings && <button type="button" className="protection-secondary-action" onClick={onOpenCompanionSettings}>Browser setup</button>}
        </div>
      </section>

      {isAurora ? <div className="tm-telemetry-grid tm-aurora-metrics">
        <article className={`tm-metric-card tm-shield-metric ${protectionInfo.shieldConnected ? 'is-connected' : 'is-offline'}`} data-tutorial="sentinel-status-card">
          <span className="tm-metric-icon"><Icon name="shield-check" size={21} /></span>
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">PROTECTION STATUS</span><strong className="tm-metric-val">{protectionInfo.shieldConnected ? monitoringOnly ? 'Monitoring' : 'Active' : 'Unavailable'}</strong><small className="tm-metric-sub">{protectionInfo.shieldConnected ? protectionInfo.description : 'Native Shield is disconnected'}</small></span>
        </article>
        <article className="tm-metric-card">
          <span className="tm-metric-icon"><Icon name="journal" size={21} /></span>
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">SAVED RULES</span><strong className="tm-metric-val">{localVaultMode ? 'Unavailable' : sentinelStatus?.activePolicyRulesCount ?? sentinelRules.length}</strong><small className="tm-metric-sub">{localVaultMode ? 'Local rule storage is not integrated' : enforcementAvailable ? 'Available to the connected Shield' : 'Saved rules are not currently enforced'}</small></span>
        </article>
        <article className="tm-metric-card">
          <span className="tm-metric-icon"><Icon name="close" size={21} /></span>
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">APP WARNINGS TODAY</span><strong className="tm-metric-val">{localVaultMode ? sentinelStatus?.guardianWarningCount ?? '—' : sentinelStatus?.totalInterceptedToday ?? 0}</strong><small className="tm-metric-sub">{localVaultMode ? 'Observed process names · no apps closed' : 'Reported by Focus Protection'}</small></span>
        </article>
        <article className="tm-metric-card">
          <span className="tm-metric-icon"><Icon name="focus" size={21} /></span>
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">CURRENT FOCUS</span><strong className="tm-metric-val">{localVaultMode ? sentinelStatus?.activeFocusSessionId ? sentinelStatus.focusPhase ?? 'Active' : 'No session' : sentinelStatus?.activeFocusSessionId ? 'Active' : 'No session'}</strong><small className="tm-metric-sub">{localVaultMode ? sentinelStatus?.activeFocusSessionName || sentinelStatus?.guardianMode || 'Start a session to enable Guardian' : sentinelStatus?.activeFocusSessionName || 'Start a session to protect focus'}</small></span>
        </article>
      </div> : <div className="tm-telemetry-grid">
        <article className={`tm-metric-card tm-shield-metric ${protectionInfo.shieldConnected ? 'is-connected' : 'is-offline'}`} data-tutorial="sentinel-status-card">
          <div className="tm-metric-top"><span className="tm-metric-label">NATIVE SHIELD</span><span className="tm-metric-icon"><Icon name="shield-check" size={17} /></span></div>
          <strong className="tm-metric-val">{protectionInfo.shieldConnected ? monitoringOnly ? 'Monitoring' : 'Connected' : 'Unavailable'}</strong>
          <small className="tm-metric-sub">{protectionInfo.shieldConnected ? protectionInfo.description : 'Native protection service is disconnected.'}</small>
        </article>
        <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">{localVaultMode ? 'LOCAL CPU' : 'SERVER HOST CPU'}</span><span className="tm-metric-icon"><Icon name="focus" size={17} /></span></div><div><strong className="tm-metric-val">{deviceSnapshot?.systemInfo.systemCpuLoad == null ? 'Unavailable' : `${deviceSnapshot.systemInfo.systemCpuLoad.toFixed(1)}%`}</strong><small className="tm-metric-sub">{localVaultMode ? 'Local telemetry is not integrated' : `${deviceSnapshot?.systemInfo.availableProcessors ?? 'Unavailable'} hardware threads`}</small></div></article>
        <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">{localVaultMode ? 'LOCAL MEMORY' : 'SERVER HOST MEMORY'}</span><span className="tm-metric-icon"><Icon name="apps" size={17} /></span></div><div><strong className="tm-metric-val">{deviceSnapshot ? `${((deviceSnapshot.systemInfo.totalMemoryBytes - deviceSnapshot.systemInfo.freeMemoryBytes) / (1024 ** 3)).toFixed(1)} GB` : 'Unavailable'}</strong><small className="tm-metric-sub">{deviceSnapshot ? `of ${(deviceSnapshot.systemInfo.totalMemoryBytes / (1024 ** 3)).toFixed(1)} GB physical RAM` : localVaultMode ? 'Local telemetry is not integrated' : 'Host telemetry is unavailable.'}</small></div></article>
        <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">{localVaultMode ? 'LOCAL PROCESS SCAN' : 'SERVER PROCESS SCAN'}</span><span className="tm-metric-icon"><Icon name="journal" size={17} /></span></div><strong className="tm-metric-val">{deviceSnapshot?.systemInfo.processCount ?? 'Unavailable'}</strong><small className="tm-metric-sub">{deviceSnapshot?.systemInfo.processCount == null ? localVaultMode ? 'Local process inventory is not integrated' : 'Server process scanning is disabled' : `${deviceSnapshot.processes.length} ${localVaultMode ? 'local' : 'server-host'} processes · read only`}</small></article>
      </div>}

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

      <div className="tm-controls-card tm-controls-toolbar" role="group" aria-label="Focus protection controls">
        <div className="tm-search-box">
          <Icon name="search" size={15} />
          <input
            type="text"
            className="tm-search-input"
            placeholder={localVaultMode ? 'Local process inventory is not available' : 'Search process name, PID, or path...'}
            aria-label="Search server-host process snapshot"
            value={tmSearch}
            disabled={localVaultMode}
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
              disabled={localVaultMode}
              onClick={() => {
                setTmPolicy(pol)
              }}
            >
              {pol}
            </button>
          ))}
        </div>

        <div className="tm-actions-group">
          <button type="button" className="tm-refresh-btn" disabled={localVaultMode} title={localVaultMode ? 'Local application rule storage is not integrated' : undefined} onClick={() => setShowAddRuleModal(true)}><Icon name="plus" size={14} /><span>Add app rule</span></button>
          <button type="button" className="emergency-override-btn microkit-danger-invert" disabled={localVaultMode || !protectionInfo.shieldConnected} title={localVaultMode ? 'Local Guardian is warning-only; no destructive override is available' : !protectionInfo.shieldConnected ? 'Unavailable while desktop protection is disconnected' : 'Advanced action: requires administrator credentials and a reason'} onClick={() => { setOverrideError(null); setShowOverrideModal(true); setShowAddRuleModal(false) }}><Icon name="shield" size={14} /><span>Emergency override</span></button>
          <button
            type="button"
            className="tm-refresh-btn btn-spring"
            onClick={() => setTmRefreshKey((key) => key + 1)}
            disabled={tmLoading || localVaultMode}
          >
            <Icon name="refresh" size={14} />
            <span>{tmLoading ? 'Scanning...' : 'Refresh Processes'}</span>
          </button>
        </div>
      </div>

      <section className="protection-overview-panel" aria-labelledby="protection-overview-title">
        <header><span className="protection-shield-emblem"><Icon name="shield-check" size={18} /></span><div><h2 id="protection-overview-title">Protection overview</h2><p>Native application protection and current policy state.</p></div><button type="button" className="protection-mode-control" disabled={localVaultMode} onClick={handleToggleSentinelMode} title={localVaultMode ? 'Local Sentinel mode control is not integrated' : sentinelStatus?.isPolicyLocked ? 'Protection is locked during this Focus session. Request an emergency override to change mode.' : 'Change protection mode'}><span className={`protection-live-state ${protectionInfo.shieldConnected && !monitoringOnly ? 'is-active' : protectionInfo.shieldConnected ? 'is-monitoring' : 'is-offline'}`}><i aria-hidden="true" />{protectionInfo.shieldConnected ? monitoringOnly ? 'Monitoring only' : 'Shield online' : 'Shield offline'}</span><span>{protectionInfo.mode} <Icon name="chevron" size={13} /></span></button></header>
        <div className="protection-overview-stats">
          <div><span>Saved application rules</span><strong>{localVaultMode ? 'Unavailable' : sentinelStatus?.activePolicyRulesCount ?? sentinelRules.length}</strong><small>{localVaultMode ? 'Local rule storage is not integrated' : enforcementAvailable ? 'Available to the connected native Shield' : 'Saved policies are not proof of active enforcement'}</small></div>
          <div><span>{localVaultMode ? 'App warnings today' : 'Applications intercepted'}</span><strong>{localVaultMode ? sentinelStatus?.guardianWarningCount ?? '—' : sentinelStatus?.totalInterceptedToday ?? 0}</strong><small>{localVaultMode ? 'Encrypted name observations; warning-only' : 'Reported today by the protection service'}</small></div>
          <div><span>Protection mode</span><strong>{localVaultMode ? sentinelStatus?.guardianMode === 'GUIDED' ? 'Light' : sentinelStatus?.guardianMode === 'PROTECTED' ? 'Standard' : sentinelStatus?.guardianMode === 'STRICT' ? 'Strict' : 'Ready' : protectionInfo.mode}</strong><small>{localVaultMode ? `${sentinelStatus?.applicationPolicyStatus?.replaceAll('_', ' ').toLowerCase() ?? 'ready'} · application handling is warning-only` : sentinelStatus?.isPolicyLocked ? 'Locked during the active Focus session' : 'Select Emergency Override to request a protected change'}</small></div>
          <div><span>Current Focus session</span><strong>{sentinelStatus?.activeFocusSessionName || 'No active session'}</strong><small>{sentinelStatus?.activeFocusSessionId ? `Persisted phase: ${sentinelStatus.focusPhase ?? 'Focus'}` : 'Guardian is ready when a Focus session starts'}</small></div>
        </div>
      </section>

      {/* Focus Protection Policy Rules & Activity Feed */}
      {(() => {
        const groupedActivities = groupQuarantineEvents(sentinelStatus?.recentQuarantines ?? [])

        return (
          <div className="sentinel-panel">
            {/* Protection Rules Section */}
            <div className="sentinel-section-box">
                <div className="sentinel-section-top"><div className="sentinel-section-heading">{localVaultMode ? 'Recognized distraction catalog' : 'Application rules'}</div><span className="protection-section-count">{localVaultMode ? `${sentinelStatus?.guardianApplicationCatalog?.length ?? 0} built-in apps` : `${sentinelRules.length} configured`}</span></div>

                {!localVaultMode && <div className="sentinel-rule-controls">
                  <label className="sentinel-rule-search"><Icon name="search" size={15} /><input value={ruleSearch} onChange={(event) => setRuleSearch(event.target.value)} placeholder={localVaultMode ? 'Local application rules are unavailable' : 'Search application rules'} aria-label="Search application rules" disabled={localVaultMode} /></label>
                  <div className="sentinel-rule-filters" role="group" aria-label="Filter application rules">
                    {(['ALL', 'BLOCKED', 'ALLOWED', 'PROTECTED'] as const).map((filter) => <button key={filter} type="button" aria-pressed={ruleFilter === filter} className={ruleFilter === filter ? 'active' : ''} disabled={localVaultMode} onClick={() => setRuleFilter(filter)}>{filter === 'ALL' ? 'All' : filter === 'PROTECTED' ? 'Protected' : filter === 'BLOCKED' ? 'Blocked' : 'Allowed'}</button>)}
                  </div>
                </div>}

              <div className="sentinel-rules-explainer">
                {localVaultMode
                  ? `Version ${sentinelStatus?.guardianAppCatalogVersion ?? 'unavailable'} · recognized app names are observed during Focus and logged locally. Apps are never blocked or closed.`
                  : 'Protected entries are built-in. Blocked and allowed entries are saved policies; the SHINPO desktop app must be connected and protection enabled to enforce them.'}
              </div>

              <div className="sentinel-rules-list">
                {localVaultMode ? (sentinelStatus?.guardianApplicationCatalog?.map((entry) => (
                  <article key={entry.processName} className="sentinel-rule-row is-protected">
                    <span className="sentinel-rule-icon"><Icon name="shield-check" size={16} /></span>
                    <span className="sentinel-rule-copy"><strong>{entry.processName}</strong><small>{entry.rationale}</small></span>
                    <span className="sentinel-rule-action-tag protected">{entry.category}</span>
                  </article>
                )) ?? <div className="sentinel-rules-empty"><Icon name="shield" size={19} /><strong>Catalog unavailable</strong><span>Guardian could not read the built-in application catalog.</span></div>) : visibleRules.length > 0 ? (
                  visibleRules.map((rule) => <article key={rule.id} className={`sentinel-rule-row ${rule.isCustom ? 'is-custom' : 'is-protected'}`}>
                    <span className="sentinel-rule-icon"><Icon name={rule.isCustom ? 'apps' : 'shield-check'} size={16} /></span>
                    <span className="sentinel-rule-copy"><strong>{rule.processNamePattern}</strong><small>{rule.isCustom ? 'Custom policy' : 'Built-in protected application'}</small></span>
                    <span className={`sentinel-rule-action-tag ${rule.policyType.toLowerCase()}`}>{rule.isCustom ? rule.policyType : 'PROTECTED'}</span>
                    {rule.isCustom && <button type="button" className="sentinel-rule-del-btn" disabled={Boolean(sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED')} onClick={() => handleDeleteSentinelRule(rule.id, rule.processNamePattern)} title={sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED' ? 'Blocking rules are locked during an active Focus session' : `Remove rule ${rule.processNamePattern}`} aria-label={`Remove rule ${rule.processNamePattern}`}><Icon name={sentinelStatus?.isPolicyLocked && rule.policyType === 'BLOCKED' ? 'lock' : 'trash'} size={14} /></button>}
                  </article>)
                ) : (
                  <div className="sentinel-rules-empty"><Icon name="shield" size={19} /><strong>{sentinelRules.length ? 'No rules match this filter' : 'No application rules have been returned'}</strong><span>{sentinelRules.length ? 'Try another filter or search term.' : 'Add a custom rule when you are ready to configure workstation policy.'}</span></div>
                )}
              </div>
            </div>

            {/* Recent Activity Section */}
            <div className="sentinel-section-box" style={{ marginTop: 4 }}>
              <div className="sentinel-section-top">
                <div className="sentinel-section-heading">{localVaultMode ? 'Recent Guardian observations' : 'Recent Enforcement Activity'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {localVaultMode ? `${sentinelStatus?.guardianObservations?.length ?? 0} session observations` : `${groupedActivities.length} Unique Event${groupedActivities.length === 1 ? '' : 's'}`}
                </div>
              </div>

              {localVaultMode ? (sentinelStatus?.guardianObservations?.length ? <div className="sentinel-activity-timeline">
                {sentinelStatus.guardianObservations.map((observation) => (
                  <article key={observation.id} className="sentinel-activity-card">
                    <div className="sentinel-activity-main">
                      <div className="sentinel-activity-left">
                        <strong className="sentinel-activity-app-name">{observation.processName}</strong>
                        <span className="sentinel-activity-badge warned">Observed</span>
                      </div>
                      <div className="sentinel-activity-summary">{observation.category} · {observation.outcome.replaceAll('_', ' ').toLowerCase()} · warning only</div>
                      <div className="sentinel-activity-right"><span>{new Date(observation.observedAt).toLocaleString()}</span></div>
                    </div>
                    <div className="sentinel-activity-details-panel">
                      <div className="activity-detail-field"><span className="activity-detail-label">PROCESS ID</span><span className="activity-detail-val">{observation.pid}</span></div>
                      <div className="activity-detail-field"><span className="activity-detail-label">FOCUS SESSION</span><span className="activity-detail-val">#{observation.sessionId}</span></div>
                      <div className="activity-detail-field"><span className="activity-detail-label">EFFECTIVE MODE · PHASE</span><span className="activity-detail-val">{observation.guardianMode} · {observation.focusPhase}</span></div>
                      <div className="activity-detail-field"><span className="activity-detail-label">CATALOG</span><span className="activity-detail-val">{observation.catalogVersion}</span></div>
                      <div className="activity-detail-field" style={{ gridColumn: '1 / -1' }}><span className="activity-detail-label">REASON</span><span className="activity-detail-val">{observation.rationale}</span></div>
                    </div>
                  </article>
                ))}
              </div> : <div className="sentinel-activity-empty"><Icon name="shield" size={15} /><span>{sentinelStatus?.observerStatus === 'DEGRADED' ? 'Guardian observer is unavailable. App warnings may be incomplete.' : sentinelStatus?.activeFocusSessionId ? 'No recognized distraction apps have been observed in this Focus session.' : 'App observation starts when a Focus session is active.'}</span></div>) : groupedActivities.length === 0 ? (
                <div
                  className="sentinel-activity-empty"
                  style={{
                    fontSize: 12.5,
                    color: 'var(--text-3)',
                    padding: '14px 16px',
                    background: 'rgba(255,255,255, 0.02)',
                    borderRadius: 8,
                    border: '1px solid var(--border-subtle, rgba(255,255,255, 0.05))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="shield" size={15} />
                  <span>{protectionInfo.shieldConnected ? 'No enforcement activity has been recorded in the recent activity window.' : 'No enforcement activity can be confirmed while the native Shield is disconnected.'}</span>
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
            <details className="sentinel-tamper-section" open={tamperEventsExpanded} onToggle={(event) => setTamperEventsExpanded(event.currentTarget.open)}>
              <summary className="sentinel-tamper-header">
                <div className="sentinel-tamper-title">
                  <Icon name="shield" size={15} />
                  <span>Technical Security & Tamper Audit Log</span>
                  <span
                    className={`sentinel-tamper-badge-count ${tamperEvents.length === 0 ? 'neutral' : 'alert'
                      }`}
                  >
                    {tamperEvents.length === 0
                      ? '0 Events Logged'
                      : `${tamperEvents.length} Event${tamperEvents.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                <span className="sentinel-tamper-disclosure">{tamperEventsExpanded ? 'Collapse' : 'Expand audit log'}<Icon name={tamperEventsExpanded ? 'chevron' : 'chevron-right'} size={12} /></span>
              </summary>

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
                        background: 'rgba(255,255,255, 0.02)',
                        borderRadius: 'var(--radius-sm, 8px)',
                        border: '1px solid var(--border-subtle, rgba(255,255,255, 0.05))',
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
            </details>
          </div>
        )
      })()}

      {/* Add Rule Modal */}
      {showAddRuleModal && (
        <div className="quick-modal-overlay" onClick={() => setShowAddRuleModal(false)}>
          <div className="quick-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(520px, calc(100vw - 32px))' }}>
            <div className="quick-modal-header">
              <h3 className="quick-modal-title">Block an app</h3>
              <button type="button" className="quick-modal-close" onClick={() => setShowAddRuleModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddSentinelRule} className="quick-modal-body">
              <div className="quick-form-group">
                <label className="quick-form-label">APP NAME OR FILE PATTERN</label>
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
              borderTop: '3px solid var(--accent-coral, var(--brand-primary))',
            }}
          >
            <div className="quick-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="shield" size={18} />
                <h3 className="quick-modal-title" style={{ color: 'var(--accent-coral, var(--brand-primary))' }}>
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
                <label className="quick-form-label">ACCOUNT password</label>
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
                      color: 'var(--text-secondary, #5c5c5c)',
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
                        ? 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary) 100%)'
                        : undefined,
                    borderColor: 'var(--brand-primary)',
                  }}
                >
                  {overrideLoading ? 'Confirming...' : 'Confirm Protection Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <details className="tm-advanced-processes" open>
        <summary><span>{localVaultMode ? 'Local process snapshot' : 'Server process snapshot'}</span><small>{localVaultMode ? 'Native process inventory is not yet integrated' : 'Read-only process data from the SHINPO server host'}</small></summary>
      <div className="tm-table-card">
        <div className="tm-table-header">
          <div>
            <h3 className="tm-table-title">{localVaultMode ? 'Local process snapshot' : 'Backend-host process snapshot'}</h3>
            <span className="tm-table-count">
              {deviceSnapshot ? `Showing ${deviceSnapshot.processes.length} ${localVaultMode ? 'local' : 'server-host'} processes · read-only` : localVaultMode ? 'Local process inventory unavailable' : 'Server process snapshot unavailable'}
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
                <th style={{ width: 130, textAlign: 'right' }}>Access</th>
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
                    <td style={{ textAlign: 'right' }}><span className="tm-protected-label">Read only</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text-3)' }}>
                    {tmLoading ? 'Enumerating device processes...' : localVaultMode ? 'Native process inventory is not integrated; no backend scan was requested.' : 'No matching processes found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </details>
    </div>
  )
}
