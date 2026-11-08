import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  type SilkThemeKey,
  SILK_THEME_PALETTES,
  hexToRgb,
  backing,
  toShader,
} from './silkShaderMath.ts'

const VERT = `attribute vec2 p;
void main() {
  gl_Position = vec4(p, 0.0, 1.0);
}`

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform float uIntro;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uMesh;
uniform float uRings;
uniform vec2 uClick;
uniform float uClickAge;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float silk(vec2 p, float t) {
  vec2 w = p * 2.1;
  for (int i = 1; i < 7; i++) {
    float fi = float(i);
    w += vec2(
      0.62 / fi * sin(fi * w.y * 0.85 + t * 0.32 + fi * 1.7),
      0.50 / fi * cos(fi * w.x * 0.75 - t * 0.26 + fi * 0.9)
    );
  }
  return 0.5 + 0.5 * sin(w.x * 1.9 + w.y * 1.2);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;

  // The cloth leans away from the pointer
  vec2 dm = p - uMouse;
  float md = dot(dm, dm);
  p += dm * 0.22 * exp(-md * 7.0) * uHover;

  // A click ripple travels outwards and fades
  vec2 dc = p - uClick;
  float cd = length(dc);
  float wave = sin(cd * 26.0 - uClickAge * 9.0) * exp(-uClickAge * 1.1) * smoothstep(uClickAge * 0.75 + 0.05, uClickAge * 0.75 - 0.25, cd);
  p += normalize(dc + 1e-4) * wave * 0.018;

  float h0 = silk(p, t);
  vec2 e = vec2(0.004, 0.0);
  float hx = silk(p + e.xy, t) - h0;
  float hy = silk(p + e.yx, t) - h0;

  vec3 n = normalize(vec3(-hx / e.x * 0.26, -hy / e.x * 0.26, 1.0));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));

  float dif = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 16.0);

  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.85, h0));
  col = mix(col, uC2, smoothstep(0.35, 1.0, dif) * 0.85);
  col = mix(col, uC0, smoothstep(0.45, 0.0, dif) * 0.55);
  col += uC3 * spec * 0.8;

  vec2 r = vec2(hx, hy) * 40.0;
  // Mesh: a fine grid displaced by the same folds, strongest low in the frame
  vec2 g = (p + r * 0.02 + n.xy * 0.05) * vec2(15.0, 15.0);
  vec2 gd = abs(fract(g) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.05, min(gd.x, gd.y));
  col = mix(col, uC3, line * uMesh * (0.25 + 0.75 * smoothstep(0.8, 0.0, uv.y)) * (0.3 + 0.7 * dif));

  // Slow pulse rings off to one side
  vec2 rc = vec2(0.42 * uRes.x / uRes.y, -0.18);
  float rd = length(p - rc);
  float ring = 0.0;
  for (int k = 0; k < 3; k++) {
    float ph = fract(t * 0.12 + float(k) / 3.0);
    ring += smoothstep(0.004, 0.0, abs(rd - ph * 0.75)) * (1.0 - ph) * smoothstep(0.0, 0.08, ph);
  }
  col += uC3 * ring * 0.28 * uRings;
  col += uC3 * smoothstep(0.02, 0.0, abs(cd - uClickAge * 0.75)) * exp(-uClickAge * 1.6) * 0.25;

  // Vignette, micro-grain, and initial intro exposure ramp
  float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.1, 1.3)));
  col *= mix(0.55, 1.0, vig);
  col += (hash(gl_FragCoord.xy + fract(t) * 91.0) - 0.5) * 0.035;
  col *= uIntro;

  gl_FragColor = vec4(col, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('SilkLoginBackground shader compile error:', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

export interface SilkLoginBackgroundProps {
  isDarkMode?: boolean
  isAurora?: boolean
  speed?: number
  mesh?: number
  rings?: boolean
  className?: string
}

export function SilkLoginBackground({
  isDarkMode = true,
  isAurora = true,
  speed = 1.0,
  mesh = 0.14,
  rings = true,
  className = '',
}: SilkLoginBackgroundProps) {
  const root = useRef<HTMLDivElement | null>(null)
  const host = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  const themeKey: SilkThemeKey = isAurora
    ? isDarkMode ? 'aurora-dark' : 'aurora-light'
    : isDarkMode ? 'classic-dark' : 'classic-light'

  const paletteColors = SILK_THEME_PALETTES[themeKey] || SILK_THEME_PALETTES['aurora-dark']

  // Live uniform ref to allow instantaneous color and parameter updates without GL context teardown
  const live = useRef({ colors: paletteColors, speed, mesh, rings })
  useEffect(() => {
    live.current = { colors: paletteColors, speed, mesh, rings }
  }, [paletteColors, speed, mesh, rings])

  useEffect(() => {
    const el = root.current
    const holder = host.current
    if (!el || !holder) return

    const cv = document.createElement('canvas')
    cv.className = 'shinpo-silk-canvas'
    holder.appendChild(cv)

    let gl: WebGLRenderingContext | null = null
    let vs: WebGLShader | null = null
    let fs: WebGLShader | null = null
    let prog: WebGLProgram | null = null
    let buf: WebGLBuffer | null = null

    interface UniformMap {
      res: WebGLUniformLocation | null
      time: WebGLUniformLocation | null
      mouse: WebGLUniformLocation | null
      hover: WebGLUniformLocation | null
      intro: WebGLUniformLocation | null
      c0: WebGLUniformLocation | null
      c1: WebGLUniformLocation | null
      c2: WebGLUniformLocation | null
      c3: WebGLUniformLocation | null
      mesh: WebGLUniformLocation | null
      rings: WebGLUniformLocation | null
      click: WebGLUniformLocation | null
      clickAge: WebGLUniformLocation | null
    }

    let U: UniformMap = {
      res: null,
      time: null,
      mouse: null,
      hover: null,
      intro: null,
      c0: null,
      c1: null,
      c2: null,
      c3: null,
      mesh: null,
      rings: null,
      click: null,
      clickAge: null,
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const size = { w: 1, h: 1, left: 0, top: 0 }
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, thover: 0 }
    const click = { x: 9, y: 9, at: -100 }
    let raf = 0
    let running = false
    let onScreen = true
    let t = 0
    let last = performance.now()
    let intro = 0
    const start = performance.now()

    const teardownGL = () => {
      if (gl) {
        if (buf) { gl.deleteBuffer(buf); buf = null }
        if (prog) { gl.deleteProgram(prog); prog = null }
        if (vs) { gl.deleteShader(vs); vs = null }
        if (fs) { gl.deleteShader(fs); fs = null }
      }
    }

    const markFailed = () => {
      setTimeout(() => {
        setFailed(true)
        setReady(true)
      }, 0)
    }

    const setupGL = (): boolean => {
      teardownGL()
      gl = cv.getContext('webgl', {
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      })

      if (!gl) {
        markFailed()
        return false
      }

      vs = compileShader(gl, gl.VERTEX_SHADER, VERT)
      fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
      prog = gl.createProgram()

      if (!vs || !fs || !prog) {
        teardownGL()
        markFailed()
        return false
      }

      gl.attachShader(prog, vs)
      gl.attachShader(prog, fs)
      gl.linkProgram(prog)

      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn('SilkLoginBackground program link error:', gl.getProgramInfoLog(prog))
        teardownGL()
        markFailed()
        return false
      }

      gl.useProgram(prog)

      buf = gl.createBuffer()
      if (!buf) {
        teardownGL()
        markFailed()
        return false
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)

      const loc = gl.getAttribLocation(prog, 'p')
      if (loc === -1) {
        console.warn('SilkLoginBackground: attribute "p" location not found.')
        teardownGL()
        markFailed()
        return false
      }
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

      const u = (name: string) => gl?.getUniformLocation(prog!, name) ?? null
      U = {
        res: u('uRes'),
        time: u('uTime'),
        mouse: u('uMouse'),
        hover: u('uHover'),
        intro: u('uIntro'),
        c0: u('uC0'),
        c1: u('uC1'),
        c2: u('uC2'),
        c3: u('uC3'),
        mesh: u('uMesh'),
        rings: u('uRings'),
        click: u('uClick'),
        clickAge: u('uClickAge'),
      }

      setTimeout(() => {
        setFailed(false)
        setReady(true)
      }, 0)
      return true
    }

    const draw = (now: number) => {
      if (!gl) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const L = live.current
      if (!reduce.matches) t += dt * L.speed
      intro = reduce.matches ? 1 : Math.min(1, (now - start) / 1600)
      pointer.x += (pointer.tx - pointer.x) * 0.06
      pointer.y += (pointer.ty - pointer.y) * 0.06
      pointer.hover += (pointer.thover - pointer.hover) * 0.05
      const c = L.colors.map(hexToRgb)

      gl.uniform2f(U.res, cv.width, cv.height)
      gl.uniform1f(U.time, t + 11)
      gl.uniform2f(U.mouse, pointer.x, pointer.y)
      gl.uniform1f(U.hover, reduce.matches ? 0 : pointer.hover)
      gl.uniform1f(U.intro, 1 - Math.pow(1 - intro, 3))
      gl.uniform3f(U.c0, c[0][0], c[0][1], c[0][2])
      gl.uniform3f(U.c1, c[1][0], c[1][1], c[1][2])
      gl.uniform3f(U.c2, c[2][0], c[2][1], c[2][2])
      gl.uniform3f(U.c3, c[3][0], c[3][1], c[3][2])
      gl.uniform1f(U.mesh, L.mesh)
      gl.uniform1f(U.rings, L.rings && !reduce.matches ? 1 : 0)
      gl.uniform2f(U.click, click.x, click.y)
      gl.uniform1f(U.clickAge, (now - click.at) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const loop = (now: number) => {
      draw(now)
      raf = running ? requestAnimationFrame(loop) : 0
    }

    const sync = () => {
      const want = onScreen && !document.hidden && !reduce.matches
      if (want && !running) {
        running = true
        last = performance.now()
        raf = requestAnimationFrame(loop)
      } else if (!want && running) {
        running = false
        cancelAnimationFrame(raf)
        draw(performance.now())
      }
    }

    const measure = () => {
      const r = cv.getBoundingClientRect()
      size.w = r.width
      size.h = r.height
      size.left = r.left
      size.top = r.top
      const newWidth = backing(r.width, window.devicePixelRatio)
      const newHeight = backing(r.height, window.devicePixelRatio)
      if (cv.width !== newWidth || cv.height !== newHeight) {
        cv.width = newWidth
        cv.height = newHeight
      }
      if (gl) {
        gl.viewport(0, 0, cv.width, cv.height)
        if (!running) draw(performance.now())
      }
    }

    // Passive pointer tracking on window so form elements remain 100% interactive
    const onPointerMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        size.left = r.left
        size.top = r.top
        size.w = r.width
        size.h = r.height
        const [x, y] = toShader(e.clientX - size.left, e.clientY - size.top, size.w, size.h)
        pointer.tx = x
        pointer.ty = y
        pointer.thover = 1
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) {
        const [x, y] = toShader(e.clientX - r.left, e.clientY - r.top, r.width, r.height)
        click.x = x
        click.y = y
        click.at = performance.now()
      }
    }

    const onPointerLeave = () => {
      pointer.thover = 0
    }

    const ro = new ResizeObserver(measure)
    ro.observe(cv)

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      sync()
    })
    io.observe(el)

    const handleContextLost = (e: Event) => {
      e.preventDefault()
      running = false
      cancelAnimationFrame(raf)
      teardownGL()
      setFailed(true)
    }

    const handleContextRestored = () => {
      if (setupGL()) {
        measure()
        sync()
      }
    }

    document.addEventListener('visibilitychange', sync)
    reduce.addEventListener('change', sync)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerleave', onPointerLeave, { passive: true })
    cv.addEventListener('webglcontextlost', handleContextLost)
    cv.addEventListener('webglcontextrestored', handleContextRestored)

    if (setupGL()) {
      measure()
      sync()
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      reduce.removeEventListener('change', sync)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerleave', onPointerLeave)
      cv.removeEventListener('webglcontextlost', handleContextLost)
      cv.removeEventListener('webglcontextrestored', handleContextRestored)
      teardownGL()
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      cv.remove()
    }
  }, [])

  return (
    <div
      ref={root}
      className={`shinpo-silk-container ${ready ? 'silk-ready' : ''} ${className}`}
      style={{
        '--silk-c0': paletteColors[0],
        '--silk-c1': paletteColors[1],
        '--silk-c2': paletteColors[2],
        '--silk-c3': paletteColors[3],
      } as CSSProperties}
      aria-hidden="true"
    >
      {failed ? <div className="shinpo-silk-fallback" aria-hidden="true" /> : null}
      <div ref={host} className="shinpo-silk-host" aria-hidden="true" />
      <div className="shinpo-silk-vignette" aria-hidden="true" />
    </div>
  )
}
