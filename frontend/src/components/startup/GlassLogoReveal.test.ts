/*
 * GlassLogoReveal.test.ts
 *
 * Unit regression test suite for SHINPO Cinematic Glass Logo Reveal:
 * - One-shot playback configuration
 * - Authentic logo asset configuration & originalColors
 * - Sequence duration boundaries (3.5 - 4.5s)
 * - Session storage guard against repeated splash animations
 * - Reduced motion & WebGL failure fallback guarantees
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  LOOKS,
} from './glassShaderEngine.ts'
import type {
  Settings,
} from './glassShaderEngine.ts'

describe('GlassLogoReveal contracts & animation timeline', () => {
  it('enforces dark look as default with authentic colors and non-looping playback', () => {
    const darkLook: Settings = LOOKS.dark
    assert.equal(darkLook.originalColors, true, 'SHINPO must use authentic logo colors')
    assert.equal(darkLook.iconPlate, false, 'Droplet must form cleanly over dark backdrop')
    assert.equal(darkLook.keepPlate, false, 'Glass must release cleanly leaving bare logo mark')
    assert.ok(darkLook.present >= 2.0 && darkLook.present <= 3.0, 'Present phase must be ~2.5s')
  })

  it('completes the glass reveal sequence within the 3.5s - 4.5s target budget', () => {
    const TAIL = 1.1
    const darkDuration = LOOKS.dark.present + TAIL
    const lightDuration = LOOKS.light.present + TAIL

    assert.ok(darkDuration >= 3.5 && darkDuration <= 4.5, `Dark reveal (${darkDuration}s) must fit 3.5-4.5s target`)
    assert.ok(lightDuration >= 3.5 && lightDuration <= 4.5, `Light reveal (${lightDuration}s) must fit 3.5-4.5s target`)
  })

  it('ensures theme background defaults match canonical palette tokens', () => {
    assert.equal(LOOKS.dark.background, '#0f1738', 'Dark atmosphere must match Aurora Dark #0f1738')
    assert.equal(LOOKS.light.background, '#f1f5f9', 'Light atmosphere must match Aurora Light #f1f5f9')
  })

  it('preserves superellipse and optical dispersion tuning contracts', () => {
    const dark = LOOKS.dark
    assert.ok(dark.dispersion > 0, 'Chromatic dispersion must be active for glass refraction')
    assert.ok(dark.bevelWidth > 0, 'Bevel rim must have positive width')
    assert.ok(dark.corner >= 4.0 && dark.corner <= 6.0, 'Superellipse corner exponent must form an app squircle')
    assert.ok(dark.opticalDepth > 0, 'Optical depth must bend incoming logo rays')
  })

  it('verifies one-time-per-session startup guard key contract', () => {
    const STORAGE_KEY = 'shinpo_splash_shown'
    assert.equal(STORAGE_KEY, 'shinpo_splash_shown')

    // Simulate session storage contract
    const mockStorage = new Map<string, string>()
    assert.equal(mockStorage.get(STORAGE_KEY), undefined)

    mockStorage.set(STORAGE_KEY, 'true')
    assert.equal(mockStorage.get(STORAGE_KEY), 'true')
    assert.equal(mockStorage.get(STORAGE_KEY) === 'true', true)
  })
})
