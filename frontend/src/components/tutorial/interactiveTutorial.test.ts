import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TUTORIAL_STAGES,
  SAMPLE_GOAL_CHOICES,
  isInteractiveTutorialEnabled,
} from './interactiveTutorialTypes.ts'

test('interactive tutorial defines all 7 stages in canonical execution OS order', () => {
  assert.equal(TUTORIAL_STAGES.length, 7)

  const expectedIds = [
    'DIRECTION',
    'BREAKDOWN',
    'TASK',
    'SCHEDULE',
    'GUARDIAN',
    'FOCUS',
    'REVIEW',
  ]

  TUTORIAL_STAGES.forEach((stage, idx) => {
    assert.equal(stage.index, idx + 1)
    assert.equal(stage.id, expectedIds[idx])
    assert.ok(stage.title.length > 0)
    assert.ok(stage.subtitle.length > 0)
    assert.ok(stage.badge.length > 0)
  })
})

test('sample goal choices provide realistic developer and focus targets', () => {
  assert.equal(SAMPLE_GOAL_CHOICES.length, 3)

  const ids = SAMPLE_GOAL_CHOICES.map((g) => g.id)
  assert.deepEqual(ids, ['product-beta', 'deep-architecture', 'deep-work-habit'])

  SAMPLE_GOAL_CHOICES.forEach((choice) => {
    assert.ok(choice.title.length > 0)
    assert.ok(choice.category.length > 0)
    assert.ok(choice.description.length > 0)
    assert.ok(choice.defaultObjective.length > 0)
  })
})

test('isInteractiveTutorialEnabled defaults to true and honors localStorage override', () => {
  // Mock simple localStorage for test runner
  const storageMap = new Map<string, string>()
  const originalLocalStorage = globalThis.localStorage

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storageMap.get(key) ?? null,
      setItem: (key: string, val: string) => storageMap.set(key, val),
      removeItem: (key: string) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    },
    writable: true,
    configurable: true,
  })

  try {
    storageMap.clear()
    assert.equal(isInteractiveTutorialEnabled(), true)

    storageMap.set('shinpo_interactive_tutorial_enabled', 'false')
    assert.equal(isInteractiveTutorialEnabled(), false)

    storageMap.set('shinpo_interactive_tutorial_enabled', 'true')
    assert.equal(isInteractiveTutorialEnabled(), true)
  } finally {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      })
    }
  }
})
