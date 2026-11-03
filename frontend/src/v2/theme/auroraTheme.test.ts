import test from 'node:test'
import assert from 'node:assert/strict'
import { getAuroraTheme } from './auroraTheme.ts'
import { auroraColorFallbacks } from './auroraTokens.ts'

function luminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255)
  assert.ok(channels?.length === 3, `Expected a concrete hex color, got ${hex}`)
  const [r, g, b] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

test('Aurora MUI themes resolve the canonical dark and light palette', () => {
  const dark = getAuroraTheme('dark')
  const light = getAuroraTheme('light')

  assert.equal(dark.palette.primary.main, '#3B82F6')
  assert.equal(dark.palette.info.main, '#3B82F6')
  assert.equal(light.palette.primary.main, '#2563EB')
  assert.equal(dark.palette.background.default, '#0B1120')
  assert.equal(light.palette.background.default, '#F8FAFC')
})

test('Aurora body text and primary actions meet WCAG AA contrast', () => {
  for (const mode of ['dark', 'light'] as const) {
    const { palette } = getAuroraTheme(mode)
    const surface = palette.background.paper
    assert.ok(contrast(palette.text.primary, surface) >= 4.5, `${mode} primary text contrast`)
    assert.ok(contrast(palette.text.secondary, surface) >= 4.5, `${mode} secondary text contrast`)
    assert.ok(contrast(palette.primary.contrastText, palette.primary.main) >= 4.5, `${mode} primary action contrast`)
    assert.ok(contrast(palette.success.contrastText, palette.success.main) >= 4.5, `${mode} success contrast`)
    assert.ok(contrast(palette.warning.contrastText, palette.warning.main) >= 4.5, `${mode} warning contrast`)
    assert.ok(contrast(palette.error.contrastText, palette.error.main) >= 4.5, `${mode} danger contrast`)
    assert.ok(contrast(auroraColorFallbacks[mode].focusCyan, palette.background.default) >= 4.5, `${mode} live Focus accent contrast`)
    assert.ok(contrast(auroraColorFallbacks[mode].aiViolet, palette.background.paper) >= 4.5, `${mode} EONPAI accent contrast`)
  }
})
