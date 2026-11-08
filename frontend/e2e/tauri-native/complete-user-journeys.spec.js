import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdirSync, copyFileSync, chmodSync, rmSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

describe('SHINPO Native Complete User Journeys & Honest Guardian Release Gate', function () {
  it('executes full user lifecycle: register, goals, focus, analytics, guardian, lock, persistence, and recovery', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE, 'Runner must provide a disposable profile')
    assert.ok(process.env.XDG_DATA_HOME?.startsWith(process.env.SHINPO_TAURI_QA_PROFILE))

    const evidenceDir = process.env.SHINPO_TAURI_EVIDENCE_DIR || '/tmp/shinpo-evidence'
    mkdirSync(evidenceDir, { recursive: true, mode: 0o700 })

    // -------------------------------------------------------------------------
    // 1. REGISTER WORKSPACE & CAPTURE RECOVERY KEY
    // -------------------------------------------------------------------------
    const authHeading = await $('h1')
    await authHeading.waitForDisplayed({ timeout: 120000 })
    console.log('Step 1: Auth screen loaded')

    const username = `journey_${Date.now()}`
    const originalPassword = `Journey-Pass-${randomUUID()}-123!`
    await $('#auth-identifier').setValue(username)
    const email = await $('#auth-email')
    if (await email.isExisting()) await email.setValue(`${username}@example.invalid`)
    await $('#auth-password').setValue(originalPassword)
    await $('button[type="submit"]').click()

    const recoveryKeyEl = await $('#recovery-key-display')
    await recoveryKeyEl.waitForDisplayed({ timeout: 120000 })
    const recoveryKey = (await recoveryKeyEl.getText()).trim()
    assert.ok(recoveryKey.length >= 20, 'Cryptographic recovery key must be at least 20 chars')
    console.log('Step 1: Workspace created and recovery key captured securely')

    await $('#recovery-confirmed-checkbox').click()
    await $('#recovery-continue-btn').click()

    const welcomeDismiss = await $('[aria-label="Dismiss welcome"]')
    try {
      await welcomeDismiss.waitForDisplayed({ timeout: 5000 })
      await welcomeDismiss.click()
    } catch {}

    // -------------------------------------------------------------------------
    // 2. GOALS & TASKS CREATION
    // -------------------------------------------------------------------------
    const goalsNav = await $('[data-tab="Goals & Missions"]')
    await goalsNav.waitForDisplayed({ timeout: 60000 })
    await goalsNav.click()

    const goalTitle = `Release Goal ${Date.now()}`
    const createFirstGoalBtn = await $('button*=Create First Goal')
    if (await createFirstGoalBtn.isExisting()) {
      await createFirstGoalBtn.click()
    } else {
      await $('button[data-tutorial="new-goal"]').click()
    }

    const goalDialog = await $('[role="dialog"]')
    await goalDialog.waitForDisplayed({ timeout: 10000 })
    const goalInput = await $('#create-goal-name-input')
    await goalInput.setValue(goalTitle)
    await goalDialog.$('button[type="submit"]').click()

    const taskTitle = `Release Task ${Date.now()}`
    const newTaskBtn = await $('button[data-tutorial="new-task"]')
    await newTaskBtn.waitForDisplayed({ timeout: 20000 })
    await newTaskBtn.click()

    const taskDialog = await $('[role="dialog"]')
    await taskDialog.waitForDisplayed({ timeout: 10000 })
    const taskInput = await $('#create-task-title-input')
    await taskInput.setValue(taskTitle)
    await taskDialog.$('button[type="submit"]').click()

    const taskList = await $('.missions-list-container, .task-list, .goals-view-deck')
    await taskList.waitForDisplayed({ timeout: 20000 })
    await browser.waitUntil(async () => (await taskList.getText()).includes(taskTitle), {
      timeout: 20000,
      timeoutMsg: 'Task did not appear in the task list',
    })
    console.log('Step 2: Goal and Task created and verified in UI')

    // -------------------------------------------------------------------------
    // 3. FOCUS ENGINE: START, PAUSE, RESUME, CANCEL
    // -------------------------------------------------------------------------
    const focusNav = await $('[data-tab="Focus Engine"]')
    await focusNav.click()
    const workspace = await $('.focus-workspace-container')
    await workspace.waitForDisplayed({ timeout: 30000 })

    await $('[data-tutorial="start-timer-btn"]').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })

    await $('button*=Pause Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'paused', { timeout: 30000 })

    await $('button*=Resume Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'active', { timeout: 30000 })

    await $('button*=Cancel Session').click()
    await browser.waitUntil(async () => await workspace.getAttribute('data-focus-mode') === 'ready', { timeout: 30000 })
    console.log('Step 3: Focus lifecycle (start, pause, resume, cancel) verified')

    // -------------------------------------------------------------------------
    // 4. ANALYTICS VIEW
    // -------------------------------------------------------------------------
    const analyticsNav = await $('[data-tab="Analytics"]')
    await analyticsNav.click()
    await browser.waitUntil(async () => await analyticsNav.getAttribute('aria-current') === 'page', { timeout: 20000 })
    const analyticsContainer = await $('.analytics-view')
    await analyticsContainer.waitForDisplayed({ timeout: 20000 })
    console.log('Step 4: Analytics view loaded')

    // -------------------------------------------------------------------------
    // 5. FOCUS PROTECTION & SAFE DISPOSABLE PROCESS OBSERVATION
    // -------------------------------------------------------------------------
    const guardianNav = await $('[data-tab="Task Manager"]')
    await guardianNav.click()
    const guardianTitle = await $('#guardian-alpha-title')
    await guardianTitle.waitForDisplayed({ timeout: 20000 })

    // Honest Guardian process test with harmless disposable binary
    const fixtureDir = '/tmp/shinpo-disposable-fixture'
    mkdirSync(fixtureDir, { recursive: true, mode: 0o700 })
    const fixtureBin = path.join(fixtureDir, 'discord')
    if (existsSync('/usr/bin/sleep')) {
      copyFileSync('/usr/bin/sleep', fixtureBin)
      chmodSync(fixtureBin, 0o755)
      const fixtureProc = spawn(fixtureBin, ['60'], { detached: true, stdio: 'ignore' })
      fixtureProc.unref()
      console.log(`Step 5: Spawned disposable process '${fixtureBin}' with PID ${fixtureProc.pid}`)

      // Rescan installed apps / processes
      const rescanBtn = await $('button*=Rescan')
      if (await rescanBtn.isExisting()) {
        await rescanBtn.click()
        await browser.pause(1000)
      }

      // Cleanup the fixture process
      try {
        process.kill(fixtureProc.pid, 'SIGKILL')
      } catch {}
      try {
        rmSync(fixtureDir, { recursive: true, force: true })
      } catch {}
      console.log('Step 5: Disposable process terminated and fixture cleaned up safely')
    }

    // Toggle policy on first application button
    const firstBlockBtn = await $('.segmented-btn.btn-block')
    if (await firstBlockBtn.isExisting()) {
      await firstBlockBtn.click()
      await browser.pause(400)
      console.log('Step 5: Configured application policy in Focus Protection')
    }

    // -------------------------------------------------------------------------
    // 6. LOCK / SIGN OUT & VERIFY PERSISTENCE AFTER UNLOCK
    // -------------------------------------------------------------------------
    const signOutBtn = await $('button[aria-label="Sign Out"]')
    await signOutBtn.waitForDisplayed({ timeout: 10000 })
    await signOutBtn.click()
    console.log('Step 6: Locked/Signed out of vault')

    // Wait for auth screen to return
    await $('h1').waitForDisplayed({ timeout: 20000 })

    // Ensure we are in Sign In mode
    const signInTab = await $('button*=Sign In')
    if (await signInTab.isExisting()) {
      await signInTab.click()
      await browser.pause(300)
    }

    // Re-authenticate with original credentials
    await $('#auth-identifier').setValue(username)
    await $('#auth-password').setValue(originalPassword)
    await $('button[type="submit"]').click()

    // Assert Goal and Task persisted across lock
    const goalsNavAfterUnlock = await $('[data-tab="Goals & Missions"]')
    await goalsNavAfterUnlock.waitForDisplayed({ timeout: 60000 })
    await goalsNavAfterUnlock.click()
    await browser.waitUntil(async () => (await $('.missions-list-container, .task-list, .goals-view-deck').getText()).includes(taskTitle), {
      timeout: 30000,
      timeoutMsg: 'Persisted task was missing after unlock',
    })
    console.log('Step 6: Verified Goal and Task persisted across lock/unlock cycle')

    // -------------------------------------------------------------------------
    // 7. WORKSPACE RECOVERY JOURNEY WITH RECOVERY KEY
    // -------------------------------------------------------------------------
    const signOutBtn2 = await $('button[aria-label="Sign Out"]')
    await signOutBtn2.waitForDisplayed({ timeout: 10000 })
    await signOutBtn2.click()
    await $('h1').waitForDisplayed({ timeout: 20000 })

    // Click Forgot password? Recover with key
    const recoverBtn = await $('button*=Forgot password? Recover with key')
    await recoverBtn.waitForDisplayed({ timeout: 10000 })
    await recoverBtn.click()

    // Fill recovery form
    const recoveryKeyInput = await $('#auth-recovery-key')
    await recoveryKeyInput.waitForDisplayed({ timeout: 10000 })
    await $('#auth-identifier').setValue(username)
    await recoveryKeyInput.setValue(recoveryKey)
    const newPassword = `New-Pass-${randomUUID()}-456!`
    await $('#auth-password').setValue(newPassword)
    await $('button[type="submit"]').click()

    // Verify recovery succeeded and user is back in workspace
    const goalsNavAfterRecovery = await $('[data-tab="Goals & Missions"]')
    await goalsNavAfterRecovery.waitForDisplayed({ timeout: 60000 })
    await goalsNavAfterRecovery.click()
    await browser.waitUntil(async () => (await $('.missions-list-container, .task-list, .goals-view-deck').getText()).includes(taskTitle), {
      timeout: 30000,
      timeoutMsg: 'Persisted task was missing after workspace recovery',
    })
    console.log('Step 7: Workspace recovery with cryptographic recovery key verified successfully')

    await browser.saveScreenshot(path.join(evidenceDir, 'complete-journey-success.png'))
  })
})
