import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('Classic Mesh Drift native WebKit integration', function () {
  it('keeps one WebGL canvas under the UI and changes palette without losing context', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE, 'requires the isolated Tauri QA profile')
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])
    await $('#auth-identifier').waitForDisplayed({ timeout: 120000 })

    const username = `qa_mesh_${Date.now()}`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Mesh-QA-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    const selectAppearance = async (theme, brand) => {
      const directSettings = await $('[aria-label="Settings"]')
      if (await directSettings.isExisting() && await directSettings.isDisplayed()) {
        await directSettings.click()
      } else {
        const accountMenu = await $('button[aria-label*="Account"]')
        if (await accountMenu.isExisting()) {
          await accountMenu.click()
          await browser.pause(300)
          const allSettings = await $('button*=All settings')
          if (await allSettings.isExisting()) {
            await allSettings.click()
          } else {
            const menuitem = await $('[role="menuitem"]*=All settings')
            if (await menuitem.isExisting()) {
              await menuitem.click()
            } else {
              await browser.keys(['Control', ','])
            }
          }
        } else {
          await browser.keys(['Control', ','])
        }
      }
      await $('[aria-label="Close Settings"]').waitForDisplayed({ timeout: 15000 })
      await $(`button*=${theme === 'dark' ? 'Dark Theme' : 'Light Theme'}`).click()
      await $(`button*=${brand === 'aurora' ? 'Aurora' : 'Classic'}`).click()
      await browser.waitUntil(async () => await browser.execute((expectedTheme, expectedBrand) =>
        document.documentElement.dataset.theme === expectedTheme && document.documentElement.dataset.brand === expectedBrand
      , theme, brand), { timeout: 15000 })
      await $('[aria-label="Close Settings"]').click()
    }

    await $('[data-tab="Dashboard"]').waitForDisplayed({ timeout: 30000 })
    await browser.setWindowSize(1400, 900)
    const getCanvasState = async () => browser.execute(() => {
      const canvas = document.querySelector('.shinpo-mesh-drift')
      const shell = document.querySelector('.app-shell')
      const main = document.querySelector('.app-main')
      const sidebar = document.querySelector('.icon-sidebar')
      const rect = canvas.getBoundingClientRect()
      const gl = canvas.getContext('webgl')
        window.__shinpoMeshTestContext ??= gl
      return {
        canvasCount: document.querySelectorAll('.shinpo-mesh-drift').length,
        active: canvas.dataset.active,
        ready: canvas.dataset.ready,
        error: canvas.dataset.error,
        visibility: getComputedStyle(canvas).visibility,
        pointerEvents: getComputedStyle(canvas).pointerEvents,
        canvasSize: [canvas.width, canvas.height],
        cssSize: [rect.width, rect.height],
        dpr: devicePixelRatio,
        shellSize: [shell.clientWidth, shell.clientHeight],
        canvasZ: getComputedStyle(canvas).zIndex,
        mainZ: getComputedStyle(main).zIndex,
        sidebarZ: getComputedStyle(sidebar).zIndex,
        webgl: gl?.getParameter(gl.VERSION) ?? null,
        contextStable: gl === window.__shinpoMeshTestContext,
      }
    })

    await selectAppearance('dark', 'classic')
    await browser.waitUntil(async () => (await getCanvasState()).ready === 'true', { timeout: 15000, timeoutMsg: 'Classic Dark WebGL frame did not render' })
    const classicDark = await getCanvasState()
    assert.equal(classicDark.canvasCount, 1)
    assert.equal(classicDark.active, 'true')
    assert.equal(classicDark.visibility, 'visible')
    assert.equal(classicDark.pointerEvents, 'none')
    assert.equal(classicDark.canvasZ, '0')
    assert.ok(Number(classicDark.mainZ) > Number(classicDark.canvasZ))
    assert.ok(Number(classicDark.sidebarZ) > Number(classicDark.canvasZ))
    assert.ok(classicDark.webgl?.includes('WebGL'))
    assert.ok(classicDark.canvasSize[0] <= Math.ceil(classicDark.cssSize[0] * 2))
    assert.ok(classicDark.canvasSize[1] <= Math.ceil(classicDark.cssSize[1] * 2))
    await browser.saveScreenshot(path.join(evidence, 'mesh-drift-classic-dark-1400x900.png'))

    await selectAppearance('light', 'classic')
    const classicLight = await getCanvasState()
    assert.equal(classicLight.ready, 'true')
    assert.equal(classicLight.contextStable, true, 'theme switch should retain the WebGL context')
    await browser.saveScreenshot(path.join(evidence, 'mesh-drift-classic-light-1400x900.png'))

    await selectAppearance('dark', 'aurora')
    const aurora = await getCanvasState()
    assert.equal(aurora.active, 'false')
    assert.equal(aurora.visibility, 'hidden', 'Aurora must not show the Classic shader')
    await browser.saveScreenshot(path.join(evidence, 'mesh-drift-aurora-dark-1400x900.png'))

    await selectAppearance('light', 'aurora')
    await selectAppearance('dark', 'classic')
    await browser.setWindowSize(1280, 720)
    await browser.waitUntil(async () => (await getCanvasState()).ready === 'true', { timeout: 15000 })
    const compact = await getCanvasState()
    assert.equal(compact.canvasCount, 1)
    assert.equal(compact.active, 'true')
    await browser.saveScreenshot(path.join(evidence, 'mesh-drift-classic-dark-1280x720.png'))
    console.log(`Native Mesh Drift: ${JSON.stringify({ classicDark, classicLight, aurora, compact })}`)
  })
})
