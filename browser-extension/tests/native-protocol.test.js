import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/lib/native-protocol.js'

const {
  PROTOCOL_VERSION,
  createRequest,
  validateResponse,
  isPairingToken,
} = globalThis.ShinpoNativeProtocol

test('createRequest produces valid protocol payload', () => {
  const req = createRequest('get_policy', { sessionId: 10 })
  assert.equal(req.protocolVersion, PROTOCOL_VERSION)
  assert.equal(req.type, 'get_policy')
  assert.equal(req.payload.sessionId, 10)
  assert.ok(req.requestId)
})

test('createRequest attaches valid auth pairing token', () => {
  const validToken = 'a'.repeat(32)
  const req = createRequest('pair', {}, validToken)
  assert.equal(req.auth, validToken)

  assert.throws(() => {
    createRequest('pair', {}, 'too-short')
  }, /Invalid pairing token/)
})

test('validateResponse extracts payload or throws on error', () => {
  const requestId = 'test-request-id'
  const okResp = {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    ok: true,
    payload: { status: 'ACTIVE' },
  }
  const payload = validateResponse(okResp, requestId)
  assert.equal(payload.status, 'ACTIVE')

  const errorResp = {
    protocolVersion: PROTOCOL_VERSION,
    requestId,
    ok: false,
    error: { code: 'AUTHENTICATION_FAILED', message: 'Unauthorized' },
  }
  assert.throws(() => {
    validateResponse(errorResp, requestId)
  }, (err) => {
    return err.code === 'AUTHENTICATION_FAILED' && err.message.includes('Unauthorized')
  })
})

test('isPairingToken verifies token format', () => {
  assert.equal(isPairingToken('0123456789abcdef0123456789abcdef'), true)
  assert.equal(isPairingToken('short'), false)
  assert.equal(isPairingToken(''), false)
})

