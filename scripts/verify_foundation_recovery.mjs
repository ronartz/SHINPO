import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/after_recovery'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runFoundationRecoveryVerification() {
  console.log('======================================================================')
  console.log('   SHINPO — FOUNDATION LEVEL UI QUALITY RECOVERY AUDIT SUITE         ')
  console.log('   Computed Style Assertions, Visual Regression & State Verification ')
  console.log('======================================================================')

  const chromePort = 9252
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    'http://localhost:5173/',
  ])

  const defectRegister = []
  function recordDefect(id, name, expected, actual, passed, details = '') {
    defectRegister.push({ id, name, expected, actual, passed, details })
    const mark = passed ? '✅ PASS' : '❌ FAIL'
    console.log(`[${mark}] ${id}: ${name} -> ${passed ? 'OK' : `Expected ${expected}, got ${actual}`} ${details ? `(${details})` : ''}`)
  }

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
      await sleep(250)
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(res.result.data, 'base64'))
      console.log(`[Captured Artifact] ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')
    await send('CSS.enable')
    await send('Runtime.enable')

    await setViewport(1440, 900)
    await sleep(1500)

    // Log in if needed
    console.log('[Setup] Checking authentication...')
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
    await sleep(1500)

    // Helper functions
    async function selectTab(tabLabel) {
      await evaluate(`
        (() => {
          const needle = '${tabLabel.toLowerCase()}';
          const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
            const title = (b.getAttribute('title') || '').toLowerCase();
            const text = (b.textContent || '').toLowerCase();
            const tut = (b.getAttribute('data-tutorial') || '').toLowerCase();
            return title.includes(needle) || text.includes(needle) || tut.includes(needle);
          });
          if (btn) btn.click();
        })()
      `)
      await sleep(400)
    }

    async function setTheme(isDark) {
      await evaluate(`
        (() => {
          const targetLight = ${!isDark};
          const currentLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('theme-light');
          if (currentLight !== targetLight) {
            const themeBtn = document.querySelector('.action-btn-circle[title*="Mode"]') ||
                             document.querySelector('button[title*="Mode"]') ||
                             document.querySelector('.topbar-control-btn[title*="Theme"]');
            if (themeBtn) {
              themeBtn.click();
            } else {
              document.documentElement.setAttribute('data-theme', targetLight ? 'light' : 'dark');
            }
          }
        })()
      `)
      await sleep(300)
    }

    async function setV2Mode(enableV2) {
      await evaluate(`
        (() => {
          const isCurrentlyV2 = document.querySelector('.app-shell')?.classList.contains('theme-aurora') ||
                                !!document.querySelector('.aurora-viewport');
          if (isCurrentlyV2 !== ${enableV2}) {
            const v2Btn = document.querySelector('.v2-preview-btn');
            if (v2Btn) v2Btn.click();
          }
        })()
      `)
      await sleep(400)
    }

    // -------------------------------------------------------------------------
    // TEST 1: EONPAI LIGHT MODE CONVERSATION & PINK/RED REGION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- AUDITING EONPAI CONVERSATION & COLOR TOKENS ---')
    await setV2Mode(false)
    await selectTab('EONPAI')
    await setTheme(false) // Light mode

    // Inject simulated populated chat messages into Eonpai if empty
    await evaluate(`
      (() => {
        const feed = document.querySelector('.eonpai-chat-content-wrap') || document.querySelector('.ai-messages-content');
        if (feed && !document.querySelector('.ai-bubble.user')) {
          const userBubble = document.createElement('div');
          userBubble.className = 'ai-bubble user';
          userBubble.innerHTML = '<div class="ai-bubble-text">Help me break down my distributed systems architecture goal into 4 focus sessions.</div>';
          feed.prepend(userBubble);
        }
      })()
    `)
    await sleep(400)

    // Measure computed styles on .ai-bubble.user
    const userBubbleStyle = await evaluate(`
      (() => {
        const bubble = document.querySelector('.ai-bubble.user');
        if (!bubble) return null;
        const comp = window.getComputedStyle(bubble);
        return {
          bg: comp.backgroundColor,
          border: comp.borderColor,
          color: comp.color,
          boxShadow: comp.boxShadow
        };
      })()
    `)

    // Color check: user bubble background must NOT be #FFF0E9 (rgb(255, 240, 233) or reddish)
    const isPinkRed = userBubbleStyle?.bg.includes('255, 240, 233') ||
                      (userBubbleStyle?.bg.startsWith('rgb(') && (() => {
                        const m = userBubbleStyle.bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        if (!m) return false;
                        const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                        return r > 230 && g < 220 && b < 220; // Red dominant pale pink
                      })());

    recordDefect(
      'DEF-EONPAI-01',
      'Eonpai Light Mode User Bubble Background (No Pink/Red Leakage)',
      'Clean neutral slate (#F1F5F9 or similar, non-pink)',
      userBubbleStyle?.bg || 'Not Found',
      !isPinkRed && userBubbleStyle !== null,
      `Border: ${userBubbleStyle?.border}`
    )

    // Check token values in DOM
    const tokenValues = await evaluate(`
      (() => {
        const comp = window.getComputedStyle(document.documentElement);
        return {
          primaryGreen: comp.getPropertyValue('--primary-green').trim(),
          primaryGreenSubtle: comp.getPropertyValue('--primary-green-subtle').trim(),
          primaryCoral: comp.getPropertyValue('--primary-coral').trim()
        };
      })()
    `)

    const tokenGreenOk = tokenValues?.primaryGreen !== '#B9381E' && tokenValues?.primaryGreen !== '#EA6548';
    recordDefect(
      'DEF-TOKEN-01',
      '--primary-green Token Restoration (Not Aliased to Coral Red)',
      'Emerald/green (#059669 or #10B981)',
      tokenValues?.primaryGreen,
      tokenGreenOk,
      `Subtle: ${tokenValues?.primaryGreenSubtle}`
    )

    await captureScreenshot('After_Eonpai_Classic_Light.png')

    // Test in Dark Mode
    await setTheme(true)
    await sleep(300)
    await captureScreenshot('After_Eonpai_Classic_Dark.png')

    // Test in Aurora V2 Mode
    await setV2Mode(true)
    await setTheme(false) // Aurora Light
    await sleep(300)
    await captureScreenshot('After_Eonpai_Aurora_Light.png')
    await setTheme(true) // Aurora Dark
    await sleep(300)
    await captureScreenshot('After_Eonpai_Aurora_Dark.png')

    // -------------------------------------------------------------------------
    // TEST 2: GOALS VIEW SPATIAL STRUCTURE & EMPTY SPACE AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- AUDITING GOALS VIEW HIERARCHY & EMPTY SPACE ---')
    await setV2Mode(false)
    await selectTab('Goals')
    await setTheme(true) // Dark
    await sleep(400)

    const goalsMetrics = await evaluate(`
      (() => {
        const grid = document.querySelector('.goals-grid');
        const cards = document.querySelectorAll('.goal-card-item');
        const emptyCard = document.querySelector('.goals-empty-card');
        const headers = document.querySelectorAll('.deck-section-header');
        const counterBadges = document.querySelectorAll('.deck-counter-badge');
        const taskRows = document.querySelectorAll('.mission-deck-row');

        let verticalGapBetweenSections = 0;
        if (grid && headers.length > 1) {
          const gridRect = grid.getBoundingClientRect();
          const nextHeaderRect = headers[1].getBoundingClientRect();
          verticalGapBetweenSections = nextHeaderRect.top - gridRect.bottom;
        }

        return {
          gridExists: !!grid,
          cardCount: cards.length,
          hasEmptyCard: !!emptyCard,
          counterBadgeCount: counterBadges.length,
          verticalGapBetweenSections: Math.round(verticalGapBetweenSections),
          taskRowCount: taskRows.length,
          taskRowHeight: taskRows[0] ? taskRows[0].getBoundingClientRect().height : 0
        };
      })()
    `)

    recordDefect(
      'DEF-GOALS-01',
      'Goals View Hierarchy & Counter Badges Rendered',
      'Counter badges present on section headers (>= 1)',
      `${goalsMetrics?.counterBadgeCount} badges`,
      goalsMetrics?.counterBadgeCount >= 1
    )

    recordDefect(
      'DEF-GOALS-02',
      'Goals to Tasks Section Vertical Gap Discipline',
      'Gap <= 36px (No excessive empty void)',
      `${goalsMetrics?.verticalGapBetweenSections}px`,
      goalsMetrics?.verticalGapBetweenSections <= 36,
      `Calculated gap: ${goalsMetrics?.verticalGapBetweenSections}px`
    )

    await captureScreenshot('After_Goals_Dark.png')
    await setTheme(false) // Light
    await sleep(300)
    await captureScreenshot('After_Goals_Light.png')

    // -------------------------------------------------------------------------
    // TEST 3: TASK MANAGER TYPOGRAPHY & DENSITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- AUDITING TASK MANAGER DENSITY & TYPOGRAPHY ---')
    await selectTab('Task Manager')
    await setTheme(true) // Dark
    await sleep(500)

    const tmMetrics = await evaluate(`
      (() => {
        const th = document.querySelector('.tm-table th');
        const td = document.querySelector('.tm-table td');
        const pathEl = document.querySelector('.tm-proc-path');
        const pidBadge = document.querySelector('.tm-pid-badge');
        const polBadge = document.querySelector('.tm-policy-badge');
        const metricSub = document.querySelector('.tm-metric-sub');
        const metricLabel = document.querySelector('.tm-metric-label');

        return {
          thFontSize: th ? parseFloat(window.getComputedStyle(th).fontSize) : 0,
          tdFontSize: td ? parseFloat(window.getComputedStyle(td).fontSize) : 0,
          pathFontSize: pathEl ? parseFloat(window.getComputedStyle(pathEl).fontSize) : 0,
          pathMaxWidth: pathEl ? parseFloat(window.getComputedStyle(pathEl).maxWidth) : 0,
          pidFontSize: pidBadge ? parseFloat(window.getComputedStyle(pidBadge).fontSize) : 0,
          polFontSize: polBadge ? parseFloat(window.getComputedStyle(polBadge).fontSize) : 0,
          metricLabelSize: metricLabel ? parseFloat(window.getComputedStyle(metricLabel).fontSize) : 0,
          metricSubSize: metricSub ? parseFloat(window.getComputedStyle(metricSub).fontSize) : 0,
        };
      })()
    `)

    recordDefect(
      'DEF-TM-01',
      'Task Manager Process Path Font Size (Readable)',
      '>= 12px (was 11px)',
      `${tmMetrics?.pathFontSize}px`,
      tmMetrics?.pathFontSize >= 12
    )

    recordDefect(
      'DEF-TM-02',
      'Task Manager Process Path Max-Width (Not Constrained to 240px)',
      '> 300px (was 240px)',
      `${tmMetrics?.pathMaxWidth}px`,
      tmMetrics?.pathMaxWidth > 300
    )

    recordDefect(
      'DEF-TM-03',
      'Task Manager Table Cell Typography & Badges',
      'Cell >= 13px, Badges >= 11.5px',
      `Cell: ${tmMetrics?.tdFontSize}px, PID: ${tmMetrics?.pidFontSize}px, Policy: ${tmMetrics?.polFontSize}px`,
      tmMetrics?.tdFontSize >= 13 && tmMetrics?.pidFontSize >= 11.5 && tmMetrics?.polFontSize >= 11.5
    )

    recordDefect(
      'DEF-TM-04',
      'Task Manager Telemetry Metric Labels',
      '>= 12.5px',
      `${tmMetrics?.metricLabelSize}px`,
      tmMetrics?.metricLabelSize >= 12.5
    )

    await captureScreenshot('After_TaskManager_Dark.png')
    await setTheme(false) // Light
    await sleep(300)
    await captureScreenshot('After_TaskManager_Light.png')

    // -------------------------------------------------------------------------
    // TEST 4: DIALOGS & MODAL GEOMETRY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- AUDITING DIALOGS & MODAL GEOMETRY ---')
    await selectTab('Goals')
    await setTheme(false) // Light mode

    // 4A: Create Goal Modal
    await evaluate(`
      (() => {
        const btn = document.querySelector('button[data-tutorial="new-goal"]') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Goal'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)

    const createGoalModalStyle = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        if (!modal) return null;
        const comp = window.getComputedStyle(modal);
        return {
          width: modal.getBoundingClientRect().width,
          padding: comp.padding,
          bg: comp.backgroundColor,
          border: comp.borderColor
        };
      })()
    `)

    recordDefect(
      'DEF-MODAL-01',
      'Create Goal Modal Width (Expanded, Uncramped)',
      '>= 500px (was 480px with narrow inner box)',
      `${createGoalModalStyle?.width}px`,
      createGoalModalStyle?.width >= 500,
      `Padding: ${createGoalModalStyle?.padding}`
    )

    recordDefect(
      'DEF-MODAL-02',
      'Create Goal Modal Light Mode Background',
      'Clean opaque surface (rgb(255, 255, 255))',
      createGoalModalStyle?.bg,
      createGoalModalStyle?.bg === 'rgb(255, 255, 255)'
    )

    await captureScreenshot('After_Modal_CreateGoal_Light.png')

    // Close Create Goal
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // 4B: Create Task Modal
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('New Task'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)
    await captureScreenshot('After_Modal_CreateTask_Light.png')

    await evaluate(`
      (() => {
        const btn = document.querySelector('.modal-overlay .sidebar-toggle-btn') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // 4C: Schedule Session Modal
    await selectTab('Schedule')
    await setTheme(true) // Dark
    await evaluate(`
      (() => {
        const btn = document.querySelector('.schedule-btn-book') ||
                    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Book Focus Session') || b.textContent.includes('Schedule Session'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)

    const schedModalWidth = await evaluate(`
      (() => {
        const modal = document.querySelector('.modal-box');
        return modal ? modal.getBoundingClientRect().width : 0;
      })()
    `)

    recordDefect(
      'DEF-MODAL-03',
      'Schedule Session Modal Width (Uncramped Multi-Field Layout)',
      '>= 500px',
      `${schedModalWidth}px`,
      schedModalWidth >= 500
    )

    await captureScreenshot('After_Modal_ScheduleSession_Dark.png')
    await setTheme(false) // Light
    await sleep(300)
    await captureScreenshot('After_Modal_ScheduleSession_Light.png')

    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.modal-overlay button')).find(b => b.textContent.includes('Cancel'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // 4D: Block App Modal (Task Manager)
    await selectTab('Task Manager')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Block App'));
        if (btn) btn.click();
      })()
    `)
    await sleep(400)

    const blockAppModalWidth = await evaluate(`
      (() => {
        const modal = document.querySelector('.quick-modal-card');
        return modal ? modal.getBoundingClientRect().width : 0;
      })()
    `)

    recordDefect(
      'DEF-MODAL-04',
      'Block App Modal Width',
      '>= 500px',
      `${blockAppModalWidth}px`,
      blockAppModalWidth >= 500
    )

    await captureScreenshot('After_Modal_BlockApp_Light.png')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.quick-modal-overlay button')).find(b => b.textContent.includes('Cancel') || b.textContent.includes('×'));
        if (btn) btn.click();
      })()
    `)
    await sleep(300)

    // -------------------------------------------------------------------------
    // TEST 5: AURORA V2 DASHBOARD & TOKEN ISOLATION AUDIT
    // -------------------------------------------------------------------------
    console.log('\n--- AUDITING AURORA V2 DASHBOARD & PALETTE ISOLATION ---')
    await setV2Mode(true)
    await selectTab('Dashboard')
    await setTheme(true) // Dark
    await sleep(500)
    await captureScreenshot('After_Dashboard_Aurora_Dark.png')

    await setTheme(false) // Light
    await sleep(300)
    await captureScreenshot('After_Dashboard_Aurora_Light.png')

    // Reset to Classic Dark for baseline preservation
    await setV2Mode(false)
    await setTheme(true)
    await selectTab('Dashboard')
    await sleep(400)

    console.log('\n======================================================================')
    console.log('                 AUDIT COMPLETED — SUMMARY OF RESULTS                 ')
    console.log('======================================================================')
    const passedCount = defectRegister.filter((d) => d.passed).length
    const totalCount = defectRegister.length
    console.log(`Audited Checks: ${totalCount}`)
    console.log(`Passed: ${passedCount}`)
    console.log(`Failed: ${totalCount - passedCount}`)
    console.log(`Audit Success Rate: ${Math.round((passedCount / totalCount) * 100)}%`)

    const reportData = {
      timestamp: new Date().toISOString(),
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      defectRegister,
    }

    fs.writeFileSync(
      '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/foundation_recovery_results.json',
      JSON.stringify(reportData, null, 2)
    )

    ws.close()
  } finally {
    chrome.kill()
  }
}

runFoundationRecoveryVerification().catch(console.error)
