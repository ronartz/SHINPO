import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import vm from 'node:vm'
import '../src/lib/canonical-url.js'
import '../src/lib/policy-engine.js'
import '../src/lib/native-protocol.js'

function event() {
  const listeners = []
  return {
    addListener(fn) { listeners.push(fn) },
    trigger(...args) { return Promise.all(listeners.map((fn) => fn(...args))) },
    listeners,
  }
}

function createApiStub() {
  const noOp = () => Promise.resolve()
  const storage = {}
  const storageArea = {
    get: async (keys) => {
      if (typeof keys === 'string') return { [keys]: storage[keys] }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map((k) => [k, storage[k]]))
      }
      return { ...storage }
    },
    set: async (items) => { Object.assign(storage, items) },
    remove: async (keys) => {
      const arr = Array.isArray(keys) ? keys : [keys]
      for (const k of arr) delete storage[k]
    },
  }

  const messageEvent = event()
  const api = {
    runtime: {
      getURL: (path = '') => `moz-extension://test/${path}`,
      openOptionsPage: noOp,
      onInstalled: event(),
      onStartup: event(),
      onMessage: messageEvent,
      sendMessage: async (msg) => {
        let response
        for (const listener of messageEvent.listeners) {
          await new Promise((resolve) => {
            listener(msg, { url: 'moz-extension://test/pages/options.html' }, (res) => {
              response = res
              resolve()
            })
          })
        }
        return response
      },
    },
    alarms: new Proxy({ onAlarm: event() }, { get: (target, key) => target[key] ?? noOp }),
    webNavigation: {
      onCommitted: event(),
      onHistoryStateUpdated: event(),
      onReferenceFragmentUpdated: event(),
    },
    tabs: new Proxy({
      onRemoved: event(),
      onUpdated: event(),
      query: async () => [],
      sendMessage: noOp,
      update: noOp,
    }, { get: (target, key) => target[key] ?? noOp }),
    action: new Proxy({}, { get: () => noOp }),
    storage: { local: storageArea, session: storageArea },
    scripting: { executeScript: noOp },
  }

  return { api, storage }
}

async function setupBackgroundContext() {
  const { api, storage } = createApiStub()
  const context = {
    browser: api,
    chrome: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
  }
  context.globalThis = context

  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { state };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  return { context, api, storage }
}

test('background routes both GET_STATUS and legacy/shorthand STATUS messages successfully', async () => {
  const { api } = await setupBackgroundContext()

  // Test GET_STATUS
  const getStatusRes = await api.runtime.sendMessage({ type: 'GET_STATUS' })
  assert.equal(getStatusRes?.ok, true, 'GET_STATUS should succeed')
  assert.ok(getStatusRes?.payload?.connection, 'GET_STATUS payload should contain connection')

  // Test STATUS (previously rejected as UNKNOWN_MESSAGE)
  const statusRes = await api.runtime.sendMessage({ type: 'STATUS' })
  assert.equal(statusRes?.ok, true, 'STATUS message should succeed for backward compatibility')
  assert.deepEqual(statusRes?.payload, getStatusRes?.payload, 'STATUS and GET_STATUS should return identical payload')
})

test('UI state helper derives all 11 required UI states accurately', async () => {
  const uiModule = await import('../src/pages/popup-logic.js')
  const { deriveUiState, UI_STATES } = uiModule

  // 1. Initial loading
  assert.equal(deriveUiState(null, {}), UI_STATES.INITIAL_LOADING)

  // 2. Unpaired
  const unpairedStatus = {
    connection: { state: 'UNPAIRED', paired: false },
    policy: { active: false },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(unpairedStatus, {}), UI_STATES.UNPAIRED)

  // 3. Native host unavailable
  const unavailableStatus = {
    connection: { state: 'DISCONNECTED', paired: true, error: 'Host not found' },
    policy: { active: false },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(unavailableStatus, {}), UI_STATES.HOST_UNAVAILABLE)

  // 4. Connected without Focus
  const connectedNoFocus = {
    connection: { state: 'CONNECTED', paired: true },
    policy: { active: false, sessionId: null },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(connectedNoFocus, {}), UI_STATES.CONNECTED_NO_FOCUS)

  // 5. Connected with active Focus
  const connectedActiveFocus = {
    connection: { state: 'CONNECTED', paired: true },
    policy: {
      active: true,
      sessionId: 'session-123',
      taskTitle: 'Deep Study',
      mode: 'STANDARD',
      currentPhase: 'FOCUS',
      sessionStatus: 'ACTIVE',
      phaseDeadlineAtMs: Date.now() + 1500 * 1000,
    },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(connectedActiveFocus, {}), UI_STATES.CONNECTED_ACTIVE_FOCUS)

  // 6. Paused Focus
  const pausedFocus = {
    ...connectedActiveFocus,
    policy: {
      ...connectedActiveFocus.policy,
      sessionStatus: 'PAUSED',
      phaseRemainingSeconds: 1200,
    },
  }
  assert.equal(deriveUiState(pausedFocus, {}), UI_STATES.PAUSED_FOCUS)

  // 7. Monitoring disabled
  const monitoringDisabled = {
    ...connectedActiveFocus,
    monitoringEnabled: false,
  }
  assert.equal(deriveUiState(monitoringDisabled, {}), UI_STATES.MONITORING_DISABLED)

  // 8. Disconnected with cached policy
  const disconnectedCached = {
    connection: { state: 'DISCONNECTED', paired: true, error: 'Lost connection' },
    policy: {
      active: true,
      degraded: false,
      sessionId: 'session-cached',
    },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(disconnectedCached, {}), UI_STATES.DISCONNECTED_CACHED_POLICY)

  // 9. Expired or degraded policy
  const degradedPolicy = {
    connection: { state: 'CONNECTED', paired: true },
    policy: {
      active: false,
      degraded: true,
      inactiveReason: 'Lease expired',
    },
    monitoringEnabled: true,
  }
  assert.equal(deriveUiState(degradedPolicy, {}), UI_STATES.EXPIRED_POLICY)

  // 10. Synchronization in progress
  assert.equal(deriveUiState(connectedNoFocus, { syncInProgress: true }), UI_STATES.SYNCING)

  // 11. Operation failed
  assert.equal(deriveUiState(connectedNoFocus, { errorMessage: 'Sync failed: network timeout' }), UI_STATES.ERROR)
})

test('control eligibility prevents setBusy(false) from re-enabling Sync when unpaired', async () => {
  const { getControlStates } = await import('../src/pages/popup-logic.js')

  const unpairedStatus = {
    connection: { state: 'UNPAIRED', paired: false },
    policy: { active: false },
  }

  // Initial state when unpaired: sync and disconnect must be disabled
  const initial = getControlStates(unpairedStatus, { busy: false })
  assert.equal(initial.syncDisabled, true, 'Sync must be disabled when unpaired')
  assert.equal(initial.disconnectDisabled, true, 'Disconnect must be disabled when unpaired')
  assert.equal(initial.pairDisabled, false, 'Pair button should be available')

  // While busy (e.g. attempting to pair)
  const busyState = getControlStates(unpairedStatus, { busy: true })
  assert.equal(busyState.syncDisabled, true, 'Sync remains disabled while busy')
  assert.equal(busyState.pairDisabled, true, 'Pair disabled while busy')

  // When operation finishes (setBusy(false)): sync MUST REMAIN disabled because still unpaired!
  const afterBusy = getControlStates(unpairedStatus, { busy: false })
  assert.equal(afterBusy.syncDisabled, true, 'Sync must NEVER be re-enabled after busy when unpaired')
  assert.equal(afterBusy.disconnectDisabled, true, 'Disconnect must remain disabled')
  assert.equal(afterBusy.pairDisabled, false, 'Pair button restored')
})

test('phase countdown renders formatted time, pause state, and grace warnings without drift', async () => {
  const { formatPhaseCountdown } = await import('../src/pages/popup-logic.js')
  const now = 1_700_000_000_000

  // Active focus with 25 minutes (1500 seconds) remaining
  const activePolicy = {
    sessionId: 'sess-1',
    currentPhase: 'FOCUS',
    sessionStatus: 'ACTIVE',
    phaseDeadlineAtMs: now + 1500 * 1000,
  }
  const formattedActive = formatPhaseCountdown(activePolicy, now)
  assert.equal(formattedActive.countdown, '25:00 remaining')
  assert.equal(formattedActive.text, 'focus · 25:00 remaining')

  // Paused session with 330 seconds remaining
  const pausedPolicy = {
    sessionId: 'sess-1',
    currentPhase: 'FOCUS',
    sessionStatus: 'PAUSED',
    phaseRemainingSeconds: 330,
  }
  const formattedPaused = formatPhaseCountdown(pausedPolicy, now)
  assert.equal(formattedPaused.countdown, '5:30 remaining')
  assert.equal(formattedPaused.text, 'focus · paused · 5:30 remaining')

  // Grace phase with <= 120s remaining triggers warning
  const gracePolicy = {
    sessionId: 'sess-1',
    currentPhase: 'GRACE',
    sessionStatus: 'ACTIVE',
    phaseDeadlineAtMs: now + 90 * 1000,
  }
  const formattedGrace = formatPhaseCountdown(gracePolicy, now)
  assert.equal(formattedGrace.text, 'grace · return soon · 1:30 remaining')

  // Degraded policy
  const degradedPolicy = {
    sessionId: 'sess-1',
    degraded: true,
  }
  const formattedDegraded = formatPhaseCountdown(degradedPolicy, now)
  assert.equal(formattedDegraded.text, 'Policy expired · limited cached restrictions only')
})

test('theme persistence manager normalizes and validates approved themes', async () => {
  const { normalizeTheme, APPROVED_THEMES, DEFAULT_THEME } = await import('../src/pages/popup-logic.js')

  assert.equal(APPROVED_THEMES.length, 4)
  assert.ok(APPROVED_THEMES.includes('aurora-dark'))
  assert.ok(APPROVED_THEMES.includes('aurora-light'))
  assert.ok(APPROVED_THEMES.includes('classic-dark'))
  assert.ok(APPROVED_THEMES.includes('classic-light'))

  assert.equal(normalizeTheme('aurora-light'), 'aurora-light')
  assert.equal(normalizeTheme('classic-dark'), 'classic-dark')
  assert.equal(normalizeTheme('unknown-theme'), DEFAULT_THEME)
  assert.equal(normalizeTheme(null), DEFAULT_THEME)
})

test('options page background operations: review URL, monitoring, and disconnect', async () => {
  const { api } = await setupBackgroundContext()

  // 1. Valid review URL
  const validUrlRes = await api.runtime.sendMessage({
    type: 'SET_REVIEW_URL',
    reviewUrl: 'http://localhost:5173/focus',
  })
  assert.equal(validUrlRes?.ok, true)
  assert.equal(validUrlRes?.payload?.reviewUrl, 'http://localhost:5173/focus')

  // 2. Invalid non-HTTPS external URL rejected
  const invalidUrlRes = await api.runtime.sendMessage({
    type: 'SET_REVIEW_URL',
    reviewUrl: 'http://insecure-external.example.com',
  })
  assert.equal(invalidUrlRes?.ok, false)
  assert.equal(invalidUrlRes?.error?.code, 'INVALID_REVIEW_URL')

  // 3. Toggle monitoring
  const toggleRes = await api.runtime.sendMessage({
    type: 'SET_MONITORING_ENABLED',
    enabled: false,
  })
  assert.equal(toggleRes?.ok, true)
  assert.equal(toggleRes?.payload?.monitoringEnabled, false)

  // 4. Disconnect extension
  const disconnectRes = await api.runtime.sendMessage({
    type: 'DISCONNECT',
  })
  assert.equal(disconnectRes?.ok, true)
  assert.equal(disconnectRes?.payload?.connection?.state, 'UNPAIRED')
  assert.equal(disconnectRes?.payload?.connection?.paired, false)
})

