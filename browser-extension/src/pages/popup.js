(function popupController() {
  'use strict'
  const api = globalThis.browser || globalThis.chrome
  const elements = Object.fromEntries(
    ['status-dot', 'connection-label', 'connection-detail', 'focus-card', 'task-title', 'focus-mode',
      'phase-status', 'lease', 'pair-card', 'pairing-code', 'pair', 'monitoring', 'sync', 'options', 'disconnect', 'message']
      .map((id) => [id, document.getElementById(id)]),
  )
  let policy = null

  elements.pair.addEventListener('click', () => act(async () => {
    const status = await send({ type: 'PAIR', pairingCode: elements['pairing-code'].value })
    elements['pairing-code'].value = ''
    render(status)
  }))
  elements.sync.addEventListener('click', () => act(async () => render(await send({ type: 'SYNC_NOW' }))))
  elements.monitoring.addEventListener('change', () => act(async () => {
    render(await send({ type: 'SET_MONITORING_ENABLED', enabled: elements.monitoring.checked }))
  }))
  elements.disconnect.addEventListener('click', () => act(async () => render(await send({ type: 'DISCONNECT' }))))
  elements.options.addEventListener('click', () => api.runtime.openOptionsPage())

  act(async () => render(await send({ type: 'GET_STATUS' })))
  setInterval(renderPhaseCountdown, 1_000)

  function render(status) {
    policy = status.policy
    const connected = status.connection.state === 'CONNECTED'
    const unpaired = status.connection.state === 'UNPAIRED'
    elements['status-dot'].className = `status-dot ${connected ? 'connected' : (unpaired ? '' : 'degraded')}`
    elements['connection-label'].textContent = connected ? 'Connected to SHINPO' : (unpaired ? 'Pairing required' : 'Connection degraded')
    elements['connection-detail'].textContent = status.connection.error ||
      (connected ? `Policy source: ${status.connection.source || 'local host'}` : status.policy.degraded
        ? 'Only cached explicit restrictions remain. Other sites are not monitored until reconnect.'
        : 'No active browser policy is available; blocking is not being claimed.')
    elements['pair-card'].classList.toggle('hidden', !unpaired && status.connection.paired)
    elements['focus-card'].classList.toggle('hidden', !status.policy.sessionId)
    elements['task-title'].textContent = status.policy.taskTitle || 'Current Focus session'
    elements['focus-mode'].textContent = `${status.policy.mode || 'GUIDED'} FOCUS`
    renderPhaseCountdown()
    elements.lease.textContent = `Policy lease: ${status.policy.remainingLeaseSeconds}s remaining`
    elements.monitoring.checked = status.monitoringEnabled
    elements.sync.disabled = unpaired
    elements.disconnect.disabled = unpaired
  }

  function renderPhaseCountdown() {
    if (policy?.degraded) {
      elements['phase-status'].textContent = 'Policy expired · limited cached restrictions only'
      return
    }
    if (!policy || !policy.sessionId) {
      elements['phase-status'].textContent = 'No active Focus phase'
      return
    }
    const phase = String(policy.currentPhase || 'UNKNOWN').replaceAll('_', ' ').toLowerCase()
    const remaining = policy.phaseDeadlineAtMs
      ? Math.max(0, Math.ceil((policy.phaseDeadlineAtMs - Date.now()) / 1000))
      : policy.sessionStatus === 'PAUSED' ? policy.phaseRemainingSeconds : null
    const countdown = remaining === null
      ? 'syncing'
      : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`
    const graceWarning = policy.currentPhase === 'GRACE' && remaining !== null && remaining <= 120
      ? ' · return soon'
      : ''
    elements['phase-status'].textContent = `${phase}${graceWarning} · ${policy.sessionStatus === 'PAUSED' ? 'paused · ' : ''}${countdown}`
  }

  async function act(operation) {
    setMessage('')
    setBusy(true)
    try {
      await operation()
    } catch (error) {
      setMessage(error.message || 'Request failed', true)
    } finally {
      setBusy(false)
    }
  }

  function setBusy(busy) {
    elements.pair.disabled = busy
    elements.sync.disabled = busy
  }

  function setMessage(message, error = false) {
    elements.message.textContent = message
    elements.message.classList.toggle('error', error)
  }

  async function send(message) {
    const response = await api.runtime.sendMessage(message)
    if (!response?.ok) throw new Error(response?.error?.message || 'Browser Companion request failed')
    return response.payload
  }
})()
