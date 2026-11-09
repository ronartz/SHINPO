/**
 * SHINPO Automated Layout Geometry & Text Collision Engine
 * Reusable test utility to detect:
 * 1. Text vs text physical collisions (Range.getClientRects() bounding boxes)
 * 2. Text clipping & unintended overflow
 * 3. Insufficient text gaps (headings, descriptions, badges, metadata)
 * 4. Card dead-space & low content-to-container ratio
 * 5. Viewport overflow & misalignment
 */

export interface RectBounds {
  x: number
  y: number
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export type FindingSeverity = 'P0' | 'P1' | 'P2'
export type FindingType =
  | 'COLLISION'
  | 'CLIPPING'
  | 'INSUFFICIENT_GAP'
  | 'DEAD_SPACE'
  | 'OVERFLOW'
  | 'ALIGNMENT'
  | 'OCCLUSION'
  | 'THEME_LEAK'
  | 'CONTRAST'
  | 'MISSING_GLASS'
  | 'DUPLICATE_ACTION'

export interface VisualFinding {
  type: FindingType
  severity: FindingSeverity
  screen: string
  theme: string
  viewport: string
  focusState: string
  selector: string
  text?: string
  conflictingSelector?: string
  conflictingText?: string
  bounds?: RectBounds
  conflictingBounds?: RectBounds
  measuredValue: number
  message: string
}

export interface VisualAuditReport {
  timestamp: string
  screen: string
  theme: string
  viewport: string
  focusState: string
  totalFindings: number
  p0Count: number
  p1Count: number
  p2Count: number
  hasHorizontalScroll: boolean
  hasHorizontalOverflow: boolean
  findings: VisualFinding[]
}

/**
 * Client-side evaluation function passed to page.evaluate()
 */
export function getBrowserGeometryAuditScript() {
  return `(() => {
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

    const findings = []

    // 1. VIEWPORT OVERFLOW CHECK
    const docEl = document.documentElement
    const scrollWidth = docEl.scrollWidth
    const clientWidth = docEl.clientWidth
    const hasHorizontalOverflow = scrollWidth > clientWidth + 4
    if (hasHorizontalOverflow) {
      findings.push({
        type: 'OVERFLOW',
        severity: 'P0',
        selector: 'html',
        measuredValue: scrollWidth - clientWidth,
        message: 'Unexpected document horizontal scrolling: scrollWidth (' + scrollWidth + 'px) exceeds clientWidth (' + clientWidth + 'px) by ' + (scrollWidth - clientWidth) + 'px'
      })
    }

    // 2. TEXT EXTRACTION & COLLISION DETECTION
    const textNodes = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.textContent?.trim() || ''
        if (!text || text.length === 0) return NodeFilter.FILTER_REJECT
        const parent = node.parentElement
        if (!parent || !isVisible(parent)) return NodeFilter.FILTER_REJECT
        const tag = parent.tagName.toLowerCase()
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'canvas') return NodeFilter.FILTER_REJECT
        // Ignore silk background canvas or particles
        if (parent.closest('.silk-mesh-hero-container') || parent.closest('#shinpo-particles-bg')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })

    let currentNode
    while (currentNode = walker.nextNode()) {
      if (currentNode.parentElement && currentNode.parentElement.closest('.shinpo-toast-container, .shinpo-toast')) {
        continue
      }
      try {
        const range = document.createRange()
        range.selectNodeContents(currentNode)
        const rects = range.getClientRects()
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i]
          let vLeft = r.left
          let vRight = r.right
          let vTop = r.top
          let vBottom = r.bottom

          // Clip against any overflow:hidden/clip ancestors so hidden text isn't treated as visible collisions
          let ancestor = currentNode.parentElement
          while (ancestor && ancestor !== document.body) {
            const aStyle = window.getComputedStyle(ancestor)
            if (aStyle.overflow === 'hidden' || aStyle.overflowX === 'hidden' || aStyle.overflowY === 'hidden' ||
                aStyle.overflow === 'clip' || aStyle.overflowX === 'clip' || aStyle.overflowY === 'clip') {
              const aRect = ancestor.getBoundingClientRect()
              vLeft = Math.max(vLeft, aRect.left)
              vRight = Math.min(vRight, aRect.right)
              vTop = Math.max(vTop, aRect.top)
              vBottom = Math.min(vBottom, aRect.bottom)
            }
            ancestor = ancestor.parentElement
          }

          const vWidth = Math.max(0, vRight - vLeft)
          const vHeight = Math.max(0, vBottom - vTop)

          if (vWidth > 3 && vHeight > 3) {
            textNodes.push({
              node: currentNode,
              parent: currentNode.parentElement,
              text: currentNode.textContent.trim(),
              rect: {
                x: vLeft, y: vTop, width: vWidth, height: vHeight,
                top: vTop, right: vRight, bottom: vBottom, left: vLeft
              }
            })
          }
        }
      } catch (e) {
        // Range selection error on dynamic DOM
      }
    }

    // Pairwise collision test
    for (let i = 0; i < textNodes.length; i++) {
      const a = textNodes[i]
      for (let j = i + 1; j < textNodes.length; j++) {
        const b = textNodes[j]
        // Same text node or common immediate ancestor container (e.g. <span><b>One</b> two</span>)
        if (a.node === b.node) continue
        if (a.parent === b.parent) continue
        if (a.parent.contains(b.parent) || b.parent.contains(a.parent)) continue

        // Overlap calculation
        const horizOverlap = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
        const vertOverlap = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)

        if (horizOverlap > 4 && vertOverlap > 4) {
          const areaA = a.rect.width * a.rect.height
          const areaB = b.rect.width * b.rect.height
          const overlapArea = horizOverlap * vertOverlap
          const minArea = Math.min(areaA, areaB)
          const overlapRatio = overlapArea / minArea

          // Check if one is a modal/dialog/toast/drawer overlaying the main app
          const overlaySelector = '[role="dialog"], [role="alert"], .modal-overlay, .dropdown-menu, .popover, .shinpo-tutorial-portal, .coachmark-portal, .shinpo-toast-portal, .shinpo-toast-container, .shinpo-toast, .telemetry-drawer, .celebration-modal-overlay'
          const modalA = a.parent.closest(overlaySelector)
          const modalB = b.parent.closest(overlaySelector)
          if ((modalA && !modalB) || (!modalA && modalB) || (modalA && modalB && modalA !== modalB)) continue

          if (overlapRatio > 0.35) {
            findings.push({
              type: 'COLLISION',
              severity: 'P0',
              selector: getCssPath(a.parent),
              text: a.text.slice(0, 40),
              conflictingSelector: getCssPath(b.parent),
              conflictingText: b.text.slice(0, 40),
              bounds: a.rect,
              conflictingBounds: b.rect,
              measuredValue: Math.round(overlapArea),
              message: 'Physical text overlap of ' + Math.round(overlapArea) + 'px² (' + Math.round(overlapRatio * 100) + '%) between "' + a.text.slice(0, 30) + '" and "' + b.text.slice(0, 30) + '"'
            })
          }
        }
      }
    }

    // 3. TEXT CLIPPING CHECK
    const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, p, span, button, .badge, [role="button"]')
    candidates.forEach(el => {
      if (!isVisible(el)) return
      if (el.closest('.silk-mesh-hero-container') || el.closest('#shinpo-particles-bg')) return
      const style = window.getComputedStyle(el)
      const isHidden = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden'
      if (isHidden && !style.textOverflow?.includes('ellipsis')) {
        const text = el.textContent?.trim() || ''
        if (text.length > 0 && el.children.length === 0) {
          const hClip = el.scrollWidth > el.clientWidth + 3
          const vClip = el.scrollHeight > el.clientHeight + 3
          if (hClip || vClip) {
            findings.push({
              type: 'CLIPPING',
              severity: 'P1',
              selector: getCssPath(el),
              text: text.slice(0, 40),
              bounds: el.getBoundingClientRect(),
              measuredValue: Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight),
              message: 'Text clipped by overflow:hidden without ellipsis: "' + text.slice(0, 30) + '"'
            })
          }
        }
      }
    })

    // 4. INSUFFICIENT VERTICAL GAP CHECK (Headings to sibling descriptions)
    const headings = document.querySelectorAll('h1, h2, h3, h4, .card-title, .section-heading')
    headings.forEach(heading => {
      if (!isVisible(heading)) return
      const next = heading.nextElementSibling
      if (next && isVisible(next)) {
        const tag = next.tagName.toLowerCase()
        if (tag === 'p' || next.classList.contains('description') || next.classList.contains('subtitle') || next.classList.contains('card-subtitle')) {
          const rHead = heading.getBoundingClientRect()
          const rNext = next.getBoundingClientRect()
          const gap = rNext.top - rHead.bottom
          if (gap < 2) {
            findings.push({
              type: 'INSUFFICIENT_GAP',
              severity: 'P1',
              selector: getCssPath(heading),
              text: heading.textContent?.trim().slice(0, 30),
              conflictingSelector: getCssPath(next),
              conflictingText: next.textContent?.trim().slice(0, 30),
              bounds: rHead,
              conflictingBounds: rNext,
              measuredValue: gap,
              message: 'Inadequate vertical gap (' + Math.round(gap) + 'px < 2px) between heading and description'
            })
          }
        }
      }
    })

    // 5. DEAD SPACE DETECTOR (Unusually tall cards with sparse visible content)
    const cards = document.querySelectorAll('.card, .panel, .glass-card, .dashboard-card, .analytics-card')
    cards.forEach(card => {
      if (!isVisible(card)) return
      const rCard = card.getBoundingClientRect()
      // Skip the main focus timer circle / dial which intentionally preserves breathing room
      if (card.closest('.focus-workspace-container') || card.querySelector('.focus-timer-display') || card.querySelector('.timer-circle')) return
      
      if (rCard.height > 300) {
        // Measure children content bounds
        let minTop = Infinity, maxBottom = -Infinity
        const children = card.querySelectorAll('h1, h2, h3, h4, p, span, button, input, table, ul, ol, .badge')
        children.forEach(c => {
          if (isVisible(c)) {
            const r = c.getBoundingClientRect()
            if (r.top < minTop) minTop = r.top
            if (r.bottom > maxBottom) maxBottom = r.bottom
          }
        })
        if (minTop !== Infinity && maxBottom !== -Infinity) {
          const contentHeight = maxBottom - minTop
          const emptyRatio = 1 - (contentHeight / rCard.height)
          if (emptyRatio > 0.70 && contentHeight < 80) {
            findings.push({
              type: 'DEAD_SPACE',
              severity: 'P2',
              selector: getCssPath(card),
              bounds: rCard,
              measuredValue: Math.round(emptyRatio * 100),
              message: 'Card height is ' + Math.round(rCard.height) + 'px but visible content occupies only ' + Math.round(contentHeight) + 'px (' + Math.round(emptyRatio * 100) + '% dead void)'
            })
          }
        }
      }
    })

    // 6. OCCLUSION & HIT-TESTING CHECK (Dropdown menus, popups, overlays, interactive controls)
    const openMenusAndOverlays = document.querySelectorAll(
      '.cockpit-dropdown-menu, #account-dropdown-menu, #power-dropdown-menu, .tasks-overflow-dropdown, [role="menu"], [role="dialog"], .dropdown-menu, .settings-modal-card'
    )
    openMenusAndOverlays.forEach(container => {
      if (!isVisible(container)) return
      const interactiveItems = container.querySelectorAll('button, a, [role="menuitem"], input, select, .dropdown-menu-item')
      interactiveItems.forEach(item => {
        if (!isVisible(item)) return
        const r = item.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        if (cx >= 0 && cx < window.innerWidth && cy >= 0 && cy < window.innerHeight) {
          const hit = document.elementFromPoint(cx, cy)
          if (hit && !item.contains(hit) && !hit.contains(item)) {
            findings.push({
              type: 'OCCLUSION',
              severity: 'P0',
              selector: getCssPath(item),
              text: item.textContent?.trim().slice(0, 30),
              conflictingSelector: getCssPath(hit),
              conflictingText: hit.textContent?.trim().slice(0, 30),
              bounds: r,
              conflictingBounds: hit.getBoundingClientRect(),
              measuredValue: 1,
              message: 'Interactive item "' + item.textContent?.trim().slice(0, 25) + '" is occluded at (' + Math.round(cx) + ',' + Math.round(cy) + ') by ' + getCssPath(hit)
            })
          }
        }
      })
    })

    // 7. LIGHT MODE DARK SHADOW / THEME LEAK DETECTOR
    const currentTheme = document.documentElement.getAttribute('data-theme')
    const isLightTheme = currentTheme === 'light' || document.body.classList.contains('theme-light') || document.documentElement.classList.contains('theme-light')
    if (isLightTheme) {
      const surfaceEls = document.querySelectorAll('.card, .panel, .bento-card, .status-column, .cockpit-top-bar, .empty-state')
      surfaceEls.forEach(el => {
        if (!isVisible(el)) return
        const style = window.getComputedStyle(el)
        if (style.boxShadow && (
          style.boxShadow.includes('rgba(0, 0, 0, 0.4)') ||
          style.boxShadow.includes('rgba(0, 0, 0, 0.5)') ||
          style.boxShadow.includes('rgba(0, 0, 0, 0.6)') ||
          (style.boxShadow.includes('inset') && style.boxShadow.includes('rgba(0, 0, 0,'))
        )) {
          findings.push({
            type: 'THEME_LEAK',
            severity: 'P1',
            selector: getCssPath(el),
            measuredValue: 1,
            message: 'Dark mode heavy/inset shadow detected on light mode surface: ' + style.boxShadow
          })
        }
      })
    }

    // 8. DROPDOWN & OVERLAY PARENT CLIPPING CHECK
    const dropdowns = document.querySelectorAll('.dropdown-menu, .cockpit-dropdown-menu, [role="menu"], .power-dropdown, #power-dropdown-menu')
    dropdowns.forEach(menu => {
      if (!isVisible(menu)) return
      let parent = menu.parentElement
      const menuRect = menu.getBoundingClientRect()
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const pStyle = window.getComputedStyle(parent)
        if (pStyle.overflow === 'hidden' || pStyle.overflowX === 'hidden' || pStyle.overflowY === 'hidden' || pStyle.overflow === 'clip') {
          const pRect = parent.getBoundingClientRect()
          if (menuRect.bottom > pRect.bottom + 2 || menuRect.right > pRect.right + 2 || menuRect.left < pRect.left - 2 || menuRect.top < pRect.top - 2) {
            findings.push({
              type: 'CLIPPING',
              severity: 'P0',
              selector: getCssPath(menu),
              conflictingSelector: getCssPath(parent),
              bounds: menuRect,
              conflictingBounds: pRect,
              measuredValue: Math.round(Math.max(menuRect.bottom - pRect.bottom, menuRect.right - pRect.right)),
              message: 'Dropdown menu is clipped by parent container with overflow:hidden (' + getCssPath(parent) + ')'
            })
            break
          }
        }
        parent = parent.parentElement
      }
    })

    // 9. CONCATENATED / ZERO-DISTANCE SIBLING TEXT CHECK (e.g. "LightRecognized")
    const textContainers = document.querySelectorAll('p, span, div, label, .badge')
    textContainers.forEach(container => {
      if (!isVisible(container)) return
      // Skip segmented button groups, sliding tabs, clocks, canvas, and particles
      if (container.closest('.view-mode-toggle, .segmented-control, .study-mode-options, [role="group"], .dashboard-live-clock, .aurora-capsule-clock, .shinpo-particles, .silk-mesh-hero-container')) return
      // Check direct child elements that are inline
      const children = Array.from(container.children).filter(c => isVisible(c) && c.tagName.toLowerCase() !== 'canvas' && !c.classList.contains('shinpo-particles'))
      for (let i = 0; i < children.length - 1; i++) {
        const c1 = children[i]
        const c2 = children[i + 1]
        if (c1.tagName.toLowerCase() === 'canvas' || c2.tagName.toLowerCase() === 'canvas') continue
        if (c1.tagName.toLowerCase() === 'button' && c2.tagName.toLowerCase() === 'button') continue
        const r1 = c1.getBoundingClientRect()
        const r2 = c2.getBoundingClientRect()
        // If on same vertical baseline (heights overlap)
        const verticalOverlap = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top)
        if (verticalOverlap > Math.min(r1.height, r2.height) * 0.5) {
          const horizGap = r2.left - r1.right
          if (horizGap <= 0 && r1.width > 2 && r2.width > 2) {
            const combined = (c1.textContent?.trim() || '') + (c2.textContent?.trim() || '')
            // Only flag if combined text looks like a merged word (alphanumeric concatenation)
            if (/^[A-Za-z0-9]{3,}$/.test(combined.replace(/\\s+/g, ''))) {
              findings.push({
                type: 'COLLISION',
                severity: 'P1',
                selector: getCssPath(c1),
                conflictingSelector: getCssPath(c2),
                text: c1.textContent?.trim() || '',
                conflictingText: c2.textContent?.trim() || '',
                bounds: r1,
                conflictingBounds: r2,
                measuredValue: Math.round(horizGap),
                message: 'Adjacent text elements concatenate without spacing ("' + combined.slice(0, 30) + '", gap=' + Math.round(horizGap) + 'px)'
              })
            }
          }
        }
      }
    })

    // 10. TOOLBAR CONTROL VERTICAL ALIGNMENT CHECK
    const toolbars = document.querySelectorAll('.action-toolbar, .goals-toolbar, .toolbar-row, [role="toolbar"], .task-action-bar')
    toolbars.forEach(tb => {
      if (!isVisible(tb)) return
      const controls = Array.from(tb.querySelectorAll('button, input, select, .action-btn, .toolbar-btn')).filter(c => isVisible(c))
      if (controls.length > 1) {
        const centers = controls.map(c => {
          const r = c.getBoundingClientRect()
          return r.top + r.height / 2
        })
        const maxCenter = Math.max(...centers)
        const minCenter = Math.min(...centers)
        const variance = maxCenter - minCenter
        if (variance > 4) {
          findings.push({
            type: 'ALIGNMENT',
            severity: 'P1',
            selector: getCssPath(tb),
            measuredValue: Math.round(variance),
            message: 'Toolbar controls vertically misaligned by ' + Math.round(variance) + 'px (> 4px threshold)'
          })
        }
      }
    })

    // 11. CLASSIC THEME BRAND CONTAMINATION CHECK (Aurora brand colors in Classic)
    const isClassicTheme = document.body.classList.contains('theme-classic') || document.documentElement.getAttribute('data-theme-palette') === 'classic' || document.documentElement.classList.contains('theme-classic')
    if (isClassicTheme) {
      const allStyled = document.querySelectorAll('.card, .btn, button, .badge, .accent, .nav-item')
      allStyled.forEach(el => {
        if (!isVisible(el)) return
        const style = window.getComputedStyle(el)
        // Aurora cyan: rgb(0, 245, 255) / rgba(0, 245, 255) or aurora violet: rgb(157, 78, 221)
        const checkColor = (val) => val && (
          val.includes('0, 245, 255') ||
          val.includes('157, 78, 221') ||
          val.includes('#00f5ff') ||
          val.includes('#9d4edd')
        )
        if (checkColor(style.color) || checkColor(style.backgroundColor) || checkColor(style.borderColor)) {
          findings.push({
            type: 'THEME_LEAK',
            severity: 'P1',
            selector: getCssPath(el),
            measuredValue: 1,
            message: 'Aurora neon color detected in Classic theme: color=' + style.color + ', bg=' + style.backgroundColor
          })
        }
      })
    }

    // 12. TEXT CONTRAST CHECK
    function parseRgba(colorStr) {
      const match = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/)
      if (!match) return null
      return [
        parseInt(match[1]),
        parseInt(match[2]),
        parseInt(match[3]),
        match[4] !== undefined ? parseFloat(match[4]) : 1.0
      ]
    }
    function getLuminance(rgb) {
      const a = rgb.map(v => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
    }
    const textEls = document.querySelectorAll('p, span, h1, h2, h3, h4, button, label, .badge')
    textEls.forEach(el => {
      if (!isVisible(el)) return
      const text = el.textContent?.trim() || ''
      if (text.length < 2 || el.children.length > 0) return
      const style = window.getComputedStyle(el)
      const fg = parseRgba(style.color)
      if (!fg) return
      // Find effective background with alpha >= 0.6
      let bg = null
      let cur = el
      while (cur && cur !== document.documentElement) {
        const cStyle = window.getComputedStyle(cur)
        const parsed = parseRgba(cStyle.backgroundColor)
        if (parsed && parsed[3] >= 0.6) {
          bg = [parsed[0], parsed[1], parsed[2]]
          break
        }
        cur = cur.parentElement
      }
      if (!bg) bg = isLightTheme ? [255, 255, 255] : [15, 23, 42]
      const l1 = getLuminance(fg.slice(0, 3))
      const l2 = getLuminance(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const fontSize = parseFloat(style.fontSize) || 14
      const minRatio = fontSize >= 18 ? 3.0 : 4.5
      if (ratio < minRatio && ratio > 1.05) {
        findings.push({
          type: 'CONTRAST',
          severity: 'P1',
          selector: getCssPath(el),
          text: text.slice(0, 25),
          measuredValue: Math.round(ratio * 10) / 10,
          message: 'Insufficient contrast ratio (' + (Math.round(ratio * 10) / 10) + ':1 < ' + minRatio + ':1) for text "' + text.slice(0, 20) + '"'
        })
      }
    })

    // 13. FROSTED GLASS TREATMENT CHECK
    const glassPanels = document.querySelectorAll('.glass-card, .aurora-glass, .frosted-glass, .panel-glass')
    glassPanels.forEach(panel => {
      if (!isVisible(panel)) return
      const style = window.getComputedStyle(panel)
      const filter = style.backdropFilter || style.webkitBackdropFilter || ''
      if (filter === 'none' || filter === '' || !filter.includes('blur')) {
        findings.push({
          type: 'MISSING_GLASS',
          severity: 'P1',
          selector: getCssPath(panel),
          measuredValue: 0,
          message: 'Frosted glass container missing backdrop-filter: blur() treatment'
        })
      }
    })

    // 14. DUPLICATE ACTION DETECTOR (e.g. Duplicate Calendar Buttons)
    const actionGroups = document.querySelectorAll('.calendar-actions, .calendar-header, .toolbar, .card-header-actions')
    actionGroups.forEach(group => {
      if (!isVisible(group)) return
      const buttons = Array.from(group.querySelectorAll('button')).filter(b => isVisible(b))
      const seenLabels = new Map()
      buttons.forEach(btn => {
        const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim().toLowerCase()
        if (label.length > 1) {
          if (seenLabels.has(label)) {
            findings.push({
              type: 'DUPLICATE_ACTION',
              severity: 'P1',
              selector: getCssPath(btn),
              conflictingSelector: getCssPath(seenLabels.get(label)),
              text: label,
              measuredValue: 2,
              message: 'Duplicate action button detected in same group: "' + label + '"'
            })
          } else {
            seenLabels.set(label, btn)
          }
        }
      })
    })

    // 15. CARD BOTTOM OVERFLOW / STATS CLIPPING
    const statsCards = document.querySelectorAll('.dashboard-progress-card, .rewards-card, .mission-card, .status-card')
    statsCards.forEach(card => {
      if (!isVisible(card)) return
      const cRect = card.getBoundingClientRect()
      const bottomEls = card.querySelectorAll('p, span, .progress-bar, [role="progressbar"], small')
      bottomEls.forEach(el => {
        if (!isVisible(el)) return
        const elRect = el.getBoundingClientRect()
        // If element extends past card bottom or has 0 clearance
        if (elRect.bottom > cRect.bottom - 2) {
          findings.push({
            type: 'CLIPPING',
            severity: 'P0',
            selector: getCssPath(el),
            conflictingSelector: getCssPath(card),
            text: el.textContent?.trim().slice(0, 20),
            bounds: elRect,
            conflictingBounds: cRect,
            measuredValue: Math.round(elRect.bottom - cRect.bottom),
            message: 'Stat/progress element overflows bottom edge of parent card by ' + Math.round(elRect.bottom - cRect.bottom + 2) + 'px'
          })
        }
      })
    })

    return {
      hasHorizontalOverflow,
      findings
    }
  })()`
}
