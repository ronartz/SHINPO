/**
 * Universal Theme-Aware Button Interaction Engine
 * Delegated pointer and keyboard listener that brings FlameButton-inspired
 * edge-sensitive energy aura, cursor tracking, and tactile press/pulse feedback
 * to all native and legacy buttons across the application without React re-renders.
 */

import { calculateButtonInteractionMetrics } from './interactiveButtonPhysics.ts'

let isInitialized = false
let cleanupFn: (() => void) | null = null

function getTargetButton(eventTarget: EventTarget | null): HTMLButtonElement | null {
  if (!eventTarget || typeof (eventTarget as HTMLElement).closest !== 'function') {
    return null
  }

  const btn = (eventTarget as HTMLElement).closest('button, [data-interactive-btn], [role="button"]') as HTMLButtonElement | null
  if (!btn) return null

  // Ignore explicitly excluded buttons
  if (btn.hasAttribute('data-no-interactive') || btn.classList.contains('no-interactive')) {
    return null
  }

  // Ignore disabled or loading buttons
  if (
    btn.disabled ||
    btn.getAttribute('aria-disabled') === 'true' ||
    btn.classList.contains('is-loading') ||
    btn.getAttribute('data-loading') === 'true'
  ) {
    return null
  }

  // Do not apply to text links, inputs, selects, checkboxes, switches, sliders
  const role = btn.getAttribute('role')
  if (role === 'checkbox' || role === 'switch' || role === 'slider') {
    return null
  }

  return btn
}

export function initInteractiveButtonEngine(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  if (isInitialized && cleanupFn) {
    return cleanupFn
  }

  let activeButton: HTMLButtonElement | null = null

  const applyButtonMetrics = (btn: HTMLButtonElement, clientX: number, clientY: number) => {
    if (!btn.hasAttribute('data-interactive-btn')) {
      btn.setAttribute('data-interactive-btn', 'true')
    }

    const rect = btn.getBoundingClientRect()
    if (rect.width <= 0) return

    const { mouseX, mouseY, normX, normY, edgeProximity, edgePercent } =
      calculateButtonInteractionMetrics(clientX, clientY, rect)

    btn.style.setProperty('--btn-x', `${mouseX}px`)
    btn.style.setProperty('--btn-y', `${mouseY}px`)
    btn.style.setProperty('--btn-norm-x', normX.toFixed(3))
    btn.style.setProperty('--btn-norm-y', normY.toFixed(3))
    btn.style.setProperty('--btn-edge-proximity', edgeProximity.toFixed(3))
    btn.style.setProperty('--btn-edge-side', `${edgePercent}%`)
    btn.style.setProperty('--btn-hover', '1')
  }

  const handlePointerOver = (e: PointerEvent) => {
    const btn = getTargetButton(e.target)
    if (!btn) return
    activeButton = btn
    applyButtonMetrics(btn, e.clientX, e.clientY)
  }

  const handlePointerMove = (e: PointerEvent) => {
    const btn = getTargetButton(e.target)
    if (!btn) {
      if (activeButton) {
        activeButton.style.setProperty('--btn-hover', '0')
        activeButton.style.setProperty('--btn-pressed', '0')
        activeButton.classList.remove('is-pressed')
        activeButton = null
      }
      return
    }

    if (activeButton && activeButton !== btn) {
      activeButton.style.setProperty('--btn-hover', '0')
      activeButton.style.setProperty('--btn-pressed', '0')
      activeButton.classList.remove('is-pressed')
    }
    activeButton = btn

    applyButtonMetrics(btn, e.clientX, e.clientY)
  }

  const handlePointerDown = (e: PointerEvent) => {
    const btn = getTargetButton(e.target)
    if (!btn) return
    if (e.button === 0) {
      btn.style.setProperty('--btn-pressed', '1')
      btn.classList.add('is-pressed')
      activeButton = btn
    }
  }

  const handlePointerUp = (e: PointerEvent) => {
    const btn = getTargetButton(e.target)
    if (btn) {
      btn.style.setProperty('--btn-pressed', '0')
      btn.classList.remove('is-pressed')
      btn.classList.remove('is-activating')
      try { void btn.offsetWidth } catch (_) { /* ignore reflow error */ }
      btn.classList.add('is-activating')
      setTimeout(() => {
        btn.classList.remove('is-activating')
      }, 280)
    } else if (activeButton) {
      activeButton.style.setProperty('--btn-pressed', '0')
      activeButton.classList.remove('is-pressed')
    }
  }

  const handlePointerOut = (e: PointerEvent) => {
    const btn = getTargetButton(e.target)
    if (btn) {
      const related = e.relatedTarget as HTMLElement | null
      if (!related || !btn.contains(related)) {
        btn.style.setProperty('--btn-hover', '0')
        btn.style.setProperty('--btn-pressed', '0')
        btn.classList.remove('is-pressed')
        if (activeButton === btn) {
          activeButton = null
        }
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = getTargetButton(e.target)
      if (btn) {
        btn.style.setProperty('--btn-pressed', '1')
        btn.classList.add('is-pressed')
      }
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const btn = getTargetButton(e.target)
      if (btn) {
        btn.style.setProperty('--btn-pressed', '0')
        btn.classList.remove('is-pressed')
        btn.classList.remove('is-activating')
        try { void btn.offsetWidth } catch (_) { /* ignore reflow error */ }
        btn.classList.add('is-activating')
        setTimeout(() => {
          btn.classList.remove('is-activating')
        }, 280)
      }
    }
  }

  document.addEventListener('pointerover', handlePointerOver, { passive: true })
  document.addEventListener('pointermove', handlePointerMove, { passive: true })
  document.addEventListener('pointerdown', handlePointerDown, { passive: true })
  document.addEventListener('pointerup', handlePointerUp, { passive: true })
  document.addEventListener('pointerout', handlePointerOut, { passive: true })
  document.addEventListener('keydown', handleKeyDown, { passive: true })
  document.addEventListener('keyup', handleKeyUp, { passive: true })

  isInitialized = true

  cleanupFn = () => {
    document.removeEventListener('pointerover', handlePointerOver)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerdown', handlePointerDown)
    document.removeEventListener('pointerup', handlePointerUp)
    document.removeEventListener('pointerout', handlePointerOut)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    isInitialized = false
    cleanupFn = null
  }

  return cleanupFn
}
