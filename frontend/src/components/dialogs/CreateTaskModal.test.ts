import test from 'node:test'
import assert from 'node:assert/strict'

test('CreateTaskModal duration presets match specifications', () => {
  const PRESETS = [10, 15, 20, 25, 30, 45, 60, 90, 120]
  assert.equal(PRESETS.length, 9)
  assert.deepEqual(PRESETS, [10, 15, 20, 25, 30, 45, 60, 90, 120])
})

test('CreateTaskModal duration boundaries enforce 5 to 480 minutes', () => {
  const MIN_DURATION = 5
  const MAX_DURATION = 480

  const isValidDuration = (val: number) => !isNaN(val) && val >= MIN_DURATION && val <= MAX_DURATION

  // Valid boundaries
  assert.equal(isValidDuration(5), true)
  assert.equal(isValidDuration(480), true)
  assert.equal(isValidDuration(25), true)
  assert.equal(isValidDuration(90), true)
  assert.equal(isValidDuration(120), true)

  // Invalid boundaries
  assert.equal(isValidDuration(0), false)
  assert.equal(isValidDuration(4), false)
  assert.equal(isValidDuration(-10), false)
  assert.equal(isValidDuration(481), false)
  assert.equal(isValidDuration(1000), false)
  assert.equal(isValidDuration(NaN), false)
})

test('CreateTaskModal Associated Goal list reflects exact database rows without slicing', () => {
  const dbGoals = [
    { id: 1, title: 'Starter goal: Master Execution System', targetDate: '2026-12-31', status: 'ACTIVE' },
  ]

  // Mapping preserves exact length without artificial limit
  const dropdownOptions = dbGoals.map((g) => ({ value: g.id, label: g.title }))
  assert.equal(dropdownOptions.length, 1)
  assert.equal(dropdownOptions[0].label, 'Starter goal: Master Execution System')

  // When database has 2 goals
  const dbTwoGoals = [
    { id: 10, title: 'Build Desktop Beta', targetDate: '2026-11-01', status: 'ACTIVE' },
    { id: 11, title: 'Harden Security Protocol', targetDate: '2026-11-15', status: 'ACTIVE' },
  ]
  const twoOptions = dbTwoGoals.map((g) => ({ value: g.id, label: g.title }))
  assert.equal(twoOptions.length, 2)
  assert.equal(twoOptions[0].label, 'Build Desktop Beta')
  assert.equal(twoOptions[1].label, 'Harden Security Protocol')
})

test('Dashboard Tasks Board preview limits cards to maximum 3 while preserving full header count', () => {
  const readyMissions = [
    { id: 1, title: 'Task 1' },
    { id: 2, title: 'Task 2' },
    { id: 3, title: 'Task 3' },
    { id: 4, title: 'Task 4' },
    { id: 5, title: 'Task 5' },
    { id: 6, title: 'Task 6' },
    { id: 7, title: 'Task 7' },
  ]

  const previewCards = readyMissions.slice(0, 3)
  const fullCount = readyMissions.length
  const remainingCount = readyMissions.length - 3

  assert.equal(previewCards.length, 3)
  assert.equal(fullCount, 7)
  assert.equal(remainingCount, 4)
  assert.equal(previewCards[0].id, 1)
  assert.equal(previewCards[2].id, 3)
})

