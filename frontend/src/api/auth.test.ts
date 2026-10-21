import test from 'node:test'
import assert from 'node:assert/strict'
import {
  updateUsername,
  getStoredUser,
  setAuthSession,
  clearAuthSession,
  authHeaders,
} from './auth.ts'

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

test('Auth API - updateUsername and session contracts', async (t) => {
  const originalFetch = globalThis.fetch

  t.afterEach(() => {
    storage.clear()
    globalThis.fetch = originalFetch
  })

  await t.test('updateUsername sends PUT to /api/users/me/username with bearer token', async () => {
    storage.set('shinpo_access_token', 'mock-bearer-token')

    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: Record<string, string> = {}
    let capturedBody = ''

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>
      capturedBody = String(init?.body ?? '')

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 42,
          username: 'commander_renamed',
          email: 'commander@shinpo.dev',
          role: 'ROLE_USER',
        }),
      } as unknown as Response
    }) as typeof fetch

    const result = await updateUsername('commander_renamed')
    assert.strictEqual(result.username, 'commander_renamed')
    assert.strictEqual(result.id, 42)
    assert.ok(capturedUrl.endsWith('/api/users/me/username'))
    assert.strictEqual(capturedMethod, 'PUT')
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-bearer-token')
    assert.strictEqual(JSON.parse(capturedBody).username, 'commander_renamed')

    // Local storage updated immediately
    const stored = getStoredUser()
    assert.strictEqual(stored?.username, 'commander_renamed')
  })

  await t.test('updateUsername throws meaningful error on 409 conflict or 400 validation error', async () => {
    storage.set('shinpo_access_token', 'mock-bearer-token')

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          status: 409,
          error: 'CONFLICT',
          message: "Username 'taken_name' is already taken",
        }),
      } as unknown as Response
    }) as typeof fetch

    await assert.rejects(
      async () => {
        await updateUsername('taken_name')
      },
      (err: Error) => {
        assert.ok(err.message.includes('already taken'))
        return true
      }
    )
  })

  await t.test('session lifecycle clears and retrieves stored users safely', () => {
    setAuthSession({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      user: { id: 1, username: 'testuser', email: 'test@shinpo.dev' },
    })
    assert.strictEqual(getStoredUser()?.username, 'testuser')
    assert.strictEqual(authHeaders()['Authorization'], 'Bearer access-123')

    clearAuthSession()
    assert.strictEqual(getStoredUser(), null)
    assert.strictEqual(authHeaders()['Authorization'], undefined)
  })
})

