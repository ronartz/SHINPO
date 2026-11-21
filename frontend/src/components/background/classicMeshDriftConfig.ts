export interface ClassicMeshDriftConfig {
  colors: number[]
  scene: [number, number, number, number]
  shape: [number, number, number, number]
  surface: [number, number, number, number]
  finish: [number, number, number, number]
  transform: [number, number, number, number]
  space: [number, number, number, number]
  cursor: [number, number, number, number]
}

const CLASSIC_DARK_COLORS = ['#020617', '#0F172A', '#14532D', '#AFF33E'] as const
const CLASSIC_LIGHT_COLORS = ['#F4EDE0', '#FFF9F0', '#4D7C0F', '#14532D'] as const

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255) as [number, number, number]
}

export function createClassicMeshDriftConfig(
  width: number,
  height: number,
  seconds: number,
  isDark: boolean,
): ClassicMeshDriftConfig {
  const palette = isDark ? CLASSIC_DARK_COLORS : CLASSIC_LIGHT_COLORS
  const fourColors = palette.flatMap(hexToRgb)
  // The fragment shader declares eight vec3 colors; the preset intentionally uses four.
  // Fill the remaining uniform slots with the final palette color without changing its recipe.
  const colors = [...fourColors, ...hexToRgb(palette[3]), ...hexToRgb(palette[3]), ...hexToRgb(palette[3]), ...hexToRgb(palette[3])]

  return {
    colors,
    scene: [width, height, seconds * 0.73, 4.0],
    shape: [1.10, 0.34, 0.50, 0.00],
    surface: [2.40, 0.96, -0.10, 0.96],
    finish: [0.00, 0.36, 0.026, 0.07],
    transform: [1453.0, 0.00, 0.00, 0.0],
    space: [0.00, 0.00, 0.00, 0.00],
    cursor: [0.00, 2.0, 0.65, 0.46],
  }
}
