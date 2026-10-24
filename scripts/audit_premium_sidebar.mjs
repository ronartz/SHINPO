import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const appUrl = new URL(process.env.SHINPO_URL ?? 'http://127.0.0.1:4173')
const apiUrl = new URL(process.env.SHINPO_API_URL ?? 'http://127.0.0.1:18081')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname), 'QA API must be loopback-only')
assert.ok(!['5432', '8080'].includes(apiUrl.port), 'Refusing to write to a personal API or PostgreSQL port')

const username = process.env.SHINPO_QA_USERNAME ?? `premium_sidebar_${Date.now()}`
const password = process.env.SHINPO_QA_PASSWORD ?? 'Password123!'
const isExistingQaAccount = Boolean(process.env.SHINPO_QA_USERNAME)
const registration = await fetch(new URL(isExistingQaAccount ? '/api/auth/login' : '/api/auth/register', apiUrl), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(isExistingQaAccount ? { usernameOrEmail: username, password } : { username, email: `${username}@shinpo.local`, password }),
})
assert.ok(registration.ok, `Disposable QA ${isExistingQaAccount ? 'login' : 'registration'} failed: HTTP ${registration.status}`)
const auth = await registration.json()
const profile = await mkdtemp(join(tmpdir(), 'shinpo-premium-sidebar-chrome-'))
const captures = await mkdtemp(join(tmpdir(), 'shinpo-premium-sidebar-captures-'))
const framesDir = join(captures, 'motion-frames')
await mkdir(framesDir)
const port = 9422
const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-sandbox', '--disable-extensions',
  '--disable-dev-shm-usage', `--user-data-dir=${profile}`, `${appUrl}?theme=dark`,
], { stdio: 'ignore', detached: true })
let socket
let frameWrites = []
let frameIndex = 0
const frameTimes = []
const browserErrors = []
const networkFailures = []

try {
  let page
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(250)
    try {
      page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()))
        .find((item) => item.type === 'page' && item.url.startsWith(appUrl.origin))
    } catch { /* Chromium is starting. */ }
  }
  assert.ok(page?.webSocketDebuggerUrl, 'Headless Chromium did not open the production preview')
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
    if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
      networkFailures.push({ status:message.params.response.status, path:new URL(message.params.response.url).pathname, type:message.params.type })
    }
    if (message.method === 'Page.screencastFrame') {
      const index = frameIndex++
      frameTimes.push(message.params.metadata.timestamp)
      frameWrites.push(writeFile(join(framesDir, `frame-${String(index).padStart(4, '0')}.png`), Buffer.from(message.params.data, 'base64')))
      socket.send(JSON.stringify({ id: nextId++, method: 'Page.screencastFrameAck', params: { sessionId: message.params.sessionId } }))
    }
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id)
      pending.delete(message.id)
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message)
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
  const pointFor = async (selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r && { x:r.left+r.width/2, y:r.top+r.height/2 }; })()`)
  const click = async (point) => {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 })
  }
  const clickSelector = async (selector) => {
    const point = await pointFor(selector)
    assert.ok(point, `Missing control: ${selector}`)
    await click(point)
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await sleep(600)
  await evaluate(`(() => {
    localStorage.setItem('shinpo_custom_server_url', ${JSON.stringify(apiUrl.origin)});
    localStorage.setItem('shinpo_access_token', ${JSON.stringify(auth.accessToken)});
    localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(auth.refreshToken)});
    localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
    localStorage.setItem('shinpo_sidebar_pinned', 'false');
  })()`)
  await send('Page.reload')
  let onboarding
  const readOnboarding = () => evaluate(`fetch(${JSON.stringify(new URL('/api/onboarding', apiUrl).toString())}, { headers:{ Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)} } }).then(r=>r.json())`)
  if (!isExistingQaAccount) {
    let tutorialReady = false
    for (let i = 0; i < 60 && !tutorialReady; i++) {
      await sleep(250)
      tutorialReady = await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))")
    }
    assert.ok(tutorialReady, 'Fresh account tutorial did not open')
    await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }))")
    await sleep(100)
    assert.equal(await evaluate("Boolean(document.querySelector('#tutorial-confirm-skip-btn'))"), true)
    await evaluate("document.querySelector('#tutorial-confirm-skip-btn').click()")
    for (let i = 0; i < 60 && await evaluate("Boolean(document.querySelector('.shinpo-tutorial-portal'))"); i++) await sleep(100)
    for (let i=0;i<30;i++) {
      onboarding=await readOnboarding()
      if(onboarding.status==='SKIPPED') break
      await sleep(100)
    }
    assert.equal(onboarding.status, 'SKIPPED', 'Fresh-account skip did not persist in disposable PostgreSQL')
  } else {
    onboarding = await readOnboarding()
    assert.equal(onboarding.status, 'SKIPPED', 'Existing QA account onboarding state changed unexpectedly')
  }
  await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button)=>button.dataset.tab==='Dashboard')?.click()")
  let dashboardReady = false
  for (let i=0;i<60&&!dashboardReady;i++) {
    await sleep(250)
    dashboardReady = await evaluate("document.querySelector('.page-header-info')?.innerText.includes('Execution Cockpit') && /Good (?:morning|afternoon|evening),/.test(document.body.innerText)")
  }
  assert.ok(dashboardReady,'Dashboard did not settle after first-use onboarding')

  const sidebar = '.icon-sidebar'
  const toggle = '.sidebar-toggle-btn'
  const initial = await evaluate(`(() => {
    const rail=document.querySelector(${JSON.stringify(sidebar)}), main=document.querySelector('.app-main');
    return { width:rail.getBoundingClientRect().width, left:rail.getBoundingClientRect().left, right:rail.getBoundingClientRect().right, mainLeft:main.getBoundingClientRect().left, expanded:document.querySelector(${JSON.stringify(toggle)}).getAttribute('aria-expanded'), aurora:document.querySelector('.app-shell')?.classList.contains('theme-aurora'), dashboard:/Good (?:morning|afternoon|evening),/.test(document.body.innerText) };
  })()`)
  assert.equal(initial.width, 72, `Expected collapsed 72px rail: ${JSON.stringify(initial)}`)
  assert.equal(initial.expanded, 'false')
  assert.equal(initial.aurora, true, 'Sidebar audit must exercise the actual Aurora app shell')
  assert.ok(initial.mainLeft >= initial.right + 15, `Dashboard overlaps floating sidebar: ${JSON.stringify(initial)}`)
  assert.equal(initial.dashboard, true, 'Dashboard must render beside the collapsed rail')
  assert.equal(await evaluate("document.querySelectorAll('.sidebar-btn').length"), 8, 'Expected seven SHINPO views plus real Settings entry')
  assert.equal(await evaluate(`document.querySelector('.sidebar-profile-name')?.textContent`), auth.user.username, 'Profile footer must use signed-in account data')
  await screenshot('01-collapsed-dashboard-dark')
  const compactCenters = await evaluate(`(() => { const selectors=['.sidebar-brand-mark','.sidebar-toggle-btn','.sidebar-btn[data-tab="Dashboard"] .sidebar-btn-icon','.sidebar-protection-collapsed .protection-shield-box','.sidebar-profile-avatar']; const rail=document.querySelector('.icon-sidebar').getBoundingClientRect(); return Object.fromEntries(selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,Math.abs(r.left+r.width/2-(rail.left+rail.width/2))]})); })()`)
  assert.ok(Object.values(compactCenters).every((delta)=>delta<1),`Compact rail controls do not share one center axis: ${JSON.stringify(compactCenters)}`)

  const hoverItem = '.sidebar-btn[data-tab="Dashboard"]'
  const collapsedPoint = await pointFor(hoverItem)
  await send('Input.dispatchMouseEvent', { type:'mouseMoved', ...collapsedPoint })
  let hoverExpanded
  for (let attempt=0; attempt<20; attempt++) {
    hoverExpanded = await evaluate(`(() => { const rail=document.querySelector('.icon-sidebar'),main=document.querySelector('.app-main'),label=document.querySelector('.sidebar-btn-label'); return {width:rail.getBoundingClientRect().width,mainLeft:main.getBoundingClientRect().left,expanded:document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded'),hover:rail.classList.contains('hover-expanded'),labelOpacity:getComputedStyle(label).opacity,quoteHidden:document.querySelector('.sidebar-upper-quote').getAttribute('aria-hidden')}; })()`)
    if (Math.abs(hoverExpanded.width-260)<1 && Math.abs(hoverExpanded.mainLeft-292)<1) break
    await sleep(50)
  }
  assert.ok(Math.abs(hoverExpanded.width-260)<1,`Hover did not expand the desktop rail: ${JSON.stringify(hoverExpanded)}`)
  assert.ok(Math.abs(hoverExpanded.mainLeft-292)<1,`Dashboard did not move beside the expanded rail: ${JSON.stringify(hoverExpanded)}`)
  assert.equal(hoverExpanded.expanded,'true')
  assert.equal(hoverExpanded.hover,true)
  assert.ok(Number(hoverExpanded.labelOpacity)>0.95,`Hover labels are not visible: ${JSON.stringify(hoverExpanded)}`)
  assert.equal(hoverExpanded.quoteHidden,'false')
  await screenshot('02-hover-expanded-dashboard-dark')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1210,y:760})
  await sleep(330)
  const hoverCollapsed = await evaluate(`(() => {const r=document.querySelector('.icon-sidebar'),m=document.querySelector('.app-main'); return {width:r.getBoundingClientRect().width,mainLeft:m.getBoundingClientRect().left,expanded:document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded'),hover:r.classList.contains('hover-expanded')};})()`)
  assert.equal(hoverCollapsed.width,72,`Pointer leave did not collapse the rail: ${JSON.stringify(hoverCollapsed)}`)
  assert.equal(hoverCollapsed.mainLeft,104,`Dashboard did not return after pointer leave: ${JSON.stringify(hoverCollapsed)}`)
  assert.equal(hoverCollapsed.expanded,'false')
  assert.equal(hoverCollapsed.hover,false)

  await send('Page.startScreencast', { format:'png', maxWidth:1280, maxHeight:800, everyNthFrame:1 })
  const motionMarks = {}
  const mark = (name) => { motionMarks[name] = { frame:frameIndex, timestamp:frameTimes.at(-1) ?? null } }
  const frameMeasurePromise = evaluate(`new Promise(resolve => {
    const start=performance.now(), gaps=[]; let previous=0;
    function tick(now) { if(previous) gaps.push(now-previous); previous=now; if(now-start<420) requestAnimationFrame(tick); else { const sorted=[...gaps].sort((a,b)=>a-b); resolve({frames:gaps.length,p95:sorted[Math.ceil(sorted.length*.95)-1] ?? null,within33Percent:gaps.length?gaps.filter(n=>n<=33.3).length/gaps.length*100:0}); } }
    requestAnimationFrame(tick);
  })`)
  const widthTransitionPromise = evaluate(`new Promise(resolve => {
    const rail=document.querySelector('.icon-sidebar'), start=performance.now();
    const done=event=>{ if(event.target===rail&&event.propertyName==='width'){ rail.removeEventListener('transitionend',done); resolve(performance.now()-start); } };
    rail.addEventListener('transitionend',done);
    setTimeout(()=>{ rail.removeEventListener('transitionend',done); resolve(null); },800);
  })`)
  mark('expand-start')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...collapsedPoint})
  const [frameMeasure,widthTransitionMs] = await Promise.all([frameMeasurePromise,widthTransitionPromise])
  await sleep(80)
  mark('expand-end')
  const expanded = await evaluate(`(() => {
    const rail=document.querySelector(${JSON.stringify(sidebar)}), main=document.querySelector('.app-main'), label=document.querySelector('.sidebar-btn-label'), active=document.querySelector('.sidebar-btn.active'), marker=document.querySelector('.sidebar-active-indicator');
    return {width:rail.getBoundingClientRect().width,left:rail.getBoundingClientRect().left,right:rail.getBoundingClientRect().right,mainLeft:main.getBoundingClientRect().left,expanded:document.querySelector(${JSON.stringify(toggle)}).getAttribute('aria-expanded'),labelOpacity:getComputedStyle(label).opacity,labelHidden:label.getAttribute('aria-hidden'),marker: getComputedStyle(marker).backgroundImage,activeCenter:active.getBoundingClientRect().top+active.offsetHeight/2,markerCenter:marker.getBoundingClientRect().top+marker.offsetHeight/2};
  })()`)
  assert.equal(expanded.width, 260)
  assert.ok(expanded.mainLeft >= expanded.right + 15, `Workspace not reserved next to the expanded panel: ${JSON.stringify(expanded)}`)
  assert.equal(expanded.expanded, 'true')
  assert.ok(widthTransitionMs!==null&&widthTransitionMs<500,`Sidebar width transition did not settle promptly: ${widthTransitionMs}`)
  assert.ok(Number(expanded.labelOpacity) > 0.95 && expanded.labelHidden === null, `Expanded labels are not visible and accessible: ${JSON.stringify(expanded)}`)
  assert.ok(expanded.marker.includes('linear-gradient'), 'Active state must use the premium gradient pill')
  assert.ok(Math.abs(expanded.activeCenter-expanded.markerCenter) < 1, `Gradient selection is misaligned with active route: ${JSON.stringify(expanded)}`)
  await screenshot('02-expanded-dashboard-dark')

  const goalsPoint=await pointFor('.sidebar-btn[data-tab="Goals & Missions"]')
  await click(goalsPoint)
  await sleep(280)
  mark('selection')
  await screenshot('03-active-goals-dark')
  const selectedRoute = await evaluate("document.querySelector('.sidebar-btn.active')?.dataset.tab")
  assert.equal(selectedRoute,'Goals & Missions','Reference motion selection did not navigate to Goals')
  mark('collapse-start')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1210,y:760})
  await sleep(330)
  assert.equal(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')"),'false','Pointer navigation focus incorrectly kept the hover-expanded rail open')
  assert.equal(await evaluate("document.activeElement?.dataset.tab"),'Goals & Missions','Pointer leave should preserve focus on the selected route')
  mark('collapse-end')
  await screenshot('04-collapsed-after-selection-dark')
  const collapsedMarker = await evaluate(`(() => { const a=document.querySelector('.sidebar-btn.active').getBoundingClientRect(),m=document.querySelector('.sidebar-active-indicator').getBoundingClientRect(); return {active:document.querySelector('.sidebar-btn.active').dataset.tab, activeWidth:a.width, markerWidth:m.width, delta:Math.abs(a.top+a.height/2-(m.top+m.height/2))}; })()`)
  assert.equal(collapsedMarker.active,'Goals & Missions')
  assert.equal(Math.round(collapsedMarker.markerWidth),44,'Collapsed selected destination must become a compact violet tile')
  await send('Page.stopScreencast')
  await Promise.all(frameWrites)
  frameWrites=[]

  const accountPoint = await pointFor('.sidebar-profile')
  await clickSelector(toggle)
  await sleep(280)
  assert.ok(accountPoint, 'Real account footer is missing')
  await click(await pointFor('.sidebar-profile'))
  await sleep(120)
  assert.equal(await evaluate(`Boolean(document.querySelector('.settings-modal[aria-modal="true"]'))`), true, 'Profile footer did not open the real Account settings modal')
  await evaluate("document.querySelector('.settings-modal-close')?.click()")
  await sleep(100)
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await pointFor('.sidebar-btn[data-tab="Dashboard"]')})
  await sleep(120)
  await clickSelector('.sidebar-settings-btn')
  await sleep(100)
  assert.equal(await evaluate(`Boolean(document.querySelector('.settings-modal[aria-modal="true"]'))`), true, 'Settings navigation did not open the real settings modal')
  await evaluate("document.querySelector('.settings-modal-close')?.click()")
  await sleep(100)

  const expectedHeaders = {
    Dashboard:'Execution Cockpit', 'Goals & Missions':'Goals & Tasks', 'Focus Engine':'Focus Sprint Arena',
    Schedule:'Calendar Schedule', Analytics:'Performance Analytics', 'Task Manager':'Focus Protection Sentinel',
    'AI Assistant':'EONPAI Cognitive Guide',
  }
  const routeKeys = Object.keys(expectedHeaders)
  const navigationChecks = []
  const structureBeforeCycles=await evaluate("JSON.stringify({sidebar:document.querySelectorAll('.icon-sidebar').length,nav:document.querySelectorAll('.sidebar-btn').length})")
  for (let i=0;i<30;i++) {
    const tab=routeKeys[i%routeKeys.length]
    await evaluate(`Array.from(document.querySelectorAll('.sidebar-btn')).find((button)=>button.dataset.tab===${JSON.stringify(tab)})?.click()`)
    await sleep(115)
    const route=await evaluate("document.querySelector('.sidebar-btn.active')?.dataset.tab")
    assert.equal(route,tab,`Navigation ${i+1} lost or misrouted ${tab}`)
    const header=await evaluate("document.querySelector('.page-header-info')?.innerText.trim()")
    assert.ok(header?.includes(expectedHeaders[tab]),`Wrong page header after navigation ${i+1}: ${header}`)
    navigationChecks.push(route)
  }
  await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button)=>button.dataset.tab==='Goals & Missions')?.click()")
  await sleep(200)
  const goalTitle=`QA goal ${Date.now()}`
  await clickSelector('[data-tutorial="new-goal"]')
  assert.equal(await evaluate("Boolean(document.querySelector('#create-goal-title'))"),true,'New Goal action did not open the goal form')
  await evaluate(`(() => {const el=document.querySelector('#create-goal-title');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(goalTitle)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await clickSelector('.modal-box form button[type="submit"]')
  const readGoals=()=>evaluate(`fetch(${JSON.stringify(new URL('/api/goals',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(r=>r.json())`)
  let createdGoal=(await readGoals()).find(goal=>goal.title===goalTitle)
  for(let i=0;i<20&&!createdGoal;i++){await sleep(150);createdGoal=(await readGoals()).find(goal=>goal.title===goalTitle)}
  assert.ok(createdGoal,'Created goal was not persisted by the backend')
  await evaluate(`[...document.querySelectorAll('.goal-card-item')].find(card=>card.innerText.includes(${JSON.stringify(goalTitle)}))?.querySelector('[title="Edit Goal"]')?.click()`)
  assert.equal(await evaluate("Boolean(document.querySelector('#edit-goal-title-input'))"),true,'Goal Edit action did not open the editor')
  const editedGoalTitle=`${goalTitle} edited`
  await evaluate(`(() => {const el=document.querySelector('#edit-goal-title-input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(editedGoalTitle)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await clickSelector('.modal-box form button[type="submit"]')
  let persistedEditedGoal=(await readGoals()).find(goal=>goal.id===createdGoal.id)
  for(let i=0;i<20&&persistedEditedGoal?.title!==editedGoalTitle;i++){await sleep(150);persistedEditedGoal=(await readGoals()).find(goal=>goal.id===createdGoal.id)}
  assert.equal(persistedEditedGoal?.title,editedGoalTitle,'Edited goal title did not persist')
  const taskTitle=`QA task ${Date.now()}`
  await clickSelector('[data-tutorial="new-task"]')
  assert.equal(await evaluate("Boolean(document.querySelector('#create-task-title-input'))"),true,'New Task action did not open the task form')
  await evaluate(`(() => {const el=document.querySelector('#create-task-title-input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(taskTitle)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await clickSelector('[role="dialog"] form button[type="submit"]')
  let createdTaskVisible=false
  for(let i=0;i<40&&!createdTaskVisible;i++){
    await sleep(150)
    createdTaskVisible=await evaluate(`[...document.querySelectorAll('.mission-list-row')].some(row=>row.innerText.includes(${JSON.stringify(taskTitle)}))`)
  }
  assert.equal(createdTaskVisible,true,'Created task did not appear in the List view')
  const editTaskTitle=`${taskTitle} edited`
  await evaluate(`[...document.querySelectorAll('.mission-list-row')].find(row=>row.innerText.includes(${JSON.stringify(taskTitle)}))?.querySelector('[title="Edit Task"]')?.click()`)
  assert.equal(await evaluate("Boolean(document.querySelector('#edit-task-title-input'))"),true,'Edit Task action did not open the editor')
  await evaluate(`(() => {const el=document.querySelector('#edit-task-title-input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(editTaskTitle)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const tomorrowDate=await evaluate("(() => {const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})()")
  await evaluate("document.querySelector('#edit-task-date-input').click()")
  assert.equal(await evaluate(`Boolean(document.querySelector('.shinpo-calendar-panel button[aria-label="${tomorrowDate}"]'))`),true,'Task date picker did not expose tomorrow as a selectable date')
  await evaluate(`document.querySelector('.shinpo-calendar-panel button[aria-label="${tomorrowDate}"]').click()`)
  await clickSelector('[role="dialog"] form button[type="submit"]')
  let editedTaskVisible=false
  for(let i=0;i<40&&!editedTaskVisible;i++){
    await sleep(150)
    editedTaskVisible=await evaluate(`[...document.querySelectorAll('.mission-list-row')].some(row=>row.innerText.includes(${JSON.stringify(editTaskTitle)}))`)
  }
  assert.equal(editedTaskVisible,true,'Edited task title did not update in the List view')
  await clickSelector('.view-mode-btn[title="Board View"]')
  const boardState=await evaluate(`(() => ({columns:document.querySelectorAll('.flight-deck-board-grid .status-column').length,taskVisible:[...document.querySelectorAll('.flight-deck-board-grid')].some(board=>board.innerText.includes(${JSON.stringify(editTaskTitle)})),overflow:document.documentElement.scrollWidth>innerWidth}))()`)
  assert.equal(boardState.columns,3,'Board view did not show the three task status lanes')
  assert.equal(boardState.taskVisible,true,'Edited task is missing from Board view')
  assert.equal(boardState.overflow,false,'Board view introduced horizontal overflow')
  await screenshot('goals-board-dark')
  await clickSelector('.view-mode-btn[title="List View"]')
  const taskRow=await evaluate(`Boolean([...document.querySelectorAll('.mission-list-row')].find(row=>row.innerText.includes(${JSON.stringify(editTaskTitle)})))`)
  assert.ok(taskRow,'Switching back to List lost the task')
  const progressBeforeCompletion=await evaluate(`fetch(${JSON.stringify(new URL('/api/progress',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(r=>r.json())`)
  await evaluate(`[...document.querySelectorAll('.mission-list-row')].find(row=>row.innerText.includes(${JSON.stringify(editTaskTitle)}))?.querySelector('.task-row-check-btn')?.click()`)
  let completedTaskVisible=false
  for(let i=0;i<40&&!completedTaskVisible;i++){
    await sleep(150)
    completedTaskVisible=await evaluate(`[...document.querySelectorAll('.mission-list-row.is-completed')].some(row=>row.innerText.includes(${JSON.stringify(editTaskTitle)}))`)
  }
  assert.equal(completedTaskVisible,true,'Task completion did not move the task to its completed state')
  const taskPersistence=await evaluate(`fetch(${JSON.stringify(new URL('/api/missions',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(async r=>({status:r.status,items:r.ok?await r.json():[]}))`)
  assert.equal(taskPersistence.status,200,'Could not verify persisted task state')
  const persistedTask=taskPersistence.items.find(item=>item.title===editTaskTitle)
  assert.equal(persistedTask?.status,'COMPLETED',`Edited task completion was not persisted: ${JSON.stringify(persistedTask)}`)
  assert.equal(persistedTask?.scheduledDate,tomorrowDate,`Task date edit was not persisted: ${JSON.stringify(persistedTask)}`)
  const progressAfterCompletion=await evaluate(`fetch(${JSON.stringify(new URL('/api/progress',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(r=>r.json())`)
  const priorEventIds=new Set(progressBeforeCompletion.recentEvents.map(event=>event.id))
  const taskReward=progressAfterCompletion.recentEvents.find(event=>!priorEventIds.has(event.id)&&event.eventType==='MISSION_COMPLETED')
  assert.equal(progressAfterCompletion.totalProgress-progressBeforeCompletion.totalProgress,10,'Task completion did not persist exactly +10 progress points')
  assert.equal(taskReward?.amount,10,`Task completion reward event was missing or incorrect: ${JSON.stringify(taskReward)}`)
  if(await evaluate("Boolean(document.querySelector('.celebration-modal-overlay'))")){
    await clickSelector('.celebration-modal-overlay .celebration-btn.primary')
    for(let i=0;i<30&&await evaluate("Boolean(document.querySelector('.celebration-modal-overlay'))");i++) await sleep(50)
  }
  const goalTaskFlow={createdGoal:createdGoal.title,editedGoal:persistedEditedGoal.title,createdTitle:taskTitle,editedTitle:editTaskTitle,scheduledDate:persistedTask.scheduledDate,boardState,persistedStatus:persistedTask.status,progressDelta:progressAfterCompletion.totalProgress-progressBeforeCompletion.totalProgress,rewardEvent:taskReward}
  await screenshot('goals-list-completed-dark')
  await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button)=>button.dataset.tab==='AI Assistant')?.click()")
  let eonpaiReady=false
  for(let i=0;i<40&&!eonpaiReady;i++){
    await sleep(150)
    eonpaiReady=Boolean(await pointFor('.eonpai-composer-input'))
  }
  assert.ok(eonpaiReady,'EONPAI composer did not mount after navigation')
  const initialEonpaiAssistantCount=await evaluate("document.querySelectorAll('.ai-bubble.assistant').length")
  await clickSelector('.eonpai-composer-input')
  await evaluate(`(() => {const el=document.querySelector('.eonpai-composer-input');const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(el,'Hi EONPAI');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  assert.equal(await evaluate("document.querySelector('.eonpai-composer-input')?.value"),'Hi EONPAI','EONPAI composer did not accept the test message')
  await clickSelector('.eonpai-composer-send-btn')
  let eonpaiReply=null
  for(let i=0;i<40&&!eonpaiReply;i++){
    await sleep(150)
    eonpaiReply=await evaluate(`document.querySelectorAll('.ai-bubble.user').length>0&&document.querySelectorAll('.ai-bubble.assistant').length>${initialEonpaiAssistantCount}?[...document.querySelectorAll('.ai-bubble.assistant .ai-bubble-text')].at(-1)?.innerText||null:null`)
  }
  const eonpaiPersisted=await evaluate(`fetch(${JSON.stringify(new URL('/api/ai/conversation/active',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(async r=>({status:r.status,body:r.ok?await r.json():null}))`)
  assert.equal(eonpaiPersisted.status,200,`EONPAI conversation endpoint failed: ${JSON.stringify(eonpaiPersisted)}`)
  assert.ok(eonpaiReply,`EONPAI did not append a new assistant reply; visible user messages: ${await evaluate("[...document.querySelectorAll('.ai-bubble.user')].map(el=>el.innerText)")}`)
  assert.ok(eonpaiPersisted.body.messages.some(message=>message.content==='Hi EONPAI')&&eonpaiPersisted.body.messages.some(message=>message.role==='ASSISTANT'),`EONPAI conversation did not persist both sides of the message: reply=${eonpaiReply}, messages=${JSON.stringify(eonpaiPersisted.body.messages)}`)
  assert.ok(eonpaiReply&&!eonpaiReply.includes("couldn't complete that request"),`EONPAI did not return a successful greeting: ${eonpaiReply}`)
  const eonpaiCheck={reply:eonpaiReply,persistedMessages:eonpaiPersisted.body.messages.length}
  await screenshot('eonpai-greeting-dark')
  await screenshot('06-after-30-navigation-dark')

  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1210,y:760})
  await sleep(330)
  await evaluate("document.querySelector('.sidebar-toggle-btn').focus()")
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'})
  await sleep(280)
  assert.equal(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')"),'true','Keyboard Enter did not expand the sidebar')
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'})
  await sleep(280)
  assert.equal(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')"),'false','Escape did not collapse the expanded sidebar')
  assert.equal(await evaluate("document.activeElement?.className"),'sidebar-toggle-btn','Escape must preserve focus on the toggle')

  for (let i=0;i<30;i++) {
    await evaluate("document.querySelector('.sidebar-toggle-btn').click()")
    await sleep(270)
    assert.equal(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')"),'true',`Open cycle ${i+1} failed`)
    await evaluate("document.querySelector('.sidebar-toggle-btn').click()")
    await sleep(270)
    assert.equal(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')"),'false',`Close cycle ${i+1} failed`)
  }
  const structureAfterCycles=await evaluate("JSON.stringify({sidebar:document.querySelectorAll('.icon-sidebar').length,nav:document.querySelectorAll('.sidebar-btn').length})")
  assert.equal(structureAfterCycles,structureBeforeCycles,'Repeated toggles accumulated duplicate sidebar elements')

  const responsive = []
  for (const width of [1200,1000,900]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:768,deviceScaleFactor:1,mobile:false})
    await sleep(100)
    if(await evaluate("document.querySelector('.sidebar-toggle-btn').getAttribute('aria-expanded')==='false'")) await evaluate("document.querySelector('.sidebar-toggle-btn').click()")
    await sleep(280)
    const state=await evaluate(`(() => { const s=document.querySelector('.icon-sidebar').getBoundingClientRect(),m=document.querySelector('.app-main').getBoundingClientRect(); return {width:innerWidth,rail:s.width,left:s.left,right:s.right,mainLeft:m.left,overflow:document.documentElement.scrollWidth>innerWidth,label:getComputedStyle(document.querySelector('.sidebar-btn-label')).opacity}; })()`)
    assert.equal(state.overflow,false,`Horizontal overflow at ${width}: ${JSON.stringify(state)}`)
    assert.ok(Number(state.label)>0.95,`Sidebar labels missing at ${width}px: ${JSON.stringify(state)}`)
    if(width>1000) assert.ok(state.mainLeft>=state.right+10,`Expanded workspace collides at ${width}px`)
    else assert.equal(state.mainLeft,96,`Narrow desktop should preserve the compact workspace offset at ${width}px`)
    responsive.push(state)
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false})
  await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find((button)=>button.dataset.tab==='Dashboard')?.click()")
  await sleep(120)

  await send('Page.navigate',{url:`${appUrl.origin}/?theme=light`})
  await sleep(1200)
  const light = await evaluate(`(() => ({theme:document.documentElement.dataset.theme,rail:getComputedStyle(document.querySelector('.icon-sidebar')).backgroundColor,active:getComputedStyle(document.querySelector('.sidebar-active-indicator')).backgroundImage,profile:document.querySelector('.sidebar-profile-name')?.textContent}))()`)
  assert.equal(light.theme,'light','Light theme query did not apply')
  assert.ok(light.rail && light.active.includes('linear-gradient'),'Light sidebar surface or active pill is missing')
  assert.equal(light.profile,auth.user.username)
  await screenshot('05-expanded-dashboard-light')

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
  await send('Page.startScreencast',{format:'png',maxWidth:1280,maxHeight:800,everyNthFrame:1})
  const dashboardFrameStart=frameIndex
  await send('Page.navigate',{url:`${appUrl.origin}/?theme=dark`})
  let dashboardMounted=false
  for(let i=0;i<80&&!dashboardMounted;i++){
    await sleep(100)
    dashboardMounted=await evaluate("Boolean(document.querySelector('.shinpo-dashboard'))")
  }
  if(!dashboardMounted){
    const diagnostic=await evaluate("JSON.stringify({url:location.href,title:document.title,body:document.body.innerText.slice(0,1400),active:document.querySelector('.sidebar-btn.active')?.dataset.tab,errors:document.querySelector('[role=alert]')?.innerText})")
    await screenshot('07-dashboard-return-failure')
    throw new Error(`Dashboard did not mount after returning from another route: ${diagnostic}`)
  }
  const dashboardEntrance=await evaluate(`(() => ({
    sections:[...document.querySelectorAll('.shinpo-dashboard > .dashboard-header-bar,.shinpo-dashboard > .dashboard-metrics-grid,.shinpo-dashboard > .daily-objectives-card,.shinpo-dashboard > .dashboard-cockpit-grid,.shinpo-dashboard > .flight-deck-board-panel')].map(el=>getComputedStyle(el).animationName),
    metrics:[...document.querySelectorAll('.dashboard-metric-card')].map(el=>({tag:el.tagName,role:el.getAttribute('role'),tabIndex:el.tabIndex})),
    progressTransition:getComputedStyle(document.querySelector('[data-dashboard-progress]')).transitionProperty
  }))()`)
  assert.ok(dashboardEntrance.sections.length>=4&&dashboardEntrance.sections.every(name=>name==='dashboardSectionReveal'),`Dashboard entrance sequence missing: ${JSON.stringify(dashboardEntrance)}`)
  assert.ok(dashboardEntrance.metrics.length>=4&&dashboardEntrance.metrics.every(card=>card.role==='button'&&card.tabIndex>=0),`Dashboard metric cards are not keyboard-operable: ${JSON.stringify(dashboardEntrance.metrics)}`)
  assert.ok(dashboardEntrance.progressTransition.includes('transform'),`Metric progress does not animate its changed scale: ${dashboardEntrance.progressTransition}`)
  await sleep(600)
  await screenshot('07-dashboard-entered-dark')

  const metricBase=await evaluate(`(() => {const el=document.querySelector('.dashboard-metric-card');return {shadow:getComputedStyle(el).boxShadow,border:getComputedStyle(el).borderColor}})()`)
  const metricPoint=await pointFor('.dashboard-metric-card')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...metricPoint})
  await sleep(220)
  const metricHover=await evaluate(`(() => {const el=document.querySelector('.dashboard-metric-card');return {shadow:getComputedStyle(el).boxShadow,border:getComputedStyle(el).borderColor}})()`)
  assert.ok(metricHover.shadow!==metricBase.shadow||metricHover.border!==metricBase.border,`Metric card hover feedback did not respond: ${JSON.stringify({metricBase,metricHover})}`)

  const focusCta=await evaluate(`(() => {const el=document.querySelector('[data-tutorial="cockpit-priority"] .aurora-btn-primary');el?.scrollIntoView({block:'center',behavior:'auto'});return Boolean(el)})()`)
  assert.ok(focusCta,'Dashboard priority card has no immediate focus action')
  const focusStartPoint=await pointFor('[data-tutorial="cockpit-priority"] .aurora-btn-primary')
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...focusStartPoint})
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...focusStartPoint,button:'left',buttons:1,clickCount:1})
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...focusStartPoint,button:'left',buttons:0,clickCount:1})
  let activeSession=null
  for(let i=0;i<60&&!activeSession;i++){
    await sleep(200)
    const sessions=await evaluate(`fetch(${JSON.stringify(new URL('/api/focus-sessions',apiUrl).toString())},{headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(r=>r.json())`)
    activeSession=sessions.find(session=>session.status==='ACTIVE')??null
  }
  assert.ok(activeSession,'Dashboard Start Focus action did not persist an active session')
  const startToasts=await evaluate("[...document.querySelectorAll('.shinpo-toast-item')].map(el=>el.innerText)")
  assert.ok(startToasts.length<=1,`Starting focus emitted duplicate success toasts: ${JSON.stringify(startToasts)}`)
  const toastLayout=await evaluate(`(() => {const region=document.querySelector('.shinpo-toast-container'),header=document.querySelector('.cockpit-top-bar'),main=document.querySelector('.app-main');if(!region)return null;const r=region.getBoundingClientRect(),h=header.getBoundingClientRect();return {position:getComputedStyle(region).position,insideMain:main.contains(region),top:r.top,bottom:r.bottom,headerBottom:h.bottom,firstToastCount:region.querySelectorAll('.shinpo-toast-item').length}})()`)
  assert.ok(toastLayout&&toastLayout.position!=='fixed'&&toastLayout.insideMain&&toastLayout.top>=toastLayout.headerBottom-8,`Toast region is not in-flow below the app header: ${JSON.stringify(toastLayout)}`)
  let focusWorkspace=null
  for(let i=0;i<20;i++){
    focusWorkspace=await evaluate(`(() => {const el=document.querySelector('.focus-workspace-container');return el?{text:el.innerText.slice(0,500),visible:el.getBoundingClientRect().width>0}:null})()`)
    if(focusWorkspace?.visible&&focusWorkspace.text.includes(activeSession.name)) break
    await sleep(100)
  }
  assert.ok(focusWorkspace?.visible&&focusWorkspace.text.includes(activeSession.name),`Starting from Dashboard did not open the active Focus workspace: ${JSON.stringify(focusWorkspace)}`)
  await clickSelector('[aria-label="Refresh Data"]')
  let simultaneousToastLayout=null
  for(let i=0;i<60;i++){
    simultaneousToastLayout=await evaluate(`(() => {const region=document.querySelector('.shinpo-toast-container');if(!region)return null;const boxes=[...region.querySelectorAll('.shinpo-toast-item')].map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}).sort((a,b)=>a.top-b.top);return {count:boxes.length,boxes,scrollHeight:region.scrollHeight,clientHeight:region.clientHeight,position:getComputedStyle(region).position}})()`)
    if(simultaneousToastLayout?.count===2) break
    await sleep(150)
  }
  assert.equal(simultaneousToastLayout?.count,2,`Expected concurrent focus and sync notifications in the stack: ${JSON.stringify(simultaneousToastLayout)}`)
  assert.ok(simultaneousToastLayout.boxes[0].bottom<=simultaneousToastLayout.boxes[1].top,`Concurrent notifications overlap: ${JSON.stringify(simultaneousToastLayout)}`)
  await screenshot('08-active-focus-dark')

  await evaluate("Array.from(document.querySelectorAll('.sidebar-btn')).find(button=>button.dataset.tab==='Dashboard')?.click()")
  await sleep(450)
  const activeDashboard=await evaluate(`(() => ({
    priority:document.querySelector('[data-tutorial="cockpit-priority"]')?.innerText.includes(${JSON.stringify(activeSession.name)}),
    schedule:document.querySelector('[data-tutorial="todays-schedule-card"]')?.innerText.includes(${JSON.stringify(activeSession.name)}),
    timerVisible:Boolean(document.querySelector('.dashboard-active-session-timer'))
  }))()`)
  assert.equal(activeDashboard.priority,true,`Dashboard priority did not reflect active session: ${JSON.stringify(activeDashboard)}`)
  assert.equal(activeDashboard.schedule,true,`Today's Schedule did not reflect active session: ${JSON.stringify(activeDashboard)}`)
  for(let i=0;i<60&&await evaluate("document.querySelectorAll('.shinpo-toast-item').length>0");i++) await sleep(100)
  const dashboardToastCount=await evaluate("document.querySelectorAll('.shinpo-toast-item').length")
  assert.equal(dashboardToastCount,0,`Focus success toast should not obscure the Dashboard schedule: ${dashboardToastCount}`)
  await screenshot('09-dashboard-active-session-dark')
  const cancellation=await evaluate(`fetch(${JSON.stringify(new URL(`/api/focus-sessions/${activeSession.id}/cancel`,apiUrl).toString())},{method:'POST',headers:{Authorization:${JSON.stringify(`Bearer ${auth.accessToken}`)}}}).then(async r=>({ok:r.ok,body:await r.json()}))`)
  assert.ok(cancellation.ok&&cancellation.body.status==='CANCELLED','Disposable active session cleanup did not persist cancellation')
  await send('Page.stopScreencast')
  await Promise.all(frameWrites)
  frameWrites=[]
  const dashboardMotionFrames=frameIndex-dashboardFrameStart

  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  const reducedMotion = await evaluate("getComputedStyle(document.querySelector('.icon-sidebar')).transitionDuration")
  assert.ok(parseFloat(reducedMotion)<0.001,`Reduced motion is not respected: ${reducedMotion}`)

  const sorted=frameTimes.slice(1).map((t,i)=>(t-frameTimes[i])*1000).filter((t)=>t>0).sort((a,b)=>a-b)
  const motion={frames:frameIndex,medianFrameGapMs:sorted[Math.floor(sorted.length/2)]??null,p95FrameGapMs:sorted[Math.ceil(sorted.length*.95)-1]??null,animationRaf:frameMeasure,widthTransitionMs,motionMarks}
  const result={appUrl:appUrl.origin,viewport:[1280,800],accountMode:isExistingQaAccount?'existing-disposable-qa':'fresh',qaAccount:username,freshAccount:isExistingQaAccount?null:username,onboarding:onboarding.status,initial,expanded,collapsedMarker,navigationChecks:navigationChecks.length,goalTaskFlow,eonpaiCheck,networkFailures,profileSettings:true,cycleCount:30,responsive,light,dashboardEntrance,metricHover,focusStart:{id:activeSession.id,status:activeSession.status,name:activeSession.name,activeDashboard,successToasts:startToasts,simultaneousToastLayout,toastLayout,dashboardToastCount,cancelled:cancellation.body.status},dashboardMotionFrames,reducedMotion,motion,browserErrors:[...new Set(browserErrors)],captures,framesDir}
  const serverErrors=networkFailures.filter((failure)=>failure.status>=500)
  assert.deepEqual(serverErrors,[],'Browser journey encountered an HTTP 5xx; inspect networkFailures and isolated backend logs')
  await writeFile(join(captures,'verification.json'),JSON.stringify(result,null,2))
  await writeFile(join(captures,'screencast-frame-times.json'),JSON.stringify(frameTimes,null,2))
  console.log(JSON.stringify(result,null,2))
} finally {
  if(socket?.readyState===WebSocket.OPEN) socket.close()
  chrome.kill('SIGTERM')
  await new Promise((resolve)=>{
    if(chrome.exitCode!==null) return resolve()
    const timeout=setTimeout(resolve,1500)
    chrome.once('exit',()=>{clearTimeout(timeout);resolve()})
  })
  await sleep(200)
  await rm(profile,{recursive:true,force:true})
}
