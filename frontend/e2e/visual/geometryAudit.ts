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
export type FindingType = 'COLLISION' | 'CLIPPING' | 'INSUFFICIENT_GAP' | 'DEAD_SPACE' | 'OVERFLOW' | 'ALIGNMENT'

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

    return {
      hasHorizontalOverflow,
      findings
    }
  })()`
}
