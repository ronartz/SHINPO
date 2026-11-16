import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('empty EONPAI starts with four live prompt actions and keeps its composer in view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/eonpai-preview.html?brand=aurora&theme=dark')

  await expect(page.getByRole('heading', { name: 'What are we working on?' })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversation messages' })
  await expect(conversation.getByRole('button', { name: 'Plan my day' })).toBeVisible()
  await expect(conversation.getByRole('button', { name: 'Break down a goal' })).toBeVisible()
  await expect(conversation.getByRole('button', { name: 'Review progress' })).toBeVisible()
  await expect(conversation.getByRole('button', { name: 'Help me focus' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Message to EONPAI' })).toBeVisible()
  const statusGeometry = await page.evaluate(() => {
    const dot = document.querySelector('.eonpai-provider-status-dot')!
    const badge = document.querySelector('.eonpai-status-badge')!
    const dotBox = dot.getBoundingClientRect()
    const badgeBox = badge.getBoundingClientRect()
    return { position: getComputedStyle(dot).position, insideBadge: dotBox.left >= badgeBox.left && dotBox.right <= badgeBox.right }
  })
  expect(statusGeometry).toEqual({ position: 'static', insideBadge: true })
  await conversation.getByRole('button', { name: 'Plan my day' }).click()
  await expect(page.getByLabel('Fixture callback result')).toContainText('Plan my day based on scheduled tasks and active goals')

  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    main: document.querySelector('.app-main-ai')!.scrollHeight > document.querySelector('.app-main-ai')!.clientHeight,
    feed: document.querySelector('.eonpai-chat-feed')!.clientHeight,
    composerVisible: document.querySelector('.eonpai-composer')!.getBoundingClientRect().bottom <= window.innerHeight,
  }))
  expect(overflow.horizontal).toBe(false)
  expect(overflow.main).toBe(false)
  expect(overflow.feed).toBeGreaterThan(0)
  expect(overflow.composerVisible).toBe(true)
})

test('compact Aurora opens context as a keyboard accessible drawer without narrowing chat', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 })
  await page.goto('/eonpai-preview.html?brand=aurora&theme=light')

  const toggle = page.getByRole('button', { name: 'Today’s context', exact: true })
  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('complementary', { name: 'Today’s SHINPO context' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(toggle).toBeFocused()

  const layout = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    feedWidth: document.querySelector('.eonpai-chat-feed')!.clientWidth,
    composerBottom: document.querySelector('.eonpai-composer')!.getBoundingClientRect().bottom,
  }))
  expect(layout.horizontal).toBe(false)
  expect(layout.feedWidth).toBeGreaterThan(300)
  expect(layout.composerBottom).toBeLessThanOrEqual(700)
})

test('message copy control is reachable and composer sends through its existing callback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/eonpai-preview.html?brand=classic&theme=dark&message=1')

  await page.getByRole('button', { name: 'Copy message' }).click()
  await expect(page.locator('.ai-bubble-actions [role="status"]')).toContainText('Message copied')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Fixture message for copy-control verification.')

  const composer = page.getByRole('textbox', { name: 'Message to EONPAI' })
  await composer.fill(Array.from({ length: 18 }, (_, index) => `Line ${index + 1} with enough text to grow the EONPAI composer.`).join('\n'))
  expect(await composer.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(120)
  await expect(composer).toHaveCSS('overflow-y', 'auto')
  await composer.fill('Help me plan my next task')
  await composer.press('Enter')
  await expect(page.getByLabel('Fixture callback result')).toContainText('Message callback: Help me plan my next task')
})

test('EONPAI has no WCAG A/AA violations in any supported theme pairing', async ({ page }) => {
  for (const [brand, theme] of [['aurora', 'dark'], ['aurora', 'light'], ['classic', 'dark'], ['classic', 'light']]) {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`/eonpai-preview.html?brand=${brand}&theme=${theme}`)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations, `${brand} ${theme}: ${results.violations.map(({ id }) => id).join(', ')}`).toEqual([])
  }
})
