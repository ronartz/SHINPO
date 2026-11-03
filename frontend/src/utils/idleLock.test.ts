import assert from 'node:assert/strict'
import test from 'node:test'
import { isLocalVaultIdleLockDue, LOCAL_VAULT_IDLE_LOCK_MS } from './idleLock.ts'

test('local vault idle lock triggers at the threshold and ignores invalid timestamps', () => {
  assert.equal(isLocalVaultIdleLockDue(1_000, 1_000 + LOCAL_VAULT_IDLE_LOCK_MS - 1), false)
  assert.equal(isLocalVaultIdleLockDue(1_000, 1_000 + LOCAL_VAULT_IDLE_LOCK_MS), true)
  assert.equal(isLocalVaultIdleLockDue(Number.NaN, 1_000_000), false)
  assert.equal(isLocalVaultIdleLockDue(1_000, Number.POSITIVE_INFINITY), false)
})
