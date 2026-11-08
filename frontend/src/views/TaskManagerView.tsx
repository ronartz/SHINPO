import React, { useState, useEffect, useCallback } from 'react'
import type {
  ProcessSnapshot,
  SentinelStatus,
  PolicyRule,
  SentinelTamperEventItem,
  DiscoveredApp,
  SystemTelemetry,
} from '../api/device'
import {
  fetchDiscoveredApps,
  saveGuardianAppPolicy,
  removeGuardianAppPolicy,
  fetchLocalSystemTelemetry,
} from '../api/device'
import { Icon } from '../components/common/Icon'
import { guardianCanRequestClose, guardianCapabilityLabel, guardianInterventionDescription, guardianModeLabel, guardianOutcomeLabel } from '../utils/guardianCapability'

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
  isAurora: _isAurora = false,
  localVaultMode = false,
  deviceSnapshot,
  tmLoading: _tmLoading,
  tmSearch,
  setTmSearch,
  tmPolicy,
  setTmPolicy,
  setTmRefreshKey: _setTmRefreshKey,
  sentinelStatus,
  setSentinelStatus: _setSentinelStatus,
  sentinelRules: _sentinelRules,
  setSentinelRules: _setSentinelRules,
  tamperEvents: _tamperEvents,
  setTamperEvents: _setTamperEvents,
  tamperEventsExpanded: _tamperEventsExpanded,
  setTamperEventsExpanded: _setTamperEventsExpanded,
  tamperEventsLoading: _tamperEventsLoading,
  loadDeviceProcesses,
  loadSentinelTamperEvents: _loadSentinelTamperEvents,
  tmToast,
  setTmToast,
  onOpenCompanionSettings,
  onConfigureGuardianMode,
}) => {
  trackRender('TaskManagerView')
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
                      : 'Guardian is warning-only in this release. SHINPO does not close applications.'}
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
                    <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Warning-only · no apps are closed</span>
                    <span style={{ color: 'var(--text-3)' }}>System processes:</span>
                    <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>Protected OS daemons never touched</span>
                  </div>
                  {onOpenCompanionSettings && (
                    <button
                      type="button"
                      className="btn-guardian-action"
                      onClick={onOpenCompanionSettings}
                      style={{ marginTop: 8, alignSelf: 'flex-start' }}
                      data-testid="btn-companion-settings"
                    >
                      <Icon name="settings" size={14} /> Browser Companion Setup
                    </button>
                  )}
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
                      Choose how Guardian reports recognized apps: Light (warnings), Standard (consented sampled runtime), or Strict (immediate warnings). Apps are not closed.
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
                    <p>Light shows warnings. Standard may sample app-running time with consent. Strict shows immediate warnings. All modes are warning-only.</p>
                  </div>
                  <div className="guardian-explainer-item">
                    <strong>Session Consent</strong>
                    <p>Explicit user opt-in required before each session. SHINPO never closes applications without your explicit session consent.</p>
                  </div>
                  <div className="guardian-explainer-item">
                    <strong>Runtime Status</strong>
                    <p>Current behavior: warning-only. App closure is disabled; protected OS processes are not touched.</p>
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
                              <span className={`guardian-app-badge ${app.enforcementCapability === 'TERMINATE' ? 'badge-idle' : 'badge-unsupported'}`} title={app.unsupportedReason || undefined}>
                                {app.enforcementCapability === 'TERMINATE' ? 'Eligible — warning only' : app.unsupportedReason?.includes('Protected') ? 'Protected system app' : 'Unsupported'}
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
                <div className="guardian-alpha-empty-banner">
                  <p className="guardian-alpha-empty">
                    {appSearch
                      ? 'No installed applications match the search query.'
                      : discoveredApps.length === 0
                        ? 'No local desktop shortcuts discovered. Distraction policies can be referenced from the catalog below.'
                        : 'No applications found in this filter category.'}
                  </p>
                </div>
              )}

              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
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
                  <ul className="guardian-alpha-catalog" style={{ marginTop: 10 }}>
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
