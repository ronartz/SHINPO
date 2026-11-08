import test from 'node:test'
import assert from 'node:assert/strict'
import { getPlatform, setPlatform } from './platformResolution.ts'

test('Platform Resolution Contracts', async (t) => {
  await t.test('defaults to desktop when no override is set', () => {
    const platform = getPlatform()
    assert.equal(platform, 'desktop')
  })

  await t.test('resizing window or small width does NOT trigger mobile (deterministic)', () => {
    const originalWidth = (globalThis as unknown as { innerWidth?: number }).innerWidth
    try {
      (globalThis as unknown as { innerWidth: number }).innerWidth = 375;
      (globalThis as unknown as { innerHeight: number }).innerHeight = 667

      const platform = getPlatform()
      assert.equal(platform, 'desktop', 'Small screen width must NOT trigger mobile platform without explicit target')
    } finally {
      (globalThis as unknown as { innerWidth?: number }).innerWidth = originalWidth
    }
  })

  await t.test('setPlatform persists preference to localStorage', () => {
    const mockStorage: Record<string, string> = {}
    const originalLocalStorage = globalThis.localStorage
    try {
      globalThis.localStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => { mockStorage[key] = val },
        removeItem: (key: string) => { delete mockStorage[key] },
        clear: () => {},
        length: 0,
        key: () => null,
      }

      setPlatform('mobile')
      assert.equal(mockStorage['shinpo_platform'], 'mobile')

      const platform = getPlatform()
      assert.equal(platform, 'mobile')

      setPlatform('desktop')
      assert.equal(mockStorage['shinpo_platform'], 'desktop')
      assert.equal(getPlatform(), 'desktop')
    } finally {
      globalThis.localStorage = originalLocalStorage
    }
  })
})
