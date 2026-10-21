import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/design_cleanup/before'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runCaptureBaseline() {
  console.log('Capturing BEFORE design baseline screenshots...')
  const chromePort = 9297
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-cleanup-before-${Date.now()}`,
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

    if (!wsUrl) throw new Error('Could not connect to Chrome remote debugging port')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve) => ws.addEventListener('open', resolve))

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
      const id = msgId++
      return new Promise((resolve) => {
        pending.set(id, resolve)
        ws.send(JSON.stringify({ id, method, params }))
      })
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        console.error('Evaluation exception:', res.result.exceptionDetails)
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`[Captured Baseline] ${filename}`)
      return filePath
    }

    await send('Page.enable')
    await send('DOM.enable')

    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })

    // 1. Authenticate
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
    await sleep(2500)

    // Helper functions for theme & view navigation
    async function setV2(enabled) {
      await evaluate(`
        (() => {
          const v2Btn = document.querySelector('.v2-preview-btn');
          const isV2 = v2Btn ? v2Btn.textContent.includes('Classic') : false;
          if (isV2 !== ${enabled} && v2Btn) {
            v2Btn.click();
          }
        })()
      `)
      await sleep(600)
    }

    async function setTheme(isLight) {
      await evaluate(`
        (() => {
          const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
          const isCurrentlyLight = currentTheme === 'light';
          if (isCurrentlyLight !== ${isLight}) {
            const btns = Array.from(document.querySelectorAll('.top-bar-actions .action-btn-circle'));
            const themeBtn = btns.find(b => b.title && b.title.includes('Mode'));
            if (themeBtn) themeBtn.click();
          }
        })()
      `)
      await sleep(600)
    }

    async function navigateTo(tabName) {
      await evaluate(`
        (() => {
          const btns = Array.from(document.querySelectorAll('.icon-sidebar .sidebar-btn'));
          const target = btns.find(b => {
            const txt = b.textContent.trim().toLowerCase();
            return txt.includes('${tabName.toLowerCase()}');
          });
          if (target) target.click();
        })()
      `)
      await sleep(800)
    }

    // 1. Dashboard Aurora Dark
    await setV2(true)
    await setTheme(false)
    await navigateTo('dashboard')
    await captureScreenshot('before_01_dashboard_aurora_dark.png')

    // 2. Dashboard Aurora Light
    await setTheme(true)
    await captureScreenshot('before_01_dashboard_aurora_light.png')

    // 3. Dashboard Classic Dark
    await setTheme(false)
    await setV2(false)
    await captureScreenshot('before_01_dashboard_classic_dark.png')

    // 4. Dashboard Classic Light
    await setTheme(true)
    await captureScreenshot('before_01_dashboard_classic_light.png')

    // Return to Aurora V2
    await setV2(true)

    // 5. Goals & Kanban Dark
    await setTheme(false)
    await navigateTo('goals')
    await captureScreenshot('before_02_goals_dark.png')

    // 6. Goals Light
    await setTheme(true)
    await captureScreenshot('before_02_goals_light.png')

    // 7. Focus Engine Dark
    await setTheme(false)
    await navigateTo('focus')
    await captureScreenshot('before_03_focus_dark.png')

    // 8. Focus Engine Light
    await setTheme(true)
    await captureScreenshot('before_03_focus_light.png')

    // 9. Calendar / Schedule Dark
    await setTheme(false)
    await navigateTo('calendar')
    await captureScreenshot('before_04_schedule_dark.png')

    // 10. Calendar Light
    await setTheme(true)
    await captureScreenshot('before_04_schedule_light.png')

    // 11. Analytics Dark
    await setTheme(false)
    await navigateTo('analytics')
    await captureScreenshot('before_05_analytics_dark.png')

    // 12. Analytics Light
    await setTheme(true)
    await captureScreenshot('before_05_analytics_light.png')

    // 13. Task Manager Dark
    await setTheme(false)
    await navigateTo('task')
    await captureScreenshot('before_06_taskmanager_dark.png')

    // 14. Task Manager Light
    await setTheme(true)
    await captureScreenshot('before_06_taskmanager_light.png')

    // 15. EONPAI Dark
    await setTheme(false)
    await navigateTo('eonpai')
    await captureScreenshot('before_07_eonpai_dark.png')

    // 16. EONPAI Light
    await setTheme(true)
    await captureScreenshot('before_07_eonpai_light.png')

    ws.close()
    console.log('BEFORE baseline captures completed successfully!')
  } finally {
    chrome.kill('SIGKILL')
  }
}

runCaptureBaseline().catch(err => {
  console.error('Fatal in capture baseline:', err)
  process.exit(1)
})

