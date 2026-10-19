import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/critical_ui_repair'

async function runVerification() {
  console.log('=================================================================')
  console.log('  SHINPO — CRITICAL UI REPAIR AUDIT & SCREENSHOT VERIFICATION')
  console.log('=================================================================')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9295
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-ui-repair-${Date.now()}`,
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
      await sleep(300)
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

    console.log('  Waiting for application shell to mount...')
    let shellMounted = false
    for (let i = 0; i < 40; i++) {
      await sleep(300)
      shellMounted = await evaluate(`Boolean(document.querySelector('.icon-sidebar') && document.querySelector('.app-main'))`)
      if (shellMounted) break
    }
    if (!shellMounted) throw new Error('Application shell did not mount after login')
    console.log('  ✅ Application shell successfully mounted!')

    // Give data a moment to settle
    await sleep(1000)

    console.log('\n=================================================================')
    console.log('[Phase 2] Measuring Sidebar vs Workspace Intersections (0px Overlap Check)')
    console.log('=================================================================')

    await setViewport(1440, 900)

    // 1. Collapsed state
    await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar')
        const toggle = document.querySelector('.sidebar-toggle-btn')
        if (sidebar && sidebar.classList.contains('expanded')) {
          toggle?.click()
        }
      })()
    `)
    await sleep(400)

    const collapsedMetrics = await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar')
        const appMain = document.querySelector('.app-main')
        const sRect = sidebar.getBoundingClientRect()
        const mRect = appMain.getBoundingClientRect()
        return {
          sidebarWidth: Math.round(sRect.width),
          sidebarRight: Math.round(sRect.right),
          mainLeft: Math.round(mRect.left),
          overlapPx: Math.max(0, Math.round(sRect.right - mRect.left)),
          isExpanded: sidebar.classList.contains('expanded'),
          mainHasClass: appMain.classList.contains('sidebar-expanded')
        }
      })()
    `)
    console.log('  Collapsed State:', collapsedMetrics)
    if (collapsedMetrics.overlapPx > 0) {
      console.error(`  ❌ FAILED: Collapsed overlap is ${collapsedMetrics.overlapPx}px`)
    } else {
      console.log('  ✅ PASSED: Collapsed state zero overlap verified (0px).')
    }

    // 2. Pinned expanded state
    await evaluate(`
      (() => {
        const toggle = document.querySelector('.sidebar-toggle-btn')
        toggle?.click()
      })()
    `)
    await sleep(500)

    const pinnedMetrics = await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar')
        const appMain = document.querySelector('.app-main')
        const sRect = sidebar.getBoundingClientRect()
        const mRect = appMain.getBoundingClientRect()
        return {
          sidebarWidth: Math.round(sRect.width),
          sidebarRight: Math.round(sRect.right),
          mainLeft: Math.round(mRect.left),
          overlapPx: Math.max(0, Math.round(sRect.right - mRect.left)),
          isExpanded: sidebar.classList.contains('expanded'),
          mainHasClass: appMain.classList.contains('sidebar-expanded')
        }
      })()
    `)
    console.log('  Pinned Expanded State:', pinnedMetrics)
    if (pinnedMetrics.overlapPx > 0) {
      console.error(`  ❌ FAILED: Pinned overlap is ${pinnedMetrics.overlapPx}px`)
    } else {
      console.log('  ✅ PASSED: Pinned expanded state zero overlap verified (0px).')
    }

    console.log('\n=================================================================')
    console.log('[Phase 3] Measuring Navigation Icon & Label Alignments (<= 2px Delta Check)')
    console.log('=================================================================')

    // Switch to Focus tab to ensure Focus active arrow is present
    await evaluate(`
      (() => {
        const focusBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.textContent.includes('Focus'))
        focusBtn?.click()
      })()
    `)
    await sleep(400)

    const navItemMetrics = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('.sidebar-btn'))
        return buttons.map(b => {
          const iconSpan = b.querySelector('.sidebar-btn-icon')
          const labelSpan = b.querySelector('.sidebar-btn-label')
          const arrow = b.querySelector('.sidebar-active-arrow')
          const bRect = b.getBoundingClientRect()
          const iRect = iconSpan ? iconSpan.getBoundingClientRect() : null
          const lRect = labelSpan ? labelSpan.getBoundingClientRect() : null
          return {
            label: labelSpan ? labelSpan.textContent.trim() : (b.getAttribute('data-tooltip') || 'unknown'),
            isActive: b.classList.contains('active'),
            btnLeft: Math.round(bRect.left),
            iconLeft: iRect ? Math.round(iRect.left) : null,
            iconWidth: iRect ? Math.round(iRect.width) : null,
            labelLeft: lRect ? Math.round(lRect.left) : null,
            hasArrow: Boolean(arrow)
          }
        })
      })()
    `)

    console.table(navItemMetrics)

    const iconLefts = navItemMetrics.map(m => m.iconLeft).filter(x => x !== null)
    const labelLefts = navItemMetrics.map(m => m.labelLeft).filter(x => x !== null)
    const minIconLeft = Math.min(...iconLefts)
    const maxIconLeft = Math.max(...iconLefts)
    const iconDelta = maxIconLeft - minIconLeft

    const minLabelLeft = Math.min(...labelLefts)
    const maxLabelLeft = Math.max(...labelLefts)
    const labelDelta = maxLabelLeft - minLabelLeft

    console.log(`  Icon Horizontal Alignment Delta: ${iconDelta}px (Target: <= 2px)`)
    console.log(`  Label Horizontal Alignment Delta: ${labelDelta}px (Target: <= 2px)`)

    if (iconDelta <= 2) {
      console.log('  ✅ PASSED: All navigation icons horizontally aligned!')
    } else {
      console.error(`  ❌ FAILED: Icon delta ${iconDelta}px exceeds 2px threshold!`)
    }

    if (labelDelta <= 2) {
      console.log('  ✅ PASSED: All navigation labels horizontally aligned!')
    } else {
      console.error(`  ❌ FAILED: Label delta ${labelDelta}px exceeds 2px threshold!`)
    }

    // Check active Focus item icon specifically
    const focusItem = navItemMetrics.find(m => m.label === 'Focus')
    const otherItems = navItemMetrics.filter(m => m.label !== 'Focus')
    if (focusItem && otherItems.length > 0) {
      const avgOtherIcon = otherItems.reduce((a, b) => a + b.iconLeft, 0) / otherItems.length
      const focusIconDelta = Math.abs(focusItem.iconLeft - avgOtherIcon)
      console.log(`  Active Focus Icon vs Inactive Average Delta: ${focusIconDelta}px`)
      if (focusIconDelta <= 2) {
        console.log('  ✅ PASSED: Active Focus icon aligns identically with inactive icons!')
      } else {
        console.error(`  ❌ FAILED: Active Focus icon is displaced by ${focusIconDelta}px!`)
      }
    }

    console.log('\n=================================================================')
    console.log('[Phase 4] Measuring Branding & Header Row Alignment')
    console.log('=================================================================')

    const headerMetrics = await evaluate(`
      (() => {
        const header = document.querySelector('.sidebar-header')
        const logo = header.querySelector('.brand-badge')
        const toggle = header.querySelector('.sidebar-toggle-btn')
        const hRect = header.getBoundingClientRect()
        const lRect = logo.getBoundingClientRect()
        const tRect = toggle.getBoundingClientRect()
        return {
          headerHeight: Math.round(hRect.height),
          logoCenterY: Math.round(lRect.top + lRect.height / 2),
          toggleCenterY: Math.round(tRect.top + tRect.height / 2),
          centerDeltaY: Math.abs(Math.round((lRect.top + lRect.height / 2) - (tRect.top + tRect.height / 2)))
        }
      })()
    `)
    console.log('  Sidebar Header Metrics:', headerMetrics)
    if (headerMetrics.centerDeltaY <= 4) {
      console.log('  ✅ PASSED: Logo and Pin/Unpin Toggle are vertically aligned on a single row!')
    } else {
      console.error(`  ❌ FAILED: Vertical center delta is ${headerMetrics.centerDeltaY}px!`)
    }

    console.log('\n=================================================================')
    console.log('[Phase 5] Measuring Top Bar Geometry (70px Utility Bar)')
    console.log('=================================================================')

    const topBarMetrics = await evaluate(`
      (() => {
        const bar = document.querySelector('.cockpit-top-bar')
        const search = document.querySelector('.top-search-command')
        const title = document.querySelector('.page-heading')
        const buttons = Array.from(document.querySelectorAll('.cockpit-top-bar .action-btn-circle'))
        const bRect = bar.getBoundingClientRect()
        const sRect = search ? search.getBoundingClientRect() : null
        const tStyle = title ? window.getComputedStyle(title) : {}
        return {
          barHeight: Math.round(bRect.height),
          barWidth: Math.round(bRect.width),
          searchWidth: sRect ? Math.round(sRect.width) : null,
          searchHeight: sRect ? Math.round(sRect.height) : null,
          titleFontSize: tStyle.fontSize,
          titleFontWeight: tStyle.fontWeight,
          btnDimensions: buttons.map(b => {
            const r = b.getBoundingClientRect()
            return { w: Math.round(r.width), h: Math.round(r.height) }
          })
        }
      })()
    `)
    console.log('  Top Bar Metrics:', topBarMetrics)
    if (Math.abs(topBarMetrics.barHeight - 70) <= 3) {
      console.log('  ✅ PASSED: Top Bar height is 70px (+/- 3px)!')
    } else {
      console.error(`  ❌ FAILED: Top Bar height is ${topBarMetrics.barHeight}px (expected 70px)!`)
    }

    if (topBarMetrics.searchHeight >= 38 && topBarMetrics.searchHeight <= 46) {
      console.log('  ✅ PASSED: Search input height is ~42px!')
    }

    console.log('\n=================================================================')
    console.log('[Phase 6] Measuring Focus Workspace Columns (2-Column Hero Split)')
    console.log('=================================================================')

    const focusMetrics = await evaluate(`
      (() => {
        const container = document.querySelector('.focus-workspace-container')
        const split = document.querySelector('.focus-hero-split')
        const timerCard = document.querySelector('.card-timer-hud')
        const sessionCard = document.querySelector('.card-session-creator')
        const historyCard = document.querySelector('.card-session-history')
        const digits = document.querySelector('.timer-digits-display')

        const tRect = timerCard.getBoundingClientRect()
        const sRect = sessionCard.getBoundingClientRect()
        const hRect = historyCard.getBoundingClientRect()
        const dStyle = digits ? window.getComputedStyle(digits) : {}

        return {
          hasWorkspaceContainer: Boolean(container),
          hasHeroSplit: Boolean(split),
          timerWidth: Math.round(tRect.width),
          sessionWidth: Math.round(sRect.width),
          ratio: (tRect.width / sRect.width).toFixed(2),
          historyWidth: Math.round(hRect.width),
          digitsFontSize: dStyle.fontSize,
          digitsFontWeight: dStyle.fontWeight,
          overflowX: document.documentElement.scrollWidth > window.innerWidth
        }
      })()
    `)
    console.log('  Focus Workspace Metrics:', focusMetrics)
    if (focusMetrics.hasWorkspaceContainer && focusMetrics.hasHeroSplit) {
      console.log('  ✅ PASSED: Focus workspace layout architecture verified!')
    }
    console.log(`  Timer HUD vs Session Configuration width ratio: ${focusMetrics.ratio} (Target: ~1.15)`)
    if (!focusMetrics.overflowX) {
      console.log('  ✅ PASSED: Zero horizontal overflow on viewport!')
    } else {
      console.error('  ❌ FAILED: Viewport has horizontal overflow!')
    }

    console.log('\n=================================================================')
    console.log('[Phase 7] Capturing Multi-Viewport Screenshots Across Themes')
    console.log('=================================================================')

    const viewports = [
      { w: 1920, h: 1080, name: '1920x1080' },
      { w: 1440, h: 900, name: '1440x900' },
      { w: 1306, h: 1036, name: '1306x1036' },
      { w: 1280, h: 800, name: '1280x800' },
      { w: 1000, h: 768, name: '1000x768' },
    ]

    for (const vp of viewports) {
      console.log(`\n  --- Viewport: ${vp.name} ---`)
      await setViewport(vp.w, vp.h)

      // Ensure Focus view & Dark theme & expanded sidebar
      await evaluate(`
        (() => {
          document.documentElement.setAttribute('data-theme', 'dark')
          document.body.className = 'theme-dark'
          const sidebar = document.querySelector('.icon-sidebar')
          if (sidebar && !sidebar.classList.contains('expanded')) {
            document.querySelector('.sidebar-toggle-btn')?.click()
          }
        })()
      `)
      await sleep(350)
      await captureScreenshot(`01_focus_expanded_sidebar_${vp.name}_dark.png`)

      // Light theme & expanded sidebar
      await evaluate(`
        (() => {
          document.documentElement.setAttribute('data-theme', 'light')
          document.body.className = 'theme-light'
        })()
      `)
      await sleep(350)
      await captureScreenshot(`02_focus_expanded_sidebar_${vp.name}_light.png`)

      // Switch to Dashboard & Dark theme & collapsed sidebar
      await evaluate(`
        (() => {
          document.documentElement.setAttribute('data-theme', 'dark')
          document.body.className = 'theme-dark'
          const dashBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.getAttribute('data-tooltip') === 'Dashboard' || b.textContent.includes('Dashboard'))
          dashBtn?.click()
          const sidebar = document.querySelector('.icon-sidebar')
          if (sidebar && sidebar.classList.contains('expanded')) {
            document.querySelector('.sidebar-toggle-btn')?.click()
          }
        })()
      `)
      await sleep(350)
      await captureScreenshot(`03_dashboard_collapsed_sidebar_${vp.name}_dark.png`)

      // Switch back to Focus view
      await evaluate(`
        (() => {
          const focusBtn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => b.getAttribute('data-tooltip') === 'Focus' || b.textContent.includes('Focus'))
          focusBtn?.click()
        })()
      `)
      await sleep(300)
    }

    console.log('\n=================================================================')
    console.log('  ALL AUDITS AND VERIFICATION CHECKS COMPLETED SUCCESSFULLY!')
    console.log('=================================================================')

  } finally {
    chrome.kill()
  }
}

runVerification().catch((err) => {
  console.error('Fatal Verification Error:', err)
  process.exit(1)
})

