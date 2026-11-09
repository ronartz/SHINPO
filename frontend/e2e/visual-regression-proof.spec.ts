import { test, expect } from '@playwright/test'
import { getBrowserGeometryAuditScript, type VisualAuditReport } from './visual/geometryAudit'

test.describe('SHINPO — Operation Visual Regression Proof (Phase 1 Red-Green Detector Validation)', () => {
  // Helper to run audit on current page
  async function runAudit(page: any): Promise<VisualAuditReport> {
    return await page.evaluate(getBrowserGeometryAuditScript())
  }

  // 1. Profile menu hidden behind an ordinary card
  test('Detector 1: Profile menu hidden behind card (OCCLUSION)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: card with z-index: 10 covers dropdown menu item at z-index: 1
    await page.setContent(`
      <div style="position: relative; width: 800px; height: 600px; font-family: sans-serif;">
        <div id="account-dropdown-menu" style="position: absolute; top: 50px; left: 50px; width: 200px; height: 150px; z-index: 1; background: blue;">
          <button id="profile-btn" style="width: 100%; height: 40px;">All settings</button>
        </div>
        <div class="card" style="position: absolute; top: 40px; left: 40px; width: 220px; height: 180px; z-index: 10; background: red;">
          Overlapping Card Content
        </div>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const occlusionFinding = defectiveReport.findings.find(f => f.type === 'OCCLUSION')
    expect(occlusionFinding, 'Detector must catch occluded menu item').toBeDefined()
    expect(occlusionFinding?.severity).toBe('P0')

    // Corrected: dropdown menu has proper stacking context above the card
    await page.setContent(`
      <div style="position: relative; width: 800px; height: 600px; font-family: sans-serif;">
        <div class="card" style="position: absolute; top: 40px; left: 40px; width: 220px; height: 180px; z-index: 1; background: red;">
          Underlying Card Content
        </div>
        <div id="account-dropdown-menu" style="position: absolute; top: 50px; left: 50px; width: 200px; height: 150px; z-index: 9999; background: blue;">
          <button id="profile-btn" style="width: 100%; height: 40px; color: white;">All settings</button>
        </div>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'OCCLUSION')
    expect(correctedFinding, 'Corrected menu must have no occlusion findings').toBeUndefined()
  })

  // 2. Power dropdown clipped by a parent container
  test('Detector 2: Power dropdown clipped by parent overflow:hidden (CLIPPING)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: parent container has overflow: hidden and clips the dropdown menu
    await page.setContent(`
      <div style="position: relative; width: 400px; height: 100px; overflow: hidden; background: #eee;">
        <div id="power-dropdown-menu" class="dropdown-menu" style="position: absolute; top: 20px; left: 20px; width: 200px; height: 200px; background: white;">
          <button style="height: 40px; width: 100%;">Restart</button>
          <button style="height: 40px; width: 100%;">Shut down</button>
          <button style="height: 40px; width: 100%; margin-top: 60px;">Clipped Power Option</button>
        </div>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const clipFinding = defectiveReport.findings.find(f => f.type === 'CLIPPING')
    expect(clipFinding, 'Detector must catch parent container clipping dropdown').toBeDefined()
    expect(clipFinding?.severity).toBe('P0')

    // Corrected: container has visible overflow or uses floating portal
    await page.setContent(`
      <div style="position: relative; width: 400px; height: 260px; overflow: visible; background: #eee;">
        <div id="power-dropdown-menu" class="dropdown-menu" style="position: absolute; top: 20px; left: 20px; width: 200px; height: 200px; background: white;">
          <button style="height: 40px; width: 100%;">Restart</button>
          <button style="height: 40px; width: 100%;">Shut down</button>
          <button style="height: 40px; width: 100%; margin-top: 60px;">Fully Visible Power Option</button>
        </div>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'CLIPPING')
    expect(correctedFinding, 'Corrected dropdown must have no clipping findings').toBeUndefined()
  })

  // 3. Text labels concatenated without spacing, e.g. LightRecognized
  test('Detector 3: Text labels concatenated without spacing (COLLISION)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: direct adjacent sibling spans with zero spacing
    await page.setContent(`
      <div>
        <p>
          <span style="display: inline-block;">Light</span><span style="display: inline-block; margin-left: 0px;">Recognized</span>
        </p>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const collisionFinding = defectiveReport.findings.find(f => f.type === 'COLLISION' && f.message.includes('LightRecognized'))
    expect(collisionFinding, 'Detector must catch concatenated inline text').toBeDefined()

    // Corrected: proper space between spans
    await page.setContent(`
      <div>
        <p>
          <span style="display: inline-block;">Light</span> <span style="display: inline-block; margin-left: 8px;">Recognized</span>
        </p>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'COLLISION')
    expect(correctedFinding, 'Corrected text must have no collision findings').toBeUndefined()
  })

  // 4. Task toolbar controls vertically misaligned
  test('Detector 4: Task toolbar controls vertically misaligned (ALIGNMENT)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: buttons inside toolbar have 16px vertical center discrepancy
    await page.setContent(`
      <div class="action-toolbar" style="display: flex; gap: 10px;">
        <button style="height: 36px; margin-top: 0px;">Search</button>
        <button style="height: 36px; margin-top: 16px;">New Task</button>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const alignFinding = defectiveReport.findings.find(f => f.type === 'ALIGNMENT')
    expect(alignFinding, 'Detector must catch misaligned toolbar controls').toBeDefined()
    expect(alignFinding?.measuredValue).toBeGreaterThan(4)

    // Corrected: controls vertically aligned with flex align-items: center
    await page.setContent(`
      <div class="action-toolbar" style="display: flex; align-items: center; gap: 10px;">
        <button style="height: 36px; margin-top: 0px;">Search</button>
        <button style="height: 36px; margin-top: 0px;">New Task</button>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'ALIGNMENT')
    expect(correctedFinding, 'Corrected toolbar controls must have zero alignment findings').toBeUndefined()
  })

  // 5. Aurora brand colors incorrectly appearing in Classic
  test('Detector 5: Aurora brand colors in Classic theme (THEME_LEAK)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: page has theme-classic but element uses Aurora cyan rgb(0, 245, 255)
    await page.setContent(`
      <html class="theme-classic">
        <body class="theme-classic">
          <div class="card" style="background-color: rgb(0, 245, 255); color: #000;">
            Classic card contaminated with Aurora cyan
          </div>
        </body>
      </html>
    `)
    const defectiveReport = await runAudit(page)
    const leakFinding = defectiveReport.findings.find(f => f.type === 'THEME_LEAK' && f.message.includes('Aurora neon color'))
    expect(leakFinding, 'Detector must catch Aurora neon color in Classic theme').toBeDefined()

    // Corrected: Classic card uses standard blue/amber classic token
    await page.setContent(`
      <html class="theme-classic">
        <body class="theme-classic">
          <div class="card" style="background-color: rgb(30, 41, 59); color: rgb(248, 250, 252);">
            Classic card using proper neutral/classic tokens
          </div>
        </body>
      </html>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'THEME_LEAK')
    expect(correctedFinding, 'Corrected Classic palette must have no theme leak findings').toBeUndefined()
  })

  // 6. Low-contrast text and icons in Aurora Light and Classic Light
  test('Detector 6: Low-contrast text in Light theme (CONTRAST)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: Light theme with white background and faint gray text (#d4d4d8 on #ffffff, ratio ~ 1.5:1)
    await page.setContent(`
      <html data-theme="light">
        <body style="background-color: rgb(255, 255, 255);">
          <p style="color: rgb(212, 212, 216); font-size: 14px;">Low contrast unreadable text</p>
        </body>
      </html>
    `)
    const defectiveReport = await runAudit(page)
    const contrastFinding = defectiveReport.findings.find(f => f.type === 'CONTRAST')
    expect(contrastFinding, 'Detector must catch low-contrast text').toBeDefined()
    expect(contrastFinding?.measuredValue).toBeLessThan(4.5)

    // Corrected: High contrast dark text (#0f172a on #ffffff, ratio > 15:1)
    await page.setContent(`
      <html data-theme="light">
        <body style="background-color: rgb(255, 255, 255);">
          <p style="color: rgb(15, 23, 42); font-size: 14px;">Clear accessible text</p>
        </body>
      </html>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'CONTRAST')
    expect(correctedFinding, 'Corrected text must pass WCAG AA contrast').toBeUndefined()
  })

  // 7. Dark inset-shadow artifacts inside light-theme empty-state panels
  test('Detector 7: Dark inset-shadow in Light empty-state (THEME_LEAK)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: Light theme empty state with heavy dark inset shadow
    await page.setContent(`
      <html data-theme="light">
        <body>
          <div class="empty-state" style="box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.45); width: 300px; height: 150px;">
            <p>No tasks yet</p>
          </div>
        </body>
      </html>
    `)
    const defectiveReport = await runAudit(page)
    const shadowFinding = defectiveReport.findings.find(f => f.type === 'THEME_LEAK' && f.message.includes('Dark mode heavy/inset shadow'))
    expect(shadowFinding, 'Detector must catch dark inset shadow in light theme').toBeDefined()

    // Corrected: Light theme empty state with soft border or light shadow
    await page.setContent(`
      <html data-theme="light">
        <body>
          <div class="empty-state" style="box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; width: 300px; height: 150px;">
            <p style="color: #0f172a;">No tasks yet</p>
          </div>
        </body>
      </html>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'THEME_LEAK')
    expect(correctedFinding, 'Corrected empty state must have no theme leak findings').toBeUndefined()
  })

  // 8. Transparent panels without the required frosted-glass treatment
  test('Detector 8: Transparent panels without frosted-glass treatment (MISSING_GLASS)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: glass-card has translucent background but backdrop-filter is none
    await page.setContent(`
      <div>
        <div class="glass-card" style="background: rgba(30, 41, 59, 0.7); backdrop-filter: none; width: 300px; height: 200px;">
          Glass card missing blur treatment
        </div>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const glassFinding = defectiveReport.findings.find(f => f.type === 'MISSING_GLASS')
    expect(glassFinding, 'Detector must catch glass container missing blur').toBeDefined()

    // Corrected: glass-card has proper backdrop-filter: blur(16px)
    await page.setContent(`
      <div>
        <div class="glass-card" style="background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(16px); width: 300px; height: 200px;">
          Glass card with authentic frosted blur
        </div>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'MISSING_GLASS')
    expect(correctedFinding, 'Corrected glass card must have zero missing glass findings').toBeUndefined()
  })

  // 9. A content-driven card forced into an oversized fixed height
  test('Detector 9: Content card forced into oversized fixed height (DEAD_SPACE)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: card height is 450px while content occupies only 30px (>90% dead void)
    await page.setContent(`
      <div>
        <div class="card" style="height: 450px; width: 300px; padding: 16px; box-sizing: border-box;">
          <h3 class="card-title">Sparse Header</h3>
        </div>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const deadSpaceFinding = defectiveReport.findings.find(f => f.type === 'DEAD_SPACE')
    expect(deadSpaceFinding, 'Detector must catch oversized card with dead space void').toBeDefined()
    expect(deadSpaceFinding?.measuredValue).toBeGreaterThan(70)

    // Corrected: card hugs content naturally
    await page.setContent(`
      <div>
        <div class="card" style="height: auto; min-height: fit-content; width: 300px; padding: 16px; box-sizing: border-box;">
          <h3 class="card-title">Natural Height Header</h3>
        </div>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'DEAD_SPACE')
    expect(correctedFinding, 'Corrected card hugging content must have zero dead space findings').toBeUndefined()
  })

  // 10. Rewards statistics overflowing or colliding inside their card
  test('Detector 10: Rewards statistics overflowing bottom of card (CLIPPING)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: card height is 100px, but content extends to 130px (overflowing bottom by 30px)
    await page.setContent(`
      <div style="position: relative;">
        <div class="dashboard-progress-card" style="position: relative; height: 100px; width: 300px; box-sizing: border-box;">
          <p>Next Milestone</p>
          <div class="progress-bar" style="position: absolute; top: 110px; height: 20px; width: 100%;">
            <span>0% complete</span>
          </div>
        </div>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const overflowFinding = defectiveReport.findings.find(f => f.type === 'CLIPPING' && f.message.includes('overflows bottom edge'))
    expect(overflowFinding, 'Detector must catch stat element overflowing bottom of parent card').toBeDefined()

    // Corrected: card provides adequate height and padding for progress bar
    await page.setContent(`
      <div style="position: relative;">
        <div class="dashboard-progress-card" style="position: relative; height: 160px; width: 300px; padding-bottom: 20px; box-sizing: border-box;">
          <p>Next Milestone</p>
          <div class="progress-bar" style="margin-top: 10px; height: 20px; width: 100%;">
            <span>0% complete</span>
          </div>
        </div>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'CLIPPING' && f.message.includes('overflows bottom edge'))
    expect(correctedFinding, 'Corrected card with adequate height must have zero bottom overflow findings').toBeUndefined()
  })

  // 11. Calendar actions with duplicate purposes
  test('Detector 11: Duplicate action buttons in same toolbar (DUPLICATE_ACTION)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Defective: two buttons in calendar-actions group both labeled "Today"
    await page.setContent(`
      <div class="calendar-actions">
        <button aria-label="Today">Today</button>
        <button aria-label="Month">Month</button>
        <button aria-label="Today">Today</button>
      </div>
    `)
    const defectiveReport = await runAudit(page)
    const dupFinding = defectiveReport.findings.find(f => f.type === 'DUPLICATE_ACTION')
    expect(dupFinding, 'Detector must catch duplicate action button in same group').toBeDefined()
    expect(dupFinding?.text).toBe('today')

    // Corrected: single "Today" button with clean unique actions
    await page.setContent(`
      <div class="calendar-actions">
        <button aria-label="Today">Today</button>
        <button aria-label="Week">Week</button>
        <button aria-label="Month">Month</button>
      </div>
    `)
    const correctedReport = await runAudit(page)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'DUPLICATE_ACTION')
    expect(correctedFinding, 'Corrected action group must have zero duplicate action findings').toBeUndefined()
  })

  // 12. Essential controls clipped at smaller viewport widths
  test('Detector 12: Viewport horizontal overflow at constrained width (OVERFLOW)', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })

    // Defective: rigid non-responsive element with fixed width: 1300px causes horizontal scrolling
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="width: 1300px; height: 200px; background: cyan;">
            Rigid fixed-width container exceeding 1024px viewport
          </div>
        </body>
      </html>
    `)
    const defectiveReport = await runAudit(page)
    expect(defectiveReport.hasHorizontalOverflow, 'Detector must flag horizontal overflow').toBe(true)
    const overflowFinding = defectiveReport.findings.find(f => f.type === 'OVERFLOW')
    expect(overflowFinding, 'Detector must register OVERFLOW finding').toBeDefined()

    // Corrected: responsive container using 100% / max-width
    await page.setContent(`
      <html>
        <body style="margin: 0; padding: 0;">
          <div style="width: 100%; max-width: 100%; height: 200px; background: cyan;">
            Responsive fluid container fitting 1024px viewport cleanly
          </div>
        </body>
      </html>
    `)
    const correctedReport = await runAudit(page)
    expect(correctedReport.hasHorizontalOverflow, 'Corrected responsive layout must not overflow horizontally').toBe(false)
    const correctedFinding = correctedReport.findings.find(f => f.type === 'OVERFLOW')
    expect(correctedFinding, 'Corrected layout must have zero OVERFLOW findings').toBeUndefined()
  })
})
