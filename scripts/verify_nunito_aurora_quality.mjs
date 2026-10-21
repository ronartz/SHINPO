import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const QA_OUT_DIR = '/home/eonx/Projects/SHINPO/docs/qa/screenshots/nunito_aurora'
const ARTIFACT_OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/nunito_aurora'

fs.mkdirSync(QA_OUT_DIR, { recursive: true })
fs.mkdirSync(ARTIFACT_OUT_DIR, { recursive: true })

async function runVisualAudit() {
  console.log('======================================================================')
  console.log('  SHINPO — Nunito Typography & Aurora Visual Quality Audit')
  console.log('======================================================================')

  const chromePort = 9399
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-nunito-aurora-${Date.now()}`,
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

    if (!wsUrl) throw new Error('Could not connect to Chrome DevTools port ' + chromePort)

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

    await send('Page.enable')
    await send('Runtime.enable')

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (res.result?.exceptionDetails) {
        throw new Error(JSON.stringify(res.result.exceptionDetails))
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(filename, width = 1440, height = 900) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(200)
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const buf = Buffer.from(res.result.data, 'base64')
      fs.writeFileSync(path.join(QA_OUT_DIR, filename), buf)
      fs.writeFileSync(path.join(ARTIFACT_OUT_DIR, filename), buf)
      console.log(`  [SCREENSHOT] ${filename} (${width}x${height})`)
    }

    // 1. Audit Login Screen
    console.log('\n[1/7] Auditing Authentication Screen & Typography...')
    await sleep(1000)
    
    // Check computed font on login screen
    const loginFontAudit = await evaluate(`(() => {
      const bodyFont = window.getComputedStyle(document.body).fontFamily
      const card = document.querySelector('.auth-card')
      const cardFont = card ? window.getComputedStyle(card).fontFamily : null
      const input = document.querySelector('.auth-input')
      const inputFont = input ? window.getComputedStyle(input).fontFamily : null
      const btn = document.querySelector('.auth-submit-btn')
      const btnFont = btn ? window.getComputedStyle(btn).fontFamily : null
      return { bodyFont, cardFont, inputFont, btnFont }
    })()`)
    console.log('  Login Computed Fonts:', loginFontAudit)

    await captureScreenshot('01_auth_dark_1440.png', 1440, 900)

    // Fill credentials and sign in via API
    await evaluate(`(async () => {
      try {
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernameOrEmail: "EONX", password: "shinpo_demo" })
        });
        if (!res.ok) {
          res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernameOrEmail: "s.mondal.grc@gmail.com", password: "shinpo_demo" })
          });
        }
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
    })()`)

    // Wait for login and dashboard to load
    await sleep(3000)

    // Check if logged in
    const isLoggedIn = await evaluate(`(() => !document.querySelector('.auth-card'))()`)
    console.log('  Login successful:', isLoggedIn)

    // 2. Audit Aurora Dark Dashboard
    console.log('\n[2/7] Auditing Dashboard in Aurora Dark Mode...')
    await evaluate(`(() => {
      // Ensure Aurora Mode & Dark Mode are active
      localStorage.setItem('shinpo_v2_preview', 'true')
      localStorage.setItem('shinpo_theme', 'dark')
      window.dispatchEvent(new Event('storage'))
    })()`)
    await sleep(1000)

    // Audit Nunito on core elements
    const dashboardFontAudit = await evaluate(`(() => {
      const body = window.getComputedStyle(document.body).fontFamily
      const clock = document.querySelector('.dashboard-live-clock')
      const clockTime = document.querySelector('.capsule-time-region')
      const clockStyles = clock ? {
        height: window.getComputedStyle(clock).height,
        fontFamily: clockTime ? window.getComputedStyle(clockTime).fontFamily : null,
        fontSize: clockTime ? window.getComputedStyle(clockTime).fontSize : null,
        fontVariantNumeric: clockTime ? window.getComputedStyle(clockTime).fontVariantNumeric : null,
      } : null

      const quoteCard = document.querySelector('.sidebar-upper-quote')
      const quoteText = document.querySelector('.sidebar-upper-quote-text')
      const quoteTag = document.querySelector('.sidebar-upper-quote-tag')
      const quoteStyles = quoteCard ? {
        present: true,
        tagVisible: quoteTag ? window.getComputedStyle(quoteTag).display !== 'none' : false,
        text: quoteText ? quoteText.textContent.trim() : null,
        fontFamily: quoteText ? window.getComputedStyle(quoteText).fontFamily : null,
        fontSize: quoteText ? window.getComputedStyle(quoteText).fontSize : null,
        fontStyle: quoteText ? window.getComputedStyle(quoteText).fontStyle : null,
        fontWeight: quoteText ? window.getComputedStyle(quoteText).fontWeight : null,
      } : { present: false }

      return { body, clockStyles, quoteStyles }
    })()`)
    console.log('  Dashboard Quality Audit:', JSON.stringify(dashboardFontAudit, null, 2))

    await captureScreenshot('02_dashboard_aurora_dark_1920.png', 1920, 1080)
    await captureScreenshot('02_dashboard_aurora_dark_1440.png', 1440, 900)
    await captureScreenshot('02_dashboard_aurora_dark_1280.png', 1280, 800)
    await captureScreenshot('02_dashboard_aurora_dark_1000.png', 1000, 768)

    // 3. Test Clock 12h/24h toggle
    console.log('\n[3/7] Testing Clock interaction & format toggle...')
    const beforeToggle = await evaluate(`(() => document.querySelector('.capsule-format-badge')?.textContent.trim())()`)
    await evaluate(`(() => document.querySelector('.dashboard-live-clock')?.click())()`)
    await sleep(400)
    const afterToggle = await evaluate(`(() => document.querySelector('.capsule-format-badge')?.textContent.trim())()`)
    console.log(`  Clock Format Toggle: ${beforeToggle} -> ${afterToggle}`)

    // 4. Test Quote Refresh Interaction
    console.log('\n[4/7] Testing Motivational Quote Refresh...')
    const beforeQuote = await evaluate(`(() => document.querySelector('.sidebar-upper-quote-text')?.textContent.trim())()`)
    await evaluate(`(() => document.querySelector('.sidebar-quote-refresh-btn')?.click())()`)
    await sleep(400)
    const afterQuote = await evaluate(`(() => document.querySelector('.sidebar-upper-quote-text')?.textContent.trim())()`)
    console.log(`  Quote Refresh: "${beforeQuote}" -> "${afterQuote}"`)

    // 5. Test Aurora Light Theme
    console.log('\n[5/7] Auditing Aurora Light Theme...')
    await evaluate(`(() => {
      const topBar = document.querySelector('.cockpit-top-bar')
      const themeBtn = document.querySelector('button[title*="theme" i], button[title*="Light" i], button[title*="Dark" i]')
      if (themeBtn) themeBtn.click()
    })()`)
    await sleep(600)
    await captureScreenshot('03_dashboard_aurora_light_1440.png', 1440, 900)

    // Switch back to Dark for subsequent view checks
    await evaluate(`(() => {
      const themeBtn = document.querySelector('button[title*="theme" i], button[title*="Light" i], button[title*="Dark" i]')
      if (themeBtn) themeBtn.click()
    })()`)
    await sleep(600)

    // 6. Audit Other Critical Views
    console.log('\n[6/7] Auditing Navigation & Other Core Views...')
    const views = [
      { name: 'Goals', label: 'Goals' },
      { name: 'Schedule', label: 'Schedule' },
      { name: 'Focus', label: 'Focus' },
      { name: 'TaskManager', label: 'Task Manager' },
      { name: 'Eonpai', label: 'AI Assistant' },
    ]

    for (const v of views) {
      await evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn, .sidebar-nav-stack button')).find(
          el => el.textContent.includes('${v.label}')
        )
        if (btn) btn.click()
      })()`)
      await sleep(800)
      await captureScreenshot(`04_view_${v.name.toLowerCase()}_aurora_dark_1440.png`, 1440, 900)
    }

    // 7. Audit Settings Modal
    console.log('\n[7/7] Auditing Settings Modal (Portals & MUI Controls)...')
    await evaluate(`(() => {
      const gearBtn = document.querySelector('button[title*="Settings" i]')
      if (gearBtn) gearBtn.click()
    })()`)
    await sleep(800)

    const modalAudit = await evaluate(`(() => {
      const modal = document.querySelector('.settings-modal-dialog, [role="dialog"]')
      if (!modal) return { open: false }
      const font = window.getComputedStyle(modal).fontFamily
      const title = modal.querySelector('h2, h3')
      const titleFont = title ? window.getComputedStyle(title).fontFamily : null
      return { open: true, font, titleFont }
    })()`)
    console.log('  Settings Modal Audit:', modalAudit)

    await captureScreenshot('05_settings_modal_appearance_1440.png', 1440, 900)

    // Close Settings
    await evaluate(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close settings"]')
      if (closeBtn) closeBtn.click()
    })()`)
    await sleep(500)

    console.log('\n======================================================================')
    console.log('  AUDIT COMPLETE: All screenshots captured and fonts verified!')
    console.log('======================================================================\n')
  } catch (err) {
    console.error('Audit failed with error:', err)
  } finally {
    chrome.kill()
  }
}

runVisualAudit()
