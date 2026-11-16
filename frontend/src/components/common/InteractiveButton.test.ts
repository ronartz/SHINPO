import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  calculateEdgeProximity,
  calculateButtonInteractionMetrics,
  THEME_ENERGY_CONFIGS,
  DESTRUCTIVE_ENERGY_CONFIG,
} from '../../utils/interactiveButtonPhysics.ts'
import { initInteractiveButtonEngine } from '../../utils/interactiveButtonListener.ts'

// Minimal DOM mock for isolated node:test execution
class MockElement {
  tagName: string
  attributes: Record<string, string> = {}
  classList = {
    _classes: new Set<string>(),
    add: (...names: string[]) => names.forEach((n) => this.classList._classes.add(n)),
    remove: (...names: string[]) => names.forEach((n) => this.classList._classes.delete(n)),
    contains: (n: string) => this.classList._classes.has(n),
  }
  style = {
    _props: new Map<string, string>(),
    setProperty: (k: string, v: string) => this.style._props.set(k, v),
    getPropertyValue: (k: string) => this.style._props.get(k) || '',
  }
  parent: MockElement | null = null
  children: MockElement[] = []
  disabled = false
  offsetWidth = 100

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase()
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value
  }

  hasAttribute(name: string) {
    return name in this.attributes
  }

  removeAttribute(name: string) {
    delete this.attributes[name]
  }

  getBoundingClientRect() {
    return { left: 100, top: 50, width: 200, height: 40, right: 300, bottom: 90 }
  }

  contains(el: MockElement | null): boolean {
    if (!el) return false
    if (el === this) return true
    return this.contains(el.parent)
  }

  closest(selector: string): MockElement | null {
    if (this.matches(selector)) return this
    return this.parent ? this.parent.closest(selector) : null
  }

  matches(selector: string): boolean {
    const parts = selector.split(',').map((s) => s.trim())
    for (const part of parts) {
      if (part === 'button' && this.tagName === 'BUTTON') return true
      if (part === '[data-interactive-btn]' && this.hasAttribute('data-interactive-btn')) return true
      if (part === '[role="button"]' && this.getAttribute('role') === 'button') return true
    }
    return false
  }

  appendChild(child: MockElement) {
    child.parent = this
    this.children.push(child)
  }
}

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

  describe('Interaction Metrics & Smooth Continuous Interpolation', () => {
    it('correctly maps client coordinates to local and normalized metrics', () => {
      const rect = { left: 100, top: 50, width: 200, height: 40 }
      // Pointer at left edge
      const leftMetrics = calculateButtonInteractionMetrics(100, 70, rect)
      assert.strictEqual(leftMetrics.mouseX, 0)
      assert.strictEqual(leftMetrics.mouseY, 20)
      assert.strictEqual(leftMetrics.normX, 0)
      assert.strictEqual(leftMetrics.normY, 0.5)
      assert.strictEqual(leftMetrics.edgeProximity, 1)
      assert.strictEqual(leftMetrics.edgePercent, 12)

      // Pointer at right edge
      const rightMetrics = calculateButtonInteractionMetrics(300, 70, rect)
      assert.strictEqual(rightMetrics.mouseX, 200)
      assert.strictEqual(rightMetrics.normX, 1)
      assert.strictEqual(rightMetrics.normY, 0.5)
      assert.strictEqual(rightMetrics.edgeProximity, 1)
      assert.strictEqual(rightMetrics.edgePercent, 88)

      // Pointer at center
      const centerMetrics = calculateButtonInteractionMetrics(200, 70, rect)
      assert.strictEqual(centerMetrics.mouseX, 100)
      assert.strictEqual(centerMetrics.normX, 0.5)
      assert.strictEqual(centerMetrics.normY, 0.5)
      assert.strictEqual(centerMetrics.edgeProximity, 0)
      assert.strictEqual(centerMetrics.edgePercent, 50)
    })

    it('calculates continuous edge percent linearly without discontinuous 12/88 jump', () => {
      const rect = { left: 0, top: 0, width: 100, height: 40 }
      const at0 = calculateButtonInteractionMetrics(0, 20, rect)
      const at25 = calculateButtonInteractionMetrics(25, 20, rect)
      const at50 = calculateButtonInteractionMetrics(50, 20, rect)
      const at75 = calculateButtonInteractionMetrics(75, 20, rect)
      const at100 = calculateButtonInteractionMetrics(100, 20, rect)

      assert.strictEqual(at0.edgePercent, 12)
      assert.strictEqual(at25.edgePercent, 31)
      assert.strictEqual(at50.edgePercent, 50)
      assert.strictEqual(at75.edgePercent, 69)
      assert.strictEqual(at100.edgePercent, 88)
    })

    it('handles zero or negative dimensions safely without division by zero', () => {
      const safe = calculateButtonInteractionMetrics(50, 50, { left: 0, top: 0, width: 0, height: 0 })
      assert.strictEqual(safe.normX, 0.5)
      assert.strictEqual(safe.normY, 0.5)
      assert.strictEqual(safe.edgeProximity, 0)
      assert.strictEqual(safe.edgePercent, 50)
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

  describe('Global Delegation, DOM Events & Lifecycle', () => {
    type TestEventListener = (evt: unknown) => void
    let originalWindow: unknown
    let originalDocument: unknown
    let mockListeners: Map<string, TestEventListener[]>
    let cleanup: (() => void) | null = null

    beforeEach(() => {
      mockListeners = new Map()
      originalWindow = (globalThis as unknown as { window?: unknown }).window
      originalDocument = (globalThis as unknown as { document?: unknown }).document

      const mockDoc = {
        addEventListener: (type: string, handler: TestEventListener) => {
          if (!mockListeners.has(type)) mockListeners.set(type, [])
          mockListeners.get(type)!.push(handler)
        },
        removeEventListener: (type: string, handler: TestEventListener) => {
          const arr = mockListeners.get(type)
          if (arr) {
            const idx = arr.indexOf(handler)
            if (idx >= 0) arr.splice(idx, 1)
          }
        },
      }

      ;(globalThis as unknown as { window: unknown }).window = {}
      ;(globalThis as unknown as { document: unknown }).document = mockDoc
    })

    afterEach(() => {
      if (cleanup) {
        cleanup()
        cleanup = null
      }
      ;(globalThis as unknown as { window: unknown }).window = originalWindow
      ;(globalThis as unknown as { document: unknown }).document = originalDocument
    })

    it('initializes safely in non-browser environments without errors', () => {
      ;(globalThis as unknown as { window: unknown }).window = undefined
      ;(globalThis as unknown as { document: unknown }).document = undefined
      const nonBrowserCleanup = initInteractiveButtonEngine()
      assert.strictEqual(typeof nonBrowserCleanup, 'function')
      nonBrowserCleanup()
    })

    it('attaches all required pointer and keyboard listeners in browser mode', () => {
      cleanup = initInteractiveButtonEngine()
      assert.ok(mockListeners.has('pointerover'))
      assert.ok(mockListeners.has('pointermove'))
      assert.ok(mockListeners.has('pointerdown'))
      assert.ok(mockListeners.has('pointerup'))
      assert.ok(mockListeners.has('pointerout'))
      assert.ok(mockListeners.has('keydown'))
      assert.ok(mockListeners.has('keyup'))
    })

    it('is idempotent: calling init repeatedly returns existing cleanup without duplicate bindings', () => {
      cleanup = initInteractiveButtonEngine()
      const initialOverCount = mockListeners.get('pointerover')?.length || 0
      assert.strictEqual(initialOverCount, 1)

      const secondCleanup = initInteractiveButtonEngine()
      assert.strictEqual(secondCleanup, cleanup)
      assert.strictEqual(mockListeners.get('pointerover')?.length, 1)
    })

    it('pointermove calculates and sets CSS variables on target button', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const moveHandler = mockListeners.get('pointermove')![0]

      // Pointer over middle of button (rect: left: 100, top: 50, width: 200, height: 40)
      moveHandler({
        target: btn,
        clientX: 200,
        clientY: 70,
      })

      assert.strictEqual(btn.getAttribute('data-interactive-btn'), 'true')
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '1')
      assert.strictEqual(btn.style.getPropertyValue('--btn-x'), '100px')
      assert.strictEqual(btn.style.getPropertyValue('--btn-y'), '20px')
      assert.strictEqual(btn.style.getPropertyValue('--btn-norm-x'), '0.500')
      assert.strictEqual(btn.style.getPropertyValue('--btn-edge-side'), '50%')
    })

    it('pointerover immediately activates metrics without waiting for pointermove', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const overHandler = mockListeners.get('pointerover')![0]

      overHandler({
        target: btn,
        clientX: 100, // Left edge
        clientY: 50,
      })

      assert.strictEqual(btn.getAttribute('data-interactive-btn'), 'true')
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '1')
      assert.strictEqual(btn.style.getPropertyValue('--btn-norm-x'), '0.000')
      assert.strictEqual(btn.style.getPropertyValue('--btn-edge-side'), '12%')
    })

    it('handles nested button children via event delegation (closest button lookup)', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const iconSpan = new MockElement('span')
      const svgIcon = new MockElement('svg')
      btn.appendChild(iconSpan)
      iconSpan.appendChild(svgIcon)

      const moveHandler = mockListeners.get('pointermove')![0]
      // Pointer event target is deep child svg
      moveHandler({
        target: svgIcon,
        clientX: 250,
        clientY: 70,
      })

      assert.strictEqual(btn.getAttribute('data-interactive-btn'), 'true')
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '1')
      assert.strictEqual(btn.style.getPropertyValue('--btn-norm-x'), '0.750')
    })

    it('dynamically added buttons receive interactions seamlessly', () => {
      cleanup = initInteractiveButtonEngine()
      // Simulate button created long after initInteractiveButtonEngine ran
      const dynamicBtn = new MockElement('button')
      const moveHandler = mockListeners.get('pointermove')![0]

      moveHandler({
        target: dynamicBtn,
        clientX: 300,
        clientY: 70,
      })

      assert.strictEqual(dynamicBtn.getAttribute('data-interactive-btn'), 'true')
      assert.strictEqual(dynamicBtn.style.getPropertyValue('--btn-hover'), '1')
      assert.strictEqual(dynamicBtn.style.getPropertyValue('--btn-norm-x'), '1.000')
      assert.strictEqual(dynamicBtn.style.getPropertyValue('--btn-edge-side'), '88%')
    })

    it('pointerout resets hover and press state when moving outside button', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const moveHandler = mockListeners.get('pointermove')![0]
      const outHandler = mockListeners.get('pointerout')![0]

      moveHandler({ target: btn, clientX: 200, clientY: 70 })
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '1')

      const outsideElement = new MockElement('div')
      outHandler({
        target: btn,
        relatedTarget: outsideElement,
      })

      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '0')
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '0')
      assert.strictEqual(btn.classList.contains('is-pressed'), false)
    })

    it('pointerdown and pointerup manage tactile press state and ripple activation', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const downHandler = mockListeners.get('pointerdown')![0]
      const upHandler = mockListeners.get('pointerup')![0]

      // Primary click (button 0)
      downHandler({ target: btn, button: 0 })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '1')
      assert.strictEqual(btn.classList.contains('is-pressed'), true)

      // Pointer up releases press and triggers activation
      upHandler({ target: btn })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '0')
      assert.strictEqual(btn.classList.contains('is-pressed'), false)
      assert.strictEqual(btn.classList.contains('is-activating'), true)
    })

    it('keyboard Enter and Space trigger press and activation pulse', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      const keyDownHandler = mockListeners.get('keydown')![0]
      const keyUpHandler = mockListeners.get('keyup')![0]

      // Press Enter
      keyDownHandler({ target: btn, key: 'Enter' })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '1')
      assert.strictEqual(btn.classList.contains('is-pressed'), true)

      keyUpHandler({ target: btn, key: 'Enter' })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '0')
      assert.strictEqual(btn.classList.contains('is-pressed'), false)
      assert.strictEqual(btn.classList.contains('is-activating'), true)

      // Press Space
      keyDownHandler({ target: btn, key: ' ' })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '1')
      keyUpHandler({ target: btn, key: ' ' })
      assert.strictEqual(btn.style.getPropertyValue('--btn-pressed'), '0')
    })

    it('ignores disabled buttons', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      btn.disabled = true
      const moveHandler = mockListeners.get('pointermove')![0]

      moveHandler({ target: btn, clientX: 200, clientY: 70 })
      assert.strictEqual(btn.hasAttribute('data-interactive-btn'), false)
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '')
    })

    it('ignores aria-disabled buttons', () => {
      cleanup = initInteractiveButtonEngine()
      const btn = new MockElement('button')
      btn.setAttribute('aria-disabled', 'true')
      const moveHandler = mockListeners.get('pointermove')![0]

      moveHandler({ target: btn, clientX: 200, clientY: 70 })
      assert.strictEqual(btn.hasAttribute('data-interactive-btn'), false)
      assert.strictEqual(btn.style.getPropertyValue('--btn-hover'), '')
    })

    it('ignores loading buttons (is-loading class and data-loading attribute)', () => {
      cleanup = initInteractiveButtonEngine()
      const btnLoadingClass = new MockElement('button')
      btnLoadingClass.classList.add('is-loading')
      const btnLoadingAttr = new MockElement('button')
      btnLoadingAttr.setAttribute('data-loading', 'true')

      const moveHandler = mockListeners.get('pointermove')![0]

      moveHandler({ target: btnLoadingClass, clientX: 200, clientY: 70 })
      assert.strictEqual(btnLoadingClass.hasAttribute('data-interactive-btn'), false)

      moveHandler({ target: btnLoadingAttr, clientX: 200, clientY: 70 })
      assert.strictEqual(btnLoadingAttr.hasAttribute('data-interactive-btn'), false)
    })

    it('ignores excluded roles and explicitly excluded buttons', () => {
      cleanup = initInteractiveButtonEngine()
      const moveHandler = mockListeners.get('pointermove')![0]

      const switchBtn = new MockElement('div')
      switchBtn.setAttribute('role', 'switch')
      moveHandler({ target: switchBtn, clientX: 200, clientY: 70 })
      assert.strictEqual(switchBtn.hasAttribute('data-interactive-btn'), false)

      const excludedBtn = new MockElement('button')
      excludedBtn.setAttribute('data-no-interactive', 'true')
      moveHandler({ target: excludedBtn, clientX: 200, clientY: 70 })
      assert.strictEqual(excludedBtn.hasAttribute('data-interactive-btn'), false)

      const excludedClassBtn = new MockElement('button')
      excludedClassBtn.classList.add('no-interactive')
      moveHandler({ target: excludedClassBtn, clientX: 200, clientY: 70 })
      assert.strictEqual(excludedClassBtn.hasAttribute('data-interactive-btn'), false)
    })

    it('cleanup unbinds all registered DOM event listeners completely', () => {
      cleanup = initInteractiveButtonEngine()
      assert.strictEqual(mockListeners.get('pointermove')?.length, 1)

      cleanup()
      cleanup = null

      assert.strictEqual(mockListeners.get('pointermove')?.length, 0)
      assert.strictEqual(mockListeners.get('pointerover')?.length, 0)
      assert.strictEqual(mockListeners.get('pointerdown')?.length, 0)
      assert.strictEqual(mockListeners.get('pointerup')?.length, 0)
      assert.strictEqual(mockListeners.get('pointerout')?.length, 0)
      assert.strictEqual(mockListeners.get('keydown')?.length, 0)
      assert.strictEqual(mockListeners.get('keyup')?.length, 0)
    })
  })

  describe('CSS Architecture & Reduced Motion Verification', () => {
    it('verifies interactive-button.css contains strict reduced-motion overrides', () => {
      const cssPath = path.resolve(import.meta.dirname, '../../styles/components/interactive-button.css')
      const css = fs.readFileSync(cssPath, 'utf8')

      assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'))
      assert.ok(css.includes('transition: none !important'))
      assert.ok(css.includes('animation: none !important'))
      assert.ok(css.includes('transform: none !important'))
    })

    it('verifies desktop.css imports interactive-button.css at the very bottom for correct cascade precedence', () => {
      const desktopCssPath = path.resolve(import.meta.dirname, '../../apps/desktop/styles/desktop.css')
      const desktopCss = fs.readFileSync(desktopCssPath, 'utf8')

      const importIndex = desktopCss.indexOf('interactive-button.css')
      const microkitIndex = desktopCss.indexOf('microkit-motion.css')

      assert.ok(importIndex > -1, 'desktop.css must import interactive-button.css')
      assert.ok(microkitIndex > -1, 'desktop.css must import microkit-motion.css')
      assert.ok(
        importIndex > microkitIndex,
        'interactive-button.css must be imported after microkit-motion.css to guarantee cascade override'
      )
    })
  })
})
