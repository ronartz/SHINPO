import test from 'node:test'
import assert from 'node:assert/strict'
import {
  updateUsername,
  deleteAccount,
  getStoredUser,
  setAuthSession,
  clearAuthSession,
  getRefreshToken,
  fetchCurrentUser,
  authHeaders,
  setCustomServerUrl,
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

  await t.test('deleteAccount sends DELETE to /api/users/me with bearer token and clears session', async () => {
    storage.set('shinpo_access_token', 'mock-bearer-token')
    storage.set('shinpo_refresh_token', 'mock-refresh-token')
    storage.set('shinpo_auth_user', JSON.stringify({ id: 42, username: 'to_be_deleted' }))

    let capturedUrl = ''
    let capturedMethod = ''
    let capturedHeaders: Record<string, string> = {}

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input)
      capturedMethod = init?.method ?? 'GET'
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>

      return {
        ok: true,
        status: 204,
      } as unknown as Response
    }) as typeof fetch

    await deleteAccount()
    assert.ok(capturedUrl.endsWith('/api/users/me'))
    assert.strictEqual(capturedMethod, 'DELETE')
    assert.strictEqual(capturedHeaders['Authorization'], 'Bearer mock-bearer-token')
    assert.strictEqual(storage.get('shinpo_access_token'), undefined)
    assert.strictEqual(storage.get('shinpo_refresh_token'), undefined)
    assert.strictEqual(storage.get('shinpo_auth_user'), undefined)
  })

  await t.test('deleteAccount throws meaningful error on failure', async () => {
    storage.set('shinpo_access_token', 'mock-bearer-token')

    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ message: 'Database constraint failure' }),
      } as unknown as Response
    }) as typeof fetch

    await assert.rejects(
      async () => {
        await deleteAccount()
      },
      {
        message: 'Database constraint failure',
      }
    )
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

  await t.test('session lifecycle clears and retrieves stored users safely', async () => {
    await setAuthSession({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      user: { id: 1, username: 'testuser', email: 'test@shinpo.dev' },
    })
    assert.strictEqual(getStoredUser()?.username, 'testuser')
    assert.strictEqual(authHeaders()['Authorization'], 'Bearer access-123')

    await clearAuthSession()
    assert.strictEqual(getStoredUser(), null)
    assert.strictEqual(authHeaders()['Authorization'], undefined)
  })

  await t.test('changing the server clears the session before storing the endpoint', async () => {
    storage.set('shinpo_custom_server_url', 'https://old.example.com/')
    storage.set('shinpo_access_token', 'old-access-token')
    storage.set('shinpo_refresh_token', 'old-refresh-token')
    storage.set('shinpo_auth_user', JSON.stringify({ id: 7, username: 'qa', email: 'qa@example.test' }))

    await setCustomServerUrl('https://new.example.com/')
    assert.strictEqual(storage.get('shinpo_custom_server_url'), 'https://new.example.com')
    assert.strictEqual(storage.has('shinpo_access_token'), false)
    assert.strictEqual(storage.has('shinpo_refresh_token'), false)
    assert.strictEqual(storage.has('shinpo_auth_user'), false)

    storage.set('shinpo_access_token', 'new-access-token')
    await setCustomServerUrl('https://new.example.com')
    assert.strictEqual(storage.get('shinpo_access_token'), 'new-access-token')
    await assert.rejects(setCustomServerUrl('ftp://invalid.example.com'))
    assert.strictEqual(storage.get('shinpo_access_token'), 'new-access-token')
  })

  await t.test('native sessions keep tokens out of localStorage and migrate legacy tokens securely', async () => {
    const nativeWindow = window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } }
    const previousBridge = nativeWindow.__TAURI_INTERNALS__
    let secureRefreshToken: string | null = null
    let failSecureRead = false
    nativeWindow.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === 'get_secure_refresh_token') {
          if (failSecureRead) throw new Error('Credential service unavailable')
          return secureRefreshToken
        }
        if (cmd === 'set_secure_refresh_token') { secureRefreshToken = String(args?.token); return undefined }
        if (cmd === 'delete_secure_refresh_token') { secureRefreshToken = null; return undefined }
        throw new Error(`Unexpected command: ${cmd}`)
      },
    }

    try {
      await setAuthSession({
        accessToken: 'native-access',
        refreshToken: 'native-refresh',
        tokenType: 'Bearer',
        expiresInSeconds: 3600,
        user: { id: 2, username: 'native-user', email: 'native@shinpo.dev' },
      })
      assert.equal(localStorage.getItem('shinpo_access_token'), null)
      assert.equal(localStorage.getItem('shinpo_refresh_token'), null)
      assert.equal(authHeaders().Authorization, 'Bearer native-access')
      assert.equal(await getRefreshToken(), 'native-refresh')

      await clearAuthSession()
      assert.equal(secureRefreshToken, null)
      assert.equal(authHeaders().Authorization, undefined)

      storage.set('shinpo_access_token', 'legacy-access')
      storage.set('shinpo_refresh_token', 'legacy-refresh')
      failSecureRead = true
      assert.equal(await getRefreshToken(), null)
      assert.equal(localStorage.getItem('shinpo_access_token'), null)
      assert.equal(localStorage.getItem('shinpo_refresh_token'), null)
      failSecureRead = false

      storage.set('shinpo_access_token', 'legacy-access')
      storage.set('shinpo_refresh_token', 'legacy-refresh')
      assert.equal(await getRefreshToken(), 'legacy-refresh')
      assert.equal(authHeaders().Authorization, 'Bearer legacy-access')
      assert.equal(localStorage.getItem('shinpo_access_token'), null)
      assert.equal(localStorage.getItem('shinpo_refresh_token'), null)
      await clearAuthSession()
      secureRefreshToken = 'legacy-refresh'

      let refreshed = false
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/api/auth/refresh')) {
          refreshed = JSON.parse(String(init?.body)).refreshToken === 'legacy-refresh'
          return {
            ok: true,
            status: 200,
            json: async () => ({
              accessToken: 'restored-access',
              refreshToken: 'rotated-refresh',
              tokenType: 'Bearer',
              expiresInSeconds: 3600,
              user: { id: 2, username: 'native-user', email: 'native@shinpo.dev' },
            }),
          } as unknown as Response
        }
        assert.equal(url.endsWith('/api/auth/me'), true)
        assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer restored-access')
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 2, username: 'native-user', email: 'native@shinpo.dev' }),
        } as unknown as Response
      }) as typeof fetch
      const restoredUser = await fetchCurrentUser()
      assert.equal(refreshed, true)
      assert.equal(restoredUser?.username, 'native-user')
      assert.equal(await getRefreshToken(), 'rotated-refresh')
      assert.equal(localStorage.getItem('shinpo_access_token'), null)

      await clearAuthSession()
    } finally {
      if (previousBridge) nativeWindow.__TAURI_INTERNALS__ = previousBridge
      else delete nativeWindow.__TAURI_INTERNALS__
    }
  })

  await t.test('native access token refreshes before expiry and reschedules after rotation', async () => {
    const nativeWindow = window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } }
    const previousBridge = nativeWindow.__TAURI_INTERNALS__
    let secureRefreshToken: string | null = null
    nativeWindow.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === 'get_secure_refresh_token') return secureRefreshToken
        if (cmd === 'set_secure_refresh_token') { secureRefreshToken = String(args?.token); return undefined }
        if (cmd === 'delete_secure_refresh_token') { secureRefreshToken = null; return undefined }
        throw new Error(`Unexpected command: ${cmd}`)
      },
    }

    let refreshRequests = 0
    globalThis.fetch = (async () => {
      refreshRequests += 1
      return {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'rotated-access',
          refreshToken: 'rotated-refresh',
          tokenType: 'Bearer',
          expiresInSeconds: 3600,
          user: { id: 3, username: 'long-session', email: 'long@shinpo.dev' },
        }),
      } as unknown as Response
    }) as typeof fetch

    try {
      await setAuthSession({
        accessToken: 'short-lived-access',
        refreshToken: 'starting-refresh',
        tokenType: 'Bearer',
        expiresInSeconds: 1,
        user: { id: 3, username: 'long-session', email: 'long@shinpo.dev' },
      })
      await new Promise((resolve) => setTimeout(resolve, 1100))
      assert.equal(refreshRequests, 1)
      assert.equal(authHeaders().Authorization, 'Bearer rotated-access')
      assert.equal(await getRefreshToken(), 'rotated-refresh')
    } finally {
      await clearAuthSession()
      if (previousBridge) nativeWindow.__TAURI_INTERNALS__ = previousBridge
      else delete nativeWindow.__TAURI_INTERNALS__
    }
  })
})

