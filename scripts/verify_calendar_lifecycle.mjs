import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const api = process.env.SHINPO_API_URL
const app = process.env.SHINPO_URL
const dbContainer = process.env.SHINPO_QA_DB_CONTAINER
assert(api && app && dbContainer?.startsWith('shinpo-calendar-lifecycle-qa-'), 'Use only an isolated Calendar-lifecycle QA DB')
for (const value of [api, app]) assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname), 'QA endpoints must be loopback')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const chromePort = 9438
const profile = mkdtempSync(join(tmpdir(), 'shinpo-calendar-lifecycle-chrome-'))
const captures = mkdtempSync(join(tmpdir(), 'shinpo-calendar-lifecycle-captures-'))
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${chromePort}`, '--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage', `--user-data-dir=${profile}`, app], { stdio: 'ignore', detached: true })
let socket

try {
  const username = process.env.SHINPO_QA_USERNAME || `calendar_lifecycle_${Date.now()}`
  const credentials = process.env.SHINPO_QA_USERNAME
    ? { usernameOrEmail: username, password: process.env.SHINPO_QA_PASSWORD || 'CalendarQA_Only_2026!' }
    : { username, email: `${username}@qa.shinpo.local`, password: 'CalendarQA_Only_2026!' }
  const authResponse = await fetch(`${api}/api/auth/${process.env.SHINPO_QA_USERNAME ? 'login' : 'register'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials),
  })
  assert(authResponse.ok, `Isolated QA ${process.env.SHINPO_QA_USERNAME ? 'login' : 'registration'} failed: HTTP ${authResponse.status}`)
  const auth = await authResponse.json()
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${api}${path}`, {
      method, headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`)
    return response.status === 204 ? null : response.json()
  }
  const localDate = await (async () => {
    const now = new Date()
    const date = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return { today: date(now), tomorrow: date(tomorrow) }
  })()
  const goal = (await request('/api/goals')).find((item) => item.title === 'Calendar lifecycle QA')
    ?? await request('/api/goals', 'POST', { title: 'Calendar lifecycle QA', startDate: localDate.today })
  const missions = await request('/api/missions')
  const taskA = missions.find((item) => item.title === 'Calendar task A')
    ?? await request('/api/missions', 'POST', { goalId: goal.id, title: 'Calendar task A', scheduledDate: localDate.today, estimatedMinutes: 25 })
  const taskB = missions.find((item) => item.title === 'Calendar task B')
    ?? await request('/api/missions', 'POST', { goalId: goal.id, title: 'Calendar task B', scheduledDate: localDate.today, estimatedMinutes: 25 })
  assert((await request('/api/missions')).some((item) => item.id === taskA.id), 'Seeded task is missing from the authenticated API list')
  for (const previous of await request('/api/focus-sessions')) {
    if (previous.status === 'SCHEDULED' && /^(Calendar lifecycle |Edited cross-midnight session|Overlap probe )/.test(previous.name)) {
      await request(`/api/focus-sessions/${previous.id}/cancel`, 'POST')
    }
  }

  let page
  for (let i = 0; i < 80; i++) {
    await sleep(250)
    try {
      page = (await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json()).find((item) => item.type === 'page' && item.url.startsWith(app))
      if (page?.webSocketDebuggerUrl) break
    } catch {}
  }
  assert(page?.webSocketDebuggerUrl, 'Chromium did not expose the isolated QA app page')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let id = 0
  const pending = new Map()
  const failedResponses = []
  const requests = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Network.requestWillBeSent') requests.set(message.params.requestId, { url: message.params.request.url, method: message.params.request.method })
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failedResponses.push({ ...requests.get(message.params.requestId), status: message.params.response.status })
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id
    pending.set(commandId, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result))
    socket.send(JSON.stringify({ id: commandId, method, params }))
  })
  const pressKey = async (key, code, virtualKey) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey })
  }
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert(!result.exceptionDetails, result.exceptionDetails?.text)
    return result.result?.value
  }
  const waitFor = async (expression, timeout = 12000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await evaluate(`Boolean(${expression})`)) return
      await sleep(100)
    }
    throw new Error(`Timed out waiting for ${expression}: ${await evaluate('document.body.innerText.slice(0,900)')}`)
  }
  const clickAt = async (rect) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  }
  const click = async (selector) => {
    const rect = await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return null; e.scrollIntoView({block:'center',inline:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    assert(rect, `Missing UI control ${selector}`)
    await clickAt(rect)
  }
  const clickText = async (selector, text) => {
    const rect = await evaluate(`(() => { const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(n=>n.textContent.trim()===${JSON.stringify(text)}&&n.getBoundingClientRect().width); if(!e) return null; e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`)
    assert(rect, `Missing visible ${selector} with text ${text}`)
    await clickAt(rect)
  }
  const clickExpression = async (expression) => {
    const clicked = await evaluate(`(() => { const e=(${expression}); if(!e) return false; e.click(); return true; })()`)
    assert(clicked, `Missing clickable element: ${expression}`)
  }
  const fill = async (selector, value) => {
    await click(selector)
    for (const [type, key, code, vk, modifiers] of [['keyDown','Control','ControlLeft',17],['keyDown','a','KeyA',65,2],['keyUp','a','KeyA',65,2],['keyUp','Control','ControlLeft',17]]) {
      await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, ...(modifiers ? { modifiers } : {}) })
    }
    await send('Input.insertText', { text: value })
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`), value)
  }
  const readSessions = () => request('/api/focus-sessions')
  const named = (records, name) => records.filter((session) => session.name === name)
  const chooseTask = async (taskTitle) => {
    await waitFor("document.querySelector('#schedule-session-task-select')")
    await click('#schedule-session-task-select')
    await sleep(80)
    if (await evaluate("document.querySelector('#schedule-session-task-select')?.getAttribute('aria-expanded') !== 'true'")) {
      await evaluate("document.querySelector('#schedule-session-task-select').click()")
    }
    await waitFor("document.querySelector('#schedule-session-task-select')?.getAttribute('aria-expanded')==='true'")
    await waitFor(`[...document.querySelectorAll('.shinpo-select-option-label')].some(e=>e.textContent.trim()===${JSON.stringify(taskTitle)})`, 5000).catch(async () => {
      throw new Error(`Task option ${taskTitle} did not appear; select=${JSON.stringify(await evaluate("({expanded:document.querySelector('#schedule-session-task-select')?.getAttribute('aria-expanded'),text:document.querySelector('#schedule-session-task-select')?.innerText,modal:document.querySelector('.modal-box')?.innerText.slice(0,500),body:document.body.innerText.slice(-400)})"))}; task list=${JSON.stringify((await request('/api/missions')).map(({id,title,status})=>({id,title,status})))}`)
    })
    await evaluate(`[...document.querySelectorAll('.shinpo-select-option-label')].find(e=>e.textContent.trim()===${JSON.stringify(taskTitle)}).closest('[role=option]').click()`)
  }
  const setTime = async (hour, minute) => {
    await evaluate("document.querySelector('#schedule-session-time-picker').click()")
    await waitFor("document.querySelectorAll('.shinpo-timepicker-col').length===2")
    await evaluate(`document.querySelectorAll('.shinpo-timepicker-col')[0].querySelectorAll('.shinpo-timepicker-unit-btn')[${hour}].click()`)
    await evaluate(`[...document.querySelectorAll('.shinpo-timepicker-col')[1].querySelectorAll('.shinpo-timepicker-unit-btn')].find(e=>e.textContent.trim()==='${String(minute).padStart(2, '0')}').click()`)
    assert.equal(await evaluate("document.querySelector('#schedule-session-time-picker')?.innerText.match(/\\d{2}:\\d{2}/)?.[0]"), `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, 'Time picker did not retain the selected local time')
    if (hour === 23) await screenshot('calendar-time-picker-open.png')
    await evaluate("document.querySelector('#schedule-session-time-picker').click()")
  }
  const chooseDate = async (date) => {
    await evaluate("document.querySelector('#schedule-session-date-picker').click()")
    await waitFor("document.querySelector('.shinpo-calendar-panel')")
    await evaluate(`document.querySelector('.shinpo-calendar-panel button[aria-label="${date}"]').click()`)
    assert((await evaluate("document.querySelector('#schedule-session-date-picker')?.innerText")).includes(date), 'Date picker did not retain the selected local date')
  }
  const screenshot = async (name) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(captures, name), Buffer.from(shot.data, 'base64'))
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(() => {
    localStorage.setItem('shinpo_access_token', ${JSON.stringify(auth.accessToken)});
    localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
    localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    localStorage.setItem('shinpo_onboarding_dismissed_${auth.user.id}', 'true');
    location.reload();
  })()`)
  await waitFor("document.querySelector('button[data-tab=\\\"Schedule\\\"]')")
  await clickExpression("document.querySelector('button[data-tab=\\\"Schedule\\\"]')")
  await waitFor("document.querySelector('.schedule-sidebar-book')")
  await clickExpression("document.querySelector('.schedule-btn-book')")
  await waitFor("document.querySelector('#schedule-session-task-select')")
  await chooseTask(taskA.title)
  const originalName = `Calendar lifecycle ${Date.now()}`
  await fill('input[placeholder="e.g. Deep Work Session, Refactoring..."]', originalName)
  await fill('input[placeholder="What do you plan to achieve?"]', 'Original intention')
  await setTime(23, 30)
  await clickText('.modal-box button.auth-tab-btn', '25m')
  await click('.modal-box button[type="submit"]')
  await sleep(800)
  assert.equal(failedResponses.length, 0, `Calendar create had failed HTTP requests: ${JSON.stringify(failedResponses)}`)
  await waitFor(`document.body.innerText.includes(${JSON.stringify(originalName)})`)
  let records = await readSessions()
  const [created] = named(records, originalName)
  assert(created, 'Calendar booking form did not create a persistent session')
  assert.equal(created.status, 'SCHEDULED')
  assert.equal(created.missionId, taskA.id)
  assert.equal(created.goalId, goal.id)
  const expectedLocal = await evaluate(`new Date(${JSON.stringify(`${localDate.today}T23:30`)}).toISOString()`)
  assert.equal(Date.parse(created.scheduledAt), Date.parse(expectedLocal), 'Initial scheduled instant did not preserve the local timezone selection')
  await screenshot('01_calendar_created.png')

  await clickExpression(`[...document.querySelectorAll('.schedule-grid-event.status-SCHEDULED')].find(e=>e.getAttribute('aria-label')?.startsWith(${JSON.stringify(`${originalName},`)}))?.querySelector('.schedule-btn-edit')`)
  await waitFor("document.querySelector('#schedule-session-task-select')")
  const editedName = `Edited cross-midnight session ${Date.now()} — ${'polished local schedule '.repeat(4).trim()}`
  await fill('input[placeholder="e.g. Deep Work Session, Refactoring..."]', editedName)
  await fill('input[placeholder="What do you plan to achieve?"]', 'Edited intention remains readable after reload')
  await chooseTask(taskB.title)
  await chooseDate(localDate.tomorrow)
  await setTime(23, 45)
  await screenshot('calendar_edit_form.png')
  const durationHitTest = await evaluate("(() => { const e=[...document.querySelectorAll('.modal-box button.auth-tab-btn')].find(n=>n.textContent.trim()==='90m'); if(!e) return null; const r=e.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2, hit=document.elementFromPoint(x,y); return {button:{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.outerHTML.slice(0,180),popover:document.querySelector('.shinpo-timepicker-popover')?.getBoundingClientRect().toJSON()}; })()")
  assert(durationHitTest?.hit.includes("class=\"auth-tab-btn") && durationHitTest.hit.includes('90m'), `The open time picker obscured the duration preset: ${JSON.stringify(durationHitTest)}`)
  await clickText('.modal-box button.auth-tab-btn', '90m')
  await click('.modal-box button[type="submit"]')
  await sleep(800)
  assert.equal(failedResponses.length, 0, `Calendar edit had failed HTTP requests: ${JSON.stringify(failedResponses)}`)
  await waitFor(`document.body.innerText.includes(${JSON.stringify(editedName)})`)
  records = await readSessions()
  const [edited] = named(records, editedName)
  assert(edited, 'Edit did not persist the updated title')
  assert.equal(edited.durationMinutes, 90)
  assert.equal(edited.intention, 'Edited intention remains readable after reload')
  assert.equal(edited.missionId, taskB.id)
  assert.equal(edited.goalId, goal.id)
  assert.equal(Date.parse(edited.scheduledAt), Date.parse(await evaluate(`new Date(${JSON.stringify(`${localDate.tomorrow}T23:45`)}).toISOString()`)))
  const localDisplay = await evaluate(`new Date(${JSON.stringify(edited.scheduledAt)}).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})`)
  assert.equal(localDisplay, '11:45 PM')
  const overlapName = `Overlap probe ${Date.now()}`
  await evaluate(`document.querySelector('.schedule-month-day[aria-label^="${localDate.tomorrow}"]').click()`)
  await click('.schedule-btn-book')
  await chooseTask(taskA.title)
  await fill('input[placeholder="e.g. Deep Work Session, Refactoring..."]', overlapName)
  await setTime(23, 50)
  await clickText('.modal-box button.auth-tab-btn', '25m')
  await click('.modal-box button[type="submit"]')
  await waitFor(`document.body.innerText.includes(${JSON.stringify(overlapName)})`)
  records = await readSessions()
  const [overlap] = named(records, overlapName)
  assert(overlap && overlap.status === 'SCHEDULED', 'Overlapping booking did not persist')
  const weeklySummary = await evaluate("document.querySelector('.schedule-week-summary')?.innerText")
  assert(weeklySummary?.includes('1h 55m') && weeklySummary.includes('across 2 sessions') && weeklySummary.includes('of 2 planned'), `Cancelled history inflated the current weekly plan: ${weeklySummary}`)
  await screenshot('02_calendar_overlapping_late_sessions.png')
  const laneRects = await evaluate(`(() => [...document.querySelectorAll('.schedule-grid-event')].filter(e=>[${JSON.stringify(editedName)},${JSON.stringify(overlapName)}].some(n=>e.getAttribute('aria-label')?.includes(n))).map(e=>{const r=e.getBoundingClientRect(); return {name:e.getAttribute('aria-label'),x:r.x,width:r.width,top:r.top,height:r.height}}))()`)
  assert.equal(laneRects.length, 2, 'Both overlapping late-night events should be rendered')
  assert(laneRects[0].x + laneRects[0].width <= laneRects[1].x || laneRects[1].x + laneRects[1].width <= laneRects[0].x, `Overlapping entries share a visual lane: ${JSON.stringify(laneRects)}`)
  const keyboardActions = await evaluate(`(() => {const card=[...document.querySelectorAll('.schedule-grid-event')].find(e=>e.getAttribute('aria-label')?.startsWith(${JSON.stringify(`${editedName},`)})), button=card?.querySelector('.schedule-btn-edit'), actions=card?.querySelector('.schedule-session-actions'); if(!button||!actions)return null; const label=button.getAttribute('aria-label'); button.focus(); const focusedOpacity=getComputedStyle(actions).opacity; button.blur(); return {label,focusedOpacity};})()`)
  assert(keyboardActions?.label?.startsWith('Edit ') && keyboardActions.focusedOpacity === '1', `Calendar actions did not reveal with accessible keyboard focus: ${JSON.stringify(keyboardActions)}`)
  await evaluate(`(() => [...document.querySelectorAll('.schedule-grid-event')].find(e=>e.getAttribute('aria-label')?.includes(${JSON.stringify(editedName)}))?.scrollIntoView({block:'center',inline:'center'}))()`)
  await sleep(150)
  const visibleLaneRects = await evaluate(`(() => {const viewport=document.querySelector('.schedule-calendar-scroll').getBoundingClientRect(); return [...document.querySelectorAll('.schedule-grid-event')].filter(e=>[${JSON.stringify(editedName)},${JSON.stringify(overlapName)}].some(n=>e.getAttribute('aria-label')?.includes(n))).map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,top:r.top,bottom:r.bottom,visible:r.right>viewport.left&&r.left<viewport.right&&r.bottom>viewport.top&&r.top<viewport.bottom}})})()`)
  assert(visibleLaneRects.length === 2 && visibleLaneRects.every((rect) => rect.visible), `Late-night events were not reachable by scrolling: ${JSON.stringify(visibleLaneRects)}`)
  await sleep(4800)
  assert.equal(await evaluate("document.querySelectorAll('.shinpo-toast-item').length"), 0, 'Success toasts should clear without permanently covering the Calendar')
  await screenshot('02b_calendar_late_night_lanes.png')

  await evaluate('location.reload()')
  await waitFor("document.querySelector('button[data-tab=\\\"Schedule\\\"]')")
  await clickExpression("document.querySelector('button[data-tab=\\\"Schedule\\\"]')")
  await waitFor(`document.body.innerText.includes(${JSON.stringify(editedName)})`)
  assert((await readSessions()).some((item) => item.id === edited.id && item.scheduledAt === edited.scheduledAt && item.missionId === taskB.id), 'Edited session did not survive reload')
  await screenshot('03_calendar_after_reload.png')
  await click('button[data-tab="Dashboard"]')
  await waitFor("document.querySelector('[data-tutorial=todays-schedule-card]')")
  assert(!(await evaluate(`document.querySelector('[data-tutorial="todays-schedule-card"]')?.innerText.includes(${JSON.stringify(editedName)})`)), 'Tomorrow booking leaked into Dashboard Today schedule')
  await click('button[data-tab="Focus Engine"]')
  await waitFor(`document.body.innerText.includes(${JSON.stringify(editedName)})`)
  const focusRows = await evaluate("({tab:document.querySelector('.active[data-tab]')?.dataset.tab,rows:[...document.querySelectorAll('.dense-table tbody tr')].map(row=>row.innerText),body:document.body.innerText.slice(-900)})")
  assert(await evaluate(`[...document.querySelectorAll('.dense-table tbody tr')].some(row=>row.innerText.includes(${JSON.stringify(editedName)})&&row.innerText.includes('90M'))`), `Focus history does not reflect the edited schedule title/duration: ${JSON.stringify(focusRows)}`)
  await screenshot('04_focus_reflects_schedule.png')
  await click('button[data-tab="Schedule"]')
  await waitFor(`document.body.innerText.includes(${JSON.stringify(editedName)})`)
  await clickExpression(`[...document.querySelectorAll('.schedule-grid-event.status-SCHEDULED')].find(e=>e.getAttribute('aria-label')?.startsWith(${JSON.stringify(`${editedName},`)}))?.querySelector('.schedule-btn-cancel')`)
  for (let i = 0; i < 40; i++) {
    records = await readSessions()
    if (records.find((item) => item.id === edited.id)?.status === 'CANCELLED') break
    await sleep(150)
  }
  assert.equal(records.find((item) => item.id === edited.id)?.status, 'CANCELLED', 'Cancel did not persist in PostgreSQL')
  await click('button[data-tab="Dashboard"]')
  await waitFor("document.querySelector('[data-tutorial=todays-schedule-card]')")
  assert(!(await evaluate(`document.querySelector('[data-tutorial="todays-schedule-card"]')?.innerText.includes(${JSON.stringify(editedName)})`)), 'Cancelled booking appeared in Dashboard Today schedule')
  await click('button[data-tab="Schedule"]')
  await clickExpression(`[...document.querySelectorAll('.schedule-grid-event.status-SCHEDULED')].find(e=>e.getAttribute('aria-label')?.startsWith(${JSON.stringify(`${overlapName},`)}))?.querySelector('.schedule-btn-cancel')`)
  for (let i = 0; i < 40; i++) {
    records = await readSessions()
    if (records.find((item) => item.id === overlap.id)?.status === 'CANCELLED') break
    await sleep(150)
  }
  assert.equal(records.find((item) => item.id === overlap.id)?.status, 'CANCELLED')
  await clickExpression("[...document.querySelectorAll('.schedule-sidebar-filter')].find(button=>button.innerText.includes('Cancelled / ended'))")
  assert(await evaluate(`document.body.innerText.includes(${JSON.stringify(editedName)}) && document.body.innerText.includes(${JSON.stringify(overlapName)})`), 'Cancelled entries are not available in the explicit cancellation filter')
  await screenshot('06_cancelled_filter.png')
  await screenshot('05_calendar_cancelled.png')
  const countBeforeKeyboardCheck = records.length
  const keyboardTarget = await evaluate("(() => {const button=document.querySelector('button.schedule-btn-book');button?.focus();return {found:Boolean(button),focused:document.activeElement===button,label:button?.innerText}})()")
  assert(keyboardTarget.focused, `Calendar booking action did not receive keyboard focus: ${JSON.stringify(keyboardTarget)}`)
  await pressKey('Enter', 'Enter', 13)
  assert(await evaluate("Boolean(document.querySelector('#schedule-session-task-select'))"), 'Enter did not activate the focused Calendar booking button')
  await evaluate("document.querySelector('.modal-box button.btn-timer.secondary').focus()")
  await pressKey('Enter', 'Enter', 13)
  await waitFor("!document.querySelector('#schedule-session-task-select')")
  records = await readSessions()
  assert.equal(records.length, countBeforeKeyboardCheck, 'Keyboard open/cancel changed persistent schedule data')
  await click('[aria-label="Settings"]')
  await waitFor("document.querySelector('.settings-modal') && document.body.innerText.includes('Color Theme')")
  await clickExpression("[...document.querySelectorAll('.settings-pill-btn')].find(button=>button.innerText.includes('Light Theme'))")
  await waitFor("document.documentElement.getAttribute('data-theme')==='light'")
  await clickExpression("document.querySelector('.settings-modal-close')")
  await waitFor("!document.querySelector('.settings-modal')", 2000)
  await sleep(4800)
  assert.equal(await evaluate("document.querySelectorAll('.shinpo-toast-item').length"), 0, 'Success toasts should auto-dismiss in the light theme too')
  await screenshot('07_calendar_light.png')
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 650, deviceScaleFactor: 1, mobile: false })
  const narrowCalendar = await evaluate("(() => {const e=document.querySelector('.schedule-calendar-scroll');return {viewportWidth:innerWidth,pageWidth:document.documentElement.scrollWidth,calendarWidth:e.clientWidth,calendarContentWidth:e.scrollWidth,calendarHeight:e.clientHeight,calendarContentHeight:e.scrollHeight}})()")
  assert(narrowCalendar.pageWidth <= narrowCalendar.viewportWidth, `Calendar caused page-level horizontal overflow at 900×650: ${JSON.stringify(narrowCalendar)}`)
  await screenshot('08_calendar_900x650.png')

  console.log(JSON.stringify({
    status: 'PASS', accountId: auth.user.id, timezone: await evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone'),
    created: { id: created.id, status: created.status, missionId: created.missionId, localDate: localDate.today, scheduledAt: created.scheduledAt },
    edited: { id: edited.id, status: records.find((item) => item.id === edited.id)?.status, title: edited.name, durationMinutes: edited.durationMinutes, missionId: edited.missionId, localDate: localDate.tomorrow, scheduledAt: edited.scheduledAt, crossesMidnight: true },
    overlap: { id: overlap.id, laneRects },
    weeklySummary,
    visibleLaneRects,
    narrowCalendar,
    persistence: 'edit survived reload; both cancellations verified via authenticated API',
    captures,
  }, null, 2))
} finally {
  socket?.close()
  try { process.kill(-chrome.pid, 'SIGTERM') } catch {}
  if (chrome.exitCode === null) await new Promise((resolve) => chrome.once('exit', resolve))
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
