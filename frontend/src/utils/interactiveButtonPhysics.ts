/**
 * Physics and math calculations for FlameButton-inspired
 * cursor-tracking, edge proximity, and theme token resolution.
 */

export interface ThemeEnergyTokens {
  primary: string
  secondary: string
  onPrimary: string
  auraOpacity: number
  glowSize: string
  ripple: string
}

export const THEME_ENERGY_CONFIGS: Record<string, ThemeEnergyTokens> = {
  'classic-dark': {
    primary: '#AFF33E',
    secondary: '#a3e635',
    onPrimary: '#020617',
    auraOpacity: 0.62,
    glowSize: '8px',
    ripple: 'rgba(175, 243, 62, 0.45)',
  },
  'classic-light': {
    primary: '#4D7C0F',
    secondary: '#3F6212',
    onPrimary: '#FFFFFF',
    auraOpacity: 0.32,
    glowSize: '6px',
    ripple: 'rgba(77, 124, 15, 0.35)',
  },
  'aurora-dark': {
    primary: '#9757FA',
    secondary: '#1BC9DE',
    onPrimary: '#FFFFFF',
    auraOpacity: 0.58,
    glowSize: '8px',
    ripple: 'rgba(151, 87, 250, 0.45)',
  },
  'aurora-light': {
    primary: '#7C3AED',
    secondary: '#0284C7',
    onPrimary: '#FFFFFF',
    auraOpacity: 0.28,
    glowSize: '6px',
    ripple: 'rgba(124, 58, 237, 0.35)',
  },
}

export const DESTRUCTIVE_ENERGY_CONFIG: ThemeEnergyTokens = {
  primary: '#F87171',
  secondary: '#DC2626',
  onPrimary: '#FFFFFF',
  auraOpacity: 0.55,
  glowSize: '8px',
  ripple: 'rgba(239, 68, 68, 0.45)',
}

/**
 * Calculates edge proximity (0..1) where 0 is dead center and 1 is either edge.
 * Uses power curve 1.6 for natural edge-biased acceleration.
 */
export function calculateEdgeProximity(normX: number): number {
  const clamped = Math.max(0, Math.min(1, normX))
  const distanceFromCenter = Math.abs(clamped - 0.5) * 2
  return Math.pow(Math.min(1, distanceFromCenter), 1.6)
}

/**
 * Calculates normalized coordinates and edge metrics for a pointer event over an element rect.
 */
export function calculateButtonInteractionMetrics(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
) {
  if (rect.width <= 0 || rect.height <= 0) {
    return {
      mouseX: 0,
      mouseY: 0,
      normX: 0.5,
      normY: 0.5,
      edgeProximity: 0,
      edgePercent: 50,
    }
  }

  const mouseX = Math.max(0, Math.min(rect.width, clientX - rect.left))
  const mouseY = Math.max(0, Math.min(rect.height, clientY - rect.top))
  const normX = mouseX / rect.width
  const normY = mouseY / rect.height
  const edgeProximity = calculateEdgeProximity(normX)
  // Continuous smooth interpolation from 12% to 88% without discontinuous center jump
  const edgePercent = Math.round((12 + 76 * normX) * 10) / 10

  return {
    mouseX,
    mouseY,
    normX,
    normY,
    edgeProximity,
    edgePercent,
  }
}
