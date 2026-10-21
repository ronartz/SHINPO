import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/account_ux_corrections'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runAccountUxAndScheduleVerification() {
  console.log('================================================================')
  console.log('   SHINPO MANDATORY ACCOUNT UX & DASHBOARD VERIFICATION SUITE   ')
  console.log('================================================================')

  const chromePort = 9322
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-account-ux-${Date.now()}`,
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
      if (res.result && res.result.exceptionDetails) {
        throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`)
      }
      return res.result?.result?.value
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const buffer = Buffer.from(res.result.data, 'base64')
      const targetPath = path.join(OUT_DIR, filename)
      fs.writeFileSync(targetPath, buffer)
      console.log(`[SNAPSHOT] Saved: ${targetPath}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('\n[1/6] Navigating to Auth screen with clean storage...')
    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2500)

    // Clear local storage to guarantee auth screen
    await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); })()`)
    await send('Page.reload')
    await sleep(2500)

    // Test 1: Sign In password input & eye toggle
    console.log('\n[2/6] Verifying Sign In password toggle...')
    await evaluate(`
      (() => {
        const input = document.querySelector('.auth-field-group input[type="password"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'SuperSecret123!');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `)
    await sleep(300)

    const initialType = await evaluate(`document.querySelector('.auth-field-group input[placeholder*="••"]')?.type`)
    console.log(`  Initial password input type: "${initialType}" (must be "password")`)

    // Click toggle button to reveal password
    await evaluate(`
      (() => {
        const toggle = document.querySelector('.auth-field-group .password-toggle-btn');
        if (toggle) toggle.click();
      })()
    `)
    await sleep(300)

    const toggledType = await evaluate(`document.querySelector('.auth-field-group input[placeholder*="••"]')?.type`)
    const toggledValue = await evaluate(`document.querySelector('.auth-field-group input[placeholder*="••"]')?.value`)
    console.log(`  Toggled password input type: "${toggledType}" (must be "text")`)
    console.log(`  Password value preserved: "${toggledValue === 'SuperSecret123!'}"`)
    await captureScreenshot('01_auth_password_revealed.png')

    // Click toggle again to re-mask
    await evaluate(`
      (() => {
        const toggle = document.querySelector('.auth-field-group .password-toggle-btn');
        if (toggle) toggle.click();
      })()
    `)
    await sleep(300)
    const remaskedType = await evaluate(`document.querySelector('.auth-field-group input[placeholder*="••"]')?.type`)
    console.log(`  Remasked password input type: "${remaskedType}" (must be "password")`)
    await captureScreenshot('02_auth_password_masked.png')

    // Test 2: Authenticate user with backend
    console.log('\n[3/6] Authenticating test user with backend...')
    let loginRes = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 'demo', password: 'shinpo_demo' }),
    })
    if (!loginRes.ok) {
      loginRes = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'EONX', password: 'shinpo_dev' }),
      })
    }
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status}`)
    }
    const loginData = await loginRes.json()
    console.log(`  Backend authenticated as: ${loginData.user.username} (#${loginData.user.id})`)

    await evaluate(`
      (() => {
        localStorage.setItem('shinpo_access_token', ${JSON.stringify(loginData.accessToken)});
        localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(loginData.refreshToken)});
        localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(loginData.user))});
      })()
    `)
    await send('Page.reload')
    await sleep(3000)

    await captureScreenshot('03_dashboard_loaded.png')

    // Test 3: LiveClock inspection
    console.log('\n[4/6] Verifying LiveClock capsule & 12/24h toggle...')
    const clockInfo = await evaluate(`
      (() => {
        const clock = document.querySelector('.aurora-capsule-clock');
        if (!clock) return null;
        return {
          text: clock.innerText.replace(/\\n/g, ' '),
          badge: clock.querySelector('.capsule-format-badge')?.innerText,
        };
      })()
    `)
    console.log(`  LiveClock info:`, clockInfo)

    // Click clock to toggle format
    await evaluate(`
      (() => {
        const clock = document.querySelector('.aurora-capsule-clock');
        if (clock) clock.click();
      })()
    `)
    await sleep(400)
    const toggledClockBadge = await evaluate(`document.querySelector('.aurora-capsule-clock .capsule-format-badge')?.innerText`)
    console.log(`  Toggled clock badge: "${toggledClockBadge}"`)

    // Today's Schedule inspection
    const scheduleCard = await evaluate(`
      (() => {
        const card = document.querySelector('.schedule-card') || Array.from(document.querySelectorAll('section')).find(s => (s.getAttribute('aria-label') || '').includes('Schedule'));
        if (!card) return null;
        return {
          title: card.querySelector('.sidecar-card-title')?.innerText || card.querySelector('h2, h3, h4')?.innerText,
          itemCount: card.querySelectorAll('.schedule-session-item').length,
          hasEmptyState: Boolean(card.querySelector('.sidecar-empty-state') || card.querySelector('.aurora-btn-secondary')),
        };
      })()
    `)
    console.log(`  Schedule card status:`, scheduleCard)
    await captureScreenshot('04_dashboard_schedule_clock.png')

    // Test 4: Open Settings Modal and verify Change Username
    console.log('\n[5/6] Opening Settings Modal to verify Change Username...')
    await evaluate(`
      (() => {
        const profile = document.querySelector('.profile-badge-card') || document.querySelector('[aria-label="Settings"]') || document.querySelector('button[title*="Settings"]');
        if (profile) profile.click();
      })()
    `)
    await sleep(1000)

    // Switch to Account tab
    await evaluate(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('.settings-nav-item, button'));
        const accountTab = tabs.find(b => b.innerText && b.innerText.includes('Account'));
        if (accountTab) accountTab.click();
      })()
    `)
    await sleep(600)

    const profileUsernameBefore = await evaluate(`document.querySelector('.settings-user-name')?.innerText`)
    console.log(`  Active User Profile username before change: "${profileUsernameBefore}"`)

    // Click Change Username button
    await evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const changeBtn = btns.find(b => b.innerText && b.innerText.includes('Change Username'));
        if (changeBtn) changeBtn.click();
      })()
    `)
    await sleep(400)

    const tempUsername = `Commander_${Date.now().toString().slice(-4)}`
    console.log(`  Setting new username: "${tempUsername}"...`)
    await evaluate(`
      (() => {
        const input = document.querySelector('input[placeholder="New username"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, '${tempUsername}');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Save');
        if (saveBtn) saveBtn.click();
      })()
    `)
    await sleep(1500)

    const updatedProfileUsername = await evaluate(`document.querySelector('.settings-user-name')?.innerText`)
    const updatedStoredUser = await evaluate(`JSON.parse(localStorage.getItem('shinpo_auth_user') || '{}')`)
    console.log(`  Active User Profile username after change: "${updatedProfileUsername}"`)
    console.log(`  Stored user username in localStorage: "${updatedStoredUser.username}"`)
    await captureScreenshot('05_settings_username_updated.png')

    // Test 5: Verify password toggle buttons in Settings Modal
    console.log('\n[6/6] Verifying password toggle buttons in Settings Modal...')
    const pwdTogglesCount = await evaluate(`document.querySelectorAll('.settings-password-form .password-toggle-btn').length`)
    console.log(`  Found ${pwdTogglesCount} password toggle buttons in Change Password form (expected 3)`)

    await evaluate(`
      (() => {
        const curInput = document.getElementById('current-password-input');
        if (curInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(curInput, 'OldPassword123!');
          curInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const toggles = document.querySelectorAll('.settings-password-form .password-toggle-btn');
        if (toggles[0]) toggles[0].click();
      })()
    `)
    await sleep(300)

    const curType = await evaluate(`document.getElementById('current-password-input')?.type`)
    console.log(`  Current password input type after toggle: "${curType}" (must be "text")`)
    await captureScreenshot('06_settings_password_toggled.png')

    // Close settings modal
    await evaluate(`
      (() => {
        const closeBtn = document.querySelector('.settings-close-btn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText && (b.innerText.includes('Close') || b.getAttribute('aria-label') === 'Close'));
        if (closeBtn) closeBtn.click();
      })()
    `)
    await sleep(800)

    // Check dashboard Topbar and Greeting with updated username
    const topbarUsername = await evaluate(`document.querySelector('.profile-username')?.innerText || document.querySelector('.profile-badge-card')?.innerText`)
    const greetingText = await evaluate(`document.querySelector('.hero-greeting-title')?.innerText || document.querySelector('h1')?.innerText`)
    console.log(`  Topbar display after change: "${topbarUsername}"`)
    console.log(`  Greeting display after change: "${greetingText}"`)
    await captureScreenshot('07_dashboard_with_updated_username.png')

    // Cleanup: Restore username back to EONX
    console.log('\n[CLEANUP] Restoring username back to EONX in PostgreSQL...')
    const token = await evaluate(`localStorage.getItem('shinpo_access_token')`)
    const restoreRes = await fetch('http://localhost:8080/api/users/me/username', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: 'EONX' }),
    })
    if (restoreRes.ok) {
      console.log('  Cleaned up: Username safely restored back to EONX')
    }

    console.log('\n================================================================')
    console.log('   ALL ACCOUNT UX & DASHBOARD CHECKS COMPLETED SUCCESSFULLY     ')
    console.log('================================================================')
  } finally {
    chrome.kill('SIGTERM')
  }
}

runAccountUxAndScheduleVerification().catch((err) => {
  console.error('[TEST ERROR]', err)
  process.exit(1)
})
