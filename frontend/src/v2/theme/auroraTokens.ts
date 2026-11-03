/** CSS tokens in styles/tokens.css are the canonical palette for CSS and MUI. */

export const auroraGradients = {
  primary: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-surface-2) 100%)',
  primaryHover: 'linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary) 100%)',
  primarySubtleDark: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
  primarySubtleLight: 'color-mix(in srgb, var(--color-primary) 8%, transparent)',
  glowDark: 'none',
  glowLight: 'none',
  borderDark: 'var(--border)',
  borderLight: 'var(--border)',
}

export const auroraColors = {
  dark: {
    canvas: 'var(--color-background)',
    canvasSecondary: 'var(--color-surface-2)',
    elevated: 'var(--color-surface-3)',
    card: 'var(--color-surface-1)',
    cardHover: 'var(--surface-hover)',
    border: 'var(--border)',
    borderStrong: 'var(--border-strong)',
    glass: 'var(--color-surface-1)',
    glassBorder: 'var(--border)',
    textPrimary: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    textMuted: 'var(--color-text-muted)',
    primaryBlue: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    focusCyan: 'var(--color-focus)',
    aiViolet: 'var(--color-ai)',
    onPrimary: 'var(--color-on-primary)',
    success: 'var(--color-success)',
    onSuccess: 'var(--color-on-success)',
    warning: 'var(--color-warning)',
    onWarning: 'var(--color-on-warning)',
    error: 'var(--color-danger)',
    onError: 'var(--color-on-danger)',
    info: 'var(--color-info)',
  },
  light: {
    canvas: 'var(--color-background)',
    canvasSecondary: 'var(--color-surface-2)',
    elevated: 'var(--color-surface-3)',
    subtleTint: 'var(--color-surface-3)',
    card: 'var(--color-surface-1)',
    cardHover: 'var(--surface-hover)',
    border: 'var(--border)',
    borderStrong: 'var(--border-strong)',
    glass: 'var(--color-surface-1)',
    glassBorder: 'var(--border)',
    textPrimary: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    textMuted: 'var(--color-text-muted)',
    primaryBlue: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    focusCyan: 'var(--color-focus)',
    aiViolet: 'var(--color-ai)',
    onPrimary: 'var(--color-on-primary)',
    success: 'var(--color-success)',
    onSuccess: 'var(--color-on-success)',
    warning: 'var(--color-warning)',
    onWarning: 'var(--color-on-warning)',
    error: 'var(--color-danger)',
    onError: 'var(--color-on-danger)',
    info: 'var(--color-info)',
  },
}

/** Fallbacks are used only when the stylesheet is unavailable (for example, in SSR tests). */
export const auroraColorFallbacks = {
  dark: {
    canvas: '#0B1120', canvasSecondary: '#1E293B', elevated: '#29364B', card: '#111A2D',
    cardHover: '#29364B', border: 'rgba(203, 213, 225, 0.14)', borderStrong: 'rgba(203, 213, 225, 0.24)',
    glass: '#111A2D', glassBorder: 'rgba(203, 213, 225, 0.14)', textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1', textMuted: '#94A3B8', primaryBlue: '#3B82F6', primaryHover: '#5E99F8', focusCyan: '#22D3EE',
    aiViolet: '#A78BFA', onPrimary: '#0B1120', success: '#16A36A', onSuccess: '#0B1120', warning: '#B7791F', onWarning: '#0B1120',
    error: '#E65363', onError: '#0B1120', info: '#3B82F6',
  },
  light: {
    canvas: '#F8FAFC', canvasSecondary: '#F1F5F9', elevated: '#E9EFF7', subtleTint: '#E9EFF7',
    card: '#FFFFFF', cardHover: '#E9EFF7', border: '#CBD5E1', borderStrong: '#94A3B8',
    glass: '#FFFFFF', glassBorder: '#CBD5E1', textPrimary: '#0F172A', textSecondary: '#334155',
    textMuted: '#475569', primaryBlue: '#2563EB', primaryHover: '#1F53C5', focusCyan: '#0E7490', aiViolet: '#6D5BD0',
    onPrimary: '#FFFFFF', success: '#087A50', onSuccess: '#FFFFFF', warning: '#8A5700', onWarning: '#FFFFFF', error: '#C73548', onError: '#FFFFFF', info: '#2563EB',
  },
}

export const auroraTypography = {
  fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontHeading: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontBody: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSizes: {
    display: 28,
    title: 28,
    heading: 22,
    cardHeading: 18,
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

