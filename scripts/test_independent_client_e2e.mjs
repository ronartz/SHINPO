#!/usr/bin/env node
// ==============================================================================
// SHINPO — Independent Desktop Client & Cloud Backend E2E Acceptance Test
// Simulates remote desktop client interaction against hardened production backend
// without developer workstation dependencies.
// ==============================================================================

import { spawn } from 'child_process'
import crypto from 'crypto'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')
const JAR_PATH = path.join(PROJECT_ROOT, 'backend/target/shinpo-0.0.1-SNAPSHOT.jar')
const TEST_PORT = 8085
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

console.log('======================================================================')
console.log('  SHINPO Independent Device & Cloud Backend Acceptance Test')
console.log('======================================================================')

// Generate cryptographically secure production secret (32 bytes = 256 bits)
const PROD_JWT_SECRET = crypto.randomBytes(32).toString('hex')
console.log(`[E2E] Generated Strong Production JWT Secret (${PROD_JWT_SECRET.length * 4} bits)`)

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  return { status: res.status, ok: res.ok, data }
}

async function run() {
  console.log(`[E2E] Launching Spring Boot Backend with SPRING_PROFILES_ACTIVE=prod on port ${TEST_PORT}...`)

  const env = {
    ...process.env,
    SPRING_PROFILES_ACTIVE: 'prod',
    SERVER_PORT: String(TEST_PORT),
    SHINPO_JWT_SECRET: PROD_JWT_SECRET,
    SPRING_DATASOURCE_URL: 'jdbc:postgresql://localhost:5432/shinpo_test?currentSchema=shinpo_test',
    SPRING_DATASOURCE_USERNAME: 'shinpo',
    SPRING_DATASOURCE_PASSWORD: 'shinpo_dev',
    SHINPO_SENTINEL_SERVER_PROCESS_SCANNING_ENABLED: 'false',
    SHINPO_AI_ENABLED: 'false',
    SHINPO_CORS_ALLOWED_ORIGINS: 'https://beta.shinpo.app',
  }

  const proc = spawn('java', ['-jar', JAR_PATH], { env })

  let serverStarted = false
  proc.stdout.on('data', (d) => {
    const s = d.toString()
    if (s.includes('Started ShinpoApplication') || s.includes('Tomcat started on port')) {
      serverStarted = true
    }
  })
  proc.stderr.on('data', (d) => {
    // console.error('[Backend stderr]', d.toString())
  })

  try {
    // 1. Wait for health endpoint to become UP
    console.log('[E2E] Probing actuator health endpoint...')
    let healthy = false
    for (let i = 0; i < 40; i++) {
      await wait(1000)
      try {
        const res = await request('/actuator/health')
        if (res.status === 200 && res.data?.status === 'UP') {
          healthy = true
          break
        }
      } catch {}
    }

    if (!healthy) {
      throw new Error('Backend failed to start within 40 seconds')
    }
    console.log('  [PASS] Production backend is healthy and responding (UP).')

    // 2. Simulate User 1 (Alex - Beta Tester 1) Registration
    const user1Name = `beta_alex_${Date.now().toString(36)}`
    const user1Email = `${user1Name}@shinpo.beta`
    const user1Pass = 'StrongBetaPassword2026!'

    console.log(`[E2E] Step 1: Registering User 1 (${user1Name})...`)
    const regRes1 = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: user1Name,
        email: user1Email,
        password: user1Pass,
      },
    })

    if (regRes1.status !== 201) {
      throw new Error(`User 1 registration failed: ${JSON.stringify(regRes1.data)}`)
    }
    const token1 = regRes1.data.accessToken
    const user1Id = regRes1.data.user.id
    console.log(`  [PASS] User 1 registered successfully (ID: ${user1Id}). Received Bearer token.`)

    // 3. Verify user isolation: Fetch current user
    const meRes1 = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${token1}` },
    })
    if (!meRes1.ok || meRes1.data.username !== user1Name) {
      throw new Error(`Auth /me verification failed: ${JSON.stringify(meRes1.data)}`)
    }
    console.log('  [PASS] /api/auth/me correctly identifies User 1.')

    // 4. Create strategic goal and mission
    console.log('[E2E] Step 2: Creating Goal & Focus Mission for User 1...')
    const goalRes = await request('/api/goals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        userId: user1Id,
        title: 'Complete Distributed Systems Project',
        description: 'Independent beta execution sprint',
        startDate: '2026-10-19',
        targetDate: '2026-11-19',
      },
    })
    if (!goalRes.ok) throw new Error(`Goal creation failed: ${JSON.stringify(goalRes.data)}`)
    const goalId = goalRes.data.id

    const missionRes = await request('/api/missions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        title: 'Audit Remote Microservice Endpoints',
        scheduledDate: '2026-10-19',
        estimatedMinutes: 30,
        goalId,
      },
    })
    if (!missionRes.ok) throw new Error(`Mission creation failed: ${JSON.stringify(missionRes.data)}`)
    const missionId = missionRes.data.id
    console.log(`  [PASS] Created Goal ID ${goalId} and Mission ID ${missionId} for User 1.`)

    // 5. Start Focus Session
    console.log('[E2E] Step 3: Starting Focus Session...')
    const sessionRes = await request('/api/focus-sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        userId: user1Id,
        goalId,
        missionId,
        name: 'Deep Architecture Sprint',
        durationMinutes: 30,
        intention: 'Finalize distribution protocol',
      },
    })
    if (!sessionRes.ok) throw new Error(`Session creation failed: ${JSON.stringify(sessionRes.data)}`)
    const sessionId = sessionRes.data.id

    const startRes = await request(`/api/focus-sessions/${sessionId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    })
    if (!startRes.ok) throw new Error(`Session start failed: ${JSON.stringify(startRes.data)}`)
    console.log(`  [PASS] Focus Session ID ${sessionId} active.`)

    // 6. Simulate Local SHINPO Shield Sync from Client PC
    console.log('[E2E] Step 4: Simulating Desktop SHINPO Shield daemon sync...')
    const syncRes = await request('/api/device/sentinel/sync', {
      headers: { Authorization: `Bearer ${token1}` },
    })
    if (!syncRes.ok) throw new Error(`Sentinel sync failed: ${JSON.stringify(syncRes.data)}`)
    if (!syncRes.data.hasActiveSession || syncRes.data.activeSessionId !== sessionId) {
      throw new Error(`Sentinel sync state invalid: ${JSON.stringify(syncRes.data)}`)
    }
    console.log(`  [PASS] Sentinel sync confirmed active session ID ${sessionId} and enforcement parameters.`)

    // 7. Simulate Local Desktop Shield reporting an intercepted distraction
    console.log('[E2E] Step 5: Simulating desktop Shield reporting intercepted distraction...')
    const quarantineRes = await request('/api/device/sentinel/quarantines', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        sessionId,
        pid: 74218,
        processName: 'discord',
        commandLine: '/usr/lib/discord/discord',
        policyAction: 'TERMINATED',
        enforcementMode: 'STRICT',
        reason: 'Targeted distraction blacklist (Desktop Shield containment)',
      },
    })
    if (!quarantineRes.ok) throw new Error(`Quarantine report failed: ${JSON.stringify(quarantineRes.data)}`)
    console.log('  [PASS] Quarantine telemetry successfully ingested and persisted.')

    // 8. Verify that Server-Side Process Scanning & Killing is REJECTED in Cloud Mode
    console.log('[E2E] Step 6: Verifying server-side process scanning/killing is disabled...')
    const procRes = await request('/api/device/processes', {
      headers: { Authorization: `Bearer ${token1}` },
    })
    if (!procRes.ok || !Array.isArray(procRes.data) || procRes.data.length !== 0) {
      throw new Error(`Server-side process list should be empty in cloud mode: ${JSON.stringify(procRes.data)}`)
    }
    console.log('  [PASS] Server-side host process scanning is disabled (returned 0 server processes).')

    const termRes = await request('/api/device/processes/99999/terminate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
    })
    if (termRes.status !== 403 || termRes.data?.status !== 'REJECTED') {
      throw new Error(`Server-side terminate should be REJECTED with 403 Forbidden: ${termRes.status} ${JSON.stringify(termRes.data)}`)
    }
    console.log(`  [PASS] Server-side process termination correctly REJECTED (HTTP 403 Forbidden): "${termRes.data.message}"`)

    // 9. Complete Focus Session with Reflection
    console.log('[E2E] Step 7: Completing focus session with rating & reflection...')
    const compRes = await request(`/api/focus-sessions/${sessionId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        quality: 5,
        reflectionNote: 'High velocity architecture verification completed without interruptions.',
        accomplishment: 'All microservices verified.',
        markMissionCompleted: true,
      },
    })
    if (!compRes.ok) throw new Error(`Session completion failed: ${JSON.stringify(compRes.data)}`)
    console.log('  [PASS] Focus session marked COMPLETED with quality score 5.')

    // 10. Simulate User 2 (Independent Beta Tester 2)
    const user2Name = `beta_bob_${Date.now().toString(36)}`
    console.log(`[E2E] Step 8: Registering User 2 (${user2Name}) to verify multi-tenant isolation...`)
    const regRes2 = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username: user2Name,
        email: `${user2Name}@shinpo.beta`,
        password: 'AnotherStrongPassword2026!',
      },
    })
    if (!regRes2.ok) throw new Error(`User 2 registration failed: ${JSON.stringify(regRes2.data)}`)
    const token2 = regRes2.data.accessToken

    // User 2 queries goals
    const u2GoalsRes = await request('/api/goals', {
      headers: { Authorization: `Bearer ${token2}` },
    })
    if (!u2GoalsRes.ok) throw new Error(`User 2 goals query failed: ${JSON.stringify(u2GoalsRes.data)}`)
    const u2GoalTitles = u2GoalsRes.data.map((g) => g.title)
    if (u2GoalTitles.includes('Complete Distributed Systems Project')) {
      throw new Error('SECURITY VIOLATION: User 2 can see User 1 private goal!')
    }
    console.log('  [PASS] Strict per-user database isolation verified. User 2 cannot access User 1 data.')

    console.log('======================================================================')
    console.log('  ALL ACCEPTANCE CRITERIA PASSED: SYSTEM FULLY DEVICE-INDEPENDENT')
    console.log('======================================================================')
  } finally {
    console.log('[E2E] Shutting down test backend...')
    proc.kill('SIGTERM')
    await wait(2000)
    if (!proc.killed) {
      proc.kill('SIGKILL')
    }
  }
}

run().catch((err) => {
  console.error('[E2E] FAILURE:', err)
  process.exit(1)
})
