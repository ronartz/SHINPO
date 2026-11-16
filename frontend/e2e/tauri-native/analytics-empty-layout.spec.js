import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Analytics empty-state layout', function () {
  it('renders real zero-history analytics without clipping or fabricated activity', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const windows = await browser.getWindowHandles()
    if (windows.length) await browser.switchToWindow(windows[0])

    const username = `qa_analytics_${Date.now()}`
    const createWorkspace = await $('button*=Create Workspace')
    if (await createWorkspace.isExisting() && await createWorkspace.getAttribute('aria-pressed') !== 'true') {
      await createWorkspace.click()
    }
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Analytics-QA-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    const nav = await $('[data-tab="Analytics"]')
    await nav.click()
    await browser.waitUntil(async () => await nav.getAttribute('aria-current') === 'page', { timeout: 30000 })
    await $('.analytics-view').waitForDisplayed({ timeout: 30000 })
    await $('.focus-skyline-stage canvas').waitForDisplayed({ timeout: 30000 })
    await browser.waitUntil(async () => await browser.execute(() => {
      const stage = document.querySelector('.focus-skyline-stage')
      return stage && stage.getBoundingClientRect().width > 100 && stage.getBoundingClientRect().height > 100
    }), { timeout: 10000 })

    for (const [width, height, suffix] of [[1400, 900, '1400x900'], [1280, 720, '1280x720']]) {
      await browser.setWindowSize(width, height)
      await browser.pause(350)
      const geometry = await browser.execute(() => {
        const rect = (selector) => {
          const element = document.querySelector(selector)
          if (!element) return null
          const bounds = element.getBoundingClientRect()
          return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom }
        }
        const root = document.querySelector('.analytics-view')
        const skyline = document.querySelector('.focus-contribution-skyline')
        const canvas = document.querySelector('.focus-skyline-stage canvas')
        const activity = document.querySelector('.analytics-activity-panel')
        const chart = document.querySelector('.analytics-activity-chart')
        const reflections = document.querySelector('.analytics-recent-panel')
        const metricValues = [...document.querySelectorAll('.analytics-metrics-grid article strong')].map((item) => item.textContent.trim())
        const skylineStats = [...document.querySelectorAll('.focus-skyline-stats > div strong')].map((item) => item.textContent.trim())
        return {
          viewport: { width: innerWidth, height: innerHeight },
          root: rect('.analytics-view'), skyline: rect('.focus-contribution-skyline'),
          stage: rect('.focus-skyline-stage'), canvas: rect('.focus-skyline-stage canvas'),
          activity: rect('.analytics-activity-panel'), chart: rect('.analytics-activity-chart'),
          reflections: rect('.analytics-recent-panel'), reflectionEmpty: rect('.analytics-debrief-empty'),
          documentHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          canvasPixels: { width: canvas.width, height: canvas.height },
          emptyCopy: skyline?.textContent.includes('No completed Focus sessions in this period yet.') ?? false,
          activityEmpty: activity?.querySelector('.analytics-activity-zero-overlay')?.textContent.trim() ?? null,
          metricValues, skylineStats,
        }
      })

      assert.equal(geometry.documentHorizontalOverflow, false, JSON.stringify(geometry))
      assert.ok(geometry.skyline && geometry.stage && geometry.canvas && geometry.activity && geometry.chart && geometry.reflections)
      assert.ok(geometry.stage.width > 0 && geometry.stage.height > 0)
      assert.ok(geometry.canvasPixels.width > 0 && geometry.canvasPixels.height > 0)
      assert.ok(geometry.metricValues.every((value) => value !== '—'), `Analytics metrics did not finish loading: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.metricValues.includes('0'), `Disposable account should have zero activity: ${JSON.stringify(geometry)}`)
      assert.equal(geometry.emptyCopy, true, 'Skyline should state that the real account has no completed sessions')
      assert.deepEqual(geometry.skylineStats, ['0', '0 sessions', '0 days', '0 days'])
      assert.ok(geometry.reflectionEmpty, 'Empty reflection state should be present')

      await browser.saveScreenshot(path.join(evidence, `analytics-empty-native-${suffix}.png`))
      console.log(`Native Analytics empty ${suffix}: ${JSON.stringify(geometry)}`)
    }

    await browser.setWindowSize(1400, 900)
    await browser.execute(() => document.querySelector('.analytics-activity-panel')?.scrollIntoView({ block: 'start' }))
    await browser.pause(250)
    const activityComposition = await browser.execute(() => {
      const activity = document.querySelector('.analytics-activity-panel').getBoundingClientRect()
      const chart = document.querySelector('.analytics-activity-chart').getBoundingClientRect()
      const zero = document.querySelector('.analytics-activity-zero-overlay')?.getBoundingClientRect()
      const reflections = document.querySelector('.analytics-recent-panel').getBoundingClientRect()
      return {
        activity: { y: activity.y, height: activity.height, bottom: activity.bottom },
        chart: { y: chart.y, height: chart.height, bottom: chart.bottom },
        zeroOverlay: zero ? { y: zero.y, height: zero.height } : null,
        reflections: { y: reflections.y, height: reflections.height },
        scrollTop: document.querySelector('.app-content-stage')?.scrollTop ?? window.scrollY,
      }
    })
    assert.ok(activityComposition.chart.height > 0)
    assert.ok(activityComposition.activity.height > activityComposition.chart.height)
    await browser.saveScreenshot(path.join(evidence, 'analytics-empty-native-activity-and-insights.png'))
    console.log(`Native Analytics activity/insights composition: ${JSON.stringify(activityComposition)}`)
  })
})
