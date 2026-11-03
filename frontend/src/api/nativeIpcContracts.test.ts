import test from 'node:test'
import assert from 'node:assert/strict'
import { updateMission } from './goalsAndMissions.ts'
import { createFocusSession, updateFocusSession } from './focusSessions.ts'
import { createStudyResource } from './contextualFocus.ts'

test('native mutations send typed request payloads through Tauri IPC', async () => {
  const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
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
  Object.defineProperty(globalThis, '__TAURI_INTERNALS__', {
    configurable: true,
    value: {
      invoke: async (command: string, args?: Record<string, unknown>) => {
        calls.push({ command, args })
        if (command === 'local_get_tasks') return [{ id: 9, goalId: 4 }]
        if (command === 'local_get_focus_sessions') return [{ id: 12, goalId: 4, taskId: 9 }]
        return {}
      },
    },
  })

  try {
    await updateMission(9, {
      title: 'Review',
      scheduledDate: '2026-10-28',
      estimatedMinutes: 25,
    })
    await createFocusSession({
      userId: 1,
      goalId: 4,
      missionId: 9,
      name: 'Focus',
      durationMinutes: 60,
      pomodoroEnabled: true,
      pomodoroFocusCycles: 2,
    })
    await updateFocusSession(12, { name: 'Review focus' })
    await createStudyResource({
      missionId: 9,
      resourceType: 'WEBSITE',
      matchType: 'DOMAIN',
      disposition: 'APPROVED',
      breakOnly: true,
      destination: 'iana.org',
    })

    const request = (command: string) => calls.find((call) => call.command === command)?.args?.request as Record<string, unknown>
    assert.deepEqual(request('local_update_task'), {
      taskId: 9, goalId: 4, title: 'Review', description: undefined,
      scheduledDate: '2026-10-28', estimatedMinutes: 25, status: undefined,
    })
    assert.deepEqual(request('local_create_focus_session').pomodoroFocusCycles, 2)
    assert.equal(request('local_create_focus_session').guardianAppMonitoring, false)
    await createFocusSession({ userId: 1, name: 'Consented Focus', durationMinutes: 25, guardianAppMonitoring: true })
    const createSessionRequests = calls.filter((call) => call.command === 'local_create_focus_session')
    assert.equal((createSessionRequests.at(-1)?.args?.request as Record<string, unknown>).guardianAppMonitoring, true)
    assert.deepEqual(request('local_update_focus_session').sessionId, 12)
    assert.deepEqual(request('local_create_study_resource').destination, 'iana.org')
  } finally {
    delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__
    globalThis.window = originalWindow
    globalThis.localStorage = originalStorage
  }
})
