(function optionsController() {
  'use strict'
  const api = globalThis.browser || globalThis.chrome
  const pairingCode = document.getElementById('pairing-code')
  const reviewUrl = document.getElementById('review-url')
  const message = document.getElementById('message')

  document.getElementById('pair').addEventListener('click', () => act(async () => {
    await send({ type: 'PAIR', pairingCode: pairingCode.value })
    pairingCode.value = ''
    show('Browser paired successfully.')
  }))
  document.getElementById('save-url').addEventListener('click', () => act(async () => {
    const result = await send({ type: 'SET_REVIEW_URL', reviewUrl: reviewUrl.value })
    reviewUrl.value = result.reviewUrl
    show('Focus Rules destination saved.')
  }))

  async function act(operation) {
    show('')
    try { await operation() } catch (error) { show(error.message || 'Request failed', true) }
  }
  function show(value, error = false) {
    message.textContent = value
    message.classList.toggle('error', error)
  }
  async function send(payload) {
    const response = await api.runtime.sendMessage(payload)
    if (!response?.ok) throw new Error(response?.error?.message || 'Browser Companion request failed')
    return response.payload
  }
})()
