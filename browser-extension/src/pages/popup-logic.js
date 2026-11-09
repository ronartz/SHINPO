/**
 * SHINPO Browser Companion - Shared UI Logic & State Derivation
 * Zero-dependency, lightweight, pure functions for UI states, timers, and theme.
 */

export const UI_STATES = {
  INITIAL_LOADING: 'INITIAL_LOADING',
  UNPAIRED: 'UNPAIRED',
  HOST_UNAVAILABLE: 'HOST_UNAVAILABLE',
  CONNECTED_NO_FOCUS: 'CONNECTED_NO_FOCUS',
  CONNECTED_ACTIVE_FOCUS: 'CONNECTED_ACTIVE_FOCUS',
  PAUSED_FOCUS: 'PAUSED_FOCUS',
  MONITORING_DISABLED: 'MONITORING_DISABLED',
  DISCONNECTED_CACHED_POLICY: 'DISCONNECTED_CACHED_POLICY',
  EXPIRED_POLICY: 'EXPIRED_POLICY',
  SYNCING: 'SYNCING',
  ERROR: 'ERROR',
}

export const APPROVED_THEMES = [
  'aurora-dark',
  'aurora-light',
  'classic-dark',
  'classic-light',
]

export const DEFAULT_THEME = 'aurora-dark'
export const THEME_STORAGE_KEY = 'shinpo_extension_theme'

/**
 * Normalizes and validates a theme identifier against approved SHINPO themes.
 */
export function normalizeTheme(theme) {
  if (typeof theme === 'string' && APPROVED_THEMES.includes(theme.trim().toLowerCase())) {
    return theme.trim().toLowerCase()
  }
  return DEFAULT_THEME
}

/**
 * Derives the exact UI state from the extension status object and UI context.
 */
export function deriveUiState(status, options = {}) {
  const { busy = false, syncInProgress = false, errorMessage = null } = options

  if (errorMessage) {
    return UI_STATES.ERROR
  }

  if (!status) {
    return UI_STATES.INITIAL_LOADING
  }

  if (syncInProgress) {
    return UI_STATES.SYNCING
  }

  const connectionState = status.connection?.state || 'DISCONNECTED'

  if (connectionState === 'UNPAIRED') {
    return UI_STATES.UNPAIRED
  }

  if (connectionState === 'DISCONNECTED') {
    if (status.policy?.degraded) {
      return UI_STATES.EXPIRED_POLICY
    }
    if (status.policy?.active) {
      return UI_STATES.DISCONNECTED_CACHED_POLICY
    }
    return UI_STATES.HOST_UNAVAILABLE
  }

  if (status.policy?.degraded) {
    return UI_STATES.EXPIRED_POLICY
  }

  if (status.monitoringEnabled === false) {
    return UI_STATES.MONITORING_DISABLED
  }

  if (status.policy?.active && status.policy?.sessionId) {
    if (status.policy.sessionStatus === 'PAUSED') {
      return UI_STATES.PAUSED_FOCUS
    }
    return UI_STATES.CONNECTED_ACTIVE_FOCUS
  }

  if (connectionState === 'CONNECTED') {
    return UI_STATES.CONNECTED_NO_FOCUS
  }

  return UI_STATES.HOST_UNAVAILABLE
}

/**
 * Calculates control eligibility (disabled flags) so async operations
 * never accidentally re-enable buttons for invalid states (e.g., unpaired).
 */
export function getControlStates(status, options = {}) {
  const { busy = false, syncInProgress = false } = options
  const isUnpaired = !status || status.connection?.state === 'UNPAIRED'
  const isOperating = Boolean(busy || syncInProgress)

  return {
    pairDisabled: isOperating,
    pairingCodeDisabled: isOperating,
    syncDisabled: isOperating || isUnpaired,
    disconnectDisabled: isOperating || isUnpaired,
    monitoringDisabled: isOperating,
  }
}

/**
 * Formats phase countdown timer and details cleanly and deterministically.
 */
export function formatPhaseCountdown(policy, currentTimeMs = Date.now()) {
  if (!policy || !policy.sessionId) {
    return {
      text: 'No active Focus phase',
      countdown: '00:00',
      remainingSeconds: null,
      isPaused: false,
      graceWarning: false,
    }
  }

  if (policy.degraded) {
    return {
      text: 'Policy expired · limited cached restrictions only',
      countdown: '00:00',
      remainingSeconds: 0,
      isPaused: false,
      graceWarning: false,
    }
  }

  const phase = String(policy.currentPhase || 'FOCUS').replaceAll('_', ' ').toLowerCase()
  const isPaused = policy.sessionStatus === 'PAUSED'

  let remainingSeconds = null
  if (isPaused && Number.isFinite(policy.phaseRemainingSeconds)) {
    remainingSeconds = Math.max(0, policy.phaseRemainingSeconds)
  } else if (policy.phaseDeadlineAtMs) {
    remainingSeconds = Math.max(0, Math.ceil((policy.phaseDeadlineAtMs - currentTimeMs) / 1000))
  }

  if (remainingSeconds === null) {
    return {
      text: `${phase} · syncing`,
      countdown: 'syncing',
      remainingSeconds: null,
      isPaused,
      graceWarning: false,
    }
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = String(remainingSeconds % 60).padStart(2, '0')
  const countdown = `${minutes}:${seconds} remaining`

  const isGrace = String(policy.currentPhase || '').toUpperCase() === 'GRACE'
  const graceWarning = isGrace && remainingSeconds <= 120

  const graceText = graceWarning ? ' · return soon' : ''
  const pauseText = isPaused ? ' · paused' : ''
  const text = `${phase}${graceText}${pauseText} · ${countdown}`

  return {
    text,
    countdown,
    remainingSeconds,
    isPaused,
    graceWarning,
  }
}

// Global attachment for browsers if loaded non-modularly
if (typeof globalThis !== 'undefined') {
  globalThis.ShinpoPopupLogic = {
    UI_STATES,
    APPROVED_THEMES,
    DEFAULT_THEME,
    THEME_STORAGE_KEY,
    normalizeTheme,
    deriveUiState,
    getControlStates,
    formatPhaseCountdown,
  }
}
