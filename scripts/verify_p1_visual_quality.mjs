import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const OUT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/p1_correction'
fs.mkdirSync(OUT_DIR, { recursive: true })

async function runVisualQualityVerification() {
  console.log('================================================================')
  console.log('   SHINPO P1 VISUAL & RESPONSE QUALITY VERIFICATION SUITE       ')
  console.log('================================================================')

  const chromePort = 9295
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${chromePort}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-extensions',
    `--user-data-dir=/tmp/chrome-p1-qa-${Date.now()}`,
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

    console.log('\n[1/6] Authenticating test session...')
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
    await sleep(2500)

    console.log('\n[2/6] Verifying DEFECT 3: Dashboard Clock Silhouette & Geometry...')
    const clockMetrics = await evaluate(`
      (() => {
        const clock = document.querySelector('.dashboard-live-clock') || document.querySelector('.aurora-capsule-clock');
        if (!clock) return { found: false };
        const rect = clock.getBoundingClientRect();
        const style = window.getComputedStyle(clock);
        const dividers = clock.querySelectorAll('.capsule-divider');
        const secondsEl = clock.querySelector('.capsule-seconds');
        const strandedText = Array.from(clock.querySelectorAll('*'))
          .map(el => el.textContent.trim())
          .filter(t => t === '12H' || t === 'MODE');

        return {
          found: true,
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          dividerCount: dividers.length,
          secondsVisible: !!secondsEl,
          strandedCount: strandedText.length,
          fontVariantNumeric: style.fontVariantNumeric,
          ariaLabel: clock.getAttribute('aria-label') || '',
          text: clock.textContent.replace(/\\s+/g, ' ').trim()
        };
      })()
    `)
    console.log('Clock Inspection Metrics:', clockMetrics)

    console.log('\n[3/6] Verifying DEFECT 2: Today Schedule Alignment & Deduplication...')
    const scheduleMetrics = await evaluate(`
      (() => {
        const scheduleCard = document.querySelector('[aria-label="Today\\'s Schedule"]');
        if (!scheduleCard) return { foundCard: false };

        const rows = Array.from(scheduleCard.querySelectorAll('.aurora-card-interactive')).map(item => {
          const style = window.getComputedStyle(item);
          const text = item.textContent.replace(/\\s+/g, ' ').trim();
          const titleAttr = item.getAttribute('title') || '';
          
          return {
            text,
            titleAttr,
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns
          };
        });

        return {
          foundCard: true,
          itemCount: rows.length,
          rows
        };
      })()
    `)
    console.log('Schedule Inspection Metrics:', scheduleMetrics)
    await captureScreenshot('01_dashboard_overview_dark_1920x1080.png')

    console.log('\n[4/6] Verifying DEFECT 1: EONPAI Message Rendering & Bug Report Flow...')
    // Navigate to EONPAI
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
          const title = b.getAttribute('title') || '';
          const text = b.textContent || '';
          return title.includes('EONPAI') || text.includes('EONPAI') || title.includes('AI Assistant');
        });
        if (btn) btn.click();
      })()
    `)
    await sleep(1500)

    // Start fresh conversation
    console.log('  -> Resetting chat conversation via New Chat button...')
    await evaluate(`
      (() => {
        const newChatBtn = document.querySelector('.eonpai-new-chat-btn');
        if (newChatBtn) newChatBtn.click();
      })()
    `)
    await sleep(1500)

    // Trigger rich Markdown test query
    console.log('  -> Sending rich Markdown query to EONPAI...')
    await evaluate(`
      (() => {
        const textarea = document.querySelector('.eonpai-composer-input');
        const sendBtn = document.querySelector('.eonpai-send-btn');
        if (textarea) {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          setter.call(textarea, 'Explain how SHINPO protects cognitive flow in Markdown format with headings, bullet points, **bold terms**, and a code block.');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          if (sendBtn) {
            sendBtn.click();
          }
        }
      })()
    `)
    await sleep(4000)

    const markdownMetrics = await evaluate(`
      (() => {
        const renderers = document.querySelectorAll('.md-renderer');
        const headings = document.querySelectorAll('.md-heading');
        const boldItems = document.querySelectorAll('.md-strong');
        const codeBlocks = document.querySelectorAll('.md-codeblock');
        const inlineCode = document.querySelectorAll('.md-inline-code');
        const lists = document.querySelectorAll('.md-list');
        const rawAsterisksFound = Array.from(renderers).some(r => r.textContent.includes('**'));

        return {
          rendererCount: renderers.length,
          headingCount: headings.length,
          boldCount: boldItems.length,
          codeBlockCount: codeBlocks.length,
          inlineCodeCount: inlineCode.length,
          listCount: lists.length,
          rawAsterisksFound
        };
      })()
    `)
    console.log('Markdown Inspection Metrics:', markdownMetrics)
    await captureScreenshot('02_eonpai_rich_markdown_dark_1920x1080.png')

    // Trigger Bug Report Draft via Quick Action "Report issue"
    console.log('  -> Triggering Bug Report Draft via Quick Action...')
    await evaluate(`
      (() => {
        const moreBtn = document.querySelector('.eonpai-toggle-more-btn');
        if (moreBtn) moreBtn.click();
      })()
    `)
    await sleep(500)

    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('.eonpai-command-row'));
        const bugBtn = buttons.find(b => b.textContent.includes('Report issue') || b.textContent.includes('Report an issue'));
        if (bugBtn) bugBtn.click();
      })()
    `)
    await sleep(2500)

    const draftMetrics = await evaluate(`
      (() => {
        const draft = document.querySelector('.ai-bug-draft-card');
        if (!draft) return { found: false };
        const chips = Array.from(draft.querySelectorAll('.ai-bug-chip')).map(c => ({
          text: c.textContent.trim(),
          selected: c.classList.contains('selected')
        }));
        const textarea = draft.querySelector('.ai-bug-textarea');
        const telemetryPills = draft.querySelectorAll('.ai-bug-telemetry-pill');
        const details = draft.querySelector('.ai-bug-details');
        const submitBtn = draft.querySelector('.ai-bug-btn-submit');

        return {
          found: true,
          chipCount: chips.length,
          chips,
          hasTextarea: !!textarea,
          telemetryPillCount: telemetryPills.length,
          hasDetails: !!details,
          submitDisabledInitially: submitBtn ? submitBtn.disabled : null
        };
      })()
    `)
    console.log('Bug Report Draft Inspection Metrics:', draftMetrics)
    await captureScreenshot('03_eonpai_bug_report_draft_dark_1920x1080.png')

    // Fill in bug report draft and submit
    console.log('  -> Interacting with Bug Report Draft: selecting chip and entering description...')
    await evaluate(`
      (() => {
        const draft = document.querySelector('.ai-bug-draft-card');
        if (!draft) return false;
        
        // Select 'Focus Engine' chip
        const chips = Array.from(draft.querySelectorAll('.ai-bug-chip'));
        const focusChip = chips.find(c => c.textContent.includes('Focus Engine'));
        if (focusChip) focusChip.click();

        // Enter description
        const textarea = draft.querySelector('.ai-bug-textarea');
        if (textarea) {
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
          setter.call(textarea, 'Focus session timer concluded but did not trigger reflection prompt.');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Submit form
        const submitBtn = draft.querySelector('.ai-bug-btn-submit');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          return true;
        }
        return false;
      })()
    `)
    await sleep(4000)

    const receiptMetrics = await evaluate(`
      (() => {
        const receipts = document.querySelectorAll('.ai-bug-receipt-card');
        const receipt = receipts[receipts.length - 1];
        if (!receipt) return { found: false };
        const idBadge = receipt.querySelector('.ai-bug-id-badge');
        const statusBadge = receipt.querySelector('.ai-bug-badge');
        const featureTag = receipt.querySelector('.ai-bug-feature-tag');
        const summaryDesc = receipt.querySelector('.ai-bug-receipt-desc');
        const details = receipt.querySelector('.ai-bug-details');

        return {
          found: true,
          bugId: idBadge ? idBadge.textContent.trim() : '',
          status: statusBadge ? statusBadge.textContent.trim() : '',
          feature: featureTag ? featureTag.textContent.trim() : '',
          summary: summaryDesc ? summaryDesc.textContent.trim() : '',
          hasDetails: !!details
        };
      })()
    `)
    console.log('Bug Report Receipt Inspection Metrics:', receiptMetrics)
    await captureScreenshot('04_eonpai_bug_report_receipt_dark_1920x1080.png')

    console.log('\n[5/6] Multi-Viewport and Multi-Theme Matrix Verification...')
    const viewports = [
      { width: 1920, height: 1080, name: '1920x1080' },
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1280, height: 800, name: '1280x800' },
      { width: 1000, height: 768, name: '1000x768' },
    ]

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(400)
      await captureScreenshot(`05_eonpai_dark_${vp.name}.png`)
    }

    // Toggle to Light Theme
    console.log('  -> Switching to Light Theme...')
    await evaluate(`
      (() => {
        const themeBtn = document.querySelector('button[title*="Light"], button[title*="Theme"], .theme-toggle-btn');
        if (themeBtn) {
          themeBtn.click();
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })()
    `)
    await sleep(800)

    for (const vp of viewports) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await sleep(400)
      await captureScreenshot(`06_eonpai_light_${vp.name}.png`)
    }

    // Return to Overview for Light Theme validation
    await evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.sidebar-btn')).find(b => {
          const title = b.getAttribute('title') || '';
          const text = b.textContent || '';
          return title.includes('Dashboard') || text.includes('Dashboard') || title.includes('Overview');
        });
        if (btn) btn.click();
      })()
    `)
    await sleep(1000)
    await captureScreenshot('07_dashboard_overview_light_1920x1080.png')

    console.log('\n[6/6] Verifying Classic View Theme...');
    await evaluate(`
      (() => {
        const classicBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Classic View'));
        if (classicBtn) classicBtn.click();
      })()
    `)
    await sleep(1200)
    await captureScreenshot('08_classic_view_overview_light_1920x1080.png')

    // Switch Classic back to dark
    await evaluate(`
      (() => {
        const themeBtn = document.querySelector('button[title*="Dark"], button[title*="Theme"], .theme-toggle-btn');
        if (themeBtn) {
          themeBtn.click();
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      })()
    `)
    await sleep(800)
    await captureScreenshot('09_classic_view_overview_dark_1920x1080.png')

    ws.close()
    console.log('\n================================================================')
    console.log('   ALL P1 VISUAL & RESPONSE QUALITY AUDITS COMPLETED SUCCESSFULLY ')
    console.log('================================================================\n')
  } finally {
    chrome.kill()
  }
}

runVisualQualityVerification().catch((err) => {
  console.error('Fatal verification error:', err)
  process.exit(1)
})
