import {
  deriveUiState,
  getControlStates,
  formatPhaseCountdown,
  normalizeTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  UI_STATES,
} from './popup-logic.js'

;(function popupController() {
  'use strict'

  const api = globalThis.browser || globalThis.chrome

  // DOM Elements map
  const ids = [
    'theme-select', 'status-pill', 'status-dot', 'connection-label',
    'status-alert', 'status-alert-text',
    'focus-card', 'focus-mode', 'paused-badge', 'lease', 'countdown-time', 'task-title', 'phase-status',
    'empty-focus-card', 'empty-focus-detail',
    'pair-card', 'pairing-code', 'pair',
    'monitoring-card', 'monitoring',
    'last-sync', 'connection-source', 'sync', 'options', 'disconnect',
    'message', 'disconnect-modal', 'cancel-disconnect', 'confirm-disconnect',
  ]
  const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]))

  // Local state
  let currentStatus = null
  let isBusy = false
  let syncInProgress = false
  let countdownTimerId = null

  // 1. Theme Management
  initTheme()

  function initTheme() {
    let savedTheme = DEFAULT_THEME
    try {
      savedTheme = normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY))
    } catch (_) {}

    applyTheme(savedTheme)

    if (api?.storage?.local) {
      api.storage.local.get([THEME_STORAGE_KEY], (items) => {
        if (items?.[THEME_STORAGE_KEY]) {
          applyTheme(normalizeTheme(items[THEME_STORAGE_KEY]))
        }
      })
    }

    el['theme-select'].value = savedTheme
    el['theme-select'].addEventListener('change', (e) => {
      const selected = normalizeTheme(e.target.value)
      applyTheme(selected)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, selected)
      } catch (_) {}
      if (api?.storage?.local) {
        api.storage.local.set({ [THEME_STORAGE_KEY]: selected })
      }
    })
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    if (el['theme-select']) el['theme-select'].value = theme
  }

  // 2. Action Listeners
  el.pair.addEventListener('click', () => act(async () => {
    const code = el['pairing-code'].value.trim()
    if (!code) {
      setMessage('Please enter a pairing code from SHINPO Desktop', true)
      el['pairing-code'].focus()
      return
    }
    setMessage('Pairing with SHINPO Desktop…')
    const status = await send({ type: 'PAIR', pairingCode: code })
    el['pairing-code'].value = ''
    setMessage('Paired successfully!', false)
    render(status)
  }))

  el.sync.addEventListener('click', () => act(async () => {
    syncInProgress = true
    updateControlStates()
    setMessage('Synchronizing Focus rules…')
    try {
      const status = await send({ type: 'SYNC_NOW' })
      setMessage('Synchronized with desktop app', false)
      render(status)
    } finally {
      syncInProgress = false
      updateControlStates()
    }
  }))

  el.monitoring.addEventListener('change', () => act(async () => {
    const enabled = el.monitoring.checked
    setMessage(enabled ? 'Enabling browser monitoring…' : 'Pausing browser monitoring…')
    const status = await send({ type: 'SET_MONITORING_ENABLED', enabled })
    render(status)
    setMessage(enabled ? 'Monitoring active' : 'Monitoring paused', false)
  }))

  el.options.addEventListener('click', () => {
    if (typeof api?.runtime?.openOptionsPage === 'function') {
      api.runtime.openOptionsPage()
    } else {
      window.open('options.html')
    }
  })

  // Disconnect Confirmation Dialog
  el.disconnect.addEventListener('click', () => {
    el['disconnect-modal'].classList.remove('hidden')
    el['cancel-disconnect'].focus()
  })

  el['cancel-disconnect'].addEventListener('click', () => {
    el['disconnect-modal'].classList.add('hidden')
  })

  el['confirm-disconnect'].addEventListener('click', () => act(async () => {
    el['disconnect-modal'].classList.add('hidden')
    setMessage('Disconnecting…')
    const status = await send({ type: 'DISCONNECT' })
    setMessage('Disconnected. Browser monitoring disabled.', false)
    render(status)
  }))

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el['disconnect-modal'].classList.contains('hidden')) {
      el['disconnect-modal'].classList.add('hidden')
    }
  })

  // 3. Initial Load
  act(async () => {
    const status = await send({ type: 'GET_STATUS' })
    render(status)
  }).catch((err) => {
    setMessage(`Failed to connect to extension background: ${err.message}`, true)
    render(null)
  })

  countdownTimerId = setInterval(renderPhaseCountdown, 1000)

  // 4. Render Engine
  function render(status) {
    currentStatus = status
    const uiState = deriveUiState(status, {
      busy: isBusy,
      syncInProgress,
    })

    const connected = status?.connection?.state === 'CONNECTED'
    const unpaired = status?.connection?.state === 'UNPAIRED'
    const disconnected = status?.connection?.state === 'DISCONNECTED'
    const degraded = status?.policy?.degraded === true

    // Status pill
    el['status-pill'].className = 'status-pill'
    if (connected && !degraded) {
      el['status-pill'].classList.add('connected')
      el['connection-label'].textContent = 'Connected'
    } else if (unpaired) {
      el['status-pill'].classList.add('warning')
      el['connection-label'].textContent = 'Unpaired'
    } else if (degraded) {
      el['status-pill'].classList.add('warning')
      el['connection-label'].textContent = 'Degraded'
    } else {
      el['status-pill'].classList.add('danger')
      el['connection-label'].textContent = 'Disconnected'
    }

    // Recoverable Alert banner
    if (unpaired) {
      el['status-alert'].className = 'alert alert-warning'
      el['status-alert-text'].textContent = 'Pairing required. No active Focus rules are protecting tabs.'
      el['status-alert'].classList.remove('hidden')
    } else if (degraded) {
      el['status-alert'].className = 'alert alert-warning'
      el['status-alert-text'].textContent = 'Policy lease expired. Only cached explicit restrictions remain active.'
      el['status-alert'].classList.remove('hidden')
    } else if (disconnected) {
      el['status-alert'].className = 'alert alert-error'
      el['status-alert-text'].textContent = status?.connection?.error || 'Native host unavailable. Ensure SHINPO Desktop is running.'
      el['status-alert'].classList.remove('hidden')
    } else if (status?.monitoringEnabled === false) {
      el['status-alert'].className = 'alert alert-warning'
      el['status-alert-text'].textContent = 'Monitoring is paused. Tabs are not being checked against Focus rules.'
      el['status-alert'].classList.remove('hidden')
    } else {
      el['status-alert'].classList.add('hidden')
    }

    // Card visibility
    el['pair-card'].classList.toggle('hidden', !unpaired)

    const hasActiveSession = Boolean(status?.policy?.active && status?.policy?.sessionId)
    el['focus-card'].classList.toggle('hidden', !hasActiveSession)
    el['empty-focus-card'].classList.toggle('hidden', hasActiveSession || unpaired)

    // Focus session fields
    if (hasActiveSession) {
      const mode = status.policy.mode || 'STANDARD'
      el['focus-mode'].textContent = `${mode} FOCUS`
      el['task-title'].textContent = status.policy.taskTitle || 'Focus Session'
      el['paused-badge'].classList.toggle('hidden', status.policy.sessionStatus !== 'PAUSED')

      const remainingLease = Number.isInteger(status.policy.remainingLeaseSeconds)
        ? `${status.policy.remainingLeaseSeconds}s`
        : '--'
      el.lease.textContent = `Lease: ${remainingLease}`
      renderPhaseCountdown()
    }

    // Monitoring switch
    el.monitoring.checked = Boolean(status?.monitoringEnabled)

    // Last sync & source
    if (status?.connection?.lastSyncAt) {
      const diffMs = Date.now() - new Date(status.connection.lastSyncAt).getTime()
      const diffMins = Math.floor(diffMs / 60000)
      el['last-sync'].textContent = diffMins < 1 ? 'Synced: just now' : `Synced: ${diffMins}m ago`
    } else {
      el['last-sync'].textContent = connected ? 'Synced: active' : 'Sync: not synced'
    }

    if (status?.connection?.source) {
      el['connection-source'].textContent = `Source: ${status.connection.source}`
    } else {
      el['connection-source'].textContent = 'Host: com.shinpo.companion'
    }

    updateControlStates()
  }

  function renderPhaseCountdown() {
    if (!currentStatus?.policy?.sessionId) return
    const formatted = formatPhaseCountdown(currentStatus.policy, Date.now())

    el['countdown-time'].textContent = formatted.countdown.replace(' remaining', '')
    el['phase-status'].textContent = formatted.text

    if (formatted.graceWarning) {
      el['phase-status'].classList.add('grace-warning')
    } else {
      el['phase-status'].classList.remove('grace-warning')
    }
  }

  function updateControlStates() {
    const states = getControlStates(currentStatus, {
      busy: isBusy,
      syncInProgress,
    })

    el.pair.disabled = states.pairDisabled
    el['pairing-code'].disabled = states.pairingCodeDisabled
    el.sync.disabled = states.syncDisabled
    el.disconnect.disabled = states.disconnectDisabled
    el.monitoring.disabled = states.monitoringDisabled

    if (syncInProgress) {
      el.sync.textContent = 'Syncing…'
    } else {
      el.sync.textContent = 'Sync now'
    }
  }

  async function act(operation) {
    isBusy = true
    updateControlStates()
    try {
      await operation()
    } catch (error) {
      setMessage(error.message || 'Operation failed', true)
      throw error
    } finally {
      isBusy = false
      updateControlStates()
    }
  }

  function setMessage(msg, error = false) {
    el.message.textContent = msg || ''
    el.message.className = `message ${error ? 'error' : 'success'}`
  }

  async function send(message) {
    const response = await api.runtime.sendMessage(message)
    if (!response?.ok) {
      throw new Error(response?.error?.message || 'Browser Companion request failed')
    }
    return response.payload
  }
})()
