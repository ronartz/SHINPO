import React, { useState, useEffect } from 'react'

export const MobileFocusView: React.FC = () => {
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const [isActive, setIsActive] = useState(false)
  const [intent, setIntent] = useState('')

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (isActive && remainingSeconds > 0) {
      timer = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsActive(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isActive, remainingSeconds])

  const handleSelectPreset = (minutes: number) => {
    if (!isActive) {
      setDurationMinutes(minutes)
      setRemainingSeconds(minutes * 60)
    }
  }

  const handleToggleActive = () => {
    setIsActive(!isActive)
  }

  const handleReset = () => {
    setIsActive(false)
    setRemainingSeconds(durationMinutes * 60)
  }

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="shinpo-mobile-focus">
      <h1 className="shinpo-mobile-heading">Focus Engine</h1>
      <p className="shinpo-mobile-subtitle">Immersive, distraction-free execution.</p>

      {/* Preset Selector */}
      <div className="shinpo-mobile-presets" role="group" aria-label="Timer Presets">
        <button
          type="button"
          className={`shinpo-mobile-preset-btn ${durationMinutes === 15 ? 'active' : ''}`}
          onClick={() => handleSelectPreset(15)}
          disabled={isActive}
        >
          15m Sprint
        </button>
        <button
          type="button"
          className={`shinpo-mobile-preset-btn ${durationMinutes === 25 ? 'active' : ''}`}
          onClick={() => handleSelectPreset(25)}
          disabled={isActive}
        >
          25m Pomodoro
        </button>
        <button
          type="button"
          className={`shinpo-mobile-preset-btn ${durationMinutes === 50 ? 'active' : ''}`}
          onClick={() => handleSelectPreset(50)}
          disabled={isActive}
        >
          50m Deep Work
        </button>
      </div>

      {/* Big Touch-Optimized Timer Card */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-timer-display">
          <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#10b981' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isActive ? '● Focus in Progress' : 'Ready to Start'}
          </span>
          <div className="shinpo-mobile-timer-digits" aria-live="polite">
            {formattedTime}
          </div>
          <div style={{ width: '100%', maxWidth: '300px', marginTop: '10px' }}>
            <input
              type="text"
              className="shinpo-mobile-input"
              placeholder="What are you focusing on?"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              disabled={isActive}
              aria-label="Focus session intent"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button
            type="button"
            className={`shinpo-mobile-btn ${isActive ? 'shinpo-mobile-btn-secondary' : 'shinpo-mobile-btn-primary'}`}
            onClick={handleToggleActive}
            style={{ flex: 2 }}
          >
            {isActive ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Session
              </>
            )}
          </button>

          {remainingSeconds < durationMinutes * 60 && (
            <button
              type="button"
              className="shinpo-mobile-btn shinpo-mobile-btn-secondary"
              onClick={handleReset}
              style={{ flex: 1 }}
              aria-label="Reset timer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Honest Architectural Boundary Notice */}
      <div className="shinpo-mobile-desktop-notice">
        <svg className="shinpo-mobile-desktop-notice-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="shinpo-mobile-desktop-notice-text">
          <strong>Desktop Shield Capabilities</strong>
          Active OS process termination and browser extension native messaging policies are enforced on the SHINPO Desktop application.
        </div>
      </div>
    </div>
  )
}
