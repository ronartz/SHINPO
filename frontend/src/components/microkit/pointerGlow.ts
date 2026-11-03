import type React from 'react'

type Spring = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; last: number; frame: number | null }
const springs = new WeakMap<HTMLElement, Spring>()

export function trackMicrokitPointer(event: React.PointerEvent<HTMLElement>) {
  if (event.pointerType === 'touch') return
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-microkit-glow]')
    : null
  if (!target) return
  const bounds = target.getBoundingClientRect()
  const tx = Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))
  const ty = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top))
  let spring = springs.get(target)
  if (!spring) {
    spring = { x: tx, y: ty, tx, ty, vx: 0, vy: 0, last: performance.now(), frame: null }
    springs.set(target, spring)
  }
  spring.tx = tx
  spring.ty = ty
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    target.style.setProperty('--microkit-x', `${tx}px`)
    target.style.setProperty('--microkit-y', `${ty}px`)
    return
  }
  if (spring.frame !== null) return

  const tick = (now: number) => {
    const state = spring!
    const dt = Math.min((now - state.last) / 1000, 0.032)
    state.last = now
    const omega = 2 * Math.PI * 4.2
    state.vx += (omega * omega * (state.tx - state.x) - 2 * 0.82 * omega * state.vx) * dt
    state.vy += (omega * omega * (state.ty - state.y) - 2 * 0.82 * omega * state.vy) * dt
    state.x += state.vx * dt
    state.y += state.vy * dt
    target.style.setProperty('--microkit-x', `${state.x.toFixed(1)}px`)
    target.style.setProperty('--microkit-y', `${state.y.toFixed(1)}px`)
    if (Math.abs(state.tx - state.x) + Math.abs(state.ty - state.y) > 0.5 || Math.abs(state.vx) + Math.abs(state.vy) > 1) {
      state.frame = requestAnimationFrame(tick)
    } else {
      state.x = state.tx
      state.y = state.ty
      state.frame = null
      target.style.setProperty('--microkit-x', `${state.x.toFixed(1)}px`)
      target.style.setProperty('--microkit-y', `${state.y.toFixed(1)}px`)
    }
  }
  spring.frame = requestAnimationFrame(tick)
}
