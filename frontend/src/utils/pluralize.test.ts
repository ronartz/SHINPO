import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCount } from './pluralize.ts'

test('count labels use correct singular and plural forms including zero', () => {
  assert.equal(formatCount(0, 'day'), '0 days')
  assert.equal(formatCount(1, 'day'), '1 day')
  assert.equal(formatCount(2, 'day'), '2 days')
})
