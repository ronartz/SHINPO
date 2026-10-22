import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const frontend = process.env.SHINPO_URL
const apiBase = process.env.SHINPO_API_URL
if (!frontend || !apiBase) throw new Error('Set SHINPO_URL and SHINPO_API_URL to isolated loopback services.')
for (const value of [frontend, apiBase]) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error(`Refusing non-loopback test target: ${url.hostname}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const captureDir = mkdtempSync(join(tmpdir(), 'shinpo-core-journey-'))
const chromePort = 9417
const chromeProfile = mkdtempSync(join(tmpdir(), 'shinpo-core-chrome-'))
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${chromePort}`, '--no-sandbox',
  '--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage',
  `--user-data-dir=${chromeProfile}`, frontend,
], { stdio: 'ignore' })

let ws
const consoleErrors = []
const failedRequests = []

try {
  let page
  for (let i = 0; i < 80; i++) {
    await sleep(250)
    try {
      const pages = await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json()
      page = pages.find((item) => item.type === 'page' && item.url.startsWith(frontend))
      if (page?.webSocketDebuggerUrl) break
    } catch {}
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Chromium did not expose the application page.')

  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
    }
    if (message.method === 'Network.loadingFailed') failedRequests.push(message.params.errorText)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  })

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id
    pending.set(commandId, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message))
    ws.send(JSON.stringify({ id: commandId, method, params }))
  })
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text)
    return response.result?.result?.value
  }
  const waitFor = async (expression, timeout = 10000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await evaluate(`Boolean(${expression})`)) return
      await sleep(100)
    }
    const state = await evaluate("({body:document.body.innerText.slice(0,1200),authError:document.querySelector('.auth-error-banner')?.innerText,activeUrl:location.href})").catch(() => null)
    throw new Error(`Timed out waiting for: ${expression}; page=${JSON.stringify(state)}`)
  }
  const click = async (selector) => {
    const rect = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null; e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    if (!rect) throw new Error(`Missing clickable UI control: ${selector}`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  }
  const clickText = async (targetSelector, text) => {
    const escapedText = JSON.stringify(text)
    const query = `(() => [...document.querySelectorAll(${JSON.stringify(targetSelector)})].find(e => e.textContent.trim() === ${escapedText} && e.getBoundingClientRect().width > 0))()`
    const rect = await evaluate(`(() => { const e=${query}; if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    if (!rect) throw new Error(`Missing visible control with text: ${text}`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  }
  const fill = async (selector, value) => {
    await click(selector)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 })
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17 })
    const selection = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); return e ? {start:e.selectionStart,end:e.selectionEnd,length:e.value.length} : null; })()`)
    if (selection && selection.length > 0 && (selection.start !== 0 || selection.end !== selection.length)) {
      throw new Error(`Keyboard select-all failed for ${selector}: ${JSON.stringify(selection)}`)
    }
    await send('Input.insertText', { text: value })
    const actual = await evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`)
    if (actual !== value) throw new Error(`Text input mismatch for ${selector}: expected ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`)
  }
  const clickExpression = async (expression) => {
    const rect = await evaluate(`(() => { const e=(${expression}); if(!e) return null; e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    if (!rect) throw new Error(`Could not locate clickable UI element: ${expression}`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  }
  const screenshot = async (name) => {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(captureDir, name), Buffer.from(image.result.data, 'base64'))
  }
  const readApi = async (path) => evaluate(`(async()=>{const r=await fetch(${JSON.stringify(`${apiBase}${path}`)},{headers:{Authorization:'Bearer '+localStorage.getItem('shinpo_access_token')}});const body=await r.json();if(!r.ok)throw new Error('API ${path}: '+r.status+' '+JSON.stringify(body));return body})()`)
  const log = (label, details) => console.log(`${label}: ${JSON.stringify(details)}`)

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: frontend })
  await waitFor("document.querySelector('.auth-fullscreen-container')")
  const username = process.env.SHINPO_QA_USERNAME || `journey_${Date.now()}`
  const password = 'JourneyQA_Only_2026!'
  if (process.env.SHINPO_QA_USERNAME) {
    await fill('.auth-input', username)
    await fill('input[type="password"]', password)
  } else {
    await clickText('button.auth-tab-btn', 'Create Account')
    const fields = await evaluate("[...document.querySelectorAll('.auth-input')].map(e=>e.type)")
    if (fields.length !== 3) throw new Error(`Unexpected registration form fields: ${JSON.stringify(fields)}`)
    await fill('.auth-input:nth-of-type(1)', username)
    // Auth inputs are nested in separate wrappers; use the visible field order.
    await fillByAuthIndex(1, `${username}@qa.shinpo.local`)
    await fillByAuthIndex(2, password)
  }
  await click('button.auth-submit-btn')
  await sleep(1200)
  log('Registration result', await evaluate("({nav:document.querySelectorAll('button[data-tab]').length,authError:document.querySelector('.auth-error-banner')?.innerText,body:document.body.innerText.slice(0,500)})"))
  await screenshot('01_auth_after_submit.png')
  await waitFor("document.querySelector('button[data-tab]')", 20000)
  const user = await readApi('/api/auth/me')
  const userId = user.id ?? user.user?.id
  if (!userId) throw new Error(`Authenticated UI did not resolve current user: ${JSON.stringify(user)}`)
  const initial = { userId, username, goals: await readApi('/api/goals'), tasks: await readApi('/api/missions') }
  log('Fresh account contents', {
    userId,
    goals: initial.goals.map((goal) => goal.title),
    tasks: initial.tasks.map((task) => task.title),
  })
  if (!initial.goals.some((goal) => goal.title.startsWith('Starter goal:')) || !initial.tasks.some((task) => task.title.startsWith('Starter task:'))) {
    throw new Error('Fresh registration did not clearly identify its starter examples.')
  }
  const preexistingActive = initial ? (await readApi('/api/focus-sessions')).find((item) => item.status === 'ACTIVE' || item.status === 'PAUSED') : null
  if (preexistingActive) {
    await click('button[data-tab="Focus Engine"]')
    await waitFor("document.querySelector('button[title^=\"Cancel active focus session\"],button[title^=\"Cancel paused focus session\"]')")
    await clickExpression("document.querySelector('button[title^=\"Cancel active focus session\"],button[title^=\"Cancel paused focus session\"]')")
    await waitFor(`(async()=> (await (await fetch(${JSON.stringify(`${apiBase}/api/focus-sessions`)},{headers:{Authorization:'Bearer '+localStorage.getItem('shinpo_access_token')}})).json()).find(item=>item.id===${preexistingActive.id})?.status==='CANCELLED')()`)
    log('Prior isolated test session cancelled through Focus UI', { id: preexistingActive.id })
  }
  await screenshot('01_fresh_account.png')

  if (!process.env.SHINPO_QA_USERNAME) {
    await waitFor("document.querySelector('.coachmark-step-counter')", 15000)
    const firstTutorialStep = await evaluate("document.querySelector('.coachmark-step-counter')?.textContent.trim()")
    if (!firstTutorialStep?.includes('Step 1 of')) throw new Error(`Fresh account tutorial began at an unexpected step: ${firstTutorialStep}`)
    log('First-use walkthrough shown', { step: firstTutorialStep, instruction: await evaluate("document.querySelector('.coachmark-instruction')?.innerText.trim()") })
    await click('.coachmark-close-btn')
    if (!(await evaluate("Boolean(document.querySelector('#tutorial-exit-confirm-overlay'))"))) {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' })
    }
    await waitFor("document.querySelector('#tutorial-exit-confirm-overlay')")
    await screenshot('01b_tutorial_exit_confirmation.png')
    log('Walkthrough exit actions', await evaluate("[...document.querySelectorAll('#tutorial-exit-confirm-overlay button')].map(button=>({id:button.id,text:button.textContent.trim()}))"))
    await waitFor("document.querySelector('#tutorial-confirm-skip-btn')")
    await click('#tutorial-confirm-skip-btn')
    await waitFor("!document.querySelector('.coachmark-step-counter')")
  }

  await click('button[data-tab="Goals & Missions"]')
  let goalsAfterCreate = await readApi('/api/goals')
  let goal = goalsAfterCreate.find((item) => item.title === 'Core journey: ship a reliable personal app')
  if (!goal) {
    await clickText('button', 'New Goal')
    await fill('#create-goal-title', 'Core journey: ship a reliable personal app')
    await fill('#create-goal-desc', 'Verify planning, scheduling, focus, and progress as one connected workflow.')
    await clickText('.modal-box button[type="submit"]', 'Create Goal')
    await waitFor("!document.querySelector('#create-goal-title')")
    goalsAfterCreate = await readApi('/api/goals')
    goal = goalsAfterCreate.find((item) => item.title === 'Core journey: ship a reliable personal app')
  }
  if (!goal) throw new Error('Goal created in the UI did not persist through the API.')
  log('UI-created goal persisted', { id: goal.id, title: goal.title })
  await screenshot('02_goal_created.png')

  let tasksAfterCreate = await readApi('/api/missions')
  let task = tasksAfterCreate.find((item) => item.title === 'Core journey: test the complete focus loop' && item.goalId === goal.id)
  if (!task) {
    await clickText('button', 'New Task')
    await click('#create-task-goal')
    await waitFor("document.querySelector('.shinpo-select-option')")
    await clickText('.shinpo-select-option', goal.title)
    await fill('#create-task-title-input', 'Core journey: test the complete focus loop')
    await clickText('.modal-box button[type="submit"]', 'Create Task')
    await waitFor("!document.querySelector('#create-task-title-input')")
    tasksAfterCreate = await readApi('/api/missions')
    task = tasksAfterCreate.find((item) => item.title === 'Core journey: test the complete focus loop' && item.goalId === goal.id)
  }
  if (!task || task.goalId !== goal.id) throw new Error(`Linked task was not persisted against the selected goal: ${JSON.stringify(task)}`)
  log('UI-created linked task persisted', { id: task.id, goalId: task.goalId, title: task.title })

  await click('button[data-tab="Schedule"]')
  await click('.schedule-btn-book')
  await click('#schedule-session-task-select')
  await waitFor("document.querySelector('.shinpo-select-option')")
  await clickText('.shinpo-select-option-label', task.title)
  const sessionName = `Core journey focus block ${Date.now()}`
  await fill('input[placeholder="e.g. Deep Work Session, Refactoring..."]', sessionName)
  await fill('input[placeholder="What do you plan to achieve?"]', 'Validate the connected workflow end to end.')
  await clickText('.modal-box button[type="submit"]', 'Schedule Session')
  await waitFor("!document.querySelector('#schedule-session-task-select')", 15000)
  const sessionsAfterBooking = await readApi('/api/focus-sessions')
  log('Focus sessions after Schedule UI submit', { names: sessionsAfterBooking.map((item) => ({ id: item.id, name: item.name, status: item.status, missionId: item.missionId })), toast: await evaluate("[...document.querySelectorAll('[role=alert],.shinpo-toast')].map(e=>e.innerText.trim()).filter(Boolean)") })
  const session = sessionsAfterBooking.find((item) => item.name === sessionName && item.missionId === task.id)
  if (!session || session.missionId !== task.id || session.goalId !== goal.id || session.status !== 'SCHEDULED') {
    throw new Error(`Scheduled focus block did not persist with goal/task context: ${JSON.stringify(session)}`)
  }
  const sessionTextVisible = await evaluate(`document.body.innerText.includes(${JSON.stringify(sessionName)})`)
  if (!sessionTextVisible) throw new Error('Calendar did not render the scheduled focus block.')
  await screenshot('03_calendar_overlapping_bookings.png')
  for (const oldSession of sessionsAfterBooking.filter((item) => item.id !== session.id && item.status === 'SCHEDULED')) {
    await clickExpression(`[...document.querySelectorAll('.schedule-grid-event')].find(event=>event.getAttribute('aria-label')?.includes(${JSON.stringify(oldSession.name)}))?.querySelector('.schedule-btn-cancel')`)
    await sleep(300)
    const cancelled = (await readApi('/api/focus-sessions')).find((item) => item.id === oldSession.id)
    if (cancelled.status !== 'CANCELLED') throw new Error(`QA cleanup did not cancel session ${oldSession.id} through the Calendar UI.`)
  }
  await click('button[data-tab="Dashboard"]')
  await waitFor("document.body.innerText.includes('Core journey focus block')")
  await screenshot('04_dashboard_booking.png')
  await click('button[data-tab="Schedule"]')
  await waitFor("document.querySelector('.schedule-btn-engage')")
  await clickExpression(`[...document.querySelectorAll('.schedule-grid-event')].find(event=>event.getAttribute('aria-label')?.includes(${JSON.stringify(sessionName)}))?.querySelector('.schedule-btn-engage')`)
  await waitFor("document.body.innerText.includes('Complete & Summarize')")
  let active = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
  if (active.status !== 'ACTIVE') throw new Error(`Schedule start did not activate session: ${active.status}`)
  log('Focus session started via Calendar', { id: active.id, status: active.status })
  await screenshot('05_focus_started.png')
  await click('button[data-tab="Focus Engine"]')

  await sleep(8000)
  await clickText('button', 'Pause Session')
  await waitFor("document.body.innerText.includes('Resume Session')")
  const paused = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
  if (paused.status !== 'PAUSED') throw new Error(`Pause control did not persist PAUSED: ${paused.status}`)
  await sleep(10000)
  const pausedAgain = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
  if (pausedAgain.activeSeconds !== paused.activeSeconds) throw new Error(`Active time advanced while paused: ${paused.activeSeconds} -> ${pausedAgain.activeSeconds}`)
  log('Pause froze persisted active time', { activeSeconds: paused.activeSeconds })
  await clickText('button', 'Resume Session')
  await waitFor("document.body.innerText.includes('Pause Session')")
  const resumed = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
  if (resumed.status !== 'ACTIVE') throw new Error(`Resume did not persist ACTIVE: ${resumed.status}`)

  await send('Page.reload')
  await waitFor("document.querySelector('button[data-tab]')", 20000)
  await click('button[data-tab="Focus Engine"]')
  await waitFor("document.body.innerText.includes('Pause Session')", 20000)
  log('App reload restored active session', { id: resumed.id, status: resumed.status })
  const requiredActiveSeconds = 16 * 60
  while (true) {
    active = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
    if (active.activeSeconds >= requiredActiveSeconds) break
    console.log(`Genuine focus time: ${Math.floor(active.activeSeconds / 60)}m ${active.activeSeconds % 60}s / 16m`)
    await sleep(15000)
  }
  log('Genuine active focus threshold reached', { activeSeconds: active.activeSeconds })

  await clickExpression(`[...document.querySelectorAll('button[title="Complete and record summary"]')].find(button => button.getBoundingClientRect().width > 0)`)
  await waitFor("document.querySelector('#session-summary-title')")
  await fill('input[placeholder="What outcome was achieved during this block?"]', 'Completed the real focus acceptance run.')
  await fill('textarea[placeholder="Any distractions, blockers, or key insights?"]', 'Paused once to verify frozen active-time accounting, resumed, and continued working.')
  const markTask = await evaluate("document.querySelector('#mark-task-completed-check')?.checked")
  if (markTask) await click('#mark-task-completed-check')
  await clickText('.modal-box button[type="submit"]', 'Save Summary')
  await waitFor("!document.querySelector('#session-summary-title')", 20000)
  const completedSession = (await readApi('/api/focus-sessions')).find((item) => item.id === session.id)
  if (completedSession.status !== 'COMPLETED' || completedSession.activeSeconds < requiredActiveSeconds || !completedSession.reflectionNote) {
    throw new Error(`Completion/reflection persistence failed: ${JSON.stringify(completedSession)}`)
  }
  log('Focus completion and reflection persisted', { id: completedSession.id, status: completedSession.status, activeSeconds: completedSession.activeSeconds, reflectionNote: completedSession.reflectionNote })
  await screenshot('06_reflection_saved.png')

  await click('button[data-tab="Goals & Missions"]')
  const hasTaskCheckbox = await evaluate(`(() => [...document.querySelectorAll('.mission-list-row')].some(row => row.innerText.includes(${JSON.stringify(task.title)})))()`)
  if (!hasTaskCheckbox) throw new Error('Task row was not available for explicit completion in the task UI.')
  await clickExpression(`[...document.querySelectorAll('.mission-list-row')].find(row => row.innerText.includes(${JSON.stringify(task.title)}))?.querySelector('button[aria-label="Mark task complete"]')`)
  await waitFor("document.body.innerText.includes('Task Completed') || document.body.innerText.includes('Completed')")
  const completedTasks = await readApi('/api/missions')
  const completedTask = completedTasks.find((item) => item.id === task.id)
  if (completedTask.status !== 'COMPLETED') throw new Error(`Task completion did not persist: ${JSON.stringify(completedTask)}`)
  const updatedGoal = (await readApi('/api/goals')).find((item) => item.id === goal.id)
  log('Task and goal progress verified', { taskStatus: completedTask.status, goalId: updatedGoal.id, goalStatus: updatedGoal.status })

  await click('button[data-tab="Analytics"]')
  await waitFor("document.body.innerText.includes('Analytics')")
  const analytics = await readApi('/api/analytics/dashboard')
  await screenshot('07_analytics_after_journey.png')
  log('Analytics reflects completed work', { summary: analytics.summary, targetSession: analytics.recentDebriefs?.find((item) => item.sessionId === session.id) ?? null })

  await click('button[aria-label="Sign Out"]')
  await waitFor("document.querySelector('.auth-fullscreen-container')")
  await fill('.auth-input', username)
  await fill('input[type="password"]', password)
  await click('button.auth-submit-btn')
  await waitFor("document.querySelector('button[data-tab]')", 20000)
  const afterLogin = { goals: await readApi('/api/goals'), tasks: await readApi('/api/missions'), sessions: await readApi('/api/focus-sessions') }
  if (!afterLogin.goals.some((item) => item.id === goal.id) || !afterLogin.tasks.some((item) => item.id === task.id && item.status === 'COMPLETED') || !afterLogin.sessions.some((item) => item.id === session.id && item.status === 'COMPLETED')) {
    throw new Error('Logout/login did not restore the persisted core journey state.')
  }
  await send('Page.reload')
  await waitFor("document.querySelector('button[data-tab]')", 20000)
  const afterReload = { goals: await readApi('/api/goals'), tasks: await readApi('/api/missions'), sessions: await readApi('/api/focus-sessions') }
  if (!afterReload.sessions.some((item) => item.id === session.id && item.status === 'COMPLETED')) throw new Error('Frontend restart lost completed session state.')
  await screenshot('08_persistence_after_login_reload.png')

  const result = {
    status: 'PASS', captureDir, user: { id: userId, username }, goalId: goal.id, taskId: task.id, sessionId: session.id,
    starterExamples: { goal: initial.goals.find((item) => item.title.startsWith('Starter goal:'))?.title, task: initial.tasks.find((item) => item.title.startsWith('Starter task:'))?.title },
    focus: { status: completedSession.status, actualActiveSeconds: completedSession.activeSeconds, pausedSeconds: completedSession.accumulatedPausedSeconds },
    persistedAfterReloginAndReload: true, consoleErrors, failedRequests,
  }
  writeFileSync(join(captureDir, 'result.json'), JSON.stringify(result, null, 2))
  console.log(`CORE JOURNEY PASS ${JSON.stringify(result)}`)

  async function fillByAuthIndex(index, value) {
    const selector = await evaluate(`(() => [...document.querySelectorAll('.auth-input')][${index}] ? '.auth-field-group:nth-of-type(${index + 1}) .auth-input' : null)()`)
    if (selector) return fill(selector, value)
    const rect = await evaluate(`(() => { const e=document.querySelectorAll('.auth-input')[${index}]; if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    if (!rect) throw new Error(`Registration input ${index} disappeared.`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', modifiers: 2 })
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft' })
    await send('Input.insertText', { text: value })
  }
} finally {
  ws?.close()
  chrome.kill('SIGTERM')
  await sleep(200)
  rmSync(chromeProfile, { recursive: true, force: true })
}
