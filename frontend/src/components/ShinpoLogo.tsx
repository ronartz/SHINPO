import React from 'react'
import shinpoLogoUrl from '../assets/shinpo-logo.png'

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
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shinpo-matrix-mark"
      style={{
        display: 'inline-block',
        flexShrink: 0,
        filter: monochrome ? 'grayscale(100%) brightness(1.2)' : undefined,
      }}
      aria-hidden="true"
      focusable="false"
    >
      <image width="1024" height="1024" href={shinpoLogoUrl} />
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
