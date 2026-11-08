import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hexToRgb,
  backing,
  toShader,
  SILK_THEME_PALETTES,
  DEFAULT_LOGIN_BACKGROUND_MODE,
} from './silkShaderMath.ts'

describe('SilkLoginBackground math & shader configuration', () => {
  it('converts hex colors to normalized 0-1 RGB floating tuples', () => {
    const black = hexToRgb('#000000')
    assert.deepEqual(black, [0, 0, 0])

    const white = hexToRgb('#ffffff')
    assert.deepEqual(white, [1, 1, 1])

    const red = hexToRgb('#ff0000')
    assert.deepEqual(red, [1, 0, 0])

    const shortHex = hexToRgb('#fff')
    assert.deepEqual(shortHex, [1, 1, 1])

    // Invalid hex fallback
    const invalid = hexToRgb('invalid')
    assert.deepEqual(invalid, [0, 0, 0])
  })

  it('caps backing canvas resolution at DPR 2 for performance', () => {
    assert.equal(backing(1000, 1), 1000)
    assert.equal(backing(1000, 1.5), 1500)
    assert.equal(backing(1000, 2), 2000)
    assert.equal(backing(1000, 3), 2000, 'DPR above 2 should be capped at 2')
    assert.equal(backing(1000, 4), 2000, 'DPR above 2 should be capped at 2')
    assert.equal(backing(0, 1), 1, 'Minimum backing dimension should be 1')
  })

  it('computes shader coordinates centered with y-axis up', () => {
    // Top-left: clientX=0, clientY=0, w=1000, h=1000
    const [tlX, tlY] = toShader(0, 0, 1000, 1000)
    assert.equal(tlX, -0.5)
    assert.equal(tlY, 0.5)

    // Center: clientX=500, clientY=500, w=1000, h=1000
    const [cX, cY] = toShader(500, 500, 1000, 1000)
    assert.equal(cX, 0)
    assert.equal(cY, 0)

    // Bottom-right: clientX=1000, clientY=1000, w=1000, h=1000
    const [brX, brY] = toShader(1000, 1000, 1000, 1000)
    assert.equal(brX, 0.5)
    assert.equal(brY, -0.5)

    // Zero dimensions
    assert.deepEqual(toShader(10, 10, 0, 0), [0, 0])
  })

  it('contains valid 4-step color palettes for all 4 SHINPO desktop themes', () => {
    const requiredThemes = ['aurora-dark', 'aurora-light', 'classic-dark', 'classic-light'] as const
    for (const theme of requiredThemes) {
      const palette = SILK_THEME_PALETTES[theme]
      assert.ok(palette, `Palette for ${theme} must exist`)
      assert.equal(palette.length, 4, `Palette for ${theme} must contain 4 colors`)
      for (const color of palette) {
        assert.match(color, /^#[0-9a-fA-F]{6}$/, `Color ${color} in ${theme} must be a valid 6-char hex`)
      }
    }
  })

  it('defaults desktop login background mode to silk-mesh with rollback switch ready', () => {
    assert.equal(DEFAULT_LOGIN_BACKGROUND_MODE, 'silk-mesh')
  })
})
