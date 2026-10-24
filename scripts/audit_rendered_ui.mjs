import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const viewports = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 800 },
  { width: 1000, height: 768 },
  { width: 390, height: 844 },
]
const views = ['Dashboard', 'Goals & Missions', 'Focus Engine', 'Schedule', 'Task Manager', 'Analytics', 'AI Assistant']

function isolatedUrl(value, label, denyDefaultBackend = false) {
  if (!value) throw new Error(`${label} is required; configure both audit endpoints for an isolated QA instance`)
  const url = new URL(value)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error(`${label} must be a credential-free loopback URL`)
  }
  if (denyDefaultBackend && url.port === '8080') {
    throw new Error('Refusing the default localhost:8080 backend; use a dedicated isolated QA port')
  }
  return url.toString().replace(/\/+$/, '')
}

const frontendUrl = isolatedUrl(process.env.SHINPO_URL, 'SHINPO_URL')
const backendUrl = isolatedUrl(process.env.SHINPO_API_URL, 'SHINPO_API_URL', true)
assert.equal(isolatedUrl('http://127.0.0.1:18080', 'backend', true), 'http://127.0.0.1:18080')
assert.throws(() => isolatedUrl('http://localhost:8080', 'backend', true), /dedicated isolated QA port/)
assert.throws(() => isolatedUrl('https://example.com', 'backend'), /loopback URL/)

function textBoxesOverlap(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.x, b.x)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
  const smallerArea = Math.min((a.right - a.x) * (a.bottom - a.y), (b.right - b.x) * (b.bottom - b.y))
  return width > 2 && height > 2 && width * height / smallerArea > .32
}

const sampleTextBox = { x: 0, y: 0, right: 40, bottom: 16 }
assert.equal(textBoxesOverlap(sampleTextBox, { x: 10, y: 2, right: 45, bottom: 18 }), true)
assert.equal(textBoxesOverlap(sampleTextBox, { x: 42, y: 0, right: 82, bottom: 16 }), false)

async function login() {
  const username = process.env.SHINPO_AUDIT_USERNAME || `audit_qa_${Date.now()}`
  const password = process.env.SHINPO_AUDIT_PASSWORD || 'Password123!'
  const isExistingDisposable = Boolean(process.env.SHINPO_AUDIT_USERNAME)
  const authResponse = await fetch(`${backendUrl}/api/auth/${isExistingDisposable ? 'login' : 'register'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isExistingDisposable
      ? { usernameOrEmail: username, password }
      : { username, email: `${username}@shinpo.local`, password }),
  })
  if (authResponse.ok) return authResponse.json()

  throw new Error(`Visual audit could not ${isExistingDisposable ? 'log in to the existing isolated account' : 'register a fresh disposable account'} at ${backendUrl}`)
}

async function main() {
  const auth = await login()
  const profile = await mkdtemp(join(tmpdir(), 'shinpo-visual-audit-'))
  const captures = await mkdtemp(join(tmpdir(), 'shinpo-visual-audit-captures-'))
  if (process.env.SHINPO_AUDIT_CAPTURE_ALL === '1') console.log(`Audit screenshots: ${captures}`)
  const port = 9407
  const chrome = spawn('google-chrome', [
    '--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-gpu',
    '--disable-extensions', '--disable-dev-shm-usage', `--user-data-dir=${profile}`, frontendUrl,
  ], { stdio: 'ignore', detached: true })
  let socket

  try {
    let page
    for (let attempt = 0; attempt < 60 && !page; attempt++) {
      await sleep(250)
      try {
        const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
        page = pages.find((item) => item.type === 'page' && item.url.startsWith(frontendUrl))
      } catch { /* Chrome is still starting. */ }
    }
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a page for the visual audit')

    socket = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
    let nextId = 1
    const pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id)
        pending.delete(message.id)
        message.error ? reject(new Error(message.error.message)) : resolve(message)
      }
    })
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.result.exceptionDetails)}`)
      return result.result.result.value
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await sleep(1200)
    await evaluate(`(() => {
      localStorage.setItem('shinpo_custom_server_url', ${JSON.stringify(backendUrl)});
      localStorage.setItem('shinpo_access_token', ${JSON.stringify(auth.accessToken)});
      localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
      localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    })()`)
    await send('Page.reload')
    let initialState = false
    for (let attempt = 0; attempt < 60 && !initialState; attempt++) {
      await sleep(250)
      initialState = await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal') || document.querySelector('[data-tab=\"Dashboard\"]'))")
    }
    if (!initialState) throw new Error('Fresh-account application shell did not become ready within 15 seconds')
    const browserApiStatus = await evaluate(`fetch(${JSON.stringify(`${backendUrl}/api/users/me`)}, { headers: { Authorization: ${JSON.stringify(`Bearer ${auth.accessToken}`)} } }).then((response) => response.status)`)
    if (browserApiStatus !== 200) throw new Error(`Browser could not reach the isolated authenticated API (HTTP ${browserApiStatus}); check the test CORS allowlist`)
    console.log('Browser authenticated API probe: HTTP 200.')

    const accountControls = await evaluate(`(() => ({
      topbarSettings: Boolean(document.querySelector('.cockpit-top-bar [aria-label="Settings"]')),
      topbarAccount: Boolean(document.querySelector('.cockpit-top-bar .profile-badge-card')),
      sidebarSettings: Boolean(document.querySelector('.icon-sidebar .sidebar-settings-btn')),
      sidebarAccount: Boolean(document.querySelector('.icon-sidebar .sidebar-profile')),
      rewards: Boolean(document.querySelector('.icon-sidebar [data-rewards="true"]')),
    }))()`)
    assert.ok(accountControls.topbarSettings && accountControls.topbarAccount && !accountControls.sidebarSettings && !accountControls.sidebarAccount && accountControls.rewards,
      `Account, Settings, and Rewards controls must occupy their single intended destinations: ${JSON.stringify(accountControls)}`)
    console.log(`Canonical navigation controls PASS: ${JSON.stringify(accountControls)}`)

    let firstLoginTour = false
    for (let attempt = 0; attempt < 40 && !firstLoginTour; attempt++) {
      await sleep(250)
      firstLoginTour = await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))")
    }
    if (firstLoginTour) {
      const tutorialTarget = await evaluate(`(() => {
        const el = document.querySelector("[data-tutorial='new-goal'], button.btn-new-goal") || document.querySelector('[data-tutorial="nav-goals"]');
        if (!el) return null;
        const style = getComputedStyle(el), rect = el.getBoundingClientRect();
        return { tag: el.tagName, text: el.innerText, rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }, visible: style.visibility === 'visible' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0, outline: style.outlineStyle, zIndex: style.zIndex };
      })()`)
      if (!tutorialTarget?.visible || tutorialTarget.outline === 'none') throw new Error(`Fresh-account walkthrough target is not visibly highlighted: ${JSON.stringify(tutorialTarget)}`)
      console.log(`First-login walkthrough target is visibly highlighted: ${JSON.stringify(tutorialTarget)}`)
      await evaluate('document.fonts.ready')
      await sleep(350)
      const initial = await send('Page.captureScreenshot', { format: 'png' })
      await writeFile(join(captures, 'first-login-tutorial.png'), Buffer.from(initial.result.data, 'base64'))
      await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
      await sleep(150)
      const skipped = await evaluate("(() => { const button = document.querySelector('#tutorial-confirm-skip-btn'); if (!button) return false; button.click(); return true })()")
      if (!skipped) throw new Error('Fresh-account walkthrough appeared but its skip confirmation control was unavailable')
      for (let attempt = 0; attempt < 30 && await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))"); attempt++) await sleep(100)
      if (await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))")) throw new Error('Walkthrough remained active after confirming skip')
      let skipState
      for (let attempt = 0; attempt < 30; attempt++) {
        skipState = await evaluate(`fetch(${JSON.stringify(`${backendUrl}/api/onboarding`)}, { headers: { Authorization: ${JSON.stringify(`Bearer ${auth.accessToken}`)} } }).then((response) => response.json())`)
        if (skipState.status === 'SKIPPED') break
        await sleep(100)
      }
      const progress = await evaluate(`fetch(${JSON.stringify(`${backendUrl}/api/progress`)}, { headers: { Authorization: ${JSON.stringify(`Bearer ${auth.accessToken}`)} } }).then((response) => response.json())`)
      if (skipState?.status !== 'SKIPPED' || progress.totalProgress !== 0 || progress.recentEvents?.length !== 0) {
        throw new Error(`Skip was not persisted truthfully (status=${skipState?.status}, XP=${progress.totalProgress}, events=${progress.recentEvents?.length})`)
      }
      console.log('Fresh-account walkthrough skipped through confirmation UI; PostgreSQL-backed API reports SKIPPED, 0 XP, 0 events.')
    } else if (process.env.SHINPO_AUDIT_USERNAME) {
      console.log('Reusing disposable account; its first-run walkthrough was already completed in a prior isolated audit.')
    } else throw new Error('Fresh disposable account did not launch the first-login walkthrough within 10 seconds of app readiness')

    await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button) => button.dataset.tab === 'Dashboard')?.click()")
    await sleep(700)
    const dashboardMotion = await evaluate(`(() => {
      const route = document.querySelector('.shinpo-dashboard');
      const header = route?.querySelector('.dashboard-header-bar');
      const firstPanel = route?.querySelector('.dashboard-metrics-grid');
      return { route: route ? 'Dashboard' : null, routeAnimation: header && getComputedStyle(header).animationName, panelAnimation: firstPanel && getComputedStyle(firstPanel).animationName };
    })()`)
    assert.equal(dashboardMotion.route, 'Dashboard', `Dashboard navigation must resolve to the Dashboard content: ${JSON.stringify(dashboardMotion)}`)
    assert.equal(dashboardMotion.routeAnimation, 'dashboardSectionReveal', `Dashboard header reveal must be present: ${JSON.stringify(dashboardMotion)}`)
    assert.equal(dashboardMotion.panelAnimation, 'dashboardSectionReveal', `Dashboard metric reveal must be present: ${JSON.stringify(dashboardMotion)}`)
    await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button) => button.dataset.tab === 'Goals & Missions')?.click()")
    await sleep(360)
    const markerAlignment = await evaluate(`(() => {
      const marker = document.querySelector('.sidebar-active-indicator')?.getBoundingClientRect();
      const active = document.querySelector('.sidebar-btn.active')?.getBoundingClientRect();
      return { route: document.querySelector('.goals-view-deck') ? document.querySelector('.sidebar-btn.active')?.dataset.tab : null, delta: marker && active ? Math.round((marker.top + marker.height / 2 - active.top - active.height / 2) * 100) / 100 : null };
    })()`)
    assert.equal(markerAlignment.route, 'Goals & Missions', `Navigation must reach the selected function: ${JSON.stringify(markerAlignment)}`)
    assert.ok(Math.abs(markerAlignment.delta) <= 1, `Active marker must align with its selected navigation row: ${JSON.stringify(markerAlignment)}`)

    const preferenceKey = `shinpo_goals_task_view_v1_${auth.user.id}`
    await evaluate("Array.from(document.querySelectorAll('.view-mode-btn')).find((button) => button.textContent.trim() === 'Board')?.click()")
    await sleep(100)
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(preferenceKey)})`), 'board', 'Selecting Board must persist for this account')
    const boardImage = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, 'task-board-before-route-changes.png'), Buffer.from(boardImage.result.data, 'base64'))
    for (const tab of ['Dashboard', 'Goals & Missions', 'AI Assistant', 'Goals & Missions']) {
      await evaluate(`Array.from(document.querySelectorAll('.sidebar-btn')).find((button) => button.dataset.tab === ${JSON.stringify(tab)})?.click()`)
      await sleep(180)
      if (tab === 'Goals & Missions') assert.equal(await evaluate("document.querySelector('.view-mode-btn.active')?.textContent.trim()"), 'Board', `Board selection must survive navigation to ${tab}`)
    }
    await evaluate("Array.from(document.querySelectorAll('.view-mode-btn')).find((button) => button.textContent.trim() === 'List')?.click()")
    await sleep(100)
    assert.equal(await evaluate(`localStorage.getItem(${JSON.stringify(preferenceKey)})`), 'list', 'Selecting List must persist for this account')
    for (const tab of ['Schedule', 'Goals & Missions']) {
      await evaluate(`Array.from(document.querySelectorAll('.sidebar-btn')).find((button) => button.dataset.tab === ${JSON.stringify(tab)})?.click()`)
      await sleep(180)
    }
    assert.equal(await evaluate("document.querySelector('.view-mode-btn.active')?.textContent.trim()"), 'List', 'List selection must survive Calendar navigation')
    await send('Page.reload')
    for (let attempt = 0; attempt < 60 && !await evaluate("Boolean(document.querySelector('[data-tab=\"Goals & Missions\"]'))"); attempt++) await sleep(250)
    await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button) => button.dataset.tab === 'Goals & Missions')?.click()")
    for (let attempt = 0; attempt < 60 && !await evaluate("Boolean(document.querySelector('.goals-view-deck'))"); attempt++) await sleep(250)
    assert.equal(await evaluate("document.querySelector('.view-mode-btn.active')?.textContent.trim()"), 'List', 'List selection must survive application reload')
    const listImage = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, 'task-list-after-reload.png'), Buffer.from(listImage.result.data, 'base64'))
    console.log('Goals & Tasks List/Board selection persisted across Dashboard, EONPAI, Calendar, and application reload.')
    await sleep(300)

    console.log('Starting sidebar pointer/focus/pin checks at 1280×800.')
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()")
    const sidebarSetup = await evaluate(`(() => {
      const sidebar = document.querySelector('.icon-sidebar');
      const toggle = sidebar?.querySelector('.sidebar-toggle-btn');
      if (!sidebar || !toggle) return null;
      if (toggle.getAttribute('aria-expanded') === 'true') toggle.click();
      return { sidebar: sidebar.getBoundingClientRect().width, mainLeft: document.querySelector('.app-main')?.getBoundingClientRect().left };
    })()`)
    assert.ok(sidebarSetup, 'Sidebar controls must be present before testing expansion')
    console.log(`Sidebar baseline: ${JSON.stringify(sidebarSetup)}`)
    await sleep(250)
    assert.ok(sidebarSetup.sidebar <= 90, `Fresh audit sidebar should collapse before temporary expansion: ${JSON.stringify(sidebarSetup)}`)
    const navPoint = await evaluate(`(() => { const r = document.querySelector('.sidebar-btn')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`)
    assert.ok(navPoint, 'Collapsed navigation item must have a pointer target')
    const appRenderBaseline = await evaluate('window.__SHINPO_RENDER_COUNTS?.App ?? 0')
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...navPoint })
    await sleep(360)
    const hoverExpansion = await evaluate(`(() => ({
      expanded: document.querySelector('.icon-sidebar')?.classList.contains('expanded'),
      width: document.querySelector('.icon-sidebar')?.getBoundingClientRect().width,
      mainLeft: document.querySelector('.app-main')?.getBoundingClientRect().left,
      appRenders: window.__SHINPO_RENDER_COUNTS?.App ?? 0,
    }))()`)
    assert.ok(hoverExpansion.expanded && hoverExpansion.width >= 240, `Pointer hover must reveal the expanded rail: ${JSON.stringify(hoverExpansion)}`)
    assert.ok(Math.abs(hoverExpansion.mainLeft - hoverExpansion.width - 32) <= 1, `Desktop expansion must preserve the existing 32px content gutter beside the rail: ${JSON.stringify(hoverExpansion)}`)
    assert.equal(hoverExpansion.appRenders, appRenderBaseline, 'Sidebar hover must not rerender the application root')
    console.log(`Sidebar hover result: ${JSON.stringify(hoverExpansion)}`)
    const expandedCapture = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, 'sidebar-hover-expanded-dark.png'), Buffer.from(expandedCapture.result.data, 'base64'))
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 400 })
    await sleep(360)
    assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), false, 'Temporary hover expansion must collapse after the pointer exits')

    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...navPoint })
    await sleep(360)
    const expandedNavPoint = await evaluate(`(() => { const r = document.querySelector('.sidebar-btn[data-tab="Goals & Missions"]')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`)
    assert.ok(expandedNavPoint, 'Expanded navigation item must retain its hit target')
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...expandedNavPoint, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...expandedNavPoint, button: 'left', buttons: 0, clickCount: 1 })
    await sleep(80)
    const pointerFocusedTab = await evaluate('document.activeElement?.getAttribute(\'data-tab\')')
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 400 })
    await sleep(360)
    assert.ok(pointerFocusedTab, 'Pointer navigation should leave the selected control keyboard-focusable')
    assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), false, 'Pointer-click focus must not keep the temporary sidebar stuck open')
    assert.equal(await evaluate('document.activeElement?.getAttribute(\'data-tab\')'), pointerFocusedTab, 'Pointer collapse must preserve the focused navigation control')

    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' })
    await evaluate("document.querySelector('.sidebar-btn')?.focus()")
    await sleep(80)
    assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), true, 'Keyboard focus must reveal navigation labels')
    const focusedNav = await evaluate('document.activeElement?.getAttribute(\'data-tab\')')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' })
    await sleep(80)
    assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), false, 'Escape must dismiss temporary expansion')
    assert.equal(await evaluate('document.activeElement?.getAttribute(\'data-tab\')'), focusedNav, 'Dismissal must retain keyboard focus on its navigation item')
    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()")
    await sleep(250)

    await evaluate("document.querySelector('.sidebar-toggle-btn')?.click()")
    await sleep(360)
    const pinnedSidebar = await evaluate(`({
      expanded: document.querySelector('.sidebar-toggle-btn')?.getAttribute('aria-expanded'),
      width: document.querySelector('.icon-sidebar')?.getBoundingClientRect().width,
      mainLeft: document.querySelector('.app-main')?.getBoundingClientRect().left,
      preference: localStorage.getItem('shinpo_sidebar_pinned'),
    })`)
    assert.equal(pinnedSidebar.expanded, 'true', `Pin must retain expanded layout: ${JSON.stringify(pinnedSidebar)}`)
    assert.equal(pinnedSidebar.preference, 'true', 'Pin state must persist')
    assert.ok(Math.abs(pinnedSidebar.mainLeft - pinnedSidebar.width - 32) <= 1, `Pinned desktop rail must preserve the existing 32px content gutter: ${JSON.stringify(pinnedSidebar)}`)
    await evaluate("document.querySelector('.sidebar-toggle-btn')?.click()")
    await sleep(360)

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
    await sleep(280)
    const narrowLayout = await evaluate(`(() => ({
      innerWidth,
      documentWidth: document.documentElement.clientWidth,
      mobileBreakpoint: matchMedia('(max-width: 768px)').matches,
      sidebarDisplay: getComputedStyle(document.querySelector('.icon-sidebar')).display,
      mobileNavigationDisplay: getComputedStyle(document.querySelector('.mobile-nav-toggle')).display,
      mainLeft: document.querySelector('.app-main')?.getBoundingClientRect().left,
      mainMarginLeft: getComputedStyle(document.querySelector('.app-main')).marginLeft,
      topbarWithinViewport: document.querySelector('.cockpit-top-bar')?.getBoundingClientRect().right <= innerWidth,
    }))()`)
    assert.equal(narrowLayout.sidebarDisplay, 'none', `The current narrow phone-width layout intentionally hides desktop navigation: ${JSON.stringify(narrowLayout)}`)
    assert.notEqual(narrowLayout.mobileNavigationDisplay, 'none', `Narrow windows need an accessible replacement for the hidden desktop rail: ${JSON.stringify(narrowLayout)}`)
    assert.equal(narrowLayout.mainLeft, 0, `Narrow content must use the available width: ${JSON.stringify(narrowLayout)}`)
    await evaluate("document.querySelector('.mobile-nav-toggle')?.click()")
    await sleep(100)
    const mobileNavCount = await evaluate("document.querySelectorAll('#mobile-navigation-panel [data-mobile-nav-tab]').length")
    assert.equal(mobileNavCount, 8, `The narrow navigation menu must expose all app destinations; found ${mobileNavCount}`)
    await evaluate("document.querySelector('[data-mobile-nav-tab=\"Schedule\"]')?.click()")
    await sleep(300)
    assert.equal(await evaluate("document.querySelector('.sidebar-btn[data-tab=\"Schedule\"]')?.classList.contains('active')"), true, 'Narrow navigation must reach Calendar')
    await evaluate("document.querySelector('.mobile-nav-toggle')?.click()")
    await sleep(80)
    await evaluate("document.querySelector('[data-mobile-nav-tab=\"Dashboard\"]')?.click()")
    await sleep(300)
    assert.equal(await evaluate("document.querySelector('.sidebar-btn[data-tab=\"Dashboard\"]')?.classList.contains('active')"), true, 'Narrow navigation must return to Dashboard')
    await evaluate(`(() => { document.documentElement.dataset.theme = 'light'; for (const el of [document.documentElement, document.body, document.querySelector('.app-shell')].filter(Boolean)) el.classList.add('theme-light'); })()`)
    await sleep(350)
    await evaluate("document.querySelectorAll('.shinpo-toast-dismiss').forEach((button) => button.click())")
    await sleep(100)
    const compactCapture = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, 'narrow-390-light.png'), Buffer.from(compactCapture.result.data, 'base64'))
    console.log('390px layout geometry and menu-based navigation to Calendar and Dashboard verified.')
    await evaluate(`(() => { document.documentElement.dataset.theme = 'dark'; for (const el of [document.documentElement, document.body, document.querySelector('.app-shell')].filter(Boolean)) el.classList.remove('theme-light'); })()`)
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    const reducedMotionDuration = await evaluate("getComputedStyle(document.querySelector('.icon-sidebar')).transitionDuration")
    assert.ok(reducedMotionDuration.split(',').every((duration) => Number.parseFloat(duration) <= 0.001), `Reduced-motion preference must remove sidebar movement: ${reducedMotionDuration}`)
    await send('Emulation.setEmulatedMedia', { features: [] })
    await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur()")
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 400 })
    await sleep(270)
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(250)
    const desktopNavPoint = await evaluate(`(() => { const r = document.querySelector('.sidebar-btn')?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`)
    const cycleDurations = []
    for (let cycle = 0; cycle < 50; cycle++) {
      const startedAt = performance.now()
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...desktopNavPoint })
      await sleep(100)
      assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), true, `Sidebar failed to open on hover cycle ${cycle + 1}`)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 520, y: 400 })
      await sleep(235)
      assert.equal(await evaluate("document.querySelector('.icon-sidebar')?.classList.contains('expanded')"), false, `Sidebar remained open after hover cycle ${cycle + 1}`)
      cycleDurations.push(performance.now() - startedAt)
    }
    cycleDurations.sort((a, b) => a - b)
    const cycleP95 = Math.round(cycleDurations[Math.ceil(cycleDurations.length * 0.95) - 1])
    const finalAppRenders = await evaluate('window.__SHINPO_RENDER_COUNTS?.App ?? 0')
    console.log(`Sidebar interactions PASS: immediate hover did not rerender App (${appRenderBaseline}), hover exit after pointer-focused navigation, keyboard focus/Escape, persistent pin, compact viewport, reduced motion; 50/50 hover cycles, p95 ${cycleP95}ms including 220ms exit grace. App render count after the 13s cycle batch: ${finalAppRenders} (includes independent 6s protection-status polling). Captures: ${captures}/sidebar-hover-expanded-dark.png and ${captures}/sidebar-keyboard-expanded-light-390.png`)

    const results = []
    for (const viewport of viewports) {
      await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 600 })
      for (const theme of ['dark', 'light']) for (const view of views) {
        const selected = await evaluate(`(() => {
          const button = document.querySelector('[data-tab="${view}"]');
          if (!button) return false;
          button.click();
          const light = ${theme === 'light'};
          for (const el of [document.documentElement, document.body, document.querySelector('.app-shell')].filter(Boolean)) el.classList.toggle('theme-light', light);
          document.documentElement.dataset.theme = light ? 'light' : 'dark';
          return true;
        })()`)
        if (!selected) throw new Error(`Navigation control missing for ${view}`)
        await evaluate('window.scrollTo(0, 0)')
        await sleep(300)
        if (view === 'Dashboard') {
          const insights = await evaluate(`(() => ({
            count: document.querySelectorAll('.dashboard-insight-card').length,
            headings: [...document.querySelectorAll('.dashboard-insight-card h2')].map((heading) => heading.textContent.trim()),
          }))()`)
          assert.deepEqual(insights.headings, ['Focus activity', 'Goal progress'], `Dashboard must render real activity and goal progress widgets: ${JSON.stringify(insights)}`)
        }
        const scan = await evaluate(`(() => {
          const visible = (el) => {
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            for (let parent = el; parent && parent !== document.body; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            }
            return true;
          };
          const norm = (value) => value.replace(/\\s+/g, ' ').trim().slice(0, 72);
          const paintedRect = (rect, node) => {
            const clipped = { left: Math.max(0, rect.left), top: Math.max(0, rect.top), right: Math.min(innerWidth, rect.right), bottom: Math.min(innerHeight, rect.bottom) };
            for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
              const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
              if (style.overflowX !== 'visible') { clipped.left = Math.max(clipped.left, bounds.left + parent.clientLeft); clipped.right = Math.min(clipped.right, bounds.left + parent.clientLeft + parent.clientWidth); }
              if (style.overflowY !== 'visible') { clipped.top = Math.max(clipped.top, bounds.top + parent.clientTop); clipped.bottom = Math.min(clipped.bottom, bounds.top + parent.clientTop + parent.clientHeight); }
            }
            const area = Math.max(0, clipped.right - clipped.left) * Math.max(0, clipped.bottom - clipped.top);
            const fullArea = rect.width * rect.height;
            if (!area || area / fullArea < .85) return null;
            const hit = document.elementFromPoint((clipped.left + clipped.right) / 2, (clipped.top + clipped.bottom) / 2);
            if (hit && !node.parentElement.contains(hit) && !hit.contains(node.parentElement)) return null;
            return clipped;
          };
          const textRects = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!norm(node.nodeValue || '') || !node.parentElement || !visible(node.parentElement)) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) {
              const painted = rect.width && rect.height ? paintedRect(rect, node) : null;
              if (painted) textRects.push({
                x: painted.left, y: painted.top, right: painted.right, bottom: painted.bottom,
                text: norm(node.nodeValue), tag: node.parentElement.tagName.toLowerCase(),
                parent: node.parentElement.parentElement, node,
              });
            }
          }
          textRects.sort((a, b) => a.y - b.y || a.x - b.x);
          const textOverlaps = [];
          const textBoxesOverlap = ${textBoxesOverlap.toString()};
          for (let i = 0; i < textRects.length; i++) {
            const a = textRects[i];
            for (let j = i + 1; j < textRects.length && textRects[j].y < a.bottom - 2; j++) {
              const b = textRects[j];
              if (a.node !== b.node && textBoxesOverlap(a, b)) {
                textOverlaps.push({ first: a.text, second: b.text, at: [Math.round(Math.max(a.x, b.x)), Math.round(Math.max(a.y, b.y))], firstParent: String(a.node.parentElement.className || a.tag).slice(0, 60), secondParent: String(b.node.parentElement.className || b.tag).slice(0, 60) });
              }
            }
          }
          const cardSelector = '[class*="card"], [class*="panel"], [class*="metric"]';
          const cards = Array.from(document.querySelectorAll(cardSelector)).filter(visible).filter((el) =>
            !el.closest('.modal-overlay, [role="dialog"]') && !el.parentElement.closest(cardSelector));
          const cardOverlaps = [];
          for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
            const a = cards[i], b = cards[j];
            if (a.parentElement !== b.parentElement) continue;
            const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            const width = Math.max(0, Math.min(ar.right, br.right) - Math.max(ar.left, br.left));
            const height = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
            if (width * height > 16) cardOverlaps.push({
              first: String(a.className).slice(0, 60), second: String(b.className).slice(0, 60),
            });
          }
          const clippedControls = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"]'))
            .filter(visible).flatMap((el) => {
              const rect = el.getBoundingClientRect();
              let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
              let horizontallyScrollable = false;
              for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
                const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
                if (style.overflowX === 'auto' || style.overflowX === 'scroll') horizontallyScrollable = true;
                if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
                  left = Math.max(left, bounds.left + parent.clientLeft);
                  right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
                }
              }
              return !horizontallyScrollable && right - left < rect.width - 2
                ? [{ control: norm(el.innerText || el.getAttribute('aria-label') || el.title || el.tagName), clippedWidth: Math.round(rect.width - Math.max(0, right - left)) }]
                : [];
            }).slice(0, 12);
          const title = document.querySelector('.sidebar-btn.active')?.getAttribute('data-tab') || 'unknown';
          return {
            title,
            theme: '${theme}',
            viewport: { width: innerWidth, height: innerHeight },
            horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
            textOverlaps: textOverlaps.slice(0, 20),
            cardOverlaps: cardOverlaps.slice(0, 20),
            clippedControls,
          };
        })()`)
        let calendarScroll = view !== 'Schedule' || viewport.height > 900
        if (!calendarScroll && view === 'Schedule') {
          const target = await evaluate(`(() => {
            const calendar = document.querySelector('.schedule-calendar-scroll');
            if (!calendar) return null;
            window.scrollTo({ top: 0, behavior: 'instant' });
            calendar.scrollTop = 0;
            calendar.scrollIntoView({ block: 'center', behavior: 'instant' });
            const rect = calendar.getBoundingClientRect();
            return {
              x: rect.left + rect.width / 2,
              y: rect.top + Math.min(rect.height - 12, Math.max(12, rect.height / 2)),
              pageStart: document.scrollingElement?.scrollTop ?? 0,
              verticalRange: calendar.scrollHeight - calendar.clientHeight,
            };
          })()`)
          if (target) {
            await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: target.x, y: target.y, deltaX: 0, deltaY: 160 })
            await sleep(150)
            calendarScroll = await evaluate(`(() => {
              const calendar = document.querySelector('.schedule-calendar-scroll');
              return calendar && document.scrollingElement.scrollTop > ${target.pageStart + 20}
                && calendar.scrollTop === 0 && calendar.scrollHeight - calendar.clientHeight <= 2;
            })()`)
          }
        }
        results.push({ route: view, ...scan, calendarScroll })
        console.log(`${scan.textOverlaps.length || scan.cardOverlaps.length || scan.clippedControls.length || scan.horizontalOverflow || !calendarScroll ? 'FAIL' : 'PASS'} ${theme} ${view} ${viewport.width}x${viewport.height}: text=${scan.textOverlaps.length}, cards=${scan.cardOverlaps.length}, clippedControls=${scan.clippedControls.length}, horizontalOverflow=${scan.horizontalOverflow}${view === 'Schedule' && viewport.height <= 900 ? `, calendarScroll=${calendarScroll}` : ''}`)
        if (process.env.SHINPO_AUDIT_CAPTURE_ALL === '1' || scan.textOverlaps.length || scan.cardOverlaps.length || scan.clippedControls.length || scan.horizontalOverflow || !calendarScroll) {
          const overlapY = scan.textOverlaps[0]?.at[1] || 0
          await evaluate(`window.scrollTo(0, Math.max(0, ${overlapY} - innerHeight / 2))`)
          await sleep(100)
          const image = await send('Page.captureScreenshot', { format: 'png' })
          await writeFile(join(captures, `${theme}-${view.replaceAll(' ', '_')}-${viewport.width}.png`), Buffer.from(image.result.data, 'base64'))
        }
        if (view === 'Dashboard' && theme === 'light' && viewport.width === 1280 && process.env.SHINPO_AUDIT_CAPTURE_ALL === '1') {
          await evaluate(`(() => {
            const grid = document.querySelector('.dashboard-insight-grid');
            if (!grid) return false;
            document.scrollingElement.scrollTop = Math.max(0, grid.getBoundingClientRect().top + document.scrollingElement.scrollTop - 90);
            return true;
          })()`)
          await sleep(80)
          const image = await send('Page.captureScreenshot', { format: 'png' })
          await writeFile(join(captures, 'dashboard-insights-light-1280.png'), Buffer.from(image.result.data, 'base64'))
          await evaluate('window.scrollTo({ top: 0, behavior: \'instant\' })')
        }
      }
    }

    const failures = results.filter((result) => result.textOverlaps.length || result.cardOverlaps.length || result.clippedControls.length || result.horizontalOverflow || !result.calendarScroll)
    if (failures.length) console.log(`Failure screenshots: ${captures}`)
    if (failures.length) {
      console.error(JSON.stringify(failures, null, 2))
      process.exitCode = 1
    }
    console.log(`Rendered UI audit: ${results.length - failures.length}/${results.length} route/viewport/theme combinations clear.`)
  } finally {
    socket?.close()
    try { process.kill(-chrome.pid, 'SIGTERM') } catch { /* Browser already exited. */ }
    await sleep(400)
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
