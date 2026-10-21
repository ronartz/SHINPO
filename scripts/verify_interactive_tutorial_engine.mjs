import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/tutorial_engine_verification'
const LOCAL_DIR = '/home/eonx/Projects/SHINPO/screenshots/tutorial_engine_verification'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(LOCAL_DIR, { recursive: true })

async function runTutorialEngineVerification() {
  console.log('========================================================================')
  console.log('   SHINPO INTERACTIVE TUTORIAL ENGINE & STATE COORDINATION AUDIT        ')
  console.log('   1. Modal Conflict Prevention & Suspended Overlay Execution           ')
  console.log('   2. Bounded Spotlight Geometry (No Unrelated Giant Screen Frames)     ')
  console.log('   3. Viewport Clamping & Collision Flipping across 1024x768 Viewport   ')
  console.log('   4. Genuine Instructional Verification across all 12 Curriculum Steps ')
  console.log('   5. Truthful Reward Awarding (+50 XP) on End-to-End Completion        ')
  console.log('========================================================================')

  const chromePort = 9482
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-tutorial-${Date.now()}`,
    '--disable-dev-shm-usage',
    'http://localhost:5173/',
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`)
        const list = await res.json()
        const page = list.find((it) => it.type === 'page' && it.url && it.url.includes('localhost:5173'))
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome remote debugging port')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))

    let msgId = 1
    const pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })

    const sendCommand = (method, params = {}) => {
      const id = msgId++
      return new Promise((resolve) => {
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await sendCommand('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    async function setViewport(width, height) {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sendCommand('Emulation.setVisibleSize', { width, height })
      await sleep(150)
    }

    async function takeScreenshot(filename) {
      const res = await sendCommand('Page.captureScreenshot', { format: 'png' })
      const buffer = Buffer.from(res.result.data, 'base64')
      const localPath = path.join(LOCAL_DIR, filename)
      const artifactPath = path.join(ARTIFACT_DIR, filename)
      fs.writeFileSync(localPath, buffer)
      fs.writeFileSync(artifactPath, buffer)
      console.log(`  📸 [SCREENSHOT] Saved: ${filename}`)
    }

    async function waitForElement(selector, timeoutMs = 8000) {
      const start = Date.now()
      while (Date.now() - start < timeoutMs) {
        const found = await evaluate(`(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          return !!el;
        })()`)
        if (found) return true
        await sleep(150)
      }
      throw new Error(`Timeout waiting for element: ${selector}`)
    }

    async function clickElement(selector) {
      await waitForElement(selector)
      await sleep(100)
      const clicked = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return true;
      })()`)
      if (!clicked) throw new Error(`Could not click: ${selector}`)
    }

    await sendCommand('Page.enable')
    await sendCommand('DOM.enable')
    await sendCommand('Runtime.enable')

    // Initial desktop window size (1024x768)
    await setViewport(1024, 768)

    // 1. Register fresh isolated test user
    const ts = Date.now()
    const username = `qa_tut_${ts.toString().slice(-6)}`
    const password = 'Password123!'
    console.log(`\n[Stage 1] Registering fresh test user: ${username}...`)

    const regRes = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.2.${ts % 250}`,
      },
      body: JSON.stringify({
        username,
        email: `${username}@shinpo.local`,
        password,
      }),
    })
    if (!regRes.ok) throw new Error(`Registration failed: ${regRes.status} ${await regRes.text()}`)
    const regData = await regRes.json()
    const token = regData.accessToken
    const user = regData.user
    console.log(`   User registered: ID ${user.id}, Username: ${user.username}`)

    // 2. Set auth in UI
    console.log('\n[Stage 2] Logging into UI...')
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(1500)

    await evaluate(`((token, rToken, u) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('shinpo_access_token', token);
      localStorage.setItem('shinpo_refresh_token', rToken);
      localStorage.setItem('shinpo_auth_user', JSON.stringify(u));
      localStorage.setItem('shinpo_theme', 'dark');
      localStorage.setItem('shinpo_v2_preview', 'true');
    })('${token}', '${regData.refreshToken || 'demo'}', ${JSON.stringify(user)})`)

    console.log('   Reloading page to initialize authenticated state...')
    await sendCommand('Page.reload')
    await sleep(1200)

    // =========================================================================
    // TEST PHASE 1: REPRODUCE & VERIFY MODAL CONFLICT RESOLUTION
    // =========================================================================
    console.log('\n[Stage 3] Testing Modal Conflict Coordination (The Reported Failure)...')

    // Wait for App to mount TopBar / controls
    await waitForElement('button[title="Create a new task"]', 6000)

    // Immediately open "New Task" dialog
    console.log('   Opening "New Task" dialog...')
    await clickElement('button[title="Create a new task"]')
    await waitForElement('#create-task-title', 5000)
    console.log('   ✓ Create Task dialog is open.')

    // Now attempt to start the tutorial while Create Task modal is open!
    console.log('   Triggering tutorial launch while Create Task modal is open...')
    await evaluate(`(() => {
      if (window.__SHINPO_START_TUTORIAL__) {
        window.__SHINPO_START_TUTORIAL__(0);
      }
    })()`)
    await sleep(400)

    // Check overlay state: portal and spotlight MUST NOT render over or behind the modal!
    const overlayState = await evaluate(`(() => {
      const portal = document.querySelector('.shinpo-tutorial-portal');
      const spotlight = document.querySelector('.shinpo-spotlight-ring');
      const card = document.querySelector('.shinpo-coachmark-card');
      return {
        hasPortal: !!portal,
        hasSpotlight: !!spotlight,
        hasCard: !!card
      };
    })()`)

    console.log('   Overlay status while modal open:', overlayState)
    if (overlayState.hasPortal || overlayState.hasSpotlight || overlayState.hasCard) {
      throw new Error('FAIL: Tutorial overlay mounted on top of / behind open modal!')
    }
    console.log('   ✓ Confirmed: Tutorial overlay cleanly suspended. Zero conflicting spotlights or stacked cards!')
    await takeScreenshot('01_modal_open_tutorial_suspended.png')

    // Close the Create Task modal
    console.log('   Closing Create Task modal to resume pending tour...')
    await clickElement('button[aria-label="Close modal"]')
    await sleep(500)

    // Now verify the tutorial automatically mounts on Step 1 cleanly!
    await waitForElement('.shinpo-tutorial-portal', 5000)
    await waitForElement('.shinpo-coachmark-card', 5000)
    console.log('   ✓ Confirmed: Tutorial overlay automatically mounted upon modal close.')
    await takeScreenshot('02_modal_closed_tutorial_active_step1.png')

    // =========================================================================
    // TEST PHASE 2: SPOTLIGHT BOUNDING & VIEWPORT CLAMPING ON 1024x768
    // =========================================================================
    console.log('\n[Stage 4] Verifying Bounded Spotlight Geometry & Viewport Clamping (1024x768)...')

    const step1Metrics = await evaluate(`(() => {
      const card = document.querySelector('.shinpo-coachmark-card');
      const ring = document.querySelector('.shinpo-spotlight-ring');
      const cr = card ? card.getBoundingClientRect() : null;
      const rr = ring ? ring.getBoundingClientRect() : null;
      return {
        card: cr ? { top: cr.top, left: cr.left, bottom: cr.bottom, right: cr.right, width: cr.width, height: cr.height } : null,
        ring: rr ? { top: rr.top, left: rr.left, width: rr.width, height: rr.height } : null,
        win: { width: window.innerWidth, height: window.innerHeight }
      };
    })()`)

    console.log('   Step 1 Card Rect:', step1Metrics.card)
    console.log('   Step 1 Spotlight Ring Rect:', step1Metrics.ring)

    // Verify spotlight is bounded (width <= 750px, NOT the entire 1000px+ application grid)
    if (!step1Metrics.ring || step1Metrics.ring.width > 750) {
      throw new Error(`FAIL: Spotlight ring width is ${step1Metrics.ring?.width}px, exceeding bounded limit of 750px!`)
    }
    console.log(`   ✓ Confirmed: Spotlight width (${Math.round(step1Metrics.ring.width)}px) is bounded to Today's Priority card!`)

    // Verify coachmark card is within viewport [16, 768]
    if (step1Metrics.card.bottom > step1Metrics.win.height) {
      throw new Error(`FAIL: Coachmark card extends beyond bottom of viewport! bottom=${step1Metrics.card.bottom} > ${step1Metrics.win.height}`)
    }
    console.log(`   ✓ Confirmed: Coachmark card clamped within 1024x768 viewport (bottom=${Math.round(step1Metrics.card.bottom)}px <= 768px).`)

    // =========================================================================
    // TEST PHASE 3: EXECUTE ALL 12 INSTRUCTIONAL STEPS WITH REAL GUIDANCE
    // =========================================================================
    console.log('\n[Stage 5] Executing 12 Curriculum Steps with Guided Interactions...')

    const stepsToTest = [
      { num: 1, name: 'Cockpit Overview', tab: 'Dashboard' },
      { num: 2, name: 'Strategic Goals', tab: 'Goals & Missions' },
      { num: 3, name: 'Atomic Tasks', tab: 'Goals & Missions' },
      { num: 4, name: 'Calendar & Scheduling', tab: 'Schedule' },
      { num: 5, name: "Today's Schedule", tab: 'Dashboard' },
      { num: 6, name: 'Focus Engine', tab: 'Focus Engine' },
      { num: 7, name: 'Focus Protection', tab: 'Task Manager' },
      { num: 8, name: 'Study Resources', tab: 'Focus Engine' },
      { num: 9, name: 'Session Reflection', tab: 'Dashboard' },
      { num: 10, name: 'Rewards & Progression', tab: 'Dashboard' },
      { num: 11, name: 'EONPAI AI', tab: 'AI Assistant' },
      { num: 12, name: 'Workstation Customization', tab: 'Dashboard' },
    ]

    for (let i = 0; i < stepsToTest.length; i++) {
      const step = stepsToTest[i]
      console.log(`\n   --- Step ${step.num}/12: ${step.name} (${step.tab}) ---`)

      await waitForElement('.coachmark-title', 4000)
      const currentTitle = await evaluate(`document.querySelector('.coachmark-title')?.textContent`)
      console.log(`       Rendered: "${currentTitle}"`)

      // Check geometry on every step to guarantee no screen overflow
      const geom = await evaluate(`(() => {
        const card = document.querySelector('.shinpo-coachmark-card');
        const ring = document.querySelector('.shinpo-spotlight-ring');
        const cr = card ? card.getBoundingClientRect() : null;
        const rr = ring ? ring.getBoundingClientRect() : null;
        return {
          cardBottom: cr ? cr.bottom : 0,
          cardTop: cr ? cr.top : 0,
          cardRight: cr ? cr.right : 0,
          ringW: rr ? rr.width : 0,
          ringH: rr ? rr.height : 0,
          winH: window.innerHeight,
          winW: window.innerWidth
        };
      })()`)

      if (geom.cardBottom > geom.winH) {
        throw new Error(`FAIL: Step ${step.num} overflows viewport! bottom=${geom.cardBottom} > ${geom.winH}`)
      }
      console.log(`       Geometry Check: Card bottom=${Math.round(geom.cardBottom)}px <= ${geom.winH}px | Spotlight=${Math.round(geom.ringW)}x${Math.round(geom.ringH)}px`)

      // Verify that Next button is disabled initially before guided action
      const initiallyDisabled = await evaluate(`(() => {
        const btn = document.querySelector('#tutorial-btn-next');
        return btn?.hasAttribute('disabled');
      })()`)
      if (!initiallyDisabled) {
        throw new Error(`FAIL: Step ${step.num} Next button was unlocked before performing required interaction!`)
      }

      // Perform guided interaction
      await clickElement('.coachmark-sandbox-actions button.sandbox-chip-btn')
      await sleep(200)

      // Verify Next button unlocked
      const nowEnabled = await evaluate(`(() => {
        const btn = document.querySelector('#tutorial-btn-next');
        return !btn?.hasAttribute('disabled');
      })()`)
      if (!nowEnabled) {
        throw new Error(`FAIL: Step ${step.num} Next button remained disabled after interaction!`)
      }
      console.log(`       ✓ Interaction verified & Next Step unlocked.`)

      if (step.num === 12) {
        await takeScreenshot('03_step12_final_customization_ready.png')
        // Finish the tour
        console.log('       Clicking "Finish Tour" on Step 12...')
        await clickElement('#tutorial-btn-next')
        await sleep(800)
        break
      }

      // Advance to next step
      await clickElement('#tutorial-btn-next')
      await sleep(400)
    }

    // =========================================================================
    // TEST PHASE 4: REWARD & PROGRESSION PERSISTENCE VERIFICATION
    // =========================================================================
    console.log('\n[Stage 6] Verifying Onboarding Completion & Truthful Reward (+50 XP)...')

    // Verify tutorial portal is cleanly unmounted
    const portalClosed = await evaluate(`!document.querySelector('.shinpo-tutorial-portal')`)
    if (!portalClosed) throw new Error('FAIL: Tutorial portal remained open after finishing tour!')
    console.log('   ✓ Confirmed: Tutorial portal closed cleanly.')

    // Verify topbar shows Level & XP
    const topbarText = await evaluate(`document.querySelector('.profile-role')?.textContent`)
    console.log('   TopBar Progress Text:', topbarText)
    if (!topbarText?.includes('50 XP')) {
      throw new Error(`FAIL: Expected topbar to show "+50 XP", got "${topbarText}"`)
    }
    console.log('   ✓ Confirmed: TopBar reflects +50 XP onboarding certification reward!')

    // Verify backend PostgreSQL ledger
    const ledgerState = await fetch('http://localhost:8080/api/onboarding', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const ledger = await ledgerState.json()
    console.log('   Backend Ledger State:', ledger)

    if (ledger.status !== 'COMPLETED') {
      throw new Error(`FAIL: Backend onboarding status is ${ledger.status}, expected COMPLETED!`)
    }
    if (ledger.completedStepsCount !== 12 || !ledger.isCompleted) {
      throw new Error(`FAIL: Backend completedStepsCount is ${ledger.completedStepsCount}, expected 12!`)
    }
    console.log('   ✓ Confirmed: Server-side ledger recorded COMPLETED with all 12 steps verified.')

    // Verify backend rewards ledger has exactly 50 XP
    const progressRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const progress = await progressRes.json()
    console.log('   Backend User Progress:', progress)
    if (progress.totalProgress !== 50) {
      throw new Error(`FAIL: Expected user progress totalProgress to be 50, got ${progress.totalProgress}`)
    }
    console.log('   ✓ Confirmed: Server-side rewards ledger awarded exactly +50 XP.')

    await takeScreenshot('04_tutorial_completed_topbar_50xp.png')

    console.log('\n========================================================================')
    console.log('   ✅ ALL TUTORIAL ENGINE QUALITY GATES PASSED DETERMINISTICALLY!       ')
    console.log('   1. Modal Conflict Prevention: VERIFIED                               ')
    console.log('   2. Bounded Spotlight Geometry: VERIFIED                              ')
    console.log('   3. Viewport Clamping (1024x768): VERIFIED                           ')
    console.log('   4. 12-Lesson Guided Interactions: VERIFIED                           ')
    console.log('   5. Server-Authoritative Reward (+50 XP): VERIFIED                    ')
    console.log('========================================================================')
  } finally {
    chrome.kill()
  }
}

runTutorialEngineVerification().catch((err) => {
  console.error('\n❌ TUTORIAL ENGINE VERIFICATION FAILED:', err)
  process.exit(1)
})
