import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { TutorialStepDef } from '../tutorial/tutorialSteps'

export type TutorialOverlayProps = {
  step: TutorialStepDef
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onExit: () => void
  onTargetInteract?: () => void
}

type TargetRect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onExit,
  onTargetInteract,
}) => {
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [coachmarkPos, setCoachmarkPos] = useState<{ top: number; left: number }>({ top: 100, left: 100 })
  const coachmarkRef = useRef<HTMLDivElement>(null)
  const pad = 6 // padding around target element in px

  const updatePosition = useCallback(() => {
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }

    if (!el) {
      // Fallback center of screen if element is not yet found
      const fallbackW = Math.min(420, window.innerWidth - 40)
      setRect((previous) => previous === null ? previous : null)
      const fallbackPos = {
        top: Math.max(40, window.innerHeight / 2 - 120),
        left: Math.max(20, (window.innerWidth - fallbackW) / 2),
      }
      setCoachmarkPos((previous) => previous.top === fallbackPos.top && previous.left === fallbackPos.left ? previous : fallbackPos)
      return false
    }

    const r = el.getBoundingClientRect()
    const targetRect: TargetRect = {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right,
    }
    setRect((previous) => previous
      && previous.top === targetRect.top
      && previous.left === targetRect.left
      && previous.width === targetRect.width
      && previous.height === targetRect.height
      && previous.bottom === targetRect.bottom
      && previous.right === targetRect.right
      ? previous
      : targetRect)

    // Calculate coachmark position
    const boxW = coachmarkRef.current ? coachmarkRef.current.offsetWidth : 360
    const boxH = coachmarkRef.current ? coachmarkRef.current.offsetHeight : 210

    let top = targetRect.bottom + 14
    let left = targetRect.left + (targetRect.width - boxW) / 2

    if (step.placement === 'bottom') {
      top = targetRect.bottom + 14
      left = targetRect.left + (targetRect.width - boxW) / 2
      // Flip to top if overflowing window bottom
      if (top + boxH > window.innerHeight - 20 && targetRect.top - boxH - 14 > 10) {
        top = targetRect.top - boxH - 14
      }
    } else if (step.placement === 'top') {
      top = targetRect.top - boxH - 14
      left = targetRect.left + (targetRect.width - boxW) / 2
      // Flip to bottom if overflowing window top
      if (top < 10 && targetRect.bottom + 14 + boxH < window.innerHeight) {
        top = targetRect.bottom + 14
      }
    } else if (step.placement === 'right') {
      left = targetRect.right + 14
      top = targetRect.top + (targetRect.height - boxH) / 2
      // Flip to left if overflowing window right
      if (left + boxW > window.innerWidth - 20 && targetRect.left - boxW - 14 > 10) {
        left = targetRect.left - boxW - 14
      }
    } else if (step.placement === 'left') {
      left = targetRect.left - boxW - 14
      top = targetRect.top + (targetRect.height - boxH) / 2
      // Flip to right if overflowing window left
      if (left < 10 && targetRect.right + 14 + boxW < window.innerWidth) {
        left = targetRect.right + 14
      }
    }

    // Clamp within window viewport
    left = Math.max(16, Math.min(window.innerWidth - boxW - 16, left))
    top = Math.max(16, Math.min(window.innerHeight - boxH - 16, top))

    const nextPos = { top, left }
    setCoachmarkPos((previous) => previous.top === nextPos.top && previous.left === nextPos.left ? previous : nextPos)
    return true
  }, [step])

  // Track DOM element & listen for scroll/resize
  useEffect(() => {
    const updateAndStopRetry = () => {
      if (updatePosition()) window.clearInterval(timer)
    }
    const handleScrollOrResize = () => window.requestAnimationFrame(updateAndStopRetry)

    // Retry checking if element mounts shortly after tab switch
    const timer = window.setInterval(updateAndStopRetry, 120)
    const frameId = window.requestAnimationFrame(updateAndStopRetry)

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })

    // Auto-scroll target into view if outside viewport
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      clearInterval(timer)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize)
    }
  }, [step, updatePosition])

  // Keyboard navigation (Esc to exit, Arrow keys for step navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) {
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onExit()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext()
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault()
        onPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onExit, onNext, onPrev, stepIndex])

  // Attach click listener directly to target element to trigger next step
  useEffect(() => {
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }
    if (!el) return

    const handleClick = () => {
      if (onTargetInteract) onTargetInteract()
    }

    el.addEventListener('click', handleClick)
    return () => {
      el?.removeEventListener('click', handleClick)
    }
  }, [step, onTargetInteract])

  const winW = window.innerWidth
  const winH = window.innerHeight

  return (
    <div className="shinpo-tutorial-portal" role="dialog" aria-modal="true" aria-label="SHINPO Interactive Walkthrough">
      {/* 4 Backdrop Mask Divs that create the interactive cutout */}
      {rect ? (
        <>
          {/* Top backdrop */}
          <div
            className="shinpo-backdrop-quad"
            style={{
              top: 0,
              left: 0,
              width: '100%',
              height: Math.max(0, rect.top - pad),
            }}
            onClick={onExit}
          />
          {/* Bottom backdrop */}
          <div
            className="shinpo-backdrop-quad"
            style={{
              top: rect.bottom + pad,
              left: 0,
              width: '100%',
              height: Math.max(0, winH - (rect.bottom + pad)),
            }}
            onClick={onExit}
          />
          {/* Left backdrop */}
          <div
            className="shinpo-backdrop-quad"
            style={{
              top: Math.max(0, rect.top - pad),
              left: 0,
              width: Math.max(0, rect.left - pad),
              height: rect.height + pad * 2,
            }}
            onClick={onExit}
          />
          {/* Right backdrop */}
          <div
            className="shinpo-backdrop-quad"
            style={{
              top: Math.max(0, rect.top - pad),
              left: rect.right + pad,
              width: Math.max(0, winW - (rect.right + pad)),
              height: rect.height + pad * 2,
            }}
            onClick={onExit}
          />

          {/* Pulsing Red Spotlight Ring around target */}
          <div
            className="shinpo-spotlight-ring"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
            }}
          />
        </>
      ) : (
        /* Full fallback dimmer when no element is targeted */
        <div className="shinpo-backdrop-quad" style={{ inset: 0, width: '100%', height: '100%' }} onClick={onExit} />
      )}

      {/* Floating EONPAI Coachmark Box */}
      <div
        ref={coachmarkRef}
        className="shinpo-coachmark-card"
        style={{
          top: coachmarkPos.top,
          left: coachmarkPos.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="coachmark-header">
          <div className="coachmark-identity">
            <span className="coachmark-eonpai-avatar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </span>
            <div>
              <span className="coachmark-eonpai-name">EONPAI GUIDE</span>
              <span className="coachmark-step-counter">
                Step {step.number} of {totalSteps}
              </span>
            </div>
          </div>
          <button className="coachmark-close-btn" onClick={onExit} title="Exit Tour (Esc)">
            ✕
          </button>
        </div>

        <div className="coachmark-body">
          <h4 className="coachmark-title">{step.title}</h4>
          <blockquote className="coachmark-dialogue">
            &ldquo;{step.eonpaiDialogue}&rdquo;
          </blockquote>
          <p className="coachmark-instruction">
            <span className="instruction-arrow">→</span> {step.instruction}
          </p>
        </div>

        <div className="coachmark-footer">
          <div className="coachmark-dots">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`coachmark-dot ${idx === stepIndex ? 'active' : idx < stepIndex ? 'completed' : ''}`}
              />
            ))}
          </div>

          <div className="coachmark-actions">
            {stepIndex > 0 && (
              <button className="btn-coachmark secondary" onClick={onPrev}>
                Back
              </button>
            )}
            <button className="btn-coachmark primary" onClick={onNext}>
              {stepIndex === totalSteps - 1 ? 'Finish Tour' : 'Next Step →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
