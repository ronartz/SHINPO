import { describe, it } from 'node:test'
import assert from 'node:assert'
import { isValidServerUrl } from './config.ts'

describe('Config & Settings Validation Contracts', () => {
  it('accepts empty custom server URL (clearing to default)', () => {
    const res = isValidServerUrl('')
    assert.strictEqual(res.valid, true)
    const resWhitespace = isValidServerUrl('   ')
    assert.strictEqual(resWhitespace.valid, true)
  })

  it('accepts valid http:// and https:// URLs with various ports and paths', () => {
    assert.strictEqual(isValidServerUrl('http://localhost:8080').valid, true)
    assert.strictEqual(isValidServerUrl('https://shinpo.eonx.dev').valid, true)
    assert.strictEqual(isValidServerUrl('https://api.my-domain.com:8443/').valid, true)
    assert.strictEqual(isValidServerUrl('http://192.168.1.100:8080').valid, true)
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
})
