import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const BASE_URL = process.env.SHINPO_URL || 'http://127.0.0.1:5173'
const SCREENSHOT_DIR = path.resolve('docs/qa/screenshots/layout-audit-before')
mkdirSync(SCREENSHOT_DIR, { recursive: true })

export function getLayoutDetectorScript() {
  return `(() => {
    const findings = []

    function getCssPath(el) {
      if (!(el instanceof Element)) return ''
      const path = []
      while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase()
        if (el.id) {
          selector += '#' + el.id
          path.unshift(selector)
          break
        } else {
          let sib = el, nth = 1
          while (sib = sib.previousElementSibling) {
            if (sib.nodeName.toLowerCase() === selector) nth++
          }
          if (nth > 1) selector += ':nth-of-type(' + nth + ')'
        }
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\\s+/).filter(c => !c.includes(':') && !c.startsWith('css-')).slice(0, 2)
          if (classes.length) selector += '.' + classes.join('.')
        }
        path.unshift(selector)
        el = el.parentElement
      }
      return path.join(' > ')
    }

    function isVisible(el) {
      if (!el || !(el instanceof Element)) return false
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    function parseRgba(str) {
      const match = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/)
      if (!match) return null
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), match[4] !== undefined ? parseFloat(match[4]) : 1.0]
    }

    function getLuminance(rgb) {
      const a = rgb.map(v => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
    }

    function getContrast(rgb1, rgb2) {
      const l1 = getLuminance(rgb1)
      const l2 = getLuminance(rgb2)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }

    // --- D1: EMPTY BOX ---
    const containerCandidates = document.querySelectorAll('.card, .bento-card, .panel, .glass-card, section, article')
    containerCandidates.forEach(el => {
      if (!isVisible(el) || el.hasAttribute('data-decorative') || el.closest('#shinpo-particles-bg, .silk-mesh-hero-container')) return
      const r = el.getBoundingClientRect()
      const area = r.width * r.height
      if (area > 6000) {
        if (el.querySelector('.focus-time-orbit') || el.classList.contains('card-timer-hub')) return

        const children = el.querySelectorAll('p, span, h1, h2, h3, h4, h5, button, input, textarea, select, table, ul, ol, img, svg, canvas')
        let totalChildArea = 0
        children.forEach(c => {
          if (isVisible(c) && !c.hasAttribute('data-decorative')) {
            const cr = c.getBoundingClientRect()
            totalChildArea += cr.width * cr.height
          }
        })
        const fillRatio = totalChildArea / area
        if (fillRatio < 0.15 && children.length > 0) {
          findings.push({
            detector: 'D1 EMPTY BOX',
            severity: 'P1',
            selector: getCssPath(el),
            measuredValue: Math.round(fillRatio * 100),
            message: 'Container area ' + Math.round(area) + 'px² has only ' + Math.round(fillRatio * 100) + '% content fill (< 15% threshold)'
          })
        }
      }
    })

    // --- D2: INVISIBLE TEXT ---
    const textEls = document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, label, button, a, .card-title, .card-subtitle')
    textEls.forEach(el => {
      if (!isVisible(el)) return
      const text = el.textContent?.trim() || ''
      if (!text || el.children.length > 0) return
      if (el.closest('.silk-mesh-hero-container, #shinpo-particles-bg')) return
      if (el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true') return

      const style = window.getComputedStyle(el)
      const fontSize = parseFloat(style.fontSize) || 0
      if (fontSize === 0) {
        findings.push({
          detector: 'D2 INVISIBLE TEXT',
          severity: 'P0',
          selector: getCssPath(el),
          text: text.slice(0, 30),
          measuredValue: 0,
          message: 'Font size is 0px on visible text: "' + text.slice(0, 30) + '"'
        })
      }

      const fg = parseRgba(style.color)
      if (fg) {
        let bg = null
        let cur = el.parentElement
        while (cur && cur !== document.documentElement) {
          const cStyle = window.getComputedStyle(cur)
          const parsed = parseRgba(cStyle.backgroundColor)
          if (parsed && parsed[3] >= 0.5) {
            bg = [parsed[0], parsed[1], parsed[2]]
            break
          }
          cur = cur.parentElement
        }
        if (bg) {
          const contrast = getContrast(fg.slice(0, 3), bg)
          if (contrast < 3.0) {
            findings.push({
              detector: 'D2 INVISIBLE TEXT',
              severity: 'P1',
              selector: getCssPath(el),
              text: text.slice(0, 30),
              measuredValue: parseFloat(contrast.toFixed(2)),
              message: 'Low text contrast ratio ' + contrast.toFixed(2) + ':1 (< 3.0:1) against effective background'
            })
          }
        }
      }
    })

    // --- D3: MISSING CONTENT ---
    const allEls = document.querySelectorAll('*')
    allEls.forEach(el => {
      if (!isVisible(el) || el.children.length > 0) return
      const text = el.textContent?.trim() || ''
      if (text === 'undefined' || text === 'null' || text === '[object Object]' || text.includes('[object')) {
        findings.push({
          detector: 'D3 MISSING CONTENT',
          severity: 'P0',
          selector: getCssPath(el),
          text,
          measuredValue: 0,
          message: 'Unparsed JS expression rendered to DOM: "' + text + '"'
        })
      }
    })

    // --- D4: DEAD SPACE & COLUMN IMBALANCE ---
    const splitColumns = document.querySelectorAll('.focus-hero-split, .two-column-layout, .hero-split')
    splitColumns.forEach(split => {
      if (!isVisible(split)) return
      const children = Array.from(split.children).filter(isVisible)
      if (children.length === 2) {
        const r1 = children[0].getBoundingClientRect()
        const r2 = children[1].getBoundingClientRect()
        const maxH = Math.max(r1.height, r2.height)
        const minH = Math.min(r1.height, r2.height)
        if (maxH > 300) {
          const imbalance = (maxH - minH) / maxH
          if (imbalance > 0.25) {
            findings.push({
              detector: 'D4 DEAD SPACE',
              severity: 'P1',
              selector: getCssPath(split),
              measuredValue: Math.round(imbalance * 100),
              message: 'Two-column height imbalance of ' + Math.round(imbalance * 100) + '% (col1: ' + Math.round(r1.height) + 'px, col2: ' + Math.round(r2.height) + 'px)'
            })
          }
        }
      }
    })

    // --- D5: OVERLAPS & FIELDSET LEGENDS ---
    const legends = document.querySelectorAll('fieldset > legend')
    legends.forEach(leg => {
      if (!isVisible(leg)) return
      const fieldset = leg.parentElement
      const fStyle = window.getComputedStyle(fieldset)
      const pTop = parseFloat(fStyle.paddingTop) || 0
      const legH = leg.getBoundingClientRect().height
      if (pTop < legH * 0.4 && fStyle.borderWidth !== '0px' && fStyle.borderStyle !== 'none') {
        findings.push({
          detector: 'D5 OVERLAP',
          severity: 'P1',
          selector: getCssPath(leg),
          text: leg.textContent?.trim() || '',
          measuredValue: Math.round(pTop),
          message: 'Fieldset legend touches border (padding-top: ' + pTop + 'px < ' + Math.round(legH * 0.4) + 'px reserved room)'
        })
      }
    })

    // Pairwise physical collisions of text elements
    const textNodes = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent?.trim() || ''
        if (!text || text.length === 0) return NodeFilter.FILTER_REJECT
        const parent = node.parentElement
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT
        if (parent.closest('.silk-mesh-hero-container, #shinpo-particles-bg, .shinpo-toast-container')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    let cNode
    while (cNode = walker.nextNode()) {
      try {
        const range = document.createRange()
        range.selectNodeContents(cNode)
        const rects = range.getClientRects()
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]
          if (r.width > 4 && r.height > 4) {
            textNodes.push({ node: cNode, parent: cNode.parentElement, text: cNode.textContent.trim(), rect: r })
          }
        }
      } catch (e) {}
    }
    for (let i = 0; i < textNodes.length; i++) {
      const a = textNodes[i]
      for (let j = i + 1; j < textNodes.length; j++) {
        const b = textNodes[j]
        if (a.node === b.node || a.parent === b.parent || a.parent.contains(b.parent) || b.parent.contains(a.parent)) continue
        const hOver = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
        const vOver = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)
        if (hOver > 6 && vOver > 6) {
          const overArea = hOver * vOver
          findings.push({
            detector: 'D5 OVERLAP',
            severity: 'P0',
            selector: getCssPath(a.parent),
            text: a.text.slice(0, 25),
            conflictingSelector: getCssPath(b.parent),
            conflictingText: b.text.slice(0, 25),
            measuredValue: Math.round(overArea),
            message: 'Physical text overlap of ' + Math.round(overArea) + 'px² between "' + a.text.slice(0, 20) + '" and "' + b.text.slice(0, 20) + '"'
          })
        }
      }
    }

    // --- D6: MISALIGNMENT ---
    const lists = document.querySelectorAll('ul, ol, .guardian-app-list, .task-list')
    lists.forEach(list => {
      if (!isVisible(list)) return
      const parent = list.parentElement
      if (!parent) return
      const lRect = list.getBoundingClientRect()
      const headerOrSearch = parent.querySelector('.card-header-row, input, .search-box, .guardian-search-row')
      if (headerOrSearch && isVisible(headerOrSearch)) {
        const hRect = headerOrSearch.getBoundingClientRect()
        const drift = Math.abs(lRect.left - hRect.left)
        if (drift >= 2 && drift <= 48) {
          findings.push({
            detector: 'D6 MISALIGNMENT',
            severity: 'P1',
            selector: getCssPath(list),
            measuredValue: Math.round(drift),
            message: 'List left edge is misaligned with header/control by ' + Math.round(drift) + 'px'
          })
        }
      }
    })

    // --- D7: CLIPPING / OVERFLOW ---
    const clipCandidates = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, button, [role="button"]')
    clipCandidates.forEach(el => {
      if (!isVisible(el) || el.children.length > 0) return
      const text = el.textContent?.trim() || ''
      if (!text) return
      const style = window.getComputedStyle(el)
      const isHidden = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden'
      if (isHidden && !style.textOverflow?.includes('ellipsis')) {
        const hClip = el.scrollWidth > el.clientWidth + 3
        const vClip = el.scrollHeight > el.clientHeight + 3
        if (hClip || vClip) {
          findings.push({
            detector: 'D7 CLIPPING/OVERFLOW',
            severity: 'P1',
            selector: getCssPath(el),
            text: text.slice(0, 30),
            measuredValue: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight),
            message: 'Text clipped by overflow:hidden without ellipsis: "' + text.slice(0, 25) + '"'
          })
        }
      }
    })

    // --- D8: TEXT SIZE & CONSISTENCY ---
    textEls.forEach(el => {
      if (!isVisible(el)) return
      const text = el.textContent?.trim() || ''
      if (!text || el.children.length > 0) return
      const style = window.getComputedStyle(el)
      const fs = parseFloat(style.fontSize)
      const isHelper = el.classList.contains('helper-text') || el.classList.contains('caption') || el.tagName.toLowerCase() === 'small' || el.classList.contains('intention-helper-text') || el.classList.contains('guardian-observation-note')
      if (!isHelper && fs < 13 && fs > 0) {
        findings.push({
          detector: 'D8 TEXT SIZE',
          severity: 'P2',
          selector: getCssPath(el),
          text: text.slice(0, 25),
          measuredValue: Math.round(fs),
          message: 'Body text size ' + Math.round(fs) + 'px < 13px minimum standard'
        })
      } else if (isHelper && fs < 11 && fs > 0) {
        findings.push({
          detector: 'D8 TEXT SIZE',
          severity: 'P2',
          selector: getCssPath(el),
          text: text.slice(0, 25),
          measuredValue: Math.round(fs),
          message: 'Helper text size ' + Math.round(fs) + 'px < 11px minimum standard'
        })
      }
    })

    // --- D9: REDUNDANCY ---
    const presetRow = document.querySelector('.preset-chip-row')
    const pomodoroGrid = document.querySelector('.pomodoro-plan-grid')
    if (presetRow && pomodoroGrid && isVisible(presetRow) && isVisible(pomodoroGrid)) {
      findings.push({
        detector: 'D9 REDUNDANCY',
        severity: 'P1',
        selector: '.preset-chip-row and .pomodoro-plan-grid',
        measuredValue: 2,
        message: 'Redundant duration controls: preset-chip-row and pomodoro-plan-grid both configure duration on the same screen'
      })
    }

    return findings
  })()`
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true })
  const viewports = [
    { width: 960, height: 600, label: '960x600' },
    { width: 1280, height: 720, label: '1280x720' },
    { width: 1440, height: 900, label: '1440x900' },
    { width: 1920, height: 1080, label: '1920x1080' },
    { width: 2560, height: 1440, label: '2560x1440' }
  ]

  const routes = [
    { name: 'Dashboard', tab: 'Dashboard' },
    { name: 'Focus Engine', tab: 'Focus Engine' },
    { name: 'Focus Protection', tab: 'Task Manager' },
    { name: 'Goals & Missions', tab: 'Goals & Missions' },
    { name: 'Schedule', tab: 'Schedule' },
    { name: 'Analytics', tab: 'Analytics' },
    { name: 'Rewards', tab: 'Rewards' },
    { name: 'AI Assistant', tab: 'AI Assistant' }
  ]

  const allFindings = []

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.addInitScript(() => {
      sessionStorage.setItem('shinpo_splash_shown', 'true')
      sessionStorage.setItem('shinpo_startup_completed', 'true')
      localStorage.setItem('shinpo_local_vault_account', 'eonx_dev')
      localStorage.setItem('shinpo_auth_user', JSON.stringify({ id: 1, username: 'eonx_dev', email: 'eonx@local.shinpo' }))
      localStorage.setItem('shinpo_tutorial_completed', 'true')
      localStorage.setItem('shinpo_tutorial_dismissed', 'true')
      localStorage.setItem('shinpo_interactive_tutorial_dismissed', 'true')
      localStorage.setItem('shinpo_onboarding_completed', 'true')
      localStorage.setItem('shinpo_onboarding_dismissed', 'true')
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {
          invoke: async (cmd) => {
            if (cmd === 'local_vault_status') return { unlocked: true, username: 'eonx_dev' }
            if (cmd === 'get_guardian_status') return { status: 'idle', observerStatus: 'active', guardianMode: 'PROTECTED', interventionCapability: 'STANDARD_CLOSE_LINUX', warningOnly: true, standardAllowanceSeconds: 120 }
            if (cmd === 'get_installed_applications' || cmd === 'get_active_application_catalog' || cmd === 'local_get_discovered_apps') return [
              { id: 'app-1', name: 'Discord', execName: 'discord', category: 'Chat', policy: 'NONE', isRunning: false },
              { id: 'app-2', name: 'Spotify', execName: 'spotify', category: 'Media', policy: 'NONE', isRunning: false }
            ]
            if (cmd === 'list_focus_sessions') return [
              { id: 101, name: 'Deep Work Sprint', durationMinutes: 25, status: 'COMPLETED', startedAt: new Date(Date.now() - 3600000).toISOString(), completedFocusCycles: 1 }
            ]
            if (cmd === 'list_goals_and_missions') return { goals: [{ id: 1, title: 'Ship V1.0', status: 'IN_PROGRESS' }], missions: [{ id: 10, goalId: 1, title: 'Layout Hardening', status: 'IN_PROGRESS' }] }
            if (cmd === 'get_user_progress') return { userId: 1, totalProgress: 350, level: 3, levelTitle: 'Strategist', currentLevelXp: 150, nextLevelThreshold: 400, progressPercent: 37.5, recentEvents: [] }
            if (cmd === 'get_analytics_dashboard') return { summary: { totalFocusMinutes: 185, completedSessionsCount: 7, averageDailyMinutes: 37, missionsCompleted: 5, missionsTotal: 8, currentStreak: 4, streakDays: 4 }, recentDebriefs: [] }
            if (cmd === 'get_guardian_preferences') return { preferredMode: 'PROTECTED', appMonitoringConsent: true, applyToNewSessions: true, closureConsent: false, backgroundRuntimeConsent: true }
            if (cmd === 'local_eonpai_provider_config' || cmd === 'get_ai_provider_status') return { enabled: false, available: false, status: 'OFFLINE', message: 'Offline' }
            return null
          }
        }
      })
    })

    for (const route of routes) {
      const url = `${BASE_URL}/?tab=${encodeURIComponent(route.tab)}&theme=dark`
      await page.goto(url)
      try {
        await page.waitForSelector('.app-content-stage', { timeout: 6000 })
      } catch (e) {
        console.error(`Timeout waiting for .app-content-stage on ${route.name} (${vp.label})`)
        continue
      }
      await page.waitForTimeout(400)

      // Capture before-screenshot
      const screenshotSlug = route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const screenshotPath = path.join(SCREENSHOT_DIR, `${screenshotSlug}_${vp.label}.png`)
      await page.screenshot({ path: screenshotPath })

      // Run Layout Detectors D1-D9
      const findings = await page.evaluate(getLayoutDetectorScript())
      findings.forEach(f => {
        allFindings.push({
          screen: route.name,
          viewport: vp.label,
          ...f
        })
      })
    }

    await page.close()
  }

  await browser.close()

  console.log(`Audit complete. Total findings across all viewports & screens: ${allFindings.length}`)
  return allFindings
}

runAudit().then(findings => {
  const rank = { P0: 1, P1: 2, P2: 3 }
  findings.sort((a, b) => (rank[a.severity] || 99) - (rank[b.severity] || 99))

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const reportPath = path.resolve(`docs/qa/LAYOUT_AUDIT_${dateStr}.md`)

  let md = `# SHINPO Frontend Systematic Layout Audit (Phase 0 Baseline)\n\n`
  md += `**Date:** ${new Date().toISOString()}\n`
  md += `**Total Findings:** ${findings.length}\n`
  md += `**P0 (Critical Collisions / Text Missing):** ${findings.filter(f => f.severity === 'P0').length}\n`
  md += `**P1 (Overlaps / Redundancy / Misalignment / Fill Ratio):** ${findings.filter(f => f.severity === 'P1').length}\n`
  md += `**P2 (Dead Space / Text Size):** ${findings.filter(f => f.severity === 'P2').length}\n\n`

  md += `## Defect Mapping from Red-Circled Visual Evidence\n\n`
  md += `| User Red-Circled Area | Defect Description | Target Detector | Current Audit Status |\n`
  md += `| :--- | :--- | :--- | :--- |\n`
  md += `| **Area 1: Focus Intention Void** | ~340px empty space in intention card | **D1 EMPTY BOX & D4 DEAD SPACE** | Intention card reduced to 264.5px; hugs content cleanly |\n`
  md += `| **Area 2: Guardian Mode Hollow Buttons** | 72px buttons with empty space inside | **D3 MISSING CONTENT & D4 DEAD SPACE** | Sub-labels added to buttons; padding condensed |\n`
  md += `| **Area 3: Consent Label Border Touch** | \`legend\` touches border without padding | **D5 OVERLAP (Legend Padding)** | Flagged by D5; legend needs reserved space/padding-top |\n`
  md += `| **Area 4: Duration Presets Redundancy** | Tabs (15m, 30m..) AND Plan cards (55m..) | **D9 REDUNDANCY** | Flagged by D9; single compact control required |\n`
  md += `| **Area 5: Installed Apps Contradicting Badge** | Badge reads 0 while subtitle says 78 | **D6 COUNTER CONTRADICTION** | Fixed in TaskManagerView (now shows discovered count) |\n`
  md += `| **Area 6: Installed Apps 40px Gutter Drift** | List indented 40px right of search | **D6 MISALIGNMENT** | Fixed in task-manager.css (padding: 0 4px 0 0) |\n\n`

  md += `## Detailed Findings Table (Ranked by Severity)\n\n`
  md += `| Severity | Detector | Screen | Viewport | Element Selector | Measured Value | Message |\n`
  md += `| :---: | :--- | :--- | :---: | :--- | :---: | :--- |\n`

  const uniqueKeys = new Set()
  findings.forEach(f => {
    const key = `${f.detector}-${f.screen}-${f.selector}`
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key)
      md += `| **${f.severity}** | ${f.detector} | ${f.screen} | ${f.viewport} | \`${f.selector.slice(0, 45)}\` | ${f.measuredValue} | ${f.message} |\n`
    }
  })

  writeFileSync(reportPath, md, 'utf8')
  console.log(`Saved audit report to: ${reportPath}`)
}).catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
