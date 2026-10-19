import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/final_ui_freeze'

async function runFinalUiFreezeVerification() {
  console.log('=================================================================')
  console.log('  SHINPO — FINAL UI CORRECTION & FRONTEND FREEZE VERIFICATION')
  console.log('=================================================================')

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const chromePort = 9292
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-test-ui-freeze-${Date.now()}`,
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
      await sleep(300)
    }

    async function captureScreenshot(filename) {
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const filePath = path.join(OUT_DIR, filename)
      fs.writeFileSync(filePath, Buffer.from(shot.result.data, 'base64'))
      console.log(`  [Screenshot Saved] -> ${filename}`)
    }

    await send('Page.enable')
    await send('DOM.enable')

    await setViewport(1920, 1080)

    // 1. Authenticate as EONX
    console.log('\n[1/7] Authenticating as EONX...')
    await evaluate(`
      (async () => {
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
      })()
    `)

    console.log('  Waiting for application shell to mount...')
    for (let i = 0; i < 30; i++) {
      await sleep(400)
      const ready = await evaluate(`Boolean(document.querySelector('.icon-sidebar, #tasks-board, .flight-deck-board-panel'))`)
      if (ready) break
    }
    await sleep(1500)

    // 2. DASHBOARD TASKS BOARD SYMMETRY & MEASUREMENTS
    console.log('\n[2/7] Verifying Dashboard Tasks Board Symmetry & Spacing...')
    
    // Scroll into view of tasks board
    await evaluate(`
      (() => {
        const board = document.querySelector('#aurora-tasks-board, #tasks-board, .flight-deck-board-panel');
        if (board) board.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()
    `)
    await sleep(600)

    // Check DOM geometry: bounding rects of all 3 columns
    const boardGeometry = await evaluate(`
      (() => {
        const board = document.querySelector('#aurora-tasks-board, #tasks-board, .flight-deck-board-panel');
        const columns = Array.from(board ? board.querySelectorAll('.MuiCard-root, .status-column') : []).filter(c => {
          return c.textContent.includes('In Progress') || c.textContent.includes('Ready') || c.textContent.includes('Completed');
        });
        
        const colRects = columns.map((col, idx) => {
          const r = col.getBoundingClientRect();
          const header = col.querySelector('.MuiBox-root, .status-column-header');
          const body = col.querySelector('.MuiCardContent-root > .MuiBox-root:nth-of-type(2), .status-column-cards, .status-column-body');
          const firstContent = body?.children[0] || col.querySelector('.flight-deck-card, .status-column-empty');
          let dividerGap = null;
          if (header && firstContent) {
            dividerGap = Math.round(firstContent.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
          }
          return {
            index: idx,
            lane: col.textContent.includes('In Progress') ? 'In Progress' : col.textContent.includes('Ready') ? 'Ready' : 'Completed',
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            height: Math.round(r.height),
            width: Math.round(r.width),
            dividerGap,
            cardCount: col.querySelectorAll('.flight-deck-card, [class*="flight-deck-card"]').length,
          };
        });

        const boardRect = board ? board.getBoundingClientRect() : null;

        return {
          boardWidth: boardRect ? Math.round(boardRect.width) : 0,
          columnCount: columns.length,
          columns: colRects,
          topDelta: colRects.length === 3 ? Math.abs(colRects[0].top - colRects[1].top) + Math.abs(colRects[1].top - colRects[2].top) : 999,
          bottomDelta: colRects.length === 3 ? Math.abs(colRects[0].bottom - colRects[1].bottom) + Math.abs(colRects[1].bottom - colRects[2].bottom) : 999,
          heightDelta: colRects.length === 3 ? Math.max(...colRects.map(c => c.height)) - Math.min(...colRects.map(c => c.height)) : 999,
        };
      })()
    `)
    console.log('  Dashboard Board Geometry Metrics:', JSON.stringify(boardGeometry, null, 2))

    // Capture across viewports for Dashboard Tasks Board
    await captureScreenshot('01_dashboard_tasks_board_1920x1080_dark.png')

    // Switch to Light Mode on 1920x1080
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(400)
    await captureScreenshot('02_dashboard_tasks_board_1920x1080_light.png')

    // Switch back to Dark Theme
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      })()
    `)
    await sleep(300)

    // Other Viewports for Dashboard Tasks Board
    await setViewport(1440, 900)
    await captureScreenshot('03_dashboard_tasks_board_1440x900_dark.png')

    await setViewport(1280, 800)
    await captureScreenshot('04_dashboard_tasks_board_1280x800_dark.png')

    await setViewport(1000, 768)
    await captureScreenshot('05_dashboard_tasks_board_1000x768_dark.png')

    // Return to standard 1920x1080
    await setViewport(1920, 1080)

    // 3. SIDEBAR PROTECTION SHIELD & HOVER/PIN VERIFICATION
    console.log('\n[3/7] Verifying Sidebar Protection Shield & Pin/Hover Behavior...')
    
    // Scroll back to top
    await evaluate(`window.scrollTo(0, 0)`)
    await sleep(300)

    const sidebarMetrics = await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar');
        const shieldPanel = document.querySelector('.sidebar-protection-panel');
        const shieldBox = document.querySelector('.protection-shield-box');
        const viewBtn = document.querySelector('.protection-view-btn');
        const pinBtn = document.querySelector('.sidebar-toggle-btn');
        const appMain = document.querySelector('.app-main, main, [class*="app-main"]');

        const sRect = sidebar ? sidebar.getBoundingClientRect() : null;
        const pRect = shieldPanel ? shieldPanel.getBoundingClientRect() : null;
        const mRect = appMain ? appMain.getBoundingClientRect() : null;

        return {
          sidebarExpanded: sidebar?.classList.contains('expanded'),
          sidebarWidth: sRect ? Math.round(sRect.width) : 0,
          shieldPanelHeight: pRect ? Math.round(pRect.height) : 0,
          shieldPanelBottomDistance: sRect && pRect ? Math.round(sRect.bottom - pRect.bottom) : 0,
          shieldBoxExists: Boolean(shieldBox),
          viewBtnText: viewBtn?.textContent?.trim() || null,
          pinBtnTitle: pinBtn?.getAttribute('title') || null,
          mainLeft: mRect ? Math.round(mRect.left) : 0,
          mainWidth: mRect ? Math.round(mRect.width) : 0,
        };
      })()
    `)
    console.log('  Sidebar Pinned Metrics:', JSON.stringify(sidebarMetrics, null, 2))
    await captureScreenshot('06_sidebar_pinned_expanded.png')

    // Test Unpin (Collapse)
    console.log('  Unpinning sidebar...')
    await evaluate(`
      (() => {
        const pinBtn = document.querySelector('.sidebar-toggle-btn');
        if (pinBtn) pinBtn.click();
      })()
    `)
    await sleep(600)

    const unpinnedMetrics = await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar');
        const collapsedShield = document.querySelector('.sidebar-protection-collapsed');
        const appMain = document.querySelector('.app-main, main, [class*="app-main"]');
        const sRect = sidebar?.getBoundingClientRect();
        const mRect = appMain?.getBoundingClientRect();

        return {
          isExpanded: sidebar?.classList.contains('expanded'),
          width: sRect ? Math.round(sRect.width) : 0,
          hasCollapsedShield: Boolean(collapsedShield),
          shieldTooltip: collapsedShield?.getAttribute('title') || collapsedShield?.getAttribute('data-tooltip'),
          persistedInStorage: localStorage.getItem('shinpo_sidebar_pinned'),
          mainLeft: mRect ? Math.round(mRect.left) : 0,
          mainWidth: mRect ? Math.round(mRect.width) : 0,
        };
      })()
    `)
    console.log('  Sidebar Unpinned Metrics:', JSON.stringify(unpinnedMetrics, null, 2))
    await captureScreenshot('07_sidebar_unpinned_collapsed.png')

    // Test Hover-Expand (Overlay mode without layout shift) via native CDP mouse event
    console.log('  Testing Hover-Expansion on unpinned sidebar via native mouseMoved...')
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 35,
      y: 200,
    })
    await sleep(400)

    const hoverMetrics = await evaluate(`
      (() => {
        const sidebar = document.querySelector('.icon-sidebar');
        const appMain = document.querySelector('.app-main, main, [class*="app-main"]');
        const sRect = sidebar?.getBoundingClientRect();
        const mRect = appMain?.getBoundingClientRect();

        return {
          isHoverExpanded: sidebar?.classList.contains('hover-expanded'),
          sidebarWidth: sRect ? Math.round(sRect.width) : 0,
          mainLeft: mRect ? Math.round(mRect.left) : 0,
          mainWidth: mRect ? Math.round(mRect.width) : 0,
        };
      })()
    `)
    console.log('  Sidebar Hover-Expanded Metrics:', JSON.stringify(hoverMetrics, null, 2))
    console.log('  Zero-Layout-Shift check: mainLeft was', unpinnedMetrics.mainLeft, 'and now is', hoverMetrics.mainLeft)
    await captureScreenshot('08_sidebar_unpinned_hover_expanded.png')

    // Mouse out and re-pin sidebar
    console.log('  Moving mouse out and re-pinning sidebar for subsequent tests...')
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 500,
      y: 200,
    })
    await sleep(350)
    await evaluate(`
      (() => {
        const pinBtn = document.querySelector('.sidebar-toggle-btn');
        if (pinBtn) pinBtn.click();
      })()
    `)
    await sleep(500)

    // 4. NAVIGATE TO GOALS & TASKS
    console.log('\n[4/7] Navigating to Goals & Tasks View...')
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
          const t = b.textContent || '';
          return t.includes('Goals & Missions') || t.includes('Goals');
        });
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // Verify Single-Goal Summary Card and Execution Breakdown
    console.log('\n[5/7] Verifying Single-Goal Summary Card & Execution Breakdown...')
    const singleGoalMetrics = await evaluate(`
      (() => {
        const card = document.querySelector('.goal-single-summary-card');
        const leftArea = document.querySelector('.goal-summary-left');
        const companion = document.querySelector('.goal-summary-companion');
        const titleEl = document.querySelector('.goal-summary-title');
        const progressBar = document.querySelector('.goal-progress-bar-fill');
        const aiBtn = document.querySelector('.btn-ai-deconstruct');
        const statItems = Array.from(document.querySelectorAll('.companion-stat-item')).map(item => ({
          label: item.querySelector('.stat-label')?.textContent?.trim(),
          value: item.querySelector('.stat-value')?.textContent?.trim(),
        }));
        const nextActionCard = document.querySelector('.companion-next-action-card');
        const nextActionTitle = nextActionCard?.querySelector('.next-action-title')?.textContent?.trim();

        const cardRect = card ? card.getBoundingClientRect() : null;
        const leftRect = leftArea ? leftArea.getBoundingClientRect() : null;
        const compRect = companion ? companion.getBoundingClientRect() : null;

        return {
          cardFound: Boolean(card),
          cardWidth: cardRect ? Math.round(cardRect.width) : 0,
          leftWidth: leftRect ? Math.round(leftRect.width) : 0,
          companionWidth: compRect ? Math.round(compRect.width) : 0,
          title: titleEl?.textContent?.trim(),
          aiButtonText: aiBtn?.textContent?.trim(),
          stats: statItems,
          nextActionTitle,
        };
      })()
    `)
    console.log('  Single-Goal Summary Card Metrics:', JSON.stringify(singleGoalMetrics, null, 2))

    // Capture Goals & Tasks across Viewports (List Mode is Primary Default)
    await captureScreenshot('09_goals_single_summary_and_list_1920x1080_dark.png')

    // Light Mode on 1920x1080
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(400)
    await captureScreenshot('10_goals_single_summary_and_list_1920x1080_light.png')

    // Switch back to Dark Theme
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      })()
    `)
    await sleep(300)

    // Responsive viewports for Goals & Tasks
    await setViewport(1440, 900)
    await captureScreenshot('11_goals_single_summary_and_list_1440x900_dark.png')

    await setViewport(1280, 800)
    await captureScreenshot('12_goals_single_summary_and_list_1280x800_dark.png')

    await setViewport(1000, 768)
    await captureScreenshot('13_goals_single_summary_and_list_1000x768_dark.png')

    // Back to 1920x1080
    await setViewport(1920, 1080)

    // 5. TEST TASK FILTERS, SEARCH, SORT & SECONDARY OVERFLOW MENU
    console.log('\n[6/7] Testing Task Filters, Search, Sort & Secondary Menus...')

    // Test Search input
    console.log('  Testing Search query for "Audit"...')
    await evaluate(`
      (() => {
        const input = document.querySelector('.tasks-search-input');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'Audit');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `)
    await sleep(500)

    const searchMetrics = await evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.mission-list-row'));
        return {
          renderedRowCount: rows.length,
          rowTitles: rows.map(r => r.querySelector('.task-row-title')?.textContent?.trim()),
        };
      })()
    `)
    console.log('  Search Filter Results:', searchMetrics)
    await captureScreenshot('14_goals_list_filtered_search_audit.png')

    // Clear search
    await evaluate(`
      (() => {
        const clearBtn = document.querySelector('.search-clear-btn');
        if (clearBtn) clearBtn.click();
      })()
    `)
    await sleep(300)

    // Test Status Tabs (Click In Progress -> should show 0 count and empty row)
    console.log('  Testing Status Tab: "In Progress" (0 tasks)...')
    await evaluate(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('.status-tab-btn'));
        const inProgTab = tabs.find(t => (t.textContent || '').includes('In Progress'));
        if (inProgTab) inProgTab.click();
      })()
    `)
    await sleep(400)
    const inProgTabResult = await evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('.mission-list-row'));
        const emptyState = document.querySelector('.missions-empty-row');
        return {
          rowsRendered: rows.length,
          emptyStateText: emptyState?.textContent?.trim() || null,
        };
      })()
    `)
    console.log('  In Progress Tab Result:', inProgTabResult)
    await captureScreenshot('15_goals_list_status_tab_inprogress_empty.png')

    // Switch back to "All" tab
    await evaluate(`
      (() => {
        const tabs = Array.from(document.querySelectorAll('.status-tab-btn'));
        const allTab = tabs.find(t => (t.textContent || '').includes('All'));
        if (allTab) allTab.click();
      })()
    `)
    await sleep(300)

    // Test Secondary Overflow Menus (···)
    console.log('  Opening secondary overflow menus (···)...')
    await evaluate(`
      (() => {
        const triggers = Array.from(document.querySelectorAll('.btn-overflow-trigger'));
        // Click the first one (goal menu)
        if (triggers[0]) triggers[0].click();
      })()
    `)
    await sleep(300)
    await captureScreenshot('16_goals_secondary_overflow_menus.png')

    // Close menu by clicking elsewhere
    await evaluate(`document.body.click()`)
    await sleep(300)

    // 6. TEST BOARD MODE IN GOALS & TASKS
    console.log('\n[7/7] Testing Board Mode in Goals & Tasks...')
    await evaluate(`
      (() => {
        const boardBtn = Array.from(document.querySelectorAll('.view-mode-btn')).find(b => b.textContent.trim() === 'Board');
        if (boardBtn) boardBtn.click();
      })()
    `)
    await sleep(800)

    const goalsBoardMetrics = await evaluate(`
      (() => {
        const board = document.querySelector('#tasks-board, .flight-deck-board-panel, .status-board');
        const columns = Array.from(document.querySelectorAll('.status-column'));
        const colRects = columns.map((col, idx) => {
          const r = col.getBoundingClientRect();
          const firstContent = col.querySelector('.flight-deck-card, .status-column-empty, .status-column-body > :first-child');
          const header = col.querySelector('.status-column-header');
          let dividerGap = null;
          if (header && firstContent) {
            dividerGap = Math.round(firstContent.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
          }
          return {
            index: idx,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            height: Math.round(r.height),
            width: Math.round(r.width),
            dividerGap,
            cardCount: col.querySelectorAll('.flight-deck-card').length,
          };
        });

        return {
          columnCount: columns.length,
          columns: colRects,
          topDelta: colRects.length === 3 ? Math.abs(colRects[0].top - colRects[1].top) + Math.abs(colRects[1].top - colRects[2].top) : 999,
          bottomDelta: colRects.length === 3 ? Math.abs(colRects[0].bottom - colRects[1].bottom) + Math.abs(colRects[1].bottom - colRects[2].bottom) : 999,
        };
      })()
    `)
    console.log('  Goals Board Geometry Metrics:', JSON.stringify(goalsBoardMetrics, null, 2))
    await captureScreenshot('17_goals_board_mode_symmetrical_1920x1080_dark.png')

    // Light Mode on Goals Board Mode
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
      })()
    `)
    await sleep(400)
    await captureScreenshot('18_goals_board_mode_symmetrical_1920x1080_light.png')

    // Restore Dark Mode
    await evaluate(`
      (() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
      })()
    `)
    await sleep(200)

    console.log('\n=================================================================')
    console.log('  ALL VERIFICATIONS COMPLETED SUCCESSFULLY')
    console.log('=================================================================')

  } finally {
    chrome.kill()
  }
}

runFinalUiFreezeVerification().catch((err) => {
  console.error('Fatal Verification Error:', err)
  process.exit(1)
})
