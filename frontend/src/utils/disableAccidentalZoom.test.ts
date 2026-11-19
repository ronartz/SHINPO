import test from 'node:test'
import assert from 'node:assert/strict'
import { disableAccidentalZoom } from './disableAccidentalZoom.ts'

test('disableAccidentalZoom binds event listeners and prevents default on zoom actions', async (t) => {
  type Listener = (e: {
    ctrlKey?: boolean
    metaKey?: boolean
    key?: string
    code?: string
    preventDefault?: () => void
    touches?: unknown[]
  }) => void
  const listeners: Record<string, Listener[]> = {}

  const mockWindow = {
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listeners[type] || []
      listeners[type].push(listener)
    },
    removeEventListener: () => {},
  }

  const originalWindow = globalThis.window
  // @ts-expect-error test mock
  globalThis.window = mockWindow

  t.after(() => {
    globalThis.window = originalWindow
  })

  disableAccidentalZoom()

  await t.test('prevents default on wheel events when ctrlKey or metaKey is true', () => {
    const wheelListeners = listeners['wheel'] || []
    assert.ok(wheelListeners.length > 0, 'wheel listener should be registered')

    let ctrlPrevented = false
    wheelListeners[0]({
      ctrlKey: true,
      metaKey: false,
      preventDefault: () => { ctrlPrevented = true },
    })
    assert.equal(ctrlPrevented, true, 'Ctrl+Wheel must preventDefault')

    let metaPrevented = false
    wheelListeners[0]({
      ctrlKey: false,
      metaKey: true,
      preventDefault: () => { metaPrevented = true },
    })
    assert.equal(metaPrevented, true, 'Meta+Wheel must preventDefault')

    let normalPrevented = false
    wheelListeners[0]({
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => { normalPrevented = true },
    })
    assert.equal(normalPrevented, false, 'normal Wheel must not preventDefault')
  })

  await t.test('prevents default on zoom keyboard shortcuts', () => {
    const keyListeners = listeners['keydown'] || []
    assert.ok(keyListeners.length > 0, 'keydown listener should be registered')

    const zoomKeys = ['+', '-', '=', '_', '0']
    for (const key of zoomKeys) {
      let prevented = false
      keyListeners[0]({
        ctrlKey: true,
        metaKey: false,
        key,
        preventDefault: () => { prevented = true },
      })
      assert.equal(prevented, true, `Ctrl+${key} must preventDefault`)
    }

    let nonZoomPrevented = false
    keyListeners[0]({
      ctrlKey: true,
      metaKey: false,
      key: 'a',
      preventDefault: () => { nonZoomPrevented = true },
    })
    assert.equal(nonZoomPrevented, false, 'Ctrl+A must not preventDefault')
  })

  await t.test('prevents trackpad gesturestart and gesturechange', () => {
    const gestureStartListeners = listeners['gesturestart'] || []
    assert.ok(gestureStartListeners.length > 0, 'gesturestart listener should be registered')

    let startPrevented = false
    gestureStartListeners[0]({
      preventDefault: () => { startPrevented = true },
    })
    assert.equal(startPrevented, true, 'gesturestart must preventDefault')

    const gestureChangeListeners = listeners['gesturechange'] || []
    assert.ok(gestureChangeListeners.length > 0, 'gesturechange listener should be registered')

    let changePrevented = false
    gestureChangeListeners[0]({
      preventDefault: () => { changePrevented = true },
    })
    assert.equal(changePrevented, true, 'gesturechange must preventDefault')
  })

  await t.test('prevents multi-touch pinch on touchstart', () => {
    const touchListeners = listeners['touchstart'] || []
    assert.ok(touchListeners.length > 0, 'touchstart listener should be registered')

    let pinchPrevented = false
    touchListeners[0]({
      touches: [{}, {}],
      preventDefault: () => { pinchPrevented = true },
    })
    assert.equal(pinchPrevented, true, 'pinch touchstart must preventDefault')

    let singleTouchPrevented = false
    touchListeners[0]({
      touches: [{ accounts: 1 }],
      preventDefault: () => { singleTouchPrevented = true },
    })
    assert.equal(singleTouchPrevented, false, 'single touchstart must not preventDefault')
  })
})
