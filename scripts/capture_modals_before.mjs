import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/before_recovery'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function captureModalsBefore() {
  console.log('[Capture Baseline] Launching Chrome to capture baseline dialogs and views...')

  const chromePort = 9250
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
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
        const page = list.find((it) => it.type === 'page')
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
      return res.result?.result?.value
    }

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await send('Emulation.setVisibleSize', { width, height })
      await sleep(250)
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`[Captured Baseline] ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Runtime.enable')

    await setViewport(1440, 900)
    await sleep(1500)

    // Log in if needed
    await evaluate(`
      (async () => {
        const fillBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quick Fill') || b.className.includes('quick-fill'));
        if (fillBtn) {
          fillBtn.click();
          await new Promise(r => setTimeout(r, 200));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await sleep(1500)

    // Helper to switch tab
    async function selectTab(tabLabel) {
      await evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
            const title = b.getAttribute('title') || '';
            const text = b.textContent || '';
            return title.includes('${tabLabel}') || text.includes('${tabLabel}');
          });
          if (btn) btn.click();
        })()
      `)
      await sleep(400)
    }

    // Helper to set theme
    async function setTheme(isDark) {
      await evaluate(`
        (() => {
          const targetLight = ${!isDark};
          const currentLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('theme-light');
          if (currentLight !== targetLight) {
            const themeBtn = document.querySelector('.action-btn-circle[title*="Mode"]') ||
                             document.querySelector('button[title*="Mode"]') ||
                             document.querySelector('.topbar-control-btn[title*="Theme"]');
            if (themeBtn) {
              themeBtn.click();
            } else {
              document.documentElement.setAttribute('data-theme', targetLight ? 'light' : 'dark');
            }
          }
        })()
      `)
      await sleep(300)
    }

    // Capture Goals
    await selectTab('Goals')
    await setTheme(true)
    await captureScreenshot('Before_Goals_Dark.png')
    await setTheme(false)
    await captureScreenshot('Before_Goals_Light.png')

    // Open Create Goal modal
    await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-tutorial="new-goal"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Goal'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('Before_Modal_CreateGoal_Light.png')
    // Close modal
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // Open Create Task modal in Goals
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('Before_Modal_CreateTask_Light.png')
    await evaluate(`
      (() => {
        const btn = document.querySelector('.modal-overlay .sidebar-toggle-btn') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // Task Manager
    await selectTab('Task Manager')
    await setTheme(true)
    await captureScreenshot('Before_TaskManager_Dark.png')
    await setTheme(false)
    await captureScreenshot('Before_TaskManager_Light.png')

    // Open Block App modal in Task Manager
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Block App'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('Before_Modal_BlockApp_Light.png')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.quick-modal-overlay button')).find(b => b.textContent.includes('Cancel') || b.textContent.includes('×'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // Schedule view
    await selectTab('Schedule')
    await setTheme(true)
    // Open Schedule Session modal
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Schedule Session'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('Before_Modal_ScheduleSession_Dark.png')
    await setTheme(false)
    await captureScreenshot('Before_Modal_ScheduleSession_Light.png')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.modal-overlay button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    console.log('[Capture Baseline] Done capturing all baseline modal & view screenshots.')
    ws.close()
  } finally {
    chrome.kill()
  }
}

captureModalsBefore().catch(console.error)

