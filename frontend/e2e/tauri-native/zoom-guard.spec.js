import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

describe('SHINPO native page zoom guard', function () {
  it('keeps the WebView at 100% after browser zoom shortcuts', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })
    await $('#auth-identifier').waitForDisplayed({ timeout: 120000 })
    await $('#auth-identifier').click()

    const baseline = await browser.execute(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      viewportScale: window.visualViewport?.scale ?? 1,
    }))

    const pressZoomShortcut = async (key) => {
      await browser.performActions([{
        type: 'key',
        id: 'zoom-shortcut',
        actions: [
          { type: 'keyDown', value: '\uE009' },
          { type: 'keyDown', value: key },
          { type: 'keyUp', value: key },
          { type: 'keyUp', value: '\uE009' },
        ],
      }])
      await browser.releaseActions()
      await browser.pause(200)
    }

    await pressZoomShortcut('+')
    await pressZoomShortcut('-')
    await pressZoomShortcut('0')

    await browser.performActions([
      {
        type: 'key',
        id: 'control-modifier',
        actions: [
          { type: 'keyDown', value: '\uE009' },
          { type: 'pause', duration: 120 },
          { type: 'keyUp', value: '\uE009' },
        ],
      },
      {
        type: 'wheel',
        id: 'control-wheel',
        actions: [
          { type: 'pause', duration: 60 },
          { type: 'scroll', x: 700, y: 450, deltaX: 0, deltaY: -240, duration: 120 },
          { type: 'pause', duration: 60 },
        ],
      },
    ])
    await browser.releaseActions()
    await browser.pause(200)

    const after = await browser.execute(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      viewportScale: window.visualViewport?.scale ?? 1,
    }))
    await browser.saveScreenshot(path.join(evidence, 'zoom-guard-native.png'))

    assert.deepEqual(after, baseline, `WebView scale changed after zoom shortcuts: ${JSON.stringify({ baseline, after })}`)
  })
})
