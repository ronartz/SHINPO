(function popupController() {
  'use strict'
  const api = globalThis.browser || globalThis.chrome
  const elements = Object.fromEntries(
    ['status-dot', 'connection-label', 'connection-detail', 'focus-card', 'task-title', 'focus-mode',
      'lease', 'pair-card', 'pairing-code', 'pair', 'monitoring', 'sync', 'options', 'disconnect', 'message']
      .map((id) => [id, document.getElementById(id)]),
  )

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

  function render(status) {
    const connected = status.connection.state === 'CONNECTED'
    const unpaired = status.connection.state === 'UNPAIRED'
    elements['status-dot'].className = `status-dot ${connected ? 'connected' : (unpaired ? '' : 'degraded')}`
    elements['connection-label'].textContent = connected ? 'Connected to SHINPO' : (unpaired ? 'Pairing required' : 'Connection degraded')
    elements['connection-detail'].textContent = status.connection.error ||
      (connected ? `Policy source: ${status.connection.source || 'local host'}` : 'Restrictions expire automatically if SHINPO stays unavailable.')
    elements['pair-card'].classList.toggle('hidden', !unpaired && status.connection.paired)
    elements['focus-card'].classList.toggle('hidden', !status.policy.active)
    elements['task-title'].textContent = status.policy.taskTitle || 'Current Focus session'
    elements['focus-mode'].textContent = `${status.policy.mode || 'GUIDED'} FOCUS`
    elements.lease.textContent = `Policy lease: ${status.policy.remainingLeaseSeconds}s remaining`
    elements.monitoring.checked = status.monitoringEnabled
    elements.sync.disabled = unpaired
    elements.disconnect.disabled = unpaired
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
