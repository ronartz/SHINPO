import test from 'node:test'
import assert from 'node:assert/strict'
import { getTaskViewPreference, saveTaskViewPreference } from './taskViewPreference.ts'

test('task view selection persists independently for each account', () => {
  const previousStorage = globalThis.localStorage
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  try {
    assert.equal(getTaskViewPreference(17), 'list')
    saveTaskViewPreference(17, 'board')
    saveTaskViewPreference(23, 'list')
    assert.equal(getTaskViewPreference(17), 'board')
    assert.equal(getTaskViewPreference(23), 'list')
    assert.equal(getTaskViewPreference(null), 'list')
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage })
  }
})
