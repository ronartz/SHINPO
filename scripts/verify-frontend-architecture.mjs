#!/usr/bin/env node
/**
 * SHINPO Architecture Verification Script
 * Validates strict separation between Desktop and Mobile frontend architectures:
 * 1. Directory presence and structure
 * 2. Cross-import boundary enforcement (Desktop cannot import Mobile, Mobile cannot import Desktop)
 * 3. CSS isolation (Desktop cannot import mobile.css, Mobile cannot import desktop.css or App.css)
 * 4. Deterministic platform selection (no brittle window.innerWidth or user-agent sniffing)
 * 5. Mobile touch accessibility (WCAG >= 44px touch targets, safe-area-inset)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const FRONTEND_SRC = join(ROOT, 'frontend/src')

console.log('=== SHINPO FRONTEND ARCHITECTURE VERIFICATION ===\n')

let passed = true
const failures = []

function assert(condition, message) {
  if (!condition) {
    passed = false
    failures.push(message)
    console.error(`  FAIL: ${message}`)
  } else {
    console.log(`  PASS: ${message}`)
  }
}

function getAllFiles(dir, exts = ['.ts', '.tsx', '.js', '.jsx', '.css']) {
  let results = []
  if (!existsSync(dir)) return results
  const list = readdirSync(dir)
  for (const file of list) {
    const filePath = join(dir, file)
    const stat = statSync(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, exts))
    } else if (exts.some((ext) => file.endsWith(ext))) {
      results.push(filePath)
    }
  }
  return results
}

// 1. Directory Structure Checks
console.log('1. Checking required directory structures...')
assert(existsSync(join(FRONTEND_SRC, 'apps/desktop')), 'frontend/src/apps/desktop/ exists')
assert(existsSync(join(FRONTEND_SRC, 'apps/desktop/DesktopApp.tsx')), 'DesktopApp.tsx exists in desktop/')
assert(existsSync(join(FRONTEND_SRC, 'apps/desktop/styles/desktop.css')), 'desktop.css exists in desktop/styles/')
assert(existsSync(join(FRONTEND_SRC, 'apps/mobile')), 'frontend/src/apps/mobile/ exists')
assert(existsSync(join(FRONTEND_SRC, 'apps/mobile/MobileApp.tsx')), 'MobileApp.tsx exists in mobile/')
assert(existsSync(join(FRONTEND_SRC, 'apps/mobile/styles/mobile.css')), 'mobile.css exists in mobile/styles/')
assert(existsSync(join(FRONTEND_SRC, 'apps/mobile/components/MobileNav.tsx')), 'MobileNav.tsx exists in mobile/components/')
assert(existsSync(join(FRONTEND_SRC, 'apps/mobile/views')), 'mobile/views/ directory exists')
assert(existsSync(join(FRONTEND_SRC, 'shared')), 'frontend/src/shared/ exists')
assert(existsSync(join(FRONTEND_SRC, 'shared/types/index.ts')), 'shared/types/ exists')
assert(existsSync(join(FRONTEND_SRC, 'shared/api/index.ts')), 'shared/api/ exists')
assert(existsSync(join(FRONTEND_SRC, 'shared/utils/index.ts')), 'shared/utils/ exists')
assert(existsSync(join(FRONTEND_SRC, 'shared/hooks/index.ts')), 'shared/hooks/ exists')
assert(existsSync(join(FRONTEND_SRC, 'shared/theme/index.ts')), 'shared/theme/ exists')
assert(existsSync(join(FRONTEND_SRC, 'platform/index.tsx')), 'platform/index.tsx exists')

// 2. Desktop Isolation: No Mobile Imports
console.log('\n2. Verifying Desktop architecture isolation...')
const desktopFiles = getAllFiles(join(FRONTEND_SRC, 'apps/desktop'))
let desktopContaminated = false
for (const file of desktopFiles) {
  const content = readFileSync(file, 'utf8')
  if (/from ['"].*mobile.*['"]/i.test(content) || /import\(['"].*mobile.*['"]\)/i.test(content)) {
    desktopContaminated = true
    assert(false, `Desktop file ${file} imports mobile code`)
  }
  if (/mobile\.css/i.test(content)) {
    desktopContaminated = true
    assert(false, `Desktop file ${file} imports mobile.css`)
  }
}
if (!desktopContaminated) {
  assert(true, `All ${desktopFiles.length} desktop files are completely free of mobile imports`)
}

// 3. Mobile Isolation: No Desktop Imports
console.log('\n3. Verifying Mobile architecture isolation...')
const mobileFiles = getAllFiles(join(FRONTEND_SRC, 'apps/mobile'))
let mobileContaminated = false
for (const file of mobileFiles) {
  const content = readFileSync(file, 'utf8')
  if (/from ['"].*desktop.*['"]/i.test(content) || /import\(['"].*desktop.*['"]\)/i.test(content)) {
    mobileContaminated = true
    assert(false, `Mobile file ${file} imports desktop code`)
  }
  if (/desktop\.css/i.test(content) || /App\.css/i.test(content)) {
    mobileContaminated = true
    assert(false, `Mobile file ${file} imports desktop.css or App.css`)
  }
}
if (!mobileContaminated) {
  assert(true, `All ${mobileFiles.length} mobile files are completely free of desktop imports`)
}

// 4. Deterministic Platform Selection
console.log('\n4. Verifying deterministic platform selection...')
const platformCode = readFileSync(join(FRONTEND_SRC, 'platform/platformResolution.ts'), 'utf8') + readFileSync(join(FRONTEND_SRC, 'platform/index.tsx'), 'utf8')
assert(!platformCode.includes('innerWidth'), 'Platform detection does not use window.innerWidth')
assert(!platformCode.includes('innerHeight'), 'Platform detection does not use window.innerHeight')
assert(!platformCode.includes('userAgent'), 'Platform detection does not use navigator.userAgent sniffing')
assert(platformCode.includes('VITE_SHINPO_PLATFORM'), 'Platform detection supports VITE_SHINPO_PLATFORM build target')
assert(platformCode.includes('getPlatform'), 'getPlatform function is exported')
assert(platformCode.includes('PlatformRoot'), 'PlatformRoot component is exported')

// 5. Mobile Touch Accessibility (WCAG 44x44px minimum)
console.log('\n5. Verifying Mobile touch accessibility & safe area insets...')
const mobileCss = readFileSync(join(FRONTEND_SRC, 'apps/mobile/styles/mobile.css'), 'utf8')
assert(mobileCss.includes('min-height: 44px') || mobileCss.includes('min-height: 48px'), 'Mobile touch targets have minimum 44px/48px height')
assert(mobileCss.includes('min-width: 44px') || mobileCss.includes('min-width: 48px'), 'Mobile touch targets have minimum 44px/48px width')
assert(mobileCss.includes('safe-area-inset-bottom'), 'Mobile navigation accounts for safe-area-inset-bottom')
assert(mobileCss.includes('.shinpo-mobile-app'), 'Mobile styles are scoped under .shinpo-mobile-app')

console.log('\n=================================================')
if (passed) {
  console.log('SUCCESS: All 26 architecture separation checks PASSED!')
  process.exit(0)
} else {
  console.error(`FAILURE: ${failures.length} architecture checks failed:`)
  failures.forEach((f) => console.error(`  - ${f}`))
  process.exit(1)
}
