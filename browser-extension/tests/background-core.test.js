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
