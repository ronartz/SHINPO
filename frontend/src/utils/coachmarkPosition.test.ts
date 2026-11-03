import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoachmarkPosition } from './coachmarkPosition.ts'

test('coachmark stays clear of a target when another viewport side has room', () => {
  const target = { top: 280, left: 430, right: 510, bottom: 330, width: 80, height: 50 }
  const position = getCoachmarkPosition(target, { width: 360, height: 240 }, { width: 1200, height: 800 }, 'right')
  assert.equal(position.left, 526)
  assert.equal(position.top, 185)
})

test('coachmark remains inside the viewport when no side can fit without overlap', () => {
  const target = { top: 250, left: 180, right: 620, bottom: 350, width: 440, height: 100 }
  const panel = { width: 400, height: 360 }
  const viewport = { width: 800, height: 600 }
  const position = getCoachmarkPosition(target, panel, viewport, 'bottom')
  assert.ok(position.left >= 16 && position.top >= 16)
  assert.ok(position.left + panel.width <= viewport.width - 16)
  assert.ok(position.top + panel.height <= viewport.height - 16)
})
