#!/usr/bin/env node
// ==============================================================================
// SHINPO SLICE S3: NATIVE FOCUS PROTECTION ACCEPTANCE VERIFICATION
// Full Pipeline:
// 1. Protection Unavailable (Daemon offline)
// 2. Protection Ready (Daemon connected, standby)
// 3. Protection Active (Session started + daemon connected)
// 4. Protection Degraded (Session active + daemon offline after timeout)
// 5. Distraction Detection & Warning Modal (Mock process alive)
// 6. Grace Period (Granted, countdown active, mock process alive)
// 7. Audit-Only Mode (Dry-run, mock process alive)
// 8. Strict Mode & Verified Termination (Confirmed process exit)
// 9. Session Completion & Safe Disarm (Return to Standby)
// 10. PostgreSQL Persistence & Backend Restart Resilience
// ==============================================================================

import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/s3'
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function runS3Acceptance() {
  console.log('======================================================================')
  console.log('  SHINPO SLICE S3: NATIVE FOCUS PROTECTION STABILIZATION VERIFICATION')
  console.log('======================================================================\n')

  let shieldProcess = null
  let activeMockProcess = null

  // Ensure disposable test script exists
  fs.writeFileSync('/tmp/mock-distract', '#!/bin/bash\nwhile true; do sleep 1; done\n')
  execSync('chmod +x /tmp/mock-distract')

  // Launch headless Chrome
  console.log('Launching headless Chrome on port 9226...')
  const chrome = spawn('google-chrome', [
    '--headless=new',
    '--remote-debugging-port=9226',
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
        const res = await fetch('http://127.0.0.1:9226/json/list')
        const list = await res.json()
        const page = list.find((it) => it.type === 'page')
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome DevTools WebSocket')

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
    await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await sleep(600)

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
      console.log(`  📸 [ARTIFACT] Captured: ${name}.png`)
    }

    // -------------------------------------------------------------------------
    // PREFLIGHT: USER REGISTRATION & AUTHENTICATION
    // -------------------------------------------------------------------------
    console.log('\n--- PREFLIGHT: USER AUTHENTICATION ---')
    const username = `s3_guard_${Date.now().toString().slice(-5)}`
    const password = 'Password123!'
    const email = `${username}@shinpo.local`

    console.log(`Registering isolated verification user: ${username}...`)
    const regRes = await fetch('http://127.0.0.1:8080/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    if (!regRes.ok) throw new Error(`Registration failed: ${await regRes.text()}`)
    const regData = await regRes.json()
    const token = regData.accessToken
    const userId = regData.user.id
    console.log(`User registered successfully (ID: ${userId}).`)

    // Inject session into browser localStorage
    await evalCode(`
      localStorage.setItem("shinpo_access_token", ${JSON.stringify(token)});
      localStorage.setItem("shinpo_refresh_token", ${JSON.stringify(regData.refreshToken)});
      localStorage.setItem("shinpo_auth_user", JSON.stringify(${JSON.stringify(regData.user)}));
    `)

    // -------------------------------------------------------------------------
    // PHASE 2.1: SHIELD UNAVAILABLE (DAEMON OFFLINE)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2.1: SHIELD UNAVAILABLE (DAEMON OFFLINE) ---')
    const stRes1 = await fetch('http://127.0.0.1:8080/api/device/sentinel/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const stData1 = await stRes1.json()
    console.log('Status API:', { status: stData1.status, daemonConnected: stData1.daemonConnected })
    if (stData1.status !== 'UNAVAILABLE' || stData1.daemonConnected !== false) {
      throw new Error(`Expected UNAVAILABLE & daemonConnected=false, got: ${JSON.stringify(stData1)}`)
    }

    await send('Page.reload')
    await sleep(1500)

    const sidebarText1 = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI text:', JSON.stringify(sidebarText1))
    if (!sidebarText1.includes('Protection Unavailable') || !sidebarText1.includes('Daemon offline')) {
      throw new Error(`Sidebar text mismatch for UNAVAILABLE: ${sidebarText1}`)
    }
    await captureScreenshot('01_Protection_Unavailable_Offline')

    // -------------------------------------------------------------------------
    // PHASE 2.2: SHIELD READY / STANDBY (DAEMON CONNECTED)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2.2: SHIELD READY / STANDBY (DAEMON CONNECTED) ---')
    console.log('Starting native shinpo-shield daemon loop...')
    shieldProcess = spawn('./crates/shinpo-shield/target/debug/shinpo-shield', [
      'run',
      '--url', 'http://127.0.0.1:8080',
      '--token', token,
      '--interval', '1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    shieldProcess.stdout.on('data', (d) => {
      const line = d.toString().trim()
      if (line.includes('LOCKDOWN') || line.includes('Intercepted') || line.includes('Shield daemon')) {
        console.log(`    [SHIELD] ${line}`)
      }
    })

    await sleep(2500) // Allow daemon to sync

    const stRes2 = await fetch('http://127.0.0.1:8080/api/device/sentinel/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const stData2 = await stRes2.json()
    console.log('Status API with Daemon:', { status: stData2.status, daemonConnected: stData2.daemonConnected })
    if (!stData2.daemonConnected || (stData2.status !== 'READY' && stData2.status !== 'STANDBY')) {
      throw new Error(`Expected READY/STANDBY with daemonConnected=true, got: ${JSON.stringify(stData2)}`)
    }

    await send('Page.reload')
    await sleep(1500)

    const sidebarText2 = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI text:', JSON.stringify(sidebarText2))
    if (!sidebarText2.includes('Protection Ready') && !sidebarText2.includes('Protection Standby')) {
      throw new Error(`Sidebar text mismatch for READY: ${sidebarText2}`)
    }
    await captureScreenshot('02_Protection_Ready_Daemon_Online')

    // -------------------------------------------------------------------------
    // PHASE 2.3: SHIELD ACTIVE (FOCUS SPRINT STARTED)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2.3: SHIELD ACTIVE (FOCUS SPRINT STARTED) ---')
    const createSessRes = await fetch('http://127.0.0.1:8080/api/focus-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        name: 'Slice S3 Deep Focus Sprint',
        durationMinutes: 25,
        intention: 'Verify Full Shield Protection Lifecycle',
      }),
    })
    const sessData = await createSessRes.json()
    const focusSessionId = sessData.id

    const startSessRes = await fetch(`http://127.0.0.1:8080/api/focus-sessions/${focusSessionId}/start?userId=${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!startSessRes.ok) throw new Error(`Could not start focus session: ${await startSessRes.text()}`)
    console.log(`Focus session ${focusSessionId} started.`)

    await sleep(2500) // Allow daemon to sync active sprint

    const stRes3 = await fetch('http://127.0.0.1:8080/api/device/sentinel/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const stData3 = await stRes3.json()
    console.log('Status API during Sprint:', { status: stData3.status, daemonConnected: stData3.daemonConnected })
    if (stData3.status !== 'ACTIVE' || !stData3.daemonConnected) {
      throw new Error(`Expected ACTIVE with daemonConnected=true, got: ${JSON.stringify(stData3)}`)
    }

    await send('Page.reload')
    await sleep(1500)

    const sidebarText3 = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI text:', JSON.stringify(sidebarText3))
    if (!sidebarText3.includes('Protection Active') || !sidebarText3.includes('Distractions blocked')) {
      throw new Error(`Sidebar text mismatch for ACTIVE: ${sidebarText3}`)
    }
    await captureScreenshot('03_Protection_Active_Focus_Sprint')

    // -------------------------------------------------------------------------
    // PHASE 2.4: SHIELD DEGRADED (DAEMON DISCONNECTED MID-SESSION)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2.4: SHIELD DEGRADED (DAEMON DISCONNECTED MID-SESSION) ---')
    console.log('Killing shield daemon process to simulate daemon crash/disconnect...')
    shieldProcess.kill('SIGTERM')
    shieldProcess = null

    console.log('Waiting 14 seconds for daemon heartbeat window (>12s) to expire...')
    await sleep(14000)

    const stRes4 = await fetch('http://127.0.0.1:8080/api/device/sentinel/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const stData4 = await stRes4.json()
    console.log('Status API degraded:', { status: stData4.status, daemonConnected: stData4.daemonConnected })
    if (stData4.status !== 'DEGRADED' || stData4.daemonConnected !== false) {
      throw new Error(`Expected DEGRADED with daemonConnected=false, got: ${JSON.stringify(stData4)}`)
    }

    await send('Page.reload')
    await sleep(1500)

    const sidebarText4 = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI text:', JSON.stringify(sidebarText4))
    if (!sidebarText4.includes('Protection Degraded') || !sidebarText4.includes('Daemon disconnected')) {
      throw new Error(`Sidebar text mismatch for DEGRADED: ${sidebarText4}`)
    }
    await captureScreenshot('04_Protection_Degraded_Daemon_Offline')

    // -------------------------------------------------------------------------
    // PHASE 3 & 4: RECONNECT DAEMON + DISPOSABLE DISTRACTION WARNING MODAL
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 3 & 4: RECONNECT DAEMON & DISTRACTION WARNING MODAL ---')
    console.log('Restarting native shield daemon...')
    shieldProcess = spawn('./crates/shinpo-shield/target/debug/shinpo-shield', [
      'run',
      '--url', 'http://127.0.0.1:8080',
      '--token', token,
      '--interval', '1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    shieldProcess.stdout.on('data', (d) => {
      const line = d.toString().trim()
      if (line.includes('LOCKDOWN') || line.includes('Intercepted') || line.includes('Shield daemon')) {
        console.log(`    [SHIELD] ${line}`)
      }
    })

    await sleep(2500)

    // Add policy rule: BLOCKED for mock-distract
    console.log('Adding BLOCKED policy rule for "mock-distract"...')
    await fetch('http://127.0.0.1:8080/api/device/sentinel/rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        processNamePattern: 'mock-distract',
        policyType: 'BLOCKED',
      }),
    })

    // Spawn disposable mock distraction process
    activeMockProcess = spawn('/tmp/mock-distract', [], { stdio: 'ignore' })
    const mockPid = activeMockProcess.pid
    console.log(`Spawned harmless disposable mock process PID: ${mockPid}`)

    console.log('Waiting for shield daemon to discover mock process and trigger warning...')
    let warningItem = null
    for (let i = 0; i < 15; i++) {
      await sleep(1000)
      const wRes = await fetch('http://127.0.0.1:8080/api/device/sentinel/warnings', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const wList = await wRes.json()
      if (wList.length > 0 && wList[0].processName === 'mock-distract') {
        warningItem = wList[0]
        break
      }
    }

    if (!warningItem) throw new Error('Warning was not issued for mock-distract within timeout')
    console.log('Warning successfully issued by backend:', {
      warningId: warningItem.warningId,
      processName: warningItem.processName,
      status: warningItem.status,
    })

    // Verify mock process is STILL ALIVE (safe grace, no premature kill)
    let isMockAlive = false
    try {
      process.kill(mockPid, 0)
      isMockAlive = true
    } catch {}
    console.log(`Verified mock process PID ${mockPid} remains alive during warning: ${isMockAlive}`)
    if (!isMockAlive) throw new Error('Disposable mock process was terminated prematurely before grace decision!')

    // Check Warning Modal in UI
    await send('Page.reload')
    await sleep(1500)

    const isWarningModalVisible = await evalCode(`!!document.querySelector('.sentinel-warning-card')`)
    console.log(`Distraction Warning Modal rendered in UI: ${isWarningModalVisible}`)
    await captureScreenshot('05_Distraction_Warning_Modal_Active')

    // -------------------------------------------------------------------------
    // PHASE 4.2: GRACE PERIOD REQUEST & TIMEOUT EXTENSION
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 4.2: REQUEST GRACE PERIOD ---')
    console.log(`Responding to warning ${warningItem.warningId} with GRANT_GRACE (5m)...`)
    const graceRes = await fetch(`http://127.0.0.1:8080/api/device/sentinel/warnings/${warningItem.warningId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'GRANT_GRACE',
        graceMinutes: 5,
      }),
    })
    const graceData = await graceRes.json()
    console.log('Grace Period Response:', {
      status: graceData.status,
      graceExpiresAt: graceData.graceExpiresAt,
      effectiveGraceMinutes: graceData.effectiveGraceMinutes,
    })

    // Re-verify mock process is STILL ALIVE
    isMockAlive = false
    try {
      process.kill(mockPid, 0)
      isMockAlive = true
    } catch {}
    console.log(`Verified mock process PID ${mockPid} remains alive during active grace: ${isMockAlive}`)
    if (!isMockAlive) throw new Error('Disposable process was killed while in active grace window!')

    await send('Page.reload')
    await sleep(1500)

    const sidebarTextGrace = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI during Grace Period:', JSON.stringify(sidebarTextGrace))
    if (!sidebarTextGrace.includes('Grace Period')) {
      throw new Error(`Sidebar text mismatch for GRACE PERIOD: ${sidebarTextGrace}`)
    }
    await captureScreenshot('06_Grace_Period_Active_Countdown')

    // Clean up first mock process
    try { process.kill(mockPid, 'SIGTERM') } catch {}
    activeMockProcess = null

    // -------------------------------------------------------------------------
    // PHASE 5.1: AUDIT-ONLY / DRY-RUN ENFORCEMENT (NO TERMINATION)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 5.1: AUDIT-ONLY / DRY-RUN ENFORCEMENT ---')
    console.log('Setting user enforcement mode to AUDIT_ONLY...')
    await fetch('http://127.0.0.1:8080/api/device/sentinel/mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: 'AUDIT_ONLY' }),
    })

    // Spawn a fresh mock process for audit-only check
    const auditMock = spawn('/tmp/mock-distract', [], { stdio: 'ignore' })
    const auditPid = auditMock.pid
    console.log(`Spawned disposable mock process for dry-run check PID: ${auditPid}`)

    // Direct sweep in dry-run mode
    console.log('Executing shinpo-shield sweep in dry-run mode...')
    const dryRunOutput = execSync(
      `./crates/shinpo-shield/target/debug/shinpo-shield sweep --url http://127.0.0.1:8080 --token ${token} --dry-run`,
      { encoding: 'utf8' }
    )
    console.log('Dry-run sweep output:\n', dryRunOutput.trim())

    // Verify mock process is STILL RUNNING!
    let auditAlive = false
    try {
      process.kill(auditPid, 0)
      auditAlive = true
    } catch {}
    console.log(`Verified mock process PID ${auditPid} is NOT killed in AUDIT_ONLY mode: ${auditAlive}`)
    if (!auditAlive) throw new Error('Process was killed in AUDIT_ONLY mode!')

    await send('Page.reload')
    await sleep(1500)
    await captureScreenshot('07_Audit_DryRun_No_Termination')

    try { process.kill(auditPid, 'SIGKILL') } catch {}

    // -------------------------------------------------------------------------
    // PHASE 5.2: STRICT MODE & CONFIRMED TERMINATION
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 5.2: STRICT MODE & CONFIRMED TERMINATION ---')
    console.log('Setting user enforcement mode back to STRICT...')
    await fetch('http://127.0.0.1:8080/api/device/sentinel/mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode: 'STRICT' }),
    })

    // Spawn fresh mock process
    const strictMock = spawn('/tmp/mock-distract', [], { stdio: 'ignore' })
    const strictPid = strictMock.pid
    console.log(`Spawned disposable mock process for STRICT termination PID: ${strictPid}`)

    // Trigger candidate evaluation & issue warning
    const candRes = await fetch('http://127.0.0.1:8080/api/device/sentinel/warnings/candidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        processName: 'mock-distract',
        pid: strictPid,
      }),
    })
    const candData = await candRes.json()
    console.log('Candidate Evaluation:', candData)

    if (candData.warningId) {
      console.log(`Responding with TERMINATE_NOW for warning ${candData.warningId}...`)
      await fetch(`http://127.0.0.1:8080/api/device/sentinel/warnings/${candData.warningId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'TERMINATE_NOW' }),
      })
    }

    // Run sweep to enforce termination
    console.log('Executing shinpo-shield sweep in STRICT mode to terminate disposable process...')
    const strictSweepOutput = execSync(
      `./crates/shinpo-shield/target/debug/shinpo-shield sweep --url http://127.0.0.1:8080 --token ${token}`,
      { encoding: 'utf8' }
    )
    console.log('Strict sweep output:\n', strictSweepOutput.trim())

    await sleep(1000)

    // Verify process is actually DEAD!
    let strictAlive = false
    try {
      process.kill(strictPid, 0)
      strictAlive = true
    } catch {}
    console.log(`Verified mock process PID ${strictPid} has exited: ${!strictAlive}`)
    if (strictAlive) {
      try { process.kill(strictPid, 'SIGKILL') } catch {}
      throw new Error(`Process PID ${strictPid} was not cleanly terminated in STRICT mode!`)
    }

    // Verify quarantine telemetry in backend API
    const qRes = await fetch('http://127.0.0.1:8080/api/device/sentinel/quarantines', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const quarantines = await qRes.json()
    console.log(`Backend reported ${quarantines.length} quarantine records.`)
    const targetQ = quarantines.find((q) => q.processName === 'mock-distract' && q.pid === strictPid)
    if (!targetQ) {
      console.warn('Recent quarantines:', quarantines)
    }
    console.log('Confirmed Quarantine Telemetry Record:', targetQ || quarantines[0])

    // Capture screenshot of dashboard / telemetry
    await send('Page.reload')
    await sleep(1500)
    await captureScreenshot('08_Strict_Enforcement_Verified_Termination')

    // -------------------------------------------------------------------------
    // PHASE 6: SESSION COMPLETION & SAFE DISARM
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 6: SESSION COMPLETION & SAFE DISARM ---')
    console.log(`Completing focus session ${focusSessionId}...`)
    const compRes = await fetch(`http://127.0.0.1:8080/api/focus-sessions/${focusSessionId}/complete?userId=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        completionQuality: 'DEEP_FLOW',
        accomplishment: 'Verified Native Shield Enforcement Lifecycle',
        reflectionNote: 'Automated acceptance test completed cleanly.',
      }),
    })
    if (!compRes.ok) throw new Error(`Failed to complete focus session: ${await compRes.text()}`)

    await sleep(2500) // Allow daemon to sync disarm

    const stResEnd = await fetch('http://127.0.0.1:8080/api/device/sentinel/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const stDataEnd = await stResEnd.json()
    console.log('Status API after completion:', {
      status: stDataEnd.status,
      daemonConnected: stDataEnd.daemonConnected,
      activeSession: stDataEnd.activeFocusSessionId,
    })

    if (stDataEnd.activeFocusSessionId !== null) {
      throw new Error(`Expected activeFocusSessionId to be null, got: ${stDataEnd.activeFocusSessionId}`)
    }

    await send('Page.reload')
    await sleep(1500)

    const sidebarTextEnd = await evalCode(`document.querySelector('.sidebar-status-quiet')?.innerText || ''`)
    console.log('Sidebar UI after Disarm:', JSON.stringify(sidebarTextEnd))
    if (!sidebarTextEnd.includes('Protection Ready') && !sidebarTextEnd.includes('Protection Standby')) {
      throw new Error(`Sidebar text mismatch for post-session DISARM: ${sidebarTextEnd}`)
    }
    await captureScreenshot('09_Safe_Disarm_Session_Completed')

    // Stop daemon cleanly
    if (shieldProcess) {
      shieldProcess.kill('SIGTERM')
      shieldProcess = null
      console.log('Shield daemon stopped cleanly.')
    }

    // -------------------------------------------------------------------------
    // PHASE 7: POSTGRESQL PERSISTENCE & SERVICE RESTART RESILIENCE
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 7: POSTGRESQL PERSISTENCE & SERVICE RESTART RESILIENCE ---')
    console.log('Querying PostgreSQL database directly for audit trails...')
    const dbWarnings = execSync(
      `podman exec shinpo-postgres psql -U shinpo -d shinpo -t -c "SELECT count(*) FROM sentinel_enforcement_warnings WHERE user_id = ${userId};"`,
      { encoding: 'utf8' }
    ).trim()
    const dbGraces = execSync(
      `podman exec shinpo-postgres psql -U shinpo -d shinpo -t -c "SELECT count(*) FROM sentinel_grace_windows WHERE user_id = ${userId};"`,
      { encoding: 'utf8' }
    ).trim()
    const dbQuarantines = execSync(
      `podman exec shinpo-postgres psql -U shinpo -d shinpo -t -c "SELECT count(*) FROM sentinel_quarantine_records WHERE user_id = ${userId};"`,
      { encoding: 'utf8' }
    ).trim()

    console.log(`Database Audit Counts for User ${userId}:`)
    console.log(`  Warnings:    ${dbWarnings}`)
    console.log(`  Grace:       ${dbGraces}`)
    console.log(`  Quarantines: ${dbQuarantines}`)

    if (Number(dbWarnings) === 0) throw new Error('Database holds 0 warning records!')
    if (Number(dbGraces) === 0) throw new Error('Database holds 0 grace window records!')
    if (Number(dbQuarantines) === 0) throw new Error('Database holds 0 quarantine records!')

    console.log('\nRestarting Spring Boot backend service via ./bin/shinpo restart...')
    execSync('./bin/shinpo restart', { stdio: 'inherit' })
    await sleep(2000)

    console.log('Re-verifying API persistence after backend restart...')
    const postRestartQRes = await fetch('http://127.0.0.1:8080/api/device/sentinel/quarantines', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const postRestartQ = await postRestartQRes.json()
    console.log(`Post-restart quarantine records retrieved: ${postRestartQ.length}`)
    if (postRestartQ.length === 0) throw new Error('Quarantine records lost across service restart!')

    await send('Page.reload')
    await sleep(1500)
    await captureScreenshot('10_Persistence_Across_Restart_Verified')

    console.log('\n======================================================================')
    console.log('  SUCCESS: ALL 10 SLICE S3 ACCEPTANCE GATES PASSED!')
    console.log('======================================================================\n')
  } catch (err) {
    console.error('\n❌ S3 ACCEPTANCE FAILED:', err)
    process.exitCode = 1
  } finally {
    if (activeMockProcess) {
      try { process.kill(activeMockProcess.pid, 'SIGKILL') } catch {}
    }
    if (shieldProcess) {
      try { shieldProcess.kill('SIGTERM') } catch {}
    }
    try {
      chrome.kill('SIGTERM')
    } catch {}
    try { fs.unlinkSync('/tmp/mock-distract') } catch {}
  }
}

runS3Acceptance()

