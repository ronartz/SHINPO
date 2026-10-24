import React from 'react'

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
  const iconHeight = size
  const iconWidth = size

  const mark = (
    <svg
      width={iconWidth}
      height={iconHeight}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shinpo-matrix-mark"
      style={{ display: 'inline-block', flexShrink: 0 }}
      aria-label="SHINPO Dual Catalyst Matrix"
    >
      <defs>
        <linearGradient id="shinpoTopShear" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#19D3C5" />
          <stop offset="48%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#3156D8" />
        </linearGradient>
        <linearGradient id="shinpoBotShear" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#19D3C5" />
          <stop offset="52%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#3156D8" />
        </linearGradient>
      </defs>

      {/* Top Arm: 45° Shear Kinematic */}
      <polygon
        points="44,5 95,5 95,21 60,21 37,44 5,44"
        fill={monochrome ? 'currentColor' : 'url(#shinpoTopShear)'}
      />

      {/* Bottom Arm: Balanced 180° Inverted Kinematic */}
      <polygon
        points="56,95 5,95 5,79 40,79 63,56 95,56"
        fill={monochrome ? 'currentColor' : 'url(#shinpoBotShear)'}
      />
    </svg>
  )

  if (variant === 'icon') {
    return <div className={`shinpo-logo-container ${className}`}>{mark}</div>
  }

  return (
    <div
      className={`shinpo-logo-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.max(8, Math.round(size * 0.35)),
        userSelect: 'none',
      }}
    >
      {mark}
      <div
        className="shinpo-logo-text-group"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <div
            className="shinpo-logo-wordmark"
            style={{
              fontFamily:
                "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              fontSize: Math.round(size * 0.62),
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: 'var(--text)',
              textTransform: 'uppercase',
            }}
          >
            SHINPO
          </div>
          {variant === 'full' && (
            <span
              className="shinpo-logo-kanji"
              style={{
                fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif",
                fontSize: Math.max(12, Math.round(size * 0.36)),
                fontWeight: 700,
                color: 'var(--primary-violet, #3156D8)',
                letterSpacing: '0.04em',
              }}
            >
              進歩
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
