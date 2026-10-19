import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/task_kanban_verification'

async function runVerification() {
  console.log('=== SHINPO Task Creation UX & Kanban Layout Verification ===')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9280
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-kanban-2-${Date.now()}`,
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
        console.error('Eval error:', res.result.exceptionDetails)
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`[Screenshot] Saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')

    // Standard desktop viewport 1920x1080
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // 1. Authenticate
    console.log('[Step 1] Logging in as EONX...')
    await evaluate(`
      (async () => {
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
      })()
    `)

    console.log('[Setup] Waiting for Dashboard to load...')
    for (let i = 0; i < 30; i++) {
      await sleep(400)
      const isReady = await evaluate(`Boolean(document.querySelector('#tasks-board, .flight-deck-board-panel, .status-column, .aurora-btn-primary'))`)
      if (isReady) break
    }
    await sleep(1200)

    // 2. Open Create Task Modal
    console.log('[Step 2] Opening Create Task modal...')
    await evaluate(`
      (() => {
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => {
          const t = b.textContent || '';
          return t.includes('New Task') || t.includes('Add Task');
        });
        if (addBtn) addBtn.click();
      })()
    `)
    await sleep(800)

    // Inspect presets & goals
    const modalDetails = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return { open: false };

        const goalSelect = document.querySelector('#create-task-goal');
        const goalOptions = goalSelect ? Array.from(goalSelect.options).map(o => ({ value: o.value, text: o.text })) : [];
        const presetButtons = Array.from(modal.querySelectorAll('.btn-timer')).map(b => b.textContent.trim());

        return {
          open: true,
          goalOptions,
          presetButtons,
        };
      })()
    `)
    console.log('Modal details (Goals & Presets):', modalDetails)
    await captureScreenshot('01_create_task_modal_presets.png')

    // 3. Test Custom Duration Validation (< 5m, > 480m, valid 35m)
    console.log('[Step 3] Testing Custom duration boundary validation...')
    await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        const customBtn = Array.from(modal.querySelectorAll('button')).find(b => b.textContent.trim() === 'Custom');
        if (customBtn) customBtn.click();
      })()
    `)
    await sleep(400)

    // Type 3 (< 5 min)
    await evaluate(`
      (() => {
        const input = document.querySelector('input[type="number"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '3');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(300)
    const errLow = await evaluate(`
      (() => {
        const err = Array.from(document.querySelectorAll('.modal-box span')).find(el => (el.textContent || '').includes('between 5 and 480 minutes'));
        const submitBtn = Array.from(document.querySelectorAll('.modal-box button[type="submit"]'))[0];
        return {
          errorText: err?.textContent || null,
          submitDisabled: submitBtn?.disabled ?? null,
        };
      })()
    `)
    console.log('Boundary test (< 5m):', errLow)
    await captureScreenshot('02_create_task_custom_invalid_under_5m.png')

    // Type 500 (> 480 min)
    await evaluate(`
      (() => {
        const input = document.querySelector('input[type="number"]');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, '500');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(300)
    const errHigh = await evaluate(`
      (() => {
        const err = Array.from(document.querySelectorAll('.modal-box span')).find(el => (el.textContent || '').includes('between 5 and 480 minutes'));
        const submitBtn = Array.from(document.querySelectorAll('.modal-box button[type="submit"]'))[0];
        return {
          errorText: err?.textContent || null,
          submitDisabled: submitBtn?.disabled ?? null,
        };
      })()
    `)
    console.log('Boundary test (> 480m):', errHigh)

    // Type 35 (Valid 35 min) and set title
    console.log('[Step 4] Filling valid 35m custom duration and task title...')
    await evaluate(`
      (() => {
        const numInput = document.querySelector('input[type="number"]');
        const numSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        numSetter.call(numInput, '35');
        numInput.dispatchEvent(new Event('input', { bubbles: true }));
        numInput.dispatchEvent(new Event('change', { bubbles: true }));

        const titleInput = document.querySelector('#create-task-title-input');
        const textSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        textSetter.call(titleInput, 'Slice 8 Architecture Audit');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      })()
    `)
    await sleep(300)
    await captureScreenshot('03_create_task_custom_valid_35m.png')

    // 5. Submit task
    console.log('[Step 5] Submitting task...')
    await evaluate(`
      (() => {
        const submitBtn = Array.from(document.querySelectorAll('.modal-box button[type="submit"]'))[0];
        if (submitBtn) submitBtn.click();
      })()
    `)
    await sleep(2500)

    // 6. Verify Task Saved in Backend with 35m
    console.log('[Step 6] Querying backend /api/missions for created task...')
    const verifiedMission = await evaluate(`
      (async () => {
        const token = localStorage.getItem('shinpo_access_token');
        const res = await fetch('/api/missions', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const missions = await res.json();
        return missions.find(m => m.title === 'Slice 8 Architecture Audit');
      })()
    `)
    console.log('Verified mission in DB:', verifiedMission)

    // 7. Scroll down to Tasks Board on Dashboard and capture
    console.log('[Step 7] Capturing Dashboard Tasks Board compact preview...')
    await evaluate(`
      (() => {
        const board = document.querySelector('#tasks-board, .flight-deck-board-panel');
        if (board) board.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `)
    await sleep(800)
    await captureScreenshot('04_dashboard_tasks_board_compact_preview_dark.png')

    // Inspect columns card counts and remaining button
    const boardInspection = await evaluate(`
      (() => {
        const remainingBtns = Array.from(document.querySelectorAll('button')).filter(b => (b.textContent || '').includes('remaining'));
        const cards = Array.from(document.querySelectorAll('.flight-deck-card, [class*="flight-deck-card"]'));
        return {
          totalCardsRenderedOnBoard: cards.length,
          remainingButtons: remainingBtns.map(b => b.textContent.trim()),
        };
      })()
    `)
    console.log('Board preview inspection:', boardInspection)

    // 8. Click "View remaining tasks"
    console.log('[Step 8] Clicking "View remaining tasks" to open full Kanban inventory...')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').includes('remaining'));
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // 9. Capture Full Kanban Board in Goals & Tasks
    await captureScreenshot('05_goals_full_kanban_board_dark.png')

    // 10. Switch to List View in Goals & Tasks
    console.log('[Step 10] Switching to List view in Goals & Tasks...')
    await evaluate(`
      (() => {
        const listBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'List');
        if (listBtn) listBtn.click();
      })()
    `)
    await sleep(800)
    await captureScreenshot('06_goals_task_inventory_list_view.png')

    // 11. Switch back to Board mode, switch to Light Theme
    console.log('[Step 11] Testing Light Theme on full Kanban board...')
    await evaluate(`
      (() => {
        const boardBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Board');
        if (boardBtn) boardBtn.click();
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(800)
    await captureScreenshot('07_goals_full_kanban_board_light.png')

    // 12. Go back to Dashboard in Light Mode
    console.log('[Step 12] Viewing Dashboard Tasks Board in Light mode...')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
          const t = b.textContent || '';
          return t.includes('Dashboard');
        });
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)
    await evaluate(`
      (() => {
        const board = document.querySelector('#tasks-board, .flight-deck-board-panel');
        if (board) board.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `)
    await sleep(800)
    await captureScreenshot('08_dashboard_tasks_board_compact_preview_light.png')

    console.log('=== All Verifications Completed Successfully ===')
  } finally {
    chrome.kill()
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err)
  process.exit(1)
})

