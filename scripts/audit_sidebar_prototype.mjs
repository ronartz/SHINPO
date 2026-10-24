import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const appUrl = new URL(process.env.SHINPO_URL ?? 'http://localhost:5173')
const apiUrl = new URL(process.env.SHINPO_API_URL ?? 'http://127.0.0.1:18080')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname), 'QA API must be loopback-only')
assert.notEqual(apiUrl.port, '8080', 'Refusing to write audit users to the personal development API')

const username = `sidebar_qa_${Date.now()}`
const registration = await fetch(new URL('/api/auth/register', apiUrl), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, email: `${username}@shinpo.local`, password: 'Password123!' }),
})
assert.ok(registration.ok, `Disposable QA registration failed: HTTP ${registration.status}`)
const auth = await registration.json()
const profile = await mkdtemp(join(tmpdir(), 'shinpo-sidebar-browser-'))
const captures = await mkdtemp(join(tmpdir(), 'shinpo-sidebar-captures-'))
const framesDir = join(captures, 'opening-selection-collapse-frames')
await mkdir(framesDir)
const port = 9418
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-extensions',
  '--disable-dev-shm-usage', `--user-data-dir=${profile}`, appUrl.toString(),
], { stdio: 'ignore', detached: true })
let socket
let pendingFrameWrites = []
let capturedFrame = 0
const frameTimestamps = []
const browserErrors = []

try {
  let page
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(250)
    try {
      page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()))
        .find((item) => item.type === 'page' && item.url.startsWith(appUrl.origin))
    } catch { /* Chrome is starting. */ }
  }
  assert.ok(page?.webSocketDebuggerUrl, 'Headless Chrome page did not start')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') browserErrors.push(message.params.entry.text)
    if (message.method === 'Page.screencastFrame') {
      const frame = capturedFrame++
      frameTimestamps.push(message.params.metadata.timestamp)
      pendingFrameWrites.push(writeFile(join(framesDir, `frame-${String(frame).padStart(4, '0')}.png`), Buffer.from(message.params.data, 'base64')))
      socket.send(JSON.stringify({ id: nextId++, method: 'Page.screencastFrameAck', params: { sessionId: message.params.sessionId } }))
    }
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
    assert.ok(!result.result.exceptionDetails, `Browser evaluation failed: ${result.result.exceptionDetails?.text}`)
    return result.result.result.value
  }
  const screenshot = async (name) => {
    const result = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(captures, `${name}.png`), Buffer.from(result.result.data, 'base64'))
  }
  const pointer = async (point) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
  const pointFor = (selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`)
  const mouseClick = async (point) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 })
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(700)
  await evaluate(`(() => {
    localStorage.setItem('shinpo_custom_server_url', ${JSON.stringify(apiUrl.origin)});
    localStorage.setItem('shinpo_access_token', ${JSON.stringify(auth.accessToken)});
    localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
    localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    localStorage.setItem('shinpo_sidebar_pinned', 'false');
  })()`)
  await send('Page.reload')
  let tutorialReady = false
  for (let i = 0; i < 60 && !tutorialReady; i++) {
    await sleep(250)
    tutorialReady = await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))")
  }
  assert.ok(tutorialReady, 'Fresh account tutorial did not open')
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))")
  await sleep(120)
  assert.equal(await evaluate("Boolean(document.querySelector('#tutorial-confirm-skip-btn'))"), true, 'Tutorial escape should request skip confirmation')
  await evaluate("document.querySelector('#tutorial-confirm-skip-btn').click()")
  for (let i = 0; i < 60 && await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))"); i++) await sleep(100)
  assert.equal(await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))"), false, 'Tutorial skip did not close')
  const onboarding = await evaluate(`fetch(${JSON.stringify(new URL('/api/onboarding', apiUrl).toString())}, { headers: { Authorization: ${JSON.stringify(`Bearer ${auth.accessToken}`)} } }).then(r => r.json())`)
  assert.equal(onboarding.status, 'SKIPPED', 'Fresh-account tutorial skip must persist in disposable PostgreSQL')
  assert.equal(await evaluate("Boolean(document.querySelector('.app-main') && document.querySelector('.sidebar-btn'))"), true, 'Application shell did not render')
  await evaluate("document.querySelector('.sidebar-btn[data-tab=\"Dashboard\"]')?.click()")
  await sleep(250)
  assert.equal(await evaluate("document.querySelector('.sidebar-btn.active')?.dataset.tab"), 'Dashboard', 'Dashboard beside the sidebar must navigate to the real Dashboard')

  const initial = await evaluate(`(() => ({
    viewport: [innerWidth, innerHeight],
    sidebarWidth: document.querySelector('.icon-sidebar').getBoundingClientRect().width,
    mainLeft: document.querySelector('.app-main').getBoundingClientRect().left,
    dashboardVisible: document.body.innerText.includes('Good evening,')
  }))()`)
  assert.ok(initial.sidebarWidth <= 90, `Sidebar did not initialize collapsed: ${JSON.stringify(initial)}`)
  assert.ok(initial.mainLeft >= initial.sidebarWidth, `Dashboard is obscured by the rail: ${JSON.stringify(initial)}`)
  await screenshot('01-collapsed-sidebar-dashboard')

  const firstNav = await pointFor('.sidebar-btn[data-tab="Dashboard"]')
  assert.ok(firstNav, 'Collapsed navigation item missing')
  const appRenderBaseline = await evaluate('window.__SHINPO_RENDER_COUNTS?.App ?? 0')
  await send('Page.startScreencast', { format: 'png', maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 })
  const motionMarks = {}
  const mark = (name) => { motionMarks[name] = { frame: capturedFrame, timestamp: frameTimestamps.at(-1) ?? null } }
  mark('opening-start')
  await pointer(firstNav)
  await sleep(430)
  mark('opening-end')
  const expanded = await evaluate(`(() => ({
    expanded: document.querySelector('.icon-sidebar').classList.contains('expanded'),
    width: document.querySelector('.icon-sidebar').getBoundingClientRect().width,
    mainLeft: document.querySelector('.app-main').getBoundingClientRect().left,
    labelOpacity: getComputedStyle(document.querySelector('.sidebar-btn-label')).opacity,
    labelVisible: getComputedStyle(document.querySelector('.sidebar-btn-label')).display !== 'none'
  }))()`)
  assert.ok(expanded.expanded && expanded.width >= 240, `Hover expansion failed: ${JSON.stringify(expanded)}`)
  assert.ok(Math.abs(expanded.width - expanded.mainLeft) <= 1, `Desktop content did not move with sidebar: ${JSON.stringify(expanded)}`)
  const appRenderAfterHover = await evaluate('window.__SHINPO_RENDER_COUNTS?.App ?? 0')
  assert.equal(appRenderAfterHover, appRenderBaseline, 'Sidebar hover must not rerender the application root')
  assert.equal(expanded.labelVisible, true, 'Expanded navigation labels must be rendered')
  assert.ok(Number(expanded.labelOpacity) > 0.95, `Expanded labels did not finish revealing: ${JSON.stringify(expanded)}`)
  await screenshot('02-expanded-sidebar-dashboard')

  const goalPoint = await pointFor('.sidebar-btn[data-tab="Goals & Missions"]')
  assert.ok(goalPoint, 'Expanded Goals navigation item missing')
  mark('selection-start')
  await pointer(goalPoint)
  await mouseClick(goalPoint)
  await sleep(280)
  mark('selection-end')
  const selected = await evaluate(`(() => {
    const marker = document.querySelector('.sidebar-active-indicator').getBoundingClientRect();
    const active = document.querySelector('.sidebar-btn.active');
    const row = active.getBoundingClientRect();
    return { selected: active.dataset.tab, centerDelta: Math.round((marker.top + marker.height / 2 - row.top - row.height / 2) * 100) / 100 };
  })()`)
  assert.equal(selected.selected, 'Goals & Missions', `Navigation did not select Goals: ${JSON.stringify(selected)}`)
  assert.ok(Math.abs(selected.centerDelta) <= 1, `Animated marker is not aligned with selection: ${JSON.stringify(selected)}`)
  await screenshot('03-selection-marker-goals')

  const rapidNavigationChecks = []
  const expectedHeaders = {
    'Focus Engine': 'Focus Sprint Arena', Schedule: 'Calendar Schedule',
    'Task Manager': 'Focus Protection Sentinel', Analytics: 'Performance Analytics',
    'AI Assistant': 'EONPAI Cognitive Guide', Dashboard: 'Execution Cockpit', 'Goals & Missions': 'Goals & Tasks',
  }
  for (const tab of Object.keys(expectedHeaders)) {
    const target = await pointFor(`.sidebar-btn[data-tab="${tab}"]`)
    assert.ok(target, `Navigation item missing during rapid switching: ${tab}`)
    await mouseClick(target)
    await sleep(65)
    const activeTab = await evaluate("document.querySelector('.sidebar-btn.active')?.dataset.tab")
    assert.equal(activeTab, tab, `Rapid navigation lost or misrouted ${tab}`)
    const header = await evaluate("document.querySelector('.page-header-info')?.innerText.trim()")
    assert.ok(header?.includes(expectedHeaders[tab]), `Navigation did not load the correct page title for ${tab}: ${header}`)
    rapidNavigationChecks.push(activeTab)
  }

  mark('collapse-start')
  await pointer({ x: 620, y: 420 })
  await sleep(420)
  mark('collapse-end')
  const collapsedAfterPointer = await evaluate(`(() => ({
    expanded: document.querySelector('.icon-sidebar').classList.contains('expanded'),
    active: document.querySelector('.sidebar-btn.active')?.dataset.tab,
    focused: document.activeElement?.dataset.tab
  }))()`)
  assert.equal(collapsedAfterPointer.expanded, false, 'Pointer focus must not pin the temporary expansion')
  assert.equal(collapsedAfterPointer.active, 'Goals & Missions', 'Pointer exit lost selected navigation')
  assert.equal(collapsedAfterPointer.focused, 'Goals & Missions', 'Pointer exit must keep the link keyboard-focusable')
  await screenshot('04-collapsed-after-pointer-selection')

  await evaluate("document.activeElement instanceof HTMLElement && document.activeElement.blur(); document.body.focus()")
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' })
  await sleep(120)
  const keyboardExpanded = await evaluate("document.querySelector('.icon-sidebar').classList.contains('expanded')")
  assert.equal(keyboardExpanded, true, 'Keyboard focus into navigation must reveal labels')
  const keyboardFocus = await evaluate('document.activeElement?.className')
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' })
  await sleep(100)
  assert.equal(await evaluate("document.querySelector('.icon-sidebar').classList.contains('expanded')"), false, 'Escape must dismiss temporary keyboard expansion')
  assert.equal(await evaluate('document.activeElement?.className'), keyboardFocus, 'Escape must preserve keyboard focus')

  await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 768, deviceScaleFactor: 1, mobile: false })
  await sleep(100)
  const narrowNav = await pointFor('.sidebar-btn[data-tab="Goals & Missions"]')
  await pointer(narrowNav)
  await sleep(420)
  const narrow = await evaluate(`(() => ({
    className: document.querySelector('.icon-sidebar').className,
    expanded: document.querySelector('.icon-sidebar').classList.contains('expanded'),
    width: document.querySelector('.icon-sidebar').getBoundingClientRect().width,
    mainLeft: document.querySelector('.app-main').getBoundingClientRect().left,
    declaredWidth: getComputedStyle(document.querySelector('.icon-sidebar')).width,
    labelDisplay: getComputedStyle(document.querySelector('.sidebar-btn-label')).display,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth
  }))()`)
  assert.ok(narrow.width >= 240, `Narrow desktop hover must remain usable as an overlay: ${JSON.stringify(narrow)}`)
  assert.ok(narrow.mainLeft < narrow.width, `Narrow desktop should retain its workspace without a forced reflow: ${JSON.stringify(narrow)}`)
  assert.notEqual(narrow.labelDisplay, 'none', `Narrow desktop labels are clipped by a collapsed-only rule: ${JSON.stringify(narrow)}`)
  assert.equal(narrow.horizontalOverflow, false, `Narrow desktop has horizontal page overflow: ${JSON.stringify(narrow)}`)
  await screenshot('05-narrow-desktop-hover-overlay')

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(100)
  for (let i = 0; i < 8; i++) {
    await pointer(firstNav)
    await sleep(80)
    await pointer({ x: 620, y: 420 })
    await sleep(80)
  }
  await sleep(400)
  const interruptedState = await evaluate(`(() => ({
    className: document.querySelector('.icon-sidebar').className,
    expanded: document.querySelector('.icon-sidebar').classList.contains('expanded'),
    pinned: document.querySelector('.sidebar-toggle-btn')?.getAttribute('aria-expanded'),
    active: document.querySelector('.sidebar-btn.active')?.dataset.tab,
    focused: document.activeElement?.className,
    width: document.querySelector('.icon-sidebar').getBoundingClientRect().width
  }))()`)
  assert.equal(interruptedState.expanded, false, `Repeated interrupted transitions must settle collapsed: ${JSON.stringify(interruptedState)}`)
  await send('Page.stopScreencast')
  await Promise.all(pendingFrameWrites)
  pendingFrameWrites = []

  const intervals = frameTimestamps.slice(1).map((time, i) => (time - frameTimestamps[i]) * 1000).filter((time) => time > 0)
  const sortedIntervals = [...intervals].sort((a, b) => a - b)
  const percentile95 = sortedIntervals.length ? sortedIntervals[Math.ceil(sortedIntervals.length * 0.95) - 1] : null
  const medianInterval = sortedIntervals.length ? sortedIntervals[Math.floor(sortedIntervals.length / 2)] : null

  const summary = {
    appUrl: appUrl.origin,
    viewport: initial.viewport,
    freshAccount: username,
    onboarding: onboarding.status,
    desktop: { collapsed: initial, expanded, selected, pointerCollapse: collapsedAfterPointer },
    appRenderCount: { beforeHover: appRenderBaseline, afterHover: appRenderAfterHover },
    rapidNavigationChecks,
    keyboard: { expanded: keyboardExpanded, focusPreservedOnEscape: true },
    narrowDesktop: narrow,
    repeatedInterruptions: 8,
    screencastFrames: capturedFrame,
    motionMarks,
    screencastFrameIntervalMs: { median: medianInterval, p95: percentile95 },
    browserErrors: [...new Set(browserErrors)],
    captures,
    framesDir,
  }
  await writeFile(join(captures, 'screencast-frame-times.json'), JSON.stringify(frameTimestamps, null, 2))
  await writeFile(join(captures, 'verification.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close()
  chrome.kill('SIGTERM')
  await sleep(200)
  await rm(profile, { recursive: true, force: true })
}
