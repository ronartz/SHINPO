import { test, expect } from '@playwright/test'

for (const brand of ['classic', 'aurora']) {
  for (const theme of ['dark', 'light']) {
    test(`Analytics failure and retry state is readable in ${brand} ${theme}`, async ({ page }) => {
      await page.route('**/api/analytics/period?**', (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
      await page.goto(`/analytics-preview.html?brand=${brand}&theme=${theme}`)

      const failure = page.getByRole('alert')
      await expect(failure).toContainText('Analytics could not be loaded')
      await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
      await expect(page.getByText('Completed session reflections will appear here.')).toBeVisible()
      await failure.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByLabel('Retry callback count')).toHaveText('1')
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width)
    })
  }
}
