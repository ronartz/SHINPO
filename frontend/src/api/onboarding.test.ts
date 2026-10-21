import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getOnboardingState,
  startOnboarding,
  recordOnboardingStep,
  pauseOnboarding,
  skipOnboarding,
} from './onboarding.ts'

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

test('Onboarding API client contracts', async (t) => {
  const originalFetch = globalThis.fetch

  t.afterEach(() => {
    storage.clear()
    globalThis.fetch = originalFetch
  })

  await t.test('getOnboardingState sends GET to /api/onboarding', async () => {
    let capturedUrl = ''
    let capturedMethod = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      return new Response(
        JSON.stringify({
          userId: 1,
          status: 'NOT_STARTED',
          currentStep: 0,
          completedStepsCount: 0,
          verifiedSteps: '',
          completedAt: null,
          isCompleted: false,
          canClaimReward: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const res = await getOnboardingState()
    assert.strictEqual(res.status, 'NOT_STARTED')
    assert.ok(capturedUrl.endsWith('/api/onboarding'))
    assert.strictEqual(capturedMethod, 'GET')
  })

  await t.test('startOnboarding sends POST to /api/onboarding/start with fromStep', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedBody = String(init?.body ?? '')
      return new Response(
        JSON.stringify({ status: 'IN_PROGRESS', currentStep: 2 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const res = await startOnboarding(2)
    assert.strictEqual(res.status, 'IN_PROGRESS')
    assert.ok(capturedUrl.endsWith('/api/onboarding/start'))
    assert.strictEqual(capturedMethod, 'POST')
    assert.deepEqual(JSON.parse(capturedBody), { fromStep: 2 })
  })

  await t.test('recordOnboardingStep sends stepIndex and actionVerified', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedBody = String(init?.body ?? '')
      return new Response(
        JSON.stringify({ status: 'IN_PROGRESS', completedStepsCount: 1 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const res = await recordOnboardingStep(0, true)
    assert.strictEqual(res.completedStepsCount, 1)
    assert.ok(capturedUrl.endsWith('/api/onboarding/step'))
    assert.strictEqual(capturedMethod, 'POST')
    assert.deepEqual(JSON.parse(capturedBody), { stepIndex: 0, actionVerified: true })
  })

  await t.test('pauseOnboarding sends stepIndex', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedBody = String(init?.body ?? '')
      return new Response(
        JSON.stringify({ status: 'PAUSED', currentStep: 4 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const res = await pauseOnboarding(4)
    assert.strictEqual(res.status, 'PAUSED')
    assert.ok(capturedUrl.endsWith('/api/onboarding/pause'))
    assert.strictEqual(capturedMethod, 'POST')
    assert.deepEqual(JSON.parse(capturedBody), { stepIndex: 4 })
  })

  await t.test('skipOnboarding sends POST to /api/onboarding/skip', async () => {
    let capturedUrl = ''
    let capturedMethod = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      return new Response(
        JSON.stringify({ status: 'SKIPPED', canClaimReward: false }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }) as typeof fetch

    const res = await skipOnboarding()
    assert.strictEqual(res.status, 'SKIPPED')
    assert.strictEqual(res.canClaimReward, false)
    assert.ok(capturedUrl.endsWith('/api/onboarding/skip'))
    assert.strictEqual(capturedMethod, 'POST')
  })
})

