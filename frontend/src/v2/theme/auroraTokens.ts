/**
 * SHINPO UI V2 — CINEMATIC AURORA DESIGN TOKENS
 * Primary visual identity: Material UI + Cinematic Aurora Gradients + Glassmorphism + Subtle Neumorphism
 */

export const auroraGradients = {
  primary: 'linear-gradient(135deg, #9757FA 0%, #4D77F9 50%, #1BC9DE 100%)',
  primaryHover: 'linear-gradient(135deg, #A86EFB 0%, #5E85FA 50%, #30D2E4 100%)',
  primarySubtleDark: 'linear-gradient(135deg, rgba(151, 87, 250, 0.15) 0%, rgba(77, 119, 249, 0.12) 50%, rgba(27, 201, 222, 0.10) 100%)',
  primarySubtleLight: 'linear-gradient(135deg, rgba(151, 87, 250, 0.08) 0%, rgba(77, 119, 249, 0.06) 50%, rgba(27, 201, 222, 0.05) 100%)',
  glowDark: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(151, 87, 250, 0.25), rgba(77, 119, 249, 0.12) 40%, transparent 80%)',
  glowLight: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(151, 87, 250, 0.12), rgba(77, 119, 249, 0.08) 40%, transparent 80%)',
  borderDark: 'linear-gradient(135deg, rgba(151, 87, 250, 0.5) 0%, rgba(77, 119, 249, 0.4) 50%, rgba(27, 201, 222, 0.4) 100%)',
  borderLight: 'linear-gradient(135deg, rgba(151, 87, 250, 0.35) 0%, rgba(77, 119, 249, 0.3) 50%, rgba(27, 201, 222, 0.3) 100%)',
}

export const auroraColors = {
  dark: {
    canvas: '#0A0F20',
    canvasSecondary: '#0E1428',
    elevated: '#111B31',
    card: '#192541',
    cardHover: '#1E2C4D',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.16)',
    glass: 'rgba(25, 37, 65, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#F5F7FF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    accentPurple: '#9757FA',
    accentBlue: '#4D77F9',
    accentCyan: '#1BC9DE',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#FF4D5E',
    info: '#38BDF8',
  },
  light: {
    canvas: '#F4F6FD',
    canvasSecondary: '#ECEFFB',
    elevated: '#FFFFFF',
    subtleTint: '#E9EDFB',
    card: '#FFFFFF',
    cardHover: '#F9FAFF',
    border: 'rgba(77, 119, 249, 0.12)',
    borderStrong: 'rgba(77, 119, 249, 0.24)',
    glass: 'rgba(255, 255, 255, 0.78)',
    glassBorder: 'rgba(77, 119, 249, 0.16)',
    textPrimary: '#17213A',
    textSecondary: '#5B6B8A',
    textMuted: '#8B9BB4',
    accentPurple: '#7932E6',
    accentBlue: '#2B58E6',
    accentCyan: '#008CA3',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
    info: '#0284C7',
  },
}

export const auroraTypography = {
  fontHeading: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
}

export const auroraShadows = {
  dark: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.35)',
    md: '0 8px 24px rgba(0, 0, 0, 0.45)',
    lg: '0 16px 40px rgba(0, 0, 0, 0.55)',
    glow: '0 0 30px rgba(151, 87, 250, 0.25)',
    hoverTilt: '0 20px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(77, 119, 249, 0.25)',
    neumorphicPushed: 'inset 2px 2px 6px rgba(0, 0, 0, 0.5), inset -2px -2px 6px rgba(255, 255, 255, 0.05)',
  },
  light: {
    sm: '0 2px 8px rgba(77, 119, 249, 0.06)',
    md: '0 8px 24px rgba(77, 119, 249, 0.10)',
    lg: '0 16px 40px rgba(77, 119, 249, 0.14)',
    glow: '0 0 28px rgba(77, 119, 249, 0.18)',
    hoverTilt: '0 18px 44px rgba(77, 119, 249, 0.18), 0 0 20px rgba(151, 87, 250, 0.14)',
    neumorphicPushed: 'inset 2px 2px 6px rgba(77, 119, 249, 0.12), inset -2px -2px 6px #FFFFFF',
  },
}

export const auroraTransitions = {
  tilt: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
  standard: 'all 180ms ease-out',
  spring: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
}

