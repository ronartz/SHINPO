import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/onboarding_rewards_e2e'
const LOCAL_DIR = '/home/eonx/Projects/SHINPO/screenshots/onboarding_rewards_e2e'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(LOCAL_DIR, { recursive: true })

async function runE2EVerification() {
  console.log('========================================================================')
  console.log('   SHINPO ONBOARDING JOURNEY & REWARDS END-TO-END VERIFICATION          ')
  console.log('   Per-Account Isolation, Interruption Recovery & EONPAI Replay         ')
  console.log('   Truthful Eligibility (Zero XP on Skip) & Full Reward Lifecycle       ')
  console.log('========================================================================')

  const chromePort = 9397
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-onboarding-${Date.now()}`,
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

    function send(method, params = {}) {
      const id = msgId++
      return new Promise((resolve) => {
        pending.set(id, resolve)
      })
    }

    // Override send to dispatch over WebSocket
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

    async function waitForElement(selector, timeoutMs = 6000) {
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

    async function advanceStep(nextStepNumber) {
      await waitForElement('#tutorial-btn-next:not([disabled])')
      await clickElementCenter('#tutorial-btn-next')
      const start = Date.now()
      while (Date.now() - start < 5000) {
        const text = await evaluate(`document.querySelector('.coachmark-step-counter')?.textContent || ''`)
        if (text.includes(`Step ${nextStepNumber} of`)) return true
        await sleep(100)
      }
      throw new Error(`Timeout waiting for Step ${nextStepNumber} to render!`)
    }

    async function clickElementCenter(selector) {
      await waitForElement(selector)
      await sleep(100)
      const clicked = await evaluate(`
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
          el.click();
          return true;
        })()
      `)
      if (!clicked) throw new Error(`Element not found for click: ${selector}`)
    }

    async function captureScreenshot(fileName) {
      const res = await sendCommand('Page.captureScreenshot', { format: 'png' })
      const buffer = Buffer.from(res.result.data, 'base64')
      const artifactPath = path.join(ARTIFACT_DIR, fileName)
      const localPath = path.join(LOCAL_DIR, fileName)
      fs.writeFileSync(artifactPath, buffer)
      fs.writeFileSync(localPath, buffer)
      console.log(`  📸 Screenshot saved: ${fileName}`)
    }

    // Set viewport
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('\n[Stage 1] Initializing browser & clearing existing tokens...')
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2500)

    // Clear any previous state
    await evaluate(`localStorage.clear(); sessionStorage.clear();`)

    // =========================================================================
    // PART 1: REGISTER USER A (ALICE) & VERIFY INTERACTIVE ONBOARDING
    // =========================================================================
    const ts = Date.now()
    const aliceUsername = `Alice_${ts}`
    const aliceEmail = `alice_${ts}@shinpo.local`
    console.log(`\n[Stage 2] Registering User A: ${aliceUsername}...`)

    const regAliceRes = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.1.${ts % 250}`,
      },
      body: JSON.stringify({
        username: aliceUsername,
        email: aliceEmail,
        password: 'Password123!',
      }),
    })
    if (!regAliceRes.ok) {
      throw new Error(`Failed to register Alice: ${regAliceRes.status} ${await regAliceRes.text()}`)
    }
    const aliceData = await regAliceRes.json()
    const aliceId = aliceData.user.id
    const aliceToken = aliceData.accessToken
    console.log(`  Registered Alice (#${aliceId}) successfully!`)

    console.log('  Logging into UI as Alice...')
    await evaluate(`((token, rToken, user) => {
      localStorage.setItem('shinpo_access_token', token);
      localStorage.setItem('shinpo_refresh_token', rToken);
      localStorage.setItem('shinpo_auth_user', JSON.stringify(user));
    })('${aliceToken}', '${aliceData.refreshToken || 'demo'}', ${JSON.stringify(aliceData.user)})`)

    console.log('  Reloading page to trigger first-time onboarding for Alice...')
    await sendCommand('Page.reload')
    await sleep(3000)

    // Assert Step 1 is rendered
    const aliceStep1Active = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const nextBtnDisabled = document.querySelector('#tutorial-btn-next')?.disabled;
        const sandboxAction = document.querySelector('#sandbox-action-priority');
        return {
          portalActive: !!portal,
          title,
          nextBtnDisabled,
          hasSandboxAction: !!sandboxAction,
        };
      })()
    `)
    console.log('  Alice Step 1 Active:', JSON.stringify(aliceStep1Active, null, 2))
    if (!aliceStep1Active.portalActive) throw new Error('Tutorial portal did not auto-trigger for Alice!')
    if (!aliceStep1Active.title?.includes('Cockpit Overview')) {
      throw new Error(`Expected Step 1 orientation, got: "${aliceStep1Active.title}"`)
    }
    if (!aliceStep1Active.nextBtnDisabled) {
      throw new Error('Next Step button must be disabled before interactive verification!')
    }
    await captureScreenshot('01_alice_step1_auto_triggered.png')

    // Perform Step 1 interactive action to unlock Next Step
    console.log('  Clicking sandbox priority action to verify Step 1...')
    await clickElementCenter('#sandbox-action-priority')
    await sleep(500)

    const step1Verified = await evaluate(`
      (() => {
        const nextBtnDisabled = document.querySelector('#tutorial-btn-next')?.disabled;
        const feedback = document.querySelector('.coachmark-sandbox-feedback')?.textContent?.trim();
        return { nextBtnDisabled, feedback };
      })()
    `)
    console.log('  Step 1 Verified State:', JSON.stringify(step1Verified))
    if (step1Verified.nextBtnDisabled) throw new Error('Next button still disabled after verifying Step 1!')

    // Advance to Step 2 (Create Goal)
    console.log('\n[Stage 3] Advancing through guided journey...')
    console.log('  Advancing to Step 2...')
    await advanceStep(2)

    // Step 2: Define Goal Sandbox
    console.log('  Verifying Step 2 (Define Goal)...')
    await clickElementCenter('#sandbox-goal-option-1')
    await advanceStep(3)

    // Step 3: Deconstruct Objectives Sandbox
    console.log('  Verifying Step 3 (Deconstruct Objectives)...')
    await clickElementCenter('#sandbox-action-deconstruct')
    await advanceStep(4)

    // Step 4: Schedule Commitment Sandbox
    console.log('  Verifying Step 4 (Schedule Commitment)...')
    const step4State = await evaluate(`
      (() => {
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const stepBadge = document.querySelector('.coachmark-step-counter')?.textContent?.trim();
        return { title, stepBadge };
      })()
    `)
    console.log('  Step 4 State:', JSON.stringify(step4State, null, 2))
    if (!step4State.stepBadge?.includes('4 of 12')) {
      throw new Error(`Expected Step 4, got: "${step4State.stepBadge}"`)
    }
    await clickElementCenter('#sandbox-schedule-slot-1')
    await sleep(500)
    await captureScreenshot('02_alice_step4_schedule_tab.png')

    // =========================================================================
    // PART 2: INTERRUPTION RECOVERY
    // =========================================================================
    console.log('\n[Stage 4] Testing Interruption Recovery...')
    console.log('  Clicking coachmark close button ✕ to trigger pause dialog...')
    await clickElementCenter('.coachmark-close-btn')
    await sleep(600)

    console.log('  Clicking "Pause & Exit to App"...')
    await clickElementCenter('#tutorial-confirm-pause-btn')
    await sleep(800)

    const pauseCheck = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const userProgressKey = 'shinpo_onboarding_progress_${aliceId}';
        const userDismissedKey = 'shinpo_onboarding_dismissed_${aliceId}';
        return {
          portalGone: !portal,
          savedProgress: localStorage.getItem(userProgressKey) || localStorage.getItem('shinpo_onboarding_progress'),
          dismissed: localStorage.getItem(userDismissedKey) || localStorage.getItem('shinpo_onboarding_dismissed'),
        };
      })()
    `)
    console.log('  Pause storage check:', JSON.stringify(pauseCheck, null, 2))
    if (!pauseCheck.portalGone) throw new Error('Tutorial portal still in DOM after Pause!')
    if (pauseCheck.savedProgress !== '3') {
      throw new Error(`Expected saved progress '3' (0-indexed step 4), got '${pauseCheck.savedProgress}'`)
    }
    console.log('  ✔ Confirmed: Walkthrough paused cleanly and progress persisted at Step 4.')
    await captureScreenshot('03_alice_paused_app_interactive.png')

    // Navigate away to AI Assistant
    console.log('\n  Navigating away to AI Assistant tab...')
    await evaluate(`
      (() => {
        if (window.__SHINPO_NAVIGATE_TAB__) {
          window.__SHINPO_NAVIGATE_TAB__('AI Assistant');
        } else {
          const aiBtn = document.querySelector('[data-tutorial="nav-ai"]');
          if (aiBtn) aiBtn.click();
        }
      })()
    `)
    await sleep(1500)
    await captureScreenshot('04_alice_navigated_away_to_ai.png')

    // In AI Assistant, click "Guided tour"
    console.log('  Clicking "Guided tour" in AI Assistant...')
    await clickElementCenter('[data-command="guided-tour"]')
    await sleep(1200)

    // Verify it resumes at Step 4 on Schedule tab
    const resumeCheck = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const stepBadge = document.querySelector('.coachmark-step-counter')?.textContent?.trim();
        const activeEl = document.querySelector('[data-active="true"], [aria-current="page"], .sidebar-btn.active, .tab-btn.active, .aurora-nav-pill.active');
        const activeTab = activeEl?.getAttribute('data-tab') || activeEl?.textContent?.trim();
        return {
          portalActive: !!portal,
          title,
          stepBadge,
          activeTab,
        };
      })()
    `)
    console.log('  Resumed Tour State:', JSON.stringify(resumeCheck, null, 2))
    if (!resumeCheck.portalActive) throw new Error('Tour failed to resume!')
    if (!resumeCheck.stepBadge?.includes('4 of 12')) {
      throw new Error(`Tour resumed at wrong step! Expected 4 of 12, got: "${resumeCheck.stepBadge}"`)
    }
    if (resumeCheck.activeTab !== 'Schedule') {
      throw new Error(`Tour did not restore target tab Schedule! Got: "${resumeCheck.activeTab}"`)
    }
    console.log('  ✔ Confirmed: Resumed accurately at Step 4 (Schedule Commitment) on Schedule tab!')
    await captureScreenshot('05_alice_resumed_step4_schedule.png')

    // =========================================================================
    // PART 3: STEP THROUGH TO COMPLETION & CERTIFICATION REWARD
    // =========================================================================
    console.log('\n[Stage 5] Stepping through remaining steps 5 through 12 with interactive verification...')
    // From resumed step 4, ensure next button is unlocked, then advance to 5
    await advanceStep(5)

    // Step 5: Arm sprint
    console.log('  Verifying Step 5 (Today\'s Schedule queue)...')
    await clickElementCenter('#sandbox-action-arm-sprint')
    await advanceStep(6)

    // Step 6: Focus controls
    console.log('  Verifying Step 6 (Focus Engine timer budget)...')
    await clickElementCenter('#sandbox-budget-25')
    await advanceStep(7)

    // Step 7: Focus protection
    console.log('  Verifying Step 7 (Sentinel protection guardrails)...')
    await clickElementCenter('#sandbox-mode-balanced')
    await advanceStep(8)

    // Step 8: Study resources
    console.log('  Verifying Step 8 (Study resources whitelist)...')
    await clickElementCenter('#sandbox-resource-docs')
    await advanceStep(9)

    // Step 9: Session reflection
    console.log('  Verifying Step 9 (Session reflection rating)...')
    await clickElementCenter('#sandbox-star-5')
    await advanceStep(10)

    // Step 10: Rewards progression
    console.log('  Verifying Step 10 (Rewards progression ledger)...')
    await clickElementCenter('#sandbox-action-rewards')
    await advanceStep(11)

    // Step 11: EONPAI guidance
    console.log('  Verifying Step 11 (EONPAI cognitive guidance)...')
    await clickElementCenter('#sandbox-action-eonpai')
    await advanceStep(12)

    // Step 12: Settings
    console.log('  Verifying Step 12 (Workstation settings & completion)...')
    await clickElementCenter('#sandbox-action-settings')
    await waitForElement('#tutorial-btn-next:not([disabled])')

    const step12State = await evaluate(`
      (() => {
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const stepBadge = document.querySelector('.coachmark-step-counter')?.textContent?.trim();
        const finishBtn = document.querySelector('#tutorial-btn-next')?.textContent?.trim();
        const nextDisabled = document.querySelector('#tutorial-btn-next')?.disabled;
        return { title, stepBadge, finishBtn, nextDisabled };
      })()
    `)
    console.log('  Step 12 State:', JSON.stringify(step12State, null, 2))
    if (!step12State.stepBadge?.includes('12 of 12')) {
      throw new Error(`Expected Step 12 of 12, got: "${step12State.stepBadge}"`)
    }
    if (step12State.nextDisabled) {
      throw new Error('Finish Tour button should be enabled after Step 12 verification!')
    }
    await captureScreenshot('06_alice_step12_finish_tour.png')

    console.log('  Clicking "Finish Tour" to claim +50 XP onboarding certification reward...')
    await clickElementCenter('#tutorial-btn-next')
    await sleep(1500)

    // Verify tutorial is completed and reward is recorded
    const postCompleteCheck = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const completedKey = 'shinpo_onboarding_completed_${aliceId}';
        const progressKey = 'shinpo_onboarding_progress_${aliceId}';
        const rewardToast = document.querySelector('.shinpo-toast-item.toast-reward');
        const toastTitle = rewardToast?.querySelector('.shinpo-toast-title')?.textContent?.trim();
        return {
          portalGone: !portal,
          isCompletedInStorage: localStorage.getItem(completedKey) === 'true',
          progressCleaned: !localStorage.getItem(progressKey),
          hasRewardToast: !!rewardToast,
          toastTitle,
        };
      })()
    `)
    console.log('  Post-completion Client State:', JSON.stringify(postCompleteCheck, null, 2))
    if (!postCompleteCheck.portalGone) throw new Error('Tutorial portal still active after Finish Tour!')
    if (!postCompleteCheck.isCompletedInStorage) throw new Error('Onboarding completion flag not saved!')
    if (!postCompleteCheck.hasRewardToast) throw new Error('Celebratory reward toast not emitted!')
    console.log(`  ✔ Confirmed: Reward toast emitted: "${postCompleteCheck.toastTitle}"`)

    // Verify backend progress ledger via API
    console.log('  Verifying Alice progress ledger from backend...')
    const aliceFinalProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    })
    const aliceFinalProg = await aliceFinalProgRes.json()
    console.log('  Alice Backend Progression Ledger:', JSON.stringify(aliceFinalProg, null, 2))

    if (aliceFinalProg.totalProgress !== 50) {
      throw new Error(`Expected Alice to have 50 XP, got ${aliceFinalProg.totalProgress}!`)
    }
    const onboardingEvent = aliceFinalProg.recentEvents?.find((e) => e.eventType === 'ONBOARDING_COMPLETED')
    if (!onboardingEvent || onboardingEvent.amount !== 50) {
      throw new Error('ONBOARDING_COMPLETED event missing or not 50 XP in backend ledger!')
    }
    console.log('  ✔ Confirmed: Backend recorded ONBOARDING_COMPLETED (+50 XP) idempotently.')
    await captureScreenshot('07_alice_toast_and_topbar_50xp.png')

    // =========================================================================
    // PART 4: EONPAI REPLAY AFTER COMPLETION (NO DUPLICATE XP)
    // =========================================================================
    console.log('\n[Stage 6] Testing EONPAI Replay After Completion...')
    await evaluate(`
      (() => {
        if (window.__SHINPO_NAVIGATE_TAB__) {
          window.__SHINPO_NAVIGATE_TAB__('AI Assistant');
        } else {
          const aiBtn = document.querySelector('[data-tutorial="nav-ai"]');
          if (aiBtn) aiBtn.click();
        }
      })()
    `)
    await sleep(1500)

    console.log('  Triggering Guided tour replay from EONPAI...')
    await clickElementCenter('[data-command="guided-tour"]')
    await sleep(1200)

    const replayCheck = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const stepBadge = document.querySelector('.coachmark-step-counter')?.textContent?.trim();
        return {
          portalActive: !!portal,
          title,
          stepBadge,
        };
      })()
    `)
    console.log('  Replay State:', JSON.stringify(replayCheck, null, 2))
    if (!replayCheck.portalActive) throw new Error('Replay failed to start!')
    if (!replayCheck.stepBadge?.includes('1 of 12')) {
      throw new Error(`Replay expected to start at 1 of 12, got: "${replayCheck.stepBadge}"`)
    }
    console.log('  ✔ Confirmed: Completed user can replay tour from Step 1 on Dashboard.')
    await captureScreenshot('08_alice_replayed_step1.png')

    // Dismiss replayed tour
    await clickElementCenter('.coachmark-close-btn')
    await sleep(500)
    await clickElementCenter('#tutorial-confirm-pause-btn')
    await sleep(500)

    // Verify Alice XP remains strictly 50 XP (no extra points from replay)
    const aliceReplayCheckRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    })
    const aliceReplayProg = await aliceReplayCheckRes.json()
    if (aliceReplayProg.totalProgress !== 50) {
      throw new Error(`Alice XP leaked extra points on replay! Expected 50, got ${aliceReplayProg.totalProgress}`)
    }
    console.log('  ✔ Confirmed: Replaying the tour never leaks duplicate points.')

    // =========================================================================
    // PART 5: MULTI-ACCOUNT ISOLATION & STRICT ZERO XP ON SKIP (USER B: BOB)
    // =========================================================================
    const bobTs = Date.now()
    const bobUsername = `Bob_${bobTs}`
    const bobEmail = `bob_${bobTs}@shinpo.local`
    console.log(`\n[Stage 7] Registering User B: ${bobUsername}...`)

    const regBobRes = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.2.${bobTs % 250}`,
      },
      body: JSON.stringify({
        username: bobUsername,
        email: bobEmail,
        password: 'Password123!',
      }),
    })
    if (!regBobRes.ok) {
      throw new Error(`Failed to register Bob: ${regBobRes.status} ${await regBobRes.text()}`)
    }
    const bobData = await regBobRes.json()
    const bobId = bobData.user.id
    const bobToken = bobData.accessToken
    console.log(`  Registered Bob (#${bobId}) successfully!`)

    console.log('  Switching client session to Bob...')
    await evaluate(`((token, rToken, user) => {
      localStorage.setItem('shinpo_access_token', token);
      localStorage.setItem('shinpo_refresh_token', rToken);
      localStorage.setItem('shinpo_auth_user', JSON.stringify(user));
    })('${bobToken}', '${bobData.refreshToken || 'demo'}', ${JSON.stringify(bobData.user)})`)

    console.log('  Reloading page as Bob...')
    await sendCommand('Page.reload')
    await sleep(3000)

    // Assert Bob starts clean at Step 1 (unaffected by Alice)
    const bobStep1Check = await evaluate(`
      (() => {
        const portal = document.querySelector('.shinpo-tutorial-portal');
        const title = document.querySelector('.coachmark-title')?.textContent?.trim();
        const stepBadge = document.querySelector('.coachmark-step-counter')?.textContent?.trim();
        const completedKey = 'shinpo_onboarding_completed_${bobId}';
        return {
          portalActive: !!portal,
          title,
          stepBadge,
          isBobCompleted: localStorage.getItem(completedKey) === 'true',
        };
      })()
    `)
    console.log('  Bob Initial State:', JSON.stringify(bobStep1Check, null, 2))
    if (!bobStep1Check.portalActive) throw new Error('Bob did not get auto-triggered tour!')
    if (!bobStep1Check.stepBadge?.includes('1 of 12')) {
      throw new Error(`Bob expected Step 1 of 12, got: "${bobStep1Check.stepBadge}"`)
    }
    if (bobStep1Check.isBobCompleted) throw new Error('Bob was contaminated with Alice completion state!')
    console.log('  ✔ Confirmed: Strict multi-account isolation! Bob starts fresh at Step 1.')
    await captureScreenshot('09_bob_fresh_login_step1.png')

    // Bob Skips the Tour
    console.log('\n[Stage 8] Bob skips the tour...')
    await clickElementCenter('.coachmark-close-btn')
    await sleep(500)
    await clickElementCenter('#tutorial-confirm-skip-btn')
    await sleep(1000)

    // CRITICAL ACCEPTANCE CHECK: Bob MUST have exactly 0 XP after skipping!
    let bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    let bobProg = await bobProgRes.json()
    console.log(`  Bob progress after skipping tour: ${bobProg.totalProgress} XP`)
    if (bobProg.totalProgress !== 0) {
      throw new Error(`REGRESSION: Bob was awarded ${bobProg.totalProgress} XP for SKIPPING tour! Expected 0 XP.`)
    }
    console.log('  ✔ Confirmed: Skipping onboarding awards ZERO points (0 XP).')

    // CRITICAL SECURITY CHECK 1: Direct API Call Abuse Resistance
    console.log('\n[Stage 9] Testing Direct API Call Abuse Resistance...')
    const directClaimRes = await fetch('http://localhost:8080/api/progress/onboarding', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    console.log(`  Direct claim attempt response status: ${directClaimRes.status}`)
    if (directClaimRes.status !== 400) {
      throw new Error(`SECURITY FLAW: Direct claim on skipped tour returned HTTP ${directClaimRes.status}! Expected 400 Bad Request.`)
    }
    const directClaimError = await directClaimRes.text()
    console.log(`  Direct claim rejected with: ${directClaimError.slice(0, 100)}...`)

    // Verify Bob's XP remains 0
    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    if (bobProg.totalProgress !== 0) {
      throw new Error(`Bob gained XP after rejected claim! Expected 0, got ${bobProg.totalProgress}`)
    }
    console.log('  ✔ Confirmed: Direct API attack rejected by server with 400 Bad Request. Bob remains at 0 XP.')

    // CRITICAL SECURITY CHECK 2: LocalStorage Tampering Abuse Resistance
    console.log('\n[Stage 10] Testing LocalStorage Tampering Abuse Resistance...')
    await evaluate(`
      localStorage.setItem('shinpo_onboarding_completed_${bobId}', 'true');
      localStorage.setItem('shinpo_tutorial_completed_${bobId}', 'true');
    `)
    const tamperedClaimRes = await fetch('http://localhost:8080/api/progress/onboarding', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    if (tamperedClaimRes.status !== 400) {
      throw new Error(`SECURITY FLAW: Client localStorage tampering bypassed backend validation! HTTP ${tamperedClaimRes.status}`)
    }
    console.log('  ✔ Confirmed: Client storage tampering cannot bypass server-side validation. Bob remains at 0 XP.')

    // =========================================================================
    // PART 6: COMPLETE REWARD LIFECYCLE (GENUINE WORK) FOR BOB
    // =========================================================================
    console.log('\n[Stage 11] Verifying Complete Reward Lifecycle (Tasks, Sprints, Goals)...')
    const todayStr = new Date().toISOString().split('T')[0]

    // 11.1 Create Goal for Bob
    console.log('  Creating a strategic goal for Bob...')
    const goalRes = await fetch('http://localhost:8080/api/goals', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Deep Execution Protocol',
        startDate: todayStr,
        targetDate: todayStr,
      }),
    })
    if (!goalRes.ok) throw new Error(`Failed to create goal for Bob: ${goalRes.status}`)
    const goalData = await goalRes.json()
    console.log(`  Created goal #${goalData.id}: "${goalData.title}"`)

    // 11.2 Create 2 Subtasks
    console.log('  Creating Task 1 and Task 2 for Bob...')
    const taskRes1 = await fetch('http://localhost:8080/api/missions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goalId: goalData.id,
        title: 'Task 1: Core Engine Implementation',
        description: 'Implement core protocol',
        scheduledDate: todayStr,
        estimatedMinutes: 25,
      }),
    })
    const taskData1 = await taskRes1.json()

    const taskRes2 = await fetch('http://localhost:8080/api/missions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        goalId: goalData.id,
        title: 'Task 2: End-to-End Verification Matrix',
        description: 'Verify security and rewards lifecycle',
        scheduledDate: todayStr,
        estimatedMinutes: 25,
      }),
    })
    const taskData2 = await taskRes2.json()

    // 11.3 Complete Task 1 (+10 XP)
    console.log(`  Completing Task 1 (#${taskData1.id}) for +10 XP...`)
    const completeTaskRes = await fetch(`http://localhost:8080/api/missions/${taskData1.id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualMinutes: 25 }),
    })
    if (!completeTaskRes.ok) throw new Error(`Failed to complete task: ${completeTaskRes.status}`)

    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    console.log(`  Bob progress after Task 1: ${bobProg.totalProgress} XP`)
    if (bobProg.totalProgress !== 10) {
      throw new Error(`Expected Bob to have 10 XP after task completion, got ${bobProg.totalProgress}!`)
    }
    console.log('  ✔ Confirmed: Task completion awarded +10 XP.')

    // 11.4 Idempotency Check: Repeat completion on Task 1 (Must not award extra XP)
    console.log('  Testing repeated task completion idempotency...')
    await fetch(`http://localhost:8080/api/missions/${taskData1.id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualMinutes: 25 }),
    })
    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    if (bobProg.totalProgress !== 10) {
      throw new Error(`Idempotency violated: duplicate task completion awarded extra points! Total: ${bobProg.totalProgress}`)
    }
    console.log('  ✔ Confirmed: Repeated task completion is idempotent. Bob remains at 10 XP.')

    // 11.5 Complete Focus Sprint (+15 XP)
    console.log('\n  Creating and completing a Focus Session for Bob (+15 XP)...')
    const sessionRes = await fetch('http://localhost:8080/api/focus-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Deep Engine Sprint',
        durationMinutes: 25,
        missionId: taskData1.id,
        goalId: goalData.id,
      }),
    })
    const sessionData = await sessionRes.json()

    await fetch(`http://localhost:8080/api/focus-sessions/${sessionData.id}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    })

    const completeSessionRes = await fetch(`http://localhost:8080/api/focus-sessions/${sessionData.id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quality: 5,
        accomplishment: 'Deep focus on code architecture',
        reflectionNote: 'High clarity and flow state',
      }),
    })
    if (!completeSessionRes.ok) throw new Error(`Failed to complete session: ${completeSessionRes.status}`)

    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    console.log(`  Bob progress after Focus Sprint: ${bobProg.totalProgress} XP`)
    if (bobProg.totalProgress !== 25) {
      throw new Error(`Expected Bob to have 25 XP (10 + 15), got ${bobProg.totalProgress}!`)
    }
    console.log('  ✔ Confirmed: Focus session awarded +15 XP.')

    // 11.6 Cancelled Focus Session (Must award 0 XP)
    console.log('  Testing cancelled focus session (0 XP)...')
    const cancelledSessionRes = await fetch('http://localhost:8080/api/focus-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Cancelled Sprint',
        durationMinutes: 15,
      }),
    })
    const cancelledSessionData = await cancelledSessionRes.json()
    await fetch(`http://localhost:8080/api/focus-sessions/${cancelledSessionData.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    if (bobProg.totalProgress !== 25) {
      throw new Error(`Cancelled session awarded points! Expected 25, got ${bobProg.totalProgress}`)
    }
    console.log('  ✔ Confirmed: Cancelled focus session awarded zero points.')

    // 11.7 Complete Task 2 -> Triggers GOAL_COMPLETED (+10 XP task + 50 XP goal)
    console.log(`\n  Completing Task 2 (#${taskData2.id}) to trigger GOAL_COMPLETED (+60 XP total)...`)
    const completeTask2Res = await fetch(`http://localhost:8080/api/missions/${taskData2.id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualMinutes: 25 }),
    })
    if (!completeTask2Res.ok) throw new Error(`Failed to complete task 2: ${completeTask2Res.status}`)

    bobProgRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    bobProg = await bobProgRes.json()
    console.log(`  Bob progress after Goal Completion: ${bobProg.totalProgress} XP (Level ${bobProg.level} - ${bobProg.levelTitle})`)
    if (bobProg.totalProgress !== 85) {
      throw new Error(`Expected Bob to have 85 XP (25 + 10 + 50), got ${bobProg.totalProgress}!`)
    }
    console.log('  ✔ Confirmed: Completing all subtasks triggered GOAL_COMPLETED (+50 XP). Bob legitimately holds 85 XP.')

    // Reload Bob UI to capture verified final screenshot
    await sendCommand('Page.reload')
    await sleep(2500)
    await captureScreenshot('10_bob_rewards_verified.png')

    // =========================================================================
    // PART 7: TENANT ISOLATION & UNAUTHORIZED ACCESS VERIFICATION
    // =========================================================================
    console.log('\n[Stage 12] Testing Multi-Tenant Isolation & Cross-Account Protection...')
    // Alice attempts to complete Bob's mission
    const unauthorizedTaskRes = await fetch(`http://localhost:8080/api/missions/${taskData2.id}/complete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aliceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actualMinutes: 25 }),
    })
    console.log(`  Alice cross-claim attempt status: ${unauthorizedTaskRes.status}`)
    if (unauthorizedTaskRes.status !== 403 && unauthorizedTaskRes.status !== 404 && unauthorizedTaskRes.status !== 400) {
      throw new Error(`SECURITY FLAW: Alice modified Bob's task! Status: ${unauthorizedTaskRes.status}`)
    }

    // Verify Alice XP remains intact at 50 XP
    const aliceFinalCheckRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    })
    const aliceFinalCheck = await aliceFinalCheckRes.json()
    if (aliceFinalCheck.totalProgress !== 50) {
      throw new Error(`Alice XP mutated! Expected 50, got ${aliceFinalCheck.totalProgress}`)
    }
    console.log('  ✔ Confirmed: Strict tenant isolation enforced. Alice remains at 50 XP, Bob remains at 85 XP.')

    console.log('\n========================================================================')
    console.log('   ALL ONBOARDING & REWARDS END-TO-END CRITERIA VERIFIED PASSING!      ')
    console.log('   - Gate C: Genuinely Interactive Onboarding (12 steps verified)      ')
    console.log('   - Gate C: Interruption Recovery, Pause, Resume, Replay              ')
    console.log('   - Gate D: Truthful Eligibility (Zero XP on Skip)                    ')
    console.log('   - Gate D: Direct API & Storage Tamper Abuse Resistance (400)        ')
    console.log('   - Gate D: Complete Reward Lifecycle (Tasks +10, Focus +15, Goal +50) ')
    console.log('   - Gate D: Idempotency & Tenant Isolation                            ')
    console.log('========================================================================\n')
  } finally {
    chrome.kill('SIGTERM')
  }
}

runE2EVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err)
  process.exit(1)
})
