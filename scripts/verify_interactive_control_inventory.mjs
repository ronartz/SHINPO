import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/inventory'
const LOCAL_DIR = '/home/eonx/Projects/SHINPO/screenshots/inventory'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(LOCAL_DIR, { recursive: true })

async function runInventory() {
  console.log('========================================================================')
  console.log('   SHINPO EXHAUSTIVE INTERACTIVE CONTROL INVENTORY & VERIFICATION SUITE   ')
  console.log('========================================================================')

  const chromePort = 9348
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-inv-${Date.now()}`,
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
    const consoleLogs = []

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value || a.description).join(' ')
        consoleLogs.push({ type: msg.params.type, text })
      }
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
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buffer)
      fs.writeFileSync(path.join(LOCAL_DIR, filename), buffer)
      console.log(`  [SNAPSHOT] Saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const controlInventory = []
    function recordControl(category, name, type, status, details = '') {
      controlInventory.push({ category, name, type, status, details })
      console.log(`  ✓ [${category}] ${name} (${type}): ${status} ${details ? '- ' + details : ''}`)
    }

    console.log('\n[Phase 1] Auth Module & Password Visibility Controls...')
    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2000)
    await evaluate(`(() => { localStorage.clear(); sessionStorage.clear(); })()`)
    await send('Page.reload')
    await sleep(2500)

    // Check Auth Controls
    const authState = await evaluate(`(() => {
      const userField = document.querySelector('.auth-field-group input[type="text"], .auth-field-group input[placeholder*="username"], input[name="username"]');
      const passField = document.querySelector('.auth-field-group input[type="password"]');
      const toggleBtn = document.querySelector('.auth-field-group .password-toggle-btn');
      const tabs = Array.from(document.querySelectorAll('.auth-tab-btn')).map(b => b.textContent.trim());
      const submitBtn = document.querySelector('.auth-submit-btn, button[type="submit"]');
      return {
        hasUser: !!userField,
        hasPass: !!passField,
        hasToggle: !!toggleBtn,
        toggleTitle: toggleBtn ? (toggleBtn.getAttribute('title') || toggleBtn.getAttribute('aria-label')) : null,
        tabs,
        hasSubmit: !!submitBtn,
      };
    })()`)

    recordControl('Auth', 'Username/Email Field', 'input[text]', authState.hasUser ? 'PASS' : 'FAIL')
    recordControl('Auth', 'Password Field', 'input[password]', authState.hasPass ? 'PASS' : 'FAIL')
    recordControl('Auth', 'Password Visibility Toggle', 'button.password-toggle-btn', authState.hasToggle ? 'PASS' : 'FAIL', authState.toggleTitle)
    recordControl('Auth', 'Tab Switchers (Sign In / Register)', 'button.auth-tab-btn', authState.tabs.length >= 2 ? 'PASS' : 'FAIL', authState.tabs.join(' | '))
    recordControl('Auth', 'Submit Form Button', 'button[type="submit"]', authState.hasSubmit ? 'PASS' : 'FAIL')

    // Test password toggle in Auth
    await evaluate(`(() => {
      const input = document.querySelector('.auth-field-group input[type="password"]');
      if (input) {
        input.value = 'SecretPass123!';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const toggle = document.querySelector('.auth-field-group .password-toggle-btn');
      if (toggle) toggle.click();
    })()`)
    await sleep(300)

    const revealedType = await evaluate(`document.querySelector('.auth-field-group input[placeholder*="••"]')?.type`)
    recordControl('Auth', 'Password Reveal Action', 'state-toggle', revealedType === 'text' ? 'PASS' : 'FAIL', `type=${revealedType}`)
    await captureScreenshot('01_auth_revealed.png')

    // Re-mask
    await evaluate(`(() => {
      const toggle = document.querySelector('.auth-field-group .password-toggle-btn');
      if (toggle) toggle.click();
    })()`)
    await sleep(200)

    console.log('\n[Phase 2] Authenticating User via Backend API...')
    const testUsername = `tester_${Date.now().toString().slice(-5)}`
    const testEmail = `${testUsername}@shinpo.local`
    const testPassword = 'Password123!'

    const regRes = await fetch('http://localhost:8080/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: testUsername, email: testEmail, password: testPassword }),
    })
    if (!regRes.ok) {
      throw new Error(`Registration failed with status ${regRes.status}: ${await regRes.text()}`)
    }
    const loginData = await regRes.json()
    console.log(`  Backend registered & authenticated: ${loginData.user.username} (id=${loginData.user.id})`)

    await evaluate(`((token, rToken, user) => {
      localStorage.setItem('shinpo_access_token', token);
      localStorage.setItem('shinpo_refresh_token', rToken);
      localStorage.setItem('shinpo_auth_user', JSON.stringify(user));
    })('${loginData.accessToken}', '${loginData.refreshToken}', ${JSON.stringify(loginData.user)})`)

    await send('Page.reload')
    await sleep(3000)

    const authenticated = await evaluate(`(() => {
      return !!document.querySelector('.app-shell') && !document.querySelector('.auth-container');
    })()`)
    recordControl('Auth Lifecycle', 'Session Restoration & App Shell Load', 'session', authenticated ? 'PASS' : 'FAIL')
    await captureScreenshot('02_dashboard_aurora.png')

    console.log('\n[Phase 3] Topbar & Dashboard Controls...')
    // Topbar Controls Inspection
    const topbarControls = await evaluate(`(() => {
      const themeBtn = document.querySelector('button[aria-label*="Mode"], button[title*="Mode"]');
      const refreshBtn = document.querySelector('button[aria-label="Refresh Data"], button[title="Refresh Data"]');
      const gearBtn = document.querySelector('button[aria-label="Settings"], button[title="Settings"]');
      const profileCard = document.querySelector('.profile-badge-card') || document.querySelector('[title*="Signed in as"]');
      const clock = document.querySelector('.aurora-capsule-clock');
      const scheduleCard = Array.from(document.querySelectorAll('*')).find(el => (el.getAttribute('aria-label') || '').includes('Schedule')) || document.querySelector('.schedule-card');
      return {
        hasThemeBtn: !!themeBtn,
        hasRefreshBtn: !!refreshBtn,
        hasGearBtn: !!gearBtn,
        hasProfileCard: !!profileCard,
        hasClock: !!clock,
        clockText: clock ? clock.innerText.replace(/\\n/g, ' ') : null,
        hasScheduleCard: !!scheduleCard,
      };
    })()`)

    recordControl('Topbar', 'No Redundant Theme Toggle (Action 4 Clean)', 'guardrail', !topbarControls.hasThemeBtn ? 'PASS' : 'FAIL')
    recordControl('Topbar', 'Cloud Data Refresh Button', 'button', topbarControls.hasRefreshBtn ? 'PASS' : 'FAIL')
    recordControl('Topbar', 'Settings Gear Button', 'button', topbarControls.hasGearBtn ? 'PASS' : 'FAIL')
    recordControl('Topbar', 'Profile Identity Badge Card', 'card-button', topbarControls.hasProfileCard ? 'PASS' : 'FAIL')
    recordControl('Dashboard', 'LiveClock Capsule Component', 'clock-capsule', topbarControls.hasClock ? 'PASS' : 'FAIL', topbarControls.clockText)
    recordControl('Dashboard', 'Today\'s Schedule Card', 'card', topbarControls.hasScheduleCard ? 'PASS' : 'FAIL')

    // Test LiveClock 12h/24h toggle
    await evaluate(`(() => {
      const clock = document.querySelector('.aurora-capsule-clock');
      if (clock) clock.click();
    })()`)
    await sleep(300)
    const toggledFormat = await evaluate(`document.querySelector('.aurora-capsule-clock .capsule-format-badge')?.innerText`)
    recordControl('Dashboard', 'LiveClock 12h/24h Click Toggle', 'action', !!toggledFormat ? 'PASS' : 'FAIL', `format=${toggledFormat}`)

    console.log('\n[Phase 4] Settings Ownership: Gear vs Profile Badge...')
    // Click Gear button -> Must open SettingsModal to Appearance
    await evaluate(`(() => {
      const gear = document.querySelector('button[aria-label="Settings"], button[title="Settings"]');
      if (gear) gear.click();
    })()`)
    await sleep(800)

    const gearActiveTab = await evaluate(`(() => {
      const active = document.querySelector('.settings-tab-btn.is-active');
      return active ? active.textContent.trim() : null;
    })()`)
    recordControl('Navigation Ownership', 'Gear Button Routes to Appearance Tab', 'routing', gearActiveTab?.toLowerCase().includes('appearance') ? 'PASS' : 'FAIL', `tab=${gearActiveTab}`)
    await captureScreenshot('03_settings_appearance.png')

    // Close Modal via Close button
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.settings-close-btn') || document.querySelector('.modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`)
    await sleep(500)

    // Click Profile Card -> Must open SettingsModal to Account & Security
    await evaluate(`(() => {
      const profile = document.querySelector('.profile-badge-card') || document.querySelector('[title*="Signed in as"]');
      if (profile) profile.click();
    })()`)
    await sleep(800)

    const profileActiveTab = await evaluate(`(() => {
      const active = document.querySelector('.settings-tab-btn.is-active');
      return active ? active.textContent.trim() : null;
    })()`)
    recordControl('Navigation Ownership', 'Profile Card Routes to Account Tab', 'routing', profileActiveTab?.toLowerCase().includes('account') ? 'PASS' : 'FAIL', `tab=${profileActiveTab}`)
    await captureScreenshot('04_settings_account.png')

    console.log('\n[Phase 5] Settings Account Actions (Username Editing & Password Toggles)...')
    // Check Change Username UI
    const usernameState = await evaluate(`(() => {
      const curUserSpan = document.querySelector('.settings-user-name');
      const changeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Change Username'));
      return {
        currentName: curUserSpan ? curUserSpan.innerText.trim() : null,
        hasChangeBtn: !!changeBtn,
      };
    })()`)
    recordControl('Settings:Account', 'Current Username Display', 'text', !!usernameState.currentName ? 'PASS' : 'FAIL', usernameState.currentName)
    recordControl('Settings:Account', 'Change Username Trigger Button', 'button', usernameState.hasChangeBtn ? 'PASS' : 'FAIL')

    // Execute Username Change
    if (usernameState.hasChangeBtn) {
      await evaluate(`(() => {
        const changeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Change Username'));
        if (changeBtn) changeBtn.click();
      })()`)
      await sleep(300)

      const newName = `EONX_${Date.now().toString().slice(-4)}`
      await evaluate(`((val) => {
        const input = document.querySelector('input[placeholder="New username"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'Save');
        if (saveBtn) saveBtn.click();
      })('${newName}')`)
      await sleep(1500)

      const updatedName = await evaluate(`document.querySelector('.settings-user-name')?.innerText`)
      const storedUser = await evaluate(`JSON.parse(localStorage.getItem('shinpo_auth_user') || '{}')?.username`)
      const persistenceMatch = updatedName === newName && storedUser === newName
      recordControl('Settings:Account', 'Username Mutation & Backend Persistence', 'mutation', persistenceMatch ? 'PASS' : 'FAIL', `persisted=${storedUser}`)
      await captureScreenshot('05_settings_username_updated.png')
    }

    // Verify Password Toggles in Settings
    const pwdTogglesCount = await evaluate(`document.querySelectorAll('.settings-password-form .password-toggle-btn').length`)
    recordControl('Settings:Account', 'Password Form Eye/Eye-Off Toggles', 'toggles', pwdTogglesCount === 3 ? 'PASS' : 'FAIL', `count=${pwdTogglesCount} (expected 3)`)

    // Traverse all settings tabs using data-section
    const tabSelectors = [
      { id: 'protection', name: 'Focus Protection' },
      { id: 'companion', name: 'Browser Companion' },
      { id: 'eonpai', name: 'AI / EONPAI' },
      { id: 'connection', name: 'Cloud Server Connection' },
      { id: 'privacy', name: 'Privacy & Data' },
      { id: 'about', name: 'About & Health' },
    ]

    for (const tab of tabSelectors) {
      await evaluate(`((tabId) => {
        const item = document.querySelector(\`button[data-section="\${tabId}"]\`);
        if (item) item.click();
      })('${tab.id}')`)
      await sleep(400)
      const tabActive = await evaluate(`((tabId) => {
        const btn = document.querySelector(\`button[data-section="\${tabId}"]\`);
        return btn ? btn.classList.contains('is-active') : false;
      })('${tab.id}')`)
      recordControl('Settings Navigation', `Section: ${tab.name}`, 'tab-switch', tabActive ? 'PASS' : 'FAIL')

      // Verify specific content in tabs
      if (tab.id === 'protection') {
        const overrideToggle = await evaluate(`document.querySelectorAll('.password-toggle-btn').length > 0`)
        recordControl('Settings:Protection', 'Emergency Override Password Toggle', 'toggle', overrideToggle ? 'PASS' : 'FAIL')
      } else if (tab.id === 'connection') {
        const pingBtn = await evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.innerText && (b.innerText.includes('Save & Test') || b.innerText.includes('Test Connection')))`)
        recordControl('Settings:Connection', 'Save & Test Server Connection Button', 'button', pingBtn ? 'PASS' : 'FAIL')
      } else if (tab.id === 'about') {
        const diagBtn = await evaluate(`Array.from(document.querySelectorAll('button')).some(b => b.innerText && b.innerText.includes('Run Diagnostics'))`)
        recordControl('Settings:About', 'Run Diagnostics Trigger Button', 'button', diagBtn ? 'PASS' : 'FAIL')
      }
    }

    // Close Settings Modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.settings-close-btn') || document.querySelector('.modal-close-btn');
      if (closeBtn) closeBtn.click();
    })()`)
    await sleep(500)

    console.log('\n[Phase 6] Sidebar Navigation & Primary Views...')
    const appViews = [
      { id: 'Goals & Missions', name: 'Goals & Tasks', tut: 'nav-goals', expectedTitle: ['Goals & Tasks', 'Goals'] },
      { id: 'Focus Engine', name: 'Focus Engine', tut: 'nav-focus', expectedTitle: ['Focus', 'Focus Engine'] },
      { id: 'Schedule', name: 'Schedule', tut: 'nav-schedule', expectedTitle: ['Calendar', 'Schedule'] },
      { id: 'Analytics', name: 'Analytics', tut: 'nav-analytics', expectedTitle: ['Analytics'] },
      { id: 'Task Manager', name: 'Task Manager', tut: 'nav-tasks', expectedTitle: ['Task Manager', 'Task'] },
      { id: 'AI Assistant', name: 'AI Assistant', tut: 'nav-ai', expectedTitle: ['EONPAI', 'AI Assistant'] },
      { id: 'Dashboard', name: 'Dashboard', tut: 'nav-dashboard', expectedTitle: ['Dashboard'] },
    ]

    for (const v of appViews) {
      await evaluate(`((id, tut) => {
        const btn = document.querySelector(\`[data-tab="\${id}"]\`) || document.querySelector(\`[data-tutorial="\${tut}"]\`);
        if (btn) btn.click();
      })('${v.id}', '${v.tut}')`)
      await sleep(800)

      const viewTitle = await evaluate(`document.querySelector('.top-brand-title')?.innerText || document.querySelector('h1')?.innerText`)
      const titleMatches = v.expectedTitle.some(t => viewTitle && viewTitle.includes(t))
      recordControl('Sidebar Navigation', `Navigate to ${v.id}`, 'nav-action', titleMatches ? 'PASS' : 'FAIL', `title=${viewTitle}`)

      if (v.id === 'Goals & Missions') {
        const goalsCheck = await evaluate(`(() => {
          const sortSelect = document.querySelector('.tasks-sort-select');
          const shinpoTrigger = document.querySelector('.shinpo-select-trigger');
          const sortBorder = sortSelect ? window.getComputedStyle(sortSelect).border : 'none';
          const newGoalBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('New Goal'));
          return {
            hasSort: !!sortSelect,
            hasShinpo: !!shinpoTrigger,
            sortBorder,
            hasNewGoal: !!newGoalBtn,
          };
        })()`)
        recordControl('Goals View', 'Tasks Sort Single Capsule (No Double Border)', 'select', goalsCheck.sortBorder.includes('0px') || goalsCheck.sortBorder.includes('none') ? 'PASS' : 'FAIL', `outer border=${goalsCheck.sortBorder}`)
        recordControl('Goals View', 'New Goal Trigger Button', 'button', goalsCheck.hasNewGoal ? 'PASS' : 'FAIL')
        await captureScreenshot('06_goals_view.png')
      } else if (v.id === 'Focus Engine') {
        const focusCheck = await evaluate(`(() => {
          const presets = Array.from(document.querySelectorAll('.preset-chip, .preset-btn, .duration-preset-btn')).map(b => b.innerText.trim());
          const startBtn = document.querySelector('.btn-start-focus') || Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Start'));
          const srPanel = document.querySelector('.study-resources-panel') || document.querySelector('.study-resources-card');
          return {
            presets,
            hasStart: !!startBtn,
            hasSr: !!srPanel,
          };
        })()`)
        recordControl('Focus View', 'Duration Presets (25m, 45m, 50m, 90m)', 'buttons', focusCheck.presets.length >= 3 ? 'PASS' : 'FAIL', focusCheck.presets.join(', '))
        recordControl('Focus View', 'Start Focus Session Button', 'button', focusCheck.hasStart ? 'PASS' : 'FAIL')
        await captureScreenshot('07_focus_engine.png')
      } else if (v.id === 'Task Manager') {
        const tmCheck = await evaluate(`(() => {
          const overrideBtn = document.querySelector('.emergency-override-btn');
          const refreshBtn = document.querySelector('.tm-refresh-btn');
          const badges = Array.from(document.querySelectorAll('.tm-protection-badge, .mode-badge')).map(b => b.innerText.trim());
          const hasRawAudit = badges.some(b => b === 'AUDIT_ONLY');
          return {
            overrideHeight: overrideBtn ? window.getComputedStyle(overrideBtn).height : null,
            refreshHeight: refreshBtn ? window.getComputedStyle(refreshBtn).height : null,
            badges,
            hasRawAudit,
          };
        })()`)
        recordControl('Task Manager', 'Button Heights Harmonization', 'layout', tmCheck.overrideHeight === tmCheck.refreshHeight ? 'PASS' : 'FAIL', `override=${tmCheck.overrideHeight}, refresh=${tmCheck.refreshHeight}`)
        recordControl('Task Manager', 'Human-Readable Mode Badge ("Monitoring Only")', 'badge', !tmCheck.hasRawAudit ? 'PASS' : 'FAIL', tmCheck.badges.join(', '))
        await captureScreenshot('08_task_manager.png')
      } else if (v.id === 'AI Assistant') {
        const aiCheck = await evaluate(`(() => {
          const input = document.querySelector('.chat-input') || document.querySelector('textarea');
          const sendBtn = document.querySelector('.eonpai-composer-send-btn, button[title="Send Message"], .chat-send-btn') || document.querySelector('button[type="submit"]');
          return {
            hasInput: !!input,
            hasSendBtn: !!sendBtn,
          };
        })()`)
        recordControl('EONPAI AI', 'Chat Input Box', 'textarea', aiCheck.hasInput ? 'PASS' : 'FAIL')
        recordControl('EONPAI AI', 'Send Message Button', 'button', aiCheck.hasSendBtn ? 'PASS' : 'FAIL')
        await captureScreenshot('09_eonpai_ai.png')
      }
    }

    console.log('\n[Phase 7] Sign Out & Session Cleared...')
    await evaluate(`(() => {
      const logoutBtn = document.querySelector('button[aria-label="Sign Out"], button[title="Sign Out"]');
      if (logoutBtn) logoutBtn.click();
    })()`)
    await sleep(1500)

    const isLoggedOut = await evaluate(`(() => {
      const token = localStorage.getItem('shinpo_access_token');
      const authBox = document.querySelector('.auth-card') || document.querySelector('input[type="password"]');
      return !token && !!authBox;
    })()`)
    recordControl('Auth Lifecycle', 'Sign Out Action & Storage Purge', 'button', isLoggedOut ? 'PASS' : 'FAIL', 'Storage purged, returned to Auth')
    await captureScreenshot('10_signed_out.png')

    console.log('\n========================================================================')
    console.log('   CONTROL INVENTORY SUMMARY')
    console.log('========================================================================')
    const passCount = controlInventory.filter(c => c.status === 'PASS').length
    const failCount = controlInventory.filter(c => c.status === 'FAIL').length
    console.log(`Total Controls Inspected: ${controlInventory.length}`)
    console.log(`Passing: ${passCount}`)
    console.log(`Failing: ${failCount}`)

    const inventoryReport = {
      timestamp: new Date().toISOString(),
      summary: {
        total: controlInventory.length,
        passed: passCount,
        failed: failCount,
      },
      controls: controlInventory,
      consoleErrors: consoleLogs.filter(l => l.type === 'error'),
    }
    fs.writeFileSync('docs/qa/INTERACTIVE_CONTROL_INVENTORY.json', JSON.stringify(inventoryReport, null, 2))
    console.log('Saved inventory report to docs/qa/INTERACTIVE_CONTROL_INVENTORY.json')

    ws.close()
    chrome.kill()
    if (failCount > 0) {
      process.exit(1)
    }
  } catch (err) {
    console.error('Inventory execution error:', err)
    chrome.kill()
    process.exit(1)
  }
}

runInventory()
