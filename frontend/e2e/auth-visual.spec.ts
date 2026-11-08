import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('shinpo_splash_shown', 'true')
  })
})

for (const brand of ['classic', 'aurora']) {
  for (const theme of ['dark', 'light']) {
    test(`${brand} ${theme} auth uses active tokens and supports password visibility`, async ({ page }) => {
      if (test.info().project.name === 'desktop-chrome') {
        await page.addInitScript(() => {
          localStorage.setItem('shinpo_local_vault_account', 'review-user')
          localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'review-user', email: 'review-user@local.shinpo' }))
          Object.defineProperty(window, '__TAURI_INTERNALS__', {
            value: { invoke: async (command: string) => command === 'local_vault_status' ? { unlocked: false, username: null } : null },
          })
        })
      }
      await page.goto(`/?v2=${brand === 'aurora'}&theme=${theme}`)

      const card = page.locator('.auth-card')
      await expect(card).toBeVisible()
      await expect(page.getByRole('heading', { name: /sign in to shinpo|welcome back/i })).toBeVisible()

      if (test.info().project.name === 'desktop-chrome') {
        await page.mouse.move(4, 4)
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
        await page.screenshot({ path: test.info().outputPath(`${brand}-${theme}-auth.png`), fullPage: true })
      }

      const colors = await page.evaluate(() => ({
        brand: document.documentElement.dataset.brand,
        theme: document.documentElement.dataset.theme,
        card: getComputedStyle(document.querySelector('.auth-card')!).backgroundColor,
        primary: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim(),
        focus: getComputedStyle(document.querySelector('#auth-password')!).borderColor,
      }))
      expect(colors.brand).toBe(brand)
      expect(colors.theme).toBe(theme)
      expect(colors.card).not.toBe('rgba(0, 0, 0, 0)')
      expect(colors.primary).toBeTruthy()
      expect(colors.focus).toBeTruthy()

      if (test.info().project.name === 'desktop-chrome') {
        const bounds = await card.boundingBox()
        expect(bounds).not.toBeNull()
        await page.mouse.move(bounds!.x + bounds!.width - 8, bounds!.y + 8)
        await expect.poll(() => card.evaluate((element) => element.style.getPropertyValue('--auth-tilt-y'))).not.toBe('0deg')
        await page.mouse.move(4, 4)
        await expect.poll(() => card.evaluate((element) => element.style.getPropertyValue('--auth-tilt-y'))).toBe('0deg')
      }

      const password = page.getByLabel('Password', { exact: true })
      await password.focus()
      await page.keyboard.press('Tab')
      const toggle = page.getByRole('button', { name: 'Show password' })
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(password).toHaveAttribute('type', 'text')
      await expect(page.getByRole('button', { name: 'Hide password' })).toBeVisible()
    })
  }
}

test('auth card remains usable in a compact window with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?v2=false&theme=light')

  const card = page.locator('.auth-card')
  await expect(card).toBeVisible()
  await expect(page.locator('form').getByRole('button', { name: 'Sign In' })).toBeVisible()
  const layout = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    cardAnimation: getComputedStyle(document.querySelector('.auth-card')!).animationName,
  }))
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.cardAnimation).toBe('none')
  await page.mouse.move(370, 120)
  expect(await card.evaluate((element) => element.style.getPropertyValue('--auth-tilt-y'))).toBe('')
})

test('fresh desktop vault opens workspace creation instead of server sign-in', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: { invoke: async () => null } })
  })
  await page.goto('/?v2=false&theme=dark')

  await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create local workspace' })).toBeVisible()
  await expect(page.getByLabel('Local username')).toBeVisible()
})

test('local unlock submits an existing short password to native auth', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shinpo_local_vault_account', 'legacy-user')
    localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'legacy-user', email: 'legacy-user@local.shinpo' }))
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {
        invoke: async (command: string) => {
          if (command === 'local_vault_status') return { unlocked: false, username: null }
          if (command === 'unlock_local_account') {
            localStorage.setItem('shinpo_test_unlock_called', 'true')
            throw new Error('Authentication failed')
          }
          if (command === 'local_sync_browser_policy') return null
          throw new Error(`Unexpected command: ${command}`)
        },
      },
    })
  })
  await page.goto('/?v2=false&theme=dark')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByLabel('Local username').fill('legacy-user')
  await page.getByLabel('Password', { exact: true }).fill('old-pass')
  await page.getByRole('button', { name: 'Unlock workspace' }).click()

  await expect(page.getByRole('alert')).toHaveText('Authentication failed')
  expect(await page.evaluate(() => localStorage.getItem('shinpo_test_unlock_called'))).toBe('true')
})
