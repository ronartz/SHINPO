import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/design_system'
const QA_SCREENSHOTS_DIR = '/home/eonx/Projects/SHINPO/docs/qa/screenshots/design_system'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(QA_SCREENSHOTS_DIR, { recursive: true })

async function runDesignSystemVerification() {
  console.log('=== SHINPO Global UI Consistency & Design System Verification ===')
  const chromePort = 9299
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-design-sys-${Date.now()}`,
    '--disable-dev-shm-usage',
    'http://127.0.0.1:5173/',
  ])

  try {
    let wsUrl = null
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      try {
        const res = await fetch(`http://127.0.0.1:${chromePort}/json/list`)
        const list = await res.json()
        const page = list.find((it) => it.type === 'page' && it.url && it.url.includes('127.0.0.1:5173'))
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

    async function setViewport(width, height) {
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(300)
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const buf = Buffer.from(shot.result.data, 'base64')
      const artifactPath = path.join(ARTIFACT_DIR, filename)
      const qaPath = path.join(QA_SCREENSHOTS_DIR, filename)
      fs.writeFileSync(artifactPath, buf)
      fs.writeFileSync(qaPath, buf)
      console.log(`  [Screenshot] Captured: ${filename}`)
      return artifactPath
    }

    await send('Page.enable')
    await send('DOM.enable')
    await setViewport(1440, 900)

    // 1. Authenticate
    console.log('\n[1/6] Authenticating as EONX...')
    await evaluate(`
      (async () => {
        let res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernameOrEmail: "EONX", password: "shinpo_demo" })
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem("shinpo_access_token", data.accessToken);
          localStorage.setItem("shinpo_refresh_token", data.refreshToken);
          localStorage.setItem("shinpo_auth_user", JSON.stringify(data.user));
          localStorage.setItem("shinpo_sidebar_pinned", "true");
          location.reload();
        }
      })()
    `)
    await sleep(2500)

    // Dismiss any active tutorial or dialog
    await evaluate(`
      (() => {
        const skip = document.querySelector('.tutorial-skip-btn, button[aria-label="Close dialog"], .tutorial-pause-btn');
        if (skip) skip.click();
      })()
    `)
    await sleep(800)

    // Helper functions
    async function setV2(enabled) {
      await evaluate(`
        (() => {
          const current = localStorage.getItem('shinpo_v2_enabled');
          const isEnabled = current !== 'false';
          if (isEnabled !== ${enabled}) {
            localStorage.setItem('shinpo_v2_enabled', ${enabled} ? 'true' : 'false');
            location.reload();
          }
        })()
      `)
      await sleep(1500)
    }

    async function setTheme(mode) {
      await evaluate(`
        (() => {
          document.documentElement.setAttribute('data-theme', '${mode}');
          if ('${mode}' === 'light') {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('theme-dark');
          } else {
            document.documentElement.classList.add('theme-dark');
            document.documentElement.classList.remove('theme-light');
          }
        })()
      `)
      await sleep(500)
    }

    async function navigateTo(tabName) {
      await evaluate(`
        (() => {
          const btns = Array.from(document.querySelectorAll('.aurora-sidebar-nav-btn, .sidebar-btn, .icon-sidebar .sidebar-btn'));
          const target = btns.find(b => {
            const txt = b.textContent.trim().toLowerCase();
            return txt.includes('${tabName.toLowerCase()}');
          });
          if (target) target.click();
        })()
      `)
      await sleep(800)
    }

    // 2. Dashboard Symmetrical Metrics Verification
    console.log('\n[2/6] Verifying Dashboard Layout & Symmetrical Card Geometry...')
    await setV2(true)
    await setTheme('dark')
    await navigateTo('dashboard')
    await captureScreenshot('01_dashboard_aurora_dark_1440x900.png')

    const dashboardMetrics = await evaluate(`
      (() => {
        // 1. Four Summary Cards
        const grid = document.querySelector('[aria-label="Performance Metrics"]');
        let cardDiff = 0;
        let cardHeights = [];
        if (grid && grid.children.length >= 4) {
          const rects = Array.from(grid.children).slice(0, 4).map(c => c.getBoundingClientRect().height);
          cardHeights = rects;
          const minH = Math.min(...rects);
          const maxH = Math.max(...rects);
          cardDiff = maxH - minH;
        }

        // 2. Action row height delta
        const sentinel = document.querySelector('#aurora-focus-protection-pill') || document.querySelector('.sentinel-badge-pill');
        const newTask = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        let actionRowDiff = 0;
        if (sentinel && newTask) {
          actionRowDiff = Math.abs(sentinel.getBoundingClientRect().height - newTask.getBoundingClientRect().height);
        }

        // 3. Perspective Quote
        const quoteCard = document.querySelector('[aria-label="Perspective Quote"]') || document.querySelector('.sidebar-upper-quote');
        const quoteText = quoteCard?.querySelector('.sidebar-upper-quote-text, p:last-of-type');
        const quoteStyle = quoteText ? window.getComputedStyle(quoteText) : null;
        const quoteFamily = quoteStyle?.fontFamily || '';
        const isQuoteSerif = quoteFamily.toLowerCase().includes('playfair') ||
                             quoteFamily.toLowerCase().includes('georgia') ||
                             quoteFamily.toLowerCase().includes('serif');

        // 4. Today's schedule grid
        const schedCard = document.querySelector('[aria-label="Today\\'s Schedule"]');
        const schedGrid = !!schedCard;

        return {
          cardHeights,
          cardDiff,
          actionRowDiff,
          quoteFamily,
          quoteFontStyle: quoteStyle?.fontStyle,
          isQuoteSerif,
          schedGrid,
        };
      })()
    `)
    console.log('  Dashboard Geometry Metrics:', dashboardMetrics)

    // 3. Comprehensive Typography Audit across All Tabs
    console.log('\n[3/6] Auditing Computed Typography (Floor >= 12px) across All Tabs...')
    const tabs = ['dashboard', 'goals', 'schedule', 'focus', 'task', 'analytics', 'eonpai']
    const viewTypographyAudits = []

    for (const tab of tabs) {
      await navigateTo(tab)
      await sleep(1000)

      const audit = await evaluate(`
        (() => {
          const main = document.querySelector('.aurora-main-content') || document.querySelector('.app-main') || document.body;
          const allEls = Array.from(main.querySelectorAll('*'));
          const textNodes = allEls.filter(el => {
            if (el.children.length > 0) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
            const txt = el.textContent?.trim();
            return txt && txt.length > 0;
          });

          const fontSizes = textNodes.map(el => {
            const style = window.getComputedStyle(el);
            return {
              tag: el.tagName.toLowerCase(),
              className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 30) : '',
              text: el.textContent.trim().slice(0, 25),
              fontSize: parseFloat(style.fontSize),
              color: style.color,
            };
          });

          const below12 = fontSizes.filter(f => f.fontSize < 11.95);
          const min = fontSizes.length > 0 ? Math.min(...fontSizes.map(f => f.fontSize)) : 16;
          const max = fontSizes.length > 0 ? Math.max(...fontSizes.map(f => f.fontSize)) : 16;

          return {
            totalTextElements: fontSizes.length,
            minFontSize: min,
            maxFontSize: max,
            sub12Count: below12.length,
            sub12Samples: below12.slice(0, 5),
          };
        })()
      `)

      console.log(`  [Tab: ${tab.toUpperCase()}] Text Nodes: ${audit.totalTextElements}, Min Font: ${audit.minFontSize}px, Sub-12 Count: ${audit.sub12Count}`)
      if (audit.sub12Count > 0) {
        console.error(`    VIOLATION on ${tab}:`, audit.sub12Samples)
      }
      viewTypographyAudits.push({ tab, ...audit })
    }

    // 4. Modal Form Typography & Geometry Verification
    console.log('\n[4/6] Verifying Dialog Form Geometry & Labels...')
    await navigateTo('dashboard')
    await sleep(600)

    // Open Create Task modal
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        if (btn) btn.click();
      })()
    `)
    await sleep(800)
    await captureScreenshot('02_create_task_modal_geometry.png')

    const modalAudit = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box, .shinpo-dialog-card');
        if (!modal) return { error: 'Modal not found' };

        const title = modal.querySelector('.modal-title, .shinpo-dialog-title');
        const desc = modal.querySelector('.modal-sub, .shinpo-dialog-description');
        const labels = Array.from(modal.querySelectorAll('label, .shinpo-field-label'));
        const inputs = Array.from(modal.querySelectorAll('input, select, .shinpo-select-trigger'));
        const buttons = Array.from(modal.querySelectorAll('button[type="submit"], button.btn-timer, button.shinpo-btn'));

        const titleStyle = title ? window.getComputedStyle(title) : null;
        const descStyle = desc ? window.getComputedStyle(desc) : null;

        const labelSizes = labels.map(l => parseFloat(window.getComputedStyle(l).fontSize));
        const inputHeights = inputs.map(i => i.getBoundingClientRect().height);

        return {
          titleSize: titleStyle ? parseFloat(titleStyle.fontSize) : null,
          titleWeight: titleStyle?.fontWeight,
          descSize: descStyle ? parseFloat(descStyle.fontSize) : null,
          labelCount: labels.length,
          minLabelSize: labelSizes.length > 0 ? Math.min(...labelSizes) : null,
          maxLabelSize: labelSizes.length > 0 ? Math.max(...labelSizes) : null,
          inputHeights,
          allLabelsGte14: labelSizes.every(s => s >= 13.9),
        };
      })()
    `)
    console.log('  Create Task Modal Audit:', modalAudit)

    // Close modal
    await evaluate(`
      (() => {
        const cancel = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (cancel) cancel.click();
      })()
    `)
    await sleep(600)

    // 5. Multi-Appearance Permutations & Responsive Viewports
    console.log('\n[5/6] Verifying Appearances (Aurora/Classic x Dark/Light x 3 Desktop Breakpoints)...')
    const permutations = [
      { v2: true, theme: 'dark', vp: { w: 1440, h: 900 }, name: 'aurora_dark_1440x900' },
      { v2: true, theme: 'light', vp: { w: 1440, h: 900 }, name: 'aurora_light_1440x900' },
      { v2: true, theme: 'dark', vp: { w: 1280, h: 800 }, name: 'aurora_dark_1280x800' },
      { v2: true, theme: 'dark', vp: { w: 1024, h: 768 }, name: 'aurora_dark_1024x768' },
      { v2: false, theme: 'dark', vp: { w: 1440, h: 900 }, name: 'classic_dark_1440x900' },
      { v2: false, theme: 'light', vp: { w: 1440, h: 900 }, name: 'classic_light_1440x900' },
    ]

    const permutationResults = []
    for (const p of permutations) {
      await setV2(p.v2)
      await setTheme(p.theme)
      await setViewport(p.vp.w, p.vp.h)
      await navigateTo('dashboard')
      await sleep(600)

      const overflow = await evaluate(`
        (() => {
          const doc = document.documentElement;
          return {
            windowWidth: window.innerWidth,
            docScrollWidth: doc.scrollWidth,
            hasHorizontalOverflow: doc.scrollWidth > window.innerWidth,
          };
        })()
      `)

      await captureScreenshot(`view_${p.name}.png`)
      console.log(`  [Permutation ${p.name}] Overflow: ${overflow.hasHorizontalOverflow} (window: ${overflow.windowWidth}px, doc: ${overflow.docScrollWidth}px)`)
      permutationResults.push({
        permutation: p.name,
        ...overflow,
      })
    }

    // 6. Final Report Generation
    console.log('\n[6/6] Generating Verification Summary Report...')
    const allTabsPassed = viewTypographyAudits.every(a => a.sub12Count === 0)
    const cardDeltaPassed = dashboardMetrics.cardDiff <= 1.0
    const noOverflowPassed = permutationResults.every(r => !r.hasHorizontalOverflow)

    const fullReport = {
      timestamp: new Date().toISOString(),
      overallStatus: (allTabsPassed && cardDeltaPassed && noOverflowPassed) ? 'PASSED' : 'FLAGGED',
      dashboardMetrics,
      viewTypographyAudits,
      modalAudit,
      permutationResults,
    }

    const reportPath = '/home/eonx/Projects/SHINPO/docs/qa/DESIGN_SYSTEM_COMPLETION_REPORT.json'
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2))
    console.log(`\nReport successfully written to: ${reportPath}`)
    console.log(`Overall Design System Completion Status: ${fullReport.overallStatus}`)

    ws.close()
  } finally {
    chrome.kill('SIGKILL')
  }
}

runDesignSystemVerification().catch(err => {
  console.error('Fatal error in design system verification:', err)
  process.exit(1)
})

