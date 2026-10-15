import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/classic_recovery'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runRecoveryVerification() {
  console.log('===============================================================')
  console.log('   SHINPO — CLASSIC RESTORATION MANDATORY VERIFICATION SUITE   ')
  console.log('   Testing 4 Viewports, Light & Dark, Collapse/Expand          ')
  console.log('===============================================================')

  const chromePort = 9246
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
      if (res.result && res.result.exceptionDetails) {
        console.error('Eval error:', JSON.stringify(res.result.exceptionDetails))
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

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`[Screenshot] Saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('CSS.enable')

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
    await sleep(2000)

    // Ensure Classic mode
    await evaluate(`
      (() => {
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Classic View'));
        if (toggleBtn) toggleBtn.click();
      })()
    `)
    await sleep(1000)

    const viewports = [
      { width: 1920, height: 1080, name: '1920x1080' },
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 800, name: '1280x800' },
      { width: 1000, height: 768, name: '1000x768' },
    ]

    const testResults = []

    for (const vp of viewports) {
      for (const isDark of [true, false]) {
        await setViewport(vp.width, vp.height)

        // Set theme
        await evaluate(`
          (() => {
            const hasLight = document.querySelector('.theme-light') !== null;
            const targetLight = ${!isDark};
            if (hasLight !== targetLight) {
              const themeBtn = document.querySelector('.topbar-control-btn[title*="Theme"]') ||
                               Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.includes('Theme'));
              if (themeBtn) themeBtn.click();
            }
          })()
        `)
        await sleep(500)

        // Get detailed metrics
        const metrics = await evaluate(`
          (() => {
            const sidebar = document.querySelector('.icon-sidebar');
            const appMain = document.querySelector('.app-main');
            const topbar = document.querySelector('.cockpit-top-bar');
            const quote = document.querySelector('.sidebar-quote') || document.querySelector('.sidebar-upper-quote');
            const logo = document.querySelector('.brand-badge');
            const navItems = Array.from(document.querySelectorAll('.nav-btn, .sidebar-nav-item, .nav-item, aside button.sidebar-btn'));
            const footer = document.querySelector('.sidebar-footer');

            function rect(el) {
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
            }

            return {
              sidebar: rect(sidebar),
              isExpanded: sidebar ? sidebar.classList.contains('expanded') : false,
              appMain: rect(appMain),
              topbar: rect(topbar),
              quote: rect(quote),
              logo: rect(logo),
              footer: rect(footer),
              navItemCount: navItems.length,
              navItems: navItems.map((n, i) => ({ idx: i, text: n.textContent.trim().slice(0, 15), rect: rect(n) })),
              windowScrollY: window.scrollY,
            };
          })()
        `)

        const themeName = isDark ? 'Dark' : 'Light'
        const baseName = `Classic_${themeName}_${vp.name}`

        // Capture initial screenshot
        await captureScreenshot(`${baseName}_01_top.png`)

        // Assertions
        const assertions = []
        // 1. Sidebar is anchored at x:0, y:0
        const sb = metrics.sidebar
        const sbAnchored = sb && sb.x === 0 && sb.y === 0
        assertions.push({ name: 'Sidebar anchored at (0,0)', pass: sbAnchored, actual: `(${sb?.x}, ${sb?.y})` })

        // 2. Sidebar width is reasonable (>= 70px)
        const sbWidthPass = sb && sb.width >= 70 && sb.width <= 320
        assertions.push({ name: 'Sidebar width in range [70, 320]', pass: sbWidthPass, actual: `${sb?.width}px` })

        // 3. Navigation items strictly vertical
        let navVertical = true
        if (metrics.navItems.length >= 2) {
          for (let i = 0; i < metrics.navItems.length - 1; i++) {
            const current = metrics.navItems[i].rect
            const next = metrics.navItems[i + 1].rect
            if (next.y <= current.y) {
              navVertical = false
              break
            }
          }
        } else {
          navVertical = false
        }
        assertions.push({ name: 'Navigation items vertically stacked', pass: navVertical, actual: `Items: ${metrics.navItemCount}` })

        // 4. Logo within sidebar bounds
        const logoWithin = metrics.logo && sb && (metrics.logo.x + metrics.logo.width <= sb.x + sb.width + 10)
        assertions.push({ name: 'Logo contained within sidebar', pass: logoWithin, actual: `Logo width: ${metrics.logo?.width}, SB width: ${sb?.width}` })

        // 5. Quote within sidebar bounds
        const quoteWithin = !metrics.quote || (sb && (metrics.quote.x + metrics.quote.width <= sb.x + sb.width + 10))
        assertions.push({ name: 'Quote contained within sidebar', pass: quoteWithin, actual: `Quote width: ${metrics.quote?.width}` })

        // 6. Topbar aligned to the right of sidebar
        const topbarAligned = metrics.topbar && sb && metrics.topbar.x >= sb.x + sb.width - 5
        assertions.push({ name: 'Topbar positioned to right of sidebar', pass: topbarAligned, actual: `Topbar x: ${metrics.topbar?.x}, SB width: ${sb?.width}` })

        // 7. AppMain aligned to the right of sidebar
        const mainAligned = metrics.appMain && sb && metrics.appMain.x >= sb.x + sb.width - 5
        assertions.push({ name: 'AppMain positioned to right of sidebar', pass: mainAligned, actual: `Main x: ${metrics.appMain?.x}` })

        // Test Scroll Behavior: Scroll window down
        await evaluate(`window.scrollTo({ top: 600, behavior: 'instant' })`)
        await sleep(300)

        const postScroll = await evaluate(`
          (() => {
            const sidebar = document.querySelector('.icon-sidebar');
            const r = sidebar.getBoundingClientRect();
            return {
              sidebarY: Math.round(r.y),
              windowScrollY: window.scrollY,
            };
          })()
        `)

        // In fixed sidebar, sidebarY remains 0 regardless of scroll!
        const sidebarFixedPass = postScroll.sidebarY === 0
        assertions.push({ name: 'Sidebar anchored during scroll (delta=0)', pass: sidebarFixedPass, actual: `Sidebar Y after scroll: ${postScroll.sidebarY}px` })

        await captureScreenshot(`${baseName}_02_scrolled.png`)

        // Scroll back to top
        await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
        await sleep(200)

        const allPass = assertions.every(a => a.pass)
        testResults.push({
          viewport: vp.name,
          theme: themeName,
          passed: allPass,
          assertions
        })

        console.log(`[Result] ${baseName}: ${allPass ? 'PASSED ALL ASSERTIONS' : 'FAILED'}`)
        if (!allPass) {
          assertions.filter(a => !a.pass).forEach(a => console.error(`   FAIL: ${a.name} (actual: ${a.actual})`))
        }
      }
    }

    // Now test Sidebar Collapse & Expansion toggle at 1440x900
    await setViewport(1440, 900)
    console.log('\n--- Testing Sidebar Collapse & Expand ---')
    const beforeCollapse = await evaluate(`
      (() => {
        const sb = document.querySelector('.icon-sidebar');
        return sb.getBoundingClientRect().width;
      })()
    `)

    // Click toggle button
    await evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.sidebar-toggle-btn') || document.querySelector('.brand-badge');
        if (toggleBtn) toggleBtn.click();
      })()
    `)
    await sleep(600)

    const afterCollapse = await evaluate(`
      (() => {
        const sb = document.querySelector('.icon-sidebar');
        return sb.getBoundingClientRect().width;
      })()
    `)
    await captureScreenshot('Classic_Sidebar_Collapsed_1440x900.png')

    // Click toggle button again to expand
    await evaluate(`
      (() => {
        const toggleBtn = document.querySelector('.sidebar-toggle-btn') || document.querySelector('.brand-badge');
        if (toggleBtn) toggleBtn.click();
      })()
    `)
    await sleep(600)

    const afterExpand = await evaluate(`
      (() => {
        const sb = document.querySelector('.icon-sidebar');
        return sb.getBoundingClientRect().width;
      })()
    `)
    await captureScreenshot('Classic_Sidebar_ReExpanded_1440x900.png')

    const collapseWorked = afterCollapse < beforeCollapse && afterExpand > afterCollapse
    console.log(`Collapse Test: before=${beforeCollapse}px, collapsed=${afterCollapse}px, expanded=${afterExpand}px => ${collapseWorked ? 'PASSED' : 'FAILED'}`)

    ws.close()

    console.log('\n===============================================================')
    console.log('                 FINAL TEST SUITE SUMMARY                      ')
    console.log('===============================================================')
    let totalPass = 0
    for (const r of testResults) {
      console.log(`${r.viewport} | ${r.theme.padEnd(5)} | ${r.passed ? 'PASS' : 'FAIL'}`)
      if (r.passed) totalPass++
    }
    console.log(`Total: ${totalPass}/${testResults.length} test configurations passed.`)
    console.log(`Sidebar Collapse/Expand: ${collapseWorked ? 'PASSED' : 'FAILED'}`)
    console.log('===============================================================')

  } finally {
    chrome.kill()
  }
}

runRecoveryVerification().catch(console.error)
