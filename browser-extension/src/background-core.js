(function startBrowserCompanion(global) {
  'use strict'

  const api = global.browser || global.chrome
  const policyEngine = global.ShinpoPolicy
  const nativeProtocol = global.ShinpoNativeProtocol
  const canonical = global.ShinpoCanonical

  if (!api || !policyEngine || !nativeProtocol || !canonical) {
    throw new Error('SHINPO Browser Companion failed to initialize')
  }

  const STORAGE_KEYS = Object.freeze({
    PAIRING_TOKEN: 'pairingToken',
    CACHED_POLICY: 'cachedPolicy',
    MONITORING_ENABLED: 'monitoringEnabled',
    REVIEW_URL: 'reviewUrl',
    INTERVENTIONS: 'interventions',
  })
  const SYNC_ALARM = 'shinpo-policy-sync'
  const LEASE_ALARM = 'shinpo-policy-lease-expiry'
  const MAX_INTERVENTIONS = 32
  const DEFAULT_REVIEW_URL = 'http://127.0.0.1:5173/focus'

  const state = {
    ready: false,
    pairingToken: null,
    monitoringEnabled: true,
    policy: policyEngine.inactivePolicy('Browser Companion is starting'),
    connection: {
      state: 'DISCONNECTED',
      paired: false,
      lastSyncAt: null,
      error: null,
      source: null,
    },
    reviewUrl: DEFAULT_REVIEW_URL,
    lastAllowedByTab: new Map(),
    evaluatingByTab: new Map(),
  }

  initialize().catch((error) => {
    console.error('[SHINPO] Browser Companion initialization failed', error)
  })

  async function initialize() {
    const stored = await storageGet('local', [
      STORAGE_KEYS.PAIRING_TOKEN,
      STORAGE_KEYS.CACHED_POLICY,
      STORAGE_KEYS.MONITORING_ENABLED,
      STORAGE_KEYS.REVIEW_URL,
    ])
    state.pairingToken = nativeProtocol.isPairingToken(stored[STORAGE_KEYS.PAIRING_TOKEN])
      ? stored[STORAGE_KEYS.PAIRING_TOKEN]
      : null
    state.monitoringEnabled = stored[STORAGE_KEYS.MONITORING_ENABLED] !== false
    state.reviewUrl = safeReviewUrl(stored[STORAGE_KEYS.REVIEW_URL]) || DEFAULT_REVIEW_URL

    const cached = policyEngine.normalizePolicy(stored[STORAGE_KEYS.CACHED_POLICY])
    state.policy = cached.active && state.pairingToken
      ? cached
      : policyEngine.inactivePolicy(cached.inactiveReason || 'No valid cached policy')
    state.ready = true

    await configureAlarms()
    await updateAction()
    if (state.pairingToken) await synchronizePolicy()
  }

  async function configureAlarms() {
    await apiCall('alarms', 'create', SYNC_ALARM, { periodInMinutes: 0.5 })
    await scheduleLeaseAlarm()
  }

  async function scheduleLeaseAlarm() {
    await apiCall('alarms', 'clear', LEASE_ALARM)
    if (state.policy.active && state.policy.leaseExpiresAtMs > Date.now()) {
      await apiCall('alarms', 'create', LEASE_ALARM, { when: state.policy.leaseExpiresAtMs + 25 })
    }
  }

  api.runtime.onInstalled.addListener(() => {
    initialize().catch((error) => console.warn('[SHINPO] install initialization failed', error))
  })

  api.runtime.onStartup.addListener(() => {
    initialize().catch((error) => console.warn('[SHINPO] startup initialization failed', error))
  })

  api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM) {
      synchronizePolicy().catch((error) => markDisconnected(error))
    } else if (alarm.name === LEASE_ALARM) {
      retireExpiredPolicy().catch((error) => console.warn('[SHINPO] lease cleanup failed', error))
    }
  })

  api.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) void handleNavigation(details.tabId, details.url, 'committed-navigation')
  })
  api.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId === 0) void handleNavigation(details.tabId, details.url, 'history-state')
  })
  if (api.webNavigation.onReferenceFragmentUpdated) {
    api.webNavigation.onReferenceFragmentUpdated.addListener((details) => {
      if (details.frameId === 0) void handleNavigation(details.tabId, details.url, 'fragment')
    })
  }

  api.tabs.onRemoved.addListener((tabId) => {
    state.lastAllowedByTab.delete(tabId)
    state.evaluatingByTab.delete(tabId)
  })

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    routeMessage(message, sender)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({
        ok: false,
        error: {
          code: error.code || 'REQUEST_FAILED',
          message: safeErrorMessage(error),
        },
      }))
    return true
  })

  async function routeMessage(message, sender) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      throw codedError('INVALID_MESSAGE', 'Invalid extension message')
    }

    switch (message.type) {
      case 'PAGE_NAVIGATION':
        return handleContentNavigation(message, sender)
      case 'GET_PAGE_SETTINGS':
        return pageSettings(sender)
      case 'GET_STATUS':
        requireExtensionPage(sender)
        return publicStatus()
      case 'PAIR':
        requireExtensionPage(sender)
        return pair(message.pairingCode)
      case 'SYNC_NOW':
        requireExtensionPage(sender)
        await synchronizePolicy()
        return publicStatus()
      case 'SET_MONITORING_ENABLED':
        requireExtensionPage(sender)
        return setMonitoringEnabled(message.enabled)
      case 'SET_REVIEW_URL':
        requireExtensionPage(sender)
        return setReviewUrl(message.reviewUrl)
      case 'DISCONNECT':
        requireExtensionPage(sender)
        return disconnectExtension()
      case 'GET_INTERVENTION':
        requireExtensionPage(sender)
        return getIntervention(message.interventionId)
      case 'RETURN_TO_STUDY':
        requireExtensionPage(sender)
        return returnToStudy(message.interventionId, sender.tab?.id)
      case 'REQUEST_EXCEPTION':
        requireExtensionPage(sender)
        return requestTemporaryException(message.interventionId, sender.tab?.id)
      case 'REVIEW_RULES':
        requireExtensionPage(sender)
        return reviewRules()
      case 'OVERLAY_ACTION':
        return handleOverlayAction(message, sender)
      default:
        throw codedError('UNKNOWN_MESSAGE', 'Unsupported extension message type')
    }
  }

  async function handleContentNavigation(message, sender) {
    if (!Number.isInteger(sender.tab?.id) || typeof message.url !== 'string') {
      throw codedError('INVALID_SENDER', 'Navigation message did not originate from a browser tab')
    }
    const destination = canonical.canonicalizeUrl(message.url)
    const senderUrl = canonical.canonicalizeUrl(sender.tab.url || message.url)
    if (!destination.ok || !senderUrl.ok || destination.origin !== senderUrl.origin) {
      throw codedError('INVALID_NAVIGATION', 'Navigation origin did not match the sender tab')
    }
    return handleNavigation(sender.tab.id, destination.url, 'content-script')
  }

  function pageSettings(sender) {
    const source = canonical.parseYouTubeResource(sender.tab?.url || sender.url || '')
    if (!source) throw codedError('INVALID_SENDER', 'Page settings are only available to supported adapters')
    return {
      active: state.monitoringEnabled && state.policy.active,
      policyVersion: state.policy.policyVersion,
      hideRecommendations: state.policy.adapterSettings.youtube.hideRecommendations,
    }
  }

  async function handleNavigation(tabId, url, source) {
    if (!state.ready || !state.monitoringEnabled || tabId < 0 || isExtensionUrl(url)) {
      return { decision: 'INACTIVE' }
    }
    if (state.policy.active && state.policy.leaseExpiresAtMs <= Date.now()) {
      await retireExpiredPolicy()
    }

    const evaluationKey = `${url}|${state.policy.policyVersion}`
    if (state.evaluatingByTab.get(tabId) === evaluationKey) {
      return { decision: 'UNCHANGED' }
    }
    state.evaluatingByTab.set(tabId, evaluationKey)

    const result = policyEngine.evaluateUrl(state.policy, url)
    if (result.decision === policyEngine.DECISIONS.ALLOW) {
      state.lastAllowedByTab.set(tabId, result.normalizedDestination)
      await apiCall('tabs', 'sendMessage', tabId, { type: 'HIDE_SHINPO_INTERVENTION' }).catch(() => undefined)
      await setTabBadge(tabId, '', null)
    } else if (result.decision === policyEngine.DECISIONS.RESTRICT) {
      await presentIntervention(tabId, result, source, true)
    } else if (result.decision === policyEngine.DECISIONS.WARN) {
      await setTabBadge(tabId, '!', '#d97706')
      await presentIntervention(tabId, result, source, false)
    } else if (result.decision === policyEngine.DECISIONS.UNCERTAIN) {
      await setTabBadge(tabId, '?', '#64748b')
      if (state.policy.mode !== 'GUIDED') await presentIntervention(tabId, result, source, false)
    } else {
      await setTabBadge(tabId, '', null)
    }
    await updateAction()
    return { decision: result.decision, reason: result.reason }
  }

  async function presentIntervention(tabId, evaluation, source, blocking) {
    const interventionId = crypto.randomUUID()
    const intervention = {
      id: interventionId,
      tabId,
      destination: evaluation.normalizedDestination,
      taskTitle: evaluation.taskTitle,
      reason: evaluation.reason,
      mode: evaluation.mode,
      sessionId: evaluation.sessionId,
      policyVersion: evaluation.policyVersion,
      returnUrl: evaluation.returnUrl || state.lastAllowedByTab.get(tabId) || null,
      source,
      createdAt: Date.now(),
      expiresAt: Math.min(state.policy.leaseExpiresAtMs, Date.now() + 10 * 60 * 1000),
      blocking,
    }
    await saveIntervention(intervention)
    try {
      await apiCall('scripting', 'executeScript', {
        target: { tabId },
        files: ['content/intervention-overlay.js'],
      })
      await apiCall('tabs', 'sendMessage', tabId, {
        type: 'SHOW_SHINPO_INTERVENTION',
        intervention: {
          id: interventionId,
          taskTitle: intervention.taskTitle,
          reason: intervention.reason,
          destinationHost: canonical.canonicalizeUrl(intervention.destination).host,
          mode: intervention.mode,
          blocking,
          canReturn: true,
          canRequestException: blocking && state.policy.active,
        },
      })
    } catch (error) {
      if (!blocking) return
      // Browser-owned/restricted pages cannot receive scripts. The extension page is
      // a fail-closed fallback and retains the original URL for Return to Study.
      const interventionUrl = api.runtime.getURL(`pages/intervention.html#${encodeURIComponent(interventionId)}`)
      await apiCall('tabs', 'update', tabId, { url: interventionUrl })
    }
    if (blocking) await setTabBadge(tabId, '', null)
  }

  async function handleOverlayAction(message, sender) {
    if (!Number.isInteger(sender.tab?.id)) {
      throw codedError('INVALID_SENDER', 'Overlay action did not originate from a browser tab')
    }
    const intervention = await getIntervention(message.interventionId)
    if (intervention.tabId !== sender.tab.id) {
      throw codedError('INVALID_SENDER', 'Overlay action tab did not match its intervention')
    }
    switch (message.action) {
      case 'RETURN':
        return returnToStudy(message.interventionId, sender.tab.id)
      case 'EXCEPTION':
        return requestTemporaryException(message.interventionId, sender.tab.id, false)
      case 'REVIEW':
        return reviewRules()
      case 'DISMISS':
        if (intervention.blocking) {
          throw codedError('RESTRICTION_ACTIVE', 'A restricted-resource intervention cannot be dismissed')
        }
        return { dismissed: true }
      default:
        throw codedError('INVALID_ACTION', 'Unsupported intervention action')
    }
  }

  async function pair(pairingCode) {
    const normalizedCode = typeof pairingCode === 'string' ? pairingCode.trim() : ''
    if (!nativeProtocol.isPairingToken(normalizedCode)) {
      throw codedError('INVALID_PAIRING_CODE', 'Enter the pairing code printed by the SHINPO host installer')
    }
    await nativeRequest('pair', {}, normalizedCode)
    state.pairingToken = normalizedCode
    state.connection.paired = true
    await storageSet('local', { [STORAGE_KEYS.PAIRING_TOKEN]: normalizedCode })
    await synchronizePolicy()
    return publicStatus()
  }

  async function synchronizePolicy() {
    if (!state.ready || !state.pairingToken) {
      state.connection = {
        state: 'UNPAIRED', paired: false, lastSyncAt: null, error: null, source: null,
      }
      state.policy = policyEngine.inactivePolicy('Browser Companion is not paired')
      await persistPolicy()
      return
    }

    try {
      const payload = await nativeRequest('get_policy')
      const rawPolicy = payload.policy || payload.snapshot || null
      const incoming = policyEngine.normalizePolicy(rawPolicy)
      if (isStalePolicy(incoming, state.policy)) {
        throw codedError('STALE_POLICY', 'Native host returned an older policy revision')
      }

      const previousSessionId = state.policy.sessionId
      state.policy = incoming
      state.connection = {
        state: payload.connection?.state || 'CONNECTED',
        paired: true,
        lastSyncAt: new Date().toISOString(),
        error: null,
        source: payload.connection?.source || null,
      }
      if (safeReviewUrl(payload.reviewUrl)) state.reviewUrl = safeReviewUrl(payload.reviewUrl)
      await persistPolicy()
      await scheduleLeaseAlarm()
      await updateAction()

      if (!incoming.active && previousSessionId) await releaseInterventionTabs()
      else if (incoming.active) await enforceOpenTabs()
    } catch (error) {
      await markDisconnected(error)
      if (state.policy.leaseExpiresAtMs <= Date.now()) await retireExpiredPolicy()
      throw error
    }
  }

  async function requestTemporaryException(interventionId, senderTabId, navigate = true) {
    const intervention = await getIntervention(interventionId)
    if (!state.policy.active || intervention.sessionId !== state.policy.sessionId) {
      throw codedError('SESSION_INACTIVE', 'The Focus session is no longer active')
    }
    const payload = await nativeRequest('request_exception', {
      sessionId: intervention.sessionId,
      destination: intervention.destination,
      durationMinutes: 5,
      expectedPolicyVersion: intervention.policyVersion,
    })
    const incoming = policyEngine.normalizePolicy(payload.policy || payload.snapshot)
    if (!incoming.active || incoming.sessionId !== state.policy.sessionId) {
      throw codedError('INVALID_POLICY', 'SHINPO did not return a valid refreshed policy')
    }
    state.policy = incoming
    await persistPolicy()
    await scheduleLeaseAlarm()
    const verification = policyEngine.evaluateUrl(state.policy, intervention.destination)
    if (verification.decision !== policyEngine.DECISIONS.ALLOW) {
      throw codedError('EXCEPTION_NOT_APPLIED', 'The temporary exception was not applied to this resource')
    }
    const targetTabId = Number.isInteger(senderTabId) ? senderTabId : intervention.tabId
    if (navigate) await apiCall('tabs', 'update', targetTabId, { url: intervention.destination })
    return { expiresAt: matchedExceptionExpiry(state.policy, intervention.destination) }
  }

  async function returnToStudy(interventionId, senderTabId) {
    const intervention = await getIntervention(interventionId)
    const destination = canonical.canonicalizeUrl(intervention.returnUrl || '')
    const targetTabId = Number.isInteger(senderTabId) ? senderTabId : intervention.tabId
    if (destination.ok) {
      await apiCall('tabs', 'update', targetTabId, { url: destination.url })
      return { destination: destination.url }
    }
    try {
      await apiCall('tabs', 'goBack', targetTabId)
      return { destination: null }
    } catch {
      throw codedError('NO_RETURN_DESTINATION', 'No approved study resource is available yet')
    }
  }

  async function reviewRules() {
    const target = safeReviewUrl(state.reviewUrl)
    if (!target) throw codedError('INVALID_REVIEW_URL', 'The Focus Rules URL is not configured safely')
    await apiCall('tabs', 'create', { url: target })
    return { opened: true }
  }

  async function setMonitoringEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw codedError('INVALID_SETTING', 'Monitoring setting must be true or false')
    state.monitoringEnabled = enabled
    await storageSet('local', { [STORAGE_KEYS.MONITORING_ENABLED]: enabled })
    if (!enabled) await releaseInterventionTabs()
    await updateAction()
    return publicStatus()
  }

  async function setReviewUrl(reviewUrl) {
    const normalized = safeReviewUrl(reviewUrl)
    if (!normalized) {
      throw codedError('INVALID_REVIEW_URL', 'Use HTTPS, or HTTP only for localhost/loopback')
    }
    state.reviewUrl = normalized
    await storageSet('local', { [STORAGE_KEYS.REVIEW_URL]: normalized })
    return { reviewUrl: normalized }
  }

  async function disconnectExtension() {
    state.pairingToken = null
    state.policy = policyEngine.inactivePolicy('Browser Companion was disconnected')
    state.connection = {
      state: 'UNPAIRED', paired: false, lastSyncAt: null, error: null, source: null,
    }
    await storageRemove('local', [STORAGE_KEYS.PAIRING_TOKEN, STORAGE_KEYS.CACHED_POLICY])
    await releaseInterventionTabs()
    await scheduleLeaseAlarm()
    await updateAction()
    return publicStatus()
  }

  async function retireExpiredPolicy() {
    if (state.policy.active && state.policy.leaseExpiresAtMs > Date.now()) return
    const hadSession = Boolean(state.policy.sessionId)
    state.policy = policyEngine.inactivePolicy('The Focus policy lease expired')
    await persistPolicy()
    await scheduleLeaseAlarm()
    await updateAction()
    if (hadSession) await releaseInterventionTabs()
  }

  async function releaseInterventionTabs() {
    const interventions = await loadInterventions()
    const openTabs = await apiCall('tabs', 'query', {})
    for (const tab of openTabs || []) {
      if (!Number.isInteger(tab.id)) continue
      if (!isInterventionUrl(tab.url || '')) {
        await apiCall('tabs', 'sendMessage', tab.id, { type: 'HIDE_SHINPO_INTERVENTION' }).catch(() => undefined)
        continue
      }
      const interventionId = extractInterventionId(tab.url)
      const intervention = interventions[interventionId]
      const original = canonical.canonicalizeUrl(intervention?.destination || '')
      if (original.ok) {
        await apiCall('tabs', 'update', tab.id, { url: original.url }).catch(() => undefined)
      }
    }
    await storageSet('session', { [STORAGE_KEYS.INTERVENTIONS]: {} })
  }

  async function enforceOpenTabs() {
    const tabs = await apiCall('tabs', 'query', {})
    await Promise.all((tabs || [])
      .filter((tab) => Number.isInteger(tab.id) && canonical.canonicalizeUrl(tab.url || '').ok)
      .map((tab) => handleNavigation(tab.id, tab.url, 'policy-sync').catch(() => undefined)))
  }

  async function saveIntervention(intervention) {
    const existing = await loadInterventions()
    existing[intervention.id] = intervention
    const retained = Object.fromEntries(
      Object.entries(existing)
        .filter(([, value]) => value && value.expiresAt > Date.now())
        .sort(([, left], [, right]) => right.createdAt - left.createdAt)
        .slice(0, MAX_INTERVENTIONS),
    )
    await storageSet('session', { [STORAGE_KEYS.INTERVENTIONS]: retained })
  }

  async function getIntervention(interventionId) {
    if (typeof interventionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(interventionId)) {
      throw codedError('INVALID_INTERVENTION', 'Invalid intervention identifier')
    }
    const interventions = await loadInterventions()
    const intervention = interventions[interventionId]
    if (!intervention || intervention.expiresAt <= Date.now()) {
      throw codedError('INTERVENTION_EXPIRED', 'This intervention is no longer active')
    }
    return {
      id: intervention.id,
      taskTitle: intervention.taskTitle,
      reason: intervention.reason,
      mode: intervention.mode,
      destinationHost: canonical.canonicalizeUrl(intervention.destination).host,
      canReturn: true,
      canRequestException: state.policy.active && intervention.sessionId === state.policy.sessionId,
      sessionId: intervention.sessionId,
      destination: intervention.destination,
      returnUrl: intervention.returnUrl,
      policyVersion: intervention.policyVersion,
      tabId: intervention.tabId,
      expiresAt: intervention.expiresAt,
      blocking: intervention.blocking,
    }
  }

  async function loadInterventions() {
    const stored = await storageGet('session', [STORAGE_KEYS.INTERVENTIONS])
    const interventions = stored[STORAGE_KEYS.INTERVENTIONS]
    return interventions && typeof interventions === 'object' ? interventions : {}
  }

  async function nativeRequest(type, payload = {}, tokenOverride = null) {
    const token = tokenOverride || state.pairingToken
    const request = nativeProtocol.createRequest(type, payload, token)
    const response = await apiCall('runtime', 'sendNativeMessage', nativeProtocol.HOST_NAME, request)
    return nativeProtocol.validateResponse(response, request.requestId)
  }

  async function persistPolicy() {
    await storageSet('local', { [STORAGE_KEYS.CACHED_POLICY]: state.policy })
  }

  async function markDisconnected(error) {
    state.connection.state = 'DISCONNECTED'
    state.connection.error = safeErrorMessage(error)
    await updateAction()
  }

  function publicStatus() {
    const remainingLeaseSeconds = state.policy.active
      ? Math.max(0, Math.floor((state.policy.leaseExpiresAtMs - Date.now()) / 1000))
      : 0
    return {
      connection: { ...state.connection },
      monitoringEnabled: state.monitoringEnabled,
      policy: {
        active: state.policy.active,
        sessionId: state.policy.sessionId,
        taskTitle: state.policy.taskTitle,
        mode: state.policy.mode,
        policyVersion: state.policy.policyVersion,
        remainingLeaseSeconds,
        inactiveReason: state.policy.inactiveReason,
      },
      capabilities: {
        youtube: 'ROUTE_AND_UI',
        discordWeb: 'VALIDATED_ROUTE',
        discordDesktop: 'PROCESS_ONLY',
        instagram: 'LIMITED_ROUTE',
        genericWeb: 'EXPLICIT_RULES',
      },
    }
  }

  async function updateAction() {
    if (!api.action) return
    let text = ''
    let color = '#64748b'
    let title = 'SHINPO Browser Companion: disconnected'
    if (!state.monitoringEnabled) {
      text = 'OFF'
      title = 'SHINPO Browser Companion: monitoring disabled'
    } else if (state.connection.state === 'CONNECTED' && state.policy.active) {
      text = 'ON'
      color = '#4D77F9'
      title = `SHINPO ${state.policy.mode}: ${state.policy.taskTitle}`
    } else if (state.connection.state === 'CONNECTED') {
      color = '#1BC9DE'
      title = 'SHINPO Browser Companion: connected, no active Focus session'
    } else if (state.connection.state === 'UNPAIRED') {
      text = '!'
      color = '#9757FA'
      title = 'SHINPO Browser Companion: pairing required'
    } else {
      text = '!'
      color = '#d97706'
    }
    await apiCall('action', 'setBadgeText', { text }).catch(() => undefined)
    await apiCall('action', 'setBadgeBackgroundColor', { color }).catch(() => undefined)
    await apiCall('action', 'setTitle', { title }).catch(() => undefined)
  }

  async function setTabBadge(tabId, text, color) {
    if (!api.action) return
    await apiCall('action', 'setBadgeText', { tabId, text }).catch(() => undefined)
    if (color) await apiCall('action', 'setBadgeBackgroundColor', { tabId, color }).catch(() => undefined)
  }

  function isStalePolicy(incoming, current) {
    return incoming.active && current.active &&
      incoming.sessionId === current.sessionId &&
      incoming.policyVersion < current.policyVersion &&
      current.leaseExpiresAtMs > Date.now()
  }

  function matchedExceptionExpiry(policy, destination) {
    const match = policy.resources.find((resource) =>
      resource.temporary && resource.disposition === 'APPROVED' &&
      policyEngine.resourceMatches(resource, destination))
    return match?.expiresAtMs || null
  }

  function requireExtensionPage(sender) {
    const senderUrl = sender.url || ''
    if (!senderUrl.startsWith(api.runtime.getURL(''))) {
      throw codedError('INVALID_SENDER', 'This action is only available from a Browser Companion page')
    }
  }

  function isExtensionUrl(url) {
    return typeof url === 'string' && url.startsWith(api.runtime.getURL(''))
  }

  function isInterventionUrl(url) {
    return typeof url === 'string' && url.startsWith(api.runtime.getURL('pages/intervention.html'))
  }

  function extractInterventionId(url) {
    try {
      return decodeURIComponent(new URL(url).hash.slice(1))
    } catch {
      return ''
    }
  }

  function safeReviewUrl(value) {
    const parsed = canonical.canonicalizeUrl(value || '')
    if (!parsed.ok) return null
    const loopback = parsed.host === 'localhost' || parsed.host === '127.0.0.1' || parsed.host === '::1'
    if (parsed.scheme !== 'https' && !(parsed.scheme === 'http' && loopback)) return null
    return parsed.url
  }

  function safeErrorMessage(error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    return message.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240)
  }

  function codedError(code, message) {
    const error = new Error(message)
    error.code = code
    return error
  }

  function apiCall(namespaceName, methodName, ...argumentsList) {
    const namespace = api[namespaceName]
    const method = namespace?.[methodName]
    if (typeof method !== 'function') return Promise.reject(new Error(`Browser API unavailable: ${namespaceName}.${methodName}`))

    try {
      return Promise.resolve(method.apply(namespace, argumentsList))
    } catch (error) {
      return Promise.reject(error)
    }
  }

  async function storageGet(area, keys) {
    const resolvedArea = area === 'session' && !api.storage.session ? 'local' : area
    const storageArea = api.storage[resolvedArea]
    return Promise.resolve(storageArea.get(keys))
  }

  async function storageSet(area, values) {
    const resolvedArea = area === 'session' && !api.storage.session ? 'local' : area
    const storageArea = api.storage[resolvedArea]
    return Promise.resolve(storageArea.set(values))
  }

  async function storageRemove(area, keys) {
    const storageArea = api.storage[area]
    return Promise.resolve(storageArea.remove(keys))
  }
})(globalThis)
