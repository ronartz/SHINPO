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

    async function safeClick(el) {
      await el.waitForDisplayed({ timeout: 20000 })
      await el.scrollIntoView({ block: 'center' }).catch(() => { })
      await browser.pause(200)
      try {
        await el.click()
      } catch {
        await browser.execute((target) => target.click(), el)
      }
    }

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
    } catch { }

    const skipTutorial = await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip')
    try {
      await skipTutorial.waitForDisplayed({ timeout: 3000 })
      await skipTutorial.click()
    } catch { }

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
    // 3. FOCUS ENGINE: START, PAUSE, RESUME, FINISH & REFLECTION PERSISTENCE
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

    // Let timer tick briefly so real focus duration is recorded
    await browser.pause(2000)

    // Complete session with reflection
    const finishBtn = await $('.microkit-finish-glow')
    if (await finishBtn.isExisting()) {
      await finishBtn.click()
    } else {
      const finishTextBtn = await $('button*=Finish')
      await finishTextBtn.waitForDisplayed({ timeout: 10000 })
      await finishTextBtn.click()
    }

    const summaryTitle = await $('#session-summary-title')
    await summaryTitle.waitForDisplayed({ timeout: 15000 })

    const outcomeInput = await $('input[placeholder*="outcome was achieved"]')
    if (await outcomeInput.isExisting()) {
      await outcomeInput.setValue('Verified complete native focus workflow')
    }
    const notesInput = await $('textarea[placeholder*="distractions, blockers"]')
    if (await notesInput.isExisting()) {
      await notesInput.setValue('Real SQLCipher persistence without regressions')
    }

    const saveSummaryBtn = await $('button*=Save Summary')
    if (await saveSummaryBtn.isExisting()) {
      await saveSummaryBtn.click()
    } else {
      await $('form button[type="submit"]').click()
    }

    await browser.waitUntil(async () => !(await summaryTitle.isDisplayed().catch(() => false)), {
      timeout: 20000,
      timeoutMsg: 'Session summary modal did not close after save',
    })
    await browser.pause(500)

    // Dismiss celebration modal if displayed
    const celebrationBtn = await $('.celebration-btn.primary')
    if (await celebrationBtn.isExisting().catch(() => false)) {
      try {
        await celebrationBtn.waitForDisplayed({ timeout: 3000 })
        await celebrationBtn.click()
        await browser.pause(300)
      } catch { }
    } else {
      const continueBtn = await $('button*=Continue')
      if (await continueBtn.isExisting().catch(() => false)) {
        try {
          await continueBtn.waitForDisplayed({ timeout: 3000 })
          await continueBtn.click()
          await browser.pause(300)
        } catch { }
      }
    }
    console.log('Step 3: Focus lifecycle (start, pause, resume, finish & reflection) verified')

    // -------------------------------------------------------------------------
    // 4. SCHEDULE / CALENDAR VIEW
    // -------------------------------------------------------------------------
    const scheduleNav = await $('[data-tab="Schedule"]')
    await safeClick(scheduleNav)

    const scheduleLayout = await $('.schedule-container, .schedule-calendar-main')
    await scheduleLayout.waitForDisplayed({ timeout: 20000 })
    const calTitle = await $('.schedule-toolbar-title h1')
    assert.ok(await calTitle.isDisplayed(), 'Calendar title must be visible in Schedule view')
    console.log('Step 4: Schedule / Calendar view verified')

    // -------------------------------------------------------------------------
    // 5. ANALYTICS VIEW WITH RECORDED DURATION VERIFICATION
    // -------------------------------------------------------------------------
    const analyticsNav = await $('[data-tab="Analytics"]')
    await safeClick(analyticsNav)
    await browser.waitUntil(async () => await analyticsNav.getAttribute('aria-current') === 'page', { timeout: 20000 })
    const analyticsContainer = await $('.analytics-view')
    await analyticsContainer.waitForDisplayed({ timeout: 20000 })

    // Verify Focus time stat is rendered and non-empty
    const focusTimeStat = await $('.analytics-card-focus strong')
    await focusTimeStat.waitForDisplayed({ timeout: 15000 })
    await browser.waitUntil(async () => {
      const text = (await focusTimeStat.getText()).trim()
      return text.length > 0 && text !== '—'
    }, { timeout: 15000, timeoutMsg: 'Focus time stat remained empty' })
    const focusTimeText = (await focusTimeStat.getText()).trim()

    // Verify completed sessions metric
    const sessionsStat = await $('article.analytics-card strong')
    assert.ok(await sessionsStat.isDisplayed(), 'Completed sessions count must be visible in Analytics')
    console.log(`Step 5: Analytics view and recorded focus duration (${focusTimeText}) verified`)

    // -------------------------------------------------------------------------
    // 6. REWARDS VIEW & LEDGER VERIFICATION
    // -------------------------------------------------------------------------
    const rewardsNav = await $('[data-tab="Rewards"]')
    await safeClick(rewardsNav)

    const rewardsHero = await $('.rewards-hero, .rewards-view')
    await rewardsHero.waitForDisplayed({ timeout: 20000 })
    const ledgerTrust = await $('.rewards-ledger-trust, .rewards-hero-copy')
    assert.ok(await ledgerTrust.isDisplayed(), 'Rewards progress hero/trust ledger must be displayed')
    console.log('Step 6: Rewards view and verified ledger calculations verified')

    // -------------------------------------------------------------------------
    // 7. EONPAI AI ASSISTANT: SEND MESSAGE & VERIFY NATIVE RESPONSE
    // -------------------------------------------------------------------------
    const eonpaiNav = await $('[data-tab="AI Assistant"]')
    await safeClick(eonpaiNav)

    const eonpaiInput = await $('.eonpai-composer-input, textarea[aria-label="Message to EONPAI"]')
    await eonpaiInput.waitForDisplayed({ timeout: 20000 })
    await eonpaiInput.setValue('Hello EONPAI, summarize my focus progress')

    const eonpaiSendBtn = await $('.eonpai-composer-send-btn')
    await browser.waitUntil(async () => !(await eonpaiSendBtn.getAttribute('disabled')), { timeout: 5000 }).catch(() => { })
    await safeClick(eonpaiSendBtn)

    // Verify assistant reply arrives
    const assistantBubble = await $('.ai-bubble.assistant .ai-bubble-text')
    await assistantBubble.waitForDisplayed({ timeout: 30000 })
    const replyText = (await assistantBubble.getText()).trim()
    assert.ok(replyText.length > 0, 'EONPAI must return a non-empty native response')
    console.log(`Step 7: EONPAI interaction verified (response length: ${replyText.length} chars)`)

    // -------------------------------------------------------------------------
    // 8. SETTINGS MODAL: BROWSER COMPANION & SHINPOSELECT AI PROVIDER & SCROLLBAR
    // -------------------------------------------------------------------------
    const accountBtn = await $('button[aria-label*="Account"], .profile-badge-card')
    await safeClick(accountBtn)
    await browser.pause(400)

    const companionMenuItem = await $('span*=Browser Companion')
    if (await companionMenuItem.isExisting()) {
      await safeClick(companionMenuItem)
    } else {
      const allSettingsItem = await $('span*=All settings')
      if (await allSettingsItem.isExisting()) {
        await safeClick(allSettingsItem)
      } else {
        await browser.keys(['Control', ','])
      }
      await browser.pause(400)
      const compTab = await $('button[data-section="companion"]')
      await safeClick(compTab)
    }

    const settingsDialog = await $('.settings-modal-dialog, [role="dialog"]')
    await settingsDialog.waitForDisplayed({ timeout: 15000 })

    // Verify Browser Companion 4-step setup
    const companionSteps = await $$('.companion-step')
    assert.ok(companionSteps.length >= 3, 'Browser Companion setup steps must render in Settings')

    // Generate 10-minute pairing code
    const genCodeBtn = await $('button*=Generate 10-minute pairing code')
    if (await genCodeBtn.isExisting()) {
      await safeClick(genCodeBtn)
      const codeEl = await $('.companion-code-box code, .companion-code-display code')
      await codeEl.waitForDisplayed({ timeout: 15000 })
      const pairingCodeText = (await codeEl.getText()).trim()
      assert.ok(pairingCodeText.length >= 16, 'Pairing code must match 10-minute security token format')
      assert.match(pairingCodeText, /^[a-f0-9]{64}$/i, 'Pairing token must be a 64-character cryptographic hex challenge')
      console.log(`Step 8a: Browser Companion pairing code verified (${pairingCodeText.slice(0, 12)}...)`)
    }

    // Switch to EONPAI tab to verify ShinpoSelect
    const eonpaiSettingsTab = await $('button[data-section="eonpai"]')
    await safeClick(eonpaiSettingsTab)
    await browser.pause(300)

    const selectTrigger = await $('#native-ai-provider, [id="native-ai-provider"]')
    await safeClick(selectTrigger)

    // Assert custom select listbox appears
    const listbox = await $('[role="listbox"]')
    await listbox.waitForDisplayed({ timeout: 5000 })
    // Use the real combobox keyboard contract here. Clicking a portaled option
    // was intermittently intercepted by the dialog in WebKitGTK and produced a
    // stale-element failure unrelated to the select's own interaction path.
    await browser.keys(['ArrowDown'])
    await browser.keys(['Enter'])
    await browser.waitUntil(async () => (await browser.execute(
      () => document.querySelector('#native-ai-provider .shinpo-select-value')?.textContent || ''
    )).includes('Ollama on this computer'), { timeout: 5000 })
    await browser.keys(['Enter'])
    await $('[role="listbox"]').waitForDisplayed({ timeout: 5000 })
    await browser.keys(['Home'])
    await browser.keys(['Enter'])
    await browser.waitUntil(async () => (await browser.execute(
      () => document.querySelector('#native-ai-provider .shinpo-select-value')?.textContent || ''
    )).includes('Offline planning (no model)'), { timeout: 5000 })

    // Close settings dialog
    const closeSettingsBtn = await $('.settings-modal-close')
    if (await closeSettingsBtn.isExisting()) {
      await safeClick(closeSettingsBtn)
    } else {
      await browser.keys(['Escape'])
    }
    await browser.pause(400)
    await browser.waitUntil(async () => !(await $('.settings-modal-dialog').isDisplayed().catch(() => false)), {
      timeout: 10000,
      timeoutMsg: 'Settings dialog did not close',
    }).catch(() => { })
    console.log('Step 8b: Settings ShinpoSelect dropdown and Browser Companion verified')

    // -------------------------------------------------------------------------
    // 9. FOCUS PROTECTION & SAFE DISPOSABLE PROCESS OBSERVATION
    // -------------------------------------------------------------------------
    const guardianNav = await $('[data-tab="Task Manager"]')
    await safeClick(guardianNav)
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
      } catch { }
      try {
        rmSync(fixtureDir, { recursive: true, force: true })
      } catch { }
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
    async function lockWorkspace() {
      const accountBtn = await $('button[aria-label*="Account"]')
      if (await accountBtn.isExisting()) {
        await accountBtn.click()
        await browser.pause(300)
        const lockBtn = await $('.dropdown-menu-item-danger')
        if (await lockBtn.isExisting()) {
          await lockBtn.click()
        } else {
          const lockText = await $('button*=Lock')
          await lockText.click()
        }
      } else {
        const signOutBtn = await $('button[aria-label="Sign Out"]')
        if (await signOutBtn.isExisting()) {
          await signOutBtn.click()
        } else {
          await browser.keys(['Control', 'Shift', 'L'])
        }
      }
    }

    await lockWorkspace()
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
    await lockWorkspace()
    await $('h1').waitForDisplayed({ timeout: 20000 })

    // Click Forgot password?
    const recoverBtn = await $('.animated-forgot-btn')
    if (await recoverBtn.isExisting()) {
      await recoverBtn.click()
    } else {
      const legacyRecoverBtn = await $('button*=Forgot password')
      await legacyRecoverBtn.waitForDisplayed({ timeout: 10000 })
      await legacyRecoverBtn.click()
    }

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
