/**
 * SHINPO UI V2 — CINEMATIC AURORA DESIGN TOKENS
 * Primary visual identity: Material UI + Cinematic Aurora Gradients + Glassmorphism + Subtle Neumorphism
 */

export const auroraGradients = {
  primary: 'linear-gradient(135deg, #9757FA 0%, #7932E6 100%)',
  primaryHover: 'linear-gradient(135deg, #A86EFB 0%, #8E4DF0 100%)',
  primarySubtleDark: 'rgba(151, 87, 250, 0.12)',
  primarySubtleLight: 'rgba(121, 50, 230, 0.06)',
  glowDark: 'none',
  glowLight: 'none',
  borderDark: 'rgba(255, 255, 255, 0.10)',
  borderLight: 'rgba(0, 0, 0, 0.08)',
}

export const auroraColors = {
  dark: {
    canvas: '#121316',
    canvasSecondary: '#18191E',
    elevated: '#282A33',
    card: '#1D1E24',
    cardHover: '#262730',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
    glass: 'rgba(29, 30, 36, 0.9)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#F3F4F6',
    textSecondary: '#B0B5C2',
    textMuted: '#9096A4',
    accentPurple: '#9757FA',
    accentBlue: '#4D77F9',
    accentCyan: '#1BC9DE',
    success: '#10B981',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#1BC9DE',
  },
  light: {
    canvas: '#F7F6F3',
    canvasSecondary: '#EFECE6',
    elevated: '#FFFFFF',
    subtleTint: '#F2EFEB',
    card: '#FFFFFF',
    cardHover: '#FAFAF8',
    border: '#E9E7E3',
    borderStrong: '#DBD8D3',
    glass: 'rgba(255, 255, 255, 0.9)',
    glassBorder: '#E9E7E3',
    textPrimary: '#18191B',
    textSecondary: '#484C56',
    textMuted: '#4B5563',
    accentPurple: '#7932E6',
    accentBlue: '#2B58E6',
    accentCyan: '#008CA3',
    success: '#059669',
    warning: '#B45309',
    error: '#B91C1C',
    info: '#008CA3',
  },
}

export const auroraTypography = {
  fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontHeading: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontBody: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSizes: {
    display: 28,
    title: 22,
    heading: 18,
    subheading: 16,
    body: 15,
    label: 14,
    explanation: 13.5,
    caption: 13,
    metadata: 12,
  },
}

export const auroraShadows = {
  dark: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.20)',
    md: '0 4px 14px rgba(0, 0, 0, 0.30)',
    lg: '0 12px 32px rgba(0, 0, 0, 0.45)',
    glow: 'none',
    hoverTilt: '0 6px 20px rgba(0, 0, 0, 0.35)',
    neumorphicPushed: 'none',
  },
  light: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.06)',
    lg: '0 12px 28px rgba(0, 0, 0, 0.08)',
    glow: 'none',
    hoverTilt: '0 6px 18px rgba(0, 0, 0, 0.08)',
    neumorphicPushed: 'none',
  },
}

export const auroraTransitions = {
  tilt: 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
  standard: 'all 180ms ease-out',
  spring: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
}

