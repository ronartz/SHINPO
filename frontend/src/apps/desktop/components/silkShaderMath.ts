export type SilkThemeKey = 'aurora-dark' | 'aurora-light' | 'classic-dark' | 'classic-light'

export const SILK_THEME_PALETTES: Record<SilkThemeKey, [string, string, string, string]> = {
  'aurora-dark': ['#060818', '#3b1d7a', '#4d77f9', '#1bc9de'],
  'aurora-light': ['#f0f4ff', '#dbeafe', '#c4b5fd', '#7c3aed'],
  'classic-dark': ['#070c09', '#10281b', '#1b4a32', '#aff33e'],
  'classic-light': ['#faf8f4', '#ece7da', '#d8d1bc', '#4d7c0f'],
}

/** "#rrggbb" or "#rgb" to 0-1 RGB */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n) || h.length < 6) return [0, 0, 0]
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Canvas backing size: CSS size times device ratio capped at 2 for performance */
export function backing(css: number, dpr: number): number {
  return Math.max(1, Math.round(css * Math.min(2, Math.max(1, dpr || 1))))
}

/** Pointer in shader space: centred, y up, height spans -0.5..0.5 */
export function toShader(x: number, y: number, w: number, h: number): [number, number] {
  if (w <= 0 || h <= 0) return [0, 0]
  return [(x - w / 2) / h, (h / 2 - y) / h]
}

export type LoginBackgroundMode = 'silk-mesh' | 'legacy-warp'
export const DEFAULT_LOGIN_BACKGROUND_MODE: LoginBackgroundMode = 'silk-mesh'
