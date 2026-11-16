import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Focus Classic Light composition', function () {
  it('renders the Focus workspace in Classic Light at standard and wide desktop sizes', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE, 'must use the disposable native QA profile')
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const username = `qa_classic_light_${Date.now()}`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Classic-Light-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    await $('[aria-label^="Account menu for"]').click()
    await $('button*=All settings').click()
    await $('[role="dialog"][aria-labelledby="settings-dialog-title"]').waitForDisplayed()
    await $('[data-section="appearance"]').click()
    await $('button*=Classic').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.dataset.brand === 'classic'), { timeout: 15000 })
    await $('button*=Light Theme').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.dataset.theme === 'light'), { timeout: 15000 })
    await browser.keys('Escape')
    await browser.waitUntil(async () => !(await $('[role="dialog"][aria-labelledby="settings-dialog-title"]').isDisplayed().catch(() => false)), { timeout: 10000 })
    await browser.pause(300)

    await $('[data-tab="Focus Engine"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Focus Engine"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    for (const [width, height] of [[1280, 720], [2560, 1440]]) {
      await browser.setWindowSize(width, height)
      await browser.pause(350)
      const actual = await browser.getWindowSize()
      const layout = await browser.execute(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector)
          if (!element) return null
          const box = element.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }
        }
        return {
          brand: document.documentElement.dataset.brand,
          theme: document.documentElement.dataset.theme,
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          timer: rect('.card-timer-hud'),
          configuration: rect('.focus-configuration-panel, .focus-config-panel, .pomodoro-config'),
          start: rect('[data-tutorial="start-timer-btn"]'),
          headingContrast: [...document.querySelectorAll('.focus-workspace-container .card-title')].map((element) => {
            const parse = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
            const luminance = (value) => {
              const [r, g, b] = parse(value).map((channel) => {
                const normalized = channel / 255
                return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
              })
              return 0.2126 * r + 0.7152 * g + 0.0722 * b
            }
            const foreground = getComputedStyle(element).color
            const background = getComputedStyle(element.closest('.bento-card')).backgroundColor
            const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
            return { text: element.textContent.trim(), foreground, background, ratio: (lighter + 0.05) / (darker + 0.05) }
          }),
        }
      })
      assert.equal(layout.brand, 'classic', JSON.stringify(layout))
      assert.equal(layout.theme, 'light', JSON.stringify(layout))
      assert.equal(layout.overflow, false, `Classic Light Focus should not overflow at ${width}: ${JSON.stringify(layout)}`)
      assert.ok(layout.timer?.width > 0 && layout.configuration?.width > 0 && layout.start?.height > 0, JSON.stringify(layout))
      assert.ok(layout.headingContrast.length >= 2, JSON.stringify(layout.headingContrast))
      assert.ok(layout.headingContrast.every((heading) => heading.ratio >= 4.5), JSON.stringify(layout.headingContrast))
      await browser.saveScreenshot(path.join(evidence, `focus-classic-light-${actual.width}x${actual.height}-native.png`))
      console.log(`Native Classic Light Focus ${actual.width}x${actual.height}: ${JSON.stringify(layout)}`)
    }
  })
})
