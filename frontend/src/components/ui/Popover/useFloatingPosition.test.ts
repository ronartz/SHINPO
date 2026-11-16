import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateFloatingGeometry } from './useFloatingPosition.ts'

const geometry = (overrides: Partial<Parameters<typeof calculateFloatingGeometry>[0]> = {}) =>
  calculateFloatingGeometry({
    trigger: { top: 300, right: 950, bottom: 340, left: 490, width: 460 },
    popoverWidth: 460,
    popoverHeight: 240,
    viewportWidth: 1440,
    viewportHeight: 900,
    offset: 6,
    padding: 10,
    matchTriggerWidth: true,
    inDialog: true,
    ...overrides,
  })

test('dialog selects stay aligned below the trigger rather than opening sideways', () => {
  const result = geometry()
  assert.equal(result.placement, 'bottom')
  assert.equal(result.style.left, '490px')
  assert.equal(result.style.top, '346px')
})

test('popover flips above when the remaining space below is smaller', () => {
  const result = geometry({
    trigger: { top: 700, right: 950, bottom: 740, left: 490, width: 460 },
  })
  assert.equal(result.placement, 'top')
  assert.equal(result.style.top, '454px')
})

test('popover remains inside the viewport and its height is constrained to available space', () => {
  const result = geometry({
    trigger: { top: 80, right: 1420, bottom: 120, left: 1280, width: 200 },
    popoverWidth: 320,
    popoverHeight: 420,
    viewportWidth: 1440,
    viewportHeight: 600,
    matchTriggerWidth: false,
    inDialog: false,
  })
  assert.equal(result.style.left, '1110px')
  assert.equal(result.style.maxHeight, '320px')
  assert.equal(result.style.zIndex, 1000)
})
