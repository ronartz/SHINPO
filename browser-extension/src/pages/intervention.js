(function interventionController() {
  'use strict'
  const api = globalThis.browser || globalThis.chrome
  const interventionId = decodeURIComponent(location.hash.slice(1))
  const elements = Object.fromEntries(
    ['task-title', 'reason', 'destination', 'return', 'allow', 'review', 'confirmation', 'confirm-allow', 'message']
      .map((id) => [id, document.getElementById(id)]),
  )
  let intervention = null

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

  act(async () => {
    intervention = await send({ type: 'GET_INTERVENTION', interventionId })
    elements['task-title'].textContent = intervention.taskTitle
    elements.reason.textContent = intervention.reason
    elements.destination.textContent = intervention.destinationHost
    elements.allow.disabled = !intervention.canRequestException
    elements.return.disabled = !intervention.canReturn
  })

  async function requestException() {
    await act(async () => {
      setMessage('Requesting a resource-scoped exception…')
      await send({ type: 'REQUEST_EXCEPTION', interventionId })
    })
  }

  async function act(operation) {
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
    elements.return.disabled = busy
    elements.allow.disabled = busy
    elements.review.disabled = busy
    elements['confirm-allow'].disabled = busy
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
