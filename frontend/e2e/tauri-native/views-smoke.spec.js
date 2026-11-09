import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

async function particleChecksum() {
  return browser.execute(() => {
    const canvas = document.querySelector('[data-testid="shinpo-particles"]')
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let checksum = 0
    for (let index = 0; index < pixels.length; index += 256) checksum = (checksum + pixels[index] * (index + 1)) >>> 0
    return { checksum, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }
  })
}

describe('SHINPO native authenticated screen smoke', function () {
  it('opens the remaining screens and captures the unchanged sidebar states', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_PARTICLES_EVIDENCE_DIR || process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })
    await $('h1').waitForDisplayed({ timeout: 120000 })
    const handles = await browser.getWindowHandles()
    if (handles.length) await browser.switchToWindow(handles[0])
    await browser.saveScreenshot(path.join(evidence, 'auth-native.png'))

    const username = `qa_views_${Date.now()}`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(`Views-QA-${randomUUID()}-Safe!`)
    await $('button[type="submit"]').click()
    await $('#recovery-key-display').waitForDisplayed({ timeout: 30000 })
    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()
    const welcome = await $('[aria-label="Dismiss welcome"]')
    try { await welcome.waitForDisplayed({ timeout: 3000 }); await welcome.click() } catch {}
    const skipTutorial = await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip')
    try { await skipTutorial.waitForDisplayed({ timeout: 3000 }); await skipTutorial.click() } catch {}

    const sidebar = await $('aside[aria-label="Main navigation"]')
    const particleCanvas = await $('[data-testid="shinpo-particles"]')
    await particleCanvas.waitForDisplayed()
    const initialParticles = await browser.execute(() => {
      const canvas = document.querySelector('[data-testid="shinpo-particles"]')
      const rect = canvas.getBoundingClientRect()
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let checksum = 0
      let visiblePixels = 0
      for (let index = 3; index < pixels.length; index += 16) if (pixels[index] > 0) visiblePixels++
      for (let index = 0; index < pixels.length; index += 256) checksum = (checksum + pixels[index] * (index + 1)) >>> 0
      window.__shinpoParticleCanvas = canvas
      const shell = document.querySelector('.app-shell')
      const shellRect = shell.getBoundingClientRect()
      const main = document.querySelector('.app-main')
      const canvasStyle = getComputedStyle(canvas)
      return { count: document.querySelectorAll('[data-testid="shinpo-particles"]').length, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewport: { width: innerWidth, height: innerHeight }, position: canvasStyle.position, zIndex: canvasStyle.zIndex, shellPosition: getComputedStyle(shell).position, shellZIndex: getComputedStyle(shell).zIndex, mainZIndex: getComputedStyle(main).zIndex, pointerEvents: canvasStyle.pointerEvents, ariaHidden: canvas.getAttribute('aria-hidden'), checksum, visiblePixels, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, buttonHit: document.elementFromPoint(document.querySelector('[data-tab="Dashboard"]').getBoundingClientRect().x + 10, document.querySelector('[data-tab="Dashboard"]').getBoundingClientRect().y + 10)?.tagName }
    })
    assert.equal(initialParticles.count, 1, 'authenticated shell must mount exactly one particle canvas')
    assert.equal(initialParticles.position, 'fixed', 'one particle canvas spans the application window')
    assert.equal(initialParticles.zIndex, '0', 'particle canvas stays below the application content')
    assert.equal(initialParticles.shellPosition, 'relative')
    assert.ok(Number(initialParticles.mainZIndex) > Number(initialParticles.zIndex), 'main application content paints above the particle canvas')
    assert.ok(Math.abs(initialParticles.rect.x) <= 1 && Math.abs(initialParticles.rect.y) <= 1, 'particle canvas starts at the window origin')
    assert.ok(Math.abs(initialParticles.rect.width - initialParticles.viewport.width) <= 1, 'particle canvas covers the window width')
    assert.ok(Math.abs(initialParticles.rect.height - initialParticles.viewport.height) <= 1, 'particle canvas covers the window height')
    assert.equal(initialParticles.pointerEvents, 'none')
    assert.equal(initialParticles.ariaHidden, 'true')
    assert.equal(initialParticles.reducedMotion, process.env.SHINPO_EXPECT_REDUCED_MOTION === '1')
    assert.ok(initialParticles.rect.width >= 1200, 'particle canvas covers the desktop shell')
    assert.ok(initialParticles.visiblePixels > 0, 'particle canvas rendered visible pixels')
    assert.notEqual(initialParticles.buttonHit, 'CANVAS', 'particle layer does not sit above interactive controls')
    await browser.pause(900)
    const movingParticles = await browser.execute(() => {
      const canvas = document.querySelector('[data-testid="shinpo-particles"]')
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
      let checksum = 0
      for (let index = 0; index < pixels.length; index += 256) checksum = (checksum + pixels[index] * (index + 1)) >>> 0
      return { sameCanvas: canvas === window.__shinpoParticleCanvas, checksum }
    })
    assert.equal(movingParticles.sameCanvas, true, 'canvas node is stable after initial render')
    if (process.env.SHINPO_EXPECT_REDUCED_MOTION === '1') {
      assert.equal(movingParticles.checksum, initialParticles.checksum, 'reduced-motion particle frame should remain static')
    } else {
      assert.notEqual(movingParticles.checksum, initialParticles.checksum, 'particle frame should change while app is visible')
    }

    const toggle = await $('.sidebar-toggle-btn')
    const topSearch = await $('[aria-label="Global search"]')
    assert.equal(await sidebar.$$('input').then((inputs) => inputs.length), 0, 'sidebar search remains absent')
    assert.ok(await topSearch.isDisplayed(), 'global topbar search remains visible')
    await browser.saveScreenshot(path.join(evidence, 'sidebar-expanded-native.png'))
    await toggle.click()
    await browser.waitUntil(async () => await toggle.getAttribute('aria-expanded') === 'false', { timeout: 10000 })
    assert.equal(await sidebar.$$('input').then((inputs) => inputs.length), 0, 'collapsed sidebar remains free of search controls')
    assert.ok(await topSearch.isDisplayed(), 'global search remains in the topbar when sidebar collapses')
    await browser.saveScreenshot(path.join(evidence, 'sidebar-collapsed-native.png'))
    await toggle.click()
    await browser.waitUntil(async () => await toggle.getAttribute('aria-expanded') === 'true', { timeout: 10000 })

    for (const [tab, filename, root] of [
      ['Dashboard', 'dashboard', '.shinpo-dashboard'],
      ['Schedule', 'calendar', '.schedule-container'],
      ['Analytics', 'analytics', '.analytics-view'],
      ['Task Manager', 'focus-protection', '.guardian-alpha'],
      ['AI Assistant', 'eonpai', '.eonpai-workspace'],
      ['Rewards', 'rewards', '.rewards-view'],
    ]) {
      const nav = await $(`[data-tab="${tab}"]`)
      await nav.click()
      await browser.waitUntil(async () => await nav.getAttribute('aria-current') === 'page', { timeout: 30000, timeoutMsg: `${tab} navigation did not activate` })
      await $(root).waitForDisplayed({ timeout: 30000, timeoutMsg: `${tab} content did not finish loading` })
      await browser.waitUntil(async () => await browser.execute(() => !document.querySelector('.app-content-stage [role="status"][aria-busy="true"]')), {
        timeout: 30000,
        timeoutMsg: `${tab} remained in the route loading state`,
      })
      const particleCanvasStable = await browser.execute(() =>
        document.querySelectorAll('[data-testid="shinpo-particles"]').length === 1 &&
        document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas
      )
      assert.equal(particleCanvasStable, true, `particle canvas remounted during ${tab} navigation`)
      const beforeNavigationFrame = await particleChecksum()
      await browser.pause(550)
      const afterNavigationFrame = await particleChecksum()
      if (afterNavigationFrame.reducedMotion) {
        assert.equal(afterNavigationFrame.checksum, beforeNavigationFrame.checksum, `${tab}: reduced-motion particles should be static`)
      } else {
        assert.notEqual(afterNavigationFrame.checksum, beforeNavigationFrame.checksum, `${tab}: particles should continue animating after navigation`)
      }
      const page = await browser.execute(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        title: document.querySelector('main h1, main h2, .view-header h1, .page-heading h1')?.textContent?.trim() || document.title,
      }))
      assert.equal(page.overflow, false, `${tab} has horizontal overflow`)
      if (tab === 'Task Manager') {
        const guardianLayout = await browser.execute(() => {
          const workspace = document.querySelector('.guardian-alpha-workspace')
          const info = document.querySelector('.guardian-alpha-info-column')
          const apps = document.querySelector('.guardian-installed-panel')
          const list = document.querySelector('.guardian-app-list')
          const bounds = (element) => {
            const rect = element.getBoundingClientRect()
            return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }
          }
          return {
            workspace: bounds(workspace),
            info: bounds(info),
            apps: bounds(apps),
            list: { height: list.clientHeight, scrollHeight: list.scrollHeight, overflowY: getComputedStyle(list).overflowY },
            columns: getComputedStyle(workspace).gridTemplateColumns,
          }
        })
        assert.ok(guardianLayout.apps.left > guardianLayout.info.left, 'Installed Applications must be in the right column')
        assert.ok(guardianLayout.apps.width > guardianLayout.info.width * 1.45, 'Installed Applications must receive the larger workspace share')
        assert.equal(guardianLayout.list.overflowY, 'auto', 'application inventory keeps its own vertical scroll')
        await browser.saveScreenshot(path.join(evidence, 'guardian-balanced-native.png'))
        console.log(`Native Guardian layout: left=${Math.round(guardianLayout.info.width)}px, applications=${Math.round(guardianLayout.apps.width)}px, list=${guardianLayout.list.height}/${guardianLayout.list.scrollHeight}px`)
        const guardianSizes = [[960, 600], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]]
        for (const [width, height] of guardianSizes) {
          await browser.setWindowSize(width, height)
          await browser.pause(150)
          const layout = await browser.execute(() => {
            const workspace = document.querySelector('.guardian-alpha-workspace')
            const info = document.querySelector('.guardian-alpha-info-column').getBoundingClientRect()
            const apps = document.querySelector('.guardian-installed-panel').getBoundingClientRect()
            return {
              viewport: innerWidth,
              documentWidth: document.documentElement.scrollWidth,
              sidebarRight: document.querySelector('.icon-sidebar').getBoundingClientRect().right,
              mainLeft: document.querySelector('.app-main').getBoundingClientRect().left,
              infoWidth: info.width,
              appsWidth: apps.width,
              appsLeft: apps.left,
              infoLeft: info.left,
              columns: getComputedStyle(workspace).gridTemplateColumns,
            }
          })
          assert.ok(layout.documentWidth <= layout.viewport + 1, `Guardian overflows horizontally at ${width}x${height}`)
          assert.ok(layout.mainLeft >= layout.sidebarRight - 1, `main workspace overlaps the sidebar at ${width}x${height}`)
          if (width > 1100) assert.ok(layout.appsLeft > layout.infoLeft, `Guardian columns should remain ordered at ${width}x${height}`)
          else assert.ok(layout.appsLeft >= layout.infoLeft, 'stacked Guardian panels must preserve reading order')
          await browser.saveScreenshot(path.join(evidence, `guardian-${width}x${height}-native.png`))
          console.log(`Native Guardian ${width}x${height}: info=${Math.round(layout.infoWidth)}px apps=${Math.round(layout.appsWidth)}px overflow=${layout.documentWidth > layout.viewport}`)
        }
        await browser.setWindowSize(1400, 900)
      }
      if (tab === 'Schedule') {
        const calendar = await $('.schedule-calendar-scroll')
        const parent = await browser.execute((element) => {
          for (let node = element.parentElement; node; node = node.parentElement) {
            if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) return node
          }
          return document.scrollingElement
        }, calendar)
        const parentScrollBefore = await browser.execute((element) => element.scrollTop, parent)
        const before = await browser.execute((element) => {
          const lastDay = element.querySelector('.schedule-grid-day-heading:last-of-type')
          return {
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            lastDayRight: lastDay.getBoundingClientRect().right,
            viewportRight: element.getBoundingClientRect().right,
          }
        }, calendar)
        assert.ok(before.scrollHeight > before.clientHeight, 'calendar grid must scroll internally')
        assert.ok(before.lastDayRight <= before.viewportRight + 1, 'full week should fit in the 1400px desktop calendar')
        await browser.action('wheel').scroll({ deltaX: 0, deltaY: 420, duration: 180, origin: calendar }).perform()
        await browser.waitUntil(async () => await browser.execute((element) => element.scrollTop > 0, calendar), { timeout: 5000, timeoutMsg: 'wheel did not scroll the calendar internally' })
        await browser.saveScreenshot(path.join(evidence, 'calendar-internal-scroll-native.png'))
        await browser.execute((element) => { element.scrollTop = element.scrollHeight }, calendar)
        await browser.action('wheel').scroll({ deltaX: 0, deltaY: 360, duration: 180, origin: calendar }).perform()
        await browser.waitUntil(async () => await browser.execute((element, initial) => element.scrollTop > initial, parent, parentScrollBefore), { timeout: 5000, timeoutMsg: 'wheel at the calendar boundary did not scroll the page' })
        await browser.saveScreenshot(path.join(evidence, 'calendar-page-scroll-handoff-native.png'))
        await browser.execute((calendarElement, parentElement, initialParentScroll) => {
          calendarElement.scrollTop = 0
          parentElement.scrollTop = initialParentScroll
        }, calendar, parent, parentScrollBefore)
        console.log(`Native Calendar scroll: vertical ${before.scrollHeight}/${before.clientHeight}; page wheel handoff passed; horizontal ${before.scrollWidth}/${before.clientWidth}`)
      }
      await browser.saveScreenshot(path.join(evidence, `${filename}-native.png`))
      console.log(`Native tab ${tab} rendered, title=${page.title}, horizontalOverflow=${page.overflow}`)
    }

    async function openSettingsModal() {
      const directSettings = await $('[aria-label="Settings"]')
      if (await directSettings.isExisting()) {
        await directSettings.click()
      } else {
        const accountMenu = await $('button[aria-label*="Account"]')
        if (await accountMenu.isExisting()) {
          await accountMenu.click()
          await browser.pause(200)
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
    }

    async function closeSettingsModal(dialog) {
      const close = await $('[aria-label="Close Settings"]')
      if (await close.isExisting()) await close.click()
      else await browser.keys('Escape')
      await dialog.waitForDisplayed({ reverse: true, timeout: 10000 })
    }

    await openSettingsModal()
    const settings = await $('[role="dialog"]')
    await settings.waitForDisplayed({ timeout: 30000 })
    await browser.saveScreenshot(path.join(evidence, 'settings-native.png'))
    await $('button*=Classic').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.dataset.brand === 'classic'), { timeout: 10000 })
    assert.equal(await browser.execute(() => document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas), true, 'Classic switch must preserve the mounted canvas')
    await $('button*=Light Theme').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.getAttribute('data-theme') === 'light'), { timeout: 10000 })
    assert.equal(await browser.execute(() => document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas), true, 'Classic Light switch must preserve the mounted canvas')
    await closeSettingsModal(settings)
    await $('[data-tab="Dashboard"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Dashboard"]').getAttribute('aria-current') === 'page', { timeout: 10000 })
    await $('.shinpo-dashboard').waitForDisplayed({ timeout: 30000 })
    await browser.waitUntil(async () => await browser.execute(() => !document.querySelector('.app-content-stage [role="status"][aria-busy="true"]')), { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidence, 'dashboard-classic-light-particles-native.png'))
    await openSettingsModal()
    await $('[role="dialog"]').waitForDisplayed({ timeout: 10000 })
    await $('button*=Dark Theme').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.getAttribute('data-theme') === 'dark'), { timeout: 10000 })
    await closeSettingsModal(settings)
    await $('[data-tab="Dashboard"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Dashboard"]').getAttribute('aria-current') === 'page', { timeout: 10000 })
    await $('.shinpo-dashboard').waitForDisplayed({ timeout: 30000 })
    await browser.waitUntil(async () => await browser.execute(() => !document.querySelector('.app-content-stage [role="status"][aria-busy="true"]')), { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidence, 'dashboard-classic-dark-particles-native.png'))
    await openSettingsModal()
    await $('[role="dialog"]').waitForDisplayed({ timeout: 10000 })
    await $('button*=Aurora').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.dataset.brand === 'aurora'), { timeout: 10000 })
    assert.equal(await browser.execute(() => document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas), true, 'Aurora switch must preserve the mounted canvas')
    await closeSettingsModal(settings)
    await $('[data-tab="Dashboard"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Dashboard"]').getAttribute('aria-current') === 'page', { timeout: 10000 })
    await $('.shinpo-dashboard').waitForDisplayed({ timeout: 30000 })
    await browser.waitUntil(async () => await browser.execute(() => !document.querySelector('.app-content-stage [role="status"][aria-busy="true"]')), { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidence, 'dashboard-aurora-dark-particles-native.png'))
    await openSettingsModal()
    await $('[role="dialog"]').waitForDisplayed({ timeout: 10000 })
    await $('button*=Light Theme').click()
    await browser.waitUntil(async () => await browser.execute(() => document.documentElement.getAttribute('data-theme') === 'light'), { timeout: 10000 })
    assert.equal(await browser.execute(() => document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas), true, 'Aurora Light switch must preserve the mounted canvas')
    await closeSettingsModal(settings)
    await $('[data-tab="Dashboard"]').click()
    await browser.waitUntil(async () => await $('[data-tab="Dashboard"]').getAttribute('aria-current') === 'page', { timeout: 10000 })
    await $('.shinpo-dashboard').waitForDisplayed({ timeout: 30000 })
    await browser.waitUntil(async () => await browser.execute(() => !document.querySelector('.app-content-stage [role="status"][aria-busy="true"]')), { timeout: 30000 })
    await browser.saveScreenshot(path.join(evidence, 'dashboard-aurora-light-particles-native.png'))
    assert.equal(await browser.execute(() => document.querySelector('[data-testid="shinpo-particles"]') === window.__shinpoParticleCanvas), true, 'theme changes must not replace the particle canvas')
    console.log('Native Settings dialog opened and closed')
  })
})
