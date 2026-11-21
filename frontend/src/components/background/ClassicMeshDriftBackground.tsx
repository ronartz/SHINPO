import { useEffect, useRef } from 'react'
import fragmentShaderSource from './meshDrift.frag?raw'
import { classicMeshUniformColours } from './classicMeshPalette'

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

/**
 * Plain WebGL1 fullscreen triangle. All recipe settings are packed into the
 * exact 21st.dev fragment shader uniforms; only Classic colours vary by theme.
 */
export function ClassicMeshDriftBackground({ isDarkMode }: { isDarkMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const darkModeRef = useRef(isDarkMode)
  const applyPaletteRef = useRef<((dark: boolean) => void) | null>(null)
  darkModeRef.current = isDarkMode

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = canvas?.parentElement
    if (!canvas || !shell) return

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    })
    if (!gl) return // CSS background remains visible on unsupported GPUs.

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let program: WebGLProgram | null = null
    let triangle: WebGLBuffer | null = null
    let sceneLocation: WebGLUniformLocation | null = null
    let coloursLocation: WebGLUniformLocation | null = null
    let frame: number | null = null
    let lastFrame = 0
    let lastPaint = 0
    let elapsedSeconds = 0
    let contextLost = false
    let disposed = false

    const stop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = null
      lastFrame = 0
    }

    const applyPalette = (dark: boolean) => {
      if (!program || contextLost) return
      gl.useProgram(program)
      gl.uniform3fv(
        coloursLocation,
        classicMeshUniformColours(dark ? 'dark' : 'light', window.getComputedStyle(shell)),
      )
      if (motion.matches && !document.hidden) draw()
    }
    applyPaletteRef.current = applyPalette

    const draw = () => {
      if (contextLost || !program || canvas.width < 1 || canvas.height < 1) return
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.useProgram(program)
      gl.uniform4f(sceneLocation, canvas.width, canvas.height, elapsedSeconds * 0.73, 4.0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const tick = (now: number) => {
      frame = null
      if (document.hidden || motion.matches || contextLost) return
      if (lastFrame > 0) elapsedSeconds += Math.min((now - lastFrame) / 1000, 0.1)
      lastFrame = now
      // Ambient background: cap frame rate without altering the supplied speed.
      if (now - lastPaint >= 1000 / 45) {
        draw()
        lastPaint = now
      }
      frame = window.requestAnimationFrame(tick)
    }

    const start = () => {
      if (disposed || document.hidden || contextLost || !program) return
      if (motion.matches) {
        stop()
        draw()
      } else if (frame === null) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      if (contextLost) return
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        draw()
      }
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Could not create WebGL shader')
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader) || 'Shader compilation failed'
        gl.deleteShader(shader)
        throw new Error(reason)
      }
      return shader
    }

    const initialize = () => {
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER)
      let fragment: WebGLShader
      try {
        fragment = compile(gl.FRAGMENT_SHADER, fragmentShaderSource)
      } catch (error) {
        gl.deleteShader(vertex)
        throw error
      }
      const nextProgram = gl.createProgram()
      if (!nextProgram) {
        gl.deleteShader(vertex)
        gl.deleteShader(fragment)
        throw new Error('Could not create WebGL program')
      }
      gl.attachShader(nextProgram, vertex)
      gl.attachShader(nextProgram, fragment)
      gl.linkProgram(nextProgram)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        const reason = gl.getProgramInfoLog(nextProgram) || 'WebGL program linking failed'
        gl.deleteProgram(nextProgram)
        throw new Error(reason)
      }
      const buffer = gl.createBuffer()
      if (!buffer) {
        gl.deleteProgram(nextProgram)
        throw new Error('Could not create fullscreen triangle buffer')
      }
      program = nextProgram
      triangle = buffer
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, triangle)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(program, 'a_position')
      if (position < 0) throw new Error('Fullscreen triangle attribute unavailable')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

      coloursLocation = gl.getUniformLocation(program, 'u_colors[0]')
      sceneLocation = gl.getUniformLocation(program, 'u_scene')
      const packed = (name: string, x: number, y: number, z: number, w: number) => {
        gl.uniform4f(gl.getUniformLocation(program!, name), x, y, z, w)
      }
      packed('u_shape', 1.10, 0.34, 0.50, 0.00)
      packed('u_surface', 2.40, 0.96, -0.10, 0.96)
      packed('u_finish', 0.00, 0.36, 0.026, 0.07)
      packed('u_transform', 1453.0, 0.00, 0.00, 0.0)
      // Cursor is disabled; no pointer or mouse listeners are installed.
      packed('u_space', 0.00, 0.00, 0.00, 0.00)
      packed('u_cursor', 0.00, 2.0, 0.65, 0.46)
      applyPalette(darkModeRef.current)
      resize()
      draw()
      start()
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    const onMotion = () => {
      stop()
      start()
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      stop()
    }
    const onContextRestored = () => {
      contextLost = false
      program = null
      triangle = null
      try {
        initialize()
      } catch (error) {
        console.warn('SHINPO Classic mesh WebGL recovery unavailable:', error)
      }
    }

    const observer = new ResizeObserver(resize)
    observer.observe(shell)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    motion.addEventListener('change', onMotion)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)

    try {
      initialize()
    } catch (error) {
      // Do not break application rendering when the GPU cannot compile WebGL.
      console.warn('SHINPO Classic mesh WebGL unavailable:', error)
    }

    return () => {
      disposed = true
      stop()
      applyPaletteRef.current = null
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      motion.removeEventListener('change', onMotion)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      if (!contextLost) {
        if (triangle) gl.deleteBuffer(triangle)
        if (program) gl.deleteProgram(program)
      }
    }
  }, [])

  useEffect(() => {
    applyPaletteRef.current?.(isDarkMode)
  }, [isDarkMode])

  return <canvas ref={canvasRef} className="classic-mesh-drift" aria-hidden="true" data-testid="classic-mesh-drift" />
}
