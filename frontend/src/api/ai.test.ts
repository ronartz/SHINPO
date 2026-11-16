import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  proposeAiAction,
  confirmAiAction,
  rejectAiAction,
  getPendingAiActions,
  getRecentAiActions,
  getExecutiveBriefing,
  getAiProviderStatus,
  getActiveConversation,
  clearActiveConversation,
  sendAiChat,
  decomposeGoal, getDailyPlan, getNextAction, analyzeSessionDebrief, getSessionRecovery, getUserExecutionProfile,
  listLocalConversations, openLocalConversation, deleteLocalConversation,
  configureNativeAiProvider, getNativeAiProviderConfig, cancelNativeAiRequest,
} from './ai.ts'

// Setup mock window and localStorage for Node test runner
const storage = new Map<string, string>()
globalThis.window = globalThis as unknown as (Window & typeof globalThis)
globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => { storage.set(key, String(val)) },
  removeItem: (key: string) => { storage.delete(key) },
  clear: () => { storage.clear() },
  length: 0,
  key: () => null,
} as unknown as Storage

test('AI Actions API contracts - exact URLs, methods, headers, and lifecycle', async (t) => {
  const originalFetch = globalThis.fetch
  storage.set('shinpo_access_token', 'test-jwt-token-xyz')

  t.after(() => {
    globalThis.fetch = originalFetch
    storage.clear()
  })

  await t.test('proposeAiAction sends POST to /api/ai/actions/propose with bearer token and body', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: Record<string, string> = {}
    let capturedBody = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}
      capturedBody = String(init?.body ?? '')

      return new Response(JSON.stringify({
        actionId: 'act_test123',
        actionType: 'CREATE_TASK',
        riskLevel: 'LOW',
        status: 'PROPOSED',
        description: 'Test Task Creation',
        payloadJson: '{"title":"Test"}',
        expiresAt: '2026-10-13T16:00:00Z',
        createdAt: '2026-10-13T15:00:00Z',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await proposeAiAction('CREATE_TASK', 'Test Task Creation', { title: 'Test' })

    // Verify exact endpoint path (no duplicate /ai/ai)
    assert.match(capturedUrl, /\/api\/ai\/actions\/propose$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
    assert.equal(capturedMethod, 'POST')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.equal(capturedHeaders['Content-Type'], 'application/json')

    const parsedBody = JSON.parse(capturedBody)
    assert.equal(parsedBody.actionType, 'CREATE_TASK')
    assert.equal(parsedBody.description, 'Test Task Creation')
    assert.deepEqual(parsedBody.payload, { title: 'Test' })

    assert.equal(result.actionId, 'act_test123')
    assert.equal(result.status, 'PROPOSED')
  })

  await t.test('confirmAiAction sends POST to /api/ai/actions/:actionId/confirm with bearer token', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}

      return new Response(JSON.stringify({
        actionId: 'act_test123',
        status: 'COMPLETED',
        resultSummary: 'Task created successfully',
        executedAt: '2026-10-13T15:01:00Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await confirmAiAction('act_test123')

    assert.match(capturedUrl, /\/api\/ai\/actions\/act_test123\/confirm$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
    assert.equal(capturedMethod, 'POST')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.equal(result.actionId, 'act_test123')
    assert.equal(result.status, 'COMPLETED')
  })

  await t.test('rejectAiAction sends POST to /api/ai/actions/:actionId/reject with bearer token', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}

      return new Response(JSON.stringify({
        actionId: 'act_test123',
        actionType: 'CREATE_TASK',
        riskLevel: 'LOW',
        status: 'REJECTED',
        description: 'Test Task Creation',
        payloadJson: '{}',
        expiresAt: '2026-10-13T16:00:00Z',
        createdAt: '2026-10-13T15:00:00Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await rejectAiAction('act_test123')

    assert.match(capturedUrl, /\/api\/ai\/actions\/act_test123\/reject$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
    assert.equal(capturedMethod, 'POST')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.equal(result.status, 'REJECTED')
  })

  await t.test('getPendingAiActions sends GET to /api/ai/actions/pending with bearer token', async () => {
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}

      return new Response(JSON.stringify([
        {
          actionId: 'act_pending_1',
          actionType: 'CREATE_TASK',
          riskLevel: 'LOW',
          status: 'PROPOSED',
          description: 'Pending Task',
          payloadJson: '{}',
          expiresAt: '2026-10-13T16:00:00Z',
          createdAt: '2026-10-13T15:00:00Z',
        }
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await getPendingAiActions()

    assert.match(capturedUrl, /\/api\/ai\/actions\/pending$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.equal(result.length, 1)
    assert.equal(result[0].actionId, 'act_pending_1')
  })

  await t.test('getRecentAiActions sends GET to /api/ai/actions/recent with bearer token', async () => {
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}

      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await getRecentAiActions()

    assert.match(capturedUrl, /\/api\/ai\/actions\/recent$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.deepEqual(result, [])
  })

  await t.test('getExecutiveBriefing sends GET to /api/ai/briefing with bearer token', async () => {
    let capturedUrl = ''

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return new Response(JSON.stringify({
        summary: 'Briefing summary',
        keyActionItems: [],
        generatedAt: '2026-10-13T15:00:00Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    await getExecutiveBriefing()

    assert.match(capturedUrl, /\/api\/ai\/briefing$/)
    assert.ok(!capturedUrl.includes('/ai/ai/'), 'URL must not contain duplicate /ai/ai/ segment')
  })

  await t.test('getAiProviderStatus sends authenticated GET to /api/ai/status and returns configured provider', async () => {
    let capturedUrl = ''
    let capturedHeaders: Record<string, string> = {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedHeaders = (init?.headers as Record<string, string>) ?? {}
      return new Response(JSON.stringify({
        enabled: true,
        available: true,
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        status: 'CONNECTED',
        message: 'Cloud · gemini-3.6-flash',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const result = await getAiProviderStatus()
    assert.match(capturedUrl, /\/api\/ai\/status$/)
    assert.equal(capturedHeaders['Authorization'], 'Bearer test-jwt-token-xyz')
    assert.equal(result.provider, 'gemini')
    assert.equal(result.model, 'gemini-3.6-flash')
  })

  await t.test('error handling: parseResponse throws meaningful message on HTTP errors', async () => {
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        message: 'Action expired or ownership violation',
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    await assert.rejects(
      async () => confirmAiAction('act_expired'),
      /Action expired or ownership violation/
    )
  })

  await t.test('local vault EONPAI uses native persistence and does not request the backend', async () => {
    const nativeWindow = window as unknown as { __TAURI_INTERNALS__?: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> } }
    const previousBridge = nativeWindow.__TAURI_INTERNALS__
    const calls: Array<[string, Record<string, unknown> | undefined]> = []
    nativeWindow.__TAURI_INTERNALS__ = {
      invoke: async (command, args) => {
        calls.push([command, args])
        if (command === 'local_eonpai_provider_status') {
          return { enabled: false, available: false, provider: 'none', model: '', status: 'OFFLINE', message: 'No model configured' }
        }
        if (command === 'local_eonpai_actions' || command === 'local_eonpai_list') return []
        if (command === 'local_eonpai_send') {
          return { reply: 'Local summary', suggestionType: 'TACTICAL_ASSISTANT', structuredCard: null, conversationId: 'local-1' }
        }
        return { conversationId: 'local-1', title: 'New conversation', status: 'ACTIVE', messages: [], updatedAt: '2026-11-01T00:00:00Z' }
      },
    }
    storage.set('shinpo_local_vault_account', 'local-user')
    globalThis.fetch = (() => { throw new Error('Local EONPAI attempted a server request') }) as typeof fetch
    try {
      assert.equal((await getAiProviderStatus()).available, false)
      assert.equal((await getActiveConversation()).conversationId, 'local-1')
      assert.equal((await clearActiveConversation()).status, 'ACTIVE')
      assert.equal((await sendAiChat(1, 'plan my tasks', undefined, undefined, undefined, 'local-1')).reply, 'Local summary')
      assert.deepEqual(await getPendingAiActions(), [])
      await assert.rejects(confirmAiAction('native-action'), /Review the native action preview/)
      await confirmAiAction('native-action', 'exact-preview-proof')
      await rejectAiAction('native-action')
      await proposeAiAction('RESCHEDULE_TASK', 'Move a task', { kind: 'RESCHEDULE_TASK', taskId: 1, scheduledDate: '2026-11-05' })
      await decomposeGoal(1)
      await getNextAction()
      await getDailyPlan()
      await analyzeSessionDebrief(4)
      await getSessionRecovery(4)
      await getUserExecutionProfile()
      await getExecutiveBriefing()
      await listLocalConversations()
      await openLocalConversation('opaque-conversation')
      await deleteLocalConversation('opaque-conversation')
      await configureNativeAiProvider({ provider: 'none', model: '', endpoint: '', allowCloudContext: false })
      await getNativeAiProviderConfig()
      await cancelNativeAiRequest()
      await sendAiChat(1, 'Break down my goal')
      const fixture = JSON.parse(readFileSync(new URL('./fixtures/eonpai-chat.json', import.meta.url), 'utf8'))
      assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1)?.[1])), fixture)
      assert.deepEqual(calls.find(([command]) => command === 'local_eonpai_confirm'), ['local_eonpai_confirm', { actionId: 'native-action', confirmationToken: 'exact-preview-proof' }])
      assert.equal(calls.filter(([command]) => command === 'local_eonpai_read').length, 7)
    } finally {
      if (previousBridge) nativeWindow.__TAURI_INTERNALS__ = previousBridge
      else delete nativeWindow.__TAURI_INTERNALS__
    }
  })

  await t.test('local vault never falls back to HTTP if the Tauri bridge is missing', async () => {
    const nativeWindow = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }
    const previousInternals = nativeWindow.__TAURI_INTERNALS__
    const previousTauri = nativeWindow.__TAURI__
    let fetches = 0
    delete nativeWindow.__TAURI_INTERNALS__
    delete nativeWindow.__TAURI__
    storage.set('shinpo_local_vault_account', 'local-user')
    globalThis.fetch = (async () => {
      fetches += 1
      throw new Error('Local EONPAI attempted a backend fallback')
    }) as typeof fetch
    try {
      await assert.rejects(sendAiChat(1, 'Summarize my progress'), /Tauri invoke not found/)
      assert.equal(fetches, 0)
    } finally {
      if (previousInternals) nativeWindow.__TAURI_INTERNALS__ = previousInternals
      if (previousTauri) nativeWindow.__TAURI__ = previousTauri
      storage.delete('shinpo_local_vault_account')
    }
  })
})
