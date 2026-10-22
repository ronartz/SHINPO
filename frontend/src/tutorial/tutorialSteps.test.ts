import assert from 'node:assert/strict'
import test from 'node:test'
import { SHINPO_ONBOARDING_STEPS } from './tutorialSteps.ts'

test('first-use guidance explains seeded examples and offers a real-user action', () => {
  assert.match(SHINPO_ONBOARDING_STEPS[0].instruction, /starter example/i)
  assert.match(SHINPO_ONBOARDING_STEPS[0].instruction, /edit it or create/i)
  assert.match(SHINPO_ONBOARDING_STEPS[1].instruction, /starter task.*example/i)
  assert.match(SHINPO_ONBOARDING_STEPS[1].instruction, /edit it or add/i)
})
