import test from 'node:test'
import assert from 'node:assert/strict'
import { guardianCanRequestClose, guardianCapabilityLabel, guardianInterventionDescription, guardianModeLabel, guardianObserverLabel, guardianOutcomeLabel } from './guardianCapability.ts'

test('Guardian capability labels stay understandable and honest', () => {
  assert.equal(guardianCapabilityLabel('STRICT_LINUX_COOPERATIVE_CLOSE'), 'Strict · warning-only; app closure disabled')
  assert.equal(guardianCapabilityLabel('STRICT_WARNING_ONLY'), 'Strict · warning-only; app closure disabled')
  assert.equal(guardianCapabilityLabel('STANDARD_SAMPLED_RUNTIME_ALLOWANCE'), 'Standard · warning-only')
  assert.equal(guardianCapabilityLabel('BREAK_OBSERVATION_ONLY'), 'Break · observation only')
  assert.equal(guardianCapabilityLabel('LIMITED_PLATFORM_UNSUPPORTED'), 'Limited · app intervention unavailable on this platform')
  assert.equal(guardianCapabilityLabel('EMERGENCY_STOPPED'), 'Stopped for this session')
  assert.equal(guardianCapabilityLabel('new_future_status'), 'Monitoring · no app action confirmed')
  assert.equal(guardianCapabilityLabel(null), 'Monitoring · no app action confirmed')
  assert.equal(guardianCapabilityLabel('LOCKED'), 'Vault locked')
  assert.equal(guardianOutcomeLabel('CLOSE_REQUESTED_UNCONFIRMED'), 'Graceful close requested · exit unconfirmed')
  assert.equal(guardianOutcomeLabel('ALLOWED_BREAK'), 'Allowed during break')
  assert.equal(guardianOutcomeLabel('new_future_outcome'), 'new future outcome')
  assert.equal(guardianObserverLabel('MONITORING'), 'Monitoring')
  assert.equal(guardianObserverLabel('DEGRADED'), 'Unavailable')
  assert.equal(guardianModeLabel('PROTECTED'), 'Standard')
  assert.equal(guardianModeLabel('unrecognized'), 'Not set')
})

test('Guardian descriptions make warning-only behavior explicit', () => {
  assert.match(guardianInterventionDescription('STRICT_LINUX_COOPERATIVE_CLOSE'), /Strict.*recognized app observations.*does not close applications/)
  assert.match(guardianInterventionDescription('STANDARD_SAMPLED_RUNTIME_ALLOWANCE'), /sample.*app-running time.*does not close applications/)
  assert.match(guardianInterventionDescription('LIMITED_NO_CLOSURE_CONSENT'), /Monitoring only.*closure is disabled/)
  assert.match(guardianInterventionDescription('LIMITED_PLATFORM_UNSUPPORTED'), /observation only.*unavailable/)
  assert.match(guardianInterventionDescription('unknown'), /Monitoring only.*does not confirm/)
})

test('Guardian close availability stays disabled for the warning-only release', () => {
  assert.equal(guardianCanRequestClose('STRICT_LINUX_COOPERATIVE_CLOSE', false), false)
  assert.equal(guardianCanRequestClose('STANDARD_SAMPLED_RUNTIME_ALLOWANCE', false), false)
  assert.equal(guardianCanRequestClose('STANDARD_SAMPLED_RUNTIME_ALLOWANCE', true), false)
  assert.equal(guardianCanRequestClose('WARNING_ONLY', false), false)
  assert.equal(guardianCanRequestClose(undefined, false), false)
})
