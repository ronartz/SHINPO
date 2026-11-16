import { chromium } from '../frontend/node_modules/@playwright/test/index.mjs'

async function debug() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('http://localhost:4173/?v2=true&theme=dark')
  await page.waitForLoadState('networkidle')
  const title = await page.title()
  const content = await page.content()
  console.log('Page Title:', title)
  console.log('Is auth card present:', content.includes('auth-card'))
  console.log('Is app shell present:', content.includes('app-shell'))
  console.log('Is topbar present:', content.includes('cockpit-top-bar'))
  await browser.close()
}

debug().catch(console.error)
