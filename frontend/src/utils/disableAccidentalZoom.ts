/**
 * Hardened universal webview zoom prevention across every OS (Windows, Linux, macOS).
 * Intercepts Ctrl/Cmd + Wheel, Ctrl/Cmd + Plus/Minus/0, trackpad pinch gestures, and multi-touch zoom
 * in the capture phase on both window and document with stopImmediatePropagation.
 */
export function disableAccidentalZoom(): void {
  if (typeof window === 'undefined') return

  const preventWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation()
      }
    }
  }

  // 1. Intercept Ctrl + Wheel / Cmd + Wheel (mouse wheel or trackpad pinch-to-zoom)
  // Attached to both window and document in capture phase with non-passive listener
  window.addEventListener('wheel', preventWheel, { capture: true, passive: false })
  if (typeof document !== 'undefined') {
    document.addEventListener('wheel', preventWheel, { capture: true, passive: false })
  }

  // 2. Intercept keyboard zoom hotkeys (Ctrl/Cmd + '+', '-', '=', '0', NumpadAdd, NumpadSubtract, etc.)
  const preventKeyZoom = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key
      const code = e.code
      const keyCode = (e as unknown as { keyCode?: number }).keyCode || (e as unknown as { which?: number }).which || 0
      if (
        key === '+' ||
        key === '-' ||
        key === '=' ||
        key === '_' ||
        key === '0' ||
        code === 'NumpadAdd' ||
        code === 'NumpadSubtract' ||
        code === 'Equal' ||
        code === 'Minus' ||
        code === 'Digit0' ||
        code === 'Numpad0' ||
        keyCode === 187 ||
        keyCode === 189 ||
        keyCode === 107 ||
        keyCode === 109 ||
        keyCode === 48 ||
        keyCode === 96
      ) {
        e.preventDefault()
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation()
        }
      }
    }
  }

  window.addEventListener('keydown', preventKeyZoom, { capture: true })
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', preventKeyZoom, { capture: true })
  }

  // 3. Intercept Safari / WebKit trackpad gesture zooming (gesturestart, gesturechange)
  const preventGesture = (e: Event) => {
    e.preventDefault()
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation()
    }
  }
  window.addEventListener('gesturestart', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
  window.addEventListener('gesturechange', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
  window.addEventListener('gestureend', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
  if (typeof document !== 'undefined') {
    document.addEventListener('gesturestart', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
    document.addEventListener('gesturechange', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
    document.addEventListener('gestureend', preventGesture, { capture: true, passive: false } as AddEventListenerOptions)
  }

  // 4. Intercept multi-touch pinch gestures (touchstart and touchmove)
  const preventTouchPinch = (e: TouchEvent) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault()
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation()
      }
    }
  }
  window.addEventListener('touchstart', preventTouchPinch, { capture: true, passive: false })
  window.addEventListener('touchmove', preventTouchPinch, { capture: true, passive: false })
  if (typeof document !== 'undefined') {
    document.addEventListener('touchstart', preventTouchPinch, { capture: true, passive: false })
    document.addEventListener('touchmove', preventTouchPinch, { capture: true, passive: false })
  }
}
