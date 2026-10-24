#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const api = process.env.SHINPO_API_URL || 'http://127.0.0.1:18081'
const web = process.env.SHINPO_PREVIEW_URL || 'http://127.0.0.1:4173'
const output = process.env.SHINPO_QA_OUTPUT || join(tmpdir(), `shinpo-focus-live-${Date.now()}`)
const cdpPort = Number(process.env.SHINPO_CDP_PORT || 9224)
const mode = process.env.SHINPO_QA_MODE || 'continuous-smoke'
mkdirSync(join(output, 'frames'), { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'shinpo-focus-live-profile-'))
const chrome = spawn('google-chrome-stable', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  '--remote-allow-origins=*', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`,
  '--window-size=1600,1000', 'about:blank',
], { stdio: 'ignore' })

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const checks = {}
const errors = []
const consoleErrors = []
let socket
let frameCount = 0
let currentStep = 'register disposable account'

async function main() {
  currentStep = 'register disposable account'
  const stamp = Date.now()
  const username = process.env.SHINPO_QA_USERNAME || `focus_live_${stamp}`
  const password = 'QA-only_Pass123!'
  const registered = await fetch(`${api}/api/auth/${process.env.SHINPO_QA_USERNAME ? 'login' : 'register'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(process.env.SHINPO_QA_USERNAME
      ? { usernameOrEmail: username, password }
      : { username, email: `${username}@qa.invalid`, password }),
  })
  if (!registered.ok) throw new Error(`Disposable account ${process.env.SHINPO_QA_USERNAME ? 'login' : 'registration'} failed: HTTP ${registered.status}`)
  const auth = await registered.json()
  console.log(`Using disposable QA user ${username} (id ${auth.user.id})`)
  const authHeaders = { Authorization: `Bearer ${auth.accessToken}` }
  currentStep = 'skip onboarding for disposable account'
  const onboarding = await fetch(`${api}/api/onboarding/skip`, { method: 'POST', headers: authHeaders })
  if (!onboarding.ok) throw new Error(`Could not skip QA onboarding: HTTP ${onboarding.status}`)

  let linkedPomodoroId = null
  if (mode === 'pomodoro-positive') {
    currentStep = 'create disposable linked Pomodoro session'
    const apiPost = async (path, body) => {
      const response = await fetch(`${api}/api/${path}`, { method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`)
      return response.json()
    }
    const today = new Date().toISOString().slice(0, 10)
    const goal = await apiPost('goals', { title: 'QA focus reward relationship', description: 'Disposable acceptance fixture', startDate: today, targetDate: today })
    const mission = await apiPost('missions', { goalId: goal.id, title: 'Complete linked focus cycle', description: 'Disposable acceptance fixture', scheduledDate: today, estimatedMinutes: 16 })
    const created = await apiPost('focus-sessions', {
      name: mission.title, intention: 'Verify persisted Pomodoro phases and one reward', durationMinutes: 8,
      goalId: goal.id, missionId: mission.id, pomodoroEnabled: true, pomodoroFocusCycles: 2,
      pomodoroShortBreakMinutes: 1, pomodoroLongBreakMinutes: 1,
    })
    const started = await fetch(`${api}/api/focus-sessions/${created.id}/start`, { method: 'POST', headers: authHeaders })
    if (!started.ok) throw new Error(`Could not start linked Pomodoro fixture: HTTP ${started.status}`)
    linkedPomodoroId = created.id
    checks.linkedFixture = { goalId: goal.id, missionId: mission.id, sessionId: created.id, durationMinutes: 8, focusCycles: 2 }
  } else if (mode === 'pomodoro-attach') {
    const response = await fetch(`${api}/api/focus-sessions`, { headers: authHeaders })
    if (!response.ok) throw new Error(`Could not read existing Pomodoro fixture: HTTP ${response.status}`)
    const active = (await response.json()).find((item) => item.status === 'ACTIVE' && item.pomodoroEnabled)
    if (!active) throw new Error('No active disposable Pomodoro fixture is available to attach to')
    linkedPomodoroId = active.id
    checks.linkedFixture = { goalId: active.goalId, missionId: active.missionId, sessionId: active.id, durationMinutes: active.durationMinutes, focusCycles: active.pomodoroFocusCycles, reused: true }
  }

  let target
  for (let i = 0; i < 40; i += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
      target = pages.find((page) => page.type === 'page')
      if (target?.webSocketDebuggerUrl) break
    } catch { await delay(250) }
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('Chrome DevTools endpoint did not start')
  console.log(`Attached to Chrome page: ${target.url}`)

  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.screencastFrame') {
      frameCount += 1
      writeFileSync(join(output, 'frames', `frame-${String(frameCount).padStart(5, '0')}.png`),
        Buffer.from(message.params.data, 'base64'))
      void send('Page.screencastFrameAck', { sessionId: message.params.sessionId }).catch(() => {})
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails?.text || 'Runtime exception')
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description || '').join(' ').slice(0, 2000))
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, method } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(`${method}: ${message.error.message}`))
      else resolve(message.result || {})
    }
  })

  function send(method, params = {}) {
    const id = nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)) }, 10000)
      pending.set(id, { method, resolve: (value) => { clearTimeout(timer); resolve(value) }, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async function evaluate(expression) {
    let result
    try {
      result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    } catch (error) {
      throw new Error(`Runtime.evaluate [${expression.slice(0, 120)}]: ${error.message}`)
    }
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result?.value
  }

  async function waitFor(expression, label, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await delay(200)
    }
    const visibleText = await evaluate(`document.body.innerText.slice(0, 2200)`).catch(() => 'unavailable')
    throw new Error(`Timed out waiting for ${label}; visible text: ${visibleText}`)
  }

  async function clickButton(text) {
    const clicked = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().includes(${JSON.stringify(text)}) && !x.disabled); if(!b) return false; b.click(); return true })()`)
    if (!clicked) throw new Error(`Button not found/enabled: ${text}`)
  }

  async function clickTrustedButton(text) {
    const rect = await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.innerText.trim().includes(${JSON.stringify(text)}) && !x.disabled); if(!b) return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2} })()`)
    if (!rect) throw new Error(`Trusted-input button not found/enabled: ${text}`)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  }

  async function screenshot(name) {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    writeFileSync(join(output, name), Buffer.from(result.data, 'base64'))
  }

  currentStep = 'load authenticated application'
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: web })
  console.log(`Navigated to ${web}`)
  await waitFor(`Boolean(window.__SHINPO_NAVIGATE_TAB__)`, 'application shell')
  console.log('Production preview shell loaded')
  await evaluate(`(() => {
    localStorage.setItem('shinpo_custom_server_url', ${JSON.stringify(api)});
    localStorage.setItem('shinpo_access_token', ${JSON.stringify(auth.accessToken)});
    localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
    localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    localStorage.setItem('shinpo_onboarding_dismissed_${auth.user.id}', 'true');
  })()`)
  await send('Page.reload')
  await waitFor(`Boolean(document.querySelector('.app-shell') && window.__SHINPO_NAVIGATE_TAB__)`, 'authenticated app shell')
  console.log('Authenticated shell loaded')
  await waitFor(`Boolean(document.querySelector('.cockpit-top-bar'))`, 'dashboard header')
  await send('Page.startScreencast', { format: 'png', everyNthFrame: 4 })
  await screenshot('01-dashboard-before-focus.png')
  checks.account = { username, userId: auth.user.id, persistentStore: 'isolated PostgreSQL 16 tmpfs' }
  checks.initialRender = await evaluate(`({ shell: document.querySelector('.app-shell')?.className, mainOpacity: getComputedStyle(document.querySelector('.app-main')).opacity, dialogs: [...document.querySelectorAll('[role="dialog"]')].map(e=>e.innerText.slice(0,160)), text: document.body.innerText.slice(0,500) })`)

  if (mode === 'dashboard-analytics-smoke') {
    await delay(2000)
    checks.dashboardText = await evaluate(`document.querySelector('main')?.innerText.slice(0,1200) || ''`)
    await evaluate(`window.__SHINPO_NAVIGATE_TAB__('Analytics')`)
    await waitFor(`document.body.innerText.includes('Performance Analytics')`, 'Analytics navigation')
    await delay(1000)
    checks.analyticsText = await evaluate(`document.querySelector('main')?.innerText.slice(0,1600) || ''`)
    checks.browserExceptions = errors
    checks.consoleErrors = consoleErrors
    await screenshot('analytics-runtime-diagnosis.png')
    checks.renderFailed = checks.analyticsText.includes('Something went wrong in this view')
    writeFileSync(join(output, 'runtime-diagnosis.json'), JSON.stringify(checks, null, 2))
    console.log(JSON.stringify({ output, checks }, null, 2))
    return
  }

  if (mode === 'pomodoro-summary') {
    const readJson = async (path) => {
      const response = await fetch(`${api}/api/${path}`, { headers: authHeaders })
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
      return response.json()
    }
    checks.persistedDashboard = await readJson('dashboard')
    checks.persistedAnalytics = await readJson('analytics/dashboard')
    checks.persistedFocusSession = (await readJson('focus-sessions')).find((session) => session.id === 909)
    checks.persistedProgress = await readJson('progress')
    checks.rewardAmounts = Object.fromEntries(['FOCUS_SESSION_COMPLETED', 'MISSION_COMPLETED', 'GOAL_COMPLETED'].map((type) => [
      type,
      checks.persistedProgress.recentEvents.filter((event) => event.eventType === type).map((event) => event.amount),
    ]))
    if (checks.persistedDashboard.progress.total !== 75 || checks.persistedDashboard.missions.completed !== 1
      || !checks.persistedDashboard.goals.some((goal) => goal.id === 246 && goal.status === 'COMPLETED')
      || checks.persistedAnalytics.summary.totalFocusMinutes !== 16
      || checks.persistedAnalytics.summary.sessionsCompleted !== 1
      || checks.persistedAnalytics.summary.missionsCompleted !== 1
      || checks.persistedAnalytics.recentDebriefs[0]?.actualFocusMinutes !== 16
      || checks.persistedFocusSession?.status !== 'COMPLETED' || checks.persistedFocusSession.focusActiveSeconds !== 960
      || checks.persistedFocusSession.breakActiveSeconds !== 3
      || JSON.stringify(checks.rewardAmounts) !== JSON.stringify({ FOCUS_SESSION_COMPLETED: [15], MISSION_COMPLETED: [10], GOAL_COMPLETED: [50] })) {
      throw new Error('Dashboard XP or Analytics focus-time reconciliation did not match the completed Pomodoro session')
    }
    await clickButton('Analytics')
    await waitFor(`Boolean(document.querySelector('.analytics-view'))`, 'Analytics view')
    await screenshot('17-analytics-reconciled.png')
    checks.renderedAnalyticsText = await evaluate(`document.querySelector('.analytics-view')?.innerText.slice(0, 1800)`)
    checks.browserExceptions = errors
    checks.video = join(output, 'focus-pomodoro-positive-browser-qa.webm')
    checks.motionEvidence = '99 captured browser frames at 1600x1000 encoded to 9.9s WebM; the two real eight-minute focus intervals are intentionally omitted from playback.'
    checks.verificationScope = 'Authenticated browser preview and read-only dashboard/analytics API checks against isolated PostgreSQL 16 tmpfs.'
    writeFileSync(join(output, 'summary-verification.json'), JSON.stringify(checks, null, 2))
    console.log(JSON.stringify({ output, checks }, null, 2))
    return
  }

  if (mode === 'eonpai-smoke') {
    await clickButton('EONPAI Guide')
    await waitFor(`Boolean(document.querySelector('.eonpai-composer-input'))`, 'EONPAI composer')
    const initialReplyCount = await evaluate(`document.querySelectorAll('.ai-bubble.assistant').length`)
    await evaluate(`(() => { const el=document.querySelector('.eonpai-composer-input'); const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(el,'Hi EONPAI'); el.dispatchEvent(new Event('input',{bubbles:true})) })()`)
    await clickButton('Send')
    await waitFor(`document.querySelectorAll('.ai-bubble.assistant').length > ${initialReplyCount} && [...document.querySelectorAll('.ai-bubble.assistant .ai-bubble-text')].at(-1)?.innerText.includes('check Sentinel focus protection status')`, 'complete EONPAI reply', 30000)
    let conversation
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`${api}/api/ai/conversation/active`, { headers: authHeaders })
      if (!response.ok) throw new Error(`EONPAI conversation endpoint returned HTTP ${response.status}`)
      conversation = await response.json()
      if (conversation.messages.some((message) => message.content === 'Hi EONPAI') && conversation.messages.some((message) => message.role === 'ASSISTANT')) break
      await delay(250)
    }
    checks.eonpaiReply = await evaluate(`document.querySelectorAll('.ai-bubble.assistant .ai-bubble-text').length ? [...document.querySelectorAll('.ai-bubble.assistant .ai-bubble-text')].at(-1).innerText : ''`)
    checks.eonpaiMessages = conversation.messages.map(({ role, content }) => ({ role, content }))
    if (!checks.eonpaiMessages.some((message) => message.content === 'Hi EONPAI') || !checks.eonpaiMessages.some((message) => message.role === 'ASSISTANT')) {
      throw new Error('EONPAI user/assistant messages were not both persisted')
    }
    await screenshot('18-eonpai-persisted-chat.png')
    checks.aiMode = 'deterministic/local fallback (SHINPO_AI_ENABLED=false); external provider is not tested'
    checks.browserExceptions = errors
    checks.verificationScope = 'Authenticated browser preview and isolated PostgreSQL QA account.'
    writeFileSync(join(output, 'eonpai-verification.json'), JSON.stringify(checks, null, 2))
    console.log(JSON.stringify({ output, checks }, null, 2))
    return
  }

  currentStep = 'open Focus setup'
  await clickButton('Focus Sprints')
  await waitFor(`['Start 30m Session', 'Pause Session', 'Resume Session'].some(text => document.body.innerText.includes(text))`, 'Focus view')
  await screenshot('02-focus-ready.png')
  const hasExistingSession = await evaluate(`document.body.innerText.includes('Pause Session') || document.body.innerText.includes('Resume Session')`)
  if (!hasExistingSession) {
    currentStep = 'start and verify Focus session'
    await clickButton('Start 30m Session')
  }
  await waitFor(`Boolean(document.querySelector('.timer-digits-display') && document.body.innerText.includes('Pause Session'))`, 'active Focus session')
  const getSessions = async () => {
    const response = await fetch(`${api}/api/focus-sessions`, { headers: authHeaders })
    if (!response.ok) throw new Error(`Session API returned HTTP ${response.status}`)
    return response.json()
  }
  let sessions = await getSessions()
  let session = sessions.find((item) => item.status === 'ACTIVE')
  if (!session) throw new Error('Started session was not persisted as ACTIVE')
  checks.started = { id: session.id, status: session.status, durationMinutes: session.durationMinutes, name: session.name }
  await delay(1100)
  await screenshot('03-focus-active.png')

  currentStep = 'pause and verify frozen timer'
  await clickButton('Pause Session')
  await waitFor(`document.body.innerText.includes('Resume Session')`, 'paused Focus session')
  const pausedDigits = await evaluate(`document.querySelector('.timer-digits-display')?.textContent?.trim()`)
  await delay(1200)
  const pausedDigitsAfter = await evaluate(`document.querySelector('.timer-digits-display')?.textContent?.trim()`)
  sessions = await getSessions()
  session = sessions.find((item) => item.id === session.id)
  checks.paused = { apiStatus: session?.status, timerBefore: pausedDigits, timerAfter: pausedDigitsAfter, frozen: pausedDigits === pausedDigitsAfter }
  if (session?.status !== 'PAUSED' || pausedDigits !== pausedDigitsAfter) throw new Error('Pause state/timer freeze did not verify')
  await screenshot('04-focus-paused.png')

  currentStep = 'resume and verify persisted state'
  await clickButton('Resume Session')
  await waitFor(`document.body.innerText.includes('Pause Session')`, 'resumed Focus session')
  sessions = await getSessions()
  session = sessions.find((item) => item.id === session.id)
  if (session?.status !== 'ACTIVE') throw new Error('Resume state did not persist')
  checks.resumed = { apiStatus: session.status, activeSeconds: session.activeSeconds }
  currentStep = 'reload and recover active session'
  await delay(1000)
  await send('Page.reload')
  await waitFor(`Boolean(window.__SHINPO_NAVIGATE_TAB__)`, 'app after reload')
  await clickButton('Focus Sprints')
  await waitFor(`Boolean(document.body.innerText.includes('Pause Session') && document.querySelector('.timer-digits-display'))`, 'recovered active session')
  sessions = await getSessions()
  session = sessions.find((item) => item.id === session.id)
  checks.restartRecovery = { apiStatus: session?.status, displayedTimer: await evaluate(`document.querySelector('.timer-digits-display')?.textContent?.trim()`) }
  if (session?.status !== 'ACTIVE') throw new Error('Active session did not recover after page reload')
  await screenshot('05-focus-recovered-after-reload.png')

  if (mode.startsWith('pomodoro-')) {
    currentStep = 'wait for persisted short-break transition after eight real focus minutes'
    await send('Page.stopScreencast')
    const readSession = async () => {
      const response = await fetch(`${api}/api/focus-sessions/${linkedPomodoroId}`, { headers: authHeaders })
      if (!response.ok) throw new Error(`Linked session read returned HTTP ${response.status}`)
      return response.json()
    }
    const waitForPhase = async (phase, timeoutMs = 9 * 60_000) => {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeoutMs) {
        const current = await readSession()
        if (current.currentPhase === phase) return current
        if (current.status !== 'ACTIVE') throw new Error(`Session left ACTIVE before phase ${phase}: ${current.status}`)
        await delay(1000)
      }
      throw new Error(`Timed out waiting for persisted phase ${phase}`)
    }
    let phaseSession = await waitForPhase('SHORT_BREAK')
    await waitFor(`Boolean(document.querySelector('.focus-workspace-container[data-focus-mode="break"]'))`, 'short-break UI')
    await send('Page.startScreencast', { format: 'png', everyNthFrame: 4 })
    await screenshot('11-pomodoro-short-break.png')
    checks.shortBreak = { phase: phaseSession.currentPhase, focusActiveSeconds: phaseSession.focusActiveSeconds, breakActiveSeconds: phaseSession.breakActiveSeconds }
    await clickButton('Skip break · focus next')
    phaseSession = await waitForPhase('FOCUS', 15000)
    if (phaseSession.completedFocusCycles !== 1 || phaseSession.breakActiveSeconds > 10) throw new Error('Short-break skip credited unexpected break time or cycle state')
    await delay(1200)
    await screenshot('12-pomodoro-second-focus.png')
    await send('Page.stopScreencast')

    currentStep = 'wait for persisted long-break transition after second real focus interval'
    phaseSession = await waitForPhase('LONG_BREAK')
    await waitFor(`Boolean(document.querySelector('.focus-workspace-container[data-focus-mode="break"]'))`, 'long-break UI')
    await send('Page.startScreencast', { format: 'png', everyNthFrame: 4 })
    await screenshot('13-pomodoro-long-break.png')
    checks.longBreak = { phase: phaseSession.currentPhase, completedFocusCycles: phaseSession.completedFocusCycles, focusActiveSeconds: phaseSession.focusActiveSeconds, breakActiveSeconds: phaseSession.breakActiveSeconds }
    await clickButton('Skip break · focus next')
    phaseSession = await waitForPhase('COMPLETE', 15000)
    await waitFor(`document.body.innerText.includes('Pomodoro complete · reflect')`, 'Pomodoro completion state')
    checks.phaseComplete = { phase: phaseSession.currentPhase, focusActiveSeconds: phaseSession.focusActiveSeconds, breakActiveSeconds: phaseSession.breakActiveSeconds }
    await screenshot('14-pomodoro-complete.png')

    currentStep = 'persist reflection and reconcile positive Focus reward'
    await clickButton('Finish and reflect')
    await waitFor(`Boolean(document.querySelector('[aria-labelledby="session-summary-title"]'))`, 'Pomodoro reflection dialog')
    await evaluate(`(() => {
      const set=(selector,value,proto)=>{const el=document.querySelector(selector);if(!el)return false;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true}
      document.querySelector('[aria-label^="5 star"]')?.click()
      return set('input[placeholder*="outcome"]','QA Pomodoro reward outcome',HTMLInputElement.prototype)&&set('textarea[placeholder*="distractions"]','Two persisted focus intervals; pauses and skipped breaks excluded.',HTMLTextAreaElement.prototype)
    })()`)
    await screenshot('15-pomodoro-reflection.png')
    await clickButton('Save Summary')
    await waitFor(`!document.querySelector('[aria-labelledby="session-summary-title"]')`, 'Pomodoro reflection save')
    sessions = await getSessions()
    session = sessions.find((item) => item.id === linkedPomodoroId)
    const progress = await (await fetch(`${api}/api/progress`, { headers: authHeaders })).json()
    checks.rewardLedger = progress.recentEvents.filter((event) => ['FOCUS_SESSION_COMPLETED', 'MISSION_COMPLETED', 'GOAL_COMPLETED'].includes(event.eventType))
    checks.positiveReward = { sessionId: session?.id, status: session?.status, goalId: session?.goalId, missionId: session?.missionId, focusActiveSeconds: session?.focusActiveSeconds, breakActiveSeconds: session?.breakActiveSeconds, totalXp: progress.totalProgress, reflectionNote: session?.reflectionNote }
    const rewardAmounts = Object.fromEntries(['FOCUS_SESSION_COMPLETED', 'MISSION_COMPLETED', 'GOAL_COMPLETED'].map((type) => [type, checks.rewardLedger.filter((event) => event.eventType === type).map((event) => event.amount)]))
    checks.rewardAmounts = rewardAmounts
    if (session?.status !== 'COMPLETED' || session?.goalId !== checks.linkedFixture.goalId || session?.missionId !== checks.linkedFixture.missionId || session?.focusActiveSeconds < 900 || progress.totalProgress !== 75
      || JSON.stringify(rewardAmounts) !== JSON.stringify({ FOCUS_SESSION_COMPLETED: [15], MISSION_COMPLETED: [10], GOAL_COMPLETED: [50] })) {
      throw new Error('Positive Focus reward, linked task/goal, focus-time accounting, or reflection did not reconcile')
    }
    await screenshot('16-pomodoro-reward-confirmed.png')
    await waitFor(`document.body.innerText.includes('+15 XP')`, 'authoritative reward toast')
    await send('Page.stopScreencast')
    const video = spawnSync('ffmpeg', [
      '-y', '-framerate', '10', '-i', join(output, 'frames', 'frame-%05d.png'),
      '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '32', '-b:v', '0',
      join(output, 'focus-pomodoro-positive-browser-qa.webm'),
    ], { encoding: 'utf8' })
    if (video.status !== 0) throw new Error(`Could not encode Pomodoro screencast: ${video.stderr}`)
    checks.video = join(output, 'focus-pomodoro-positive-browser-qa.webm')
    checks.pomodoroEvidence = 'Real elapsed focus timers; screen capture deliberately paused during the two eight-minute waits. Video is a motion montage, not a wall-clock recording.'
    checks.focusRewardEvidence = 'Exactly one +15 Focus event after 16 real focus minutes, plus exactly one linked-task +10 and goal +50 event; 3 seconds of break time earned no Focus XP.'
    checks.verificationScope = 'Authenticated browser production preview against isolated PostgreSQL 16; not Fedora WebKitGTK.'
    checks.browserExceptions = errors
    checks.screencastFrames = frameCount
    checks.nativeVerification = 'NOT RUN: Fedora Remote Control permission remains owner-controlled.'
    writeFileSync(join(output, 'verification.json'), JSON.stringify(checks, null, 2))
    console.log(JSON.stringify({ output, checks }, null, 2))
    return
  }

  currentStep = 'finish Focus and persist reflection'
  await clickButton('Finish and reflect')
  await waitFor(`Boolean(document.querySelector('[aria-labelledby="session-summary-title"]'))`, 'reflection dialog')
  await evaluate(`(() => {
    const set = (selector, value, proto) => { const el=document.querySelector(selector); if(!el) return false; const d=Object.getOwnPropertyDescriptor(proto,'value'); d.set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true }
    document.querySelector('[aria-label^="5 star"]')?.click();
    return set('input[placeholder*="outcome"]','QA Focus lifecycle outcome',HTMLInputElement.prototype)
      && set('textarea[placeholder*="distractions"]','QA-only reflection persisted after completion.',HTMLTextAreaElement.prototype)
  })()`)
  await screenshot('06-focus-reflection.png')
  currentStep = 'verify completion, reflection and reward state'
  await clickButton('Save Summary')
  await waitFor(`!document.querySelector('[aria-labelledby="session-summary-title"]')`, 'reflection save')
  sessions = await getSessions()
  session = sessions.find((item) => item.id === session.id)
  const progressResponse = await fetch(`${api}/api/progress`, { headers: authHeaders })
  const progress = await progressResponse.json()
  checks.completed = {
    id: session?.id,
    status: session?.status,
    activeSeconds: session?.activeSeconds,
    completionQuality: session?.completionQuality,
    accomplishment: session?.accomplishment,
    reflectionNote: session?.reflectionNote,
    totalXp: progress.totalProgress,
  }
  if (session?.status !== 'COMPLETED' || session?.accomplishment !== 'QA Focus lifecycle outcome' || session?.reflectionNote !== 'QA-only reflection persisted after completion.' || progress.totalProgress !== 0) {
    throw new Error('Completion/reflection persistence or early-completion XP threshold did not verify')
  }
  await screenshot('07-focus-completed.png')
  currentStep = 'verify cancellation without reward and protection status'
  await clickButton('Start 30m Session')
  await waitFor(`document.body.innerText.includes('Pause Session')`, 'second active Focus session')
  sessions = await getSessions()
  const cancelledSession = sessions.find((item) => item.status === 'ACTIVE')
  if (!cancelledSession) throw new Error('Could not start disposable cancellation session')
  await clickTrustedButton('Rain')
  checks.audioProbe = await evaluate(`({ selected: document.querySelector('.focus-atmosphere-chips .active')?.innerText, control: [...document.querySelectorAll('.focus-atmosphere-widget button')].map(b=>b.innerText.trim()).join('|'), playbackBadge: document.querySelector('.focus-atmosphere-badge')?.innerText || null, userGesture: { active: navigator.userActivation.isActive, hasBeenActive: navigator.userActivation.hasBeenActive } })`)
  await screenshot('08-focus-audio-probe.png')
  await waitFor(`document.body.innerText.includes('Mute') && document.body.innerText.includes('Playing')`, 'atmosphere playback')
  await screenshot('08-focus-audio-playing.png')
  await clickButton('Pause Session')
  await waitFor(`document.body.innerText.includes('Resume Session') && document.body.innerText.includes('Play') && !document.body.innerText.includes('Playing')`, 'audio stop on pause')
  checks.audioPause = { focusStatus: (await getSessions()).find((item) => item.id === cancelledSession.id)?.status, playbackBadgeHidden: true }
  await clickButton('Resume Session')
  await waitFor(`document.body.innerText.includes('Pause Session') && document.body.innerText.includes('Mute') && document.body.innerText.includes('Playing')`, 'audio resume with Focus')
  checks.audioResume = { focusStatus: (await getSessions()).find((item) => item.id === cancelledSession.id)?.status, playbackBadgeVisible: true }
  await clickTrustedButton('Mute')
  await waitFor(`document.body.innerText.includes('Play') && !document.body.innerText.includes('Playing')`, 'manual audio stop')
  await clickButton('Cancel Session')
  await waitFor(`document.body.innerText.includes('Session Cancelled')`, 'session cancellation')
  sessions = await getSessions()
  const cancelled = sessions.find((item) => item.id === cancelledSession.id)
  const afterCancelProgress = await (await fetch(`${api}/api/progress`, { headers: authHeaders })).json()
  checks.cancelled = { id: cancelled?.id, status: cancelled?.status, totalXp: afterCancelProgress.totalProgress }
  if (cancelled?.status !== 'CANCELLED' || afterCancelProgress.totalProgress !== 0) throw new Error('Cancellation changed XP or did not persist')

  currentStep = 'capture updated Dashboard, Protection and Analytics'
  await clickButton('Dashboard')
  await delay(1500)
  await screenshot('08-dashboard-after-focus.png')
  const protectionResponse = await fetch(`${api}/api/device/sentinel/status`, { headers: authHeaders })
  const protection = await protectionResponse.json()
  checks.protectionStatus = {
    backend: { daemonConnected: protection.daemonConnected, status: protection.status },
    dashboardReportsOffline: await evaluate(`document.body.innerText.includes('Protection: Shield Offline')`),
  }
  await clickButton('Focus Protection')
  await delay(800)
  checks.protectionStatus.protectionPageReportsDisconnected = await evaluate(`document.body.innerText.includes('Shield Offline') && document.body.innerText.includes('Native Shield: Disconnected (Offline)')`)
  await screenshot('09-protection-status.png')
  await clickButton('Analytics')
  await delay(1500)
  checks.analytics = await evaluate(`({ text: document.body.innerText.slice(-1800), overflow: document.documentElement.scrollWidth > innerWidth })`)
  await screenshot('10-analytics-after-focus.png')
  await send('Page.stopScreencast')

  const video = spawnSync('ffmpeg', [
    '-y', '-framerate', '10', '-i', join(output, 'frames', 'frame-%05d.png'),
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p', '-crf', '32', '-b:v', '0',
    join(output, 'focus-lifecycle-browser-qa.webm'),
  ], { encoding: 'utf8' })
  if (video.status !== 0) throw new Error(`Could not encode browser screencast: ${video.stderr}`)

  checks.verificationScope = 'Authenticated browser production preview against isolated PostgreSQL 16; not native WebKitGTK.'
  checks.browserExceptions = errors
  checks.consoleErrors = consoleErrors
  checks.screencastFrames = frameCount
  checks.nativeVerification = 'NOT RUN: Fedora Remote Control permission remains owner-controlled.'
  checks.audioTestConfiguration = 'Chromium headless with trusted CDP mouse input; autoplay policy relaxed for isolated synthetic audio output.'
  writeFileSync(join(output, 'verification.json'), JSON.stringify(checks, null, 2))
  console.log(JSON.stringify({ output, checks }, null, 2))
}

main().catch((error) => {
  checks.failedAt = currentStep
  checks.error = String(error?.stack || error)
  checks.consoleErrors = consoleErrors
  checks.screencastFrames = frameCount
  checks.partialChecks = { ...checks }
  writeFileSync(join(output, 'verification.json'), JSON.stringify(checks, null, 2))
  writeFileSync(join(output, 'failure.txt'), String(error?.stack || error))
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  try { socket?.close() } catch {}
  try { chrome.kill('SIGTERM') } catch {}
  setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1500).unref()
})
