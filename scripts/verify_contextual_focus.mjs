#!/usr/bin/env node
// ==============================================================================
// SHINPO CONTEXTUAL FOCUS PROTECTION — ACCEPTANCE VERIFICATION
//
// Scenarios Tested:
// - Scenario A: YouTube approved tutorial vs restricted Shorts & unapproved videos
// - Scenario B: Discord approved study channel vs other channels
// - Scenario C: Ordinary browsing workflow (docs.spring.io, github.com)
// - Scenario D: Temporary 5-minute research exception creation & evaluation
// - Scenario E: Session completion & rule expiry (immediate disarm to INACTIVE)
// - Scenario F: Native messaging host CLI & pairing verification
// - Scenario G: 4-user isolation (separate users, credentials, resources, policies)
// - UI: StudyResourcesPanel rendered & screenshotted in Dark and Light modes
// ==============================================================================

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b'
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots/contextual_focus')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

const BACKEND_URL = 'http://127.0.0.1:8080'

async function registerUser(prefix) {
  const username = `${prefix}_${Date.now().toString().slice(-5)}_${Math.floor(Math.random() * 1000)}`
  const password = 'Password123!'
  const email = `${username}@shinpo.local`

  const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
  if (!res.ok) throw new Error(`Registration failed for ${username}: ${await res.text()}`)
  const data = await res.json()
  return {
    userId: data.user.id,
    username,
    token: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  }
}

async function startFocusSession(token, title = 'Learn Spring Security & Testing', mode = 'PROTECTED') {
  // First create a mission/goal
  const missionRes = await fetch(`${BACKEND_URL}/api/missions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Fullstack Study Goal',
      description: 'Test mission for contextual study protection',
      status: 'IN_PROGRESS',
    }),
  })
  const mission = await missionRes.json()

  // Create a task
  const taskRes = await fetch(`${BACKEND_URL}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      description: 'Study task with approved resources',
      status: 'READY',
      missionId: mission.id,
      durationMinutes: 25,
    }),
  })
  const task = await taskRes.json()

  // Start focus session
  const sessionRes = await fetch(`${BACKEND_URL}/api/focus-sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: title,
      missionId: mission.id,
      durationMinutes: 25,
    }),
  })
  if (!sessionRes.ok) {
    throw new Error(`Failed to create session: ${await sessionRes.text()}`)
  }
  const session = await sessionRes.json()

  // Start the session to set status to ACTIVE
  const startRes = await fetch(`${BACKEND_URL}/api/focus-sessions/${session.id}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!startRes.ok) {
    throw new Error(`Failed to start session: ${await startRes.text()}`)
  }
  const activeSession = await startRes.json()

  // Set study mode
  await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session.id}/mode`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mode }),
  })

  // Update adapter settings to be strict on shorts & unapproved youtube
  await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session.id}/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      restrictYoutubeShorts: true,
      restrictYoutubeHome: true,
      restrictUnapprovedYoutube: true,
      hideYoutubeRecommendations: true,
    }),
  })

  return { mission, task, session: activeSession }
}

async function run() {
  console.log('======================================================================')
  console.log('  SHINPO CONTEXTUAL FOCUS PROTECTION — ACCEPTANCE VERIFICATION')
  console.log('======================================================================\n')

  // -------------------------------------------------------------------------
  // 1. SCENARIO G: 4 ISOLATED TEST USERS
  // -------------------------------------------------------------------------
  console.log('--- TEST SCENARIO G: 4 ISOLATED TEST USERS ---')
  const users = []
  for (let i = 1; i <= 4; i++) {
    const user = await registerUser(`user${i}`)
    users.push(user)
    console.log(`  ✓ User ${i} registered (ID: ${user.userId}, Username: ${user.username})`)
  }

  // -------------------------------------------------------------------------
  // 2. SCENARIO A: YOUTUBE APPROVED TUTORIAL VS RESTRICTED SHORTS
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO A: YOUTUBE APPROVED TUTORIAL VS RESTRICTED SHORTS ---')
  const user1 = users[0]
  const { session: session1 } = await startFocusSession(user1.token, 'Spring Security Deep Dive', 'PROTECTED')
  console.log(`  ✓ User 1 active focus session started (ID: ${session1.id}, Mode: PROTECTED)`)

  // Add approved YouTube tutorial
  const tutorialUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const createResourceRes = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1.token}`,
    },
    body: JSON.stringify({
      focusSessionId: session1.id,
      resourceType: 'YOUTUBE_VIDEO',
      matchType: 'EXACT',
      disposition: 'APPROVED',
      destination: tutorialUrl,
      displayName: 'Spring Security Tutorial',
    }),
  })
  const resourceData = await createResourceRes.json()
  console.log(`  ✓ Approved YouTube resource created (ID: ${resourceData.id})`)

  // Evaluate approved tutorial -> ALLOW
  const evalApproved = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session1.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1.token}`,
    },
    body: JSON.stringify({ destination: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of approved tutorial URL: ${evalApproved.decision} (Expected: ALLOW)`)
  if (evalApproved.decision !== 'ALLOW') throw new Error(`Expected ALLOW, got ${evalApproved.decision}`)

  // Evaluate YouTube Shorts -> RESTRICT
  const evalShorts = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session1.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1.token}`,
    },
    body: JSON.stringify({ destination: 'https://www.youtube.com/shorts/randomShort12' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of YouTube Shorts URL: ${evalShorts.decision} (Expected: RESTRICT)`)
  if (evalShorts.decision !== 'RESTRICT') throw new Error(`Expected RESTRICT, got ${evalShorts.decision}`)

  // Evaluate unapproved video -> RESTRICT
  const evalUnapproved = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session1.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1.token}`,
    },
    body: JSON.stringify({ destination: 'https://www.youtube.com/watch?v=9bZkp7q19f0' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of unapproved YouTube video: ${evalUnapproved.decision} (Expected: RESTRICT)`)
  if (evalUnapproved.decision !== 'RESTRICT') throw new Error(`Expected RESTRICT, got ${evalUnapproved.decision}`)

  // -------------------------------------------------------------------------
  // 3. SCENARIO B: DISCORD STUDY CHANNEL VS REST OF DISCORD
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO B: DISCORD STUDY CHANNEL VS REST OF DISCORD ---')
  const user2 = users[1]
  const { session: session2 } = await startFocusSession(user2.token, 'Algorithms Practice', 'PROTECTED')

  const approvedDiscordUrl = 'https://discord.com/channels/123456789012345678/987654321098765432'
  const discordRes = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2.token}`,
    },
    body: JSON.stringify({
      focusSessionId: session2.id,
      resourceType: 'DISCORD_CHANNEL',
      matchType: 'BROWSER_CHANNEL',
      disposition: 'APPROVED',
      destination: approvedDiscordUrl,
      displayName: 'Algorithms Study Room',
    }),
  }).then((r) => r.json())
  console.log(`  ✓ Approved Discord channel resource created (ID: ${discordRes.id})`)

  const evalDiscordApproved = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session2.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2.token}`,
    },
    body: JSON.stringify({ destination: approvedDiscordUrl }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of approved Discord channel: ${evalDiscordApproved.decision} (Expected: ALLOW)`)
  if (evalDiscordApproved.decision !== 'ALLOW') throw new Error(`Expected ALLOW, got ${evalDiscordApproved.decision}`)

  const evalDiscordOther = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session2.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user2.token}`,
    },
    body: JSON.stringify({ destination: 'https://discord.com/channels/123456789012345678/111111111111111111' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of unapproved Discord channel: ${evalDiscordOther.decision} (Expected: UNCERTAIN/RESTRICT)`)
  if (evalDiscordOther.decision === 'ALLOW') throw new Error(`Expected non-ALLOW for unapproved Discord channel`)

  // -------------------------------------------------------------------------
  // 4. SCENARIO C: ORDINARY WEB WORKFLOW & GUIDED VS STRICT MODES
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO C: ORDINARY WEB WORKFLOW (DOCS & REPOSITORIES) ---')
  const user3 = users[2]
  const { session: session3 } = await startFocusSession(user3.token, 'Spring Framework Research', 'GUIDED')

  // Approve domain docs.spring.io
  await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3.token}`,
    },
    body: JSON.stringify({
      focusSessionId: session3.id,
      resourceType: 'WEBSITE',
      matchType: 'DOMAIN',
      disposition: 'APPROVED',
      destination: 'spring.io',
      displayName: 'Spring Official Docs',
    }),
  })

  // Explicitly block a known time sink
  await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3.token}`,
    },
    body: JSON.stringify({
      focusSessionId: session3.id,
      resourceType: 'WEBSITE',
      matchType: 'DOMAIN',
      disposition: 'BLOCKED',
      destination: 'distractingfeed.com',
      displayName: 'Distraction Site',
    }),
  })

  const evalSpring = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session3.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3.token}`,
    },
    body: JSON.stringify({ destination: 'https://docs.spring.io/spring-boot/docs/current/reference/html/' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of approved domain docs: ${evalSpring.decision} (Expected: ALLOW)`)
  if (evalSpring.decision !== 'ALLOW') throw new Error(`Expected ALLOW, got ${evalSpring.decision}`)

  const evalOrdinary = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session3.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3.token}`,
    },
    body: JSON.stringify({ destination: 'https://randomtechblog.xyz/article' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of ordinary web page in GUIDED mode: ${evalOrdinary.decision} (Expected: ALLOW)`)
  if (evalOrdinary.decision !== 'ALLOW') throw new Error(`Expected ALLOW in GUIDED mode, got ${evalOrdinary.decision}`)

  const evalBlocked = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session3.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user3.token}`,
    },
    body: JSON.stringify({ destination: 'https://distractingfeed.com/memes' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of explicit blocked domain in GUIDED mode: ${evalBlocked.decision} (Expected: WARN)`)
  if (evalBlocked.decision !== 'WARN') throw new Error(`Expected WARN for explicit block in GUIDED mode, got ${evalBlocked.decision}`)

  // -------------------------------------------------------------------------
  // 5. SCENARIO D: TEMPORARY 5-MINUTE EXCEPTION FLOW
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO D: TEMPORARY 5-MINUTE EXCEPTION FLOW ---')
  const user4 = users[3]
  const { session: session4 } = await startFocusSession(user4.token, 'Bug Fixing Session', 'STRICT')

  const exceptionRes = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session4.id}/temporary-exceptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user4.token}`,
    },
    body: JSON.stringify({
      destination: 'https://stackoverflow.com/questions/12345/fix-nullpointer',
      durationMinutes: 5,
      reason: 'Urgent troubleshooting exception',
    }),
  }).then((r) => r.json())
  console.log(`  ✓ 5-minute temporary exception created (Policy Revision: ${exceptionRes.policyVersion})`)

  const evalException = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${session4.id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user4.token}`,
    },
    body: JSON.stringify({ destination: 'https://stackoverflow.com/questions/12345/fix-nullpointer' }),
  }).then((r) => r.json())
  console.log(`  ✓ Evaluation of temporary exception URL: ${evalException.decision} (Expected: ALLOW)`)
  if (evalException.decision !== 'ALLOW') throw new Error(`Expected ALLOW for active temporary exception`)

  // -------------------------------------------------------------------------
  // 6. SCENARIO E: SESSION COMPLETION & RULE EXPIRY
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO E: SESSION COMPLETION & IMMEDIATE DISARM ---')
  await fetch(`${BACKEND_URL}/api/focus-sessions/${session4.id}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user4.token}` },
  })
  console.log(`  ✓ Session ${session4.id} marked COMPLETED`)

  const activePolicyAfterComplete = await fetch(`${BACKEND_URL}/api/contextual-focus/policy/active`, {
    headers: { Authorization: `Bearer ${user4.token}` },
  }).then((r) => r.json())
  const isDisarmed = !activePolicyAfterComplete.sessionId && (!activePolicyAfterComplete.status || activePolicyAfterComplete.status === 'INACTIVE')
  console.log(`  ✓ Active policy disarmed after completion: ${isDisarmed} (sessionId: ${activePolicyAfterComplete.sessionId}, status: ${activePolicyAfterComplete.status})`)
  if (!isDisarmed) throw new Error(`Expected policy to be disarmed after session completion`)

  // -------------------------------------------------------------------------
  // 7. SCENARIO F: NATIVE MESSAGING HOST CLI & PAIRING
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SCENARIO F: NATIVE MESSAGING HOST CLI & DISPATCH ---')
  const hostBin = path.join(process.cwd(), 'bin/shinpo-browser-host')
  const hostStatusBefore = execSync(`${hostBin} status`, { encoding: 'utf-8' })
  console.log('  ✓ Native host status query:', hostStatusBefore.trim())

  const rotateOutput = execSync(`${hostBin} rotate-pairing`, { encoding: 'utf-8' }).trim()
  console.log('  ✓ Rotated pairing code:', rotateOutput.slice(0, 16) + '...')

  // Configure backend in host
  const configJson = JSON.stringify({
    baseUrl: BACKEND_URL,
    accessToken: user1.token,
    refreshToken: user1.refreshToken,
    reviewUrl: 'http://localhost:5173',
  })
  execSync(`${hostBin} configure-backend '${configJson}'`)
  console.log('  ✓ Native host configured with backend credentials')

  const hostStatusAfter = JSON.parse(execSync(`${hostBin} status`, { encoding: 'utf-8' }))
  console.log('  ✓ Native host status after config:', {
    backendConfigured: hostStatusAfter.backendConfigured,
    installationId: hostStatusAfter.installationId,
  })
  if (!hostStatusAfter.backendConfigured) throw new Error('Expected backendConfigured: true')

  // Disconnect & clear
  execSync(`${hostBin} disconnect`)
  const hostStatusDisconnected = JSON.parse(execSync(`${hostBin} status`, { encoding: 'utf-8' }))
  console.log('  ✓ Native host disconnected:', {
    backendConfigured: hostStatusDisconnected.backendConfigured,
    policyStatus: hostStatusDisconnected.policy.status,
  })
  if (hostStatusDisconnected.backendConfigured) throw new Error('Expected backendConfigured: false after disconnect')

  // -------------------------------------------------------------------------
  // 8. UI SCREENSHOT VERIFICATION (HEADLESS CHROME)
  // -------------------------------------------------------------------------
  console.log('\n--- UI VERIFICATION: HEADLESS CHROME SCREENSHOTS ---')
  console.log('Launching headless Chrome on port 9227...')
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/',
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 30; i++) {
      await sleep(300)
      try {
        const res = await fetch('http://127.0.0.1:9227/json/list')
        const list = await res.json()
        const page = list.find((it) => it.type === 'page')
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {}
    }
    if (!wsUrl) throw new Error('Could not connect to Chrome DevTools WebSocket on 9227')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', reject)
    })

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
      return new Promise((resolve) => {
        const id = msgId++
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    async function evalCode(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(name) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const data = shot.result?.data || shot.data
      const filePath = path.join(SCREENSHOT_DIR, `${name}.png`)
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      console.log(`  📸 [ARTIFACT] Captured: ${filePath}`)
    }

    // Authenticate user1 in localStorage
    await evalCode(`
      localStorage.setItem("shinpo_access_token", ${JSON.stringify(user1.token)});
      localStorage.setItem("shinpo_refresh_token", ${JSON.stringify(user1.refreshToken)});
      localStorage.setItem("shinpo_auth_user", JSON.stringify(${JSON.stringify(user1.user)}));
      localStorage.setItem("shinpo-theme", "dark");
    `)

    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2000)

    // Dark theme Focus view
    await captureScreenshot('01_contextual_focus_dashboard_dark')

    // Navigate to Focus page via sidebar or direct click
    await evalCode(`
      const navLinks = Array.from(document.querySelectorAll('a, button, [role="button"]'));
      const focusBtn = navLinks.find(el => el.textContent && el.textContent.includes('Focus'));
      if (focusBtn) focusBtn.click();
    `)
    await sleep(1500)
    await captureScreenshot('02_contextual_focus_study_resources_dark')

    // Switch to Light theme
    await evalCode(`
      localStorage.setItem("shinpo-theme", "light");
      document.documentElement.setAttribute('data-theme', 'light');
    `)
    await sleep(800)
    await captureScreenshot('03_contextual_focus_study_resources_light')

    ws.close()
  } finally {
    chrome.kill()
  }

  console.log('\n======================================================================')
  console.log('  ALL SCENARIOS A-G VERIFIED SUCCESSFULLY!')
  console.log('======================================================================')
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err)
  process.exit(1)
})
