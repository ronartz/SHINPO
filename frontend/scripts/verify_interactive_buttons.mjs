import { chromium } from 'playwright'
import { mkdirSync, existsSync, statSync, readFileSync, copyFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const LOCAL_DIR = path.resolve('docs/qa/screenshots/buttons')
const ARTIFACT_DIR = '/home/eonx/.gemini/antigravity/brain/f0afd28c-f135-40af-b1b6-06fb605de59b/screenshots/buttons'

mkdirSync(LOCAL_DIR, { recursive: true })
mkdirSync(ARTIFACT_DIR, { recursive: true })

async function startServer() {
  const distDir = path.resolve('frontend/dist')
  if (!existsSync(distDir)) {
    throw new Error(`dist directory not found at ${distDir}. Run build first.`)
  }

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, 'http://127.0.0.1')
    let filePath = path.join(distDir, parsed.pathname)
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html')
    }
    const ext = path.extname(filePath).toLowerCase()
    const contentType = mimeTypes[ext] || 'application/octet-stream'
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not Found')
    }
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      })
    })
  })
}

function copyToArtifacts(filename) {
  const local = path.join(LOCAL_DIR, filename)
  const art = path.join(ARTIFACT_DIR, filename)
  if (existsSync(local)) {
    copyFileSync(local, art)
  }
}

function getInitScript(brand = 'aurora', theme = 'dark') {
  return ({ brand, theme }) => {
    localStorage.setItem('shinpo_local_vault_account', 'qa_local_user')
    localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'qa_local_user' }))
    localStorage.setItem('shinpo_onboarding_dismissed', 'true')
    localStorage.setItem('shinpo_tutorial_completed', 'true')
    localStorage.setItem('shinpo_theme', theme)
    localStorage.setItem('shinpo_v2_preview', brand === 'aurora' ? 'true' : 'false')
    sessionStorage.setItem('shinpo_startup_completed', 'true')
    sessionStorage.setItem('shinpo_splash_shown', 'true')

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke: async (cmd) => {
          if (cmd === 'local_vault_status') return { unlocked: true, username: 'qa_local_user' }
          if (cmd === 'local_get_onboarding_state') return { status: 'COMPLETED', currentStep: 6 }
          if (cmd === 'local_platform_capabilities') return { hasAppMonitoring: true, platform: 'linux', warningOnlyRelease: true }
          if (cmd === 'local_get_guardian_preferences') return { preferredMode: 'PROTECTED', appMonitoringConsent: false }
          if (cmd === 'local_get_guardian_status') return { status: 'READY', guardianMode: 'PROTECTED', interventionCapability: 'LIMITED_NO_CLOSURE_CONSENT', warningOnly: true }
          if (cmd === 'local_get_active_focus_session' || cmd === 'get_active_focus_session') return null
          if (cmd === 'local_get_focus_sessions' || cmd === 'list_focus_sessions') return []
          if (cmd === 'local_get_goals' || cmd === 'list_goals_and_missions') return { goals: [], missions: [] }
          if (cmd === 'local_get_tasks') return []
          if (cmd === 'local_get_progress' || cmd === 'get_user_progress') return { userId: 1, totalXp: 100, level: 1 }
          if (cmd === 'local_get_study_resources') return []
          if (cmd === 'local_get_discovered_apps') return []
          if (cmd === 'local_get_app_policies') return []
          if (cmd === 'get_ai_provider_status') return { enabled: false, available: false }
          return null
        },
      },
    })
  }
}

async function runButtonVerification() {
  const server = await startServer()
  console.log(`Test server running at ${server.url}`)

  const browser = await chromium.launch({ headless: true })

  try {
    // -------------------------------------------------------------
    // THEME TESTING ACROSS ALL 4 CANONICAL THEMES
    // -------------------------------------------------------------
    const themes = [
      { name: 'classic-dark', brand: 'classic', theme: 'dark', title: 'Classic Dark (Lime #AFF33E + #020617 text)' },
      { name: 'classic-light', brand: 'classic', theme: 'light', title: 'Classic Light (Olive Green #4D7C0F)' },
      { name: 'aurora-dark', brand: 'aurora', theme: 'dark', title: 'Aurora Dark (Violet #9757FA + Cyan #1BC9DE)' },
      { name: 'aurora-light', brand: 'aurora', theme: 'light', title: 'Aurora Light (Soft Violet #7C3AED + Sky Blue)' },
    ]

    for (let i = 0; i < themes.length; i++) {
      const t = themes[i]
      console.log(`\n--- Capturing Theme [${i + 1}/4]: ${t.title} ---`)

      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()

      await page.addInitScript(getInitScript(t.brand, t.theme), t)

      await page.goto(`${server.url}?v2=${t.brand === 'aurora'}&theme=${t.theme}`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Hover over the primary action button in Focus Engine
      const startBtn = page.locator('button.btn-timer.primary, button:has-text("Start Focus"), button:has-text("Start a Focus session")').first()
      if (await startBtn.count() > 0) {
        const box = await startBtn.boundingBox()
        if (box) {
          // Hover near the right edge to showcase edge-proximity aura
          await page.mouse.move(box.x + box.width * 0.88, box.y + box.height * 0.5)
          await page.waitForTimeout(300)
        }
      }

      const filename = `0${i + 1}_${t.name}_button_hover_edge.png`
      await page.screenshot({ path: path.join(LOCAL_DIR, filename) })
      copyToArtifacts(filename)
      console.log(`Saved: ${filename}`)

      // Also trigger a pointer press and activation pulse
      if (await startBtn.count() > 0) {
        const box = await startBtn.boundingBox()
        if (box) {
          await page.mouse.down()
          await page.waitForTimeout(100)
          const pressFilename = `0${i + 1}_${t.name}_button_press_active.png`
          await page.screenshot({ path: path.join(LOCAL_DIR, pressFilename) })
          copyToArtifacts(pressFilename)
          await page.mouse.up()
        }
      }

      await context.close()
    }

    // -------------------------------------------------------------
    // TEST 5: BUTTON VARIANTS SHOWCASE (Primary, Secondary, Outline, Ghost, Destructive, Icon, Compact)
    // -------------------------------------------------------------
    console.log('\n--- Capturing Button Variants Matrix ---')
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()

      await page.addInitScript(getInitScript('aurora', 'dark'), { brand: 'aurora', theme: 'dark' })

      await page.goto(`${server.url}?v2=true&theme=dark`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Mount an in-page gallery of all button variants to showcase them side-by-side
      await page.evaluate(() => {
        const container = document.createElement('div')
        container.id = 'qa-button-variants-gallery'
        container.style.cssText = `
          position: fixed;
          top: 64px;
          left: 280px;
          right: 32px;
          bottom: 32px;
          background: rgba(11, 15, 25, 0.94);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 32px;
          z-index: 999999;
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
        `
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px;">
            <div>
              <h2 style="margin: 0; color: #fff; font-size: 22px;">Universal Interactive Button System Matrix</h2>
              <p style="margin: 4px 0 0; color: #94a3b8; font-size: 14px;">FlameButton edge-sensitive aura, cursor tracking, and tactile press response</p>
            </div>
            <span style="background: rgba(151,87,250,0.16); color: #9757FA; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 13px;">ACTIVE THEME: AURORA DARK</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase;">Primary Action</span>
              <button class="shinpo-interactive-btn variant-primary size-md" data-qa="primary-btn">
                <span>Start Focus Session</span>
              </button>
              <small style="color: #64748b;">Full theme energy, hover edge glow, tactile press</small>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase;">Secondary Action</span>
              <button class="shinpo-interactive-btn variant-secondary size-md" data-qa="secondary-btn">
                <span>Configure Preferences</span>
              </button>
              <small style="color: #64748b;">Theme border illumination, restrained aura</small>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase;">Outline Action</span>
              <button class="shinpo-interactive-btn variant-outline size-md" data-qa="outline-btn">
                <span>Export Audit CSV</span>
              </button>
              <small style="color: #64748b;">Illuminated stroke, soft inner sweep</small>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase;">Ghost Action</span>
              <button class="shinpo-interactive-btn variant-ghost size-md" data-qa="ghost-btn">
                <span>Dismiss Notice</span>
              </button>
              <small style="color: #64748b;">Local glow only, no oversized halo</small>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #f87171; font-weight: 600; font-size: 13px; text-transform: uppercase;">Destructive Action</span>
              <button class="shinpo-interactive-btn variant-destructive size-md" data-qa="destructive-btn">
                <span>Delete Account & Vault</span>
              </button>
              <small style="color: #64748b;">Danger tokens preserved, red click pulse</small>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 12px;">
              <span style="color: #cbd5e1; font-weight: 600; font-size: 13px; text-transform: uppercase;">Icon & Compact Actions</span>
              <div style="display: flex; gap: 12px; align-items: center;">
                <button class="shinpo-interactive-btn variant-icon" title="Settings" data-qa="icon-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
                <button class="shinpo-interactive-btn variant-primary variant-compact" data-qa="compact-btn">
                  <span>Compact 32px</span>
                </button>
                <button class="shinpo-interactive-btn variant-primary variant-floating" style="padding: 0 18px; height: 38px;">
                  <span>Floating Pill</span>
                </button>
              </div>
              <small style="color: #64748b;">Compact geometries with proportional aura</small>
            </div>
          </div>
        `
        document.body.appendChild(container)
      })

      // Hover over primary button to activate edge glow
      const primaryBtn = page.locator('[data-qa="primary-btn"]')
      const box = await primaryBtn.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5)
        await page.waitForTimeout(300)
      }

      const filename = '05_button_variants_matrix.png'
      await page.screenshot({ path: path.join(LOCAL_DIR, filename) })
      copyToArtifacts(filename)
      console.log(`Saved: ${filename}`)

      await context.close()
    }

    // -------------------------------------------------------------
    // TEST 6: DESTRUCTIVE BUTTON BEHAVIOR & MODAL ACTIONS
    // -------------------------------------------------------------
    console.log('\n--- Capturing Destructive Button Behavior ---')
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await context.newPage()

      await page.addInitScript(getInitScript('classic', 'dark'), { brand: 'classic', theme: 'dark' })

      await page.goto(`${server.url}?v2=false&theme=dark`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      // Mount confirmation modal to show destructive vs secondary action
      await page.evaluate(() => {
        const modal = document.createElement('div')
        modal.id = 'qa-destructive-modal'
        modal.style.cssText = `
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.82);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999999;
        `
        modal.innerHTML = `
          <div style="background: #0F172A; border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 16px; padding: 28px; width: 440px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
            <div style="display: flex; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
              <div style="background: rgba(248,113,113,0.15); border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: #F87171;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </div>
              <div>
                <h3 style="margin: 0; color: #F8FAFC; font-size: 18px;">Reset Local Database?</h3>
                <p style="margin: 6px 0 0; color: #94A3B8; font-size: 13.5px; line-height: 1.45;">This permanently purges the encrypted SQLCipher database file on disk. This cannot be undone.</p>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
              <button class="shinpo-interactive-btn variant-secondary size-md" data-qa="cancel-btn">
                <span>Cancel</span>
              </button>
              <button class="shinpo-interactive-btn variant-destructive size-md" data-qa="confirm-delete-btn">
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        `
        document.body.appendChild(modal)
      })

      // Hover over destructive button
      const delBtn = page.locator('[data-qa="confirm-delete-btn"]')
      const box = await delBtn.boundingBox()
      if (box) {
        await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5)
        await page.waitForTimeout(300)
      }

      const filename = '06_destructive_button_behavior.png'
      await page.screenshot({ path: path.join(LOCAL_DIR, filename) })
      copyToArtifacts(filename)
      console.log(`Saved: ${filename}`)

      await context.close()
    }

    // -------------------------------------------------------------
    // TEST 7: REDUCED MOTION BEHAVIOR
    // -------------------------------------------------------------
    console.log('\n--- Capturing Reduced Motion Behavior ---')
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()

      await page.addInitScript(getInitScript('aurora', 'dark'), { brand: 'aurora', theme: 'dark' })

      await page.goto(`${server.url}?v2=true&theme=dark`)
      await page.waitForSelector('.app-shell', { timeout: 10000 })

      const startBtn = page.locator('button.btn-timer.primary, button:has-text("Start Focus"), button:has-text("Start a Focus session")').first()
      if (await startBtn.count() > 0) {
        const box = await startBtn.boundingBox()
        if (box) {
          await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5)
          await page.waitForTimeout(300)
        }
      }

      const filename = '07_reduced_motion_behavior.png'
      await page.screenshot({ path: path.join(LOCAL_DIR, filename) })
      copyToArtifacts(filename)
      console.log(`Saved: ${filename}`)

      await context.close()
    }

    console.log('\n✓ All visual button acceptance screenshots captured successfully!')
  } finally {
    await browser.close()
    server.close()
  }
}

runButtonVerification().catch((err) => {
  console.error('Visual verification failed:', err)
  process.exit(1)
})
