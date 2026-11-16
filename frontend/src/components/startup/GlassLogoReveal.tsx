/*
 * GlassLogoReveal.tsx
 *
 * SHINPO (進歩) — Cinematic Glass Logo Reveal
 *
 * High-performance WebGL2 glass refraction and chromatic dispersion engine.
 * Renders an authentic SHINPO logo through an interactive glass-droplet reveal:
 *   1. Glass droplet forms at center of stage.
 *   2. Authentic SHINPO logo appears magnified inside the glass.
 *   3. Glass surface refracts and disperses light along superellipse bevel rims.
 *   4. Glass settles and releases smoothly, leaving the sharp, crisp SHINPO mark.
 *
 * Attribution:
 * Shader mathematics and spring-motion timeline adapted from:
 * zanwei/glass-icon-reveal (MIT License)
 * https://github.com/zanwei/glass-icon-reveal
 * Copyright (c) 2024 Zan Wei
 * Adapted for SHINPO Personal Execution OS.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react'
import shinpoLogoUrl from '../../assets/shinpo-logo.png'
import { ShinpoLogo } from '../ShinpoLogo'
import type {
  Look,
  GlassTuning,
  Settings,
  Frame,
} from './glassShaderEngine'
import {
  LOOKS,
  TEX,
  BOX,
  endOf,
  clamp01,
  frameAt,
  VERT,
  FRAG,
  OUTRO,
} from './glassShaderEngine'

export type { Look, GlassTuning, Settings }

/* ------------------------------------------------------------------ *
 * Logo → texture + signed distance field
 * ------------------------------------------------------------------ */
interface LogoData {
  canvas: HTMLCanvasElement
  sdf: Float32Array
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    if (src.startsWith('http://') || src.startsWith('https://')) {
      try {
        if (new URL(src, window.location.href).origin !== window.location.origin) {
          img.crossOrigin = 'anonymous'
        }
      } catch {
        img.crossOrigin = 'anonymous'
      }
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('GlassLogoReveal: could not load logo asset'))
    img.src = src
  })
}

function isMarkup(logo: string): boolean {
  return logo.trimStart().startsWith('<')
}

function svgToUrl(text: string): string {
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
    throw new Error('GlassLogoReveal: invalid SVG markup')
  }
  let w = parseFloat(svg.getAttribute('width') || '')
  let h = parseFloat(svg.getAttribute('height') || '')
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    ;[w, h] = [vb[2], vb[3]]
  }
  if (!(w > 0 && h > 0)) {
    w = h = 100
  }
  const s = TEX / Math.max(w, h)
  svg.setAttribute('width', String(Math.round(w * s)))
  svg.setAttribute('height', String(Math.round(h * s)))
  const out = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, '#ffffff')
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out)
}

const logoUrl = (logo: string) => (isMarkup(logo) ? svgToUrl(logo) : logo)

function fitToTexture(source: CanvasImageSource, sw: number, sh: number): HTMLCanvasElement {
  const tmp = document.createElement('canvas')
  tmp.width = tmp.height = TEX
  const tc = tmp.getContext('2d', { willReadFrequently: true })
  if (!tc) throw new Error('GlassLogoReveal: failed to acquire 2D canvas context')

  const s0 = Math.min(TEX / sw, TEX / sh)
  const dx0 = (TEX - sw * s0) / 2
  const dy0 = (TEX - sh * s0) / 2
  tc.drawImage(source, dx0, dy0, sw * s0, sh * s0)
  const d = tc.getImageData(0, 0, TEX, TEX).data

  let opaque = true
  for (let i = 3; i < d.length; i += 4 * 97) {
    if (d[i] < 250) {
      opaque = false
      break
    }
  }

  const key = [d[0], d[1], d[2]]
  const keyAlpha = (r: number, g: number, b: number) =>
    Math.min(1, Math.max(0, (Math.hypot(r - key[0], g - key[1], b - key[2]) / 441 - 0.08) / 0.2))

  let x0 = TEX
  let y0 = TEX
  let x1 = -1
  let y1 = -1

  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const i = (y * TEX + x) * 4
      const a = opaque ? keyAlpha(d[i], d[i + 1], d[i + 2]) * 255 : d[i + 3]
      if (a > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }

  if (x1 < 0) throw new Error('GlassLogoReveal: empty logo mask')
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const s = (TEX * BOX) / Math.max(bw, bh)

  const out = document.createElement('canvas')
  out.width = out.height = TEX
  const oc = out.getContext('2d', { willReadFrequently: true })
  if (!oc) throw new Error('GlassLogoReveal: failed to create output canvas')
  oc.imageSmoothingQuality = 'high'
  oc.drawImage(
    source,
    TEX / 2 - (x0 + bw / 2 - dx0) * s,
    TEX / 2 - (y0 + bh / 2 - dy0) * s,
    sw * s0 * s,
    sh * s0 * s
  )

  if (opaque) {
    const im = oc.getImageData(0, 0, TEX, TEX)
    const e = im.data
    for (let i = 0; i < e.length; i += 4) {
      e[i + 3] = Math.round(e[i + 3] * keyAlpha(e[i], e[i + 1], e[i + 2]))
    }
    oc.putImageData(im, 0, 0)
  }
  return out
}

function buildSdf(canvas: HTMLCanvasElement): Float32Array {
  const n = TEX * TEX
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('GlassLogoReveal: failed to acquire canvas context for SDF')
  const alpha = ctx.getImageData(0, 0, TEX, TEX).data
  const INF = 1e20
  const outer = new Float64Array(n)
  const inner = new Float64Array(n)

  for (let i = 0; i < n; i++) {
    const a = alpha[i * 4 + 3] / 255
    if (a >= 1) {
      outer[i] = 0
      inner[i] = INF
    } else if (a <= 0) {
      outer[i] = INF
      inner[i] = 0
    } else {
      const dd = 0.5 - a
      outer[i] = dd > 0 ? dd * dd : 0
      inner[i] = dd < 0 ? dd * dd : 0
    }
  }

  const f = new Float64Array(TEX)
  const z = new Float64Array(TEX + 1)
  const v = new Uint16Array(TEX)
  edt(outer, f, v, z, INF)
  edt(inner, f, v, z, INF)

  const sdf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    sdf[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / TEX
  }
  return sdf
}

function edt(grid: Float64Array, f: Float64Array, v: Uint16Array, z: Float64Array, INF: number) {
  for (let x = 0; x < TEX; x++) edt1d(grid, x, TEX, f, v, z, INF)
  for (let y = 0; y < TEX; y++) edt1d(grid, y * TEX, 1, f, v, z, INF)
}

function edt1d(
  grid: Float64Array,
  offset: number,
  stride: number,
  f: Float64Array,
  v: Uint16Array,
  z: Float64Array,
  INF: number
) {
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  f[0] = grid[offset]

  let k = 0
  for (let q = 1; q < TEX; q++) {
    f[q] = grid[offset + q * stride]
    const q2 = q * q
    let s: number
    do {
      const r = v[k]
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2
    } while (s <= z[k] && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }

  for (let q = 0, k = 0; q < TEX; q++) {
    while (z[k + 1] < q) k++
    const r = v[k]
    const qr = q - r
    grid[offset + q * stride] = f[r] + qr * qr
  }
}

const logoCache = new Map<string, Promise<LogoData>>()

function loadLogo(logo: string): Promise<LogoData> {
  let job = logoCache.get(logo)
  if (!job) {
    job = loadImage(logoUrl(logo)).then((img) => {
      const canvas = fitToTexture(img, img.naturalWidth || TEX, img.naturalHeight || TEX)
      return { canvas, sdf: buildSdf(canvas) }
    })
    logoCache.set(logo, job)
    job.catch(() => logoCache.delete(logo))
  }
  return job
}

// Pre-warm cache for the default SHINPO logo in browser environments
if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
  try {
    loadLogo(shinpoLogoUrl).catch(() => {})
  } catch {
    // Non-browser or headless fallback
  }
}

/* ------------------------------------------------------------------ *
 * WebGL2 Renderer
 * ------------------------------------------------------------------ */
function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  })
  if (!gl) return null

  // Enable float texture linear filtering if supported
  const hasFloatLinear = gl.getExtension('OES_texture_float_linear') != null

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)
    if (!sh) throw new Error('GlassLogoReveal: could not allocate shader')
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || 'unknown compilation error'
      gl.deleteShader(sh)
      throw new Error(`GlassLogoReveal shader error: ${log}`)
    }
    return sh
  }

  const prog = gl.createProgram()
  if (!prog) throw new Error('GlassLogoReveal: could not allocate program')
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || 'unknown link error'
    gl.deleteProgram(prog)
    throw new Error(`GlassLogoReveal link error: ${log}`)
  }
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const U: Record<string, WebGLUniformLocation | null> = {}
  const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS) as number
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(prog, i)
    if (info) {
      U[info.name] = gl.getUniformLocation(prog, info.name)
    }
  }

  const sdfTex = gl.createTexture()
  const colTex = gl.createTexture()
  gl.uniform1i(U.uSdf, 0)
  gl.uniform1i(U.uCol, 1)
  let hasLogo = false

  const params = (minFilter: number, magFilter: number = gl.LINEAR) => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  function setLogo(logo: LogoData) {
    if (!gl) return
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sdfTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, TEX, TEX, 0, gl.RED, gl.FLOAT, logo.sdf)
    params(hasFloatLinear ? gl.LINEAR : gl.NEAREST, hasFloatLinear ? gl.LINEAR : gl.NEAREST)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, colTex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, logo.canvas)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.generateMipmap(gl.TEXTURE_2D)
    params(gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR)
    hasLogo = true
  }

  function render(fr: Frame, w: number, h: number, tilePx: number) {
    if (!hasLogo || !gl) return
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(U.uCenter, w / 2, h / 2)
    gl.uniform1f(U.uTile, tilePx)
    gl.uniform1f(U.uTexSize, TEX)
    gl.uniform1f(U.uBoxFrac, BOX)
    for (const k in fr) {
      const v = fr[k as keyof Frame]
      if (typeof v === 'number' && U[k]) {
        gl.uniform1f(U[k], v)
      }
    }
    gl.uniform3fv(U.uBg, fr.uBg)
    gl.uniform3fv(U.uPlateCol, fr.uPlateCol)
    gl.uniform3fv(U.uLogoCol, fr.uLogoCol)
    gl.uniform2fv(U.uLogoOff, fr.uLogoOff)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function dispose() {
    try {
      gl?.deleteProgram(prog)
      gl?.deleteShader(vs)
      gl?.deleteShader(fs)
      gl?.deleteBuffer(buf)
      gl?.deleteTexture(sdfTex)
      gl?.deleteTexture(colTex)
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      // Ignored during unmount
    }
  }

  return { setLogo, render, dispose }
}

/* ------------------------------------------------------------------ *
 * Engine Instance
 * ------------------------------------------------------------------ */
function startEngine(
  wrap: HTMLDivElement,
  live: React.RefObject<{
    settings: Settings
    loop: boolean
    speed: number
    time?: number
    onSettled?: () => void
  }>
) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;'
  wrap.appendChild(canvas)

  let renderer: ReturnType<typeof createRenderer> = null
  try {
    renderer = createRenderer(canvas)
  } catch (err) {
    console.warn('GlassLogoReveal: WebGL2 context failed', err)
  }
  if (!renderer) {
    canvas.remove()
    return null
  }

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let logo: LogoData | null = null
  let time = reduceMotion ? 3.6 : 0
  let playing = !reduceMotion
  let pauseLeft = 0
  let outro = 0
  let dirty = true
  let visible = false
  let lost = false
  let raf = 0
  let last = 0
  let notifiedSettled = false

  function tick(now: number) {
    raf = 0
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    const { settings: P, loop, speed, time: fixed, onSettled } = live.current
    const end = endOf(P)

    if (fixed !== undefined) {
      playing = false
      time = fixed
      outro = clamp01((fixed - end - Math.max(0.05, P.hold)) / OUTRO)
    } else if (playing && logo) {
      if (pauseLeft > 0) {
        pauseLeft -= dt
        const was = outro
        outro = clamp01(1 - pauseLeft / OUTRO)
        if (pauseLeft <= 0) {
          pauseLeft = 0
          outro = 0
          time = 0
        }
        if (outro !== was || time === 0) dirty = true
      } else {
        time += dt * speed
        if (time >= end) {
          time = end
          if (loop) {
            pauseLeft = Math.max(0.05, P.hold) + OUTRO
          } else {
            playing = false
            if (!notifiedSettled) {
              notifiedSettled = true
              onSettled?.()
            }
          }
        }
        dirty = true
      }
    }

    if (dirty && logo && renderer && !lost) {
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
      const cw = canvas.clientWidth || 240
      const ch = canvas.clientHeight || 240
      const w = Math.max(1, Math.round(cw * dpr))
      const h = Math.max(1, Math.round(ch * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const tile = Math.min(P.tileSize, Math.min(cw, ch) / 1.5)
      renderer.render(frameAt(Math.min(time, end), P, outro), w, h, tile * dpr)
      dirty = false
    }

    if (visible && playing && logo && !lost) {
      raf = requestAnimationFrame(tick)
    }
  }

  function kick() {
    if (raf || !visible || lost) return
    last = typeof performance !== 'undefined' ? performance.now() : Date.now()
    raf = requestAnimationFrame(tick)
  }

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) kick()
    else if (raf) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  })
  io.observe(wrap)

  const ro = new ResizeObserver(() => {
    dirty = true
    kick()
  })
  ro.observe(wrap)

  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
  }
  const onRestored = () => {
    lost = false
    try {
      renderer = createRenderer(canvas)
      if (renderer && logo) renderer.setLogo(logo)
    } catch (err) {
      console.warn('GlassLogoReveal: WebGL restoration failed', err)
    }
    dirty = true
    kick()
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', onRestored)

  return {
    setLogo(data: LogoData) {
      logo = data
      renderer?.setLogo(data)
      if (!reduceMotion) {
        time = 0
        playing = true
        pauseLeft = 0
        outro = 0
        notifiedSettled = false
      }
      dirty = true
      kick()
    },
    replay() {
      time = 0
      playing = true
      pauseLeft = 0
      outro = 0
      notifiedSettled = false
      dirty = true
      kick()
    },
    invalidate() {
      dirty = true
      kick()
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      renderer?.dispose()
      canvas.remove()
    },
  }
}

/* ------------------------------------------------------------------ *
 * Component Interface
 * ------------------------------------------------------------------ */
export interface GlassLogoRevealProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Logo source URL or SVG. Defaults to authentic SHINPO logo */
  logo?: string
  /** Stage size in pixels (default: 240) */
  size?: number
  /** Look preset: 'dark' (default) or 'light' */
  look?: Look
  /** Canvas backdrop colour matching surrounding stage */
  background?: string
  logoColor?: string
  plateColor?: string
  iconPlate?: boolean
  keepPlate?: boolean
  originalColors?: boolean
  tileSize?: number
  logoScale?: number
  finalScale?: number
  logoOffset?: [number, number]
  loop?: boolean
  hold?: number
  speed?: number
  time?: number
  tuning?: Partial<GlassTuning>
  label?: string
  /** Fired when reveal settles and leaves the crisp logo mark */
  onSettled?: () => void
}

export const GlassLogoReveal: React.FC<GlassLogoRevealProps> = ({
  logo = shinpoLogoUrl,
  size = 240,
  look = 'dark',
  background,
  logoColor,
  plateColor,
  iconPlate = false,
  keepPlate = false,
  originalColors = true,
  tileSize,
  logoScale = 0.72,
  finalScale = 0.9,
  logoOffset,
  loop = false,
  hold = 1,
  speed = 1,
  time,
  tuning,
  label = 'SHINPO Logo',
  className = '',
  style,
  onSettled,
  onClick,
  ...props
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ReturnType<typeof startEngine> | null>(null)
  const [fallback, setFallback] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })

  // Resolve theme background default if not explicitly provided
  const effectiveBackground = useMemo(() => {
    if (background) return background
    if (typeof document !== 'undefined') {
      const theme = document.documentElement.getAttribute('data-theme')
      if (theme === 'classic-dark') return '#0d1527'
      if (theme === 'aurora-light') return '#f1f5f9'
      if (theme === 'classic-light') return '#f5ecd8'
    }
    return look === 'light' ? '#f1f5f9' : '#0f1738'
  }, [background, look])

  const tuningKey = JSON.stringify(tuning ?? {})
  const offsetKey = logoOffset ? logoOffset.join(',') : ''
  const settings = useMemo<Settings>(() => {
    const own = {
      background: effectiveBackground,
      logoColor,
      plateColor,
      iconPlate,
      keepPlate,
      originalColors,
      tileSize: tileSize || Math.round(size * 0.75),
      logoScale,
      finalScale,
      hold,
    }
    const set: Partial<Settings> = Object.fromEntries(
      Object.entries(own).filter(([, v]) => v !== undefined)
    )
    if (offsetKey) {
      set.logoOffset = offsetKey.split(',').map(Number) as [number, number]
    }
    return {
      ...LOOKS[look],
      ...set,
      ...(JSON.parse(tuningKey) as Partial<GlassTuning>),
    }
  }, [
    look,
    effectiveBackground,
    logoColor,
    plateColor,
    iconPlate,
    keepPlate,
    originalColors,
    tileSize,
    size,
    logoScale,
    finalScale,
    hold,
    offsetKey,
    tuningKey,
  ])

  const live = useRef({ settings, loop, speed, time, onSettled })

  // Synchronize dynamic parameters with running WebGL engine
  useEffect(() => {
    live.current = { settings, loop, speed, time, onSettled }
    engineRef.current?.invalidate()
  }, [settings, loop, speed, time, onSettled])

  // Fire onSettled if fallback was activated
  useEffect(() => {
    if (fallback) {
      onSettled?.()
    }
  }, [fallback, onSettled])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const engine = startEngine(wrap, live)
    if (!engine) {
      setFallback(true)
      return
    }
    engineRef.current = engine
    return () => {
      engineRef.current = null
      engine.dispose()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadLogo(logo).then(
      (data) => {
        if (cancelled) return
        engineRef.current?.setLogo(data)
      },
      (err) => {
        console.warn('GlassLogoReveal: failed to process logo SDF', err)
        if (!cancelled) {
          setFallback(true)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [logo])

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      className={`shinpo-glass-logo-stage ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        WebkitMaskImage: 'radial-gradient(circle at center, black 70%, transparent 100%)',
        maskImage: 'radial-gradient(circle at center, black 70%, transparent 100%)',
        ...style,
      }}
      onClick={(e) => {
        engineRef.current?.replay()
        onClick?.(e)
      }}
      {...props}
    >
      {fallback && (
        <ShinpoLogo
          size={Math.round(size * 0.32)}
          variant="icon"
          className="shinpo-glass-fallback-logo"
        />
      )}
    </div>
  )
}

export default GlassLogoReveal
