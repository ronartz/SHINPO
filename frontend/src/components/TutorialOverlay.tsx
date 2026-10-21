import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { TutorialStepDef } from '../tutorial/tutorialSteps'
import { Icon } from './common/Icon'
import { recordOnboardingStep, getOnboardingState } from '../api/onboarding'
import { NAVIGATION_ITEMS } from '../types/navigation'

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
  userId,
  hasActiveModal = false,
  onNext,
  onPrev,
  onExit,
  onSkipTour,
  onNavigateTab,
  onTargetInteract,
}) => {
  const [rect, setRect] = useState<TargetRect | null>(null)
  const [coachmarkPos, setCoachmarkPos] = useState<{ top: number; left: number }>({ top: 120, left: 100 })
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
  const [hintPulse, setHintPulse] = useState(false)
  const [verifiedSteps, setVerifiedSteps] = useState<Set<number>>(() => {
    try {
      const key = userId ? `shinpo_onboarding_verified_${userId}` : 'shinpo_onboarding_verified'
      const cached = localStorage.getItem(key)
      if (cached) {
        return new Set(
          cached
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        )
      }
    } catch {
      // localStorage may be unavailable in restricted browser contexts.
    }
    return new Set<number>()
  })
  const [stepNotice, setStepNotice] = useState<{ stepIndex: number; text: string } | null>(null)
  const sandboxNotice = stepNotice?.stepIndex === stepIndex
    ? stepNotice.text
    : verifiedSteps.has(stepIndex)
      ? '✓ Interactive requirement verified'
      : null
  const coachmarkRef = useRef<HTMLDivElement>(null)
  const pad = 8 // padding around target element in px

  // Load verified steps from backend PostgreSQL ledger and merge
  useEffect(() => {
    if (!userId) return
    getOnboardingState()
      .then((res) => {
        if (res && res.verifiedSteps) {
          const backendSet = new Set<number>()
          res.verifiedSteps.split(',').forEach((s) => {
            const idx = parseInt(s.trim(), 10)
            if (!isNaN(idx)) backendSet.add(idx)
          })
          setVerifiedSteps((prev) => {
            const merged = new Set([...prev, ...backendSet])
            try {
              localStorage.setItem(`shinpo_onboarding_verified_${userId}`, Array.from(merged).join(','))
            } catch {
              // Keep the in-memory verification state when storage is unavailable.
            }
            return merged
          })
        }
      })
      .catch(() => {
        // Backend verification is best-effort; local state remains usable.
      })
  }, [userId])

  const markCurrentStepVerified = useCallback(
    async (noticeText: string) => {
      if (hasActiveModal) {
        return // Reject verification while a conflicting modal covers the screen
      }
      setVerifiedSteps((prev) => {
        const next = new Set(prev)
        next.add(stepIndex)
        try {
          const key = userId ? `shinpo_onboarding_verified_${userId}` : 'shinpo_onboarding_verified'
          localStorage.setItem(key, Array.from(next).join(','))
        } catch {
          // Keep the in-memory verification state when storage is unavailable.
        }
        return next
      })
      setStepNotice({ stepIndex, text: noticeText })
      try {
        await recordOnboardingStep(stepIndex, true)
      } catch (err) {
        console.warn('Failed to record verified onboarding step', err)
      }
    },
    [stepIndex, userId, hasActiveModal]
  )

  const isStepVerified = verifiedSteps.has(stepIndex)

  const updatePosition = useCallback(() => {
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1440
    const winH = typeof window !== 'undefined' ? window.innerHeight : 900
    const margin = 16
    const gap = 14
    const padVal = 8

    const boxW = coachmarkRef.current ? Math.min(380, coachmarkRef.current.offsetWidth) : 380
    const boxH = coachmarkRef.current ? Math.min(coachmarkRef.current.offsetHeight, winH - margin * 2) : 340

    if (!el) {
      const fallbackW = Math.min(420, winW - margin * 2)
      setRect(null)
      const fallbackPos = {
        top: Math.max(margin, (winH - boxH) / 2),
        left: Math.max(margin, (winW - fallbackW) / 2),
      }
      setCoachmarkPos(fallbackPos)
      return false
    }

    const r = el.getBoundingClientRect()
    // Bound spotlight target rect so it never balloons over giant background containers
    const maxTargetW = Math.min(650, winW - 32)
    const maxTargetH = Math.min(460, winH - 60)
    const clampedW = Math.min(r.width, maxTargetW)
    const clampedH = Math.min(r.height, maxTargetH)

    const targetRect: TargetRect = {
      top: r.top,
      left: r.left,
      width: clampedW,
      height: clampedH,
      bottom: r.top + clampedH,
      right: r.left + clampedW,
    }
    setRect(targetRect)

    // Calculate clearances
    const spaceBelow = winH - (targetRect.bottom + padVal) - gap - margin
    const spaceAbove = (targetRect.top - padVal) - gap - margin
    const spaceRight = winW - (targetRect.right + padVal) - gap - margin
    const spaceLeft = (targetRect.left - padVal) - gap - margin

    let resolvedPlacement = step.placement

    if (resolvedPlacement === 'bottom') {
      if (spaceBelow < boxH && spaceAbove >= boxH) {
        resolvedPlacement = 'top'
      } else if (spaceBelow < boxH && spaceAbove < boxH) {
        if (spaceRight >= boxW) resolvedPlacement = 'right'
        else if (spaceLeft >= boxW) resolvedPlacement = 'left'
        else {
          resolvedPlacement = spaceBelow >= spaceAbove ? 'bottom' : 'top'
        }
      }
    } else if (resolvedPlacement === 'top') {
      if (spaceAbove < boxH && spaceBelow >= boxH) {
        resolvedPlacement = 'bottom'
      } else if (spaceAbove < boxH && spaceBelow < boxH) {
        if (spaceRight >= boxW) resolvedPlacement = 'right'
        else if (spaceLeft >= boxW) resolvedPlacement = 'left'
        else {
          resolvedPlacement = spaceAbove >= spaceBelow ? 'top' : 'bottom'
        }
      }
    } else if (resolvedPlacement === 'right') {
      if (spaceRight < boxW && spaceLeft >= boxW) {
        resolvedPlacement = 'left'
      } else if (spaceRight < boxW && spaceLeft < boxW) {
        if (spaceBelow >= boxH) resolvedPlacement = 'bottom'
        else if (spaceAbove >= boxH) resolvedPlacement = 'top'
        else {
          resolvedPlacement = spaceRight >= spaceLeft ? 'right' : 'left'
        }
      }
    } else if (resolvedPlacement === 'left') {
      if (spaceLeft < boxW && spaceRight >= boxW) {
        resolvedPlacement = 'right'
      } else if (spaceLeft < boxW && spaceRight < boxW) {
        if (spaceBelow >= boxH) resolvedPlacement = 'bottom'
        else if (spaceAbove >= boxH) resolvedPlacement = 'top'
        else {
          resolvedPlacement = spaceLeft >= spaceRight ? 'left' : 'right'
        }
      }
    }

    let top = targetRect.bottom + padVal + gap
    let left = targetRect.left + (targetRect.width - boxW) / 2

    if (resolvedPlacement === 'top') {
      top = targetRect.top - padVal - gap - boxH
      left = targetRect.left + (targetRect.width - boxW) / 2
    } else if (resolvedPlacement === 'bottom') {
      top = targetRect.bottom + padVal + gap
      left = targetRect.left + (targetRect.width - boxW) / 2
    } else if (resolvedPlacement === 'right') {
      left = targetRect.right + padVal + gap
      top = targetRect.top + (targetRect.height - boxH) / 2
    } else if (resolvedPlacement === 'left') {
      left = targetRect.left - padVal - gap - boxW
      top = targetRect.top + (targetRect.height - boxH) / 2
    }

    // Strict clamping within window viewport
    const maxLeft = Math.max(margin, winW - boxW - margin)
    const maxTop = Math.max(margin, winH - boxH - margin)
    left = Math.max(margin, Math.min(maxLeft, left))
    top = Math.max(margin, Math.min(maxTop, top))

    setCoachmarkPos({ top, left })
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
        if (e.key === 'ArrowRight') {
          if (isStepVerified) {
            e.preventDefault()
            onNext()
          } else {
            setHintPulse(true)
            setTimeout(() => setHintPulse(false), 500)
          }
        } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
          e.preventDefault()
          onPrev()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onNext, onPrev, stepIndex, isExitConfirmOpen, isStepVerified])

  // Attach click listener directly to target element to trigger interaction
  useEffect(() => {
    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }
    if (!el) return

    const handleClick = () => {
      markCurrentStepVerified('✓ Action confirmed via interface interaction')
      if (onTargetInteract) onTargetInteract()
    }

    el.addEventListener('click', handleClick)
    return () => {
      el?.removeEventListener('click', handleClick)
    }
  }, [step, onTargetInteract, markCurrentStepVerified])

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

  const handleBackdropClick = () => {
    setHintPulse(true)
    window.setTimeout(() => setHintPulse(false), 800)
  }

  const winW = typeof window !== 'undefined' ? window.innerWidth : 1440
  const winH = typeof window !== 'undefined' ? window.innerHeight : 900

  // Suspend overlay when an application modal is actively open
  if (hasActiveModal) {
    return null
  }

  const tabLabel = NAVIGATION_ITEMS.find((item) => item.id === step.targetTab)?.label || step.targetTab

  return (
    <div
      className="shinpo-tutorial-portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachmark-title"
      aria-label="SHINPO Interactive Walkthrough"
    >
      {/* 4 Backdrop Mask Divs that create the interactive cutout WITHOUT silent click-dismiss */}
      {!isExitConfirmOpen && (
        rect ? (
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
              onClick={handleBackdropClick}
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
              onClick={handleBackdropClick}
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
              onClick={handleBackdropClick}
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
              onClick={handleBackdropClick}
            />

            {/* Spotlight Ring around target with hint pulse */}
            <div
              className={`shinpo-spotlight-ring ${hintPulse ? 'hint-pulse' : ''}`}
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              }}
            />
          </>
        ) : (
          /* Full fallback dimmer when element is loading or on another tab */
          <div
            className="shinpo-backdrop-quad"
            style={{ inset: 0, width: '100%', height: '100%' }}
            onClick={handleBackdropClick}
          />
        )
      )}

      {/* Floating EONPAI Coachmark Box */}
      <div
        ref={coachmarkRef}
        className={`shinpo-coachmark-card ${hintPulse ? 'card-hint-shake' : ''}`}
        style={{
          top: coachmarkPos.top,
          left: coachmarkPos.left,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="coachmark-header">
          <div className="coachmark-identity">
            <span className="coachmark-eonpai-avatar">
              <Icon name="sparkle" size={16} />
            </span>
            <div>
              <span className="coachmark-eonpai-name">EONPAI GUIDE</span>
              <span className="coachmark-step-counter">
                Step {step.number} of {totalSteps} • {tabLabel}
              </span>
            </div>
          </div>
          <button
            className="coachmark-close-btn"
            onClick={() => setIsExitConfirmOpen(true)}
            title="Pause Tour (Esc)"
            aria-label="Pause Walkthrough"
          >
            ✕
          </button>
        </div>

        <div className="coachmark-body">
          <h4 id="coachmark-title" className="coachmark-title">{step.title}</h4>
          <blockquote className="coachmark-dialogue">
            &ldquo;{step.eonpaiDialogue}&rdquo;
          </blockquote>
          <p className="coachmark-instruction">
            <span className="instruction-arrow">→</span> {step.instruction}
          </p>

          {/* Interactive Guided Sandbox Component for Each Specific Step */}
          {stepIndex === 0 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Inspect Priorities</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-priority"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Priority focus inspected')}
                >
                  🎯 Deep Work Priority
                </button>
                <button
                  id="sandbox-action-sprint"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Sprint queue inspected')}
                >
                  ⚡ Quick Sprint Queue
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 1 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Define Strategic Goal</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-goal-option-1"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Objective "Master Async Concurrency" defined')}
                >
                  🚀 Master Async Concurrency
                </button>
                <button
                  id="sandbox-goal-option-2"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Objective "Ship V1 Private Beta" defined')}
                >
                  📦 Ship V1 Private Beta
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 2 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Deconstruct Objectives</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-deconstruct"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Goal decomposed into 3 atomic 25m sprints')}
                >
                  ✨ AI Deconstruct Sample Goal
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 3 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Timebox Focus Slot</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-schedule-slot-1"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Time block 09:00 - 09:45 locked')}
                >
                  📅 09:00 - 09:45 Focus
                </button>
                <button
                  id="sandbox-schedule-slot-2"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Time block 14:00 - 14:45 locked')}
                >
                  📅 14:00 - 14:45 Sprint
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 4 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Arm Execution Queue</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-arm-sprint"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Sprint armed in execution queue')}
                >
                  ▶ Arm First Sprint (Ready 🟢)
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 5 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Select Sprint Budget</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-budget-15"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ 15m Sprint budget selected')}
                >
                  15m
                </button>
                <button
                  id="sandbox-budget-25"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ 25m Sprint budget selected')}
                >
                  25m
                </button>
                <button
                  id="sandbox-budget-45"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ 45m Deep Work selected')}
                >
                  45m
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 6 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Test Sentinel Guardrails</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-mode-monitoring"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Sentinel Monitoring mode active')}
                >
                  🛡️ Monitoring
                </button>
                <button
                  id="sandbox-mode-balanced"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Sentinel Balanced mode active')}
                >
                  ⚖️ Balanced
                </button>
                <button
                  id="sandbox-mode-strict"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Sentinel Strict containment active')}
                >
                  🔒 Strict
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 7 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Whitelist Documentation</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-resource-docs"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Whitelisted https://docs.rs')}
                >
                  + docs.rs
                </button>
                <button
                  id="sandbox-resource-mdn"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Whitelisted developer.mozilla.org')}
                >
                  + MDN Web Docs
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 8 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Calibrate Session Rating</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-star-5"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ 5-Star Flow State Logged')}
                >
                  ⭐⭐⭐⭐⭐ Flow State
                </button>
                <button
                  id="sandbox-star-4"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ 4-Star Solid Sprint Logged')}
                >
                  ⭐⭐⭐⭐ Solid Focus
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 9 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Inspect XP Progression</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-rewards"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ XP ledger reviewed: Tasks (+10), Focus (+15/25), Goals (+50)')}
                >
                  📊 View Progression Ledger
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 10 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Ask EONPAI Guidance</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-eonpai"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ EONPAI: "Break next barrier into 15m spike."')}
                >
                  💬 "How do I eliminate procrastination?"
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {stepIndex === 11 && (
            <div className="coachmark-sandbox-container">
              <div className="coachmark-sandbox-label">
                <span>Interactive Action • Workstation Ready</span>
                <span className={`coachmark-sandbox-status ${isStepVerified ? 'verified' : 'pending'}`}>
                  {isStepVerified ? '✓ Verified' : 'Action Required'}
                </span>
              </div>
              <div className="coachmark-sandbox-actions">
                <button
                  id="sandbox-action-settings"
                  type="button"
                  className="sandbox-chip-btn"
                  onClick={() => markCurrentStepVerified('✓ Workstation calibrated & ready for execution')}
                >
                  ⚙️ Confirm Workstation Readiness
                </button>
              </div>
              {sandboxNotice && <div className="coachmark-sandbox-feedback">{sandboxNotice}</div>}
            </div>
          )}

          {/* Why It Matters Callout */}
          {step.whyItMatters && (
            <div className="coachmark-why-box">
              <span className="coachmark-why-icon">💡</span>
              <span><strong>Why it matters:</strong> {step.whyItMatters}</span>
            </div>
          )}

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
          <div className="coachmark-dots">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <span
                key={idx}
                className={`coachmark-dot ${idx === stepIndex ? 'active' : verifiedSteps.has(idx) ? 'completed' : ''}`}
                title={`Step ${idx + 1}`}
              />
            ))}
          </div>

          <div className="coachmark-actions">
            {stepIndex > 0 && (
              <button id="tutorial-btn-prev" className="btn-coachmark secondary" onClick={onPrev}>
                Back
              </button>
            )}
            <button
              id="tutorial-btn-next"
              className={`btn-coachmark ${isStepVerified ? 'primary' : 'disabled'}`}
              onClick={onNext}
              disabled={!isStepVerified}
              title={isStepVerified ? 'Continue to next step' : 'Perform guided action above to unlock next step'}
            >
              {stepIndex === totalSteps - 1 ? 'Finish Tour' : 'Next Step →'}
            </button>
          </div>
        </div>
      </div>

      {/* Deliberate Pause / Exit Confirmation Dialog */}
      {isExitConfirmOpen && (
        <div
          id="tutorial-exit-confirm-overlay"
          className="shinpo-exit-confirm-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10005,
            pointerEvents: 'auto',
            background: 'rgba(0, 0, 0, 0.65)',
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
              background: 'var(--surface-card, #1D1E24)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: '16px',
              padding: '22px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              color: 'var(--text-primary, #F5F7FF)',
              pointerEvents: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 700 }}>
              Pause Guided Walkthrough?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
              Your progress is saved up to Step {step.number} ({step.title}). You can resume anytime from the EONPAI assistant or help menu.
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
                Resume Walkthrough
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
                Pause & Exit to App
              </button>
              {onSkipTour && (
                <button
                  id="tutorial-confirm-skip-btn"
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary, #94a3b8)',
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
                  Skip Entire Tour (No Rewards Awarded)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
