import React, { useState, useEffect } from 'react'
import { Icon } from './Icon'

export interface LiveClockProps {
  className?: string
}

export const LiveClock: React.FC<LiveClockProps> = ({ className = '' }) => {
  const [now, setNow] = useState<Date>(() => new Date())
  const [is24Hour, setIs24Hour] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shinpo_time_format') === '24h'
    } catch {
      return false
    }
  })

  useEffect(() => {
    // 1-second interval timer
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)

    // Resynchronize on window focus or visibility change to prevent clock drift
    const handleSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setNow(new Date())
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleSync)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleSync)
    }

    return () => {
      clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleSync)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleSync)
      }
    }
  }, [])

  const toggleFormat = () => {
    setIs24Hour((prev) => {
      const next = !prev
      try {
        localStorage.setItem('shinpo_time_format', next ? '24h' : '12h')
      } catch {
        // Ignore localStorage write failures in sandboxed environments
      }
      return next
    })
  }

  // Guaranteed format: e.g. "Wednesday, 14 October 2026"
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const formattedDate = `${weekdays[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`

  // Hours, minutes, seconds with tabular alignment
  let hours = now.getHours()
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  let ampm = ''

  if (!is24Hour) {
    ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
  }
  const formattedHours = String(hours).padStart(2, '0')

  return (
    <div
      className={`dashboard-live-clock ${className}`}
      role="timer"
      aria-label={`Local time: ${formattedHours}:${minutes}:${seconds} ${ampm}, ${formattedDate}`}
      title="Computer local time (Click to toggle 12h / 24h format)"
      onClick={toggleFormat}
    >
      <div className="live-clock-time-display">
        <div className="live-clock-icon-wrap">
          <Icon name="clock" size={16} />
        </div>
        <span className="live-clock-digits">
          <span className="clock-digit-group">{formattedHours}</span>
          <span className="clock-colon">:</span>
          <span className="clock-digit-group">{minutes}</span>
          <span className="clock-colon">:</span>
          <span className="clock-digit-group clock-seconds">{seconds}</span>
        </span>
        {!is24Hour && <span className="live-clock-ampm">{ampm}</span>}
      </div>
      <div className="live-clock-date-display">
        <span>{formattedDate}</span>
      </div>
    </div>
  )
}
