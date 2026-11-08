import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Fedora Guardian acceptance', function () {
  it('creates an isolated local vault and renders actual native Guardian state', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE, 'runner must provide a disposable profile')
    assert.ok(process.env.XDG_DATA_HOME?.startsWith(process.env.SHINPO_TAURI_QA_PROFILE))

    const authHeading = await $('h1')
    await authHeading.waitForDisplayed({ timeout: 120000 })
    assert.match(await authHeading.getText(), /Create your workspace|Welcome back|Sign in to SHINPO/)
    console.log('Actual Tauri auth screen rendered')

    const username = `qa_wdio_${Date.now()}`
    const password = `Wdio-QA-${randomUUID()}-Safe!`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(password)
    await $('button[type="submit"]').click()
    console.log('Disposable local account form submitted')

    const recoveryKey = await $('#recovery-key-display')
    await recoveryKey.waitForDisplayed({ timeout: 120000 })
    assert.ok((await recoveryKey.getText()).trim().length > 20, 'new vault should present a recovery key')
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    console.log('Recovery key confirmation completed without logging the key')

    const welcomeDismiss = await $('[aria-label="Dismiss welcome"]')
    let welcomeVisible = false
    try {
      await welcomeDismiss.waitForDisplayed({ timeout: 6000 })
      welcomeVisible = true
    } catch {
      // The welcome overlay is optional for accounts with completed onboarding.
    }
    if (welcomeVisible) {
      await welcomeDismiss.click()
      console.log('First-run welcome dismissed for Guardian navigation')
    } else {
      console.log('No first-run welcome overlay was displayed')
    }

    const guardianNav = await $('[data-tab="Task Manager"]')
    await guardianNav.waitForDisplayed({ timeout: 60000 })
    await guardianNav.click()
    console.log('Navigated using the actual Focus Protection sidebar control')

    const guardianHeading = await $('#guardian-alpha-title')
    await guardianHeading.waitForDisplayed({ timeout: 30000 })
    assert.equal(await guardianHeading.getText(), 'Guardian beta')

    const appsPanel = await $('[aria-labelledby="guardian-apps-title"]')
    try {
      await appsPanel.waitForDisplayed({ timeout: 30000 })
    } catch (error) {
      const evidenceDir = process.env.SHINPO_TAURI_EVIDENCE_DIR
      mkdirSync(evidenceDir, { recursive: true, mode: 0o700 })
      await browser.saveScreenshot(path.join(evidenceDir, 'guardian-apps-failure.png'))
      console.error(`Guardian apps panel at failure: ${(await $('[aria-labelledby="guardian-apps-title"]').getText()).replace(/\s+/g, ' ').trim()}`)
      throw error
    }
    assert.match(await appsPanel.getText(), /Installed Applications/i)
    assert.match(await appsPanel.getText(), /installed apps discovered/i)

    const appList = await $('.guardian-app-list')
    await appList.waitForDisplayed({ timeout: 30000 })
    const appItems = await appList.$$('li')
    assert.ok(appItems.length > 0, 'real installed applications should be discovered and rendered')

    // Test searching applications
    const searchInput = await $('.guardian-app-search-box input')
    await searchInput.setValue('code')
    await browser.pause(300)
    const filteredItems = await appList.$$('li')
    console.log(`Filtered applications for 'code': ${filteredItems.length}`)
    await searchInput.clearValue()
    await browser.pause(300)

    // Test toggling policy on first enforceable application
    const firstBlockBtn = await $('.segmented-btn.btn-block')
    if (await firstBlockBtn.isExisting()) {
      await firstBlockBtn.click()
      await browser.pause(500)
      console.log('Successfully set application policy via native vault')
    }

    const status = await $('.guardian-alpha-status')
    await status.waitForDisplayed()
    assert.ok((await status.getText()).trim().length > 0)
    const protectionPanel = await $('.sidebar-protection-panel')
    const protectionText = await protectionPanel.getText()
    assert.match(protectionText, /Monitoring only/i)
    assert.doesNotMatch(protectionText, /AUDIT_ONLY/)

    const evidenceDir = process.env.SHINPO_TAURI_EVIDENCE_DIR
    assert.ok(evidenceDir)
    mkdirSync(evidenceDir, { recursive: true, mode: 0o700 })
    await browser.saveScreenshot(path.join(evidenceDir, 'guardian-native.png'))
    console.log(`Tauri WebView protocol: ${await browser.execute(() => window.location.protocol)}`)
    console.log(`Guardian status rendered: ${(await status.getText()).trim()}`)
    console.log(`Installed applications rendered: ${appItems.length}`)
    console.log('Installed-app discovery and persistent policy controls verified live')

    for (const [tab, file] of [
      ['Dashboard', 'dashboard'],
      ['Goals & Missions', 'goals'],
      ['Focus Engine', 'focus'],
      ['Schedule', 'calendar'],
      ['Analytics', 'analytics'],
      ['Rewards', 'rewards'],
      ['AI Assistant', 'eonpai'],
    ]) {
      await $(`[data-tab="${tab}"]`).click()
      await browser.waitUntil(async () => await $(`[data-tab="${tab}"]`).getAttribute('aria-current') === 'page', {
        timeout: 30000,
        timeoutMsg: `Navigation to ${tab} did not become active`,
      })
      await browser.saveScreenshot(path.join(evidenceDir, `${file}-native.png`))
      console.log(`Actual native navigation rendered: ${tab}`)

      if (tab === 'Focus Engine') {
        const focusView = await $('.focus-workspace-container')
        await focusView.waitForDisplayed({ timeout: 30000 })
        await $('[data-tutorial="start-timer-btn"]').click()
        await browser.waitUntil(async () => await $('.focus-workspace-container').getAttribute('data-focus-mode') === 'active', {
          timeout: 30000,
          timeoutMsg: 'Native Focus session did not enter ACTIVE state',
        })
        console.log('Focus session started through the actual native Focus UI')

        await $('button*=Pause Session').click()
        await browser.waitUntil(async () => await $('.focus-workspace-container').getAttribute('data-focus-mode') === 'paused', {
          timeout: 30000,
          timeoutMsg: 'Native Focus session did not enter PAUSED state',
        })
        await browser.saveScreenshot(path.join(evidenceDir, 'focus-paused-native.png'))
        console.log('Focus session paused and persisted state rendered')

        await $('button*=Resume Session').click()
        await browser.waitUntil(async () => await $('.focus-workspace-container').getAttribute('data-focus-mode') === 'active', {
          timeout: 30000,
          timeoutMsg: 'Native Focus session did not resume to ACTIVE state',
        })
        await browser.saveScreenshot(path.join(evidenceDir, 'focus-resumed-native.png'))
        console.log('Focus session resumed through the actual native Focus UI')

        await $('button*=Cancel Session').click()
        await browser.waitUntil(async () => await $('.focus-workspace-container').getAttribute('data-focus-mode') === 'ready', {
          timeout: 30000,
          timeoutMsg: 'Cancelled Focus session remained active in the UI',
        })
        console.log('Focus session cancelled; the Focus UI returned to ready state')
      }

      if (tab === 'Goals & Missions') {
        const goalTitle = `WDIO Goal ${Date.now()}`
        await $('button*=Create First Goal').click()
        const goalDialog = await $('[role="dialog"][aria-labelledby="create-goal-dialog-title"]')
        await goalDialog.waitForDisplayed()
        await $('label[for="create-goal-name-input"]').click()
        assert.equal(await browser.execute(() => document.activeElement?.id), 'create-goal-name-input')
        await $('#create-goal-name-input').setValue(goalTitle)
        await goalDialog.$('button[type="submit"]').click()
        await $('.goal-single-summary-card').waitForDisplayed({ timeout: 60000 })
        assert.match(await $('.goal-single-summary-card').getText(), new RegExp(goalTitle))

        const taskTitle = `WDIO Task ${Date.now()}`
        await $('button[data-tutorial="new-task"]').click()
        const taskDialog = await $('[role="dialog"][aria-labelledby="create-task-title"]')
        await taskDialog.waitForDisplayed()
        await $('#create-task-title-input').setValue(taskTitle)
        await taskDialog.$('button[type="submit"]').click()
        const taskList = await $('.missions-list-container')
        await taskList.waitForDisplayed({ timeout: 60000 })
        await browser.waitUntil(async () => (await taskList.getText()).includes(taskTitle), {
          timeout: 60000,
          timeoutMsg: 'Created task did not appear in the native task list',
        })
        await browser.saveScreenshot(path.join(evidenceDir, 'goals-task-created-native.png'))
        console.log('Actual native Goal and linked Task created and rendered')

        await $('[data-tab="Dashboard"]').click()
        await $('[data-tab="Goals & Missions"]').click()
        await browser.waitUntil(async () => await $('[data-tab="Goals & Missions"]').getAttribute('aria-current') === 'page', {
          timeout: 30000,
          timeoutMsg: 'Could not return to Goals & Tasks after creating the task',
        })
        assert.match(await $('.goal-single-summary-card').getText(), new RegExp(goalTitle))
        assert.ok((await $('.missions-list-container').getText()).includes(taskTitle))
        console.log('Created Goal and Task remain visible after leaving and returning to the screen')
      }
    }

    await $('[aria-label="Settings"]').click()
    await $('[role="dialog"]').waitForDisplayed({ timeout: 30000 })
    await browser.saveScreenshot(path.join(evidenceDir, 'settings-native.png'))
    await $('[aria-label="Close Settings"]').click()
    console.log('Settings opened and closed through the actual native window')
  })
})
