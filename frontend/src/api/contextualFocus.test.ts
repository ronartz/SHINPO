import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStudyResourceRequest,
  createStudyResource,
  deleteStudyResource,
  getContextualFocusStatus,
  getOpenableResourceUrl,
  getStudyResources,
  normalizeContextualFocusStatus,
  updateStudyFocusMode,
  validateStudyResourceDraft,
} from './contextualFocus.ts'
import type { StudyResource, StudyResourceDraft } from './contextualFocus.ts'

const baseDraft: StudyResourceDraft = {
  missionId: 8,
  resourceType: 'WEBSITE',
  matchType: 'EXACT',
  disposition: 'APPROVED',
  destination: 'https://docs.spring.io/spring-security/reference/',
}

function resource(overrides: Partial<StudyResource> = {}): StudyResource {
  return {
    id: 1,
    userId: 4,
    missionId: 8,
    focusSessionId: null,
    resourceType: 'WEBSITE',
    matchType: 'EXACT',
    disposition: 'APPROVED',
    destination: 'https://docs.spring.io/security',
    canonicalDestination: 'https://docs.spring.io/security',
    displayName: 'Spring Security',
    expiresAt: null,
    createdAt: '2026-10-16T10:00:00Z',
    updatedAt: '2026-10-16T10:00:00Z',
    ...overrides,
  }
}

test('contextual Focus resource validation is scope-aware and resists lookalike hosts', () => {
  assert.equal(validateStudyResourceDraft(baseDraft), null)
  assert.equal(validateStudyResourceDraft({
    ...baseDraft,
    matchType: 'DOMAIN',
    destination: 'docs.spring.io',
  }), null)
  assert.equal(validateStudyResourceDraft({
    ...baseDraft,
    matchType: 'DOMAIN',
    destination: 'https://docs.spring.io/',
  }), null)
  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    matchType: 'DOMAIN',
    destination: 'https://docs.spring.io/reference',
  }) ?? '', /exact domain/)

  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    resourceType: 'YOUTUBE_VIDEO',
    destination: 'https://youtube.com.evil.example/watch?v=trusted-looking',
  }) ?? '', /YouTube video/)

  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    resourceType: 'DISCORD_CHANNEL',
    matchType: 'BROWSER_CHANNEL',
    destination: 'https://discord.com.evil.example/channels/123/456',
  }) ?? '', /discord\.com/)

  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    matchType: 'URL_PATTERN',
    destination: 'https://*.example.com/course/*',
  }) ?? '', /Wildcards are allowed only after the hostname/)

  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    missionId: undefined,
    resourceType: 'DESKTOP_PROCESS',
    matchType: 'PROCESS',
    destination: 'code',
  }) ?? '', /task or active Focus session/)

  assert.match(validateStudyResourceDraft({
    ...baseDraft,
    resourceType: 'DESKTOP_PROCESS',
    matchType: 'PROCESS',
    destination: 'code',
  }) ?? '', /active Focus session/)
})

test('temporary resource request uses the selected scope and produces a bounded expiry', () => {
  const request = buildStudyResourceRequest({
    ...baseDraft,
    missionId: undefined,
    focusSessionId: 21,
    resourceType: 'TEMPORARY_SITE',
    displayName: 'Temporary API reference',
    durationMinutes: 5,
  }, Date.parse('2026-10-16T10:00:00Z'))

  assert.equal(request.focusSessionId, 21)
  assert.equal(request.missionId, undefined)
  assert.equal(request.displayName, 'Temporary API reference')
  assert.equal(request.expiresAt, '2026-10-16T10:05:00.000Z')
})

test('coverage normalization never upgrades absent status to connected', () => {
  const degraded = normalizeContextualFocusStatus({}, 11)
  assert.equal(degraded.sessionId, 11)
  assert.equal(degraded.browserCompanion.state, 'DISCONNECTED')
  assert.equal(degraded.browserCompanion.adapterCoverage, 'NONE')
  assert.equal(degraded.nativeShield.state, 'UNAVAILABLE')

  const limited = normalizeContextualFocusStatus({
    sessionId: 11,
    sessionStatus: 'ACTIVE',
    mode: 'PROTECTED',
    policyRevision: 7,
    browserCompanion: {
      state: 'CONNECTED',
      adapterCoverage: 'LIMITED',
      adapterName: 'Discord browser routes',
      detail: 'Desktop channels are not visible.',
    },
    nativeShield: { state: 'CONNECTED', detail: 'Paired desktop service' },
    restrictions: [resource({ id: 9, disposition: 'BLOCKED' })],
  }, 11)

  assert.equal(limited.browserCompanion.state, 'CONNECTED')
  assert.equal(limited.browserCompanion.adapterCoverage, 'LIMITED')
  assert.equal(limited.mode, 'PROTECTED')
  assert.equal(limited.restrictions.length, 1)
})

test('open-resource helper permits http(s) only and excludes process rules', () => {
  assert.equal(
    getOpenableResourceUrl(resource({ matchType: 'DOMAIN', canonicalDestination: 'docs.spring.io' })),
    'https://docs.spring.io/',
  )
  assert.equal(
    getOpenableResourceUrl(resource({
      resourceType: 'YOUTUBE_VIDEO',
      canonicalDestination: 'youtube:video:dQw4w9WgXcQ',
    })),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  )
  assert.equal(
    getOpenableResourceUrl(resource({
      resourceType: 'YOUTUBE_PLAYLIST',
      canonicalDestination: 'youtube:playlist:PL1234567890',
    })),
    'https://www.youtube.com/playlist?list=PL1234567890',
  )
  assert.equal(
    getOpenableResourceUrl(resource({
      resourceType: 'DISCORD_CHANNEL',
      matchType: 'BROWSER_CHANNEL',
      canonicalDestination: 'discord:channel:123456/987654',
    })),
    'https://discord.com/channels/123456/987654',
  )
  assert.equal(
    getOpenableResourceUrl(resource({
      canonicalDestination: 'javascript:alert(1)',
      destination: 'javascript:alert(1)',
    })),
    null,
  )
  assert.equal(
    getOpenableResourceUrl(resource({
      resourceType: 'DESKTOP_PROCESS',
      matchType: 'PROCESS',
      canonicalDestination: 'code',
      destination: 'code',
    })),
    null,
  )
})

const storage = new Map<string, string>()
globalThis.window = globalThis as unknown as Window & typeof globalThis
globalThis.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, String(value)) },
  removeItem: (key: string) => { storage.delete(key) },
  clear: () => { storage.clear() },
  length: 0,
  key: () => null,
} as unknown as Storage

test('contextual Focus API client uses the authenticated contract', async (t) => {
  const originalFetch = globalThis.fetch
  storage.set('shinpo_access_token', 'contextual-test-token')

  t.after(() => {
    globalThis.fetch = originalFetch
    storage.clear()
  })

  await t.test('lists scoped resources with query parameters', async () => {
    let capturedUrl = ''
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input)
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    await getStudyResources({ missionId: 8, sessionId: 11 })
    const url = new URL(capturedUrl, 'http://local.test')
    assert.equal(url.pathname, '/api/contextual-focus/resources')
    assert.equal(url.searchParams.get('missionId'), '8')
    assert.equal(url.searchParams.get('sessionId'), '11')
  })

  await t.test('creates and deletes resources with bearer authentication', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return new Response(JSON.stringify(resource()), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch

    await createStudyResource(buildStudyResourceRequest(baseDraft))
    await deleteStudyResource(1)

    assert.match(calls[0].url, /\/api\/contextual-focus\/resources$/)
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer contextual-test-token')
    assert.equal(JSON.parse(String(calls[0].init?.body)).matchType, 'EXACT')
    assert.match(calls[1].url, /\/api\/contextual-focus\/resources\/1$/)
    assert.equal(calls[1].init?.method, 'DELETE')
  })

  await t.test('updates mode and reads honest status', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init })
      return new Response(JSON.stringify({
        sessionId: 11,
        sessionStatus: 'ACTIVE',
        mode: 'STRICT',
        policyRevision: 8,
        browserCompanion: { state: 'DISCONNECTED', adapterCoverage: 'NONE' },
        nativeShield: { state: 'CONNECTED' },
        restrictions: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch

    const changed = await updateStudyFocusMode(11, 'STRICT')
    const status = await getContextualFocusStatus(11)

    assert.match(calls[0].url, /\/api\/contextual-focus\/sessions\/11\/mode$/)
    assert.equal(calls[0].init?.method, 'PATCH')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { mode: 'STRICT' })
    assert.match(calls[1].url, /\/api\/contextual-focus\/status\?sessionId=11$/)
    assert.equal(changed.mode, 'STRICT')
    assert.equal(status.browserCompanion.state, 'DISCONNECTED')
  })
})
