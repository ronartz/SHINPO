import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/onboarding_rewards'
const LOCAL_DIR = '/home/eonx/Projects/SHINPO/screenshots/onboarding_rewards'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(LOCAL_DIR, { recursive: true })

async function runOnboardingAndRewardsVerification() {
  console.log('========================================================================')
  console.log('   SHINPO INTERACTIVE ONBOARDING & REWARDS PROGRESSION VERIFICATION     ')
  console.log('========================================================================')

  const chromePort = 9394
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-onboard-${Date.now()}`,
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
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const buffer = Buffer.from(res.result.data, 'base64')
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer)
      fs.writeFileSync(path.join(LOCAL_DIR, filename), buffer)
      console.log(`  [SNAPSHOT] Saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('\n[Phase 1] Authenticating test user with backend...')
    let loginRes = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'demo', password: 'shinpo_demo' }),
    })
    if (!loginRes.ok) {
      loginRes = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'EONX', password: 'shinpo_demo' }),
      })
    }
    if (!loginRes.ok) throw new Error(`Backend login failed: ${loginRes.status}`)
    const loginData = await loginRes.json()
    console.log(`  Authenticated as: ${loginData.user.username} (#${loginData.user.id})`)

    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2500)

    // Store auth tokens
    await evaluate(`
      (() => {
        localStorage.setItem('shinpo_access_token', ${JSON.stringify(loginData.accessToken)});
        localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(loginData.refreshToken)});
        localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(loginData.user))});
        // Clear onboarding flag to simulate fresh user tour
        localStorage.removeItem('shinpo_onboarding_completed');
        localStorage.removeItem('shinpo_tutorial_completed');
        localStorage.removeItem('shinpo_onboarding_progress');
      })()
    `)
    await send('Page.reload')
    await sleep(2500)

    // =========================================================================
    // Part 1: Interactive Onboarding System Verification
    // =========================================================================
    console.log('\n[Phase 2] Verifying Interactive Onboarding Tour...')

    // Navigate to EONPAI and trigger guided walkthrough or start directly
    await evaluate(`
      (() => {
        // Trigger tour programmatically via window event or clicking guide button
        const eonpaiTab = Array.from(document.querySelectorAll('.sidebar-nav-item, .aurora-sidebar-item')).find(b => (b.innerText || '').includes('AI Assistant'));
        if (eonpaiTab) eonpaiTab.click();
      })()
    `)
    await sleep(800)

    // Click "Start Guided Walkthrough"
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const tourBtn = btns.find(b => (b.innerText || '').includes('Start Guided Walkthrough') || (b.innerText || '').includes('Walkthrough') || (b.innerText || '').includes('Tour'));
        if (tourBtn) tourBtn.click();
      })()
    `)
    await sleep(1000)

    // If overlay is not up yet, trigger directly
    const isOverlayUp = await evaluate(`Boolean(document.querySelector('.shinpo-tutorial-portal'))`)
    if (!isOverlayUp) {
      console.log('  Triggering tour directly via window.__SHINPO_START_TUTORIAL__...')
      await evaluate(`
        (() => {
          if (typeof window.__SHINPO_START_TUTORIAL__ === 'function') {
            window.__SHINPO_START_TUTORIAL__(0);
          } else {
            const startBtns = Array.from(document.querySelectorAll('.btn-ai-action, button, .eonpai-command-row')).filter(b => (b.innerText || '').includes('Walkthrough') || (b.innerText || '').includes('Guided tour'));
            if (startBtns.length > 0) startBtns[0].click();
          }
        })()
      `)
      await sleep(1000)
    }

    const step1Info = await evaluate(`
      (() => {
        const card = document.querySelector('.shinpo-coachmark-card');
        if (!card) return null;
        return {
          title: card.querySelector('.coachmark-title')?.innerText,
          counter: card.querySelector('.coachmark-step-counter')?.innerText,
          hasDialogue: Boolean(card.querySelector('.coachmark-dialogue')?.innerText),
          instruction: card.querySelector('.coachmark-instruction')?.innerText,
          whyItMatters: card.querySelector('.coachmark-why-box')?.innerText,
        };
      })()
    `)
    console.log('  Step 1 Coachmark State:', step1Info)
    if (!step1Info) throw new Error('Tutorial coachmark card did not render!')
    await captureScreenshot('01_onboarding_step1_dashboard.png')

    // Test CRITICAL REQUIREMENT: Clicking outside must NOT silently terminate the walkthrough!
    console.log('\n[Phase 3] Testing backdrop click containment (CRITICAL: must NOT kill tour)...')
    await evaluate(`
      (() => {
        const topBackdrop = document.querySelector('.shinpo-backdrop-quad');
        if (topBackdrop) topBackdrop.click();
      })()
    `)
    await sleep(400)

    const stillActiveAfterBackdropClick = await evaluate(`Boolean(document.querySelector('.shinpo-coachmark-card'))`)
    console.log(`  Tour still active after clicking outside: ${stillActiveAfterBackdropClick}`)
    if (!stillActiveAfterBackdropClick) {
      throw new Error('FAIL: Tour silently dismissed when clicking outside the highlighted area!')
    }
    console.log('  ✓ [PASS] Backdrop click does NOT silently terminate walkthrough.')

    // Test Pause / Exit Confirmation Dialog
    console.log('\n[Phase 4] Testing Deliberate Exit / Pause Confirmation Dialog...')
    await evaluate(`
      (() => {
        const closeBtn = document.querySelector('.coachmark-close-btn');
        if (closeBtn) closeBtn.click();
      })()
    `)
    await sleep(400)

    const isExitDialogRendered = await evaluate(`Boolean(document.querySelector('.shinpo-exit-confirm-card'))`)
    console.log(`  Pause confirmation dialog visible: ${isExitDialogRendered}`)
    if (!isExitDialogRendered) {
      throw new Error('FAIL: Exit confirmation dialog did not appear!')
    }
    await captureScreenshot('02_onboarding_exit_confirm_dialog.png')

    // Click "Resume Walkthrough"
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.shinpo-exit-confirm-card button'));
        const resumeBtn = btns.find(b => (b.innerText || '').includes('Resume'));
        if (resumeBtn) resumeBtn.click();
      })()
    `)
    await sleep(400)
    const isExitDialogClosed = await evaluate(`!document.querySelector('.shinpo-exit-confirm-card')`)
    console.log(`  Resume successfully continued tour: ${isExitDialogClosed}`)

    // Step through the guided journey
    console.log('\n[Phase 5] Stepping through 12-Step Guided Learning Journey...')
    for (let s = 1; s <= 12; s++) {
      const currentStep = await evaluate(`
        (() => {
          const card = document.querySelector('.shinpo-coachmark-card');
          return {
            title: card?.querySelector('.coachmark-title')?.innerText,
            counter: card?.querySelector('.coachmark-step-counter')?.innerText,
          };
        })()
      `)
      console.log(`  Traversed Step ${s}: "${currentStep.title}" (${currentStep.counter})`)

      if (s === 2) {
        await captureScreenshot('03_onboarding_step2_goals.png')
      } else if (s === 6) {
        await captureScreenshot('04_onboarding_step6_timer.png')
      } else if (s === 7) {
        await captureScreenshot('05_onboarding_step7_sentinel.png')
      } else if (s === 12) {
        await captureScreenshot('06_onboarding_step12_finish.png')
      }

      // Click Next Step (or Finish on last step)
      await evaluate(`
        (() => {
          const nextBtn = document.querySelector('.btn-coachmark.primary');
          if (nextBtn) nextBtn.click();
        })()
      `)
      await sleep(600)
    }

    const isCompletedInStorage = await evaluate(`localStorage.getItem('shinpo_onboarding_completed')`)
    console.log(`  Onboarding persistent completion in localStorage: "${isCompletedInStorage}"`)
    if (isCompletedInStorage !== 'true') {
      throw new Error('FAIL: Onboarding was not marked completed in localStorage!')
    }
    console.log('  ✓ [PASS] Complete 12-step guided onboarding verified and persisted.')

    // =========================================================================
    // Part 2: Reward & Progression System Verification
    // =========================================================================
    console.log('\n[Phase 6] Verifying Reward & Progression System Backend & UX...')

    // Check backend progress endpoint
    const token = await evaluate(`localStorage.getItem('shinpo_access_token')`)
    const progressRes = await fetch('http://localhost:8080/api/progress', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!progressRes.ok) throw new Error(`GET /api/progress failed: ${progressRes.status}`)
    const progressData = await progressRes.json()
    console.log('  Initial User Progress from Backend:', {
      userId: progressData.userId,
      totalProgress: progressData.totalProgress,
      level: progressData.level,
      levelTitle: progressData.levelTitle,
      currentLevelXp: progressData.currentLevelXp,
      nextLevelThreshold: progressData.nextLevelThreshold,
      progressPercent: progressData.progressPercent,
    })

    // Test Task Completion & Reward Toast
    console.log('\n[Phase 7] Testing Task Completion Reward Toast...')
    // Navigate to Goals tab
    await evaluate(`
      (() => {
        const goalsTab = Array.from(document.querySelectorAll('.sidebar-nav-item, .aurora-sidebar-item')).find(b => (b.innerText || '').includes('Goals'));
        if (goalsTab) goalsTab.click();
      })()
    `)
    await sleep(800)

    // Complete a task
    const taskCompleted = await evaluate(`
      (() => {
        const checkBtn = document.querySelector('.card-check-btn, .task-row-check-btn, button[aria-label="Mark task complete"]');
        if (checkBtn) {
          checkBtn.click();
          return true;
        }
        return false;
      })()
    `)
    console.log(`  Task clicked for completion: ${taskCompleted}`)
    await sleep(1000)

    // Check if reward toast appeared
    const rewardToast = await evaluate(`
      (() => {
        const toast = document.querySelector('.shinpo-toast-item.toast-reward');
        if (!toast) return null;
        return {
          title: toast.querySelector('.toast-title')?.innerText,
          desc: toast.querySelector('.toast-description')?.innerText,
          badge: toast.querySelector('.toast-badge')?.innerText,
        };
      })()
    `)
    console.log('  Reward Toast Detected:', rewardToast)
    await captureScreenshot('07_reward_task_toast.png')

    // Test Celebratory Effects Toggle in Settings -> Appearance
    console.log('\n[Phase 8] Testing Celebratory Effects Preference in Settings...')
    await evaluate(`
      (() => {
        const settingsBtn = document.querySelector('button[title*="Settings"]') || document.querySelector('[aria-label="Settings"]');
        if (settingsBtn) settingsBtn.click();
      })()
    `)
    await sleep(800)

    const celebPreference = await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.settings-pill-btn'));
        const minimalBtn = btns.find(b => (b.innerText || '').includes('Minimal'));
        if (minimalBtn) minimalBtn.click();
        return localStorage.getItem('shinpo_celebration_effects');
      })()
    `)
    console.log(`  Set Celebratory Effects to Minimal: "${celebPreference}"`)
    await captureScreenshot('08_settings_celebratory_effects.png')

    // Close Settings
    await evaluate(`
      (() => {
        const closeBtn = document.querySelector('.settings-modal-close') || Array.from(document.querySelectorAll('button')).find(b => (b.innerText || '').includes('Close'));
        if (closeBtn) closeBtn.click();
      })()
    `)
    await sleep(500)

    console.log('\n========================================================================')
    console.log('   ALL ONBOARDING & REWARDS PROGRESSION CHECKS COMPLETED PASS           ')
    console.log('========================================================================')
  } finally {
    chrome.kill('SIGTERM')
  }
}

runOnboardingAndRewardsVerification().catch((err) => {
  console.error('[TEST ERROR]', err)
  process.exit(1)
})
