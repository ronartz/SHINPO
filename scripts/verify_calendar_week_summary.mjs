import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const api = process.env.SHINPO_API_URL
const app = process.env.SHINPO_URL
const dbContainer = process.env.SHINPO_QA_DB_CONTAINER
if (!api || !app || !dbContainer?.startsWith('shinpo-calendar-summary-qa-')) {
  throw new Error('Set loopback SHINPO_API_URL, SHINPO_URL, and an isolated shinpo-calendar-summary-qa-* DB container.')
}
for (const value of [api, app]) {
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) throw new Error('QA verifier only permits loopback services.')
}

const captureDir = mkdtempSync(join(tmpdir(), 'shinpo-calendar-summary-'))
const chromePort = 9426
const chromeProfile = mkdtempSync(join(tmpdir(), 'shinpo-calendar-summary-chrome-'))
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${chromePort}`, '--no-sandbox', '--disable-gpu', '--disable-extensions', `--user-data-dir=${chromeProfile}`, app], { stdio: 'ignore', detached: true })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let socket

try {
  const username = `calqa_${Date.now()}`
  const registration = await fetch(`${api}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: `${username}@qa.shinpo.local`, password: 'CalendarQA_2026!Only' }),
  })
  if (!registration.ok) throw new Error(`QA signup failed: HTTP ${registration.status} ${await registration.text()}`)
  const auth = await registration.json()
  const token = auth.accessToken
  const userId = auth.user.id
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(`${api}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`)
    return response.status === 204 ? null : response.json()
  }
  const now = new Date()
  const at = (days, hours) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(hours, 0, 0, 0); return d.toISOString() }
  const completed = await request('/api/focus-sessions', 'POST', { name: 'QA completed focus', durationMinutes: 25, scheduledAt: at(0, 8) })
  await request(`/api/focus-sessions/${completed.id}/start`, 'POST')
  const update = spawnSync('podman', ['exec', dbContainer, 'psql', '-U', 'shinpo', '-d', 'shinpo', '-v', 'ON_ERROR_STOP=1', '-c', `UPDATE focus_sessions SET started_at = NOW() - INTERVAL '21 minutes' WHERE id = ${completed.id} AND user_id = ${userId} AND status = 'ACTIVE'`], { encoding: 'utf8' })
  if (update.status !== 0 || !update.stdout.includes('UPDATE 1')) throw new Error(`Could not seed isolated completed-session duration: ${update.stderr}`)
  await request(`/api/focus-sessions/${completed.id}/complete`, 'POST', {})
  await request('/api/focus-sessions', 'POST', { name: 'QA upcoming focus', durationMinutes: 25, scheduledAt: at(0, 16) })
  await request('/api/focus-sessions', 'POST', { name: 'QA next-day focus', durationMinutes: 25, scheduledAt: at(1, 10) })
  const records = await request('/api/focus-sessions')
  const own = records.filter((session) => session.name.startsWith('QA '))
  const expected = { planned: '1h 15m', actual: '21m', completed: '1', upcoming: '2' }

  let page
  for (let i = 0; i < 60; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json()).find((item) => item.type === 'page')
      if (page?.webSocketDebuggerUrl) break
    } catch {}
    await sleep(250)
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('Chromium did not expose the app page.')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let commandId = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id) }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result))
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result?.value
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(() => {
    localStorage.setItem('shinpo_custom_server_url', ${JSON.stringify(api)});
    localStorage.setItem('shinpo_access_token', ${JSON.stringify(token)});
    localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
    localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    localStorage.setItem('shinpo_onboarding_dismissed_${userId}', 'true');
    location.reload();
  })()`)
  for (let i = 0; i < 60 && !(await evaluate("Boolean(document.querySelector('button[data-tab=\\\"Schedule\\\"]'))")); i++) await sleep(250)
  const nav = await evaluate("Boolean(document.querySelector('button[data-tab=\\\"Schedule\\\"]'))")
  if (!nav) throw new Error(`Authenticated app did not hydrate its Calendar navigation: ${JSON.stringify(await evaluate("({url:location.href,body:document.body.innerText.slice(0,500),user:localStorage.getItem('shinpo_auth_user'),token:Boolean(localStorage.getItem('shinpo_access_token'))})"))}`)
  await evaluate("document.querySelector('button[data-tab=\\\"Schedule\\\"]').click()")
  for (let i = 0; i < 60; i++) {
    const loaded = await evaluate("document.querySelector('.schedule-week-summary')?.innerText.includes('across 3 sessions')")
    if (loaded) break
    await sleep(250)
  }
  const rendered = await evaluate("[...document.querySelectorAll('.schedule-week-summary > div')].map(card => [...card.children].map(node => node.textContent.trim()))")
  if (JSON.stringify(rendered) !== JSON.stringify([[ 'Planned focus', expected.planned, 'across 3 sessions' ], [ 'Focus recorded', expected.actual, 'actual active time' ], [ 'Completed', expected.completed, 'of 3 planned' ], [ 'Upcoming', expected.upcoming, 'ready to start' ]])) {
    throw new Error(`Calendar summary differs from seeded API state: ${JSON.stringify({ expected, rendered })}`)
  }
  const eventLayout = await evaluate("[...document.querySelectorAll('.schedule-grid-event')].map(event => { const title=event.querySelector('.schedule-session-title')?.getBoundingClientRect(); const actions=event.querySelector('.schedule-session-actions')?.getBoundingClientRect(); const style=getComputedStyle(event.querySelector('.schedule-session-actions')); const overlap=Boolean(title&&actions&&title.left<actions.right&&title.right>actions.left&&title.top<actions.bottom&&title.bottom>actions.top); return {name:event.innerText.trim(),height:event.getBoundingClientRect().height,title:title&&{x:title.x,y:title.y,width:title.width,height:title.height},actions:actions&&{x:actions.x,y:actions.y,width:actions.width,height:actions.height,position:style.position},overlap} })")
  if (eventLayout.some((event) => event.overlap)) throw new Error(`Calendar event text overlaps its controls: ${JSON.stringify(eventLayout)}`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png' })
  const screenshotPath = join(captureDir, 'calendar-week-summary.png')
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  console.log(JSON.stringify({ status: 'PASS', screenshotPath, records: own.map(({ id, status, durationMinutes, activeSeconds }) => ({ id, status, durationMinutes, activeSeconds })), rendered, eventLayout }, null, 2))
} finally {
  socket?.close()
  try { process.kill(-chrome.pid, 'SIGTERM') } catch {}
  if (chrome.exitCode === null) await new Promise((resolve) => chrome.once('exit', resolve))
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
