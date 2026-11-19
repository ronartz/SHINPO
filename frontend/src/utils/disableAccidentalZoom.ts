/**
 * Prevents accidental webview zooming (Ctrl/Cmd + Wheel, Ctrl/Cmd + Plus/Minus/0, pinch gestures)
 * so the application behaves strictly like a polished, rock-solid native desktop workspace.
 */
export function disableAccidentalZoom(): void {
  if (typeof window === 'undefined') return

  // 1. Intercept Ctrl + Wheel / Cmd + Wheel (mouse wheel or trackpad pinch-to-zoom)
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    },
    { passive: false },
  )

  // 2. Intercept keyboard zoom hotkeys (Ctrl/Cmd + '+', '-', '=', '0', NumpadAdd, NumpadSubtract)
  window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (
          e.key === '+' ||
          e.key === '-' ||
          e.key === '=' ||
          e.key === '_' ||
          e.key === '0' ||
          e.code === 'NumpadAdd' ||
          e.code === 'NumpadSubtract' ||
          e.code === 'Equal' ||
          e.code === 'Minus' ||
          e.code === 'Digit0' ||
          e.code === 'Numpad0'
        ) {
          e.preventDefault()
        }
      }
    },
    { capture: true },
  )

  // 3. Intercept Safari / WebKit trackpad gesture zooming (gesturestart, gesturechange)
  const preventGesture = (e: Event) => {
    e.preventDefault()
  }
  window.addEventListener('gesturestart', preventGesture, { passive: false } as AddEventListenerOptions)
  window.addEventListener('gesturechange', preventGesture, { passive: false } as AddEventListenerOptions)

  // 4. Intercept multi-touch pinch gestures
  window.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false },
  )
}
