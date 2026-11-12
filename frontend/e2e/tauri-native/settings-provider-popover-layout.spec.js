import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native EONPAI provider popover placement', function () {
  it('keeps provider options anchored in the settings content and clear of its navigation', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await $('h1').waitForDisplayed({ timeout: 120000 })
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])

    const username = `qaset_${Date.now()}`
    const createWorkspace = await $('button*=Create Workspace')
    if (await createWorkspace.isExisting() && await createWorkspace.getAttribute('aria-pressed') !== 'true') {
      await createWorkspace.click()
    }
    if (await createWorkspace.isExisting()) assert.equal(await createWorkspace.getAttribute('aria-pressed'), 'true')
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@shinpo.local`)
    await $('#auth-password').setValue(`Settings-${randomUUID()}-987#Secure!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    await $('[aria-label^="Account menu for"]').click()
    await $('button*=All settings').click()
    const dialog = await $('[role="dialog"][aria-labelledby="settings-dialog-title"]')
    await dialog.waitForDisplayed({ timeout: 15000 })
    await $('[data-section="eonpai"]').click()
    const provider = await $('#native-ai-provider')
    await provider.waitForDisplayed()
    await provider.click()
    await $('#native-ai-provider-listbox').waitForDisplayed({ timeout: 10000 })

    const layout = await browser.execute(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector)
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
      }
      return {
        trigger: rect('#native-ai-provider'),
        popover: rect('.shinpo-select-popover'),
        navigation: rect('.settings-nav-sidebar'),
        dialog: rect('.settings-modal-box'),
        placement: document.querySelector('.shinpo-select-popover').dataset.placement,
        viewport: { width: innerWidth, height: innerHeight },
      }
    })

    assert.ok(Math.abs(layout.popover.x - layout.trigger.x) <= 2, `provider list should align to the trigger: ${JSON.stringify(layout)}`)
    assert.ok(Math.abs(layout.popover.width - layout.trigger.width) <= 6, `provider list should match trigger width: ${JSON.stringify(layout)}`)
    assert.ok(['bottom', 'top'].includes(layout.placement), `provider list should open vertically: ${JSON.stringify(layout)}`)
    assert.ok(layout.popover.x >= layout.navigation.right, `provider list must not cover settings navigation: ${JSON.stringify(layout)}`)
    assert.ok(layout.popover.x >= layout.dialog.x && layout.popover.right <= layout.dialog.right, `provider list must remain within settings dialog: ${JSON.stringify(layout)}`)
    assert.ok(layout.popover.y >= layout.dialog.y && layout.popover.bottom <= layout.dialog.bottom, `provider list must remain within settings dialog: ${JSON.stringify(layout)}`)

    await browser.saveScreenshot(path.join(evidence, 'settings-provider-popover-native.png'))
    console.log(`Native EONPAI provider popover geometry: ${JSON.stringify(layout)}`)
    await $('[aria-label="Close Settings"]').click()
    await $('[aria-label^="Account menu for"]').click()
    await $('button*=All settings').click()
    const reopenedDialog = await $('[role="dialog"][aria-labelledby="settings-dialog-title"]')
    await reopenedDialog.waitForDisplayed()
    await $('[data-section="eonpai"]').click()
    const reopenedProvider = await $('#native-ai-provider')
    await reopenedProvider.waitForDisplayed()
    const reopenedConfig = await browser.execute(async () => await window.__TAURI_INTERNALS__.invoke('local_eonpai_provider_config'))
    assert.equal(reopenedConfig.provider, 'none', `offline provider setting is retained in the disposable vault: ${JSON.stringify(reopenedConfig)}`)
    const selectedProviderText = await browser.execute(() => document.querySelector('#native-ai-provider .shinpo-select-value')?.textContent?.trim() || '')
    console.log(`Native EONPAI provider selected value after reopen: ${JSON.stringify(selectedProviderText)}`)
    assert.ok(selectedProviderText.includes('Offline planning'), `provider selection is restored in the Settings control: ${JSON.stringify(selectedProviderText)}`)
    await reopenedDialog.$('form.settings-group-card').$('button[type="submit"]').click()
    await browser.waitUntil(async () => (await reopenedDialog.getText()).includes('Provider settings saved.'), { timeout: 15000 })
    const savedConfig = await browser.execute(async () => await window.__TAURI_INTERNALS__.invoke('local_eonpai_provider_config'))
    assert.deepEqual(savedConfig, reopenedConfig, 'saving the offline configuration persists the same provider settings')
    await browser.saveScreenshot(path.join(evidence, 'settings-provider-saved-reopened-native.png'))
    console.log(`Native EONPAI provider saved/reopened: ${JSON.stringify(savedConfig)}`)
    await $('[aria-label="Close Settings"]').click()
  })
})
