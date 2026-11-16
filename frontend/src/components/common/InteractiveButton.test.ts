import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateEdgeProximity,
  calculateButtonInteractionMetrics,
  THEME_ENERGY_CONFIGS,
  DESTRUCTIVE_ENERGY_CONFIG,
} from '../../utils/interactiveButtonPhysics.ts'
import { initInteractiveButtonEngine } from '../../utils/interactiveButtonListener.ts'

describe('Universal Interactive Button System', () => {
  describe('Edge Proximity Calculation', () => {
    it('returns 0 when pointer is at the exact center (normX = 0.5)', () => {
      const proximity = calculateEdgeProximity(0.5)
      assert.strictEqual(proximity, 0)
    })

    it('returns 1 when pointer is at the far left edge (normX = 0.0)', () => {
      const proximity = calculateEdgeProximity(0)
      assert.strictEqual(proximity, 1)
    })

    it('returns 1 when pointer is at the far right edge (normX = 1.0)', () => {
      const proximity = calculateEdgeProximity(1)
      assert.strictEqual(proximity, 1)
    })

    it('is symmetric around the center (0.25 and 0.75 have identical proximity)', () => {
      const leftQuarter = calculateEdgeProximity(0.25)
      const rightQuarter = calculateEdgeProximity(0.75)
      assert.strictEqual(leftQuarter.toFixed(4), rightQuarter.toFixed(4))
      // 0.5^1.6 is approx 0.3298
      assert.strictEqual(leftQuarter > 0.3 && leftQuarter < 0.35, true)
    })

    it('clamps values below 0 and above 1 safely', () => {
      assert.strictEqual(calculateEdgeProximity(-0.5), 1)
      assert.strictEqual(calculateEdgeProximity(1.5), 1)
    })

    it('accelerates near edges due to 1.6 power exponent', () => {
      const p1 = calculateEdgeProximity(0.4) // distance 0.2
      const p2 = calculateEdgeProximity(0.1) // distance 0.8
      const p3 = calculateEdgeProximity(0.2) // distance 0.6
      const deltaCenter = p1 - calculateEdgeProximity(0.5)
      const deltaEdge = p2 - p3
      assert.strictEqual(deltaEdge > deltaCenter, true)
    })
  })

  describe('Interaction Metrics Calculation', () => {
    it('correctly maps client coordinates to local and normalized metrics', () => {
      const rect = { left: 100, top: 50, width: 200, height: 40 }
      // Pointer at left edge
      const leftMetrics = calculateButtonInteractionMetrics(100, 70, rect)
      assert.strictEqual(leftMetrics.mouseX, 0)
      assert.strictEqual(leftMetrics.mouseY, 20)
      assert.strictEqual(leftMetrics.normX, 0)
      assert.strictEqual(leftMetrics.edgeProximity, 1)
      assert.strictEqual(leftMetrics.edgePercent, 12)

      // Pointer at right edge
      const rightMetrics = calculateButtonInteractionMetrics(300, 70, rect)
      assert.strictEqual(rightMetrics.mouseX, 200)
      assert.strictEqual(rightMetrics.normX, 1)
      assert.strictEqual(rightMetrics.edgeProximity, 1)
      assert.strictEqual(rightMetrics.edgePercent, 88)

      // Pointer at center
      const centerMetrics = calculateButtonInteractionMetrics(200, 70, rect)
      assert.strictEqual(centerMetrics.mouseX, 100)
      assert.strictEqual(centerMetrics.normX, 0.5)
      assert.strictEqual(centerMetrics.edgeProximity, 0)
    })

    it('handles zero or negative dimensions safely', () => {
      const safe = calculateButtonInteractionMetrics(50, 50, { left: 0, top: 0, width: 0, height: 0 })
      assert.strictEqual(safe.normX, 0.5)
      assert.strictEqual(safe.edgeProximity, 0)
    })
  })

  describe('Theme Token Resolution & Variant Mappings', () => {
    it('provides valid token mappings across all 4 themes', () => {
      for (const [theme, tokens] of Object.entries(THEME_ENERGY_CONFIGS)) {
        assert.ok(tokens.primary.startsWith('#'), `${theme} must have valid hex primary`)
        assert.ok(tokens.secondary.startsWith('#'), `${theme} must have valid hex secondary`)
        assert.ok(tokens.onPrimary.startsWith('#'), `${theme} must have valid hex text`)
        assert.ok(tokens.auraOpacity > 0 && tokens.auraOpacity <= 1, `${theme} opacity must be in (0, 1]`)
      }
    })

    it('Classic Dark resolves electric lime #AFF33E with dark text #020617', () => {
      const classicDark = THEME_ENERGY_CONFIGS['classic-dark']
      assert.strictEqual(classicDark.primary, '#AFF33E')
      assert.strictEqual(classicDark.onPrimary, '#020617')
    })

    it('Classic Light resolves green #4D7C0F with soft opacity', () => {
      const classicLight = THEME_ENERGY_CONFIGS['classic-light']
      assert.strictEqual(classicLight.primary, '#4D7C0F')
      assert.strictEqual(classicLight.auraOpacity, 0.32)
    })

    it('Aurora Dark resolves violet #9757FA and cyan #1BC9DE', () => {
      const auroraDark = THEME_ENERGY_CONFIGS['aurora-dark']
      assert.strictEqual(auroraDark.primary, '#9757FA')
      assert.strictEqual(auroraDark.secondary, '#1BC9DE')
    })

    it('Aurora Light resolves violet #7C3AED and sky blue #0284C7', () => {
      const auroraLight = THEME_ENERGY_CONFIGS['aurora-light']
      assert.strictEqual(auroraLight.primary, '#7C3AED')
      assert.strictEqual(auroraLight.secondary, '#0284C7')
    })

    it('destructive variant preserves danger semantic color instead of primary theme color', () => {
      assert.strictEqual(DESTRUCTIVE_ENERGY_CONFIG.primary, '#F87171')
      assert.strictEqual(DESTRUCTIVE_ENERGY_CONFIG.secondary, '#DC2626')
      assert.notStrictEqual(DESTRUCTIVE_ENERGY_CONFIG.primary as string, '#AFF33E')
      assert.notStrictEqual(DESTRUCTIVE_ENERGY_CONFIG.primary as string, '#9757FA')
    })
  })

  describe('Global Interactive Engine Lifecycle', () => {
    it('initializes safely in non-browser environments without errors', () => {
      const cleanup = initInteractiveButtonEngine()
      assert.strictEqual(typeof cleanup, 'function')
      cleanup()
    })
  })
})
