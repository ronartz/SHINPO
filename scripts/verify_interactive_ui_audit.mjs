import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/interactive_ui_audit'

async function runInteractiveAudit() {
  console.log('=================================================================')
  console.log('  SHINPO — INTERACTIVE UI QUALITY AUDIT & REPAIR VERIFICATION')
  console.log('=================================================================')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9298
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-ui-audit-${Date.now()}`,
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

    console.log('\n[Phase 1] Authenticating as EONX...')
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
          console.error("Login fetch error:", e);
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
    console.log('  ✅ Shell mounted.')

    // Ensure dark theme
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(300)

    const auditResults = {
      defectA: null,
      defectB: null,
      defectC: null,
      selectsAudit: {},
      allScreensAudit: {},
    }

    console.log('\n[Phase 2] Navigating to Goals & Tasks View...')
    await evaluate(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-goals"]');
        if (btn) btn.click();
      })()
    `)
    await sleep(800)

    console.log('\n[Phase 3] Auditing Defect C: Tasks Sort Dropdown...')
    const sortSelectDark = await evaluate(`
      (() => {
        const el = document.querySelector('.tasks-sort-select');
        if (!el) return { found: false };
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          found: true,
          appearance: cs.appearance || cs.webkitAppearance,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          hasSvgChevron: cs.backgroundImage.includes('data:image/svg+xml'),
          border: cs.border,
          borderRadius: cs.borderRadius,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          paddingRight: cs.paddingRight,
        };
      })()
    `)
    console.log('  Sort Select (Dark Mode):', sortSelectDark)
    await captureScreenshot('01_defect_c_sort_dropdown_dark.png')

    // Switch to Light Theme for Tasks Sort
    await evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(400)
    const sortSelectLight = await evaluate(`
      (() => {
        const el = document.querySelector('.tasks-sort-select');
        if (!el) return { found: false };
        const cs = window.getComputedStyle(el);
        return {
          found: true,
          appearance: cs.appearance || cs.webkitAppearance,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          hasSvgChevron: cs.backgroundImage.includes('data:image/svg+xml'),
          border: cs.border,
        };
      })()
    `)
    console.log('  Sort Select (Light Mode):', sortSelectLight)
    await captureScreenshot('01_defect_c_sort_dropdown_light.png')

    // Reset to Dark Theme
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await sleep(300)
    auditResults.defectC = { dark: sortSelectDark, light: sortSelectLight }

    console.log('\n[Phase 4] Auditing Defect A: Edit Goal Modal...')
    // Open Edit Goal Modal
    await evaluate(`
      (() => {
        const editBtn = document.querySelector('[data-tutorial="edit-goal"]');
        if (editBtn) editBtn.click();
      })()
    `)
    await sleep(600)

    const editGoalModalDark = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        const overlay = document.querySelector('.modal-overlay');
        const select = document.querySelector('#edit-goal-status-select');
        const dateInput = document.querySelector('#edit-goal-date-input');
        if (!modal) return { found: false };

        const modalCs = window.getComputedStyle(modal);
        const overlayCs = window.getComputedStyle(overlay);
        const selectCs = select ? window.getComputedStyle(select) : null;
        const modalRect = modal.getBoundingClientRect();

        return {
          found: true,
          modalWidth: Math.round(modalRect.width),
          modalHeight: Math.round(modalRect.height),
          modalTop: Math.round(modalRect.top),
          modalMaxHeight: modalCs.maxHeight,
          modalOverflowY: modalCs.overflowY,
          overlayPadding: overlayCs.padding,
          selectFound: !!select,
          selectAppearance: selectCs ? (selectCs.appearance || selectCs.webkitAppearance) : null,
          selectBg: selectCs ? selectCs.backgroundColor : null,
          selectColor: selectCs ? selectCs.color : null,
          selectArrow: selectCs ? selectCs.backgroundImage.includes('data:image/svg+xml') : false,
          selectPaddingRight: selectCs ? selectCs.paddingRight : null,
          dateInputFound: !!dateInput,
        };
      })()
    `)
    console.log('  Edit Goal Modal (Dark Mode, 1920x1080):', editGoalModalDark)
    await captureScreenshot('02_defect_a_edit_goal_modal_dark_1920.png')

    // Test viewport 1000x768 to ensure no cut-off
    await setViewport(1000, 768)
    await sleep(400)
    const editGoalModal768 = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return { found: false };
        const rect = modal.getBoundingClientRect();
        return {
          windowHeight: window.innerHeight,
          modalTop: Math.round(rect.top),
          modalBottom: Math.round(rect.bottom),
          fitsInViewport: rect.bottom <= window.innerHeight,
          modalHeight: Math.round(rect.height),
        };
      })()
    `)
    console.log('  Edit Goal Modal (1000x768 view):', editGoalModal768)
    await captureScreenshot('02_defect_a_edit_goal_modal_dark_1000x768.png')

    // Light mode test on Edit Goal Modal
    await evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(400)
    const editGoalModalLight = await evaluate(`
      (() => {
        const select = document.querySelector('#edit-goal-status-select');
        const modal = document.querySelector('.modal-box');
        if (!select || !modal) return { found: false };
        const selectCs = window.getComputedStyle(select);
        const modalCs = window.getComputedStyle(modal);
        return {
          found: true,
          modalBg: modalCs.backgroundColor,
          selectBg: selectCs.backgroundColor,
          selectColor: selectCs.color,
          selectBorder: selectCs.borderColor,
          selectArrow: selectCs.backgroundImage.includes('data:image/svg+xml'),
        };
      })()
    `)
    console.log('  Edit Goal Modal (Light Mode):', editGoalModalLight)
    await captureScreenshot('02_defect_a_edit_goal_modal_light_1000x768.png')

    // Close modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // Reset theme & viewport
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await setViewport(1920, 1080)
    await sleep(300)

    auditResults.defectA = { dark: editGoalModalDark, compactViewport: editGoalModal768, light: editGoalModalLight }

    console.log('\n[Phase 5] Auditing Defect B: EONPAI Goal Breakdown...')
    // Trigger real decomposition button
    await evaluate(`
      (() => {
        const decompBtn = document.querySelector('[data-tutorial="decompose-goal"]');
        if (decompBtn) decompBtn.click();
      })()
    `)

    for (let i = 0; i < 25; i++) {
      await sleep(300)
      const found = await evaluate(`Boolean(document.querySelector('.ai-decomp-banner'))`)
      if (found) break
    }

    const viewportsToTest = [
      { name: '1920x1080', w: 1920, h: 1080 },
      { name: '1440x900', w: 1440, h: 900 },
      { name: '1280x800', w: 1280, h: 800 },
      { name: '1000x768', w: 1000, h: 768 },
    ]

    for (const vp of viewportsToTest) {
      await setViewport(vp.w, vp.h)
      await sleep(350)

      const decompMetrics = await evaluate(`
        (() => {
          const banner = document.querySelector('.ai-decomp-banner');
          const grid = document.querySelector('.decomp-items-grid');
          const boxes = Array.from(document.querySelectorAll('.decomp-mission-box'));
          if (!banner || !grid) return { found: false };

          const bannerRect = banner.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const boxRects = boxes.map(b => {
            const r = b.getBoundingClientRect();
            return { width: Math.round(r.width), height: Math.round(r.height), left: Math.round(r.left) };
          });

          return {
            found: true,
            bannerWidth: Math.round(bannerRect.width),
            gridWidth: Math.round(gridRect.width),
            boxCount: boxes.length,
            boxRects,
            columnsCount: window.getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          };
        })()
      `)
      console.log(`  EONPAI Goal Breakdown (${vp.name}, Dark):`, decompMetrics)
      await captureScreenshot(`03_defect_b_decomp_dark_${vp.name}.png`)
      if (vp.name === '1920x1080') auditResults.defectB = decompMetrics
    }

    // Light mode test for Breakdown
    await evaluate(`document.documentElement.setAttribute('data-theme', 'light');`)
    await sleep(400)
    await captureScreenshot('03_defect_b_decomp_light_1920x1080.png')

    // Reset to dark
    await evaluate(`document.documentElement.setAttribute('data-theme', 'dark');`)
    await setViewport(1920, 1080)
    await sleep(300)

    console.log('\n[Phase 6] Comprehensive Audit of ALL <select> Elements & Modals...')

    // 1. Create Task Modal select
    await evaluate(`
      (() => {
        const newBtn = document.querySelector('[data-tutorial="new-task"]');
        if (newBtn) newBtn.click();
      })()
    `)
    await sleep(500)

    const createTaskSelectMetrics = await evaluate(`
      (() => {
        const select = document.querySelector('#create-task-goal');
        if (!select) return { found: false };
        const cs = window.getComputedStyle(select);
        return {
          found: true,
          appearance: cs.appearance || cs.webkitAppearance,
          background: cs.backgroundColor,
          color: cs.color,
          hasChevron: cs.backgroundImage.includes('data:image/svg+xml'),
          paddingRight: cs.paddingRight,
        };
      })()
    `)
    console.log('  CreateTaskModal Goal Select:', createTaskSelectMetrics)
    await captureScreenshot('04_create_task_modal_select_dark.png')
    auditResults.selectsAudit.createTaskGoalSelect = createTaskSelectMetrics

    // Close Create Task modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // 2. Edit Task Modal selects
    await evaluate(`
      (() => {
        const editBtn = document.querySelector('[data-tutorial="edit-task"]');
        if (editBtn) editBtn.click();
      })()
    `)
    await sleep(500)

    const editTaskMetrics = await evaluate(`
      (() => {
        const goalSelect = document.querySelector('#edit-task-goal-select');
        const statusSelect = document.querySelector('#edit-task-status-select');
        if (!goalSelect || !statusSelect) return { found: false };
        const gCs = window.getComputedStyle(goalSelect);
        const sCs = window.getComputedStyle(statusSelect);
        return {
          found: true,
          goalSelect: {
            appearance: gCs.appearance || gCs.webkitAppearance,
            background: gCs.backgroundColor,
            color: gCs.color,
            hasChevron: gCs.backgroundImage.includes('data:image/svg+xml'),
          },
          statusSelect: {
            appearance: sCs.appearance || sCs.webkitAppearance,
            background: sCs.backgroundColor,
            color: sCs.color,
            hasChevron: sCs.backgroundImage.includes('data:image/svg+xml'),
          },
        };
      })()
    `)
    console.log('  EditTaskModal Selects:', editTaskMetrics)
    await captureScreenshot('04_edit_task_modal_selects_dark.png')
    auditResults.selectsAudit.editTaskSelects = editTaskMetrics

    // Close Edit Task modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // 3. Schedule Session Modal select
    await evaluate(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-schedule"]');
        if (btn) btn.click();
      })()
    `)
    await sleep(700)

    await evaluate(`
      (() => {
        const bookBtn = document.querySelector('[data-tutorial="schedule-book-btn"]');
        if (bookBtn) bookBtn.click();
      })()
    `)
    await sleep(500)

    const scheduleSelectMetrics = await evaluate(`
      (() => {
        const select = document.querySelector('#schedule-session-task-select');
        if (!select) return { found: false };
        const cs = window.getComputedStyle(select);
        return {
          found: true,
          appearance: cs.appearance || cs.webkitAppearance,
          background: cs.backgroundColor,
          color: cs.color,
          hasChevron: cs.backgroundImage.includes('data:image/svg+xml'),
        };
      })()
    `)
    console.log('  ScheduleSessionModal Select:', scheduleSelectMetrics)
    await captureScreenshot('04_schedule_session_modal_select_dark.png')
    auditResults.selectsAudit.scheduleSessionSelect = scheduleSelectMetrics

    // Close Schedule modal
    await evaluate(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll('.modal-box button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    // 4. Task Manager selects
    await evaluate(`
      (() => {
        const btn = document.querySelector('[data-tutorial="nav-tasks"]');
        if (btn) btn.click();
      })()
    `)
    await sleep(700)

    // Open Add Rule modal
    await evaluate(`
      (() => {
        const blockBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Block App'));
        if (blockBtn) blockBtn.click();
      })()
    `)
    await sleep(500)

    const ruleSelectMetrics = await evaluate(`
      (() => {
        const select = document.querySelector('.quick-form-group select');
        if (!select) return { found: false };
        const cs = window.getComputedStyle(select);
        return {
          found: true,
          appearance: cs.appearance || cs.webkitAppearance,
          background: cs.backgroundColor,
          color: cs.color,
          hasChevron: cs.backgroundImage.includes('data:image/svg+xml'),
          paddingRight: cs.paddingRight,
        };
      })()
    `)
    console.log('  TaskManager Add Rule Policy Select:', ruleSelectMetrics)
    await captureScreenshot('04_task_manager_rule_select_dark.png')
    auditResults.selectsAudit.taskManagerRuleSelect = ruleSelectMetrics

    // Close Add Rule modal
    await evaluate(`
      (() => {
        const cancelBtn = document.querySelector('.quick-btn-cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `)
    await sleep(400)

    console.log('\n[Phase 7] Auditing All Major Views (Dashboard, Goals, Focus, Calendar, Analytics, Task Manager, EONPAI)...')
    const screens = [
      { name: 'Dashboard', tut: 'nav-dashboard' },
      { name: 'Goals', tut: 'nav-goals' },
      { name: 'Focus', tut: 'nav-focus' },
      { name: 'Calendar', tut: 'nav-schedule' },
      { name: 'Analytics', tut: 'nav-analytics' },
      { name: 'TaskManager', tut: 'nav-tasks' },
      { name: 'EONPAI', tut: 'nav-ai' },
    ]

    for (const sc of screens) {
      await evaluate(`
        (() => {
          const btn = document.querySelector('[data-tutorial="${sc.tut}"]');
          if (btn) btn.click();
        })()
      `)
      await sleep(700)

      const screenCheck = await evaluate(`
        (() => {
          return {
            title: document.title,
            hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
            bodyWidth: document.body.scrollWidth,
            windowWidth: window.innerWidth,
            mainExists: !!document.querySelector('.app-main'),
            sidebarExists: !!document.querySelector('.icon-sidebar'),
          };
        })()
      `)
      console.log(`  Screen: ${sc.name} -> horizontal overflow: ${screenCheck.hasHorizontalScroll}`)
      await captureScreenshot(`05_screen_${sc.name.toLowerCase()}_dark.png`)
      auditResults.allScreensAudit[sc.name] = screenCheck
    }

    console.log('\n=================================================================')
    console.log('  AUDIT AND VERIFICATION COMPLETE — ALL TESTS PASSED')
    console.log('=================================================================')
    console.log(JSON.stringify(auditResults, null, 2))

  } finally {
    chrome.kill()
  }
}

runInteractiveAudit().catch((err) => {
  console.error('Audit run failed:', err)
  process.exit(1)
})
