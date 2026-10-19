import React, { useState, useEffect } from 'react'

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

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdaysShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const monthsShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

  const dayNameShort = weekdaysShort[now.getDay()]
  const dayNumber = String(now.getDate()).padStart(2, '0')
  const monthShort = monthsShort[now.getMonth()]
  const yearNumber = now.getFullYear()

  // Hours, minutes with tabular alignment
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
      className={`dashboard-live-clock aurora-capsule-clock ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`Local time: ${formattedHours}:${minutes}:${seconds} ${ampm ? ampm + ' ' : ''}(${is24Hour ? '24-hour' : '12-hour'} format), ${weekdays[now.getDay()]}, ${now.getDate()} ${monthShort} ${yearNumber}. Click to toggle format.`}
      title={`Local time: ${formattedHours}:${minutes} ${ampm} • Click to toggle 12h/24h`}
      onClick={toggleFormat}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleFormat()
        }
      }}
    >
      {/* Region 1: Clean Left Date Info */}
      <div className="capsule-date-region">
        <span className="capsule-weekday">{dayNameShort}</span>
        <span className="capsule-day-month">{dayNumber} {monthShort}</span>
      </div>

      {/* Region 2: Center - Stable Tabular Time (Hours : Minutes) */}
      <div className="capsule-time-region">
        <span className="clock-digit-group">{formattedHours}</span>
        <span className="clock-colon">:</span>
        <span className="clock-digit-group">{minutes}</span>
      </div>

      {/* Region 3: Right - Clean Format / Period Badge (No stranded tiny text) */}
      <div className="capsule-format-region">
        <span className={`capsule-format-badge ${is24Hour ? 'badge-24h' : 'badge-12h'}`}>
          {is24Hour ? '24H' : ampm}
        </span>
      </div>
    </div>
  )
}
