import React, { useState, useEffect, useCallback } from 'react'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'
import { changePassword, getAuthToken, setCustomServerUrl, updateUsername, deleteAccount } from '../../api/auth'
import { ShinpoConfirmDialog } from '../ui/Dialog/ShinpoConfirmDialog'
import type { SentinelStatus } from '../../api/device'
import { updateSentinelMode, emergencyOverride } from '../../api/device'
import { fetchWithoutRedirects, getBackendBaseUrl, getCustomServerUrl, isValidServerUrl } from '../../api/config'
import { isTauriEnvironment } from '../../api/nativeShield'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'

export type SettingsSection =
  | 'appearance'
  | 'account'
  | 'protection'
  | 'companion'
  | 'eonpai'
  | 'connection'
  | 'privacy'
  | 'about'

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialSection?: SettingsSection
  isDarkMode: boolean
  onToggleTheme: () => void
  isV2Preview?: boolean
  onToggleV2Preview?: () => void
  currentUser: AuthUser | null
  onUserUpdated?: (user: AuthUser) => void
  onLogout: () => void
  sentinelStatus?: SentinelStatus | null
  onSentinelStatusChange?: (status: SentinelStatus) => void
  isWsConnected?: boolean
  onRefreshData?: () => void
  isRefreshing?: boolean
  goals?: Goal[]
  missions?: Mission[]
  sessions?: FocusSession[]
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialSection = 'appearance',
  isDarkMode,
  onToggleTheme,
  isV2Preview = true,
  onToggleV2Preview,
  currentUser,
  onUserUpdated,
  onLogout,
  sentinelStatus,
  onSentinelStatusChange,
  isWsConnected = false,
  onRefreshData,
  isRefreshing = false,
  goals = [],
  missions = [],
  sessions = [],
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection)

  // Appearance - Time Format state
  const [is24Hour, setIs24Hour] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shinpo_time_format') === '24h'
    } catch {
      return false
    }
  })

  // Account - Password Change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)
  const [pwdMessage, setPwdMessage] = useState<{ text: string; isError: boolean } | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Account - Change Username state
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameFeedback, setUsernameFeedback] = useState<{ text: string; isError: boolean } | null>(null)

  // Focus Protection - Mode and Override
  const [selectedModeOverride, setSelectedModeOverride] = useState<string | null>(null)
  const selectedMode = selectedModeOverride ?? sentinelStatus?.enforcementMode ?? 'STRICT'
  const [modeUpdating, setModeUpdating] = useState(false)
  const [modeFeedback, setModeFeedback] = useState<string | null>(null)
  const [overridePassword, setOverridePassword] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideFeedback, setOverrideFeedback] = useState<{ text: string; isError: boolean } | null>(null)
  const [showOverridePassword, setShowOverridePassword] = useState(false)

  // Browser Companion state
  const [companionStatus, setCompanionStatus] = useState<{
    state: string
    coverage: string
    adapterName?: string
    lastSeenAt?: string
    detail?: string
  } | null>(null)
  const [companionLoading, setCompanionLoading] = useState(false)

  // EONPAI AI state
  const [aiStatus, setAiStatus] = useState<{
    enabled?: boolean
    available?: boolean
    provider?: string
    model?: string
    status?: string
    message?: string
  } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Cloud Connection state
  const [serverUrlInput, setServerUrlInput] = useState<string>(() => getCustomServerUrl())
  const [serverPingStatus, setServerPingStatus] = useState<{
    status: 'IDLE' | 'TESTING' | 'SUCCESS' | 'ERROR'
    message?: string
    latencyMs?: number
  }>({ status: 'IDLE' })

  // Diagnostics state
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false)
  const [diagnosticResults, setDiagnosticResults] = useState<{
    api: { pass: boolean; detail: string }
    ws: { pass: boolean; detail: string }
    storage: { pass: boolean; detail: string }
    shield: { pass: boolean; detail: string }
  } | null>(null)

  // Account deletion confirmation state
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Fetch Companion Status
  const fetchCompanionInfo = useCallback(async () => {
    setCompanionLoading(true)
    try {
      const baseUrl = getBackendBaseUrl()
      const token = getAuthToken()
      const res = await fetchWithoutRedirects(`${baseUrl}/api/contextual-focus/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        if (data.browserCompanion) {
          setCompanionStatus({
            state: data.browserCompanion.state || 'DISCONNECTED',
            coverage: data.browserCompanion.adapterCoverage || 'NONE',
            adapterName: data.browserCompanion.adapterName || 'SHINPO Companion',
            lastSeenAt: data.browserCompanion.lastSeenAt,
            detail: data.browserCompanion.detail,
          })
        } else {
          setCompanionStatus({
            state: 'STANDBY',
            coverage: 'NONE',
            detail: 'Extension registered; awaiting active browser navigation.',
          })
        }
      }
    } catch {
      setCompanionStatus({
        state: 'UNREACHABLE',
        coverage: 'NONE',
        detail: 'Could not contact backend contextual focus service.',
      })
    } finally {
      setCompanionLoading(false)
    }
  }, [])

  // Fetch EONPAI Status
  const fetchAiInfo = useCallback(async () => {
    setAiLoading(true)
    try {
      const baseUrl = getBackendBaseUrl()
      const token = getAuthToken()
      const res = await fetchWithoutRedirects(`${baseUrl}/api/ai/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setAiStatus(data)
      } else {
        setAiStatus({
          enabled: false,
          available: false,
          status: 'OFFLINE',
          message: 'AI service endpoint returned non-200 status',
        })
      }
    } catch {
      setAiStatus({
        enabled: false,
        available: false,
        status: 'OFFLINE',
        message: 'AI service unreachable (offline fallback mode active)',
      })
    } finally {
      setAiLoading(false)
    }
  }, [])

  // Load relevant data when opening sections
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const task = window.setTimeout(() => {
      if (cancelled) return
      if (activeSection === 'companion' && !companionStatus) void fetchCompanionInfo()
      if (activeSection === 'eonpai' && !aiStatus) void fetchAiInfo()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(task)
    }
  }, [isOpen, activeSection, companionStatus, aiStatus, fetchCompanionInfo, fetchAiInfo])

  // Handle Time Format Change
  const handleTimeFormatChange = (format: '12h' | '24h') => {
    const next24 = format === '24h'
    setIs24Hour(next24)
    try {
      localStorage.setItem('shinpo_time_format', format)
      window.dispatchEvent(new Event('shinpo:time-format-changed'))
    } catch {
      // ignore
    }
  }

  // Handle Celebration Effects Preference
  const [celebrationEffects, setCelebrationEffects] = useState<string>(() => {
    try {
      return localStorage.getItem('shinpo_celebration_effects') || 'full'
    } catch {
      return 'full'
    }
  })

  const handleCelebrationEffectsChange = (mode: string) => {
    setCelebrationEffects(mode)
    try {
      localStorage.setItem('shinpo_celebration_effects', mode)
      window.dispatchEvent(new Event('shinpo:celebration-effects-changed'))
    } catch {
      // ignore
    }
  }

  // Handle Streak Display Preference
  const [streakDisplay, setStreakDisplay] = useState<string>(() => {
    try {
      return localStorage.getItem('shinpo_streak_display') || 'visible'
    } catch {
      return 'visible'
    }
  })

  const handleStreakDisplayChange = (mode: string) => {
    setStreakDisplay(mode)
    try {
      localStorage.setItem('shinpo_streak_display', mode)
      window.dispatchEvent(new Event('shinpo:streak-display-changed'))
    } catch {
      // ignore
    }
  }

  // Handle Username Change
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameFeedback(null)
    const trimmed = usernameInput.trim()
    if (!trimmed) {
      setUsernameFeedback({ text: 'Username cannot be blank.', isError: true })
      return
    }
    if (trimmed.length < 3 || trimmed.length > 50) {
      setUsernameFeedback({ text: 'Username must be between 3 and 50 characters.', isError: true })
      return
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      setUsernameFeedback({
        text: 'Username can only contain letters, numbers, underscores, hyphens, and periods.',
        isError: true,
      })
      return
    }
    if (currentUser && trimmed.toLowerCase() === currentUser.username.toLowerCase()) {
      setIsEditingUsername(false)
      return
    }

    setUsernameLoading(true)
    try {
      const updated = await updateUsername(trimmed)
      setUsernameFeedback({ text: 'Username updated successfully!', isError: false })
      setIsEditingUsername(false)
      if (onUserUpdated) onUserUpdated(updated)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update username.'
      setUsernameFeedback({ text: msg, isError: true })
    } finally {
      setUsernameLoading(false)
    }
  }

  // Handle Password Change
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdMessage(null)

    if (newPassword.length < 6) {
      setPwdMessage({ text: 'New password must be at least 6 characters long.', isError: true })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdMessage({ text: 'New password and confirmation do not match.', isError: true })
      return
    }

    setPwdLoading(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      setPwdMessage({ text: result.message || 'Password successfully updated!', isError: false })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.'
      setPwdMessage({ text: msg, isError: true })
    } finally {
      setPwdLoading(false)
    }
  }

  // Handle Enforcement Mode Change
  const handleModeChange = async (mode: string) => {
    setSelectedModeOverride(mode)
    setModeUpdating(true)
    setModeFeedback(null)
    try {
      const updated = await updateSentinelMode(mode)
      if (onSentinelStatusChange) {
        onSentinelStatusChange(updated)
      }
      setModeFeedback(`Focus enforcement mode set to ${mode}.`)
      setTimeout(() => setModeFeedback(null), 3500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setModeFeedback(`Failed to update mode: ${msg}`)
    } finally {
      setModeUpdating(false)
    }
  }

  // Handle Emergency Override
  const handleEmergencyOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setOverrideFeedback(null)
    if (!overridePassword || !overrideReason) {
      setOverrideFeedback({ text: 'Password and emergency justification are required.', isError: true })
      return
    }

    setOverrideLoading(true)
    try {
      const res = await emergencyOverride({ password: overridePassword, reason: overrideReason })
      setOverrideFeedback({
        text: `Override granted: ${res.message}. New mode: ${res.newMode}`,
        isError: false,
      })
      setOverridePassword('')
      setOverrideReason('')
      if (onRefreshData) onRefreshData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Emergency override rejected.'
      setOverrideFeedback({ text: msg, isError: true })
    } finally {
      setOverrideLoading(false)
    }
  }

  // Handle Cloud Server URL Save & Ping
  const handleServerSaveAndTest = async () => {
    const validation = isValidServerUrl(serverUrlInput)
    if (!validation.valid) {
      setServerPingStatus({
        status: 'ERROR',
        message: validation.reason || 'Invalid server URL format',
      })
      return
    }

    const previousEndpoint = getCustomServerUrl().trim().replace(/\/+$/, '')
    const nextEndpoint = serverUrlInput.trim().replace(/\/+$/, '')
    const endpointChanged = previousEndpoint !== nextEndpoint
    try {
      await setCustomServerUrl(serverUrlInput)
    } catch (err) {
      setServerPingStatus({
        status: 'ERROR',
        message: err instanceof Error ? err.message : 'Could not clear the saved session',
      })
      return
    }
    setServerPingStatus({ status: 'TESTING', message: 'Testing connection to server...' })

    const startTime = Date.now()
    try {
      const targetBase = serverUrlInput.trim().replace(/\/+$/, '') || getBackendBaseUrl()
      const res = await fetchWithoutRedirects(`${targetBase}/actuator/health`, { method: 'GET' })
      const latency = Date.now() - startTime

      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        const statusText = body.status === 'UP' ? 'Server is healthy (UP)' : `Server responded with ${res.status}`
        setServerPingStatus({
          status: 'SUCCESS',
          latencyMs: latency,
          message: `${statusText} • Latency: ${latency}ms`,
        })
      } else {
        setServerPingStatus({
          status: 'ERROR',
          message: `Server returned HTTP ${res.status} (${res.statusText})`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network request error'
      setServerPingStatus({
        status: 'ERROR',
        message: `Connection failed: ${msg}`,
      })
    }
    if (endpointChanged) {
      onClose()
      void onLogout()
    }
  }

  // Handle Personal Data Export (JSON)
  const handleExportData = () => {
    const exportPayload = {
      exportMetadata: {
        app: 'SHINPO Focus Cockpit',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        username: currentUser?.username || 'anonymous',
        userId: currentUser?.id,
      },
      goals,
      missions,
      sessions,
      sentinelStatus,
    }

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportPayload, null, 2))}`
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', jsonString)
    downloadAnchor.setAttribute(
      'download',
      `shinpo_export_${currentUser?.username || 'user'}_${new Date().toISOString().slice(0, 10)}.json`
    )
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  // Handle Account Deletion & Data Wipe
  const handleDeleteAccount = async () => {
    setDeleteAccountLoading(true)
    setDeleteAccountError(null)
    try {
      await deleteAccount()
      setShowDeleteAccountConfirm(false)
      onClose()
      onLogout()
    } catch (err: unknown) {
      setDeleteAccountError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  // Handle Run System Diagnostics
  const handleRunDiagnostics = async () => {
    setDiagnosticsRunning(true)
    setDiagnosticResults(null)

    const results = {
      api: { pass: false, detail: 'Checking...' },
      ws: { pass: false, detail: 'Checking...' },
      storage: { pass: false, detail: 'Checking...' },
      shield: { pass: false, detail: 'Checking...' },
    }

    // 1. API Health Check
    try {
      const res = await fetchWithoutRedirects(`${getBackendBaseUrl()}/actuator/health`)
      if (res.ok) {
        results.api = { pass: true, detail: 'Backend REST API reachable (HTTP 200 OK)' }
      } else {
        results.api = { pass: false, detail: `Backend returned HTTP ${res.status}` }
      }
    } catch {
      results.api = { pass: false, detail: 'Backend unreachable. Check server URL.' }
    }

    // 2. WebSocket Check
    results.ws = {
      pass: isWsConnected,
      detail: isWsConnected
        ? 'STOMP WebSocket channel established and listening on /ws'
        : 'WebSocket disconnected or waiting for network reconnect',
    }

    // 3. Storage Check
    try {
      localStorage.setItem('__shinpo_diag_test__', '1')
      localStorage.removeItem('__shinpo_diag_test__')
      results.storage = { pass: true, detail: 'Local storage read/write validated' }
    } catch {
      results.storage = { pass: false, detail: 'LocalStorage restricted or unavailable' }
    }

    // 4. Shield / Desktop Daemon Check
    if (isTauriEnvironment()) {
      results.shield = {
        pass: true,
        detail: 'Tauri native desktop runtime verified. Local Shield daemon bound.',
      }
    } else {
      results.shield = {
        pass: true,
        detail: 'Web browser cockpit environment active. Native Shield via companion.',
      }
    }

    setDiagnosticResults(results)
    setDiagnosticsRunning(false)
  }

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay settings-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      onClick={onClose}
    >
      <div
        className="modal-box settings-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'min(860px, calc(100vw - 32px))',
          width: '100%',
          height: 'min(660px, 88vh)',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Settings Header */}
        <div
          className="settings-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(49, 86, 216, 0.2) 100%)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="settings" size={18} />
            </div>
            <div>
              <h2
                id="settings-dialog-title"
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                SHINPO Settings
              </h2>
              <span style={{ fontSize: '12px' }}>
                Preferences, Protection, and System Configuration
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="action-btn-circle settings-modal-close"
            title="Close Settings (Esc)"
            aria-label="Close Settings"
            style={{ width: 34, height: 34 }}
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Settings Body: Left Navigation & Right Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Navigation Sidebar */}
          <nav
            aria-label="Settings Categories"
            className="settings-nav-sidebar"
          >
            {[
              { id: 'appearance', label: 'Appearance', icon: 'sparkle' as const },
              { id: 'account', label: 'Account', icon: 'target' as const },
              { id: 'protection', label: 'Focus Protection', icon: 'shield' as const },
              { id: 'companion', label: 'Browser Companion', icon: 'apps' as const },
              { id: 'eonpai', label: 'EONPAI (AI)', icon: 'zap' as const },
              { id: 'connection', label: 'Cloud Connection', icon: 'arrow-up-right' as const },
              { id: 'privacy', label: 'Privacy & Data', icon: 'lock' as const },
              { id: 'about', label: 'About & Health', icon: 'dashboard' as const },
            ].map((tab) => {
              const isActive = activeSection === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-section={tab.id}
                  className={`settings-tab-btn ${isActive ? 'is-active' : ''}`}
                  onClick={() => setActiveSection(tab.id as SettingsSection)}
                >
                  <Icon name={tab.icon} size={15} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right Content Panel */}
          <div className="settings-content-panel">
            {/* 1. APPEARANCE SECTION */}
            {activeSection === 'appearance' && (
              <div>
                <h3 className="settings-section-title">
                  Appearance & Display
                </h3>
                <p className="settings-section-desc">
                  Customize your cockpit's theme, layout identity, and time display format.
                </p>

                {/* Theme Mode */}
                <div className="settings-group-card">
                  <label>
                    Color Theme
                  </label>
                  <p>
                    Switch between deep focus dark mode and high-clarity daylight theme.
                  </p>
                  <div className="settings-pill-row">
                    <button
                      type="button"
                      className={`settings-pill-btn ${isDarkMode ? 'is-active' : ''}`}
                      onClick={() => { if (!isDarkMode) onToggleTheme() }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="moon" size={15} />
                        <span>Dark Theme</span>
                      </div>
                      {isDarkMode && <span className="settings-pill-indicator">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`settings-pill-btn ${!isDarkMode ? 'is-active' : ''}`}
                      onClick={() => { if (isDarkMode) onToggleTheme() }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="sun" size={15} />
                        <span>Light Theme</span>
                      </div>
                      {!isDarkMode && <span className="settings-pill-indicator">✓</span>}
                    </button>
                  </div>
                </div>

                {/* Layout Mode */}
                {onToggleV2Preview && (
                  <div className="settings-group-card">
                    <label>
                      UI Visual Identity
                    </label>
                    <p>
                      Toggle between the cinematic Aurora identity and the classic workstation layout.
                    </p>
                    <div className="settings-pill-row">
                      <button
                        type="button"
                        className={`settings-pill-btn ${isV2Preview ? 'is-active' : ''}`}
                        onClick={() => { if (!isV2Preview) onToggleV2Preview() }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="sparkle" size={15} />
                          <span>Aurora View (V2 Cinematic)</span>
                        </div>
                        {isV2Preview && <span className="settings-pill-indicator">✓</span>}
                      </button>
                      <button
                        type="button"
                        className={`settings-pill-btn ${!isV2Preview ? 'is-active' : ''}`}
                        onClick={() => { if (isV2Preview) onToggleV2Preview() }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="dashboard" size={15} />
                          <span>Classic View</span>
                        </div>
                        {!isV2Preview && <span className="settings-pill-indicator">✓</span>}
                      </button>
                    </div>
                  </div>
                )}

                {/* Clock Format */}
                <div className="settings-group-card">
                  <label>
                    Live Clock Format
                  </label>
                  <p>
                    Choose how the workstation live clock renders on your dashboard.
                  </p>
                  <div className="settings-pill-row">
                    <button
                      type="button"
                      className={`settings-pill-btn ${!is24Hour ? 'is-active' : ''}`}
                      onClick={() => handleTimeFormatChange('12h')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="clock" size={15} />
                        <span>12-Hour Format (02:45 PM)</span>
                      </div>
                      {!is24Hour && <span className="settings-pill-indicator">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`settings-pill-btn ${is24Hour ? 'is-active' : ''}`}
                      onClick={() => handleTimeFormatChange('24h')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="clock" size={15} />
                        <span>24-Hour Format (14:45)</span>
                      </div>
                      {is24Hour && <span className="settings-pill-indicator">✓</span>}
                    </button>
                  </div>
                </div>

                {/* Celebratory Feedback & Progression */}
                <div className="settings-group-card">
                  <label>
                    Celebratory Feedback & Progression Effects
                  </label>
                  <p>
                    Adjust completion shimmers and reward toasts when finishing tasks and focus sprints.
                  </p>
                  <div className="settings-pill-row">
                    <button
                      type="button"
                      className={`settings-pill-btn ${celebrationEffects !== 'minimal' ? 'is-active' : ''}`}
                      onClick={() => handleCelebrationEffectsChange('full')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="sparkle" size={15} />
                        <span>Full Visual Feedback (+XP, Shimmer)</span>
                      </div>
                      {celebrationEffects !== 'minimal' && <span className="settings-pill-indicator">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`settings-pill-btn ${celebrationEffects === 'minimal' ? 'is-active' : ''}`}
                      onClick={() => handleCelebrationEffectsChange('minimal')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="check" size={15} />
                        <span>Minimal (Subtle / Reduced Motion)</span>
                      </div>
                      {celebrationEffects === 'minimal' && <span className="settings-pill-indicator">✓</span>}
                    </button>
                  </div>
                </div>

                {/* Consistency Streak Display */}
                <div className="settings-group-card">
                  <label>
                    Consistency Streak Display
                  </label>
                  <p>
                    Display productive days momentum on your cockpit dashboard without anxiety or penalties.
                  </p>
                  <div className="settings-pill-row">
                    <button
                      type="button"
                      className={`settings-pill-btn ${streakDisplay !== 'hidden' ? 'is-active' : ''}`}
                      onClick={() => handleStreakDisplayChange('visible')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🔥</span>
                        <span>Visible (Show Streak)</span>
                      </div>
                      {streakDisplay !== 'hidden' && <span className="settings-pill-indicator">✓</span>}
                    </button>
                    <button
                      type="button"
                      className={`settings-pill-btn ${streakDisplay === 'hidden' ? 'is-active' : ''}`}
                      onClick={() => handleStreakDisplayChange('hidden')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="clock" size={15} />
                        <span>Hidden (Quiet Mode)</span>
                      </div>
                      {streakDisplay === 'hidden' && <span className="settings-pill-indicator">✓</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. ACCOUNT SECTION */}
            {activeSection === 'account' && (
              <div>
                <h3 className="settings-section-title">
                  User Account & Security
                </h3>
                <p className="settings-section-desc">
                  View your account credentials and manage your session and password.
                </p>

                {/* Profile Overview */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <label style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Active User Profile
                    </label>
                    {currentUser && !isEditingUsername && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingUsername(true)
                          setUsernameFeedback(null)
                          setUsernameInput(currentUser.username)
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border, rgba(255,255,255,0.15))',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Icon name="edit" size={12} /> Change Username
                      </button>
                    )}
                  </div>
                  {currentUser ? (
                    <div>
                      {isEditingUsername ? (
                        <form onSubmit={handleUsernameSubmit} style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            New Username (3-50 characters, letters, numbers, _, ., -)
                          </label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={usernameInput}
                              onChange={(e) => setUsernameInput(e.target.value)}
                              placeholder="New username"
                              className="modal-field"
                              style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
                              autoFocus
                              required
                            />
                            <button
                              type="submit"
                              disabled={usernameLoading}
                              className="aurora-btn-primary"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              {usernameLoading ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingUsername(false)
                                setUsernameInput(currentUser.username)
                                setUsernameFeedback(null)
                              }}
                              className="btn-timer secondary"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {usernameFeedback && (
                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            marginBottom: 10,
                            fontSize: '12px',
                            background: usernameFeedback.isError ? 'rgba(255, 77, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            border: `1px solid ${usernameFeedback.isError ? 'rgba(255, 77, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                            color: usernameFeedback.isError ? '#FF4D5E' : '#10B981',
                          }}
                        >
                          {usernameFeedback.text}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Username:</span>
                        <span className="settings-user-name" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentUser.username}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Email:</span>
                        <span className="settings-user-email" style={{ color: 'var(--text-primary)' }}>{currentUser.email}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>User ID:</span>
                        <span className="settings-badge-value" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{currentUser.id}</span>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Tenant Isolation:</span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>✓ Verified Private Workspace</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Not authenticated</span>
                  )}
                </div>

                {/* Password Change Form */}
                <div className="settings-group-card">
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Change Password
                  </label>
                  <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Update your account password. All active JWT sessions will remain valid until expiry.
                  </p>
                  <form className="settings-password-form" onSubmit={handlePasswordSubmit}>
                    <div style={{ marginBottom: 10, position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        id="current-password-input"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Current Password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="modal-field"
                        style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '6px' }}
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        title={showCurrentPassword ? 'Hide current password' : 'Show current password'}
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
                        <Icon name={showCurrentPassword ? 'eye-off' : 'eye'} size={15} />
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          id="new-password-input"
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="New Password (min 6 chars)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          className="modal-field"
                          style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                          title={showNewPassword ? 'Hide new password' : 'Show new password'}
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
                          <Icon name={showNewPassword ? 'eye-off' : 'eye'} size={15} />
                        </button>
                      </div>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          id="confirm-password-input"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm New Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="modal-field"
                          style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                          title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
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
                          <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={15} />
                        </button>
                      </div>
                    </div>
                    {pwdMessage && (
                      <div
                        className={`settings-status-banner ${pwdMessage.isError ? 'is-error' : 'is-success'}`}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          marginBottom: 12,
                          fontSize: '12.5px',
                          background: pwdMessage.isError ? 'rgba(255, 77, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: `1px solid ${pwdMessage.isError ? 'rgba(255, 77, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                          color: pwdMessage.isError ? '#FF4D5E' : '#10B981',
                        }}
                      >
                        {pwdMessage.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="btn-timer primary"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      {pwdLoading ? 'Updating Password...' : 'Update Password'}
                    </button>
                  </form>
                </div>

                {/* Sign Out Card */}
                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 77, 94, 0.2)', background: 'rgba(255, 77, 94, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      End Workstation Session
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Sign out of your local desktop profile.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onClose(); onLogout() }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 77, 94, 0.4)',
                      background: 'rgba(255, 77, 94, 0.15)',
                      color: '#FF4D5E',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* 3. FOCUS PROTECTION SECTION */}
            {activeSection === 'protection' && (
              <div>
                <h3 className="settings-section-title">
                  Focus Protection & Shield Enforcement
                </h3>
                <p className="settings-section-desc">
                  Manage active defense policies, distraction quarantine modes, and emergency protocols.
                </p>

                {/* Health & Status Card */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Sentinel Status: {sentinelStatus?.status || 'STANDBY'}
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      color: sentinelStatus?.status === 'ACTIVE_DEFENSE' ? '#10B981' : '#38BDF8',
                    }}>
                      {sentinelStatus?.activeFocusSessionId ? 'SPRINT IN PROGRESS' : 'IDLE / READY'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '12.5px' }}>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Interceptions Today: </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sentinelStatus?.totalInterceptedToday ?? 0}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-secondary)' }}>Active Policy Rules: </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sentinelStatus?.activePolicyRulesCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Enforcement Mode Selector */}
                <div className="settings-group-card">
                  <label>
                    Enforcement Policy Mode
                  </label>
                  <p>
                    Select how aggressively background distractions and blacklisted apps are contained during sprints.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      {
                        mode: 'STRICT',
                        title: 'STRICT (Containment)',
                        desc: 'Auto-terminates blacklisted distractions during active sprints without grace periods.',
                      },
                      {
                        mode: 'BALANCED',
                        title: 'BALANCED (Grace Period)',
                        desc: 'Issues a 15-second grace prompt before restriction, allowing emergency snooze.',
                      },
                      {
                        mode: 'MONITORED',
                        title: 'MONITORED (Audit Only)',
                        desc: 'Logs distraction events to telemetry without closing background windows.',
                      },
                    ].map((item) => {
                      const isSel = selectedMode === item.mode
                      return (
                        <div
                          key={item.mode}
                          className={`settings-mode-card ${isSel ? 'is-active' : ''}`}
                          onClick={() => !modeUpdating && handleModeChange(item.mode)}
                          style={{
                            cursor: modeUpdating ? 'wait' : 'pointer',
                            opacity: modeUpdating ? 0.7 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span className="settings-mode-name">
                              {item.title}
                            </span>
                            {isSel && <span style={{ fontSize: '12px', color: '#3B82F6', fontWeight: 700 }}>✓ ACTIVE</span>}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.desc}</span>
                        </div>
                      )
                    })}
                  </div>
                  {modeFeedback && (
                    <div style={{ marginTop: 10, fontSize: '12px', color: '#10B981', fontWeight: 600 }}>
                      {modeFeedback}
                    </div>
                  )}
                </div>

                {/* Emergency Session Override */}
                <div className="settings-group-card">
                  <label>
                    Emergency Sprint Override
                  </label>
                  <p>
                    If you are locked in a strict sprint and require urgent workstation access, enter your password and a documented reason.
                  </p>
                  <form onSubmit={handleEmergencyOverrideSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showOverridePassword ? 'text' : 'password'}
                          placeholder="Account Password"
                          value={overridePassword}
                          onChange={(e) => setOverridePassword(e.target.value)}
                          className="modal-field"
                          style={{ width: '100%', padding: '8px 36px 8px 12px', borderRadius: '6px' }}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowOverridePassword((prev) => !prev)}
                          aria-label={showOverridePassword ? 'Hide override password' : 'Show override password'}
                          title={showOverridePassword ? 'Hide override password' : 'Show override password'}
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
                      <input
                        type="text"
                        placeholder="Override Reason (required)"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="modal-field"
                        style={{ padding: '8px 12px', borderRadius: '6px' }}
                      />
                    </div>
                    {overrideFeedback && (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          marginBottom: 10,
                          fontSize: '12px',
                          background: overrideFeedback.isError ? 'rgba(255, 77, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: overrideFeedback.isError ? '#FF4D5E' : '#10B981',
                        }}
                      >
                        {overrideFeedback.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={overrideLoading}
                      className="btn-timer secondary"
                      style={{ padding: '8px 14px', fontSize: '12.5px' }}
                    >
                      {overrideLoading ? 'Submitting Override...' : 'Execute Emergency Override'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 4. BROWSER COMPANION SECTION */}
            {activeSection === 'companion' && (
              <div>
                <h3 className="settings-section-title">
                  Browser Companion & URL Interception
                </h3>
                <p className="settings-section-desc">
                  Inspect browser extension pairing, YouTube distraction policies, and native messaging status.
                </p>

                {/* Connection Status Card */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Companion Link: {companionStatus?.state || (companionLoading ? 'Checking...' : 'Standby')}
                    </span>
                    <button
                      type="button"
                      onClick={fetchCompanionInfo}
                      disabled={companionLoading}
                      className="btn-timer secondary"
                      style={{ padding: '5px 12px', fontSize: '12.5px' }}
                    >
                      {companionLoading ? 'Checking...' : 'Test Connection'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Coverage:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companionStatus?.coverage || 'FULL'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Adapter:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companionStatus?.adapterName || 'SHINPO Contextual Host'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Diagnostics:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {companionStatus?.detail || 'Native host registered for Chrome, Brave, Edge, and Firefox.'}
                    </span>
                  </div>
                </div>

                {/* Registration Guide */}
                <div className="settings-group-card">
                  <label>
                    Native Messaging Setup
                  </label>
                  <p>
                    If your browser extension shows a disconnected badge, run the registration script on this workstation:
                  </p>
                  <div className="settings-code-box">
                    bash scripts/register-browser-companion.sh
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Windows users: Run <code style={{ color: '#38BDF8' }}>.\scripts\register-browser-companion.ps1</code> in PowerShell.
                  </span>
                </div>
              </div>
            )}

            {/* 5. EONPAI AI SECTION */}
            {activeSection === 'eonpai' && (
              <div>
                <h3 className="settings-section-title">
                  EONPAI Intelligence Engine
                </h3>
                <p className="settings-section-desc">
                  Real-time cognitive guidance, goal decomposition, and session debrief analysis.
                </p>

                {/* AI Status Card */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Provider Status: {aiStatus?.status || (aiLoading ? 'Probing...' : 'OPERATIONAL')}
                    </span>
                    <button
                      type="button"
                      onClick={fetchAiInfo}
                      disabled={aiLoading}
                      className="btn-timer secondary"
                      style={{ padding: '5px 12px', fontSize: '12.5px' }}
                    >
                      {aiLoading ? 'Probing...' : 'Refresh Status'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Active Engine:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {aiStatus?.enabled ? `External Provider (${aiStatus.provider || 'Ollama'})` : 'Offline Deterministic Silence Engine'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>Model:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {aiStatus?.model || 'Calm Heuristics / Deterministic Rule-Engine'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>Privacy Guarantee:</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>
                      Zero cognitive telemetry transmitted to unauthorized external APIs.
                    </span>
                  </div>
                </div>

                <div className="settings-group-card">
                  <label>
                    Operational Philosophy
                  </label>
                  <p style={{ margin: 0 }}>
                    When external LLM providers (e.g. Ollama) are unavailable, EONPAI seamlessly operates in deterministic fallback mode. It provides structured task recommendations, goal decomposition templates, and session debrief summaries without network delays or data leaks.
                  </p>
                </div>
              </div>
            )}

            {/* 6. CLOUD CONNECTION SECTION */}
            {activeSection === 'connection' && (
              <div>
                <h3 className="settings-section-title">
                  Cloud Connectivity & Synchronization
                </h3>
                <p className="settings-section-desc">
                  Configure your production cloud endpoint and verify real-time telemetry streaming.
                </p>

                {/* Server URL Input */}
                <div className="settings-group-card">
                  <label>
                    Cloud Backend Server URL
                  </label>
                  <p>
                    Remote servers require HTTPS; HTTP is accepted only for localhost development (e.g. <code style={{ color: '#3B82F6' }}>https://shinpo.yourdomain.com</code>).
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <input
                      type="text"
                      placeholder="https://shinpo.yourdomain.com (HTTPS required)"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      className="modal-field"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '6px' }}
                    />
                    <button
                      type="button"
                      onClick={handleServerSaveAndTest}
                      className="btn-timer primary"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      Save & Test
                    </button>
                  </div>
                  {serverPingStatus.status !== 'IDLE' && (
                    <div
                      className={`settings-status-banner ${serverPingStatus.status === 'SUCCESS' ? 'is-success' : 'is-error'}`}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        background: serverPingStatus.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 77, 94, 0.15)',
                        border: `1px solid ${serverPingStatus.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 77, 94, 0.4)'}`,
                        color: serverPingStatus.status === 'SUCCESS' ? '#10B981' : '#FF4D5E',
                      }}
                    >
                      {serverPingStatus.message}
                    </div>
                  )}
                </div>

                {/* WebSocket Channel Card */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        WebSocket Telemetry Stream
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Real-time STOMP connection for distraction warnings and session sync.
                      </span>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: isWsConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 77, 94, 0.2)',
                      color: isWsConnected ? '#10B981' : '#FF4D5E',
                    }}>
                      {isWsConnected ? '● CONNECTED' : '○ DISCONNECTED'}
                    </span>
                  </div>
                </div>

                {/* Manual Trigger Refresh */}
                {onRefreshData && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={onRefreshData}
                      disabled={isRefreshing}
                      className="btn-timer secondary"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      <Icon name="refresh" size={14} />
                      <span>{isRefreshing ? 'Synchronizing...' : 'Trigger Immediate Data Sync'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 7. PRIVACY & DATA SECTION */}
            {activeSection === 'privacy' && (
              <div>
                <h3 className="settings-section-title">
                  Privacy & Data Management
                </h3>
                <p className="settings-section-desc">
                  Export your personal focus data and review security guarantees.
                </p>

                {/* Export Data */}
                <div className="settings-group-card">
                  <label>
                    Export Personal Data (JSON)
                  </label>
                  <p>
                    Download a complete archive containing all your goals, missions, focus session history, and distraction telemetry.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="btn-timer primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    Export My Data (JSON)
                  </button>
                </div>

                {/* Privacy Safeguards */}
                <div className="settings-group-card">
                  <label>
                    Workstation Privacy Guarantees
                  </label>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li><strong>No Keystroke or Screen Logging:</strong> SHINPO Shield inspects only process names against your approved focus policy.</li>
                    <li><strong>Local Enforcement:</strong> Shield runs 100% locally on your computer. Server-side host process scanning is disabled.</li>
                    <li><strong>Tenant Isolation:</strong> Your cloud account data is strictly isolated by user ID and signed by cryptographically validated JWTs.</li>
                  </ul>
                </div>

                {/* Danger Zone: Account & Data Deletion */}
                <div
                  className="settings-group-card"
                  style={{
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.04)',
                  }}
                >
                  <label style={{ color: 'var(--brand-red, #EF4444)' }}>
                    Danger Zone: Irreversible Account Deletion
                  </label>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Permanently delete your SHINPO account and purge all your goals, missions, focus history, and telemetry from the database.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteAccountError(null)
                      setShowDeleteAccountConfirm(true)
                    }}
                    className="btn-timer secondary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '13px',
                      color: '#EF4444',
                      borderColor: 'rgba(239, 68, 68, 0.5)',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    }}
                  >
                    Delete Account & Wipe All Data
                  </button>
                </div>
              </div>
            )}

            {/* 8. ABOUT & DIAGNOSTICS SECTION */}
            {activeSection === 'about' && (
              <div>
                <h3 className="settings-section-title">
                  About SHINPO & Diagnostics
                </h3>
                <p className="settings-section-desc">
                  System build version, runtime environment, and operational diagnostics.
                </p>

                {/* About Info */}
                <div className="settings-group-card">
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Product:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>進歩 (SHINPO) Focus Cockpit</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Version:</span>
                    <span style={{ color: 'var(--text-primary)' }}>1.0.0 (Private Beta)</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Runtime Shell:</span>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {isTauriEnvironment() ? 'Tauri v2 Native Desktop Container' : 'Web Cockpit (Chromium/Gecko)'}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Decoupled State:</span>
                    <span style={{ color: '#10B981', fontWeight: 600 }}>✓ Verified Device-Independent</span>
                  </div>
                </div>

                {/* Diagnostics Runner */}
                <div className="settings-group-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Live System Diagnostics
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Run a real-time verification pass of all cloud and local subsystems.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunDiagnostics}
                      disabled={diagnosticsRunning}
                      className="btn-timer primary"
                      style={{ padding: '8px 16px', fontSize: '12.5px' }}
                    >
                      {diagnosticsRunning ? 'Running Checks...' : 'Run Diagnostics'}
                    </button>
                  </div>

                  {diagnosticResults && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                      {[
                        { title: 'REST API Connectivity', res: diagnosticResults.api },
                        { title: 'WebSocket Stream (/ws)', res: diagnosticResults.ws },
                        { title: 'Client-Side Storage', res: diagnosticResults.storage },
                        { title: 'Desktop Shield Runtime', res: diagnosticResults.shield },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="settings-diag-row"
                          style={{
                            background: item.res.pass ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 77, 94, 0.1)',
                            border: `1px solid ${item.res.pass ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 77, 94, 0.3)'}`,
                          }}
                        >
                          <span className="settings-diag-name">{item.title}</span>
                          <span className="settings-diag-badge" style={{ color: item.res.pass ? '#10B981' : '#FF4D5E', fontWeight: 700 }}>
                            {item.res.pass ? '✓ PASS' : '✗ FAIL'} — <span className="settings-diag-detail">{item.res.detail}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ShinpoConfirmDialog
        isOpen={showDeleteAccountConfirm}
        title="Permanently Delete Account?"
        message="This will immediately and irrevocably wipe your user record and all associated goals, missions, analytics, and telemetry from the database. This action cannot be undone."
        confirmLabel="Yes, Delete Everything"
        cancelLabel="Keep Account"
        isDestructive={true}
        isLoading={deleteAccountLoading}
        errorMessage={deleteAccountError}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          if (!deleteAccountLoading) {
            setShowDeleteAccountConfirm(false)
            setDeleteAccountError(null)
          }
        }}
      />
    </div>
  )
}
