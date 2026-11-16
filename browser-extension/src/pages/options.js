import {
  normalizeTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
} from './popup-logic.js'

;(function optionsController() {
  'use strict'

  const api = globalThis.browser || globalThis.chrome

  // DOM Elements
  const el = {
    themeSelect: document.getElementById('theme-select'),
    statusPill: document.getElementById('status-pill'),
    statusDot: document.getElementById('status-dot'),
    connectionLabel: document.getElementById('connection-label'),
    messageBanner: document.getElementById('message-banner'),
    messageText: document.getElementById('message-text'),
    optHostStatus: document.getElementById('opt-host-status'),
    optLastSync: document.getElementById('opt-last-sync'),
    pairingCode: document.getElementById('pairing-code'),
    pairBtn: document.getElementById('pair'),
    syncBtn: document.getElementById('sync-now'),
    disconnectBtn: document.getElementById('disconnect'),
    optMonitoring: document.getElementById('opt-monitoring'),
    reviewUrl: document.getElementById('review-url'),
    saveUrlBtn: document.getElementById('save-url'),
    diagHost: document.getElementById('diag-host'),
    diagState: document.getElementById('diag-state'),
    diagPolicyVersion: document.getElementById('diag-policy-version'),
    diagSessionId: document.getElementById('diag-session-id'),
    diagMode: document.getElementById('diag-mode'),
    diagLease: document.getElementById('diag-lease'),
    diagError: document.getElementById('diag-error'),
    disconnectModal: document.getElementById('disconnect-modal'),
    cancelDisconnect: document.getElementById('cancel-disconnect'),
    confirmDisconnect: document.getElementById('confirm-disconnect'),
  }

  // 1. Theme Initialization
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

    el.themeSelect.value = savedTheme
    el.themeSelect.addEventListener('change', (e) => {
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
    if (el.themeSelect) el.themeSelect.value = theme
  }

  // 2. Data Loading & Rendering
  refreshStatus()

  async function refreshStatus() {
    try {
      const status = await send({ type: 'GET_STATUS' })
      render(status)
    } catch (error) {
      show(`Failed to retrieve companion status: ${error.message}`, true)
      el.connectionLabel.textContent = 'Disconnected'
      el.statusPill.className = 'status-pill danger'
      el.optHostStatus.textContent = 'Host unreachable'
      el.diagState.textContent = 'DISCONNECTED'
      el.diagError.textContent = error.message || 'Unknown connection error'
      el.diagError.style.color = 'var(--status-danger)'
    }
  }

  function render(status) {
    if (!status) return

    const connected = status.connection?.state === 'CONNECTED'
    const unpaired = status.connection?.state === 'UNPAIRED'
    const degraded = status.policy?.degraded === true

    // Status pill
    el.statusPill.className = 'status-pill'
    if (connected && !degraded) {
      el.statusPill.classList.add('connected')
      el.connectionLabel.textContent = 'Connected'
      el.optHostStatus.textContent = 'Connected to SHINPO Desktop'
    } else if (unpaired) {
      el.statusPill.classList.add('warning')
      el.connectionLabel.textContent = 'Unpaired'
      el.optHostStatus.textContent = 'Pairing required'
    } else if (degraded) {
      el.statusPill.classList.add('warning')
      el.connectionLabel.textContent = 'Degraded'
      el.optHostStatus.textContent = 'Policy expired · cached restrictions only'
    } else {
      el.statusPill.classList.add('danger')
      el.connectionLabel.textContent = 'Disconnected'
      el.optHostStatus.textContent = status.connection?.error || 'Native host unavailable'
    }

    // Last sync
    if (status.connection?.lastSyncAt) {
      el.optLastSync.textContent = new Date(status.connection.lastSyncAt).toLocaleString()
    } else {
      el.optLastSync.textContent = connected ? 'Active session' : 'Not synchronized'
    }

    // Inputs & switches
    el.optMonitoring.checked = Boolean(status.monitoringEnabled)
    if (status.reviewUrl !== undefined) {
      el.reviewUrl.value = status.reviewUrl || ''
    }

    // Diagnostics
    el.diagState.textContent = status.connection?.state || 'UNKNOWN'
    el.diagPolicyVersion.textContent = status.policy?.policyVersion ?? 'None'
    el.diagSessionId.textContent = status.policy?.sessionId || 'None'
    el.diagMode.textContent = status.policy?.mode ? `${status.policy.mode} FOCUS` : 'None'
    el.diagLease.textContent = Number.isInteger(status.policy?.remainingLeaseSeconds)
      ? `${status.policy.remainingLeaseSeconds} seconds remaining`
      : 'None'

    if (status.connection?.error) {
      el.diagError.textContent = status.connection.error
      el.diagError.style.color = 'var(--status-danger)'
    } else {
      el.diagError.textContent = 'None (healthy)'
      el.diagError.style.color = 'var(--status-connected)'
    }

    // Button states
    el.syncBtn.disabled = unpaired
    el.disconnectBtn.disabled = unpaired
  }

  // 3. User Actions
  el.pairBtn.addEventListener('click', () => act(async () => {
    const code = el.pairingCode.value.trim()
    if (!code) {
      show('Please enter a pairing code from SHINPO Desktop', true)
      el.pairingCode.focus()
      return
    }
    show('Pairing with SHINPO Desktop…')
    const status = await send({ type: 'PAIR', pairingCode: code })
    el.pairingCode.value = ''
    render(status)
    show('Browser paired successfully with SHINPO Desktop!', false)
  }))

  el.syncBtn.addEventListener('click', () => act(async () => {
    show('Synchronizing Focus rules…')
    const status = await send({ type: 'SYNC_NOW' })
    render(status)
    show('Rules successfully synchronized.', false)
  }))

  el.optMonitoring.addEventListener('change', () => act(async () => {
    const enabled = el.optMonitoring.checked
    const status = await send({ type: 'SET_MONITORING_ENABLED', enabled })
    render(status)
    show(enabled ? 'Focus monitoring enabled.' : 'Focus monitoring paused.', false)
  }))

  el.saveUrlBtn.addEventListener('click', () => act(async () => {
    const url = el.reviewUrl.value.trim()
    show('Saving Focus rules destination…')
    const res = await send({ type: 'SET_REVIEW_URL', reviewUrl: url })
    el.reviewUrl.value = res.reviewUrl
    show('Focus rules destination saved.', false)
  }))

  // Disconnect Confirmation Modal
  el.disconnectBtn.addEventListener('click', () => {
    el.disconnectModal.classList.remove('hidden')
    el.cancelDisconnect.focus()
  })

  el.cancelDisconnect.addEventListener('click', () => {
    el.disconnectModal.classList.add('hidden')
  })

  el.confirmDisconnect.addEventListener('click', () => act(async () => {
    el.disconnectModal.classList.add('hidden')
    show('Disconnecting browser…')
    const status = await send({ type: 'DISCONNECT' })
    render(status)
    show('Disconnected. Pairing token removed.', false)
  }))

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.disconnectModal.classList.contains('hidden')) {
      el.disconnectModal.classList.add('hidden')
    }
  })

  // Helpers
  async function act(operation) {
    show('')
    try {
      await operation()
    } catch (error) {
      show(error.message || 'Operation failed', true)
      throw error
    }
  }

  function show(text, isError = false) {
    if (!text) {
      el.messageBanner.classList.add('hidden')
      return
    }
    el.messageText.textContent = text
    el.messageBanner.className = `alert ${isError ? 'alert-error' : 'alert-info'}`
    el.messageBanner.classList.remove('hidden')
  }

  async function send(payload) {
    const response = await api.runtime.sendMessage(payload)
    if (!response?.ok) {
      throw new Error(response?.error?.message || 'Browser Companion request failed')
    }
    return response.payload
  }
})()
