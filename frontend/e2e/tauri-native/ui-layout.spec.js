import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

async function dismissVisibleToasts() {
  for (const toast of await $$('.shinpo-toast-dismiss')) {
    if (await toast.isDisplayed()) await toast.click()
  }
}

async function particleFrame() {
  return browser.execute(() => {
    const canvas = document.querySelector('[data-testid="shinpo-particles"]')
    if (!canvas) return null
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let checksum = 0
    for (let index = 0; index < pixels.length; index += 256) checksum = (checksum + pixels[index] * (index + 1)) >>> 0
    return { count: document.querySelectorAll('[data-testid="shinpo-particles"]').length, checksum }
  })
}

async function setAppearance(brand, theme) {
  console.log(`Setting appearance to ${brand} ${theme}: open account menu`)
  await $('[aria-label^="Account menu for"]').click()
  console.log(`Setting appearance to ${brand} ${theme}: open settings`)
  await $('button*=All settings').click()
  const settings = await $('[role="dialog"][aria-labelledby="settings-dialog-title"]')
  await settings.waitForDisplayed()
  await browser.pause(250)
  console.log(`Setting appearance to ${brand} ${theme}: open appearance section`)
  await $('[data-section="appearance"]').click()
  await browser.pause(250)
  const current = await browser.execute(() => ({ brand: document.documentElement.dataset.brand, theme: document.documentElement.dataset.theme }))
  if (current.brand !== brand) {
    const brandButton = await $(`button*=${brand === 'classic' ? 'Classic' : 'Aurora'}`)
    await brandButton.scrollIntoView()
    console.log(`Setting appearance to ${brand} ${theme}: click brand; button text=${JSON.stringify(await brandButton.getText())}`)
    await brandButton.click()
  }
  await browser.waitUntil(async () => await browser.execute((expected) => document.documentElement.dataset.brand === expected, brand), { timeout: 10000 })
  await browser.pause(300)
  const currentTheme = await browser.execute(() => document.documentElement.dataset.theme)
  if (currentTheme !== theme) {
    const themeButton = await $(`button*=${theme === 'light' ? 'Light Theme' : 'Dark Theme'}`)
    await themeButton.scrollIntoView()
    console.log(`Setting appearance to ${brand} ${theme}: click theme; button text=${JSON.stringify(await themeButton.getText())}`)
    await themeButton.click()
  }
  await browser.waitUntil(async () => await browser.execute((expected) => document.documentElement.dataset.theme === expected, theme), { timeout: 10000 })
  await browser.pause(300)
  console.log(`Setting appearance to ${brand} ${theme}: close settings`)
  await browser.keys('Escape')
  await browser.waitUntil(async () => !(await $('[role="dialog"][aria-labelledby="settings-dialog-title"]').isDisplayed().catch(() => false)), { timeout: 10000 })
}

describe('SHINPO native Focus and Goals layout acceptance', function () {
  it('renders, resizes and operates Focus and Goals in the current Tauri build', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_PARTICLES_EVIDENCE_DIR || process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })
    const sizes = [[960, 600], [1400, 900], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]]

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const windowHandles = await browser.getWindowHandles()
    if (windowHandles.length) await browser.switchToWindow(windowHandles[0])
    await browser.saveScreenshot(path.join(evidence, 'auth-native.png'))
    const username = `qa_layout_${Date.now()}`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Layout-QA-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await browser.pause(1500)
    const registration = await browser.execute(() => ({
      recoveryKeyVisible: Boolean(document.querySelector('#recovery-key-display')),
      workspaceVisible: Boolean(document.querySelector('[data-tab="Dashboard"]')),
      error: document.querySelector('[role="alert"]')?.textContent?.trim() || null,
    }))
    console.log(`Local registration result: ${JSON.stringify(registration)}`)
    if (!registration.recoveryKeyVisible) {
      assert.ok(registration.workspaceVisible, `Registration did not reach recovery or workspace: ${registration.error || 'no visible result'}`)
      throw new Error('Native registration entered the workspace without showing the required one-time recovery key')
    }
    await $('#recovery-key-display').waitForDisplayed({ timeout: 15000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    const dismiss = await $('[aria-label="Dismiss welcome"]')
    try { await dismiss.waitForDisplayed({ timeout: 3000 }); await dismiss.click() } catch {}
    const skipTutorial = await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip')
    try { await skipTutorial.waitForDisplayed({ timeout: 3000 }); await skipTutorial.click() } catch {}

    const sidebar = await $('aside[aria-label="Main navigation"]')
    assert.ok(await sidebar.isDisplayed())
    assert.equal(await sidebar.$$('input').then((inputs) => inputs.length), 0, 'sidebar remains free of local search')
    assert.ok(await $('[aria-label="Global search"]').isDisplayed(), 'global topbar search remains available')

    await $('[data-tab="Focus Engine"]').click()
    const focus = await $('.focus-workspace-container')
    await focus.waitForDisplayed({ timeout: 30000 })
    for (const [width, height] of sizes) {
      await browser.setWindowSize(width, height)
      await browser.pause(350)
      const actual = await browser.getWindowSize()
      await browser.saveScreenshot(path.join(evidence, `focus-${actual.width}x${actual.height}-native.png`))
      const layout = await browser.execute(() => {
        const workspace = document.querySelector('.focus-workspace-container')
        const timer = document.querySelector('.card-timer-hud')
        const config = document.querySelector('.focus-configuration-panel, .focus-config-panel, .pomodoro-config')
        const rect = (node) => node && ({ x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, bottom: node.getBoundingClientRect().bottom })
        const start = timer.querySelector('.btn-timer.primary')
        return { overflow: workspace.scrollWidth > workspace.clientWidth, timer: rect(timer), config: rect(config), start: rect(start), viewport: { width: innerWidth, height: innerHeight } }
      })
      assert.equal(layout.overflow, false, `Focus horizontal overflow at ${width}x${height}`)
      assert.ok(layout.timer?.width > 0, 'Focus timer card is rendered')
      assert.ok(layout.config?.width > 0, 'Focus configuration is rendered')
      if (actual.width <= 1024 && actual.height <= 700) {
        assert.ok(layout.start.bottom <= actual.height, `Focus start action is clipped below the compact window: ${JSON.stringify(layout)}`)
      }
      console.log(`Focus native ${actual.width}x${actual.height}: timer=${JSON.stringify(layout.timer)} config=${JSON.stringify(layout.config)}`)
    }

    const start = await $('[data-tutorial="start-timer-btn"]')
    await start.waitForDisplayed()
    assert.equal((await particleFrame())?.count, 1, 'authenticated app has exactly one particle canvas')
    const modeOptions = await $$('.study-mode-option')
    const modeLabels = []
    for (const option of modeOptions) modeLabels.push(await option.getText())
    for (const mode of ['Light', 'Standard', 'Strict']) assert.ok(modeLabels.some((label) => label.includes(mode)), `${mode} Guardian mode visible`)
    let selectedMode = 0
    for (let index = 0; index < modeOptions.length; index++) {
      if (await modeOptions[index].getAttribute('aria-pressed') === 'true') selectedMode = index
    }
    for (const option of modeOptions) {
      await option.click()
      assert.equal(await option.getAttribute('aria-pressed'), 'true', 'Guardian mode selection responds')
    }
    await modeOptions[selectedMode].click()
    const consent = await $('.guardian-consent-group')
    if (await consent.isExisting()) {
      assert.ok(await consent.isDisplayed(), 'Guardian consent controls are visible')
      const observerConsent = await consent.$('input[type="checkbox"]')
      assert.equal(await observerConsent.isSelected(), false, 'Guardian observation defaults to off')
      await observerConsent.click()
      assert.equal(await observerConsent.isSelected(), true, 'Guardian observation consent toggles on')
      await observerConsent.click()
      assert.equal(await observerConsent.isSelected(), false, 'Guardian observation consent can be revoked before Focus starts')
    }

    await browser.setWindowSize(1280, 720)
    const breakToggle = await $('label*=Include one midpoint break')
    assert.ok(await breakToggle.isDisplayed(), 'midpoint-break option is visible in session configuration')
    await breakToggle.click()
    const breakConfiguration = await browser.execute(() => {
      const panel = document.querySelector('.pomodoro-config')
      const preview = document.querySelector('.timer-plan-preview')
      const fields = [...panel.querySelectorAll('.pomodoro-config-fields label')].map((label) => {
        const rect = label.getBoundingClientRect()
        return { text: label.textContent.trim(), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
      })
      const penaltyLabel = [...panel.querySelectorAll('.pomodoro-config-fields label.pomodoro-toggle')]
        .find((label) => label.textContent.includes('progress adjustment'))
      const penaltyCheckbox = penaltyLabel?.querySelector('input[type="checkbox"]')
      const textNode = penaltyLabel && [...penaltyLabel.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
      const textRange = document.createRange()
      if (textNode) textRange.selectNode(textNode)
      const checkboxRect = penaltyCheckbox?.getBoundingClientRect()
      const textRect = textRange.getBoundingClientRect()
      const configuration = panel.getBoundingClientRect()
      return {
        preview: preview?.textContent?.replace(/\s+/g, ' ').trim(),
        fields,
        penalty: checkboxRect && { checkboxWidth: checkboxRect.width, checkboxRight: checkboxRect.right, textX: textRect.x, label: penaltyLabel.textContent.trim() },
        panel: { x: configuration.x, y: configuration.y, right: configuration.right, bottom: configuration.bottom, width: configuration.width, height: configuration.height },
        viewport: { width: innerWidth, height: innerHeight },
      }
    })
    assert.match(breakConfiguration.preview || '', /midpoint break/i, `break plan preview must explain the configured cycle: ${JSON.stringify(breakConfiguration)}`)
    assert.ok(breakConfiguration.fields.length >= 2, 'break and grace controls are rendered')
    assert.ok(breakConfiguration.fields.every((field) => field.width >= 120 && field.height > 0), `break controls remain usable at compact desktop size: ${JSON.stringify(breakConfiguration)}`)
    assert.ok(breakConfiguration.penalty.checkboxWidth <= 20, `late-return checkbox must retain a compact checkbox hit area: ${JSON.stringify(breakConfiguration.penalty)}`)
    assert.ok(breakConfiguration.penalty.textX >= breakConfiguration.penalty.checkboxRight, `late-return label text must follow, not collide with, its checkbox: ${JSON.stringify(breakConfiguration.penalty)}`)
    const timingFields = breakConfiguration.fields.filter((field) => /Long break|Grace/.test(field.text))
    if (timingFields.length === 2 && Math.abs(timingFields[0].y - timingFields[1].y) < 2) {
      assert.ok(timingFields[0].right <= timingFields[1].x || timingFields[1].right <= timingFields[0].x, `break and grace fields must not overlap: ${JSON.stringify(breakConfiguration)}`)
    }
    await browser.execute(() => document.querySelector('.pomodoro-config').scrollIntoView({ block: 'center' }))
    await browser.saveScreenshot(path.join(evidence, 'focus-midpoint-break-configuration-native.png'))
    console.log(`Native Focus break configuration: ${JSON.stringify(breakConfiguration)}`)
    await breakToggle.click()

    await start.click()
    await browser.waitUntil(async () => await focus.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })
    const activeFrame = await particleFrame()
    await browser.pause(800)
    assert.notEqual((await particleFrame())?.checksum, activeFrame?.checksum, 'particles continue animating during ACTIVE Focus')
    await browser.saveScreenshot(path.join(evidence, 'focus-active-native.png'))
    await $('button*=Pause Session').click()
    await browser.waitUntil(async () => await focus.getAttribute('data-focus-mode') === 'paused', { timeout: 30000 })
    const pausedFrame = await particleFrame()
    await browser.pause(800)
    assert.notEqual((await particleFrame())?.checksum, pausedFrame?.checksum, 'particles continue animating during PAUSED Focus')
    await $('button*=Resume Session').click()
    await browser.waitUntil(async () => await focus.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })
    await $('button*=Cancel Session').click()
    await browser.waitUntil(async () => await focus.getAttribute('data-focus-mode') === 'ready', { timeout: 30000 })

    await setAppearance('aurora', 'light')
    await $('[data-tab="Focus Engine"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Focus Engine"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    await browser.setWindowSize(1280, 720)
    await dismissVisibleToasts()
    const themedFocus = await browser.execute(() => {
      const timer = document.querySelector('.card-timer-hud').getBoundingClientRect()
      const config = document.querySelector('.focus-configuration-panel, .focus-config-panel, .pomodoro-config').getBoundingClientRect()
      const start = document.querySelector('[data-tutorial="start-timer-btn"]').getBoundingClientRect()
      return {
        brand: document.documentElement.dataset.brand,
        theme: document.documentElement.dataset.theme,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        timer: { width: timer.width, height: timer.height },
        config: { width: config.width, height: config.height },
        start: { width: start.width, height: start.height, bottom: start.bottom },
      }
    })
    assert.equal(themedFocus.brand, 'aurora')
    assert.equal(themedFocus.theme, 'light')
    assert.equal(themedFocus.overflow, false, `Aurora Light Focus should not overflow: ${JSON.stringify(themedFocus)}`)
    assert.ok(themedFocus.timer.width > 0 && themedFocus.config.width > 0 && themedFocus.start.height > 0, JSON.stringify(themedFocus))
    await browser.saveScreenshot(path.join(evidence, 'focus-aurora-light-1280x720-native.png'))
    console.log(`Native Focus Aurora Light: ${JSON.stringify(themedFocus)}`)

    await $('[data-tab="Goals & Missions"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Goals & Missions"]').getAttribute('aria-current') === 'page', { timeout: 30000 })
    await dismissVisibleToasts()
    for (const [width, height] of sizes) {
      await browser.setWindowSize(width, height)
      await browser.pause(350)
      const actual = await browser.getWindowSize()
      const geometry = await browser.execute(() => {
        const filters = document.querySelector('.tasks-status-tabs')?.getBoundingClientRect()
        const controls = document.querySelector('.tasks-controls-right')?.getBoundingClientRect()
        const search = document.querySelector('.tasks-search-box')?.getBoundingClientRect()
        const sidebar = document.querySelector('aside[aria-label="Main navigation"]')
        const main = document.querySelector('.main-content') || document.querySelector('main')
        return { filters: filters && { x: filters.x, y: filters.y, right: filters.right, bottom: filters.bottom }, controls: controls && { x: controls.x, y: controls.y, top: controls.top }, search: search && { width: search.width, x: search.x, right: search.right }, viewport: { width: innerWidth, height: innerHeight }, bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, sidebarInputs: sidebar?.querySelectorAll('input').length ?? 0 }
      })
      assert.equal(geometry.bodyOverflow, false, `Goals document overflow at ${width}x${height}`)
      assert.equal(geometry.sidebarInputs, 0, 'Sidebar search remains removed')
      assert.ok(geometry.search?.width >= 180, `Goals search is too narrow at ${width}: ${geometry.search?.width}`)
      if (geometry.filters && width <= 1320) assert.ok(geometry.controls.y >= geometry.filters.bottom - 1, `Goals filters and toolbar overlap at ${width}`)
      if (geometry.filters && width > 1320) assert.ok(geometry.controls.x >= geometry.filters.right - 1, `Goals filters and toolbar overlap horizontally at ${width}`)
      await browser.saveScreenshot(path.join(evidence, `goals-${actual.width}x${actual.height}-native.png`))
      console.log(`Goals native ${actual.width}x${actual.height}: ${JSON.stringify(geometry)}`)
    }

    const createGoal = await $('button*=Create First Goal')
    if (await createGoal.isDisplayed()) await createGoal.click()
    else await $('[data-tutorial="new-goal"]').click()
    const goalDialog = await $('[role="dialog"][aria-labelledby="create-goal-dialog-title"]')
    await goalDialog.waitForDisplayed()
    const goalTitle = `Native layout goal ${Date.now()}`
    await $('#create-goal-name-input').setValue(goalTitle)
    await goalDialog.$('button[type="submit"]').click()
    await $('.goal-single-summary-card').waitForDisplayed({ timeout: 60000 })
    assert.ok((await $('.goal-single-summary-card').getText()).includes(goalTitle))
    await $('[data-tutorial="new-task"]').click()
    const taskDialog = await $('[role="dialog"][aria-labelledby="create-task-title"]')
    await taskDialog.waitForDisplayed()
    const taskTitle = `Native layout task ${Date.now()}`
    await $('#create-task-title-input').setValue(taskTitle)
    await taskDialog.$('button[type="submit"]').click()
    await browser.waitUntil(async () => (await $('.missions-list-container').getText()).includes(taskTitle), { timeout: 60000 })
    await dismissVisibleToasts()
    await browser.saveScreenshot(path.join(evidence, 'goals-task-created-native.png'))
    console.log('Native Goal and Task creation persisted and appeared in the live task list')
  })
})
