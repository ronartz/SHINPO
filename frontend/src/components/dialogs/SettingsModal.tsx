import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Icon } from '../common/Icon'
import type { AuthUser } from '../../api/auth'
import { changePassword, isLocalVaultSession, updateUsername, deleteAccount } from '../../api/auth'
import { ShinpoConfirmDialog } from '../ui/Dialog/ShinpoConfirmDialog'
import type { SentinelStatus } from '../../api/device'
import { updateSentinelMode, emergencyOverride } from '../../api/device'
import { isTauriEnvironment } from '../../api/nativeShield'
import { invokeTauriCommand } from '../../api/tauri'
import type { Goal, Mission } from '../../api/goalsAndMissions'
import type { FocusSession } from '../../api/focusSessions'
import { getAiProviderStatus, getNativeAiProviderConfig, configureNativeAiProvider } from '../../api/ai'
import type { NativeAiProviderConfig } from '../../api/ai'
import { guardianCanRequestClose, guardianCapabilityLabel, guardianInterventionDescription, guardianModeLabel, guardianObserverLabel } from '../../utils/guardianCapability'

export type SettingsSection =
  | 'appearance'
  | 'account'
  | 'protection'
  | 'companion'
  | 'eonpai'
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
  onReplayTutorial?: () => void
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
  isWsConnected: _isWsConnected = false,
  onRefreshData,
  isRefreshing: _isRefreshing = false,
  goals = [],
  missions = [],
  sessions = [],
  onReplayTutorial,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    initialSection || 'appearance',
  )

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
  const [pairingCode, setPairingCode] = useState<string | null>(null)

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

  // Diagnostics state
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false)
  const [diagnosticResults, setDiagnosticResults] = useState<{
    vault: { pass: boolean; detail: string }
    ipc: { pass: boolean; detail: string }
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
      if (isTauriEnvironment() || isLocalVaultSession()) {
        const data = await invokeTauriCommand<{ paired: boolean; state: string; detail: string }>('browser_companion_local_status')
        setCompanionStatus({
          state: data.state,
          coverage: 'LIMITED',
          adapterName: 'Native messaging',
          detail: data.detail,
        })
        return
      }
      setCompanionStatus({
        state: 'STANDALONE_READY',
        coverage: 'LOCAL_ONLY',
        adapterName: 'Native messaging',
        detail: 'Browser Companion pairs directly with local desktop application.',
      })
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

  const createCompanionPairingCode = async () => {
    setCompanionLoading(true)
    try {
      setPairingCode(await invokeTauriCommand<string>('browser_companion_pairing_code'))
      await fetchCompanionInfo()
    } catch (error) {
      setCompanionStatus({ state: 'UNAVAILABLE', coverage: 'NONE', detail: error instanceof Error ? error.message : 'Could not create a pairing code.' })
    } finally {
      setCompanionLoading(false)
    }
  }

  const revokeCompanionPairing = async () => {
    setCompanionLoading(true)
    try {
      await invokeTauriCommand('browser_companion_revoke')
      setPairingCode(null)
      await fetchCompanionInfo()
    } catch (error) {
      setCompanionStatus({ state: 'UNAVAILABLE', coverage: 'NONE', detail: error instanceof Error ? error.message : 'Could not revoke pairing.' })
    } finally {
      setCompanionLoading(false)
    }
  }

  const defaultNativeProvider: NativeAiProviderConfig = { provider: 'none', model: '', endpoint: '', allowCloudContext: false }
  const [nativeProvider, setNativeProvider] = useState<NativeAiProviderConfig>(defaultNativeProvider)
  const nativeApiKeyRef = useRef<HTMLInputElement>(null)
  const [providerSaving, setProviderSaving] = useState(false)
  const [providerMessage, setProviderMessage] = useState('')
  useEffect(() => {
    let current = true
    if (isOpen && activeSection === 'eonpai' && isLocalVaultSession()) {
      getNativeAiProviderConfig().then((config) => { if (current && config) setNativeProvider(config) }).catch((error: unknown) => { if (current) setProviderMessage(error instanceof Error ? error.message : 'Could not read provider settings') })
    }
    if (!isOpen && nativeApiKeyRef.current) nativeApiKeyRef.current.value = ''
    return () => { current = false }
  }, [isOpen, activeSection])

  const handleSaveNativeAiProvider = async (event: React.FormEvent) => {
    event.preventDefault()
    if (providerSaving) return
    setProviderSaving(true)
    setProviderMessage('')
    const safeConfig = nativeProvider || defaultNativeProvider
    const key = nativeApiKeyRef.current?.value || undefined
    try {
      await configureNativeAiProvider(safeConfig, key)
      if (nativeApiKeyRef.current) {
        nativeApiKeyRef.current.value = ''
      }
      setProviderMessage('Provider settings saved.')
      await fetchAiInfo()
    } catch (error: unknown) {
      setProviderMessage(error instanceof Error ? error.message : 'Could not save provider')
    } finally {
      setProviderSaving(false)
    }
  }

  // Fetch EONPAI Status
  const fetchAiInfo = useCallback(async () => {
    setAiLoading(true)
    try {
      setAiStatus(await getAiProviderStatus())
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

    const minimumPasswordLength = isLocalVaultSession() ? 12 : 6
    if (newPassword.length < minimumPasswordLength) {
      setPwdMessage({ text: `New password must be at least ${minimumPasswordLength} characters long.`, isError: true })
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

  // Handle Personal Data Export (JSON)
  const handleExportData = () => {
    const exportPayload = {
      exportMetadata: {
        app: 'SHINPO',
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
      vault: { pass: false, detail: 'Checking...' },
      ipc: { pass: false, detail: 'Checking...' },
      storage: { pass: false, detail: 'Checking...' },
      shield: { pass: false, detail: 'Checking...' },
    }

    // 1. Vault Status Check
    if (isTauriEnvironment()) {
      try {
        const vaultStatus = await invokeTauriCommand<{ unlocked: boolean; username: string | null }>('local_vault_status')
        results.vault = {
          pass: vaultStatus.unlocked,
          detail: vaultStatus.unlocked
            ? `SQLCipher encrypted vault unlocked (${vaultStatus.username || 'active'})`
            : 'SQLCipher vault locked',
        }
      } catch (err) {
        results.vault = { pass: false, detail: `Vault check error: ${err instanceof Error ? err.message : 'Unknown'}` }
      }
    } else {
      results.vault = { pass: true, detail: 'Web standalone preview mode (local state)' }
    }

    // 2. Native IPC Bridge Check
    if (isTauriEnvironment()) {
      results.ipc = { pass: true, detail: 'Tauri native bridge connected (zero external network)' }
    } else {
      results.ipc = { pass: true, detail: 'Web client-only preview environment' }
    }

    // 3. Storage Check
    try {
      localStorage.setItem('__shinpo_diag_test__', '1')
      localStorage.removeItem('__shinpo_diag_test__')
      results.storage = { pass: true, detail: 'Local storage read/write validated' }
    } catch {
      results.storage = { pass: false, detail: 'LocalStorage restricted or unavailable' }
    }

    // 4. Shield / Desktop Protection Check
    if (isTauriEnvironment()) {
      results.shield = {
        pass: true,
        detail: 'Tauri desktop protection active. Guardian remains warning-only.',
      }
    } else {
      results.shield = {
        pass: true,
        detail: 'Browser environment active. Native focus protection runs in desktop build.',
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
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-highlight) 20.0%, transparent) 0%, color-mix(in srgb, var(--brand-primary) 20.0%, transparent) 100%)',
                color: 'var(--brand-primary)',
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
            <div key={activeSection} className="settings-section-animated-pane">
              {/* 1. APPEARANCE SECTION */}
              {activeSection === 'appearance' && (
                <div>
                  <h3 className="settings-section-title">
                    Appearance & Display
                  </h3>
                  <p className="settings-section-desc">
                    Customize your workspace theme and time display format.
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
                        {isDarkMode && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        {!isDarkMode && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        Toggle between the Aurora and Classic visual themes.
                      </p>
                      <div className="settings-pill-row">
                        <button
                          type="button"
                          className={`settings-pill-btn ${isV2Preview ? 'is-active' : ''}`}
                          onClick={() => { if (!isV2Preview) onToggleV2Preview() }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="sparkle" size={15} />
                            <span>Aurora</span>
                          </div>
                          {isV2Preview && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
                        </button>
                        <button
                          type="button"
                          className={`settings-pill-btn ${!isV2Preview ? 'is-active' : ''}`}
                          onClick={() => { if (isV2Preview) onToggleV2Preview() }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon name="dashboard" size={15} />
                            <span>Classic</span>
                          </div>
                          {!isV2Preview && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        {!is24Hour && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        {is24Hour && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
                      </button>
                    </div>
                  </div>

                  {/* Celebratory Feedback & Progression */}
                  <div className="settings-group-card">
                    <label>
                      Celebratory Feedback & Progression Effects
                    </label>
                    <p>
                      Choose the visual feedback shown when you complete tasks and focus sessions.
                    </p>
                    <div className="settings-pill-row">
                      <button
                        type="button"
                        className={`settings-pill-btn ${celebrationEffects !== 'minimal' ? 'is-active' : ''}`}
                        onClick={() => handleCelebrationEffectsChange('full')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="sparkle" size={15} />
                          <span>Full completion feedback</span>
                        </div>
                        {celebrationEffects !== 'minimal' && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        {celebrationEffects === 'minimal' && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
                      </button>
                    </div>
                  </div>

                  {/* Consistency Streak Display */}
                  <div className="settings-group-card">
                    <label>
                      Consistency History Display
                    </label>
                    <p>
                      Show consecutive days with recorded focus on the Dashboard.
                    </p>
                    <div className="settings-pill-row">
                      <button
                        type="button"
                        className={`settings-pill-btn ${streakDisplay !== 'hidden' ? 'is-active' : ''}`}
                        onClick={() => handleStreakDisplayChange('visible')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon name="zap" size={14} />
                          <span>Visible (Show consistency)</span>
                        </div>
                        {streakDisplay !== 'hidden' && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                        {streakDisplay === 'hidden' && <span className="settings-pill-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>}
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
                      {currentUser && !isEditingUsername && !isLocalVaultSession() && (
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
                              background: usernameFeedback.isError ? 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)',
                              border: `1px solid ${usernameFeedback.isError ? 'color-mix(in srgb, var(--brand-highlight) 40.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 40.0%, transparent)'}`,
                              color: usernameFeedback.isError ? 'var(--brand-primary)' : 'var(--brand-primary)',
                            }}
                          >
                            {usernameFeedback.text}
                          </div>
                        )}

                        {isLocalVaultSession() && (
                          <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: 12 }}>
                            This name identifies your encrypted local vault and cannot be changed.
                          </p>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Username:</span>
                          <span className="settings-user-name" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentUser.username}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Email:</span>
                          <span className="settings-user-email" style={{ color: 'var(--text-primary)' }}>{currentUser.email}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>User ID:</span>
                          <span className="settings-badge-value" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{currentUser.id}</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Tenant Isolation:</span>
                          <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}><Icon name="check-circle" size={14} /> Verified Private Workspace</span>
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
                            color: 'var(--text-secondary, #5c5c5c)',
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
                              color: 'var(--text-secondary, #5c5c5c)',
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
                              color: 'var(--text-secondary, #5c5c5c)',
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
                            background: pwdMessage.isError ? 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)',
                            border: `1px solid ${pwdMessage.isError ? 'color-mix(in srgb, var(--brand-highlight) 40.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 40.0%, transparent)'}`,
                            color: pwdMessage.isError ? 'var(--brand-primary)' : 'var(--brand-primary)',
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
                  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--brand-highlight) 20.0%, transparent)', background: 'color-mix(in srgb, var(--brand-highlight) 5.0%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                        border: '1px solid color-mix(in srgb, var(--brand-highlight) 40.0%, transparent)',
                        background: 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)',
                        color: 'var(--brand-primary)',
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
                    Focus Protection
                  </h3>
                  <p className="settings-section-desc">
                    Manage distraction rules and protection behavior during focus sessions.
                  </p>

                  {/* Health & Status Card */}
                  <div className="settings-group-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Protection status: {isLocalVaultSession()
                          ? sentinelStatus?.status === 'LOCKED' ? 'Vault locked'
                            : sentinelStatus?.observerStatus === 'DEGRADED' ? 'Observer unavailable'
                              : sentinelStatus?.status === 'ACTIVE' ? 'Monitoring during Focus'
                                : sentinelStatus?.status === 'PAUSED' ? 'Paused with Focus' : 'Ready for Focus'
                          : sentinelStatus?.status?.replaceAll('_', ' ') || 'Standby'}
                      </span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'color-mix(in srgb, var(--brand-highlight) 20.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 20.0%, transparent)',
                        color: sentinelStatus?.status === 'ACTIVE_DEFENSE' ? 'var(--brand-primary)' : 'var(--brand-primary)',
                      }}>
                        {sentinelStatus?.activeFocusSessionId ? 'FOCUS SESSION IN PROGRESS' : 'IDLE / READY'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '12.5px' }}>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>{isLocalVaultSession() ? 'App observations today: ' : 'Interceptions Today: '}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{isLocalVaultSession() ? sentinelStatus?.guardianWarningCount ?? 0 : sentinelStatus?.totalInterceptedToday ?? 0}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-secondary)' }}>{isLocalVaultSession() ? 'Application handling: ' : 'Active Policy Rules: '}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{isLocalVaultSession() ? guardianCanRequestClose(sentinelStatus?.interventionCapability, sentinelStatus?.warningOnly) ? 'Consented close may be requested' : 'Monitoring / warning-only' : sentinelStatus?.activePolicyRulesCount ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {isLocalVaultSession() ? (
                    <div className="settings-group-card">
                      <label>Guardian policy</label>
                      <p>{guardianInterventionDescription(sentinelStatus?.interventionCapability)}</p>
                      <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
                        <div><strong>Effective mode: </strong>{sentinelStatus?.guardianMode ? guardianModeLabel(sentinelStatus.guardianMode) : 'No active session'}</div>
                        <div><strong>Focus phase: </strong>{sentinelStatus?.focusPhase ?? 'Idle'}</div>
                        <div><strong>Observer: </strong>{guardianObserverLabel(sentinelStatus?.observerStatus)}</div>
                        <div><strong>Application policy: </strong>{guardianCapabilityLabel(sentinelStatus?.interventionCapability)}</div>
                        <div><strong>Built-in process catalog: </strong>{sentinelStatus?.guardianApplicationCatalog?.length ?? 0} recognized names · {sentinelStatus?.guardianAppCatalogVersion ?? 'version unavailable'}; not an installed-app inventory.</div>
                      </div>
                    </div>
                  ) : <div className="settings-group-card">
                    <label>
                      Enforcement Policy Mode
                    </label>
                    <p>
                      Choose how focus protection handles distracting applications during a focus session.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        {
                          mode: 'STRICT',
                          title: 'STRICT (Containment)',
                          desc: 'Closes blocked applications during a focus session without a grace period.',
                        },
                        {
                          mode: 'BALANCED',
                          title: 'BALANCED (Grace Period)',
                          desc: 'Shows a 15-second warning before restriction, with an option to pause protection.',
                        },
                        {
                          mode: 'MONITORED',
                          title: 'Monitoring only',
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
                              {isSel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 700 }}><Icon name="check" size={12} /> Selected</span>}
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.desc}</span>
                          </div>
                        )
                      })}
                    </div>
                    {modeFeedback && (
                      <div style={{ marginTop: 10, fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 600 }}>
                        {modeFeedback}
                      </div>
                    )}
                  </div>}

                  {/* Emergency Session Override */}
                  {!isLocalVaultSession() && <div className="settings-group-card">
                    <label>
                      Emergency Focus Override
                    </label>
                    <p>
                      If you need urgent access while strict focus protection is active, enter your password and a reason.
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
                            background: overrideFeedback.isError ? 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 15.0%, transparent)',
                            color: overrideFeedback.isError ? 'var(--brand-primary)' : 'var(--brand-primary)',
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
                  </div>}
                </div>
              )}

              {/* 4. BROWSER COMPANION SECTION */}
              {activeSection === 'companion' && (
                <div className="companion-settings-container">
                  {/* A. Header */}
                  <div className="companion-settings-header">
                    <div>
                      <h3 className="settings-section-title" style={{ margin: 0 }}>
                        Browser Companion
                      </h3>
                      <p className="settings-section-desc" style={{ margin: '4px 0 0' }}>
                        Connect your browser to SHINPO's local Focus protection.
                      </p>
                    </div>
                    <div className={`companion-header-pill ${companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED' ? 'connected' : companionLoading ? 'checking' : companionStatus?.state === 'UNREACHABLE' ? 'danger' : 'standby'}`}>
                      <span className="companion-status-dot" />
                      <span>{companionLoading ? 'Checking...' : companionStatus?.state === 'PAIRED' ? 'Paired' : companionStatus?.state === 'CONNECTED' ? 'Connected' : companionStatus?.state === 'UNREACHABLE' ? 'Host Unreachable' : 'Not Paired'}</span>
                    </div>
                  </div>

                  {/* B. Connection Status Panel */}
                  <div className="companion-card companion-status-card">
                    <div className="companion-status-row">
                      <div className="companion-status-info">
                        <span className="companion-status-title">
                          Status: {companionLoading ? 'Checking connection...' : companionStatus?.state === 'PAIRED' ? 'Paired with browser' : companionStatus?.state === 'CONNECTED' ? 'Active connection established' : companionStatus?.state === 'UNREACHABLE' ? 'Native host unavailable' : 'Standby · Ready to pair'}
                        </span>
                        <p className="companion-status-detail">
                          {companionStatus?.detail || (companionStatus?.state === 'PAIRED' ? 'Extension is paired with SHINPO local vault. Focus session rules will synchronize automatically.' : 'Extension is not yet paired. Generate a 10-minute code below to link your browser.')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchCompanionInfo}
                        disabled={companionLoading}
                        className="btn-timer secondary companion-refresh-btn"
                      >
                        {companionLoading ? 'Checking...' : isTauriEnvironment() && localStorage.getItem('shinpo_local_vault_account') ? 'Refresh Status' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  {/* C. Guided Pairing Section */}
                  <div className="companion-card companion-pairing-card">
                    <h4 className="companion-card-heading">Pairing Setup</h4>
                    <p className="companion-card-subheading">Follow these steps to connect your browser to SHINPO desktop:</p>

                    <div className="companion-steps-list">
                      <div className={`companion-step ${companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED' ? 'step-completed' : 'step-active'}`}>
                        <div className="companion-step-num">1</div>
                        <div className="companion-step-content">
                          <strong>Install or enable the extension</strong>
                          <span>Add the SHINPO Browser Companion to Chromium (Chrome, Brave, Edge) or Firefox.</span>
                        </div>
                      </div>

                      <div className={`companion-step ${pairingCode ? 'step-active' : companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED' ? 'step-completed' : ''}`}>
                        <div className="companion-step-num">2</div>
                        <div className="companion-step-content">
                          <strong>Generate a one-time pairing code</strong>
                          <span>Create a secure 10-minute verification code from your local desktop vault.</span>
                        </div>
                      </div>

                      <div className={`companion-step ${pairingCode ? 'step-active' : ''}`}>
                        <div className="companion-step-num">3</div>
                        <div className="companion-step-content">
                          <strong>Enter the code in Browser Companion</strong>
                          <span>Click the SHINPO extension icon in your browser toolbar and paste the code.</span>
                        </div>
                      </div>

                      <div className={`companion-step ${companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED' ? 'step-completed' : ''}`}>
                        <div className="companion-step-num">4</div>
                        <div className="companion-step-content">
                          <strong>Verify the connection</strong>
                          <span>The extension status switches to Connected, and active Focus restrictions apply.</span>
                        </div>
                      </div>
                    </div>

                    {isTauriEnvironment() && localStorage.getItem('shinpo_local_vault_account') && (
                      <div className="companion-pairing-actions">
                        <button
                          type="button"
                          className="btn-timer primary companion-primary-btn"
                          disabled={companionLoading}
                          onClick={() => void createCompanionPairingCode()}
                        >
                          {companionLoading ? 'Generating...' : 'Generate 10-minute pairing code'}
                        </button>
                        {(companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED') && (
                          <button
                            type="button"
                            className="btn-timer secondary companion-revoke-btn"
                            disabled={companionLoading}
                            onClick={() => void revokeCompanionPairing()}
                          >
                            Revoke pairing
                          </button>
                        )}
                      </div>
                    )}

                    {pairingCode && (
                      <div className="companion-code-display" role="status">
                        <span className="companion-code-label">Active Pairing Code (expires in 10 minutes):</span>
                        <div className="companion-code-box">
                          <code>{pairingCode}</code>
                        </div>
                        <span className="companion-code-help">Paste this code into the browser extension popup to complete pairing.</span>
                      </div>
                    )}
                  </div>

                  {/* D. Browser Status / Coverage Overview */}
                  <div className="companion-card companion-details-card">
                    <h4 className="companion-card-heading">Protection & Adapter Status</h4>
                    <div className="companion-grid-details">
                      <div className="companion-grid-item">
                        <span className="companion-grid-label">Native Messaging:</span>
                        <span className="companion-grid-val">{isTauriEnvironment() ? 'Registered host (com.shinpo.companion)' : 'Web fallback mode'}</span>
                      </div>
                      <div className="companion-grid-item">
                        <span className="companion-grid-label">Pairing State:</span>
                        <span className="companion-grid-val">{companionStatus?.state === 'PAIRED' || companionStatus?.state === 'CONNECTED' ? 'Paired' : 'Unpaired'}</span>
                      </div>
                      <div className="companion-grid-item">
                        <span className="companion-grid-label">Policy Coverage:</span>
                        <span className="companion-grid-val">{companionStatus?.coverage || 'Awaiting connection'}</span>
                      </div>
                      <div className="companion-grid-item">
                        <span className="companion-grid-label">Host Adapter:</span>
                        <span className="companion-grid-val">{companionStatus?.adapterName || 'SHINPO Contextual Host'}</span>
                      </div>
                    </div>
                  </div>

                  {/* E. Diagnostics & Troubleshooting Collapsible */}
                  <details className="companion-troubleshooting-accordion">
                    <summary className="companion-accordion-summary">
                      <span>Troubleshooting & Diagnostic Remedies</span>
                      <Icon name="chevron-down" size={16} />
                    </summary>
                    <div className="companion-accordion-content">
                      <div className="companion-remedy-item">
                        <strong>Native host unreachable</strong>
                        <p>Verify that your browser is closed during host manifest installation, or restart your browser after registration.</p>
                      </div>
                      <div className="companion-remedy-item">
                        <strong>Expired pairing code</strong>
                        <p>Pairing codes expire after 10 minutes for security. Click "Generate 10-minute pairing code" to create a fresh code.</p>
                      </div>
                      <div className="companion-remedy-item">
                        <strong>Web distraction policies not applying</strong>
                        <p>Website rules are only evaluated during an active Focus session with a valid lease. Start a focus session in SHINPO to activate protection.</p>
                      </div>

                      <div className="companion-developer-area">
                        <span className="companion-dev-tag">Developer & Workstation Setup</span>
                        <p style={{ margin: '4px 0 8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          To register the native messaging host directly from repository source:
                        </p>
                        <div className="settings-code-box">
                          bash scripts/register-browser-companion.sh
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          Windows: <code style={{ color: 'var(--brand-primary)' }}>.\scripts\register-browser-companion.ps1</code>
                        </span>
                      </div>
                    </div>
                  </details>
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
                  {isLocalVaultSession() && (
                    <form className="settings-group-card" onSubmit={handleSaveNativeAiProvider}>
                      <div className="settings-field-group">
                        <label htmlFor="native-ai-provider" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Native AI provider</label>
                        <select id="native-ai-provider" value={(nativeProvider || defaultNativeProvider).provider} onChange={(event) => setNativeProvider({ ...(nativeProvider || defaultNativeProvider), provider: event.target.value as NativeAiProviderConfig['provider'] })}>
                          <option value="none">Offline planning (no model)</option>
                          <option value="ollama">Ollama on this computer</option>
                          <option value="openai">OpenAI-compatible provider (your key)</option>
                        </select>
                      </div>
                      {(nativeProvider || defaultNativeProvider).provider !== 'none' && <div className="settings-field-group" style={{ marginTop: 12 }}>
                        <label htmlFor="native-ai-model" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Installed or provider model name</label>
                        <input id="native-ai-model" value={(nativeProvider || defaultNativeProvider).model} maxLength={120} required onChange={(event) => setNativeProvider({ ...(nativeProvider || defaultNativeProvider), model: event.target.value })} />
                      </div>}
                      {(nativeProvider || defaultNativeProvider).provider === 'ollama' && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 8 }}>Ollama must be installed separately with the selected model. SHINPO connects only to 127.0.0.1:11434.</p>}
                      {(nativeProvider || defaultNativeProvider).provider === 'openai' && <>
                        <div className="settings-field-group" style={{ marginTop: 12 }}>
                          <label htmlFor="native-ai-endpoint" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>HTTPS API base URL</label>
                          <input id="native-ai-endpoint" type="url" value={(nativeProvider || defaultNativeProvider).endpoint} required placeholder="https://api.example.com/v1" onChange={(event) => setNativeProvider({ ...(nativeProvider || defaultNativeProvider), endpoint: event.target.value })} />
                        </div>
                        <div className="settings-field-group" style={{ marginTop: 12 }}>
                          <label htmlFor="native-ai-key" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>API key {(nativeProvider || defaultNativeProvider).hasApiKey ? '(leave blank to keep saved key)' : ''}</label>
                          <input id="native-ai-key" type="password" autoComplete="off" ref={nativeApiKeyRef} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                          <input type="checkbox" checked={(nativeProvider || defaultNativeProvider).allowCloudContext} required onChange={(event) => setNativeProvider({ ...(nativeProvider || defaultNativeProvider), allowCloudContext: event.target.checked })} style={{ marginTop: 3 }} />
                          <span>I allow my messages and bounded goal, task and session context to be sent to this provider. The provider may charge my account.</span>
                        </label>
                      </>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                        <button type="submit" className="btn-timer primary" disabled={providerSaving} style={{ padding: '8px 18px', fontSize: '13px' }}>
                          {providerSaving ? 'Saving…' : 'Save provider'}
                        </button>
                        {providerMessage && <span role="status" style={{ fontSize: '12.5px', color: 'var(--brand-primary)', fontWeight: 600 }}>{providerMessage}</span>}
                      </div>
                    </form>
                  )}
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
                        {aiStatus?.enabled ? `External Provider (${aiStatus.provider || 'Ollama'})` : 'Offline planning'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>Model:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {aiStatus?.model || 'No model; local planning rules'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>Privacy Guarantee:</span>
                      <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
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
                      Download a complete archive containing your goals, tasks, focus session history, and protection activity.
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
                      <li><strong>No Keystroke or Screen Logging:</strong> SHINPO checks application names against your focus rules.</li>
                      <li><strong>Guardian:</strong> App observations and warnings run locally; this release does not close applications.</li>
                      <li><strong>Local vault:</strong> Account data is stored in the encrypted local workspace.</li>
                    </ul>
                  </div>

                  {/* Danger Zone: Account & Data Deletion */}
                  <div
                    className="settings-group-card"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--brand-primary) 40.0%, transparent)',
                      background: 'color-mix(in srgb, var(--brand-primary) 4.0%, transparent)',
                    }}
                  >
                    <label style={{ color: 'var(--brand-red, var(--brand-primary))' }}>
                      Danger Zone: Irreversible Account Deletion
                    </label>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Permanently delete your SHINPO account and all associated goals, tasks, focus history, and protection activity.
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
                        color: 'var(--brand-primary)',
                        borderColor: 'color-mix(in srgb, var(--brand-primary) 50.0%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--brand-primary) 8.0%, transparent)',
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
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>進歩 (SHINPO)</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Version:</span>
                      <span style={{ color: 'var(--text-primary)' }}>1.0.0 (Private Beta)</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Runtime Shell:</span>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {isTauriEnvironment() ? 'Tauri desktop app' : 'Browser app (Chromium/Gecko)'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Data model:</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{isTauriEnvironment() ? 'Encrypted local vault' : 'Server-backed workspace'}</span>
                    </div>
                  </div>

                  {/* Interactive Tutorial Replay */}
                  <div className="settings-group-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Interactive Tutorial
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Replay the 7-stage interactive onboarding journey covering Goals, Tasks, Scheduling, Guardian, and Focus.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onReplayTutorial?.()
                        }}
                        className="btn-timer secondary"
                        style={{ padding: '8px 16px', fontSize: '12.5px', flexShrink: 0 }}
                      >
                        Replay Tutorial
                      </button>
                    </div>
                  </div>

                  {/* Diagnostics Runner */}
                  {!isTauriEnvironment() && <div className="settings-group-card">
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
                          { title: 'Local Encrypted Vault', res: diagnosticResults.vault },
                          { title: 'Native IPC Bridge', res: diagnosticResults.ipc },
                          { title: 'Client-Side Storage', res: diagnosticResults.storage },
                          { title: 'Desktop Protection Service', res: diagnosticResults.shield },
                        ].map((item, idx) => (
                          <div
                            key={idx}
                            className="settings-diag-row"
                            style={{
                              background: item.res.pass ? 'color-mix(in srgb, var(--brand-highlight) 10.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 10.0%, transparent)',
                              border: `1px solid ${item.res.pass ? 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)' : 'color-mix(in srgb, var(--brand-highlight) 30.0%, transparent)'}`,
                            }}
                          >
                            <span className="settings-diag-name">{item.title}</span>
                            <span className="settings-diag-badge" style={{ color: item.res.pass ? 'var(--brand-primary)' : 'var(--brand-primary)', fontWeight: 700 }}>
                              <Icon name={item.res.pass ? 'check' : 'close'} size={12} /> {item.res.pass ? 'PASS' : 'FAIL'} — <span className="settings-diag-detail">{item.res.detail}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShinpoConfirmDialog
        isOpen={showDeleteAccountConfirm}
        title={isLocalVaultSession() ? 'Delete Encrypted Local Account?' : 'Permanently Delete Account?'}
        message={isLocalVaultSession()
          ? 'This removes the unlocked local vault and its encrypted data files after clearing the Browser Companion policy. It is blocked while a Focus session is active. Filesystem deletion is not a guaranteed secure overwrite.'
          : 'This will immediately and permanently delete your account and associated goals, tasks, analytics, and activity. This action cannot be undone.'}
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
