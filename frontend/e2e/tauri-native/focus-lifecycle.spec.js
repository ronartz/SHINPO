import assert from 'node:assert/strict'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Focus lifecycle', function () {
  it('starts, pauses, resumes and cancels a disposable Focus session', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    assert.ok(process.env.XDG_DATA_HOME?.startsWith(process.env.SHINPO_TAURI_QA_PROFILE))

    const username = `qa_focus_${Date.now()}`
    const password = `Focus-QA-${randomUUID()}-Safe!`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(password)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 120000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()

    const focusNav = await $('[data-tab="Focus Engine"]')
    await focusNav.waitForDisplayed({ timeout: 60000 })
    await focusNav.click()
    const workspace = await $('.focus-workspace-container')
    await workspace.waitForDisplayed({ timeout: 30000 })
    const evidenceDir = process.env.SHINPO_TAURI_EVIDENCE_DIR

    await $('[data-tutorial="start-timer-btn"]').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidenceDir, 'focus-active-native.png'))
    console.log('PASS: disposable Focus session entered ACTIVE in native Tauri UI')

    await $('button*=Pause Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'paused', { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidenceDir, 'focus-paused-native.png'))
    console.log('PASS: Focus session entered PAUSED in native Tauri UI')

    await $('button*=Resume Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidenceDir, 'focus-resumed-native.png'))
    console.log('PASS: Focus session resumed ACTIVE in native Tauri UI')

    await $('button*=Cancel Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'ready', { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidenceDir, 'focus-cancelled-native.png'))
    console.log('PASS: Focus cancellation returned native UI to READY')

    const eonpaiNav = await $('[data-tab="AI Assistant"]')
    await eonpaiNav.click()
    await browser.waitUntil(async () => await eonpaiNav.getAttribute('aria-current') === 'page', { timeout: 30000 })
    const composer = await $('.eonpai-composer-input')
    await composer.waitForDisplayed()
    assert.equal(await composer.getAttribute('placeholder'), 'Ask EONPAI a question...')
    await browser.saveScreenshot(path.join(evidenceDir, 'eonpai-composer-native.png'))
    console.log('PASS: EONPAI composer uses concise, fully visible prompt text in native UI')
  })
})
