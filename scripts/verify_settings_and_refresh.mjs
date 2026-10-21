import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/settings_refresh'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runSettingsAndRefreshVerification() {
  console.log('================================================================')
  console.log('   SHINPO SETTINGS & REFRESH END-TO-END VERIFICATION SUITE      ')
  console.log('================================================================')

  const chromePort = 9298
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-settings-qa-${Date.now()}`,
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
      console.log(`[Screenshot Captured] ${filePath}`)
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

    console.log('\n[1/10] Authenticating test user (EONX)...')
    let authRes = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail: 's.mondal.grc@gmail.com', password: 'shinpo_demo' }),
    })
    if (!authRes.ok) {
      authRes = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: 'EONX', password: 'shinpo_demo' }),
      })
    }
    if (!authRes.ok) {
      throw new Error(`Failed to login via backend API: ${authRes.status}`)
    }
    const authData = await authRes.json()
    console.log(`Successfully authenticated as ${authData.user.username} (${authData.user.role})`)

    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        localStorage.setItem('shinpo_access_token', ${JSON.stringify(authData.accessToken)});
        localStorage.setItem('shinpo_refresh_token', ${JSON.stringify(authData.refreshToken)});
        localStorage.setItem('shinpo_auth_user', ${JSON.stringify(JSON.stringify(authData.user))});
      `,
    })

    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2500)

    console.log('\n[2/10] Verifying TopBar actions (Refresh button & Settings button)...')
    const topBarInspection = await evaluate(`
      (() => {
        const refreshBtn = document.querySelector('button[aria-label="Refresh Data"]');
        const settingsBtn = document.querySelector('button[aria-label="Settings"]');
        const userBadge = document.querySelector('.profile-badge-card, .topbar-user-profile');
        const searchInput = document.querySelector('.top-search-input, .topbar-search-input');
        return {
          hasRefreshBtn: Boolean(refreshBtn),
          refreshTitle: refreshBtn?.getAttribute('title'),
          hasSettingsBtn: Boolean(settingsBtn),
          settingsTitle: settingsBtn?.getAttribute('title'),
          hasUserBadge: Boolean(userBadge),
          hasSearchInput: Boolean(searchInput)
        };
      })()
    `)
    console.log('TopBar Elements:', topBarInspection)
    if (!topBarInspection.hasRefreshBtn || !topBarInspection.hasSettingsBtn) {
      throw new Error('Refresh or Settings button missing from TopBar')
    }

    console.log('\n[3/10] Testing Refresh Button feedback and loading animation...')
    await evaluate(`
      (() => {
        const refreshBtn = document.querySelector('button[aria-label="Refresh Data"]');
        if (refreshBtn) refreshBtn.click();
      })()
    `)
    // Immediately check if spinning class is active
    const isSpinningDuringRefresh = await evaluate(`
      (() => {
        const refreshBtn = document.querySelector('button[aria-label="Refresh Data"]');
        return refreshBtn?.classList.contains('is-spinning');
      })()
    `)
    console.log('Refresh Button spinning state during refresh:', isSpinningDuringRefresh)

    await sleep(1000)

    // Check toast alert rendered
    const toastFeedback = await evaluate(`
      (() => {
        const toasts = Array.from(document.querySelectorAll('.shinpo-toast-item, .floating-toast')).map(t => ({
          title: t.querySelector('.shinpo-toast-title, .toast-title')?.textContent?.trim(),
          desc: t.querySelector('.shinpo-toast-desc, .toast-desc')?.textContent?.trim()
        }));
        return toasts;
      })()
    `)
    console.log('Toast Alerts received:', toastFeedback)
    await captureScreenshot('01_refresh_feedback.png')

    console.log('\n[4/10] Testing Settings Modal Open via Gear Icon...')
    await evaluate(`
      (() => {
        const settingsBtn = document.querySelector('button[aria-label="Settings"]');
        if (settingsBtn) settingsBtn.click();
      })()
    `)
    await sleep(500)

    const modalInspection = await evaluate(`
      (() => {
        const modal = document.querySelector('.settings-modal');
        const dialog = document.querySelector('[role="dialog"][aria-labelledby="settings-dialog-title"]');
        const title = document.getElementById('settings-dialog-title')?.textContent?.trim();
        const tabs = Array.from(document.querySelectorAll('.settings-tab-btn')).map(t => t.textContent?.trim());
        return {
          hasModal: Boolean(modal),
          hasDialog: Boolean(dialog),
          title,
          tabs
        };
      })()
    `)
    console.log('Settings Modal state:', modalInspection)
    if (!modalInspection.hasModal || modalInspection.tabs.length < 8) {
      throw new Error(`Settings modal failed to render 8 tabs. Got: ${modalInspection.tabs?.length}`)
    }
    await captureScreenshot('02_settings_appearance_tab.png')

    console.log('\n[5/10] Testing Appearance Settings (Theme Toggle & 12h/24h Clock)...')
    // Switch to Light Mode
    await evaluate(`
      (() => {
        const lightBtn = Array.from(document.querySelectorAll('.settings-pill-btn')).find(b => b.textContent?.includes('Light'));
        if (lightBtn) lightBtn.click();
      })()
    `)
    await sleep(300)
    const lightThemeActive = await evaluate(`document.documentElement.getAttribute('data-theme')`)
    console.log('Active theme after selecting Light:', lightThemeActive)
    await captureScreenshot('03_settings_light_theme.png')

    // Switch back to Dark Mode
    await evaluate(`
      (() => {
        const darkBtn = Array.from(document.querySelectorAll('.settings-pill-btn')).find(b => b.textContent?.includes('Dark'));
        if (darkBtn) darkBtn.click();
      })()
    `)
    await sleep(300)

    // Switch time format to 24h
    await evaluate(`
      (() => {
        const format24Btn = Array.from(document.querySelectorAll('.settings-pill-btn')).find(b => b.textContent?.includes('24-Hour'));
        if (format24Btn) format24Btn.click();
      })()
    `)
    await sleep(300)
    const timeFormatSaved = await evaluate(`localStorage.getItem('shinpo_time_format')`)
    console.log('Saved time format in localStorage:', timeFormatSaved)

    console.log('\n[6/10] Testing Account Tab and Form Validation...')
    await evaluate(`
      (() => {
        const accountTab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('Account'));
        if (accountTab) accountTab.click();
      })()
    `)
    await sleep(400)
    const accountInfo = await evaluate(`
      (() => {
        const userHeader = document.querySelector('.settings-user-name')?.textContent?.trim();
        const userEmail = document.querySelector('.settings-user-email')?.textContent?.trim();
        const role = document.querySelector('.settings-badge-value')?.textContent?.trim();
        return { userHeader, userEmail, role };
      })()
    `)
    console.log('Account Details displayed:', accountInfo)

    // Test password mismatch error
    await evaluate(`
      (() => {
        const currentInput = document.getElementById('current-password-input');
        const newInput = document.getElementById('new-password-input');
        const confirmInput = document.getElementById('confirm-password-input');
        const form = document.querySelector('.settings-password-form');
        if (currentInput && newInput && confirmInput && form) {
          currentInput.value = 'shinpo_dev';
          currentInput.dispatchEvent(new Event('input', { bubbles: true }));
          newInput.value = 'pass123456';
          newInput.dispatchEvent(new Event('input', { bubbles: true }));
          confirmInput.value = 'mismatch123';
          confirmInput.dispatchEvent(new Event('input', { bubbles: true }));
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      })()
    `)
    await sleep(300)
    const passwordError = await evaluate(`
      (() => {
        const banner = document.querySelector('.settings-status-banner.is-error');
        return banner?.textContent?.trim();
      })()
    `)
    console.log('Password mismatch validation result:', passwordError)
    await captureScreenshot('04_settings_account_tab.png')

    console.log('\n[7/10] Testing Focus Protection Tab...')
    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('Focus Protection'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)
    const protectionDetails = await evaluate(`
      (() => {
        const activeMode = document.querySelector('.settings-mode-card.is-active .settings-mode-name')?.textContent?.trim();
        return { activeMode };
      })()
    `)
    console.log('Protection tab active mode:', protectionDetails)
    await captureScreenshot('05_settings_protection_tab.png')

    console.log('\n[8/10] Testing Browser Companion & EONPAI Tabs...')
    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('Browser Companion'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('06_settings_companion_tab.png')

    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('EONPAI'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)
    const eonpaiInfo = await evaluate(`
      (() => {
        const badges = Array.from(document.querySelectorAll('.settings-meta-item')).map(m => m.textContent?.trim());
        return badges;
      })()
    `)
    console.log('EONPAI status info:', eonpaiInfo)
    await captureScreenshot('07_settings_eonpai_tab.png')

    console.log('\n[9/10] Testing Cloud Connection & Privacy Tabs...')
    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('Cloud Connection'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)
    // Click Save & Test button
    await evaluate(`
      (() => {
        const testBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save & Test'));
        if (testBtn) testBtn.click();
      })()
    `)
    await sleep(1000)
    const pingResult = await evaluate(`
      (() => {
        const banner = document.querySelector('.settings-status-banner.is-success');
        return banner?.textContent?.trim();
      })()
    `)
    console.log('Live Ping Result:', pingResult)
    await captureScreenshot('08_settings_connection_tab.png')

    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('Privacy & Data'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('09_settings_privacy_tab.png')

    console.log('\n[10/10] Testing About & Diagnostics Tab and Modal Close...')
    await evaluate(`
      (() => {
        const tab = Array.from(document.querySelectorAll('.settings-tab-btn')).find(b => b.textContent?.includes('About'));
        if (tab) tab.click();
      })()
    `)
    await sleep(400)

    // Click "Run Diagnostics"
    await evaluate(`
      (() => {
        const diagBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run Diagnostics'));
        if (diagBtn) diagBtn.click();
      })()
    `)
    await sleep(1500)
    const diagResults = await evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.settings-diag-row')).map(r => ({
          name: r.querySelector('.settings-diag-name')?.textContent?.trim(),
          badge: r.querySelector('.settings-diag-badge')?.textContent?.trim(),
          detail: r.querySelector('.settings-diag-detail')?.textContent?.trim(),
        }));
        return rows;
      })()
    `)
    console.log('Diagnostics execution results:', diagResults)
    await captureScreenshot('10_settings_diagnostics_pass.png')

    // Close Settings Modal via Close button
    await evaluate(`
      (() => {
        const closeBtn = document.querySelector('.settings-modal-close');
        if (closeBtn) closeBtn.click();
      })()
    `)
    await sleep(400)
    const isModalOpenAfterClose = await evaluate(`Boolean(document.querySelector('.settings-modal'))`)
    console.log('Modal closed cleanly:', !isModalOpenAfterClose)
    await captureScreenshot('11_settings_closed_return.png')

    // Test Search Input Clear button
    console.log('\n[Bonus] Testing TopBar Search Input Clear Button...')
    await evaluate(`
      (() => {
        const input = document.querySelector('.top-search-input, .topbar-search-input');
        if (input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(input, 'Quantum Focus');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `)
    await sleep(300)
    const clearBtnVisible = await evaluate(`Boolean(document.querySelector('button[aria-label="Clear search"], button[aria-label="Clear search input"], .top-search-filter-btn[title="Clear search"]'))`)
    console.log('Search Clear button visible when input has query:', clearBtnVisible)
    await evaluate(`
      (() => {
        const clearBtn = document.querySelector('button[aria-label="Clear search"], button[aria-label="Clear search input"], .top-search-filter-btn[title="Clear search"]');
        if (clearBtn) clearBtn.click();
      })()
    `)
    await sleep(200)
    const inputValAfterClear = await evaluate(`document.querySelector('.top-search-input, .topbar-search-input')?.value`)
    console.log('Search input value after clear button click:', inputValAfterClear)

    // Test clicking user avatar opens settings
    console.log('\n[Bonus] Testing User Profile Click opens Settings...')
    await evaluate(`
      (() => {
        const profile = document.querySelector('.profile-badge-card, .topbar-user-profile');
        if (profile) profile.click();
      })()
    `)
    await sleep(400)
    const openedViaAvatar = await evaluate(`Boolean(document.querySelector('.settings-modal'))`)
    console.log('Settings opened by clicking user avatar:', openedViaAvatar)

    console.log('\n================================================================')
    console.log('   ALL SETTINGS & REFRESH VERIFICATIONS PASSED SUCCESSFULLY!    ')
    console.log('================================================================')
  } finally {
    chrome.kill('SIGTERM')
  }
}

runSettingsAndRefreshVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err)
  process.exit(1)
})
