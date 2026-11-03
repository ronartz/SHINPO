import React, { useId } from 'react'

interface ShinpoLogoProps {
  size?: number
  variant?: 'icon' | 'lockup' | 'full'
  className?: string
  monochrome?: boolean
}

export const ShinpoLogo: React.FC<ShinpoLogoProps> = ({
  size = 32,
  variant = 'icon',
  className = '',
  monochrome = false,
}) => {
  const gradientId = useId().replace(/:/g, '')
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shinpo-matrix-mark"
      style={{ display: 'inline-block', flexShrink: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${gradientId}-blue`} x1="7" y1="51" x2="77" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#164BFF" />
          <stop offset="1" stopColor="#148BFF" />
        </linearGradient>
        <linearGradient id={`${gradientId}-violet`} x1="23" y1="104" x2="86" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5428F6" />
          <stop offset="1" stopColor="#A33BFF" />
        </linearGradient>
        <mask id={`${gradientId}-notch`} maskUnits="userSpaceOnUse" x="0" y="0" width="96" height="112">
          <rect width="96" height="112" fill="white" />
          <path d="M32 52h24v-9l20 15-20 15v-9H32Z" fill="black" />
        </mask>
      </defs>
      <g mask={`url(#${gradientId}-notch)`}>
        <path d="m8 35 47-28c3-2 7-2 10 0l13 8c3 2 5 5 5 9v6c0 4-2 7-6 9L43 60 27 50l31-19-43 25c-3 2-7 2-10 0l-4-2v-9c0-4 2-8 7-10Z" fill={monochrome ? 'currentColor' : `url(#${gradientId}-blue)`} />
        <path d="m24 71 37-23c3-2 7-2 10 0l15 9c3 2 5 5 5 9v13c0 4-2 7-6 9l-41 24c-3 2-7 2-10 0l-16-9c-3-2-5-5-5-9v-9c0-4 2-7 6-9l28-17 14 9-29 18 20-12-13-8Z" fill={monochrome ? 'currentColor' : `url(#${gradientId}-violet)`} />
      </g>
    </svg>
  )

  if (variant === 'icon') {
    return <span className={`shinpo-logo-container ${className}`} role="img" aria-label="SHINPO">{mark}</span>
  }

  return (
    <div
      className={`shinpo-logo-lockup ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.max(8, Math.round(size * 0.35)), userSelect: 'none' }}
    >
      {mark}
      <div className="shinpo-logo-text-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
        <div className="shinpo-logo-wordmark" style={{
          color: 'var(--text)',
          fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: Math.round(size * 0.62),
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          SHINPO
        </div>
        {variant === 'full' && <span className="shinpo-logo-tagline">PLAN · FOCUS · PROTECT · PROGRESS</span>}
      </div>
    </div>
  )
}
