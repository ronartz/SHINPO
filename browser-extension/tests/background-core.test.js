import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { test } from 'node:test'
import vm from 'node:vm'
import '../src/lib/canonical-url.js'
import '../src/lib/policy-engine.js'
import '../src/lib/native-protocol.js'

function event() {
  return { addListener() {} }
}

function apiStub() {
  const noOp = () => Promise.resolve()
  const calls = { scripts: 0 }
  const tabs = new Proxy({
    onRemoved: event(),
    onUpdated: event(),
    query: async () => [],
    sendMessage: noOp,
    update: noOp,
  }, { get: (target, key) => target[key] ?? noOp })
  const storageArea = {
    get: async () => ({}),
    set: noOp,
    remove: noOp,
  }
  return {
    calls,
    api: {
      runtime: {
        getURL: (path) => `moz-extension://test/${path}`,
        onInstalled: event(),
        onStartup: event(),
        onMessage: event(),
      },
      alarms: new Proxy({ onAlarm: event() }, { get: (target, key) => target[key] ?? noOp }),
      webNavigation: {
        onCommitted: event(),
        onHistoryStateUpdated: event(),
        onReferenceFragmentUpdated: event(),
      },
      tabs,
      action: new Proxy({}, { get: () => noOp }),
      storage: { local: storageArea, session: storageArea },
      scripting: { executeScript: async () => { calls.scripts++ } },
    },
  }
}

test('reevaluates the same break URL after grace expires under an unchanged policy revision', async () => {
  let now = 1_800_000_000_000
  class TestDate extends Date {
    static now() { return now }
  }
  const { api, calls } = apiStub()
  const policy = {
    ...globalThis.ShinpoPolicy,
    evaluateUrl: (value, url) => globalThis.ShinpoPolicy.evaluateUrl(value, url, now),
  }
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: policy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date: TestDate,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { state, handleNavigation };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  const { state, handleNavigation } = context.__testHooks
  state.ready = true
  state.monitoringEnabled = true
  state.policy = globalThis.ShinpoPolicy.normalizePolicy({
    sessionId: 'qa-session',
    status: 'ACTIVE',
    mode: 'PROTECTED',
    currentPhase: 'BREAK',
    policyVersion: 7,
    phaseDeadlineAt: now + 10_000,
    graceDeadlineAt: now + 20_000,
    leaseExpiresAt: now + 60_000,
    resources: [{
      id: 'approved-break-site',
      resourceType: 'WEBSITE',
      matchType: 'DOMAIN',
      disposition: 'APPROVED',
      breakOnly: true,
      destination: 'game.example',
    }],
  }, now)

  assert.equal((await handleNavigation(9, 'https://game.example/', 'test')).decision, 'ALLOW')
  now += 25_000
  assert.equal((await handleNavigation(9, 'https://game.example/', 'test')).decision, 'RESTRICT')
  assert.equal(calls.scripts, 1)
})

test('initializes with UNPAIRED state when no pairing token is stored', async () => {
  const { api } = apiStub()
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { state };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  const { state } = context.__testHooks
  assert.equal(state.connection.state, 'UNPAIRED')
  assert.equal(state.connection.paired, false)
})

test('reports rejected one-time pairing codes as expired, invalid, or already used', async () => {
  const { api } = apiStub()
  api.runtime.sendNativeMessage = async (_host, request) => ({
    protocolVersion: 1,
    requestId: request.requestId,
    ok: false,
    error: { code: 'AUTHENTICATION_FAILED', message: 'authentication failed' },
  })
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { pair };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  await assert.rejects(
    context.__testHooks.pair('not-a-code'),
    (error) => error.code === 'INVALID_PAIRING_CODE' && /Settings → Browser Companion/.test(error.message),
  )
  await assert.rejects(
    context.__testHooks.pair('a'.repeat(64)),
    (error) => error.code === 'PAIRING_CODE_REJECTED' && /invalid, expired, or already used/i.test(error.message),
  )
})

test('keeps a successful pairing when the first policy sync fails authentication', async () => {
  const stored = {}
  const { api } = apiStub()
  api.storage.local = {
    get: async (keys) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, stored[key]])),
    set: async (values) => Object.assign(stored, values),
    remove: async (keys) => { for (const key of keys) delete stored[key] },
  }
  const browserToken = 'b'.repeat(64)
  api.runtime.sendNativeMessage = async (_host, request) => request.type === 'pair'
    ? { protocolVersion: 1, requestId: request.requestId, ok: true, payload: { paired: true, sessionToken: browserToken } }
    : { protocolVersion: 1, requestId: request.requestId, ok: false, error: { code: 'AUTHENTICATION_FAILED', message: 'authentication failed' } }
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { pair, state };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  await assert.rejects(
    context.__testHooks.pair('a'.repeat(64)),
    (error) => error.code === 'PAIRED_SYNC_FAILED' && /pairing succeeded/i.test(error.message),
  )
  assert.equal(context.__testHooks.state.pairingToken, browserToken)
  assert.equal(stored.pairingToken, browserToken)
})

test('test_message_from_unknown_sender_rejected', async () => {
  const { api } = apiStub()
  api.runtime.id = 'ndknhgihhogcfkliohfjcllglpjdgjpj'
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { routeMessage };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  const { routeMessage } = context.__testHooks
  const invalidSender = { id: 'malicious_extension_id_9999' }
  await assert.rejects(
    async () => routeMessage({ type: 'GET_STATUS' }, invalidSender),
    /Message from unknown sender rejected/
  )
})

test('test_message_from_spoofed_origin_rejected', async () => {
  const { api } = apiStub()
  api.runtime.id = 'ndknhgihhogcfkliohfjcllglpjdgjpj'
  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { routeMessage };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  const { routeMessage } = context.__testHooks
  const spoofedSender = {
    id: 'ndknhgihhogcfkliohfjcllglpjdgjpj',
    origin: 'chrome-extension://attacker_spoofed_extension_id',
  }
  await assert.rejects(
    async () => routeMessage({ type: 'GET_STATUS' }, spoofedSender),
    /Message from spoofed origin rejected/
  )
})

test('fail-open on disconnect clears policy, dynamic rules, and sets grey action state', async () => {
  const { api } = apiStub()
  let actionTitle = ''
  let actionColor = ''
  let actionText = 'INITIAL'
  api.action = {
    setBadgeText: async ({ text }) => { actionText = text },
    setBadgeBackgroundColor: async ({ color }) => { actionColor = color },
    setTitle: async ({ title }) => { actionTitle = title },
  }
  let removedRules = null
  api.declarativeNetRequest = {
    getDynamicRules: (cb) => cb([{ id: 101 }, { id: 102 }]),
    updateDynamicRules: async ({ removeRuleIds }) => { removedRules = removeRuleIds },
  }

  const context = {
    browser: api,
    ShinpoCanonical: globalThis.ShinpoCanonical,
    ShinpoPolicy: globalThis.ShinpoPolicy,
    ShinpoNativeProtocol: globalThis.ShinpoNativeProtocol,
    Date,
    URL,
    crypto: webcrypto,
    console,
    setInterval,
    clearInterval,
  }
  context.globalThis = context
  let source = await readFile(new URL('../src/background-core.js', import.meta.url), 'utf8')
  source = source.replace('})(globalThis)', 'globalThis.__testHooks = { state, failOpen, markDisconnected, updateAction };})(globalThis)')
  vm.runInNewContext(source, context)
  await new Promise(setImmediate)

  const { state, markDisconnected } = context.__testHooks
  state.ready = true
  state.monitoringEnabled = true
  state.connection = { state: 'CONNECTED', paired: true }
  state.policy = globalThis.ShinpoPolicy.normalizePolicy({
    sessionId: 'qa-active-focus',
    status: 'ACTIVE',
    mode: 'STRICT',
    currentPhase: 'FOCUS',
    policyVersion: 2,
    phaseDeadlineAt: Date.now() + 60_000,
    leaseExpiresAt: Date.now() + 120_000,
    resources: [{
      id: 'blocked-site',
      resourceType: 'WEBSITE',
      matchType: 'DOMAIN',
      disposition: 'RESTRICTED',
      destination: 'distraction.com',
    }],
  })

  // Disconnect triggered (e.g. heartbeat timeout or native host crash)
  await markDisconnected(new Error('Connection terminated'))

  // Verify fail-open guarantees:
  assert.equal(state.connection.state, 'DISCONNECTED')
  assert.equal(state.policy.active, false)
  assert.equal(state.policy.inactiveReason, 'SHINPO disconnected')
  assert.deepEqual(removedRules, [101, 102], 'Must remove all dynamic blocking rules')
  assert.equal(actionText, '', 'Disconnected badge text must be empty')
  assert.equal(actionColor, '#6B7280', 'Disconnected badge color must be grey')
  assert.equal(actionTitle, 'SHINPO disconnected')
})
