import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchActiveWarnings, fetchDeviceSnapshot, fetchSentinelRules, fetchSentinelStatus, fetchSentinelTamperEvents, terminateProcess } from './device.ts'

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
    interventionCapability: 'LOCKED', standardAllowanceSeconds: null as number | null,
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
      if (command === 'local_get_process_snapshot') return {
        systemInfo: { deviceName: 'Fedora', osName: 'Linux', osVersion: '41', osArch: 'x86_64', availableProcessors: 8, systemCpuLoad: 12.5, totalMemoryBytes: 16e9, freeMemoryBytes: 8e9, processCount: 100 },
        processes: [],
        timestamp: '2026-11-08T00:00:00Z',
      }
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
      interventionCapability: 'LOCKED',
      standardAllowanceSeconds: null,
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
      interventionCapability: 'WARNING_ONLY', standardAllowanceSeconds: 0,
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
    assert.equal(active.interventionCapability, 'WARNING_ONLY')
    assert.equal(active.standardAllowanceSeconds, 0)
    assert.deepEqual(active.guardianApplicationCatalog?.map((entry) => entry.processName), ['discord'])
    assert.equal(active.guardianObservations?.[0]?.sessionId, 7)
    const localSnapshot = await fetchDeviceSnapshot()
    assert.equal(localSnapshot.systemInfo.osName, 'Linux')
    assert.deepEqual(commands, [
      'local_get_guardian_status',
      'local_get_guardian_status',
      'local_get_guardian_observations',
      'local_get_process_snapshot',
    ])
    await assert.rejects(terminateProcess(4242), /No backend request was made/)
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

test('local vault discovered apps and app policies invoke native Tauri IPC', async () => {
  const originalWindow = globalThis.window
  const originalStorage = globalThis.localStorage
  globalThis.window = globalThis as unknown as Window & typeof globalThis
  globalThis.localStorage = {
    getItem: (key: string) => key === 'shinpo_local_vault_account' ? 'qa-user' : null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    length: 0,
    key: () => null,
  } as unknown as Storage

  const invokedCommands: Array<{ command: string; args?: unknown }> = []
  Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: async (command: string, args?: unknown) => {
        invokedCommands.push({ command, args })
        if (command === 'local_get_discovered_apps') {
          return [
            {
              id: 'code.desktop',
              name: 'Visual Studio Code',
              platform: 'linux',
              source: 'system',
              icon: 'vscode',
              execName: 'code',
              isRunning: true,
              policy: 'BLOCKED',
              enforcementCapability: 'TERMINATE',
              unsupportedReason: null,
            },
          ]
        }
        if (command === 'local_get_app_policies') {
          return [
            {
              id: 1,
              appId: 'code.desktop',
              appName: 'Visual Studio Code',
              execName: 'code',
              policyType: 'BLOCKED',
              source: 'system',
              createdAt: '2026-11-07T12:00:00Z',
              updatedAt: '2026-11-07T12:00:00Z',
            },
          ]
        }
        if (command === 'local_save_app_policy') {
          return {
            id: 2,
            appId: 'discord.desktop',
            appName: 'Discord',
            execName: 'discord',
            policyType: 'ALLOWED',
            source: 'system',
            createdAt: '2026-11-07T12:00:00Z',
            updatedAt: '2026-11-07T12:00:00Z',
          }
        }
        if (command === 'local_remove_app_policy') {
          return undefined
        }
        throw new Error(`Unexpected command: ${command}`)
      },
    },
  })

  try {
    const {
      fetchDiscoveredApps,
      fetchGuardianAppPolicies,
      saveGuardianAppPolicy,
      removeGuardianAppPolicy,
    } = await import('./device.ts')

    const apps = await fetchDiscoveredApps()
    assert.equal(apps.length, 1)
    assert.equal(apps[0].name, 'Visual Studio Code')
    assert.equal(apps[0].isRunning, true)
    assert.equal(apps[0].policy, 'BLOCKED')

    const policies = await fetchGuardianAppPolicies()
    assert.equal(policies.length, 1)
    assert.equal(policies[0].appId, 'code.desktop')

    const saved = await saveGuardianAppPolicy({
      appId: 'discord.desktop',
      appName: 'Discord',
      execName: 'discord',
      policyType: 'ALLOWED',
    })
    assert.equal(saved.policyType, 'ALLOWED')

    await removeGuardianAppPolicy('code.desktop')

    assert.equal(invokedCommands.length, 4)
    assert.equal(invokedCommands[0].command, 'local_get_discovered_apps')
    assert.equal(invokedCommands[1].command, 'local_get_app_policies')
    assert.equal(invokedCommands[2].command, 'local_save_app_policy')
    assert.equal(invokedCommands[3].command, 'local_remove_app_policy')
  } finally {
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
  }
})
