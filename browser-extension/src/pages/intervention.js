(function interventionController() {
  'use strict'

  const api = globalThis.browser || globalThis.chrome
  const interventionId = decodeURIComponent(location.hash.slice(1))
  const elements = Object.fromEntries(
    ['task-title', 'focus-mode', 'reason', 'destination', 'return', 'allow', 'review', 'confirmation', 'confirm-allow', 'message']
      .map((id) => [id, document.getElementById(id)]),
  )
  let intervention = null
  let isOperating = false

  elements.return.addEventListener('click', () => act(() => send({ type: 'RETURN_TO_STUDY', interventionId })))
  elements.review.addEventListener('click', () => act(() => send({ type: 'REVIEW_RULES' })))

  elements.allow.addEventListener('click', () => {
    if (intervention?.mode === 'STRICT') {
      elements.confirmation.classList.remove('hidden')
      elements['confirm-allow'].focus()
    } else {
      void requestException()
    }
  })

  elements['confirm-allow'].addEventListener('click', () => requestException())

  // Initial load
  act(async () => {
    intervention = await send({ type: 'GET_INTERVENTION', interventionId })
    elements['task-title'].textContent = intervention.taskTitle || 'Focus task'
    if (elements['focus-mode']) {
      elements['focus-mode'].textContent = `${intervention.mode || 'STANDARD'} FOCUS`
    }
    elements.reason.textContent = intervention.reason || 'This website is not listed in your approved focus plan.'
    elements.destination.textContent = intervention.destinationHost || intervention.destination || 'External Resource'
    updateButtonStates()
    elements.return.focus()
  })

  async function requestException() {
    await act(async () => {
      setMessage('Requesting temporary 5-minute exception from SHINPO…')
      await send({ type: 'REQUEST_EXCEPTION', interventionId })
      setMessage('Exception granted. Navigating to resource…', false)
    })
  }

  async function act(operation) {
    setBusy(true)
    try {
      await operation()
    } catch (error) {
      setMessage(error.message || 'Request failed', true)
      throw error
    } finally {
      setBusy(false)
    }
  }

  function updateButtonStates() {
    const canRequest = Boolean(intervention?.canRequestException)
    const canReturn = Boolean(intervention ? intervention.canReturn : true)

    elements.return.disabled = isOperating || !canReturn
    elements.allow.disabled = isOperating || !canRequest
    elements.review.disabled = isOperating
    elements['confirm-allow'].disabled = isOperating
  }

  function setBusy(busy) {
    isOperating = busy
    updateButtonStates()
  }

  function setMessage(message, error = false) {
    elements.message.textContent = message || ''
    elements.message.className = `message ${error ? 'error' : 'success'}`
  }

  async function send(message) {
    const response = await api.runtime.sendMessage(message)
    if (!response?.ok) {
      throw new Error(response?.error?.message || 'Browser Companion request failed')
    }
    return response.payload
  }
})()
