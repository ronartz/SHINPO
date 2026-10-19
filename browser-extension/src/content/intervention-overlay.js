(function installShinpoInterventionOverlay() {
  'use strict'
  if (globalThis.__shinpoInterventionOverlayInstalled) return
  globalThis.__shinpoInterventionOverlayInstalled = true
  const api = globalThis.browser || globalThis.chrome
  let host = null

  api.runtime.onMessage.addListener((message) => {
    if (message?.type === 'HIDE_SHINPO_INTERVENTION') {
      host?.remove()
      host = null
      return
    }
    if (message?.type !== 'SHOW_SHINPO_INTERVENTION' || !validPayload(message.intervention)) return
    render(message.intervention)
  })

  function render(intervention) {
    host?.remove()
    host = document.createElement('div')
    host.id = 'shinpo-contextual-focus-intervention'
    host.style.cssText = intervention.blocking
      ? 'all:initial;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(7,10,20,.72);backdrop-filter:blur(6px)'
      : 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483647;width:min(420px,calc(100vw - 32px))'
    const root = host.attachShadow({ mode: 'closed' })
    const panel = document.createElement('section')
    panel.setAttribute('role', intervention.blocking ? 'dialog' : 'status')
    panel.setAttribute('aria-modal', String(intervention.blocking))
    panel.style.cssText = 'box-sizing:border-box;padding:18px;border:1px solid rgba(174,183,208,.24);border-radius:14px;background:#141827;color:#f7f8ff;box-shadow:0 18px 60px rgba(0,0,0,.42);font:14px/1.45 Inter,system-ui,sans-serif'

    const eyebrow = element('div', intervention.blocking ? 'SHINPO · FOCUS PROTECTION' : 'SHINPO · FOCUS CHECK')
    eyebrow.style.cssText = 'color:#1bc9de;font-size:10px;font-weight:800;letter-spacing:.12em'
    const title = element('h2', intervention.blocking
      ? 'This page is outside your current focus plan'
      : 'Pause and check this destination')
    title.style.cssText = 'margin:8px 0;font:700 18px/1.25 Inter,system-ui,sans-serif;color:#f7f8ff'
    const task = element('p', `Current task: ${intervention.taskTitle}`)
    task.style.cssText = 'margin:5px 0;color:#dce2f3'
    const reason = element('p', intervention.reason)
    reason.style.cssText = 'margin:5px 0 12px;color:#aeb7d0'
    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px'

    if (intervention.canReturn) actions.append(button('Return to Study', 'RETURN', true))
    if (intervention.canRequestException) actions.append(button('Allow for 5 Minutes', 'EXCEPTION'))
    actions.append(button('Review Focus Rules', 'REVIEW'))
    if (!intervention.blocking) actions.append(button('Dismiss', 'DISMISS'))

    panel.append(eyebrow, title, task, reason, actions)
    root.append(panel)
    ;(document.documentElement || document.body).append(host)

    function button(label, action, primary = false) {
      const control = element('button', label)
      control.type = 'button'
      control.style.cssText = `box-sizing:border-box;padding:8px 10px;border-radius:8px;border:${primary ? '0' : '1px solid rgba(174,183,208,.28)'};background:${primary ? 'linear-gradient(120deg,#9757fa,#4d77f9)' : '#1d2337'};color:#f7f8ff;font:650 12px Inter,system-ui,sans-serif;cursor:pointer`
      control.addEventListener('click', async () => {
        control.disabled = true
        try {
          const response = await api.runtime.sendMessage({
            type: 'OVERLAY_ACTION',
            interventionId: intervention.id,
            action,
          })
          if (!response?.ok) throw new Error(response?.error?.message || 'Action failed')
          if (action === 'DISMISS' || action === 'EXCEPTION') host?.remove()
        } catch (error) {
          reason.textContent = error.message || 'Action failed'
          reason.style.color = '#f59e7b'
        } finally {
          control.disabled = false
        }
      })
      return control
    }
  }

  function element(tagName, text) {
    const node = document.createElement(tagName)
    node.textContent = text
    return node
  }

  function validPayload(value) {
    return value && typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.taskTitle === 'string' &&
      typeof value.reason === 'string' &&
      typeof value.blocking === 'boolean'
  }
})()
