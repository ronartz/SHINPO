import { describe, it } from 'node:test'
import assert from 'node:assert'
import { fetchWithoutRedirects, isValidServerUrl, isValidWebSocketUrl } from './config.ts'

describe('Config & Settings Validation Contracts', () => {
  it('accepts empty custom server URL (clearing to default)', () => {
    const res = isValidServerUrl('')
    assert.strictEqual(res.valid, true)
    const resWhitespace = isValidServerUrl('   ')
    assert.strictEqual(resWhitespace.valid, true)
  })

  it('allows cleartext only for explicit loopback development servers', () => {
    assert.strictEqual(isValidServerUrl('http://localhost:8080').valid, true)
    assert.strictEqual(isValidServerUrl('http://127.0.0.1:8080').valid, true)
    assert.strictEqual(isValidServerUrl('http://[::1]:8080').valid, true)
    assert.strictEqual(isValidServerUrl('http://192.168.1.100:8080').valid, false)
    assert.match(isValidServerUrl('http://192.168.1.100:8080').reason || '', /HTTPS/)
  })

  it('accepts remote HTTPS URLs with ports and API base paths', () => {
    assert.strictEqual(isValidServerUrl('https://shinpo.eonx.dev').valid, true)
    assert.strictEqual(isValidServerUrl('https://api.my-domain.com:8443/api/').valid, true)
  })

  it('rejects embedded credentials and URL query/fragment components', () => {
    assert.strictEqual(isValidServerUrl('https://user:secret@example.com').valid, false)
    assert.strictEqual(isValidServerUrl('https://@example.com').valid, false)
    assert.strictEqual(isValidServerUrl('https://example.com/?token=x').valid, false)
    assert.strictEqual(isValidServerUrl('https://example.com/#fragment').valid, false)
    assert.strictEqual(isValidServerUrl('http://localhost.example:8080').valid, false)
  })

  it('rejects disallowed or dangerous protocols', () => {
    const jsUrl = isValidServerUrl('javascript:alert(1)')
    assert.strictEqual(jsUrl.valid, false)
    assert.match(jsUrl.reason || '', /http:\/\/ or https:\/\//)

    const fileUrl = isValidServerUrl('file:///etc/passwd')
    assert.strictEqual(fileUrl.valid, false)

    const wsUrl = isValidServerUrl('ws://localhost:8080')
    assert.strictEqual(wsUrl.valid, false)

    const ftpUrl = isValidServerUrl('ftp://example.com')
    assert.strictEqual(ftpUrl.valid, false)
  })

  it('rejects malformed or non-URL strings', () => {
    const malformed = isValidServerUrl('not a url at all')
    assert.strictEqual(malformed.valid, false)
    assert.match(malformed.reason || '', /Invalid URL format/)
  })

  it('blocks HTTP redirects for requests that may carry credentials', async () => {
    const originalFetch = globalThis.fetch
    let redirectMode: RequestRedirect | undefined
    globalThis.fetch = async (_input, init) => {
      redirectMode = init?.redirect
      return new Response(null, { status: 200 })
    }
    try {
      await fetchWithoutRedirects('https://api.example.com/api/auth/me')
      assert.strictEqual(redirectMode, 'error')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('requires WSS for remote WebSocket endpoints', () => {
    assert.strictEqual(isValidWebSocketUrl('ws://localhost:8080/ws').valid, true)
    assert.strictEqual(isValidWebSocketUrl('ws://[::1]:8080/ws').valid, true)
    assert.strictEqual(isValidWebSocketUrl('wss://api.example.com/ws').valid, true)
    assert.strictEqual(isValidWebSocketUrl('ws://api.example.com/ws').valid, false)
    assert.strictEqual(isValidWebSocketUrl('wss://user:pass@example.com/ws').valid, false)
  })
})
