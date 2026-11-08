import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('SHINPO Quality Gate - A11y & E2E', () => {
  test('unauthenticated auth screen loads and passes axe-core accessibility audit', async ({ page }) => {
    await page.goto('/')

    // Wait for the auth card to render
    const authCard = page.locator('.auth-card')
    await expect(authCard).toBeVisible({ timeout: 10000 })

    // Run axe-core accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Assert zero critical or serious a11y violations
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    expect(criticalViolations).toEqual([])
  })

  test('UI component gallery view renders properly', async ({ page }) => {
    await page.goto('/?dev=gallery')

    // Confirm that the Dev Gallery loads
    const galleryHeading = page.getByRole('heading', { name: /UI Core Component Gallery/i }).first()
    await expect(galleryHeading).toBeVisible({ timeout: 10000 })

    // Verify visual snapshot
    await expect(page).toHaveScreenshot('gallery-view.png', {
      maxDiffPixelRatio: 0.05,
    })
  })
})

