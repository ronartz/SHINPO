import test from 'node:test'
import assert from 'node:assert/strict'
import { browserCompanionStatusLabel, isBrowserCompanionConnected, isBrowserCompanionPairingSaved } from './browserCompanionStatus.ts'

test('a saved token is not reported as a live Browser Companion connection', () => {
  const status = { paired: true, state: 'PAIRING_SAVED', connected: false }

  assert.equal(isBrowserCompanionPairingSaved(status), true)
  assert.equal(isBrowserCompanionConnected(status), false)
  assert.equal(browserCompanionStatusLabel(status), 'Pairing saved · connection unverified')
})

test('only an explicit live connection reports Connected', () => {
  assert.equal(isBrowserCompanionConnected({ paired: true, connected: true }), true)
  assert.equal(browserCompanionStatusLabel({ state: 'CONNECTED' }), 'Connected')
})

test('unpaired and unavailable states do not imply website protection', () => {
  for (const state of [undefined, 'UNPAIRED', 'UNREACHABLE']) {
    const status = { paired: false, connected: false, state }
    assert.equal(isBrowserCompanionConnected(status), false)
    assert.equal(isBrowserCompanionPairingSaved(status), false)
    assert.equal(browserCompanionStatusLabel(status), 'Not paired')
  }
})
