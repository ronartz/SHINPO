import React, { useEffect, useState, useRef, useCallback } from 'react'
import { GlassLogoReveal } from './GlassLogoReveal'

export interface CinematicStartupProps {
  isReady: boolean
  onComplete: () => void
  minimumDurationMs?: number
  initializationStatus?: string
}

export const CinematicStartup: React.FC<CinematicStartupProps> = ({
  isReady,
  onComplete,
  minimumDurationMs = 4000,
}) => {
  const [isExiting, setIsExiting] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const [, setIsGlassSettled] = useState(false)
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

  // Sequence Timer Loop (minimumDurationMs = 4000ms+)
  useEffect(() => {
    if (hasCompleted) return

    if (startTimeRef.current === null) {
      startTimeRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    }

    const interval = setInterval(() => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsed = now - (startTimeRef.current || now)

      if (elapsed >= minimumDurationMs) {
        if (isReadyRef.current) {
          clearInterval(interval)
          finishStartup()
        } else {
          if (elapsed > 15000) {
            setShowRecovery(true)
          }
        }
      }
    }, 50)

    return () => clearInterval(interval)
  }, [hasCompleted, minimumDurationMs, finishStartup])

  // Reactive listener if isReady resolves after minimumDurationMs
  useEffect(() => {
    if (hasCompleted || isExiting || startTimeRef.current === null) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsed = now - startTimeRef.current
    if (isReady && elapsed >= minimumDurationMs) {
      finishStartup()
    }
  }, [isReady, hasCompleted, isExiting, minimumDurationMs, finishStartup])

  if (hasCompleted) {
    return null
  }

  const handleForceContinue = () => {
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
        {/* Central Emblem Stage with Glass Logo Reveal */}
        <div className="startup-emblem-wrapper">
          {/* Authentic SHINPO Glass Logo Reveal Engine */}
          <GlassLogoReveal
            size={240}
            onSettled={() => setIsGlassSettled(true)}
          />
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
