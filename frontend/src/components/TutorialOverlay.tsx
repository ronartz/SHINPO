import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { TutorialStepDef } from '../tutorial/tutorialSteps'
import { Icon } from './common/Icon'
import { recordOnboardingStep } from '../api/onboarding'
import { NAVIGATION_ITEMS } from '../types/navigation'
import { getCoachmarkPosition } from '../utils/coachmarkPosition'

export type TutorialOverlayProps = {
  step: TutorialStepDef
  stepIndex: number
  totalSteps: number
  userId?: number
  hasActiveModal?: boolean
  onNext: () => void
  onPrev: () => void
  onExit: () => void
  onSkipTour?: () => void
  onNavigateTab?: (tab: string) => void
}

export type OnboardingWelcomeProps = {
  onStart: () => void
  onExplore: () => void
  onDismiss: () => void
}

export const OnboardingWelcome: React.FC<OnboardingWelcomeProps> = ({ onStart, onExplore, onDismiss }) => (
  <div className="shinpo-tutorial-portal" role="region" aria-labelledby="onboarding-welcome-title">
    <section className="shinpo-onboarding-welcome" aria-describedby="onboarding-welcome-description">
      <button type="button" className="coachmark-close-btn" onClick={onDismiss} aria-label="Dismiss welcome">
        <Icon name="close" size={15} />
      </button>
      <h2 id="onboarding-welcome-title">Make time for what matters</h2>
      <p id="onboarding-welcome-description">
        Turn a goal into a small task, reserve Focus time, then see what you accomplished. You decide when to start a session.
      </p>
      <div className="onboarding-welcome-actions">
        <button type="button" className="btn-coachmark primary" onClick={onStart}>Show me the workflow</button>
        <button type="button" className="btn-coachmark secondary" onClick={onExplore}>Explore on my own</button>
      </div>
    </section>
  </div>
)

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
  userId,
  hasActiveModal = false,
  onNext,
  onPrev,
  onExit,
  onSkipTour,
  onNavigateTab,
}) => {
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [coachmarkPos, setCoachmarkPos] = useState<{ top: number; left: number } | null>(null)
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
  const coachmarkRef = useRef<HTMLDivElement>(null)
  const lastRecordedStep = useRef(stepIndex)

  // The start endpoint persists the initial step; only navigation needs a progress write.
  useEffect(() => {
    if (lastRecordedStep.current === stepIndex) return
    lastRecordedStep.current = stepIndex
    recordOnboardingStep(stepIndex).catch(() => {})
  }, [stepIndex])

  const updatePosition = useCallback(() => {
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1440
    const winH = typeof window !== 'undefined' ? window.innerHeight : 900
    const margin = 16
    const boxW = coachmarkRef.current ? Math.min(400, coachmarkRef.current.offsetWidth) : 400
    const boxH = coachmarkRef.current ? Math.min(coachmarkRef.current.offsetHeight, winH - margin * 2) : 340

    if (!el) {
      setRect(null)
      setCoachmarkPos({ top: Math.max(margin, (winH - boxH) / 2), left: Math.max(margin, (winW - boxW) / 2) })
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
    setRect(targetRect)
    setCoachmarkPos(getCoachmarkPosition(targetRect, { width: boxW, height: boxH }, { width: winW, height: winH }, step.placement))
    return true
  }, [step])

  // Track DOM element & listen for scroll/resize
  useEffect(() => {
    const updateAndCheck = () => {
      updatePosition()
    }
    const handleScrollOrResize = () => window.requestAnimationFrame(updateAndCheck)

    const timer = window.setInterval(updateAndCheck, 200)
    const frameId = window.requestAnimationFrame(updateAndCheck)

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true })

    // Auto-scroll target into view if outside viewport
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.top < 40 || r.bottom > window.innerHeight - 40) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      clearInterval(timer)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize)
    }
  }, [step, updatePosition])

  // Keyboard navigation (Esc to show exit confirm dialog, Arrow keys for step navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) {
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setIsExitConfirmOpen((prev) => !prev)
      } else if (!isExitConfirmOpen) {
        if (target instanceof HTMLElement && target.closest('button, [role="button"]')) return
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          onNext()
        } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
          e.preventDefault()
          onPrev()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNext, onPrev, stepIndex, isExitConfirmOpen])

  // Persistent progress saving
  useEffect(() => {
    try {
      if (userId) {
        localStorage.setItem(`shinpo_onboarding_progress_${userId}`, String(stepIndex))
      }
      localStorage.setItem('shinpo_onboarding_progress', String(stepIndex))
    } catch {
      // ignore
    }
  }, [stepIndex, userId])

  useEffect(() => {
    let target = document.querySelector(step.targetSelector)
    if (!target && step.fallbackSelector) target = document.querySelector(step.fallbackSelector)
    if (!(target instanceof HTMLElement)) return

    const previousOutline = target.style.outline
    const previousOutlineOffset = target.style.outlineOffset
    target.style.outline = '2px solid var(--brand-primary)'
    target.style.outlineOffset = '3px'
    return () => {
      target.style.outline = previousOutline
      target.style.outlineOffset = previousOutlineOffset
    }
  }, [step])

  // Suspend overlay when an application modal is actively open
  if (hasActiveModal) {
    return null
  }

  const tabLabel = NAVIGATION_ITEMS.find((item) => item.id === step.targetTab)?.label || step.targetTab

  return (
    <div
      className="shinpo-tutorial-portal"
      role="region"
      aria-labelledby="coachmark-title"
      aria-label="SHINPO Interactive Walkthrough"
    >
      {/* Floating EONPAI Coachmark Box */}
      <div
        ref={coachmarkRef}
        className="shinpo-coachmark-card"
        style={{
          top: coachmarkPos?.top ?? 16,
          left: coachmarkPos?.left ?? 16,
          visibility: coachmarkPos ? 'visible' : 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="coachmark-progress"
          role="progressbar"
          aria-label="Walkthrough progress"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={stepIndex + 1}
        >
          <span style={{ transform: `scaleX(${(stepIndex + 1) / totalSteps})` }} />
        </div>
        <div className="coachmark-header">
          <div className="coachmark-identity">
            <div>
              <span className="coachmark-eonpai-name">GUIDED WALKTHROUGH</span>
              <span className="coachmark-step-counter">
                Step {step.number} of {totalSteps} • {tabLabel}
              </span>
            </div>
          </div>
          <button
            className="coachmark-close-btn"
            onClick={() => setIsExitConfirmOpen(true)}
            title="Pause walkthrough (Esc)"
            aria-label="Pause Walkthrough"
          >
            ✕
          </button>
        </div>

        <div className="coachmark-body">
          <h4 id="coachmark-title" className="coachmark-title">{step.title}</h4>
          <p className="coachmark-instruction">{step.instruction}</p>

          {/* Navigation Recovery Button when target element is not mounted */}
          {!rect && onNavigateTab && (
            <button
              type="button"
              className="coachmark-nav-fallback-btn"
              onClick={() => onNavigateTab(step.targetTab)}
            >
              <span>Switch to {tabLabel} View</span>
              <Icon name="arrow-up-right" size={13} />
            </button>
          )}
        </div>

        <div className="coachmark-footer">
          <div className="coachmark-actions">
            {onSkipTour && (
              <button type="button" className="btn-coachmark secondary" onClick={onSkipTour}>
                Skip
              </button>
            )}
            {stepIndex > 0 && (
              <button id="tutorial-btn-prev" className="btn-coachmark secondary" onClick={onPrev}>
                Back
              </button>
            )}
            <button
              id="tutorial-btn-next"
              className="btn-coachmark primary"
              onClick={onNext}
            >
              {stepIndex === totalSteps - 1 ? 'Finish tour' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      {/* Deliberate Pause / Exit Confirmation Dialog */}
      {isExitConfirmOpen && (
        <div
          id="tutorial-exit-confirm-overlay"
          className="shinpo-exit-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-exit-confirm-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10005,
            pointerEvents: 'auto',
            background: 'rgba(0,0,0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            setIsExitConfirmOpen(false)
          }}
        >
          <div
            id="tutorial-exit-confirm-card"
            className="shinpo-exit-confirm-card"
            style={{
              maxWidth: '420px',
              width: '100%',
              background: 'var(--surface-card, #030303)',
              border: '1px solid var(--border-subtle, rgba(255,255,255, 0.12))',
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: '0 20px 50px rgba(0,0,0, 0.6)',
              color: 'var(--text-primary, #eeeeee)',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="tutorial-exit-confirm-title" style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700 }}>
              Leave the walkthrough?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary, #5c5c5c)', lineHeight: 1.5 }}>
              Your place is saved. Resume from EONPAI or Settings whenever you’re ready.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                id="tutorial-confirm-resume-btn"
                type="button"
                className="btn-coachmark primary"
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExitConfirmOpen(false)
                }}
              >
                Continue walkthrough
              </button>
              <button
                id="tutorial-confirm-pause-btn"
                type="button"
                className="btn-coachmark secondary"
                style={{ width: '100%', padding: '9px 14px', fontSize: '13px', cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExitConfirmOpen(false)
                  onExit()
                }}
              >
                Pause and leave
              </button>
              {onSkipTour && (
                <button
                  id="tutorial-confirm-skip-btn"
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #5c5c5c)',
                    fontSize: '12px',
                    padding: '6px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    pointerEvents: 'auto',
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsExitConfirmOpen(false)
                    onSkipTour()
                  }}
                >
                  Skip walkthrough
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
