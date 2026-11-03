import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchActiveWarnings, fetchDeviceSnapshot, fetchSentinelRules, fetchSentinelStatus, fetchSentinelTamperEvents } from './device.ts'

test('local vault Sentinel status is explicit and never requests the backend', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  const originalFetch = globalThis.fetch
  globalThis.window = globalThis as unknown as Window & typeof globalThis
  globalThis.localStorage = {
    getItem: (key: string) => key === 'shinpo_local_vault_account' ? 'qa-user' : null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  } as unknown as Storage
  let guardianStatus = {
    status: 'LOCKED', activeFocusSessionId: null as number | null, activeFocusSessionName: null as string | null,
    guardianMode: null as string | null, focusPhase: null as string | null, observationsToday: 0,
    lastObservationAt: null as string | null, appCatalogVersion: 'guardian-apps-v1',
    domainCatalogVersion: 'guardian-domains-v1', warningOnly: true,
    observerStatus: 'LOCKED', applicationPolicyStatus: 'LOCKED', applicationCatalog: [] as { processName: string; category: string; rationale: string }[],
  }
  const commands: string[] = []
  Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
    configurable: true,
    value: { invoke: async (command: string) => {
      commands.push(command)
      if (command === 'local_get_guardian_status') return guardianStatus
      if (command === 'local_get_guardian_observations') return [{
        id: 3, sessionId: 7, pid: 4242, processName: 'discord', catalogVersion: 'guardian-apps-v1',
        category: 'COMMUNICATION', rationale: 'Social chat platform', guardianMode: 'STRICT',
        focusPhase: 'FOCUS', outcome: 'WARNING_STRICT', observedAt: '2026-11-02T10:00:00Z',
      }]
      throw new Error(`unexpected command: ${command}`)
    } },
  })
  let fetchCount = 0
  globalThis.fetch = async () => { fetchCount += 1; throw new Error('unexpected backend request') }

  try {
    assert.deepEqual(await fetchSentinelStatus(), {
      status: 'UNAVAILABLE',
      activeFocusSessionId: null,
      activeFocusSessionName: null,
      enforcementMode: 'AUDIT_ONLY',
      totalInterceptedToday: 0,
      activePolicyRulesCount: 0,
      isPolicyLocked: false,
      recentQuarantines: [],
      lastSweepAt: null,
      daemonConnected: false,
      guardianMode: null,
      focusPhase: null,
      guardianWarningCount: 0,
      guardianAppCatalogVersion: 'guardian-apps-v1',
      guardianDomainCatalogVersion: 'guardian-domains-v1',
      warningOnly: true,
      lastGuardianObservationAt: null,
      observerStatus: 'LOCKED',
      applicationPolicyStatus: 'LOCKED',
      guardianApplicationCatalog: [],
      guardianObservations: [],
    })
    guardianStatus = {
      status: 'ACTIVE', activeFocusSessionId: 7, activeFocusSessionName: 'Study block',
      guardianMode: 'STRICT', focusPhase: 'FOCUS', observationsToday: 2,
      lastObservationAt: '2026-11-01T10:00:00Z', appCatalogVersion: 'guardian-apps-v1',
      domainCatalogVersion: 'guardian-domains-v1', warningOnly: true,
      observerStatus: 'MONITORING', applicationPolicyStatus: 'WARNING_ONLY',
      applicationCatalog: [{ processName: 'discord', category: 'COMMUNICATION', rationale: 'Social chat platform' }],
    }
    const active = await fetchSentinelStatus()
    assert.equal(active.status, 'ACTIVE')
    assert.equal(active.activeFocusSessionId, 7)
    assert.equal(active.guardianWarningCount, 2)
    assert.equal(active.guardianMode, 'STRICT')
    assert.equal(active.warningOnly, true)
    assert.equal(active.observerStatus, 'MONITORING')
    assert.equal(active.applicationPolicyStatus, 'WARNING_ONLY')
    assert.deepEqual(active.guardianApplicationCatalog?.map((entry) => entry.processName), ['discord'])
    assert.equal(active.guardianObservations?.[0]?.sessionId, 7)
    assert.deepEqual(commands, [
      'local_get_guardian_status',
      'local_get_guardian_status',
      'local_get_guardian_observations',
    ])
    await assert.rejects(fetchDeviceSnapshot(), /No backend request was made/)
    assert.deepEqual(await fetchSentinelRules(), [])
    assert.deepEqual(await fetchSentinelTamperEvents(), [])
    assert.deepEqual(await fetchActiveWarnings(), [])
    assert.equal(fetchCount, 0)
  } finally {
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
    globalThis.fetch = originalFetch
  }
})
