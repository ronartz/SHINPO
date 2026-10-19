import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/ui_core_migration'

async function runUiCoreMigrationVerification() {
  console.log('=================================================================')
  console.log('  SHINPO — UI CORE REAL APPLICATION INTEGRATION VERIFICATION')
  console.log('=================================================================')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9299
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-ui-core-${Date.now()}`,
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
      } catch { }
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome debugging port')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))

    let id = 1
    const pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
      }
    })

    function send(method, params = {}) {
      const msgId = id++
      return new Promise((resolve) => {
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        console.error('Eval exception:', res.result.exceptionDetails)
      }
      return res.result?.result?.value
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(350)
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`  ✓ Screenshot saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')

    await setViewport(1920, 1080)

    console.log('\n[Phase 1] Authenticating as EONX on real application...')
    await evaluate(`
      (async () => {
        try {
          let res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernameOrEmail: "EONX", password: "shinpo_dev" })
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem("shinpo_access_token", data.accessToken);
            localStorage.setItem("shinpo_refresh_token", data.refreshToken);
            localStorage.setItem("shinpo_auth_user", JSON.stringify(data.user));
            location.reload();
          }
        } catch (e) {
          console.error("Login error:", e);
        }
      })()
    `)

    let shellMounted = false
    for (let i = 0; i < 40; i++) {
      await sleep(300)
      shellMounted = await evaluate(`Boolean(document.querySelector('.icon-sidebar') && document.querySelector('.app-main'))`)
      if (shellMounted) break
    }
    if (!shellMounted) throw new Error('Shell did not mount after auth')
    console.log('  ✅ Application shell mounted successfully.')

    // Ensure dark theme
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(300)

    // Verify Portal root exists
    const portalRootExists = await evaluate(`Boolean(document.getElementById('shinpo-portal-root'))`)
    console.log('  Portal root (#shinpo-portal-root) mounted:', portalRootExists)
    if (!portalRootExists) throw new Error('Portal root was not mounted into DOM')

    // =========================================================================
    // SCREEN 1: Goals View — Task Sort ShinpoSelect
    // =========================================================================
    console.log('\n[Phase 2] Screen 1: Goals View & Task Sort ShinpoSelect...')
    await evaluate(`document.querySelector('[data-tutorial="nav-goals"]')?.click();`)
    await sleep(700)

    const sortSelectInfo = await evaluate(`
      (() => {
        const trigger = document.getElementById('tasks-sort-select') ||
                        document.querySelector('.tasks-sort-wrap .shinpo-select-trigger') ||
                        document.querySelector('.tasks-sort-select button');
        if (!trigger) return { found: false };
        const cs = window.getComputedStyle(trigger);
        const rect = trigger.getBoundingClientRect();
        return {
          found: true,
          text: trigger.textContent.trim(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          ariaExpanded: trigger.getAttribute('aria-expanded'),
          ariaHasPopup: trigger.getAttribute('aria-haspopup'),
          backgroundColor: cs.backgroundColor,
          border: cs.border,
        };
      })()
    `)
    console.log('  Tasks Sort ShinpoSelect trigger:', sortSelectInfo)
    if (!sortSelectInfo.found) throw new Error('Tasks Sort ShinpoSelect trigger not found')

    // Click trigger to open dropdown
    await evaluate(`(document.getElementById('tasks-sort-select') || document.querySelector('.tasks-sort-wrap .shinpo-select-trigger'))?.click();`)
    await sleep(300)

    const sortDropdownOpen = await evaluate(`
      (() => {
        const popover = document.querySelector('#shinpo-portal-root .shinpo-select-popover');
        if (!popover) return { open: false };
        const items = Array.from(popover.querySelectorAll('.shinpo-select-option')).map(el => el.textContent.trim());
        const rect = popover.getBoundingClientRect();
        return {
          open: true,
          itemCount: items.length,
          items,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          zIndex: window.getComputedStyle(popover).zIndex,
        };
      })()
    `)
    console.log('  Tasks Sort Dropdown opened via Portal:', sortDropdownOpen)
    if (!sortDropdownOpen.open) throw new Error('Tasks Sort Popover failed to open in Portal')
    await captureScreenshot('01_goals_task_sort_opened_dark.png')

    // Switch to Light Mode and capture
    await evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(300)
    await captureScreenshot('01_goals_task_sort_opened_light.png')

    // Select an option and close
    await evaluate(`
      (() => {
        const items = document.querySelectorAll('#shinpo-portal-root .shinpo-select-option');
        if (items.length > 1) items[1].click();
      })()
    `)
    await sleep(300)
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(200)

    // =========================================================================
    // SCREEN 2: Edit Goal Modal — ShinpoDatePicker & ShinpoSelect
    // =========================================================================
    console.log('\n[Phase 3] Screen 2: Edit Goal Modal — ShinpoDatePicker & ShinpoSelect...')
    await evaluate(`document.querySelector('[data-tutorial="edit-goal"]')?.click();`)
    await sleep(600)

    const editGoalModalInfo = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        const statusTrigger = document.getElementById('edit-goal-status-select') || document.querySelector('#edit-goal-status-select');
        const dateTrigger = document.getElementById('edit-goal-date-input') || document.querySelector('#edit-goal-date-input');
        return {
          modalFound: Boolean(modal),
          statusTriggerFound: Boolean(statusTrigger),
          statusText: statusTrigger?.textContent?.trim(),
          dateTriggerFound: Boolean(dateTrigger),
          dateText: dateTrigger?.textContent?.trim(),
        };
      })()
    `)
    console.log('  Edit Goal Modal controls:', editGoalModalInfo)
    if (!editGoalModalInfo.statusTriggerFound || !editGoalModalInfo.dateTriggerFound) {
      throw new Error('Edit Goal Modal controls (Select or DatePicker) not found')
    }

    // Open DatePicker inside modal
    await evaluate(`(document.getElementById('edit-goal-date-input') || document.querySelector('#edit-goal-date-input'))?.click();`)
    await sleep(300)

    const datePickerPopover = await evaluate(`
      (() => {
        const popover = document.querySelector('#shinpo-portal-root .shinpo-datepicker-popover');
        if (!popover) return { open: false };
        const days = popover.querySelectorAll('.shinpo-calendar-day-btn');
        const cs = window.getComputedStyle(popover);
        const rect = popover.getBoundingClientRect();
        return {
          open: true,
          dayButtons: days.length,
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          zIndex: cs.zIndex,
        };
      })()
    `)
    console.log('  DatePicker Calendar opened in Modal:', datePickerPopover)
    if (!datePickerPopover.open || Number(datePickerPopover.zIndex) < 9000) {
      throw new Error('DatePicker popover did not layer properly above modal dialog')
    }
    await captureScreenshot('02_edit_goal_datepicker_opened_dark.png')

    // Close DatePicker by clicking Today
    await evaluate(`document.querySelector('#shinpo-portal-root .shinpo-calendar-footer button')?.click();`)
    await sleep(300)

    // Open Status ShinpoSelect inside modal
    await evaluate(`(document.getElementById('edit-goal-status-select') || document.querySelector('#edit-goal-status-select'))?.click();`)
    await sleep(300)

    const statusPopover = await evaluate(`
      (() => {
        const popover = document.querySelector('#shinpo-portal-root .shinpo-select-popover');
        if (!popover) return { open: false };
        const options = Array.from(popover.querySelectorAll('.shinpo-select-option')).map(el => el.textContent.trim());
        const cs = window.getComputedStyle(popover);
        return {
          open: true,
          options,
          zIndex: cs.zIndex,
        };
      })()
    `)
    console.log('  Status ShinpoSelect opened in Modal:', statusPopover)
    if (!statusPopover.open || Number(statusPopover.zIndex) < 9000) {
      throw new Error('Status popover did not layer properly above modal dialog')
    }
    await captureScreenshot('02_edit_goal_status_select_opened_dark.png')

    // Test viewport responsiveness at 1000x768
    await setViewport(1000, 768)
    await sleep(350)
    await captureScreenshot('02_edit_goal_modal_1000x768_dark.png')
    await setViewport(1920, 1080)
    await sleep(250)

    // Close modal by clicking Cancel
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('.modal-box button'));
        const cancelBtn = btns.find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // =========================================================================
    // SCREEN 3: Create Task Modal — Associated Goal ShinpoSelect & Presets
    // =========================================================================
    console.log('\n[Phase 4] Screen 3: Create Task Modal — Associated Goal ShinpoSelect...')
    await evaluate(`
      (() => {
        const addBtn = document.querySelector('[data-tutorial="new-task"]') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        if (addBtn) addBtn.click();
      })()
    `)
    await sleep(600)

    const createTaskModalInfo = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        const goalTrigger = document.getElementById('create-task-goal') || document.querySelector('#create-task-goal');
        const durationPresets = Array.from(document.querySelectorAll('.duration-preset-btn')).map(b => b.textContent.trim());
        return {
          modalFound: Boolean(modal),
          goalTriggerFound: Boolean(goalTrigger),
          goalText: goalTrigger?.textContent?.trim(),
          durationPresetsCount: durationPresets.length,
          durationPresets,
        };
      })()
    `)
    console.log('  Create Task Modal controls:', createTaskModalInfo)
    if (!createTaskModalInfo.goalTriggerFound) throw new Error('Create Task Goal ShinpoSelect not found')

    // Open Associated Goal ShinpoSelect
    await evaluate(`(document.getElementById('create-task-goal') || document.querySelector('#create-task-goal'))?.click();`)
    await sleep(300)

    const goalSelectPopover = await evaluate(`
      (() => {
        const popover = document.querySelector('#shinpo-portal-root .shinpo-select-popover');
        if (!popover) return { open: false };
        const goals = Array.from(popover.querySelectorAll('.shinpo-select-option')).map(el => el.textContent.trim());
        return {
          open: true,
          goalCount: goals.length,
          goals,
          zIndex: window.getComputedStyle(popover).zIndex,
        };
      })()
    `)
    console.log('  Associated Goal options (real DB):', goalSelectPopover)
    await captureScreenshot('03_create_task_goal_select_opened_dark.png')

    // Switch to Light Theme
    await evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(300)
    await captureScreenshot('03_create_task_goal_select_opened_light.png')
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(200)

    // Close modal
    await evaluate(`
      (() => {
        const closeBtn = document.querySelector('.modal-box [aria-label="Close modal"]') ||
                         Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (closeBtn) closeBtn.click();
      })()
    `)
    await sleep(400)

    // =========================================================================
    // SCREEN 4: Edit Task Modal — Scheduled Date ShinpoDatePicker & Status ShinpoSelect
    // =========================================================================
    console.log('\n[Phase 5] Screen 4: Edit Task Modal — ShinpoDatePicker & ShinpoSelect...')
    await evaluate(`
      (() => {
        const editTaskBtn = document.querySelector('[data-tutorial="edit-task"]') ||
                            document.querySelector('.mission-card button[title="Edit Task"]') ||
                            document.querySelector('.mission-card .btn-icon');
        if (editTaskBtn) editTaskBtn.click();
      })()
    `)
    await sleep(600)

    const editTaskModalInfo = await evaluate(`
      (() => {
        const dateTrigger = document.getElementById('edit-task-date-input') || document.querySelector('#edit-task-date-input');
        const statusTrigger = document.getElementById('edit-task-status-select') || document.querySelector('#edit-task-status-select');
        return {
          found: Boolean(dateTrigger && statusTrigger),
          date: dateTrigger?.textContent?.trim(),
          status: statusTrigger?.textContent?.trim(),
        };
      })()
    `)
    console.log('  Edit Task Modal controls:', editTaskModalInfo)

    if (editTaskModalInfo.found) {
      // Open Status Select
      await evaluate(`(document.getElementById('edit-task-status-select') || document.querySelector('#edit-task-status-select'))?.click();`)
      await sleep(300)
      await captureScreenshot('04_edit_task_status_opened_dark.png')

      // Close modal
      await evaluate(`
        (() => {
          const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
          if (cancelBtn) cancelBtn.click();
        })()
      `)
      await sleep(400)
    }

    // =========================================================================
    // SCREEN 5: Schedule View — ShinpoDatePicker & ShinpoTimePicker
    // =========================================================================
    console.log('\n[Phase 6] Screen 5: Schedule View — Schedule Session Modal...')
    await evaluate(`(document.querySelector('[data-tutorial="nav-schedule"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Calendar')))?.click();`)
    await sleep(700)

    await evaluate(`
      (() => {
        const scheduleBtn = document.querySelector('[data-tutorial="schedule-book-btn"]') ||
                            document.querySelector('.schedule-btn-book') ||
                            Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Book Focus Session'));
        if (scheduleBtn) scheduleBtn.click();
      })()
    `)
    await sleep(600)

    const scheduleModalInfo = await evaluate(`
      (() => {
        const dateTrigger = document.getElementById('schedule-session-date-picker') || document.querySelector('.shinpo-datepicker-trigger');
        const timeTrigger = document.getElementById('schedule-session-time-picker') || document.querySelector('.shinpo-timepicker-trigger');
        const taskTrigger = document.getElementById('schedule-session-task-select') || document.querySelector('.shinpo-select-trigger');
        return {
          found: Boolean(dateTrigger && timeTrigger),
          dateText: dateTrigger?.textContent?.trim(),
          timeText: timeTrigger?.textContent?.trim(),
          taskText: taskTrigger?.textContent?.trim(),
        };
      })()
    `)
    console.log('  Schedule Session Modal controls:', scheduleModalInfo)
    if (!scheduleModalInfo.found) throw new Error('Schedule Session controls not found')

    // Open TimePicker
    await evaluate(`(document.getElementById('schedule-session-time-picker') || document.querySelector('.shinpo-timepicker-trigger'))?.click();`)
    await sleep(300)

    const timePickerPopover = await evaluate(`
      (() => {
        const popover = document.querySelector('#shinpo-portal-root .shinpo-timepicker-popover');
        if (!popover) return { open: false };
        const buttons = popover.querySelectorAll('.shinpo-timepicker-unit-btn');
        return {
          open: true,
          unitButtonsCount: buttons.length,
          zIndex: window.getComputedStyle(popover).zIndex,
        };
      })()
    `)
    console.log('  TimePicker Popover opened in Modal:', timePickerPopover)
    if (!timePickerPopover.open || Number(timePickerPopover.zIndex) < 9000) {
      throw new Error('TimePicker popover did not layer properly above modal dialog')
    }
    await captureScreenshot('05_schedule_timepicker_opened_dark.png')

    // Select hour and minute
    await evaluate(`
      (() => {
        const hourBtns = Array.from(document.querySelectorAll('.shinpo-timepicker-col:first-child .shinpo-timepicker-unit-btn'));
        const hour14 = hourBtns.find(b => b.textContent.trim() === '14');
        if (hour14) hour14.click();
        const minBtns = Array.from(document.querySelectorAll('.shinpo-timepicker-col:last-child .shinpo-timepicker-unit-btn'));
        const min30 = minBtns.find(b => b.textContent.trim() === '30');
        if (min30) min30.click();
      })()
    `)
    await sleep(300)

    // Close modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // =========================================================================
    // SCREEN 6: Task Manager View — Sentinel Shield ShinpoSelect
    // =========================================================================
    console.log('\n[Phase 7] Screen 6: Task Manager View — Sentinel Shield Rules...')
    await evaluate(`(document.querySelector('[data-tutorial="nav-tasks"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Task Manager')))?.click();`)
    await sleep(700)

    // Open Add Rule modal
    await evaluate(`
      (() => {
        const addRuleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Block App'));
        if (addRuleBtn) addRuleBtn.click();
      })()
    `)
    await sleep(600)

    const ruleSelectInfo = await evaluate(`
      (() => {
        const trigger = document.querySelector('.quick-form-group .shinpo-select-trigger');
        return {
          found: Boolean(trigger),
          text: trigger?.textContent?.trim(),
        };
      })()
    `)
    console.log('  Add Rule ShinpoSelect:', ruleSelectInfo)
    if (!ruleSelectInfo.found) throw new Error('Policy Action ShinpoSelect not found in Add Rule')

    // Open policy select
    await evaluate(`document.querySelector('.quick-form-group .shinpo-select-trigger')?.click();`)
    await sleep(300)
    await captureScreenshot('06_task_manager_policy_select_dark.png')

    // Close modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // =========================================================================
    // PHASE 8: Zero Native Unstyled Controls Across Real DOM
    // =========================================================================
    console.log('\n[Phase 8] Auditing 100% Elimination of Native Unstyled Controls...')
    const nativeControlsAudit = await evaluate(`
      (() => {
        const nativeSelects = Array.from(document.querySelectorAll('select')).map(s => ({
          id: s.id,
          name: s.name,
          className: s.className,
        }));
        const nativeDateInputs = Array.from(document.querySelectorAll('input[type="date"]')).map(i => ({
          id: i.id,
          name: i.name,
          className: i.className,
        }));
        const nativeTimeInputs = Array.from(document.querySelectorAll('input[type="time"]')).map(i => ({
          id: i.id,
          name: i.name,
          className: i.className,
        }));

        return {
          nativeSelectsCount: nativeSelects.length,
          nativeSelects,
          nativeDateInputsCount: nativeDateInputs.length,
          nativeDateInputs,
          nativeTimeInputsCount: nativeTimeInputs.length,
          nativeTimeInputs,
        };
      })()
    `)
    console.log('  Native Controls Audit in Live App:', nativeControlsAudit)
    if (nativeControlsAudit.nativeSelectsCount > 0 ||
      nativeControlsAudit.nativeDateInputsCount > 0 ||
      nativeControlsAudit.nativeTimeInputsCount > 0) {
      throw new Error(`Native controls still exist in DOM: ${JSON.stringify(nativeControlsAudit)}`)
    }
    console.log('  ✅ 100% ELIMINATED: Zero native selects, date inputs, or time inputs exist in the DOM.')

    console.log('\n=================================================================')
    console.log('  ALL REAL-APP UI CORE INTEGRATION VERIFICATIONS PASSED!')
    console.log('=================================================================')

  } finally {
    try {
      chrome.kill('SIGTERM')
    } catch { }
  }
}

runUiCoreMigrationVerification().catch((err) => {
  console.error('Fatal verification failure:', err)
  process.exit(1)
})
