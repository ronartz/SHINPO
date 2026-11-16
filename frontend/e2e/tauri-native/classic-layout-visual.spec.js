import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

async function dismissVisibleToasts() {
  for (const toast of await $$('.shinpo-toast-dismiss')) {
    if (await toast.isDisplayed()) await toast.click()
  }
}

describe('SHINPO native Classic dashboard and Goals visual check', function () {
  it('switches the disposable workspace to Classic and captures both core views', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const windows = await browser.getWindowHandles()
    if (windows.length) await browser.switchToWindow(windows[0])
    const username = `qa_classic_${Date.now()}`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Classic-QA-${randomUUID()}-Safe!`)
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
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.dataset.brand === 'classic'), { timeout: 10000 })
    await $('[aria-label="Close Settings"]').click()

    const capture = async (tab, selector, file) => {
      const navigation = await $(`[data-tab="${tab}"]`)
      await navigation.click()
      await browser.waitUntil(async () => await navigation.getAttribute('aria-current') === 'page', { timeout: 30000 })
      await $(selector).waitForDisplayed({ timeout: 30000 })
      for (const [width, height] of [[1400, 900], [1280, 720]]) {
        await browser.setWindowSize(width, height)
        // The dashboard has a short staggered entrance; capture its settled composition.
        await browser.pause(650)
        const result = await browser.execute((rootSelector) => {
        const root = document.querySelector(rootSelector)
        const bounds = root.getBoundingClientRect()
        const style = getComputedStyle(document.documentElement)
        const primary = style.getPropertyValue('--color-primary').trim()
        const primaryButton = [...root.querySelectorAll('button')].find((button) => {
          const buttonStyle = getComputedStyle(button)
          return buttonStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && buttonStyle.backgroundColor !== 'transparent'
        })
        return {
          brand: document.documentElement.dataset.brand,
          theme: document.documentElement.dataset.theme,
          primary,
          root: { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
          buttonBackground: primaryButton ? getComputedStyle(primaryButton).backgroundColor : null,
          documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          heading: root.querySelector('h1, h2')?.textContent?.trim() || null,
          sections: rootSelector === '.shinpo-dashboard'
            ? [...root.querySelectorAll(':scope > section')].map((section) => ({ className: section.className, opacity: Number(getComputedStyle(section).opacity), display: getComputedStyle(section).display, height: section.getBoundingClientRect().height }))
            : [],
        }
        }, selector)
        assert.equal(result.brand, 'classic', `${tab} should render in Classic identity`)
        assert.equal(result.documentOverflow, false, `${tab} should not overflow the desktop window: ${JSON.stringify(result)}`)
        assert.ok(result.root.width > 0 && result.root.height > 0)
        assert.ok(result.primary, 'Classic primary semantic token is present')
        for (const section of result.sections) {
          assert.notEqual(section.display, 'none', `Dashboard section should participate in layout: ${section.className}`)
          assert.ok(section.opacity >= 0.99 && section.height > 0, `Dashboard section should be visible after entry motion: ${JSON.stringify(section)}`)
        }
        const screenshot = file.replace('.png', `-${width}x${height}.png`)
        await browser.saveScreenshot(path.join(evidence, screenshot))
        console.log(`Native Classic ${tab} ${width}x${height}: ${JSON.stringify(result)}`)
      }
    }

    await capture('Dashboard', '.shinpo-dashboard', 'dashboard-classic-native.png')
    await capture('Goals & Missions', '.goals-view-deck', 'goals-classic-native.png')

    await $('button*=Create First Goal').click()
    const goalDialog = await $('[role="dialog"][aria-labelledby="create-goal-dialog-title"]')
    await goalDialog.waitForDisplayed()
    const goalTitle = `Classic populated goal ${Date.now()}`
    await $('#create-goal-name-input').setValue(goalTitle)
    await goalDialog.$('button[type="submit"]').click()
    await $('.goal-single-summary-card').waitForDisplayed({ timeout: 30000 })
    await $('[data-tutorial="new-task"]').click()
    const taskDialog = await $('[role="dialog"][aria-labelledby="create-task-title"]')
    await taskDialog.waitForDisplayed()
    const taskTitle = `Classic populated task ${Date.now()}`
    await $('#create-task-title-input').setValue(taskTitle)
    await taskDialog.$('button[type="submit"]').click()
    await browser.waitUntil(async () => (await $('.missions-list-container').getText()).includes(taskTitle), { timeout: 30000 })
    await dismissVisibleToasts()
    const populatedGoals = await browser.execute(() => ({
      brand: document.documentElement.dataset.brand,
      theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      root: (() => { const rect = document.querySelector('.goals-view-deck').getBoundingClientRect(); return { width: rect.width, height: rect.height, right: rect.right } })(),
      taskText: document.querySelector('.missions-list-container').innerText,
    }))
    assert.equal(populatedGoals.brand, 'classic')
    assert.equal(populatedGoals.overflow, false, JSON.stringify(populatedGoals))
    assert.ok(populatedGoals.taskText.includes(taskTitle), `real task is visible in populated Classic Goals: ${JSON.stringify(populatedGoals)}`)
    await browser.saveScreenshot(path.join(evidence, 'goals-classic-populated-1400x900.png'))

    const dashboardNav = await $('[data-tab="Dashboard"]')
    await dashboardNav.click()
    await browser.waitUntil(async () => await dashboardNav.getAttribute('aria-current') === 'page', { timeout: 30000 })
    await $('.shinpo-dashboard').waitForDisplayed({ timeout: 30000 })
    await browser.pause(700)
    const populatedDashboard = await browser.execute((expectedTask) => {
      const dashboard = document.querySelector('.shinpo-dashboard')
      return {
        brand: document.documentElement.dataset.brand,
        theme: document.documentElement.dataset.theme,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        containsTask: dashboard.innerText.includes(expectedTask),
        sections: [...dashboard.querySelectorAll(':scope > section')].map((section) => ({ height: section.getBoundingClientRect().height, opacity: Number(getComputedStyle(section).opacity) })),
      }
    }, taskTitle)
    assert.equal(populatedDashboard.brand, 'classic')
    assert.equal(populatedDashboard.overflow, false, JSON.stringify(populatedDashboard))
    assert.ok(populatedDashboard.containsTask, 'Dashboard reflects the task created in this disposable Classic workspace')
    assert.ok(populatedDashboard.sections.every((section) => section.height > 0 && section.opacity >= 0.99), JSON.stringify(populatedDashboard))
    await browser.saveScreenshot(path.join(evidence, 'dashboard-classic-populated-1400x900.png'))
    console.log(`Native populated Classic Goals: ${JSON.stringify(populatedGoals)}`)
    console.log(`Native populated Classic Dashboard: ${JSON.stringify(populatedDashboard)}`)
  })
})
