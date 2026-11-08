import React, { useEffect, useState, useRef, useCallback } from 'react'
import { ShinpoLogo } from '../ShinpoLogo'

export interface CinematicStartupProps {
  isReady: boolean
  onComplete: () => void
  minimumDurationMs?: number
  initializationStatus?: string
}

export const CinematicStartup: React.FC<CinematicStartupProps> = ({
  isReady,
  onComplete,
  minimumDurationMs = 5000,
  initializationStatus,
}) => {
  const [progress, setProgress] = useState(5)
  const [statusMessage, setStatusMessage] = useState('Initializing local runtime...')
  const [isExiting, setIsExiting] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [hasCompleted, setHasCompleted] = useState(() => {
    try {
      return typeof window !== 'undefined' && sessionStorage.getItem('shinpo_splash_shown') === 'true'
    } catch {
      return false
    }
  })

  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const isReadyRef = useRef(isReady)
  useEffect(() => {
    isReadyRef.current = isReady
  }, [isReady])

  const startTimeRef = useRef<number | null>(null)

  const finishStartup = useCallback(() => {
    setIsExiting(true)
    const exitTimer = setTimeout(() => {
      try {
        sessionStorage.setItem('shinpo_splash_shown', 'true')
      } catch {
        // Storage restricted in sandbox/test environments
      }
      setHasCompleted(true)
      onCompleteRef.current()
    }, 360)
    return () => clearTimeout(exitTimer)
  }, [])

  // Fast-path if already completed in this session
  useEffect(() => {
    if (hasCompleted) {
      onCompleteRef.current()
    }
  }, [hasCompleted])

  // Motion and Progress Sequence Loop (0 - 5000ms+)
  useEffect(() => {
    if (hasCompleted) return

    if (startTimeRef.current === null) {
      startTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    }

    const interval = setInterval(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsed = now - (startTimeRef.current || now)

      // Phase 1: 0 - 1,500ms: Logo emergence and orbital formation (progress 5% -> 30%)
      if (elapsed < 1500) {
        const ratio = elapsed / 1500
        setProgress(Math.round(5 + ratio * 25))
        setStatusMessage(initializationStatus || 'Initializing local runtime...')
      }
      // Phase 2: 1,500 - 3,000ms: SHINPO wordmark reveal and luminous motion (progress 30% -> 65%)
      else if (elapsed < 3000) {
        const ratio = (elapsed - 1500) / 1500
        setProgress(Math.round(30 + ratio * 35))
        setStatusMessage(initializationStatus || 'Loading security modules & platform services...')
      }
      // Phase 3: 3,000 - 4,500ms: Supporting caption & progress animation (progress 65% -> 90%)
      else if (elapsed < 4500) {
        const ratio = (elapsed - 3000) / 1500
        setProgress(Math.round(65 + ratio * 25))
        setStatusMessage(initializationStatus || 'Preparing encrypted vault environment...')
      }
      // Phase 4: 4,500 - 5,000ms: Final completion and transition preparation (progress 90% -> 99%)
      else if (elapsed < minimumDurationMs) {
        const ratio = (elapsed - 4500) / Math.max(1, minimumDurationMs - 4500)
        setProgress(Math.round(90 + ratio * 9))
        setStatusMessage(initializationStatus || 'Finalizing initialization...')
      }
      // Minimum duration (>= 5,000ms) has elapsed
      else {
        if (isReadyRef.current) {
          setProgress(100)
          setStatusMessage('Ready.')
          clearInterval(interval)
          finishStartup()
        } else {
          // Dual condition guard: hold at 96% and display honest status until ready
          setProgress(96)
          setStatusMessage(initializationStatus || 'Waiting for local service readiness...')
          if (elapsed > 15000) {
            setShowRecovery(true)
          }
        }
      }
    }, 50)

    return () => clearInterval(interval)
  }, [hasCompleted, minimumDurationMs, initializationStatus, finishStartup])

  // Reactive listener if isReady resolves after 5,000ms
  useEffect(() => {
    if (hasCompleted || isExiting || startTimeRef.current === null) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsed = now - startTimeRef.current
    if (isReady && elapsed >= minimumDurationMs) {
      setProgress(100)
      setStatusMessage('Ready.')
      finishStartup()
    }
  }, [isReady, hasCompleted, isExiting, minimumDurationMs, finishStartup])

  if (hasCompleted) {
    return null
  }

  const handleForceContinue = () => {
    setProgress(100)
    setStatusMessage('Continuing to login...')
    finishStartup()
  }

  return (
    <div
      className={`shinpo-cinematic-startup ${isExiting ? 'is-exiting' : ''}`}
      role="status"
      aria-label="Initializing SHINPO"
      aria-live="polite"
    >
      {/* Background illumination */}
      <div className="startup-atmosphere-glow startup-glow-violet" aria-hidden="true" />
      <div className="startup-atmosphere-glow startup-glow-cyan" aria-hidden="true" />

      <div className="startup-stage">
        {/* Emblem with orbital ring animation */}
        <div className="startup-emblem-wrapper">
          <svg className="startup-orbital-svg" viewBox="0 0 180 180" fill="none" aria-hidden="true">
            {/* Outer dotted orbit */}
            <circle
              className="startup-orbital-outer"
              cx="90"
              cy="90"
              r="76"
              strokeWidth="1.2"
            />
            {/* Inner dashed orbit */}
            <circle
              className="startup-orbital-inner"
              cx="90"
              cy="90"
              r="62"
              strokeWidth="1.5"
            />
            {/* Glowing orbital tracer node */}
            <g className="startup-orbital-glow-dot">
              <circle cx="90" cy="14" r="3.5" fill="#148bff" filter="drop-shadow(0 0 4px #148bff)" />
            </g>
          </svg>

          {/* Authentic SHINPO matrix mark */}
          <ShinpoLogo size={68} variant="icon" />
        </div>

        {/* Product Wordmark */}
        <div className="startup-brand-lockup">
          <h1 className="startup-brand-title">SHINPO</h1>
          <span className="startup-brand-subtitle">Personal Execution OS</span>
        </div>

        {/* Minimal Progress Line */}
        <div className="startup-progress-container" aria-hidden="true">
          <div
            className="startup-progress-bar"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        {/* Honest Status Caption */}
        <div className="startup-status-container">
          <span className="startup-status-text">{statusMessage}</span>
        </div>

        {/* Fallback recovery when initialization exceeds 15s */}
        {showRecovery && (
          <div className="startup-recovery-action">
            <button
              type="button"
              className="startup-recovery-btn"
              onClick={handleForceContinue}
            >
              Continue to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
