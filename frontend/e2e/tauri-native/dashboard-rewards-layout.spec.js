import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

describe('SHINPO native Dashboard Rewards & Progress layout', function () {
  it('keeps the summary, statistics and milestone aligned across themes and data states', async function () {
    assert.ok(process.env.SHINPO_TAURI_QA_PROFILE)
    const evidence = process.env.SHINPO_TAURI_EVIDENCE_DIR
    mkdirSync(evidence, { recursive: true })

    await browser.waitUntil(async () => await browser.execute(() => Boolean(
      document.querySelector('#auth-identifier') || document.querySelector('.shinpo-dashboard') || document.querySelector('h1')
    )), { timeout: 120000, timeoutMsg: 'App did not render authentication or dashboard UI' }).catch(async (cause) => {
      const page = await browser.execute(() => ({
        title: document.title,
        url: location.href,
        bodyText: document.body?.innerText?.slice(0, 1200) || '',
        bodyHtml: document.body?.innerHTML?.slice(0, 1600) || '',
      }))
      await browser.saveScreenshot(path.join(evidence, 'rewards-startup-failure.png'))
      throw new Error(`${cause.message}; rendered page: ${JSON.stringify(page)}`)
    })
    const windows = await browser.getWindowHandles()
    if (windows.length) await browser.switchToWindow(windows[0])

    const username = `qa_rewards_layout_${Date.now()}`
    const email = await $('#auth-email')
    if (!(await email.isDisplayed().catch(() => false))) {
      const createWorkspace = await $('button*=Create Workspace')
      await createWorkspace.click()
      await email.waitForDisplayed({ timeout: 5000 })
    }
    await $('#auth-identifier').setValue(username)
    if (await email.isDisplayed()) await email.setValue(`${username}@shinpo.local`)
    await $('#auth-password').setValue(`Rewards-QA-${randomUUID()}-Safe!`)
    await $('.animated-auth-form button[type="submit"]').click()
    await browser.waitUntil(async () => await browser.execute(() => Boolean(
      document.querySelector('#recovery-key-display') || document.querySelector('#auth-error') || document.querySelector('.shinpo-dashboard')
    )), { timeout: 30000, timeoutMsg: 'Authentication produced neither recovery UI, an error nor the dashboard' }).catch(async (cause) => {
      const authState = await browser.execute(() => ({
        url: location.href,
        title: document.title,
        body: document.body?.innerText?.slice(0, 1200),
        form: document.querySelector('.animated-auth-form')?.outerHTML?.slice(0, 1400),
        values: [...document.querySelectorAll('#auth-identifier, #auth-email, #auth-password')].map((input) => ({ id: input.id, valueLength: input.value.length, visible: Boolean(input.offsetWidth || input.offsetHeight) })),
      }))
      await browser.saveScreenshot(path.join(evidence, 'rewards-auth-timeout.png'))
      throw new Error(`${cause.message}; auth state: ${JSON.stringify(authState)}`)
    })
    if (!(await $('#recovery-key-display').isDisplayed())) {
      const authState = await browser.execute(() => ({
        error: document.querySelector('#auth-error')?.textContent,
        body: document.body?.innerText?.slice(0, 900),
        form: document.querySelector('.animated-auth-form')?.outerHTML?.slice(0, 900),
      }))
      await browser.saveScreenshot(path.join(evidence, 'rewards-auth-failure.png'))
      throw new Error(`Workspace registration did not show its recovery key: ${JSON.stringify(authState)}`)
    }
    await browser.execute(() => document.querySelector('#recovery-confirmed-checkbox')?.click())
    await browser.execute(() => document.querySelector('#recovery-continue-btn')?.click())
    try { await $('[aria-label="Dismiss welcome"]').click() } catch {}
    try { await $('button[aria-label="Skip and close tutorial"], .btn-tutorial-skip').click() } catch {}

    const dashboard = await $('[data-tab="Dashboard"]')
    await dashboard.waitForDisplayed({ timeout: 30000 })
    await browser.execute(() => document.querySelector('[data-tab="Dashboard"]')?.click())
    await $('.dashboard-rewards-summary').waitForDisplayed({ timeout: 30000 })

    const inspect = async (label) => browser.execute((label) => {
      const card = document.querySelector('.dashboard-rewards-summary')
      const rect = (node) => {
        const box = node.getBoundingClientRect()
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height }
      }
      const content = card?.firstElementChild
      const summary = card?.querySelector('[data-testid="dashboard-rewards-summary-row"]') || content?.children[1]
      const icon = card?.querySelector('[data-testid="dashboard-rewards-level-icon"]') || summary?.children[0]
      const copy = card?.querySelector('[data-testid="dashboard-rewards-summary-copy"]') || summary?.children[1]
      const xp = card?.querySelector('[data-testid="dashboard-rewards-xp"]') || copy?.querySelector(':scope > div > :last-child')
      const stats = card?.querySelector('[data-testid="dashboard-rewards-statistics"]') || content?.children[2]
      const statItems = [...(stats?.querySelectorAll('[data-testid="dashboard-rewards-stat"]') || [])]
      const labels = statItems.map((item) => item.querySelector('[data-testid="dashboard-rewards-stat-label"]'))
      const values = statItems.map((item) => item.querySelector('[data-testid="dashboard-rewards-stat-value"]'))
      const milestone = card?.querySelector('[data-testid="dashboard-rewards-milestone"]') || content?.children[3]
      const progress = card?.querySelector('[data-testid="dashboard-rewards-progress"]') || content?.children[4]
      return {
        label,
        viewport: { width: innerWidth, height: innerHeight },
        brand: document.documentElement.dataset.brand,
        theme: document.documentElement.dataset.theme,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        card: card && rect(card),
        content: content && getComputedStyle(content).padding,
        summaryDisplay: summary && getComputedStyle(summary).display,
        summaryColumns: summary && getComputedStyle(summary).gridTemplateColumns,
        icon: icon && rect(icon),
        copy: copy && rect(copy),
        xp: xp && rect(xp),
        xpText: xp?.textContent.trim() || null,
        statsDisplay: stats && getComputedStyle(stats).display,
        statsColumns: stats && getComputedStyle(stats).gridTemplateColumns,
        statsGap: stats && getComputedStyle(stats).columnGap,
        statRects: statItems.map(rect),
        statPadding: statItems.map((item) => getComputedStyle(item).padding),
        statLabels: labels.map((item) => item?.textContent.trim()),
        statValues: values.map((item) => item?.textContent.trim()),
        statValueRects: values.map((item) => item && rect(item)),
        summaryBottomToStats: summary && stats ? stats.getBoundingClientRect().top - summary.getBoundingClientRect().bottom : null,
        statsBottomToMilestone: stats && milestone ? milestone.getBoundingClientRect().top - stats.getBoundingClientRect().bottom : null,
        milestone: milestone && rect(milestone),
        progress: progress && rect(progress),
        milestoneText: milestone?.innerText,
      }
    }, label)

    const setTheme = async (brand, mode) => {
      await browser.execute(() => document.querySelector('[aria-label^="Account menu for"]')?.click())
      await browser.execute(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('All settings'))?.click())
      const settings = await $('[role="dialog"][aria-labelledby="settings-dialog-title"]')
      await settings.waitForDisplayed()
      await browser.execute(() => document.querySelector('[data-section="appearance"]')?.click())
      const brandButton = await $(`button*=${brand === 'classic' ? 'Classic' : 'Aurora'}`)
      await browser.execute((label) => [...document.querySelectorAll('button')].find((button) => button.textContent.includes(label))?.click(), brand === 'classic' ? 'Classic' : 'Aurora')
      const modeButton = await $(`button*=${mode === 'dark' ? 'Dark Theme' : 'Light Theme'}`)
      await browser.execute((label) => [...document.querySelectorAll('button')].find((button) => button.textContent.includes(label))?.click(), mode === 'dark' ? 'Dark Theme' : 'Light Theme')
      await browser.waitUntil(async () => await browser.execute(({ brand, mode }) => document.documentElement.dataset.brand === brand && document.documentElement.dataset.theme === mode, { brand, mode }), {
        timeout: 10000,
        timeoutMsg: `Theme did not update to ${brand}/${mode}`,
      })
      await browser.execute(() => document.querySelector('[aria-label="Close Settings"]')?.click())
      await $('.dashboard-rewards-summary').waitForDisplayed()
    }

    const assertGeometry = (result, expectedBrand, expectedMode) => {
      assert.equal(result.brand, expectedBrand, JSON.stringify(result))
      assert.equal(result.theme, expectedMode, JSON.stringify(result))
      assert.equal(result.overflow, false, `document horizontal overflow: ${JSON.stringify(result)}`)
      assert.ok(result.card && result.card.width > 0 && result.card.right <= result.viewport.width, JSON.stringify(result))
      assert.equal(result.summaryDisplay, 'grid', `summary must be a three-column grid: ${JSON.stringify(result)}`)
      assert.equal(result.summaryColumns.split(' ').length, 3, JSON.stringify(result))
      assert.ok(Math.abs((result.icon.y + result.icon.height / 2) - (result.copy.y + result.copy.height / 2)) < 2, `icon must center against the complete text block: ${JSON.stringify(result)}`)
      assert.ok(result.xp.x >= result.copy.right, `XP must occupy the right summary column: ${JSON.stringify(result)}`)
      assert.equal(result.statsDisplay, 'grid', JSON.stringify(result))
      assert.equal(result.statsColumns.split(' ').length, 3, JSON.stringify(result))
      assert.equal(result.statLabels.join('|'), 'Active Goals|Focus Sessions|Streak', JSON.stringify(result))
      assert.equal(result.statRects.length, 3, JSON.stringify(result))
      assert.ok(result.statRects.every((item) => Math.abs(item.height - result.statRects[0].height) < 1), JSON.stringify(result))
      assert.ok(result.statPadding.every((padding) => padding === result.statPadding[0]), JSON.stringify(result))
      assert.ok(result.statValueRects.every((item) => Math.abs(item.y - result.statValueRects[0].y) < 1), `statistic values should align: ${JSON.stringify(result)}`)
      assert.ok(result.summaryBottomToStats >= 15 && result.summaryBottomToStats <= 20, `summary/statistics gap should be 16–20px: ${JSON.stringify(result)}`)
      assert.ok(result.statsBottomToMilestone >= 15 && result.statsBottomToMilestone <= 20, `statistics/milestone gap should be 16–20px: ${JSON.stringify(result)}`)
      assert.ok(result.progress && result.progress.width > 0, JSON.stringify(result))
    }

    const dismissCelebrations = async () => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const headline = await browser.execute(() => document.querySelector('.celebration-modal-overlay')?.textContent?.trim() || null)
        if (!headline) return
        await browser.execute(() => document.querySelector('.celebration-modal-overlay .celebration-btn.primary')?.click())
        await browser.pause(250)
      }
      const remaining = await browser.execute(() => document.querySelector('.celebration-modal-overlay')?.textContent?.trim() || null)
      assert.equal(remaining, null, `completion confirmation queue did not drain: ${remaining}`)
    }

    // This dashboard card is only rendered by the Aurora dashboard. Classic
    // switches to a separate dashboard and has no equivalent Rewards card.
    for (const [brand, mode] of [['aurora', 'dark'], ['aurora', 'light']]) {
      await setTheme(brand, mode)
      for (const [width, height] of [[960, 720], [1280, 800], [1440, 900], [1920, 1080]]) {
        await browser.setWindowSize(width, height)
        await browser.execute(() => document.querySelector('.dashboard-rewards-summary')?.scrollIntoView({ block: 'center' }))
        await browser.pause(200)
        const result = await inspect(`zero-${brand}-${mode}-${width}`)
        assertGeometry(result, brand, mode)
        if (width === 960 || width === 1440) {
          await browser.saveScreenshot(path.join(evidence, `rewards-${brand}-${mode}-${width}-zero.png`))
        }
        console.log(`Rewards zero-state geometry: ${JSON.stringify(result)}`)
      }
    }

    await browser.execute(() => document.querySelector('[data-tab="Goals & Missions"]')?.click())
    const createFirstGoal = await $('button*=Create First Goal')
    await createFirstGoal.waitForDisplayed({ timeout: 15000 })
    await browser.execute(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('Create First Goal'))?.click())
    const goalDialog = await $('[role="dialog"][aria-labelledby="create-goal-dialog-title"]')
    await goalDialog.waitForDisplayed()
    const goalTitle = `Rewards layout goal ${Date.now()}`
    await $('#create-goal-name-input').setValue(goalTitle)
    await browser.execute(() => document.querySelector('[aria-labelledby="create-goal-dialog-title"] button[type="submit"]')?.click())
    await $('.goal-single-summary-card').waitForDisplayed({ timeout: 30000 })
    console.log('Rewards QA: goal persisted; opening task form')
    await browser.execute(() => document.querySelector('[data-tutorial="new-task"]')?.click())
    const taskDialog = await $('[role="dialog"][aria-labelledby="create-task-title"]')
    await taskDialog.waitForDisplayed()
    const taskTitle = `Rewards layout completed task ${Date.now()}`
    await $('#create-task-title-input').setValue(taskTitle)
    await browser.execute(() => document.querySelector('[aria-labelledby="create-task-title"] button[type="submit"]')?.click())
    await browser.waitUntil(async () => (await $('.missions-list-container').getText()).includes(taskTitle), { timeout: 30000 })
    console.log('Rewards QA: task persisted; completing task through rendered row control')
    const taskRow = await $(`//*[contains(text(), "${taskTitle}")]/ancestor::div[contains(@class, "mission-list-row")]`)
    await browser.execute((title) => {
      const row = [...document.querySelectorAll('.mission-list-row')].find((item) => item.textContent.includes(title))
      row?.querySelector('.task-row-check-btn, input[type="checkbox"], button.task-action-complete')?.click()
    }, taskTitle)
    await browser.waitUntil(async () => (await taskRow.getText()).toLowerCase().includes('completed') || (await taskRow.getAttribute('class')).toLowerCase().includes('completed'), { timeout: 15000 })
    console.log('Rewards QA: task completion persisted')
    // Dismiss completion confirmations through their real Continue action.
    // Several progression milestones can be queued for one completion.
    await dismissCelebrations()
    assert.equal(await browser.execute(() => Boolean(document.querySelector('.celebration-modal-overlay'))), false, 'completion dialog must be closed before taking populated-state screenshots')

    await browser.execute(() => document.querySelector('[data-tab="Dashboard"]')?.click())
    await $('.dashboard-rewards-summary').waitForDisplayed({ timeout: 30000 })
    await browser.pause(300)
    for (const [brand, mode] of [['aurora', 'dark'], ['aurora', 'light']]) {
      await setTheme(brand, mode)
      for (const [width, height] of [[960, 720], [1280, 800], [1440, 900], [1920, 1080]]) {
        await browser.setWindowSize(width, height)
        await browser.execute(() => document.querySelector('.dashboard-rewards-summary')?.scrollIntoView({ block: 'center' }))
        await browser.execute(() => document.querySelectorAll('.shinpo-toast-dismiss').forEach((button) => button.click()))
        await dismissCelebrations()
        await browser.pause(200)
        const result = await inspect(`populated-${brand}-${mode}-${width}`)
        assertGeometry(result, brand, mode)
        assert.ok(Number(result.statValues[1]) === 0, `no Focus sessions were created: ${JSON.stringify(result)}`)
        assert.ok(Number.parseInt(result.xpText, 10) >= 10, `completed task should reflect persisted XP: ${JSON.stringify(result)}`)
        assert.match(result.milestoneText, /100% complete/, `completed task progress should be reflected: ${JSON.stringify(result)}`)
        if (width === 960 || width === 1440) await browser.saveScreenshot(path.join(evidence, `rewards-${brand}-${mode}-${width}-populated.png`))
        console.log(`Rewards populated-state geometry: ${JSON.stringify(result)}`)
      }
    }
  })
})
