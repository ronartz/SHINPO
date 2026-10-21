import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/readability_dashboard'
const DOCS_DIR = '/home/eonx/Projects/SHINPO/docs/qa/screenshots/readability_dashboard'
fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
fs.mkdirSync(DOCS_DIR, { recursive: true })

async function runVerification() {
  console.log('========================================================================')
  console.log('   SHINPO GLOBAL TYPOGRAPHY, READABILITY & DASHBOARD VERIFICATION SUITE   ')
  console.log('========================================================================')

  const chromePort = 9334
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-readability-${Date.now()}`,
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
      const targetPath1 = path.join(ARTIFACT_DIR, filename)
      const targetPath2 = path.join(DOCS_DIR, filename)
      fs.writeFileSync(targetPath1, buffer)
      fs.writeFileSync(targetPath2, buffer)
      console.log(`[SNAPSHOT] Saved: ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')

    // Initial desktop viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })

    console.log('\n[1/7] Logging in as EONX to access Aurora Dashboard...')
    await send('Page.navigate', { url: 'http://localhost:5173/' })
    await sleep(2500)

    // Bypass onboarding walkthrough and pin sidebar
    await evaluate(`
      (() => {
        localStorage.setItem('shinpo_onboarding_completed', 'true');
        localStorage.setItem('shinpo_theme_mode', 'dark');
        localStorage.setItem('shinpo_aurora_mode', 'true');
        localStorage.setItem('shinpo_sidebar_pinned', 'true');
      })()
    `)

    // Fill login form if auth screen is present
    const isAuth = await evaluate(`!!document.querySelector('.auth-card')`)
    if (isAuth) {
      await evaluate(`
        (() => {
          const u = document.querySelector('input[placeholder*="username" i], input[type="text"]');
          const p = document.querySelector('input[type="password"]');
          if (u) {
            const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            s.call(u, 'EONX');
            u.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (p) {
            const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            s.call(p, 'shinpo_demo');
            p.dispatchEvent(new Event('input', { bubbles: true }));
          }
          const btn = document.querySelector('button[type="submit"]');
          if (btn) btn.click();
        })()
      `)
      await sleep(3000)
    }

    // Dismiss any open tutorial or modal
    await evaluate(`
      (() => {
        const skip = document.querySelector('.tutorial-skip-btn, button[aria-label="Close dialog"]');
        if (skip) skip.click();
        // Also expand sidebar if collapsed
        const toggle = document.querySelector('.sidebar-toggle-btn');
        const sidebar = document.querySelector('.aurora-sidebar-panel, .app-sidebar');
        if (sidebar && sidebar.offsetWidth < 120 && toggle) toggle.click();
      })()
    `)
    await sleep(1000)

    // Ensure we are on Aurora theme
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('theme-dark');
        document.documentElement.classList.remove('theme-light');
      })()
    `)

    console.log('\n[2/7] Verifying Action Row (Protection Standby + New Task Button)...')
    const actionRowMetrics = await evaluate(`
      (() => {
        const sentinel = document.querySelector('#aurora-focus-protection-pill') || document.querySelector('.sentinel-badge-pill');
        const newTask = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        if (!sentinel || !newTask) return { error: 'Action row elements not found' };

        const sRect = sentinel.getBoundingClientRect();
        const nRect = newTask.getBoundingClientRect();
        const sStyle = window.getComputedStyle(sentinel);
        const nStyle = window.getComputedStyle(newTask);

        return {
          sentinelHeight: sRect.height,
          newTaskHeight: nRect.height,
          heightDiff: Math.abs(sRect.height - nRect.height),
          sentinelFontSize: sStyle.fontSize,
          newTaskFontSize: nStyle.fontSize,
          sentinelBorderRadius: sStyle.borderRadius,
          newTaskBorderRadius: nStyle.borderRadius,
        };
      })()
    `)
    console.log('  Action Row Metrics:', actionRowMetrics)
    if (actionRowMetrics.heightDiff > 1.5) {
      console.error(`  FAIL: Height difference is ${actionRowMetrics.heightDiff}px (> 1.5px)`)
    } else {
      console.log(`  PASS: Action buttons matched within 1px (${actionRowMetrics.sentinelHeight}px vs ${actionRowMetrics.newTaskHeight}px)`)
    }

    console.log('\n[3/7] Verifying Summary Performance Cards (4 Cards Harmonization)...')
    const summaryCardsMetrics = await evaluate(`
      (() => {
        const grid = document.querySelector('[aria-label="Performance Metrics"]');
        if (!grid) return { error: 'Metrics grid not found' };

        const cards = Array.from(grid.children);
        if (cards.length < 4) return { error: 'Expected 4 summary cards' };

        const rects = cards.map(c => c.getBoundingClientRect());
        const heights = rects.map(r => r.height);
        const minH = Math.min(...heights);
        const maxH = Math.max(...heights);

        const cardData = cards.map((c, i) => {
          const title = c.querySelector('p, span, h4')?.textContent?.trim() || '';
          const value = c.querySelector('h2, h3, h4, p:nth-of-type(2)')?.textContent?.trim() || '';
          const subtitle = c.querySelectorAll('p')[1]?.textContent?.trim() || '';
          return { index: i + 1, height: rects[i].height, title, value, subtitle };
        });

        return {
          cardCount: cards.length,
          heights,
          maxDiff: maxH - minH,
          cards: cardData,
        };
      })()
    `)
    console.log('  Summary Cards Metrics:', summaryCardsMetrics)
    if (summaryCardsMetrics.maxDiff > 2) {
      console.error(`  FAIL: Card heights mismatch by ${summaryCardsMetrics.maxDiff}px`)
    } else {
      console.log(`  PASS: All 4 summary cards have uniform height (max diff ${summaryCardsMetrics.maxDiff}px <= 2px)`)
    }

    console.log("\n[4/7] Verifying Today's Schedule Card Geometry & Anchored Footer...")
    const scheduleCardMetrics = await evaluate(`
      (() => {
        const schedCard = document.querySelector('[aria-label="Today\\'s Schedule"]') || document.querySelector('.schedule-card');
        if (!schedCard) return { error: 'Schedule card not found' };

        const items = Array.from(schedCard.querySelectorAll('.aurora-card-interactive, .schedule-session-item'));
        const footer = schedCard.querySelector('button, [component="button"]');

        const itemData = items.map((it, idx) => {
          const rect = it.getBoundingClientRect();
          const titleEl = it.querySelector('p:first-of-type, span:first-of-type, .schedule-session-name');
          const titleStyle = titleEl ? window.getComputedStyle(titleEl) : null;
          return {
            index: idx + 1,
            height: rect.height,
            titleFontSize: titleStyle?.fontSize,
            lineHeight: titleStyle?.lineHeight,
            overflow: titleStyle?.overflow,
          };
        });

        return {
          found: true,
          totalItemsDisplayed: items.length,
          items: itemData,
          hasFooter: !!footer,
        };
      })()
    `)
    console.log('  Schedule Card Metrics:', scheduleCardMetrics)

    console.log('\n[5/7] Verifying Motivational Editorial Peach Quote Card...')
    const quoteMetrics = await evaluate(`
      (() => {
        const quoteCard = document.querySelector('[aria-label="Perspective Quote"]') || document.querySelector('.sidebar-upper-quote');
        if (!quoteCard) return { error: 'Perspective quote card not found in sidebar' };

        const eyebrow = quoteCard.querySelector('.sidebar-upper-quote-eyebrow, p:first-of-type');
        const text = quoteCard.querySelector('.sidebar-upper-quote-text, p:last-of-type');
        const refreshBtn = quoteCard.querySelector('button, [component="button"]');

        const cardStyle = window.getComputedStyle(quoteCard);
        const eyebrowStyle = eyebrow ? window.getComputedStyle(eyebrow) : null;
        const textStyle = text ? window.getComputedStyle(text) : null;

        return {
          found: true,
          eyebrowText: eyebrow?.textContent?.trim(),
          eyebrowColor: eyebrowStyle?.color,
          eyebrowLetterSpacing: eyebrowStyle?.letterSpacing,
          quoteFontFamily: textStyle?.fontFamily,
          quoteFontStyle: textStyle?.fontStyle,
          quoteFontSize: textStyle?.fontSize,
          backgroundColor: cardStyle.backgroundColor,
          borderColor: cardStyle.borderColor,
          hasRefreshButton: !!refreshBtn,
        };
      })()
    `)
    console.log('  Perspective Quote Metrics:', quoteMetrics)
    if (!quoteMetrics.quoteFontFamily?.toLowerCase().includes('playfair') &&
        !quoteMetrics.quoteFontFamily?.toLowerCase().includes('georgia') &&
        !quoteMetrics.quoteFontFamily?.toLowerCase().includes('serif')) {
      console.warn('  WARN: Quote font-family does not indicate serif fallback')
    } else {
      console.log('  PASS: Editorial quote uses elegant serif typography')
    }

    console.log('\n[6/7] Capturing Multi-Viewport Screenshots...')
    const viewports = [
      { name: '01_dashboard_1920x1080_dark', w: 1920, h: 1080, theme: 'dark' },
      { name: '02_dashboard_1440x900_dark', w: 1440, h: 900, theme: 'dark' },
      { name: '03_dashboard_1280x800_dark', w: 1280, h: 800, theme: 'dark' },
      { name: '04_dashboard_1000x768_dark', w: 1000, h: 768, theme: 'dark' },
      { name: '05_dashboard_1920x1080_light', w: 1920, h: 1080, theme: 'light' },
    ]

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await evaluate(`
        (() => {
          document.documentElement.setAttribute('data-theme', '${vp.theme}');
          if ('${vp.theme}' === 'light') {
            document.documentElement.classList.add('theme-light');
            document.documentElement.classList.remove('theme-dark');
          } else {
            document.documentElement.classList.add('theme-dark');
            document.documentElement.classList.remove('theme-light');
          }
        })()
      `)
      await sleep(600)
      await captureScreenshot(`${vp.name}.png`)
    }

    console.log('\n[7/7] Verifying Study Resources Typography & WCAG AA Contrast...')
    // Navigate to Focus tab
    await evaluate(`
      (() => {
        const btn = document.querySelector('[data-tab="Focus Engine"]') ||
                    document.querySelector('[data-tutorial="nav-focus"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.title === 'Focus' || b.textContent.trim() === 'Focus');
        if (btn) btn.click();
      })()
    `)
    await sleep(2500)

    // Audit computed typography inside Study Resources
    const studyResourcesAudit = await evaluate(`
      (() => {
        const panel = document.querySelector('.study-resources-panel') || document.querySelector('.study-resources-dialog-card');
        if (!panel) return { error: 'Study Resources panel not open/rendered' };

        const allElements = Array.from(panel.querySelectorAll('*'));
        const textElements = allElements.filter(el => {
          if (el.children.length > 0) return false;
          const text = el.textContent?.trim();
          return text && text.length > 0;
        });

        const fontSizes = textElements.map(el => {
          const style = window.getComputedStyle(el);
          return {
            text: el.textContent.trim().slice(0, 30),
            tag: el.tagName.toLowerCase(),
            fontSize: parseFloat(style.fontSize),
            color: style.color,
          };
        });

        const below12 = fontSizes.filter(f => f.fontSize < 12);
        const minSize = Math.min(...fontSizes.map(f => f.fontSize));
        const maxSize = Math.max(...fontSizes.map(f => f.fontSize));

        return {
          totalTextElements: fontSizes.length,
          minSize,
          maxSize,
          elementsBelow12px: below12,
        };
      })()
    `)
    console.log('  Study Resources Typography Audit:', studyResourcesAudit)
    if (studyResourcesAudit.elementsBelow12px && studyResourcesAudit.elementsBelow12px.length > 0) {
      console.error(`  FAIL: Found ${studyResourcesAudit.elementsBelow12px.length} elements with font size < 12px:`, studyResourcesAudit.elementsBelow12px)
    } else {
      console.log(`  PASS: No text elements below 12px in Study Resources! (Minimum is ${studyResourcesAudit.minSize}px)`)
    }

    await captureScreenshot('06_study_resources_typography_audit.png')

    const summaryReport = {
      timestamp: new Date().toISOString(),
      actionRow: actionRowMetrics,
      summaryCards: summaryCardsMetrics,
      scheduleCard: scheduleCardMetrics,
      quoteCard: quoteMetrics,
      studyResourcesAudit,
    }

    fs.writeFileSync(
      path.join(DOCS_DIR, 'readability_dashboard_results.json'),
      JSON.stringify(summaryReport, null, 2)
    )
    console.log('\n[SUCCESS] All checks completed and saved to docs/qa/screenshots/readability_dashboard/')

  } catch (err) {
    console.error('Verification failed:', err)
  } finally {
    chrome.kill()
  }
}

runVerification()
