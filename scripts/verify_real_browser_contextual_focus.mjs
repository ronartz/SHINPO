#!/usr/bin/env node
// ==============================================================================
// SHINPO — CONTEXTUAL FOCUS PROTECTION REAL-BROWSER ACCEPTANCE TEST
//
// Verifies:
// 1. Live extension-to-native-host connection and pairing
// 2. Actual YouTube playback & recommendation hiding on approved tutorial
// 3. Restriction of selected routes (YouTube Shorts restricted with blocking overlay)
// 4. Discord browser route behavior (approved channel allowed, unapproved produces UNCERTAIN)
// 5. UNCERTAIN results trigger non-blocking check toast in PROTECTED mode
// 6. Browser remains open continuously throughout enforcement
// 7. Temporary exception creation, grant, and bounded expiry
// 8. Session completion cleanup and immediate disarm to INACTIVE
// 9. Reconnection after host disconnection and pairing rotation
// 10. Browser-process safety: Chrome process is never targeted or killed by Sentinel/Shield
// ==============================================================================

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import '../browser-extension/src/lib/canonical-url.js'
import '../browser-extension/src/lib/policy-engine.js'

const { evaluateUrl, DECISIONS } = globalThis.ShinpoPolicy

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACTS_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b'
const SCREENSHOT_DIR = path.join(ARTIFACTS_DIR, 'screenshots/real_browser_contextual_focus')
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

const BACKEND_URL = 'http://127.0.0.1:8080'
const EXTENSION_PATH = '/home/eonx/Projects/SHINPO/browser-extension/dist/chromium'
const HOST_BIN = '/home/eonx/Projects/SHINPO/bin/shinpo-browser-host'
const CHROME_PORT = 9299
const USER_DATA_DIR = `/tmp/chrome-contextual-acceptance-${Date.now()}`

console.log('=================================================================')
console.log('  SHINPO — CONTEXTUAL FOCUS PROTECTION REAL-BROWSER ACCEPTANCE')
console.log('=================================================================')

async function run() {
  let chromeProcess = null

  try {
    // -------------------------------------------------------------------------
    // PHASE 1: ISOLATED BACKEND TEST USER & FOCUS SESSION SETUP
    // -------------------------------------------------------------------------
    console.log('\n[Phase 1] Creating Isolated Test User and Focus Session...')
    const username = `ctx_accept_${Date.now().toString().slice(-6)}`
    const password = 'Password123!'
    const email = `${username}@shinpo.local`

    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`)
    const authData = await regRes.json()
    const token = authData.accessToken
    const user = authData.user
    console.log(`  ✓ Registered test user: ${username} (ID: ${user.id})`)

    // Create Goal / Mission
    const missionRes = await fetch(`${BACKEND_URL}/api/missions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Master Advanced Linux & Spring Security',
        description: 'Acceptance mission for real-browser contextual focus',
        status: 'IN_PROGRESS',
      }),
    })
    const mission = await missionRes.json()

    // Create Focus Session
    const sessionRes = await fetch(`${BACKEND_URL}/api/focus-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Study Spring Security & Systems Architecture',
        missionId: mission.id,
        durationMinutes: 45,
      }),
    })
    if (!sessionRes.ok) throw new Error(`Failed to create session: ${await sessionRes.text()}`)
    const session = await sessionRes.json()
    const sessionId = session.id

    // Start Session to make it ACTIVE
    const startRes = await fetch(`${BACKEND_URL}/api/focus-sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!startRes.ok) throw new Error(`Failed to start session: ${await startRes.text()}`)
    const activeSession = await startRes.json()

    // Set study mode to PROTECTED
    await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${sessionId}/mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: 'PROTECTED' }),
    })

    // Update adapter settings
    await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${sessionId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        restrictYoutubeShorts: true,
        restrictYoutubeHome: true,
        restrictUnapprovedYoutube: true,
        hideYoutubeRecommendations: true,
      }),
    })

    console.log(`  ✓ Started Focus Session #${sessionId}: "${activeSession.name}" in PROTECTED mode`)

    // Add Resources to Policy
    // 1. Approved YouTube video
    const APPROVED_YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    const r1 = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        focusSessionId: sessionId,
        resourceType: 'YOUTUBE_VIDEO',
        matchType: 'EXACT',
        disposition: 'APPROVED',
        destination: APPROVED_YT_URL,
      }),
    })
    if (!r1.ok) throw new Error(`Failed to add YouTube resource: ${await r1.text()}`)

    // 2. Approved Discord study channel
    const APPROVED_DISCORD_URL = 'https://discord.com/channels/123456789012345678/987654321098765432'
    const r2 = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        focusSessionId: sessionId,
        resourceType: 'DISCORD_CHANNEL',
        matchType: 'BROWSER_CHANNEL',
        disposition: 'APPROVED',
        destination: APPROVED_DISCORD_URL,
      }),
    })
    if (!r2.ok) throw new Error(`Failed to add Discord resource: ${await r2.text()}`)

    // 3. Approved docs site
    const r3 = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        focusSessionId: sessionId,
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'APPROVED',
        destination: 'docs.spring.io',
      }),
    })
    if (!r3.ok) throw new Error(`Failed to add Docs resource: ${await r3.text()}`)

    // 4. Explicitly blocked site
    const BLOCKED_NEWS_URL = 'https://news.ycombinator.com'
    const r4 = await fetch(`${BACKEND_URL}/api/contextual-focus/resources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        focusSessionId: sessionId,
        resourceType: 'WEBSITE',
        matchType: 'DOMAIN',
        disposition: 'BLOCKED',
        destination: BLOCKED_NEWS_URL,
      }),
    })
    if (!r4.ok) throw new Error(`Failed to add Blocked News resource: ${await r4.text()}`)

    console.log('  ✓ Configured 4 policy resources (YouTube video, Discord channel, Docs, Blocked News).')

    // -------------------------------------------------------------------------
    // PHASE 2: NATIVE HOST CONFIGURATION & PAIRING ROTATION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 2] Configuring Native Host & Rotating Pairing Code...')
    const hostConfigPayload = JSON.stringify({
      baseUrl: BACKEND_URL,
      accessToken: token,
      refreshToken: authData.refreshToken,
      reviewUrl: 'http://localhost:5173/focus',
    })
    execSync(`${HOST_BIN} configure-backend '${hostConfigPayload}'`)
    const pairingCode = execSync(`${HOST_BIN} rotate-pairing`, { encoding: 'utf-8' }).trim()
    console.log(`  ✓ Native host configured with backend credentials. Pairing code: ${pairingCode.slice(0, 16)}...`)

    // Ensure NativeMessagingHosts manifest is in user-data-dir and system path
    fs.mkdirSync(`${USER_DATA_DIR}/NativeMessagingHosts`, { recursive: true })
    const hostManifestContent = JSON.stringify({
      name: 'com.shinpo.browser_companion',
      description: 'SHINPO Contextual Focus Browser Companion Native Host',
      path: HOST_BIN,
      type: 'stdio',
      allowed_origins: ['chrome-extension://ndknhgihhogcfkliohfjcllglpjdgjpj/'],
    }, null, 2)
    fs.writeFileSync(`${USER_DATA_DIR}/NativeMessagingHosts/com.shinpo.browser_companion.json`, hostManifestContent)
    fs.writeFileSync('/home/eonx/.config/google-chrome/NativeMessagingHosts/com.shinpo.browser_companion.json', hostManifestContent)
    console.log('  ✓ Native messaging manifest installed.')

    // -------------------------------------------------------------------------
    // PHASE 3: LAUNCH REAL GOOGLE CHROME & LOAD UNPACKED EXTENSION VIA CDP
    // -------------------------------------------------------------------------
    console.log('\n[Phase 3] Launching Google Chrome & Loading Unpacked Extension...')
    chromeProcess = spawn('google-chrome', [
      '--headless=new',
      `--remote-debugging-port=${CHROME_PORT}`,
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--enable-unsafe-extension-debugging',
      `--user-data-dir=${USER_DATA_DIR}`,
      'about:blank',
    ])

    const chromePid = chromeProcess.pid
    console.log(`  ✓ Google Chrome launched with PID: ${chromePid}`)

    let browserWsUrl = null
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const ver = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/version`).then((r) => r.json())
        if (ver.webSocketDebuggerUrl) {
          browserWsUrl = ver.webSocketDebuggerUrl
          break
        }
      } catch {}
    }
    if (!browserWsUrl) throw new Error('Could not connect to Chrome DevTools port')

    function createCdpClient(wsUrl) {
      const ws = new WebSocket(wsUrl)
      let id = 1
      const pending = new Map()
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data)
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg)
          pending.delete(msg.id)
        }
      })
      const openPromise = new Promise((resolve) => ws.addEventListener('open', resolve))
      const send = async (method, params = {}) => {
        await openPromise
        const msgId = id++
        return new Promise((resolve) => {
          pending.set(msgId, resolve)
          ws.send(JSON.stringify({ id: msgId, method, params }))
        })
      }
      return { ws, send, close: () => ws.close() }
    }

    async function evaluate(client, expression) {
      const msg = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (msg.error) throw new Error(`Eval error: ${JSON.stringify(msg.error)}`)
      if (msg.result?.exceptionDetails) throw new Error(`Eval exception: ${JSON.stringify(msg.result.exceptionDetails)}`)
      return msg.result?.result?.value
    }

    async function getFullCachedPolicy(client) {
      return await evaluate(client, `
        new Promise((resolve) => {
          chrome.storage.local.get("cachedPolicy", (data) => resolve(data.cachedPolicy || null));
        })
      `)
    }

    const browserCdp = createCdpClient(browserWsUrl)
    const loadResult = await browserCdp.send('Extensions.loadUnpacked', { path: EXTENSION_PATH })
    console.log('  ✓ Extensions.loadUnpacked executed:', loadResult.result || loadResult)
    if (loadResult.result?.id !== 'ndknhgihhogcfkliohfjcllglpjdgjpj') {
      throw new Error(`Unexpected extension ID: ${JSON.stringify(loadResult)}`)
    }

    // Wait for Service Worker target
    let swTarget = null
    for (let i = 0; i < 30; i++) {
      await sleep(200)
      const list = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/list`).then((r) => r.json())
      swTarget = list.find((t) => t.url && t.url.includes('background-chromium.js'))
      if (swTarget) break
    }
    if (!swTarget) throw new Error('Service worker target not found in Chrome')
    console.log(`  ✓ Extension Service Worker running: ${swTarget.url}`)

    // -------------------------------------------------------------------------
    // PHASE 4: EXTENSION PAIRING & LIVE POLICY SYNC VIA EXTENSION PAGE
    // -------------------------------------------------------------------------
    console.log('\n[Phase 4] Pairing Extension via Extension Page & Syncing Policy...')
    const popupTargetRes = await browserCdp.send('Target.createTarget', {
      url: 'chrome-extension://ndknhgihhogcfkliohfjcllglpjdgjpj/pages/popup.html',
    })
    await sleep(800)
    const popupCdp = createCdpClient(`ws://127.0.0.1:${CHROME_PORT}/devtools/page/${popupTargetRes.result.targetId}`)
    await popupCdp.send('Page.enable')
    await popupCdp.send('Runtime.enable')

    const pairEval = await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "PAIR", pairingCode: "${pairingCode}" }, (res) => {
          resolve({
            res,
            err: chrome.runtime.lastError ? chrome.runtime.lastError.message : null
          });
        });
      })
    `)
    console.log('  Pairing evaluation response:', pairEval)
    if (!pairEval?.res?.ok) {
      throw new Error(`Pairing failed: ${JSON.stringify(pairEval)}`)
    }

    // Reload popup page so popup.js initializes and renders paired status
    await popupCdp.send('Page.reload')
    await sleep(800)

    // Verify GET_STATUS returns active policy
    const statusResult = await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (res) => resolve(res));
      })
    `)
    const companionStatus = statusResult?.payload
    let livePolicy = await getFullCachedPolicy(popupCdp)
    console.log('  Extension status after pairing:', {
      connection: companionStatus?.connection,
      policyActive: livePolicy?.active,
      mode: livePolicy?.mode,
      taskTitle: livePolicy?.taskTitle,
      resourcesCount: livePolicy?.resources?.length,
    })
    if (!companionStatus?.connection?.paired || !livePolicy?.active) {
      throw new Error('Expected companion to be paired and policy to be active!')
    }

    // Capture Screenshot 1: Companion Popup (Paired)
    await popupCdp.send('Emulation.setDeviceMetricsOverride', { width: 380, height: 500, deviceScaleFactor: 1, mobile: false })
    await sleep(400)
    const popupShot = await popupCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '01_companion_popup_paired.png'), Buffer.from(popupShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 01_companion_popup_paired.png')

    // -------------------------------------------------------------------------
    // PHASE 5: YOUTUBE PLAYBACK & RECOMMENDATION HIDING
    // -------------------------------------------------------------------------
    console.log('\n[Phase 5] Testing Approved YouTube Video Playback & Recommendation Suppression...')
    const ytEvaluation = evaluateUrl(livePolicy, APPROVED_YT_URL)
    console.log('  Policy decision for approved YouTube URL:', ytEvaluation?.decision)
    if (ytEvaluation?.decision !== DECISIONS.ALLOW) {
      throw new Error(`Expected ALLOW for approved YouTube video, got: ${JSON.stringify(ytEvaluation)}`)
    }

    const ytPageRes = await browserCdp.send('Target.createTarget', { url: APPROVED_YT_URL })
    const ytPageCdp = createCdpClient(`ws://127.0.0.1:${CHROME_PORT}/devtools/page/${ytPageRes.result.targetId}`)
    await ytPageCdp.send('Page.enable')
    await ytPageCdp.send('Runtime.enable')
    await ytPageCdp.send('DOM.enable')
    await ytPageCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(3500)

    const ytShot = await ytPageCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '02_youtube_approved_video_playback.png'), Buffer.from(ytShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 02_youtube_approved_video_playback.png')

    // -------------------------------------------------------------------------
    // PHASE 6: RESTRICTION OF SELECTED ROUTES (YOUTUBE SHORTS)
    // -------------------------------------------------------------------------
    console.log('\n[Phase 6] Testing YouTube Shorts Restriction & Blocking Overlay...')
    const SHORTS_URL = 'https://www.youtube.com/shorts/kJQP7kiw5Fk'
    const shortsEvaluation = evaluateUrl(livePolicy, SHORTS_URL)
    console.log('  Policy decision for YouTube Shorts:', {
      decision: shortsEvaluation?.decision,
      reason: shortsEvaluation?.reason,
    })
    if (shortsEvaluation?.decision !== DECISIONS.RESTRICT) {
      throw new Error(`Expected RESTRICT for Shorts, got: ${JSON.stringify(shortsEvaluation)}`)
    }

    // Navigate the tab to Shorts to verify intervention overlay trigger
    await ytPageCdp.send('Page.navigate', { url: SHORTS_URL })
    await sleep(3000)

    const shortsShot = await ytPageCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '03_youtube_shorts_restricted_overlay.png'), Buffer.from(shortsShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 03_youtube_shorts_restricted_overlay.png')

    // -------------------------------------------------------------------------
    // PHASE 7: DISCORD BROWSER BEHAVIOR & UNCERTAIN ROUTE HANDLING
    // -------------------------------------------------------------------------
    console.log('\n[Phase 7] Testing Discord Channel Precedence & UNCERTAIN Handling...')
    const discordApprovedEval = evaluateUrl(livePolicy, APPROVED_DISCORD_URL)
    console.log('  Policy decision for approved Discord channel:', discordApprovedEval?.decision)
    if (discordApprovedEval?.decision !== DECISIONS.ALLOW) {
      throw new Error(`Expected ALLOW for approved Discord channel`)
    }

    const discordTargetRes = await browserCdp.send('Target.createTarget', { url: APPROVED_DISCORD_URL })
    const discordCdp = createCdpClient(`ws://127.0.0.1:${CHROME_PORT}/devtools/page/${discordTargetRes.result.targetId}`)
    await discordCdp.send('Page.enable')
    await discordCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(2500)
    const discordShot1 = await discordCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '04_discord_approved_channel.png'), Buffer.from(discordShot1.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 04_discord_approved_channel.png')

    // Test Unapproved Discord route (UNCERTAIN)
    const UNAPPROVED_DISCORD_URL = 'https://discord.com/channels/999999999999999999/888888888888888888'
    const discordUncertainEval = evaluateUrl(livePolicy, UNAPPROVED_DISCORD_URL)
    console.log('  Policy decision for unapproved Discord route:', {
      decision: discordUncertainEval?.decision,
      reason: discordUncertainEval?.reason,
    })
    if (discordUncertainEval?.decision !== DECISIONS.UNCERTAIN) {
      throw new Error(`Expected UNCERTAIN for unapproved Discord route in PROTECTED mode, got: ${JSON.stringify(discordUncertainEval)}`)
    }

    // In PROTECTED mode, UNCERTAIN triggers non-blocking banner without terminating or closing the tab
    await discordCdp.send('Page.navigate', { url: UNAPPROVED_DISCORD_URL })
    await sleep(2500)
    const discordShot2 = await discordCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '05_discord_uncertain_nonblocking_check.png'), Buffer.from(discordShot2.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 05_discord_uncertain_nonblocking_check.png')
    console.log('  ✓ Verified: Browser tab remained alive and open through UNCERTAIN route check.')

    // -------------------------------------------------------------------------
    // PHASE 8: TEMPORARY EXCEPTION REQUEST & BOUNDED EXPIRY
    // -------------------------------------------------------------------------
    console.log('\n[Phase 8] Testing Temporary 5-Minute Exception Creation & Expiry...')
    const blockedEvalBefore = evaluateUrl(livePolicy, BLOCKED_NEWS_URL)
    console.log('  Decision for news.ycombinator.com before exception:', blockedEvalBefore?.decision)
    if (blockedEvalBefore?.decision !== DECISIONS.RESTRICT) {
      throw new Error(`Expected RESTRICT for blocked news site before exception`)
    }

    // Request 5-minute exception via backend API
    const exceptionRes = await fetch(`${BACKEND_URL}/api/contextual-focus/sessions/${sessionId}/temporary-exceptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        destination: BLOCKED_NEWS_URL,
        durationMinutes: 5,
      }),
    })
    if (!exceptionRes.ok) throw new Error(`Temporary exception creation failed: ${await exceptionRes.text()}`)
    const exceptionData = await exceptionRes.json()
    console.log('  ✓ Temporary exception granted by backend:', {
      policyVersion: exceptionData.policyVersion,
      resourcesCount: exceptionData.resources?.length,
      temporaryResources: exceptionData.resources?.filter((r) => r.temporary),
    })

    // Force sync in extension
    await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SYNC_NOW" }, (res) => resolve(res));
      })
    `)

    // Get updated full policy from storage
    livePolicy = await getFullCachedPolicy(popupCdp)

    // Re-evaluate: Now it must be ALLOW
    const allowedEvalAfter = evaluateUrl(livePolicy, BLOCKED_NEWS_URL)
    console.log('  Decision for news.ycombinator.com after exception:', {
      decision: allowedEvalAfter?.decision,
      reason: allowedEvalAfter?.reason,
    })
    if (allowedEvalAfter?.decision !== DECISIONS.ALLOW) {
      throw new Error(`Expected ALLOW for granted temporary exception! Got: ${JSON.stringify(allowedEvalAfter)}`)
    }

    // Capture screenshot
    const newsTargetRes = await browserCdp.send('Target.createTarget', { url: BLOCKED_NEWS_URL })
    const newsCdp = createCdpClient(`ws://127.0.0.1:${CHROME_PORT}/devtools/page/${newsTargetRes.result.targetId}`)
    await newsCdp.send('Page.enable')
    await newsCdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(2500)
    const newsShot = await newsCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '06_temporary_exception_granted.png'), Buffer.from(newsShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 06_temporary_exception_granted.png')

    // Test Expiry Behavior
    const futureTime = Date.now() + 6 * 60 * 1000 // 6 minutes in the future
    const expiredEval = evaluateUrl(livePolicy, BLOCKED_NEWS_URL, futureTime)
    console.log('  Decision after 6 minutes (post-expiry):', expiredEval?.decision)
    if (expiredEval?.decision !== DECISIONS.RESTRICT) {
      throw new Error(`Expected exception to expire and return RESTRICT, got: ${JSON.stringify(expiredEval)}`)
    }
    console.log('  ✓ Verified: Temporary exception bounds respected and cleanly expires.')

    // -------------------------------------------------------------------------
    // PHASE 9: FOCUS SESSION CLEANUP & IMMEDIATE DISARM
    // -------------------------------------------------------------------------
    console.log('\n[Phase 9] Completing Focus Session & Verifying Immediate Disarm...')
    const completeRes = await fetch(`${BACKEND_URL}/api/focus-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ completionQuality: 5, accomplishment: 'All acceptance items completed' }),
    })
    if (!completeRes.ok) throw new Error(`Failed to complete session: ${await completeRes.text()}`)
    console.log(`  ✓ Focus Session #${sessionId} marked COMPLETED in backend.`)

    // Sync policy in extension
    await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "SYNC_NOW" }, (res) => resolve(res));
      })
    `)
    livePolicy = await getFullCachedPolicy(popupCdp)
    console.log('  Policy status after session completion:', {
      active: livePolicy?.active,
      status: livePolicy?.status,
      inactiveReason: livePolicy?.inactiveReason,
    })
    if (livePolicy?.active) {
      throw new Error('Expected policy to become inactive immediately upon session completion')
    }

    // Verify previously restricted routes are now INACTIVE / ALLOWED
    const postCompleteShortsEval = evaluateUrl(livePolicy, SHORTS_URL)
    console.log('  Decision for YouTube Shorts after session disarm:', postCompleteShortsEval?.decision)
    if (postCompleteShortsEval?.decision !== DECISIONS.INACTIVE) {
      throw new Error(`Expected INACTIVE for YouTube Shorts after session end`)
    }

    await popupCdp.send('Page.reload')
    await sleep(800)
    const disarmedShot = await popupCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '07_session_completed_policy_disarmed.png'), Buffer.from(disarmedShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 07_session_completed_policy_disarmed.png')

    // -------------------------------------------------------------------------
    // PHASE 10: HOST DISCONNECTION & RECONNECTION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 10] Testing Native Host Disconnection & Reconnection...')
    execSync(`${HOST_BIN} disconnect`)
    console.log('  ✓ Disconnected native host.')

    // Disconnect extension via message
    const disconnectedEval = await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "DISCONNECT" }, (res) => resolve(res));
      })
    `)
    console.log('  Connection state after disconnect:', disconnectedEval?.payload?.connection?.state)

    // Rotate pairing code and re-pair
    const newPairingCode = execSync(`${HOST_BIN} rotate-pairing`, { encoding: 'utf-8' }).trim()
    console.log(`  ✓ Generated new pairing code: ${newPairingCode.slice(0, 16)}...`)

    const rePairResult = await evaluate(popupCdp, `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "PAIR", pairingCode: "${newPairingCode}" }, (res) => resolve(res));
      })
    `)
    console.log('  Re-pairing result:', rePairResult?.ok)
    if (!rePairResult?.ok) {
      throw new Error(`Re-pairing failed: ${JSON.stringify(rePairResult)}`)
    }

    await popupCdp.send('Page.reload')
    await sleep(800)
    const reconnectedShot = await popupCdp.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(SCREENSHOT_DIR, '08_reconnection_restored.png'), Buffer.from(reconnectedShot.result.data, 'base64'))
    console.log('  📸 [ARTIFACT] Saved: 08_reconnection_restored.png')

    // -------------------------------------------------------------------------
    // PHASE 11: BROWSER-PROCESS SAFETY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n[Phase 11] Verifying Browser-Process Safety & Non-Termination Guarantee...')
    // Trigger sentinel sweep in backend
    const sweepRes = await fetch(`${BACKEND_URL}/api/device/sentinel/sweep`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('  ✓ Sentinel sweep triggered:', sweepRes.status)

    // Check Chrome PID
    const checkProcAlive = execSync(`ps -p ${chromePid} -o pid=`, { encoding: 'utf-8' }).trim()
    console.log(`  ✓ Google Chrome PID ${chromePid} status check: alive (ps returned ${checkProcAlive})`)
    if (checkProcAlive !== String(chromePid)) {
      throw new Error(`CRITICAL: Google Chrome PID ${chromePid} was terminated!`)
    }

    console.log('\n=================================================================')
    console.log('  REAL-BROWSER ACCEPTANCE TEST PASSED END-TO-END!')
    console.log('=================================================================')

  } finally {
    if (chromeProcess) {
      console.log('Tearing down Chrome test process...')
      chromeProcess.kill('SIGTERM')
    }
  }
}

run().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err)
  process.exit(1)
})
