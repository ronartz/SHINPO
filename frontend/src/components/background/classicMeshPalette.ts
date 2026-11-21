/**
 * Classic's mesh colours come from its existing semantic palette, not Aurora.
 * The shader's four reference colours are replaced by these theme tokens;
 * its fragment source and packed uniforms remain unchanged.
 */
const CLASSIC_MESH_TOKENS = {
  dark: [
    ['--palette-dark-background', '#020617'],
    ['--palette-dark-surface-1', '#0F172A'],
    ['--palette-dark-accent', '#14532D'],
    ['--palette-dark-primary', '#AFF33E'],
  ],
  light: [
    ['--palette-light-background', '#F4EDE0'],
    ['--palette-light-surface-1', '#FFF9F0'],
    ['--palette-light-primary', '#4D7C0F'],
    ['--palette-light-accent', '#14532D'],
  ],
} as const

export type ClassicMeshMode = keyof typeof CLASSIC_MESH_TOKENS

function parseHexColour(value: string): [number, number, number] | null {
  const hex = value.trim()
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ]
}

export function classicMeshUniformColours(
  mode: ClassicMeshMode,
  style: Pick<CSSStyleDeclaration, 'getPropertyValue'>,
): Float32Array {
  // Eight vec3 uniforms are required by the exact WebGL1 shader.
  // Only the first four colours are used by u_scene.w = 4.
  const colours = new Float32Array(8 * 3)
  CLASSIC_MESH_TOKENS[mode].forEach(([token, fallback], index) => {
    const rgb = parseHexColour(style.getPropertyValue(token)) ?? parseHexColour(fallback)!
    colours.set(rgb, index * 3)
  })
  return colours
}
