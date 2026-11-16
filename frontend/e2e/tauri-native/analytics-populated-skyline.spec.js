import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const DAY_SECONDS = 86_400

async function setQaDateOffset(daysFromHostDate) {
  await browser.execute(async (offsetSeconds) => {
    const invoke = window.__TAURI_INTERNALS__?.invoke
    if (typeof invoke !== 'function') throw new Error('Native Tauri invoke bridge unavailable for disposable QA clock')
    await invoke('qa_set_clock_offset', { offsetSeconds })
  }, daysFromHostDate * DAY_SECONDS)
}

async function getCompletedNativeSessions() {
  return browser.execute(async () => {
    const invoke = window.__TAURI_INTERNALS__?.invoke
    if (typeof invoke !== 'function') throw new Error('Native Tauri invoke bridge unavailable for persistence inspection')
    return (await invoke('local_get_focus_sessions')).filter((session) => session.status === 'COMPLETED')
      .map(({ name, startedAt, endedAt, activeSeconds, status }) => ({ name, startedAt, endedAt, activeSeconds, status }))
  })
}

function localDateOffset(daysFromHostDate) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromHostDate)
  return date.toLocaleDateString()
}

function focusDurationLabel(seconds) {
  if (seconds <= 0) return '0m'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 600 && seconds % 60 !== 0) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

async function finishRealFocusSession(name, activeSeconds) {
  await $('[data-tab="Focus Engine"]').click()
  const workspace = await $('.focus-workspace-container')
  await workspace.waitForDisplayed({ timeout: 30000 })
  await $('button.preset-chip*=Custom').click()
  const duration = await $('.custom-duration-card input[type="number"]')
  // Keep enough planned time to finish the real 30-second contribution manually
  // even if native startup/summary transitions are slow on the CI workstation.
  await duration.setValue('5')
  assert.ok((await $('[data-tutorial="start-timer-btn"]').getText()).includes('Start 5m'))
  await $('[data-tutorial="start-timer-btn"]').click()
  await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })
  await browser.pause(activeSeconds * 1000)
  await $('.microkit-finish-glow').click()

  const summary = await $('[aria-labelledby="session-summary-title"]')
  await summary.waitForDisplayed({ timeout: 15000 })
  await summary.$('input[placeholder*="outcome was achieved"], input[required]').setValue(`${name} completed through the native Focus workflow`)
  const reflection = await summary.$('textarea')
  const reflectionNote = `${name}: native disposable Analytics reflection.`
  if (await reflection.isExisting()) await reflection.setValue(reflectionNote)
  const submit = await summary.$('button[type="submit"]')
  await submit.click()
  await browser.waitUntil(async () => !(await summary.isDisplayed().catch(() => false)), { timeout: 20000 })
  const celebrate = await $('.celebration-btn.primary')
  if (await celebrate.isDisplayed().catch(() => false)) await celebrate.click()
  await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'ready', { timeout: 20000 })
}

async function setAppearance(brand, theme) {
  await $('[aria-label^="Account menu for"]').click()
  await $('button*=All settings').click()
  await $('[role="dialog"][aria-labelledby="settings-dialog-title"]').waitForDisplayed()
  await $('[data-section="appearance"]').click()
  const current = await browser.execute(() => ({ brand: document.documentElement.dataset.brand, theme: document.documentElement.dataset.theme }))
  if (current.brand !== brand) await $(`button*=${brand === 'classic' ? 'Classic' : 'Aurora'}`).click()
  await browser.waitUntil(async () => await browser.execute((expected) => document.documentElement.dataset.brand === expected, brand), { timeout: 15000 })
  const currentTheme = await browser.execute(() => document.documentElement.dataset.theme)
  if (currentTheme !== theme) await $(`button*=${theme === 'light' ? 'Light Theme' : 'Dark Theme'}`).click()
  await browser.waitUntil(async () => await browser.execute((expected) => document.documentElement.dataset.theme === expected, theme), { timeout: 15000 })
  await browser.keys('Escape')
  await browser.waitUntil(async () => !(await $('[role="dialog"][aria-labelledby="settings-dialog-title"]').isDisplayed().catch(() => false)), { timeout: 10000 })
}

describe('SHINPO native populated Analytics and Focus skyline', function () {
  it('plots real completed Focus sessions across dates and verifies 2D/3D interactions', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE, 'must use the isolated native QA profile')
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    const windows = await browser.getWindowHandles()
    if (windows.length) await browser.switchToWindow(windows[0])
    await browser.waitUntil(async () => await browser.execute(() => document.readyState === 'complete'), { timeout: 30000 })
    const startupView = await browser.execute(() => ({ title: document.title, text: document.body?.innerText?.slice(0, 1200), href: location.href }))
    console.log(`Disposable native app startup view: ${JSON.stringify(startupView)}`)
    assert.ok(startupView.text, 'the native WebView must render its initial view')
    await $('h1').waitForDisplayed({ timeout: 15000 })
    // Shift only this disposable QA process group. Session durations still elapse in real time.
    await setQaDateOffset(-4)
    const username = `qa_skyline_${Date.now()}`
    await $('button*=Create Workspace').click()
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Skyline-QA-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    await finishRealFocusSession('QA Skyline 30-second session', 30)
    const firstRecords = await getCompletedNativeSessions()
    assert.equal(firstRecords.length, 1, `the first completed session must be persisted by the native command: ${JSON.stringify(firstRecords)}`)
    const firstRecord = firstRecords[0]
    assert.ok(firstRecord.activeSeconds >= 30, `the first session must retain its real 30-second active duration: ${JSON.stringify(firstRecord)}`)
    assert.equal(new Date(firstRecord.startedAt).toLocaleDateString(), localDateOffset(-4), `QA clock must shift persisted native Focus timestamps by four days: ${JSON.stringify(firstRecord)}`)
    await setQaDateOffset(-2)
    await finishRealFocusSession('QA Skyline second day', 7)
    const secondRecords = await getCompletedNativeSessions()
    assert.equal(secondRecords.length, 2, `the second completed session must be persisted: ${JSON.stringify(secondRecords)}`)
    const secondRecord = secondRecords[1]
    assert.equal(new Date(secondRecord.startedAt).toLocaleDateString(), localDateOffset(-2), `QA clock must shift the second native Focus date: ${JSON.stringify(secondRecord)}`)
    await setQaDateOffset(0)
    await finishRealFocusSession('QA Skyline current day', 7)

    const nav = await $('[data-tab="Analytics"]')
    await nav.click()
    await browser.waitUntil(async () => await nav.getAttribute('aria-current') === 'page', { timeout: 30000 })
    await $('.analytics-view').waitForDisplayed({ timeout: 30000 })
    const canvas = await $('.focus-skyline-stage canvas')
    await canvas.waitForDisplayed({ timeout: 30000 })
    await browser.pause(1500)
    for (const toast of await $$('.shinpo-toast-dismiss')) {
      if (await toast.isDisplayed()) await toast.click()
    }

    const populated = await browser.execute(() => {
      const stats = [...document.querySelectorAll('.focus-skyline-stats > div')].map((item) => item.innerText.trim())
      const canvas = document.querySelector('.focus-skyline-stage canvas')
      const activityPanel = document.querySelector('.analytics-activity-panel')
      const activity = activityPanel?.querySelector('.analytics-activity-chart')
      const focusedDays = document.querySelector('.analytics-focused-days')
      const reflections = document.querySelector('.analytics-recent-panel')
      const reflectionCards = [...document.querySelectorAll('.analytics-debrief-card')]
      const focusedDayRows = [...document.querySelectorAll('.analytics-focused-days-list li')]
      return {
        title: document.querySelector('.focus-skyline-heading')?.innerText,
        stats,
        canvas: { width: canvas.width, height: canvas.height, view: canvas.dataset.view, rect: (() => { const r = canvas.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height } })() },
        activeBarBounds: (() => {
          const context = canvas.getContext('2d', { willReadFrequently: true })
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
          const sample = document.createElement('canvas')
          sample.width = sample.height = 1
          const sampleContext = sample.getContext('2d')
          sampleContext.fillStyle = getComputedStyle(document.querySelector('.focus-skyline-stage')).getPropertyValue('--analytics-chart-bar').trim()
          sampleContext.fillRect(0, 0, 1, 1)
          const [red, green, blue] = sampleContext.getImageData(0, 0, 1, 1).data
          let left = canvas.width, top = canvas.height, right = -1, bottom = -1, count = 0
          for (let index = 0; index < pixels.data.length; index += 4) {
            const pixel = index / 4
            const x = pixel % canvas.width
            const y = Math.floor(pixel / canvas.width)
            if (Math.abs(pixels.data[index] - red) <= 1 && Math.abs(pixels.data[index + 1] - green) <= 1 && Math.abs(pixels.data[index + 2] - blue) <= 1 && pixels.data[index + 3] > 200) {
              left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); count++
            }
          }
          return count ? { left, right, top, bottom, count, width: right - left + 1, height: bottom - top + 1 } : null
        })(),
        activity: {
          accessibleLabel: activity?.getAttribute('aria-label'),
          rect: (() => { const r=activity?.getBoundingClientRect(); return r ? {height:r.height,width:r.width} : null })(),
          panelRect: (() => { const r=activityPanel?.getBoundingClientRect(); return r ? {height:r.height,width:r.width} : null })(),
        },
        reflections: {
          text: reflections?.innerText,
          height: reflections?.getBoundingClientRect().height ?? 0,
          rows: reflectionCards.length,
          dates: reflectionCards.map((card) => card.querySelector('.analytics-debrief-date')?.textContent.trim()),
          titles: reflectionCards.map((card) => card.querySelector('.analytics-debrief-title')?.textContent.trim()),
        },
        focusedDays: {
          text: focusedDays?.innerText,
          height: focusedDays?.getBoundingClientRect().height ?? 0,
          rows: focusedDayRows.length,
          dates: focusedDayRows.map((row) => row.querySelector('.analytics-focused-date')?.textContent.trim()),
        },
        metrics: [...document.querySelectorAll('.analytics-metrics-grid article')].map((item) => item.innerText.trim()),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    })
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-aurora-3d-1400x900.png'))
    const nativeSessions = await getCompletedNativeSessions()
    assert.equal(nativeSessions.length, 3, `three completed records must be present in the encrypted vault: ${JSON.stringify(nativeSessions)}`)
    const persistedSeconds = nativeSessions.reduce((sum, session) => sum + session.activeSeconds, 0)
    const persistedDurationLabel = focusDurationLabel(persistedSeconds)
    assert.ok(populated.title.includes('3 completed sessions'), JSON.stringify(populated))
    assert.match(populated.stats[0], /Completed sessions[^\n]*\n3\nverified records/i, JSON.stringify(populated))
    assert.match(populated.stats[1], /Busiest Focus day\n1 session/i, JSON.stringify(populated))
    assert.match(populated.stats[2], /Longest streak\n1 day/i, JSON.stringify(populated))
    assert.match(populated.stats[3], /Current streak\n1 day/i, JSON.stringify(populated))
    assert.ok(populated.canvas.view === '3d' && populated.activeBarBounds?.count > 100, `sparse 3D contributions must paint visible bars: ${JSON.stringify(populated.activeBarBounds)}`)
    assert.ok(populated.activeBarBounds.width >= 30 && populated.activeBarBounds.height >= 30, `sparse 3D bars must remain readable: ${JSON.stringify(populated.activeBarBounds)}`)
    const barCenter = (populated.activeBarBounds.left + populated.activeBarBounds.right) / 2 / populated.canvas.width
    assert.ok(barCenter > 0.3 && barCenter < 0.7, `sparse 3D bars should be framed near the visual center: ${JSON.stringify({ barCenter, bounds: populated.activeBarBounds, canvas: populated.canvas })}`)
    assert.ok(populated.activity.accessibleLabel?.endsWith(`Current total ${persistedDurationLabel}.`), `Focus Activity chart should report the exact sum of persisted active seconds (${persistedDurationLabel}): ${JSON.stringify(populated)}`)
    assert.ok(populated.metrics[0].includes(`\n${persistedDurationLabel}\n`), `Analytics summary must match persisted active seconds: ${JSON.stringify({ metric: populated.metrics[0], persistedSeconds })}`)
    assert.ok(populated.activity.rect?.width > 500 && populated.activity.rect?.height > 140, `Focus Activity chart should use its card space: ${JSON.stringify(populated.activity)}`)
    assert.ok(populated.activity.panelRect?.height >= populated.activity.rect.height, JSON.stringify(populated.activity))
    assert.equal(populated.reflections.rows, 3, JSON.stringify(populated))
    assert.equal(new Set(populated.reflections.dates).size, 3, `completed reflections should span three local dates: ${JSON.stringify(populated)}`)
    const firstElapsedLabel = `${nativeSessions.find((session) => session.startedAt === firstRecord.startedAt).activeSeconds}s`
    assert.ok(populated.reflections.text.includes(firstElapsedLabel), 'the first reflection should show its actual persisted active duration')
    assert.equal(new Set(nativeSessions.map((session) => new Date(session.endedAt).toLocaleDateString())).size, 3, `native persisted completion timestamps must span three local calendar dates: ${JSON.stringify(nativeSessions)}`)
    assert.ok(nativeSessions.some((session) => session.activeSeconds >= 30), JSON.stringify(nativeSessions))
    for (const detail of await $$('.analytics-reflection-details')) await detail.$('summary').click()
    const reflectionDetails = (await $('.analytics-recent-panel').getText())
    assert.ok(reflectionDetails.includes('native disposable Analytics reflection'), reflectionDetails)
    assert.equal(populated.focusedDays.rows, 3, JSON.stringify(populated))
    assert.equal(new Set(populated.focusedDays.dates).size, 3, `focused-day aggregation should have three distinct dates: ${JSON.stringify(populated)}`)
    assert.ok(populated.activity.rect.height > 0 && populated.focusedDays.height > 0 && populated.reflections.height > 0, JSON.stringify(populated))
    assert.equal(populated.overflow, false, JSON.stringify(populated))
    console.log(`Native persisted Analytics summary: ${JSON.stringify(populated)}`)

    await $('button[aria-label="Flat heat map"]').click()
    await browser.pause(1500)
    assert.equal(await canvas.getAttribute('data-view'), '2d')
    const heatmapPixels = await browser.execute(() => {
      const canvas = document.querySelector('.focus-skyline-stage canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      const stage = document.querySelector('.focus-skyline-stage')
      const accentCanvas = document.createElement('canvas')
      const accentContext = accentCanvas.getContext('2d')
      accentContext.fillStyle = getComputedStyle(stage).getPropertyValue('--analytics-chart-bar').trim()
      accentContext.fillRect(0, 0, 1, 1)
      const [r, g, b] = accentContext.getImageData(0, 0, 1, 1).data
      let accentPixels = 0
      for (let index = 0; index < data.length; index += 4) {
        if (Math.abs(data[index] - r) <= 1 && Math.abs(data[index + 1] - g) <= 1 && Math.abs(data[index + 2] - b) <= 1 && data[index + 3] > 200) accentPixels++
      }
      return { width: canvas.width, height: canvas.height, accentPixels }
    })
    assert.ok(heatmapPixels.accentPixels > 100, `2D heatmap should visibly paint persisted contribution cells: ${JSON.stringify(heatmapPixels)}`)
    console.log(`Native 2D contribution pixels: ${JSON.stringify(heatmapPixels)}`)
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-aurora-2d-1400x900.png'))

    const hoverPoint = await browser.execute(() => {
      const stage = document.querySelector('.focus-skyline-stage')
      const canvas = stage.querySelector('canvas')
      const rect = canvas.getBoundingClientRect()
      const today = new Date()
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const start = new Date(end)
      start.setDate(start.getDate() - 364)
      start.setDate(start.getDate() - start.getDay())
      const offset = Math.floor((end - start) / 86400000)
      const week = Math.floor(offset / 7)
      const weekday = offset % 7
      const cellCount = Math.ceil((end - start) / 86400000) + 1
      const weeks = Math.ceil(cellCount / 7)
      const width = rect.width
      const height = rect.height
      const widthForGrid = Math.max(0, width - 54)
      const widthLimitedCell = (widthForGrid - (weeks - 1) * 2) / Math.max(1, weeks)
      const cellSize = Math.max(1, Math.min(
        18,
        widthLimitedCell < 2 / 0.18 ? widthLimitedCell : widthForGrid / Math.max(1, weeks + (weeks - 1) * 0.18),
        (height - 48) / 8,
      ))
      const gap = Math.max(2, cellSize * 0.18)
      const gridWidth = weeks * (cellSize + gap) - gap
      const gridHeight = 7 * (cellSize + gap) - gap
      return { x: rect.left + (width - gridWidth) / 2 + week * (cellSize + gap) + cellSize / 2, y: rect.top + (height - gridHeight) / 2 + weekday * (cellSize + gap) + cellSize / 2 }
    })
    await browser.performActions([{ type: 'pointer', id: 'hover', parameters: { pointerType: 'mouse' }, actions: [{ type: 'pointerMove', x: Math.round(hoverPoint.x), y: Math.round(hoverPoint.y) }] }])
    await browser.waitUntil(async () => (await $('.focus-skyline-tooltip').getText().catch(() => '')).includes('1 completed session'), { timeout: 5000 })
    const hovered = (await $('.focus-skyline-tooltip').getText()).trim()
    assert.ok(hovered.includes('focused'), hovered)
    console.log(`Skyline hover inspection: ${hovered}`)

    await $('button[aria-label="3D skyline"]').click()
    await browser.pause(1500)
    const beforeOrbit = await browser.execute(() => document.querySelector('.focus-skyline-stage canvas').toDataURL())
    const location = await canvas.getLocation()
    const size = await canvas.getSize()
    const rect = { x: location.x, y: location.y, width: size.width, height: size.height }
    await browser.performActions([{ type: 'pointer', id: 'orbit', parameters: { pointerType: 'mouse' }, actions: [
      { type: 'pointerMove', x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) },
      { type: 'pointerDown', button: 0 },
      { type: 'pointerMove', x: Math.round(rect.x + rect.width / 2 + 90), y: Math.round(rect.y + rect.height / 2) },
      { type: 'pointerUp', button: 0 },
    ] }])
    await browser.pause(150)
    const afterOrbit = await browser.execute(() => document.querySelector('.focus-skyline-stage canvas').toDataURL())
    assert.notEqual(afterOrbit, beforeOrbit, 'dragging should change the 3D camera projection')
    await canvas.doubleClick()
    await browser.pause(150)
    const afterReset = await browser.execute(() => document.querySelector('.focus-skyline-stage canvas').toDataURL())
    assert.equal(afterReset, beforeOrbit, 'double-click should restore the default camera framing')

    await canvas.click()
    await browser.keys(['End'])
    await browser.waitUntil(async () => (await $('.focus-skyline-tooltip').getText().catch(() => '')).includes('1 completed session'), { timeout: 5000 })
    const keyboardTooltip = (await $('.focus-skyline-tooltip').getText()).trim()
    assert.ok(keyboardTooltip.includes('focused'), keyboardTooltip)
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-aurora-3d-inspected.png'))
    await browser.performActions([])

    await browser.setWindowSize(1280, 720)
    await browser.pause(250)
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-aurora-1280x720.png'))

    await setAppearance('classic', 'dark')
    await browser.setWindowSize(1400, 900)
    await browser.pause(500)
    assert.equal(await browser.execute(() => document.documentElement.dataset.brand), 'classic')
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-classic-dark-1400x900.png'))
    await setAppearance('classic', 'light')
    await browser.pause(500)
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-classic-light-1400x900.png'))
    await setAppearance('aurora', 'light')
    await browser.pause(500)
    await browser.saveScreenshot(path.join(evidence, 'analytics-populated-aurora-light-1400x900.png'))
    const lightLayout = await browser.execute(() => ({
      brand: document.documentElement.dataset.brand,
      theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      canvas: (() => { const rect = document.querySelector('.focus-skyline-stage canvas')?.getBoundingClientRect(); return rect && { width: rect.width, height: rect.height } })(),
      records: [...document.querySelectorAll('.analytics-metrics-grid article')].map((item) => item.innerText.trim()),
    }))
    assert.equal(lightLayout.brand, 'aurora')
    assert.equal(lightLayout.theme, 'light')
    assert.equal(lightLayout.overflow, false, `populated Analytics light theme must not overflow: ${JSON.stringify(lightLayout)}`)
    assert.ok(lightLayout.canvas?.width > 500 && lightLayout.canvas?.height > 100, `populated light-theme skyline remains legible: ${JSON.stringify(lightLayout)}`)
    assert.equal(lightLayout.records.length, 4, `all persisted Analytics summary metrics remain visible in light mode: ${JSON.stringify(lightLayout)}`)
    console.log(`Native populated Analytics Aurora Light: ${JSON.stringify(lightLayout)}`)

    console.log(`Native populated Analytics acceptance passed; disposable QA wall-clock offsets: -4d, -2d, 0d. First session elapsed for ${30}s; additional sessions ${7}s each. Sessions were started, completed, reflected, and persisted through the Tauri UI. Account: ${username}`)
  })
})
