(function installNativeProtocol(global) {
  'use strict'

  const PROTOCOL_VERSION = 1
  const HOST_NAME = 'com.shinpo.browser_companion'
  const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/

  function createRequest(type, payload = {}, authenticationToken = null) {
    if (typeof type !== 'string' || !/^[a-z_]{2,40}$/.test(type)) {
      throw new TypeError('Invalid native message type')
    }
    const request = {
      protocolVersion: PROTOCOL_VERSION,
      requestId: crypto.randomUUID(),
      type,
      payload: payload && typeof payload === 'object' ? payload : {},
    }
    if (authenticationToken !== null) {
      if (!TOKEN_PATTERN.test(authenticationToken)) throw new TypeError('Invalid pairing token')
      request.auth = authenticationToken
    }
    return request
  }

  function validateResponse(response, expectedRequestId) {
    if (!response || typeof response !== 'object') throw new Error('Native host returned an invalid response')
    if (response.protocolVersion !== PROTOCOL_VERSION) throw new Error('Native host protocol version mismatch')
    if (response.requestId !== expectedRequestId) throw new Error('Native host response ID mismatch')
    if (response.ok !== true) {
      const code = typeof response.error?.code === 'string' ? response.error.code : 'HOST_ERROR'
      const message = typeof response.error?.message === 'string'
        ? response.error.message.slice(0, 240)
        : 'Native host request failed'
      const error = new Error(message)
      error.code = code
      throw error
    }
    return response.payload && typeof response.payload === 'object' ? response.payload : {}
  }

  function isPairingToken(value) {
    return typeof value === 'string' && TOKEN_PATTERN.test(value)
  }

  global.ShinpoNativeProtocol = Object.freeze({
    PROTOCOL_VERSION,
    HOST_NAME,
    createRequest,
    validateResponse,
    isPairingToken,
  })
})(globalThis)
