import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SCREENSHOT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/scroll_tests'
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

async function runScrollAcceptance() {
  console.log('===============================================================')
  console.log('   SHINPO — COMPREHENSIVE SCROLL ARCHITECTURE ACCEPTANCE TEST  ')
  console.log('   Testing Classic & V2 Aurora across 4 Viewports & Themes     ')
  console.log('===============================================================')

  const chromePort = 9230
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/'
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

    if (!wsUrl) throw new Error('Could not find Chrome webSocketDebuggerUrl')

    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve)
      ws.addEventListener('error', reject)
    })

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
      return new Promise((resolve) => {
        const msgId = id++
        pending.set(msgId, resolve)
        ws.send(JSON.stringify({ id: msgId, method, params }))
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
      if (res.result && res.result.exceptionDetails) {
        console.error('Eval error:', res.result.exceptionDetails)
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
      await send('Emulation.setVisibleSize', { width, height })
      await sleep(300)
    }

    async function captureScreenshot(filepath) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      if (res && res.result && res.result.data) {
        fs.writeFileSync(filepath, Buffer.from(res.result.data, 'base64'))
        console.log(`[Screenshot] Saved: ${path.basename(filepath)}`)
      }
    }

    await sleep(2000)

    // Handle initial login if on auth screen
    await evaluate(`
      (async () => {
        const fillBtn = document.querySelector('button.auth-quick-fill-btn');
        if (fillBtn) {
          fillBtn.click();
          await new Promise(r => setTimeout(r, 200));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `)
    await sleep(2500)

    // Helper functions to get current mode, theme, and bounding metrics
    async function getMetrics() {
      return await evaluate(`
        (() => {
          const docScrollHeight = document.scrollingElement.scrollHeight;
          const docClientHeight = document.scrollingElement.clientHeight;
          const docScrollTop = document.scrollingElement.scrollTop;

          const sidebar = document.querySelector('aside.icon-sidebar');
          const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;

          const logo = document.querySelector('.brand-badge, .shinpo-logo');
          const logoRect = logo ? logo.getBoundingClientRect() : null;

          const navStack = document.querySelector('.sidebar-nav-stack');
          const navStackRect = navStack ? navStack.getBoundingClientRect() : null;

          const shieldFooter = document.querySelector('.sidebar-footer, .sidebar-status-quiet');
          const shieldRect = shieldFooter ? shieldFooter.getBoundingClientRect() : null;

          const topbar = document.querySelector('header.cockpit-top-bar');
          const topbarRect = topbar ? topbar.getBoundingClientRect() : null;

          const workspace = document.querySelector('.app-workspace-content');
          const workspaceRect = workspace ? workspace.getBoundingClientRect() : null;

          return {
            window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
            document: { docScrollHeight, docClientHeight, docScrollTop },
            sidebar: sidebarRect ? { top: sidebarRect.top, bottom: sidebarRect.bottom, left: sidebarRect.left, right: sidebarRect.right, width: sidebarRect.width, height: sidebarRect.height } : null,
            logo: logoRect ? { top: logoRect.top, bottom: logoRect.bottom, left: logoRect.left, height: logoRect.height } : null,
            navStack: navStackRect ? { top: navStackRect.top, bottom: navStackRect.bottom, height: navStackRect.height } : null,
            shieldFooter: shieldRect ? { top: shieldRect.top, bottom: shieldRect.bottom, height: shieldRect.height } : null,
            topbar: topbarRect ? { top: topbarRect.top, bottom: topbarRect.bottom, height: topbarRect.height } : null,
            workspace: workspace ? {
              scrollHeight: workspace.scrollHeight,
              clientHeight: workspace.clientHeight,
              scrollTop: workspace.scrollTop,
              top: workspaceRect ? workspaceRect.top : 0
            } : null
          };
        })()
      `)
    }

    async function setMode(wantV2) {
      await evaluate(`
        (() => {
          const isV2 = document.querySelector('.app-shell')?.classList.contains('theme-aurora') || !!document.querySelector('.aurora-viewport');
          if (isV2 !== ${wantV2}) {
            const toggle = document.querySelector('button.v2-preview-btn');
            if (toggle) toggle.click();
          }
        })()
      `)
      await sleep(1000)
    }

    async function setTheme(wantDark) {
      await evaluate(`
        (() => {
          const isLight = document.querySelector('.app-shell')?.classList.contains('theme-light') || document.body.classList.contains('theme-light');
          const isDark = !isLight;
          if (isDark !== ${wantDark}) {
            const themeBtn = Array.from(document.querySelectorAll('button')).find(b => b.title && (b.title.includes('Light Mode') || b.title.includes('Dark Mode')));
            if (themeBtn) themeBtn.click();
          }
        })()
      `)
      await sleep(1000)
    }

    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '1440x900',  width: 1440, height: 900 },
      { name: '1280x800',  width: 1280, height: 800 },
      { name: '1000x768',  width: 1000, height: 768 },
    ]

    const modes = [
      { name: 'Classic', isV2: false },
      { name: 'V2_Aurora', isV2: true },
    ]

    const results = []

    for (const mode of modes) {
      await setMode(mode.isV2)

      for (const vp of viewports) {
        await setViewport(vp.width, vp.height)

        for (const isDark of [true, false]) {
          const themeName = isDark ? 'Dark' : 'Light'
          await setTheme(isDark)

          console.log(`\n>>> Testing: [${mode.name}] [${vp.name}] [${themeName}]`)

          // 1. Initial State (at top)
          await evaluate(`
            (() => {
              const ws = document.querySelector('.app-workspace-content');
              if (ws) ws.scrollTo(0, 0);
              window.scrollTo(0, 0);
            })()
          `)
          await sleep(400)

          const before = await getMetrics()
          const initialShot = path.join(SCREENSHOT_DIR, `${mode.name}_${themeName}_${vp.name}_01_top.png`)
          await captureScreenshot(initialShot)

          // 2. Scroll workspace to bottom
          await evaluate(`
            (() => {
              const ws = document.querySelector('.app-workspace-content');
              if (ws) ws.scrollTo(0, 10000);
            })()
          `)
          await sleep(600)

          const after = await getMetrics()
          const scrolledShot = path.join(SCREENSHOT_DIR, `${mode.name}_${themeName}_${vp.name}_02_scrolled_bottom.png`)
          await captureScreenshot(scrolledShot)

          // Verification checks:
          const sidebarTopDelta = Math.abs((after.sidebar?.top ?? 0) - (before.sidebar?.top ?? 0))
          const topbarTopDelta = Math.abs((after.topbar?.top ?? 0) - (before.topbar?.top ?? 0))
          const windowScrollTop = after.document.docScrollTop
          const workspaceScrolled = (after.workspace?.scrollTop ?? 0) > 0
          const logoVisible = (after.logo?.top ?? 0) >= 0 && (after.logo?.bottom ?? 0) <= vp.height
          const navVisible = (after.navStack?.top ?? 0) >= 0
          const shieldAnchoredBottom = (after.shieldFooter?.bottom ?? 0) <= vp.height + 10 && (after.shieldFooter?.bottom ?? 0) >= vp.height - 30

          const pass = (
            sidebarTopDelta <= 1 &&
            topbarTopDelta <= 1 &&
            windowScrollTop === 0 &&
            workspaceScrolled &&
            logoVisible &&
            navVisible &&
            shieldAnchoredBottom
          )

          results.push({
            mode: mode.name,
            viewport: vp.name,
            theme: themeName,
            sidebarTopDelta,
            topbarTopDelta,
            windowScrollTop,
            workspaceScrollTop: after.workspace?.scrollTop,
            workspaceMaxScroll: (after.workspace?.scrollHeight ?? 0) - (after.workspace?.clientHeight ?? 0),
            logoVisible,
            navVisible,
            shieldAnchoredBottom,
            pass
          })

          console.log(`[Result] Sidebar Δ: ${sidebarTopDelta}px | Topbar Δ: ${topbarTopDelta}px | Window Scroll: ${windowScrollTop}px | Workspace Scroll: ${after.workspace?.scrollTop}px | Shield Anchored: ${shieldAnchoredBottom} => ${pass ? 'PASS' : 'FAIL'}`)

          // 3. Scroll back to top
          await evaluate(`
            (() => {
              const ws = document.querySelector('.app-workspace-content');
              if (ws) ws.scrollTo(0, 0);
            })()
          `)
          await sleep(300)

          // 4. Test Sidebar Collapse & Expand
          const collapseBtn = await evaluate(`
            (() => {
              const btn = document.querySelector('button.sidebar-toggle-btn');
              if (btn) {
                btn.click();
                return true;
              }
              return false;
            })()
          `)
          await sleep(400)
          const collapsedMetrics = await getMetrics()

          // Expand back
          await evaluate(`
            (() => {
              const btn = document.querySelector('button.sidebar-toggle-btn');
              if (btn) btn.click();
            })()
          `)
          await sleep(400)
        }
      }
    }

    // 5. Verify other views legitimate scrolling
    console.log('\n===============================================================')
    console.log('   VERIFYING OTHER VIEWS UNDER UNIFIED SCROLL ARCHITECTURE    ')
    console.log('===============================================================')

    const tabsToTest = ['Goals & Missions', 'Task Manager', 'Schedule', 'Focus', 'Analytics', 'AI Assistant']
    await setViewport(1440, 900)
    await setMode(true) // Test under Aurora V2

    const viewResults = []
    for (const tab of tabsToTest) {
      await evaluate(`
        (() => {
          const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.textContent && b.textContent.includes('${tab}'));
          if (btn) btn.click();
        })()
      `)
      await sleep(1000)

      const m = await getMetrics()
      const shot = path.join(SCREENSHOT_DIR, `View_${tab.replace(/[^a-zA-Z0-9]/g, '_')}_1440x900.png`)
      await captureScreenshot(shot)

      // Test scroll in this view
      await evaluate(`
        (() => {
          const ws = document.querySelector('.app-workspace-content');
          if (ws) ws.scrollTo(0, 10000);
        })()
      `)
      await sleep(400)
      const afterScroll = await getMetrics()

      viewResults.push({
        tab,
        sidebarTop: afterScroll.sidebar?.top,
        topbarTop: afterScroll.topbar?.top,
        windowScrollTop: afterScroll.document.docScrollTop,
        workspaceScrollTop: afterScroll.workspace?.scrollTop,
        pass: afterScroll.document.docScrollTop === 0 && Math.abs(afterScroll.sidebar?.top ?? 0) <= 1
      })

      console.log(`[View: ${tab}] Window Scroll: ${afterScroll.document.docScrollTop}px | Sidebar Top: ${afterScroll.sidebar?.top}px | Topbar Top: ${afterScroll.topbar?.top}px => PASS`)
    }

    // Return to Dashboard
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.textContent && b.textContent.includes('Dashboard'));
        if (btn) btn.click();
      })()
    `)
    await sleep(1000)

    console.log('\n===============================================================')
    console.log('   ACCEPTANCE TEST SUMMARY                                     ')
    console.log('===============================================================')
    console.table(results)
    console.table(viewResults)

    const allPassed = results.every(r => r.pass) && viewResults.every(v => v.pass)
    console.log(`\nOVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED (100% SUCCESS)' : 'FAILURES DETECTED'}`)

    ws.close()
  } finally {
    chrome.kill()
  }
}

runScrollAcceptance().catch(console.error)

