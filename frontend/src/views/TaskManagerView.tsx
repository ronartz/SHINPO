import React, { useState, useEffect, useCallback } from 'react'
import type {
  ProcessSnapshot,
  SentinelStatus,
  PolicyRule,
  SentinelTamperEventItem,
  ProcessInfo,
  DiscoveredApp,
  SystemTelemetry,
} from '../api/device'
import {
  addSentinelRule,
  deleteSentinelRule,
  fetchSentinelStatus,
  updateSentinelMode,
  emergencyOverride,
  fetchDiscoveredApps,
  saveGuardianAppPolicy,
  removeGuardianAppPolicy,
  fetchLocalSystemTelemetry,
} from '../api/device'
import { Icon } from '../components/common/Icon'
import { ShinpoSelect } from '../components/ui'
import type { SelectOption } from '../components/ui/Select/types'
import {
  mapEnforcementOutcome,
  deriveOverallProtectionStatus,
  groupQuarantineEvents,
} from '../utils/focusProtectionStatus'
import { guardianCanRequestClose, guardianCapabilityLabel, guardianInterventionDescription, guardianModeLabel, guardianOutcomeLabel } from '../utils/guardianCapability'

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
  onConfigureGuardianMode?: () => void
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
  onConfigureGuardianMode,
}) => {
  trackRender('TaskManagerView')
  const safeTamperEvents = Array.isArray(tamperEvents) ? tamperEvents : []
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
  const [discoveredApps, setDiscoveredApps] = useState<DiscoveredApp[]>([])
  const [appsLoading, setAppsLoading] = useState(localVaultMode)
  const [appSearch, setAppSearch] = useState('')
  const [appFilter, setAppFilter] = useState<'ALL' | 'BLOCKED' | 'ALLOWED' | 'RUNNING' | 'UNCONFIGURED'>('ALL')
  const [showBuiltinCatalog, setShowBuiltinCatalog] = useState(false)
  const [activeSubTab, setActiveSubTab] = useState<'guardian' | 'pc_monitor'>('guardian')
  const [localTelemetry, setLocalTelemetry] = useState<SystemTelemetry | null>(null)
  const [showCoresGrid, setShowCoresGrid] = useState(false)
  const [autoRefreshMonitor, setAutoRefreshMonitor] = useState(true)
  const [processSortBy, setProcessSortBy] = useState<'cpu' | 'memory' | 'name' | 'pid'>('cpu')

  const formatBytes = (bytes?: number | null): string => {
    if (bytes == null || isNaN(bytes)) return '—'
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  useEffect(() => {
    if (activeSubTab !== 'pc_monitor') return
    let active = true

    const fetchTelemetry = async () => {
      try {
        const data = await fetchLocalSystemTelemetry()
        if (active) setLocalTelemetry(data)
      } catch (err) {
        console.error('Failed to fetch system telemetry:', err)
      }
    }

    void fetchTelemetry()
    if (loadDeviceProcesses) {
      void loadDeviceProcesses()
    }

    if (!autoRefreshMonitor) return () => { active = false }

    const interval = setInterval(() => {
      void fetchTelemetry()
      if (loadDeviceProcesses) {
        void loadDeviceProcesses()
      }
    }, 2000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [activeSubTab, autoRefreshMonitor, loadDeviceProcesses, tmSearch, tmPolicy])

  const loadDiscoveredApps = useCallback(async () => {
    if (!localVaultMode) return
    setAppsLoading(true)
    try {
      const apps = await fetchDiscoveredApps()
      setDiscoveredApps(Array.isArray(apps) ? apps : [])
    } catch (err) {
      console.error('Failed to load discovered apps:', err)
    } finally {
      setAppsLoading(false)
    }
  }, [localVaultMode])

  useEffect(() => {
    if (!localVaultMode) return
    let active = true
    void fetchDiscoveredApps()
      .then((apps) => { if (active) setDiscoveredApps(Array.isArray(apps) ? apps : []) })
      .catch((err) => { if (active) console.error('Failed to load discovered apps:', err) })
      .finally(() => { if (active) setAppsLoading(false) })
    return () => { active = false }
  }, [localVaultMode])

  const handleSetAppPolicy = async (app: DiscoveredApp, nextPolicy: 'BLOCKED' | 'ALLOWED' | 'NONE') => {
    try {
      if (nextPolicy === 'NONE') {
        await removeGuardianAppPolicy(app.id)
        setDiscoveredApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, policy: 'NONE' } : a))
        )
        setTmToast(`Removed focus policy for "${app.name}"`)
      } else {
        await saveGuardianAppPolicy({
          appId: app.id,
          appName: app.name,
          execName: app.execName || app.name.toLowerCase().replace(/\s+/g, ''),
          policyType: nextPolicy,
          source: app.source,
        })
        setDiscoveredApps((prev) =>
          prev.map((a) => (a.id === app.id ? { ...a, policy: nextPolicy } : a))
        )
        setTmToast(`Saved ${nextPolicy === 'BLOCKED' ? 'block' : 'allow'} policy for "${app.name}". It applies only during Focus when observation is enabled.`)
      }
      setTimeout(() => setTmToast(null), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update application policy'
      setTmToast(msg)
      setTimeout(() => setTmToast(null), 4000)
    }
  }

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
  const monitoringOnly = sentinelStatus?.enforcementMode?.toUpperCase() === 'AUDIT_ONLY'
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

  const ruleList = Array.isArray(sentinelRules) ? sentinelRules : []
  const visibleRules = ruleList.filter((rule) => {
    const matchesSearch = rule.processNamePattern.toLowerCase().includes(ruleSearch.trim().toLowerCase())
    const matchesFilter = ruleFilter === 'ALL'
      || (ruleFilter === 'PROTECTED' ? !rule.isCustom : rule.policyType === ruleFilter)
    return matchesSearch && matchesFilter
  })

  if (localVaultMode) {
    const catalog = sentinelStatus?.guardianApplicationCatalog ?? []
    const observations = sentinelStatus?.guardianObservations ?? []
    const guardianMode = guardianModeLabel(sentinelStatus?.guardianMode)
    const capability = sentinelStatus?.interventionCapability
    const statusLabel = sentinelStatus ? guardianCapabilityLabel(capability) : 'Status unavailable'
    const closeCapabilityReady = guardianCanRequestClose(capability, sentinelStatus?.warningOnly)
    const appHandlingLabel = !sentinelStatus ? 'Unavailable'
      : closeCapabilityReady ? 'Graceful close may be requested for eligible processes' : sentinelStatus.warningOnly ? 'Monitoring / warning only' : 'Not currently protected'
    const appHandlingDetails = sentinelStatus
      ? guardianInterventionDescription(capability)
      : 'App policy status is unavailable.'

    const query = appSearch.trim().toLowerCase()
    const appList = Array.isArray(discoveredApps) ? discoveredApps : []
    const visibleApps = appList.filter((app) => {
      const matchesSearch = !query ||
        app.name.toLowerCase().includes(query) ||
        (app.execName && app.execName.toLowerCase().includes(query)) ||
        app.id.toLowerCase().includes(query)

      if (!matchesSearch) return false

      switch (appFilter) {
        case 'BLOCKED':
          return app.policy === 'BLOCKED'
        case 'ALLOWED':
          return app.policy === 'ALLOWED'
        case 'RUNNING':
          return app.isRunning
        case 'UNCONFIGURED':
          return app.policy === 'NONE'
        case 'ALL':
        default:
          return true
      }
    })

    const blockedCount = appList.filter((a) => a.policy === 'BLOCKED').length
    const allowedCount = appList.filter((a) => a.policy === 'ALLOWED').length
    const runningCount = appList.filter((a) => a.isRunning).length
    const unconfiguredCount = appList.filter((a) => a.policy === 'NONE').length

    const renderPcSystemMonitor = () => {
      const tel = localTelemetry || (deviceSnapshot?.telemetry ?? null)
      const rawProcs = deviceSnapshot?.processes ?? []
      const q = tmSearch.trim().toLowerCase()
      const filteredProcs = rawProcs.filter((p) => {
        const matchSearch = !q || p.name.toLowerCase().includes(q) || String(p.pid).includes(q) || p.executablePath.toLowerCase().includes(q)
        if (!matchSearch) return false
        if (tmPolicy === 'ALLOWED') return p.shinpoPolicyState === 'ALLOWED'
        if (tmPolicy === 'PROTECTED') return p.shinpoPolicyState === 'PROTECTED'
        if (tmPolicy === 'BLOCKED') return p.shinpoPolicyState === 'BLOCKED'
        return true
      })

      const sortedProcs = [...filteredProcs].sort((a, b) => {
        if (processSortBy === 'cpu') return (b.cpuPercent ?? 0) - (a.cpuPercent ?? 0)
        if (processSortBy === 'memory') return (b.memoryBytes ?? 0) - (a.memoryBytes ?? 0)
        if (processSortBy === 'pid') return a.pid - b.pid
        return a.name.localeCompare(b.name)
      })

      const cpuVal = tel?.cpuUsagePercent ?? deviceSnapshot?.systemInfo?.systemCpuLoad ?? 0
      const totalRam = tel?.totalMemoryBytes ?? deviceSnapshot?.systemInfo?.totalMemoryBytes ?? 0
      const usedRam = tel?.usedMemoryBytes ?? (deviceSnapshot?.systemInfo ? deviceSnapshot.systemInfo.totalMemoryBytes - deviceSnapshot.systemInfo.freeMemoryBytes : 0)
      const ramPct = totalRam ? Math.min(100, Math.round((usedRam / totalRam) * 100)) : 0

      return (
        <div className="pc-system-monitor-deck" data-testid="pc-system-monitor-deck" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metric Cards Grid */}
          <div className="tm-telemetry-grid">
            <article className="tm-metric-card" data-testid="metric-cpu">
              <div className="tm-metric-top">
                <span className="tm-metric-label">CPU UTILIZATION</span>
                <span className="tm-metric-icon"><Icon name="focus" size={17} /></span>
              </div>
              <div>
                <strong className="tm-metric-val">{cpuVal.toFixed(1)}%</strong>
                <div className="tm-bar-track">
                  <div className="tm-bar-fill terracotta" style={{ transform: `scaleX(${Math.min(1, Math.max(0.02, cpuVal / 100))})` }} />
                </div>
                <small className="tm-metric-sub">
                  {tel?.availableProcessors ?? deviceSnapshot?.systemInfo?.availableProcessors ?? '—'} threads · {tel?.osArch ?? 'x86_64'}
                  {tel?.cores && tel.cores.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCoresGrid((prev) => !prev)}
                      style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', fontSize: '11.5px', textDecoration: 'underline' }}
                    >
                      {showCoresGrid ? 'Hide cores' : 'View per-core'}
                    </button>
                  )}
                </small>
              </div>
            </article>

            <article className="tm-metric-card" data-testid="metric-memory">
              <div className="tm-metric-top">
                <span className="tm-metric-label">PHYSICAL RAM</span>
                <span className="tm-metric-icon"><Icon name="apps" size={17} /></span>
              </div>
              <div>
                <strong className="tm-metric-val">{formatBytes(usedRam)}</strong>
                <div className="tm-bar-track">
                  <div className="tm-bar-fill emerald" style={{ transform: `scaleX(${Math.min(1, Math.max(0.02, ramPct / 100))})` }} />
                </div>
                <small className="tm-metric-sub">
                  {ramPct}% of {formatBytes(totalRam)} total RAM
                </small>
              </div>
            </article>

            <article className="tm-metric-card" data-testid="metric-swap">
              <div className="tm-metric-top">
                <span className="tm-metric-label">SWAP &amp; DISK</span>
                <span className="tm-metric-icon"><Icon name="journal" size={17} /></span>
              </div>
              <div>
                <strong className="tm-metric-val">{formatBytes(tel?.usedSwapBytes ?? 0)}</strong>
                <small className="tm-metric-sub">
                  Swap of {formatBytes(tel?.totalSwapBytes ?? 0)} · {tel?.disks?.length ?? 0} filesystem(s)
                </small>
              </div>
            </article>

            <article className="tm-metric-card" data-testid="metric-processes">
              <div className="tm-metric-top">
                <span className="tm-metric-label">HOST PROCESSES</span>
                <span className="tm-metric-icon"><Icon name="apps" size={17} /></span>
              </div>
              <div>
                <strong className="tm-metric-val">{tel?.processCount ?? rawProcs.length}</strong>
                <small className="tm-metric-sub">
                  {tel?.osName ?? 'Linux'} {tel?.osVersion ?? ''} · Live sysinfo scan
                </small>
              </div>
            </article>
          </div>

          {/* Per-Core Load Breakdown */}
          {showCoresGrid && tel?.cores && tel.cores.length > 0 && (
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '10px' }}>
                Per-Core Load ({tel.cores.length} Hardware Cores)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                {tel.cores.map((c, i) => (
                  <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--surface-card)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700 }}>
                      <span>{c.name || `Core ${i}`}</span>
                      <span style={{ color: c.usagePercent > 50 ? 'var(--accent-terracotta)' : 'var(--text-1)' }}>{c.usagePercent.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bar-empty-bg)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ width: `${Math.min(100, Math.max(0, c.usagePercent))}%`, height: '100%', background: 'var(--brand-primary)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mounted Disks Breakdown */}
          {tel?.disks && tel.disks.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {tel.disks.map((d, i) => {
                const used = d.totalBytes - d.availableBytes
                const pct = d.totalBytes ? Math.min(100, Math.round((used / d.totalBytes) * 100)) : 0
                return (
                  <div key={i} style={{ flex: '1 1 220px', padding: '10px 14px', borderRadius: '10px', background: 'var(--surface-card)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 }}>
                      <span>{d.mountPoint} ({d.fileSystem})</span>
                      <span style={{ color: 'var(--text-2)' }}>{formatBytes(used)} / {formatBytes(d.totalBytes)}</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--bar-empty-bg)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-primary)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Process Table Controls Card */}
          <div className="tm-controls-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div className="tm-search-box" style={{ minWidth: '260px' }}>
              <Icon name="search" size={15} />
              <input
                type="text"
                className="tm-search-input"
                placeholder="Search process name, PID, or executable path..."
                value={tmSearch}
                onChange={(e) => setTmSearch(e.target.value)}
                data-testid="input-process-search"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="tm-policy-filters">
                {(['ALL', 'ALLOWED', 'PROTECTED'] as const).map((pol) => (
                  <button
                    key={pol}
                    type="button"
                    className={`tm-filter-chip ${tmPolicy === pol ? 'active' : ''}`}
                    onClick={() => setTmPolicy(pol)}
                    data-testid={`filter-process-${pol.toLowerCase()}`}
                  >
                    {pol === 'ALL' ? 'All' : pol === 'ALLOWED' ? 'User Apps' : 'System Daemons'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-2)' }}>
                <span>Sort:</span>
                <button
                  type="button"
                  className={`tm-filter-chip ${processSortBy === 'cpu' ? 'active' : ''}`}
                  onClick={() => setProcessSortBy('cpu')}
                >
                  CPU%
                </button>
                <button
                  type="button"
                  className={`tm-filter-chip ${processSortBy === 'memory' ? 'active' : ''}`}
                  onClick={() => setProcessSortBy('memory')}
                >
                  Memory
                </button>
                <button
                  type="button"
                  className={`tm-filter-chip ${processSortBy === 'pid' ? 'active' : ''}`}
                  onClick={() => setProcessSortBy('pid')}
                >
                  PID
                </button>
              </div>

              <button
                type="button"
                className="tm-refresh-btn"
                onClick={() => setAutoRefreshMonitor((prev) => !prev)}
                style={{ fontSize: '12px' }}
              >
                <span>Auto-refresh: {autoRefreshMonitor ? '2s' : 'Paused'}</span>
              </button>

              <button
                type="button"
                className="tm-refresh-btn"
                onClick={() => {
                  if (loadDeviceProcesses) void loadDeviceProcesses()
                  void fetchLocalSystemTelemetry().then(setLocalTelemetry)
                }}
                data-testid="btn-refresh-processes"
              >
                <Icon name="refresh" size={14} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Process Table */}
          <div className="tm-table-card">
            <div className="tm-table-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="tm-table-title">Host Processes</span>
                <span className="tm-table-count">{sortedProcs.length} processes listed</span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                Read-only system diagnostic view · OS protection active
              </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '520px' }}>
              <table className="tm-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>PID</th>
                    <th>Process Name</th>
                    <th style={{ width: '100px' }}>CPU</th>
                    <th style={{ width: '120px' }}>Memory</th>
                    <th style={{ width: '110px' }}>User</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th style={{ width: '130px' }}>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProcs.slice(0, 150).map((p) => {
                    const cpu = p.cpuPercent ?? 0
                    return (
                      <tr key={p.pid}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-3)' }}>{p.pid}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{p.name}</div>
                          {p.executablePath && (
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.executablePath}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 750, color: cpu > 20 ? 'var(--accent-terracotta)' : 'var(--text-1)' }}>
                          {cpu.toFixed(1)}%
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                          {formatBytes(p.memoryBytes)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-2)' }}>{p.user}</td>
                        <td style={{ fontSize: '12px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--surface-subtle)', color: 'var(--text-2)' }}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: p.shinpoPolicyState === 'PROTECTED' ? 'color-mix(in srgb, var(--accent-terracotta) 15%, transparent)' : 'color-mix(in srgb, var(--brand-primary) 15%, transparent)',
                              color: p.shinpoPolicyState === 'PROTECTED' ? 'var(--accent-terracotta)' : 'var(--brand-primary)',
                            }}
                          >
                            {p.shinpoPolicyState === 'PROTECTED' ? 'Protected OS' : 'User App'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {sortedProcs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-3)' }}>
                        No processes match the current search or filter criteria.
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

    return (
      <div className="task-manager-view guardian-alpha" aria-labelledby="guardian-alpha-title">
        <header className="guardian-alpha-header">
          <div className="guardian-alpha-title">
            <span className="guardian-alpha-icon"><Icon name="shield" size={22} /></span>
            <div>
              <p className="guardian-alpha-eyebrow">FOCUS PROTECTION</p>
              <h1 id="guardian-alpha-title">Guardian beta</h1>
              <p>Review app observations and configure persistent protection policies during Focus.</p>
            </div>
          </div>
          <div className={`guardian-alpha-status ${sentinelStatus?.status === 'ACTIVE' && !sentinelStatus.warningOnly ? 'is-active' : sentinelStatus?.status === 'LOCKED' || sentinelStatus?.observerStatus === 'DEGRADED' || !sentinelStatus ? 'is-unavailable' : 'is-monitoring'}`} role="status">
            <span aria-hidden="true" />{statusLabel}
          </div>
        </header>

        {/* Sub-tab navigation bar */}
        <div className="guardian-subtab-bar" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            type="button"
            className={`guardian-subtab-btn ${activeSubTab === 'guardian' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('guardian')}
            data-testid="subtab-focus-protection"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: activeSubTab === 'guardian' ? 'var(--brand-primary)' : 'var(--surface-subtle)',
              color: activeSubTab === 'guardian' ? '#fff' : 'var(--text-1)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="shield" size={16} />
            <span>Focus Protection &amp; Guardian</span>
          </button>
          <button
            type="button"
            className={`guardian-subtab-btn ${activeSubTab === 'pc_monitor' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pc_monitor')}
            data-testid="subtab-pc-monitor"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: activeSubTab === 'pc_monitor' ? 'var(--brand-primary)' : 'var(--surface-subtle)',
              color: activeSubTab === 'pc_monitor' ? '#fff' : 'var(--text-1)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="apps" size={16} />
            <span>PC System Monitor</span>
          </button>
        </div>

        {tmToast && (
          <div
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--accent-terracotta)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 16px',
              color: 'var(--text-1)',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <Icon name="sparkle" size={16} />
            <span>{tmToast}</span>
          </div>
        )}

        {activeSubTab === 'pc_monitor' ? (
          renderPcSystemMonitor()
        ) : (
          <div className="guardian-alpha-workspace">
          <div className="guardian-alpha-info-column">
            <section className="guardian-alpha-summary" aria-label="Guardian status details">
              <div><span>App handling</span><strong>{appHandlingLabel}</strong><small>{appHandlingDetails}</small>{guardianMode === 'Standard' && sentinelStatus?.standardAllowanceSeconds != null && <small>Sampled app-running allowance: {Math.floor(sentinelStatus.standardAllowanceSeconds / 60)}:{String(sentinelStatus.standardAllowanceSeconds % 60).padStart(2, '0')} of 10:00.</small>}</div>
              <div className="guardian-mode-summary-cell">
                <div className="guardian-cell-header">
                  <span>Guardian mode</span>
                  {onConfigureGuardianMode && (
                    <button
                      type="button"
                      className="guardian-mode-quick-link"
                      onClick={onConfigureGuardianMode}
                      title="Configure Guardian mode (Light, Standard, Strict) in Focus Engine"
                      data-testid="link-configure-guardian"
                    >
                      Configure
                    </button>
                  )}
                </div>
                <strong>{guardianMode}</strong>
                <small>{guardianCapabilityLabel(capability)}. Website rules require a connected Browser Companion.</small>
              </div>
              <div><span>Current Focus</span><strong>{sentinelStatus?.activeFocusSessionId ? sentinelStatus.activeFocusSessionName || 'In progress' : 'No active session'}</strong><small>{sentinelStatus?.focusPhase?.replaceAll('_', ' ') || 'Observations begin when Focus starts.'}</small></div>
              <div><span>App observations today</span><strong>{sentinelStatus?.guardianWarningCount ?? '—'}</strong><small>Names saved in the encrypted vault.</small></div>
            </section>

            <p className="guardian-alpha-note" role="status">
              {!sentinelStatus || sentinelStatus.status === 'LOCKED'
                ? 'Guardian is unavailable while the vault is locked.'
                : sentinelStatus.observerStatus !== 'MONITORING'
                  ? 'Saved Block policies are not actively applied while app observation is off or unavailable.'
                  : sentinelStatus.warningOnly
                    ? 'SHINPO will warn you but will not close apps in the current Focus state.'
                    : 'On Linux, a consented graceful-close request is limited to eligible, identity-verified processes. SHINPO never force-kills applications.'}
            </p>

            <section className="guardian-alpha-panel" aria-labelledby="guardian-observations-title">
              <header><div><h2 id="guardian-observations-title">Recent observations</h2><p>Observed during this Focus session</p></div><span className="guardian-alpha-count">{sentinelStatus?.guardianObservations ? observations.length : '—'}</span></header>
              {observations.length ? <ul className="guardian-alpha-observations">{observations.map((item) => <li key={item.id}>
                <span className="guardian-alpha-observation-icon"><Icon name="eye" size={16} /></span>
                <span><strong>{item.processName}</strong><small>{item.category} · {guardianOutcomeLabel(item.outcome)}</small></span>
                <time dateTime={item.observedAt}>{new Date(item.observedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              </li>)}</ul> : <p className="guardian-alpha-empty">{sentinelStatus?.observerStatus === 'DEGRADED'
                ? 'The app observer is unavailable; observations may be incomplete.'
                : sentinelStatus?.status === 'ACTIVE' && sentinelStatus.observerStatus === 'IDLE' ? 'App observation is off for this Focus session. Enable it in the Focus setup to record recognized apps.'
                  : sentinelStatus?.activeFocusSessionId ? 'No recognized distracting apps have been observed in this session.'
                    : 'Observations appear here when a Focus session is active.'}</p>}
            </section>

            <section className="guardian-alpha-panel guardian-companion-rail-card" aria-label="Web Protection & Companion">
              <header>
                <div>
                  <h2>Browser Protection</h2>
                  <p>Companion connection and web rules</p>
                </div>
                <span className="guardian-alpha-count">Web Guard</span>
              </header>
              <div style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ margin: 0, lineHeight: 1.45 }}>
                  Website restrictions require a connected Browser Companion. Web distraction policies are evaluated independently from desktop binaries.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-3)' }}>Safety guarantee:</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Zero force-kills · graceful close only</span>
                  <span style={{ color: 'var(--text-3)' }}>System processes:</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Protected OS daemons never touched</span>
                </div>
              </div>
            </section>

            <div className="guardian-mode-action-card">
              <div className="guardian-mode-action-header">
                <div className="guardian-mode-action-info">
                  <span className="guardian-mode-action-tag">Operational Mode</span>
                  <h3 className="guardian-mode-action-title">
                    {guardianMode === 'Not set' ? 'Configure Guardian Mode' : `Guardian Mode: ${guardianMode}`}
                  </h3>
                  <p className="guardian-mode-action-desc">
                    Choose how Guardian monitors and protects focus: Light (warnings only), Standard (10m allowance + cooperative close), or Strict (consented prompt on launch).
                  </p>
                </div>
                {onConfigureGuardianMode && (
                  <button
                    type="button"
                    className="btn-configure-guardian-action"
                    onClick={onConfigureGuardianMode}
                    data-testid="btn-configure-guardian"
                  >
                    <Icon name="settings" size={14} />
                    <span>Configure Guardian Mode</span>
                  </button>
                )}
              </div>
            </div>

            <section className="guardian-alpha-panel guardian-policy-explainer" aria-label="Understanding Focus Protection">
              <header>
                <div>
                  <h2>Protection Architecture</h2>
                  <p>How policies, modes, consent, and status interact</p>
                </div>
                <span className="guardian-alpha-count">Guide</span>
              </header>
              <div className="guardian-explainer-grid">
                <div className="guardian-explainer-item">
                  <strong>Application Policy</strong>
                  <p>Persistent per-app rules (Block, Allow, Off) saved in your encrypted vault. Determines which apps are subject to monitoring.</p>
                </div>
                <div className="guardian-explainer-item">
                  <strong>Guardian Mode</strong>
                  <p>Light (passive logs &amp; warnings), Standard (up to 10m sampled runtime), or Strict (consented prompt on launch).</p>
                </div>
                <div className="guardian-explainer-item">
                  <strong>Session Consent</strong>
                  <p>Explicit user opt-in required before each session. SHINPO never closes applications without your explicit session consent.</p>
                </div>
                <div className="guardian-explainer-item">
                  <strong>Runtime Status</strong>
                  <p>Real-time enforcement state: cooperative close requests only on Linux; protected OS daemons are never touched; zero force-kills.</p>
                </div>
              </div>
            </section>
          </div>

          <section className="guardian-alpha-panel guardian-installed-panel" aria-labelledby="guardian-apps-title">
            <header>
              <div>
                <h2 id="guardian-apps-title">Installed Applications</h2>
                <p>
                  {discoveredApps.length ? `${discoveredApps.length} installed apps discovered on this system` : 'Native app discovery'}
                  {blockedCount > 0 && ` · ${blockedCount} blocked`}
                  {allowedCount > 0 && ` · ${allowedCount} allowed`}
                </p>
              </div>
              <span className="guardian-alpha-count" title={`${blockedCount + allowedCount} configured policies`}>
                {blockedCount + allowedCount}
              </span>
            </header>

            <div className="guardian-app-toolbar">
              <div className="guardian-app-search-row">
                <div className="guardian-app-search-box">
                  <Icon name="search" size={14} />
                  <input
                    type="text"
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    placeholder="Search installed applications..."
                    aria-label="Search installed applications"
                  />
                  {appSearch && (
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: 0 }}
                      onClick={() => setAppSearch('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="guardian-refresh-apps-btn"
                  onClick={() => void loadDiscoveredApps()}
                  disabled={appsLoading}
                  title="Rescan installed applications and running status"
                >
                  <Icon name="refresh" size={13} />
                  <span>{appsLoading ? 'Scanning...' : 'Rescan'}</span>
                </button>
              </div>

              <div className="guardian-app-filter-tabs" role="tablist" aria-label="Filter applications">
                <button
                  type="button"
                  role="tab"
                  aria-selected={appFilter === 'ALL'}
                  className={`guardian-filter-tab ${appFilter === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setAppFilter('ALL')}
                >
                  All ({discoveredApps.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appFilter === 'BLOCKED'}
                  className={`guardian-filter-tab ${appFilter === 'BLOCKED' ? 'is-active' : ''}`}
                  onClick={() => setAppFilter('BLOCKED')}
                >
                  Blocked ({blockedCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appFilter === 'ALLOWED'}
                  className={`guardian-filter-tab ${appFilter === 'ALLOWED' ? 'is-active' : ''}`}
                  onClick={() => setAppFilter('ALLOWED')}
                >
                  Allowed ({allowedCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appFilter === 'RUNNING'}
                  className={`guardian-filter-tab ${appFilter === 'RUNNING' ? 'is-active' : ''}`}
                  onClick={() => setAppFilter('RUNNING')}
                >
                  Running ({runningCount})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={appFilter === 'UNCONFIGURED'}
                  className={`guardian-filter-tab ${appFilter === 'UNCONFIGURED' ? 'is-active' : ''}`}
                  onClick={() => setAppFilter('UNCONFIGURED')}
                >
                  Unconfigured ({unconfiguredCount})
                </button>
              </div>
            </div>

            {appsLoading && discoveredApps.length === 0 ? (
              <p className="guardian-alpha-empty">Scanning installed applications...</p>
            ) : visibleApps.length > 0 ? (
              <ul className="guardian-app-list">
                {visibleApps.map((app) => (
                  <li key={app.id} className="guardian-app-item">
                    <div className="guardian-app-item-main">
                      <span className="guardian-alpha-app-icon">
                        <Icon name={app.isRunning ? 'play' : 'apps'} size={16} />
                      </span>
                      <div className="guardian-app-item-info">
                        <div className="guardian-app-item-title">
                          <strong>{app.name}</strong>
                          <div className="guardian-app-badges">
                            <span className={`guardian-app-badge ${app.isRunning ? 'badge-running' : 'badge-idle'}`}>
                              {app.isRunning ? '● Running' : 'Idle'}
                            </span>
                            <span className={`guardian-app-badge ${app.enforcementCapability === 'TERMINATE' ? 'badge-enforceable' : 'badge-unsupported'}`} title={app.unsupportedReason || undefined}>
                              {app.enforcementCapability === 'TERMINATE' ? 'Recognized executable' : app.unsupportedReason?.includes('Protected') ? 'Protected system app' : 'Unsupported'}
                            </span>
                          </div>
                        </div>
                        <div className="guardian-app-meta">
                          <code>{app.execName || 'unresolved'}</code>
                          <span>·</span>
                          <span>{app.source}</span>
                        </div>
                      </div>
                    </div>

                    {app.enforcementCapability === 'UNSUPPORTED' ? (
                      <span className="guardian-app-protected-label">Protected system</span>
                    ) : (
                      <div className="guardian-policy-segmented" role="group" aria-label={`Focus policy for ${app.name}`}>
                        <button
                          type="button"
                          className={`segmented-btn btn-block ${app.policy === 'BLOCKED' ? 'is-active' : ''}`}
                          onClick={() => handleSetAppPolicy(app, app.policy === 'BLOCKED' ? 'NONE' : 'BLOCKED')}
                          title={app.policy === 'BLOCKED' ? 'Remove saved block policy' : 'Save a block policy for Focus; it applies only while observation is enabled'}
                        >
                          Block
                        </button>
                        <button
                          type="button"
                          className={`segmented-btn btn-allow ${app.policy === 'ALLOWED' ? 'is-active' : ''}`}
                          onClick={() => handleSetAppPolicy(app, app.policy === 'ALLOWED' ? 'NONE' : 'ALLOWED')}
                          title={app.policy === 'ALLOWED' ? 'Click to remove allow' : 'Explicitly allow this application during Focus'}
                        >
                          Allow
                        </button>
                        <button
                          type="button"
                          className={`segmented-btn btn-none ${app.policy === 'NONE' ? 'is-active' : ''}`}
                          onClick={() => handleSetAppPolicy(app, 'NONE')}
                          title="No policy (default)"
                        >
                          Off
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="guardian-alpha-empty">
                {appSearch
                  ? 'No installed applications match the search query.'
                  : showBuiltinCatalog
                    ? 'No local applications match this filter. Showing default distraction catalog below for reference.'
                    : 'No applications found in this filter category.'}
              </p>
            )}

            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-2)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: 0,
                }}
                onClick={() => setShowBuiltinCatalog((prev) => !prev)}
              >
                <span style={{ transform: showBuiltinCatalog ? 'rotate(180deg)' : 'none', display: 'inline-flex', transition: 'transform 0.15s ease' }}>
                  <Icon name="chevron" size={12} />
                </span>
                <span>{showBuiltinCatalog ? 'Hide default distraction catalog' : `View default distraction catalog (${catalog.length} apps)`}</span>
              </button>
              {showBuiltinCatalog && (
                <ul className="guardian-alpha-catalog" style={{ marginTop: 8 }}>
                  {catalog.map((entry) => (
                    <li key={entry.processName}>
                      <span className="guardian-alpha-app-icon"><Icon name="apps" size={16} /></span>
                      <span><strong>{entry.processName}</strong><small>{entry.rationale}</small></span>
                      <span className="guardian-alpha-category">{entry.category}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
        )}

        {activeSubTab === 'guardian' && (
          <p className="guardian-alpha-note">Website restrictions require a connected Browser Companion. Its connection and policy status are managed separately.</p>
        )}
      </div>
    )
  }

  return (
    <div className="task-manager-view">
      {localVaultMode && <p role="status" className="tm-local-limit-note">
        Guardian records recognized app observations in your encrypted vault during Focus. Application rules and verified app closure are not available in local mode.
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
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">{localVaultMode ? 'BUILT-IN PROCESS CATALOG' : 'SAVED RULES'}</span><strong className="tm-metric-val">{localVaultMode ? sentinelStatus?.guardianApplicationCatalog?.length ?? 0 : sentinelStatus?.activePolicyRulesCount ?? sentinelRules.length}</strong><small className="tm-metric-sub">{localVaultMode ? `${sentinelStatus?.guardianAppCatalogVersion ?? 'Catalog version unavailable'} · recognized process names` : enforcementAvailable ? 'Available to the connected Shield' : 'Saved rules are not currently enforced'}</small></span>
        </article>
        <article className="tm-metric-card">
          <span className="tm-metric-icon"><Icon name="close" size={21} /></span>
          <span className="tm-reference-metric-copy"><span className="tm-metric-label">{localVaultMode ? 'APP OBSERVATIONS TODAY' : 'APP WARNINGS TODAY'}</span><strong className="tm-metric-val">{localVaultMode ? sentinelStatus?.guardianWarningCount ?? '—' : sentinelStatus?.totalInterceptedToday ?? 0}</strong><small className="tm-metric-sub">{localVaultMode ? 'Encrypted observation and outcome history' : 'Reported by Focus Protection'}</small></span>
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
        {!localVaultMode && <>
          <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">SERVER HOST CPU</span><span className="tm-metric-icon"><Icon name="focus" size={17} /></span></div><div><strong className="tm-metric-val">{deviceSnapshot?.systemInfo?.systemCpuLoad == null ? 'Unavailable' : `${deviceSnapshot.systemInfo.systemCpuLoad.toFixed(1)}%`}</strong><small className="tm-metric-sub">{deviceSnapshot?.systemInfo?.availableProcessors ?? 'Unavailable'} hardware threads</small></div></article>
          <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">SERVER HOST MEMORY</span><span className="tm-metric-icon"><Icon name="apps" size={17} /></span></div><div><strong className="tm-metric-val">{deviceSnapshot?.systemInfo?.totalMemoryBytes != null ? `${((deviceSnapshot.systemInfo.totalMemoryBytes - (deviceSnapshot.systemInfo.freeMemoryBytes ?? 0)) / (1024 ** 3)).toFixed(1)} GB` : 'Unavailable'}</strong><small className="tm-metric-sub">{deviceSnapshot?.systemInfo?.totalMemoryBytes != null ? `of ${(deviceSnapshot.systemInfo.totalMemoryBytes / (1024 ** 3)).toFixed(1)} GB physical RAM` : 'Host telemetry is unavailable.'}</small></div></article>
          <article className="tm-metric-card"><div className="tm-metric-top"><span className="tm-metric-label">SERVER PROCESS SCAN</span><span className="tm-metric-icon"><Icon name="journal" size={17} /></span></div><strong className="tm-metric-val">{deviceSnapshot?.systemInfo?.processCount ?? 'Unavailable'}</strong><small className="tm-metric-sub">{deviceSnapshot?.systemInfo?.processCount == null ? 'Server process scanning is disabled' : `${deviceSnapshot?.processes?.length ?? 0} server-host processes · read only`}</small></article>
        </>}
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

      {!localVaultMode && <div className="tm-controls-card tm-controls-toolbar" role="group" aria-label="Focus protection controls">
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
          <button type="button" className="emergency-override-btn microkit-danger-invert" disabled={localVaultMode || !protectionInfo.shieldConnected} title={localVaultMode ? 'Emergency override is unavailable in local mode' : !protectionInfo.shieldConnected ? 'Unavailable while desktop protection is disconnected' : 'Advanced action: requires administrator credentials and a reason'} onClick={() => { setOverrideError(null); setShowOverrideModal(true); setShowAddRuleModal(false) }}><Icon name="shield" size={14} /><span>Emergency override</span></button>
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
      </div>}

      <section className="protection-overview-panel" aria-labelledby="protection-overview-title">
        <header><span className="protection-shield-emblem"><Icon name="shield-check" size={18} /></span><div><h2 id="protection-overview-title">Protection overview</h2><p>Native application protection and current policy state.</p></div>{localVaultMode ? <span className="protection-live-state is-monitoring"><i aria-hidden="true" />{protectionInfo.badgeText} · {protectionInfo.mode}</span> : <button type="button" className="protection-mode-control" onClick={handleToggleSentinelMode} title={sentinelStatus?.isPolicyLocked ? 'Protection is locked during this Focus session. Request an emergency override to change mode.' : 'Change protection mode'}><span className={`protection-live-state ${protectionInfo.shieldConnected && !monitoringOnly ? 'is-active' : protectionInfo.shieldConnected ? 'is-monitoring' : 'is-offline'}`}><i aria-hidden="true" />{protectionInfo.shieldConnected ? monitoringOnly ? 'Monitoring only' : 'Shield online' : 'Shield offline'}</span><span>{protectionInfo.mode} <Icon name="chevron" size={13} /></span></button>}</header>
        <div className="protection-overview-stats">
          <div><span>{localVaultMode ? 'Built-in process catalog' : 'Saved application rules'}</span><strong>{localVaultMode ? sentinelStatus?.guardianApplicationCatalog?.length ?? 0 : sentinelStatus?.activePolicyRulesCount ?? sentinelRules.length}</strong><small>{localVaultMode ? `${sentinelStatus?.guardianAppCatalogVersion ?? 'Version unavailable'} · recognized process names, not installed apps` : enforcementAvailable ? 'Available to the connected native Shield' : 'Saved policies are not proof of active enforcement'}</small></div>
          <div><span>{localVaultMode ? 'App observations today' : 'Applications intercepted'}</span><strong>{localVaultMode ? sentinelStatus?.guardianWarningCount ?? '—' : sentinelStatus?.totalInterceptedToday ?? 0}</strong><small>{localVaultMode ? 'Encrypted process observations' : 'Reported today by the protection service'}</small></div>
          <div><span>Protection mode</span><strong>{localVaultMode ? guardianModeLabel(sentinelStatus?.guardianMode) : protectionInfo.mode}</strong><small>{localVaultMode ? guardianCapabilityLabel(sentinelStatus?.interventionCapability) : sentinelStatus?.isPolicyLocked ? 'Locked during the active Focus session' : 'Select Emergency Override to request a protected change'}</small></div>
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
                  ? `Version ${sentinelStatus?.guardianAppCatalogVersion ?? 'unavailable'} · these process names may be observed during Focus. This is not an installed-app inventory or selectable app list. ${guardianInterventionDescription(sentinelStatus?.interventionCapability)}`
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
                    className={`sentinel-tamper-badge-count ${safeTamperEvents.length === 0 ? 'neutral' : 'alert'
                      }`}
                  >
                    {safeTamperEvents.length === 0
                      ? '0 Events Logged'
                      : `${safeTamperEvents.length} Event${safeTamperEvents.length > 1 ? 's' : ''}`}
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
                  ) : safeTamperEvents.length === 0 ? (
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
                    safeTamperEvents.map((evt) => (
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

      {!localVaultMode && <details className="tm-advanced-processes" open>
        <summary><span>{localVaultMode ? 'Local process snapshot' : 'Server process snapshot'}</span><small>{localVaultMode ? 'Native process inventory is not yet integrated' : 'Read-only process data from the SHINPO server host'}</small></summary>
        <div className="tm-table-card">
          <div className="tm-table-header">
            <div>
              <h3 className="tm-table-title">{localVaultMode ? 'Local process snapshot' : 'Backend-host process snapshot'}</h3>
              <span className="tm-table-count">
                {deviceSnapshot?.processes ? `Showing ${deviceSnapshot.processes.length} ${localVaultMode ? 'local' : 'server-host'} processes · read-only` : localVaultMode ? 'Local process inventory unavailable' : 'Server process snapshot unavailable'}
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
                {deviceSnapshot?.processes && deviceSnapshot.processes.length > 0 ? (
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
                      {tmLoading ? 'Enumerating device processes...' : deviceSnapshot === null ? <span role="status">Process inventory could not be loaded. Use Refresh Processes to retry.</span> : 'No matching processes found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>}
    </div>
  )
}
