import { useEffect, useRef } from 'react'
import { createClassicMeshDriftConfig } from './classicMeshDriftConfig'
import { MESH_DRIFT_FRAGMENT_SHADER } from './meshDriftFragmentShader'

interface ClassicMeshDriftProps {
  enabled: boolean
  isDark: boolean
}

interface Uniforms {
  colors: WebGLUniformLocation | null
  scene: WebGLUniformLocation | null
  shape: WebGLUniformLocation | null
  surface: WebGLUniformLocation | null
  finish: WebGLUniformLocation | null
  transform: WebGLUniformLocation | null
  space: WebGLUniformLocation | null
  cursor: WebGLUniformLocation | null
}

interface Renderer {
  start: () => void
  stop: () => void
  resize: () => void
  drawStatic: () => void
  syncMotion: () => void
}

const MAX_DPR = 2
const FRAME_INTERVAL_MS = 1000 / 30
const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader allocation failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error'
    gl.deleteShader(shader)
    throw new Error(detail)
  }
  return shader
}

export function ClassicMeshDrift({ enabled, isDark }: ClassicMeshDriftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const optionsRef = useRef({ enabled, isDark })

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = canvas?.parentElement
    if (!canvas || !shell) return

    let gl: WebGLRenderingContext | null = null
    let program: WebGLProgram | null = null
    let vertices: WebGLBuffer | null = null
    let uniforms: Uniforms | null = null
    let initialized = false
    let contextLost = false
    let frame: number | null = null
    let elapsedSeconds = 0
    let lastFrameAt = 0
    let width = 0
    let height = 0
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const stop = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = null
      lastFrameAt = 0
    }

    const render = (seconds: number) => {
      if (!gl || !program || !uniforms || contextLost || !optionsRef.current.enabled) return
      gl.useProgram(program)
      const config = createClassicMeshDriftConfig(canvas.width, canvas.height, seconds, optionsRef.current.isDark)
      if (uniforms.colors) gl.uniform3fv(uniforms.colors, new Float32Array(config.colors))
      if (uniforms.scene) gl.uniform4fv(uniforms.scene, config.scene)
      if (uniforms.shape) gl.uniform4fv(uniforms.shape, config.shape)
      if (uniforms.surface) gl.uniform4fv(uniforms.surface, config.surface)
      if (uniforms.finish) gl.uniform4fv(uniforms.finish, config.finish)
      if (uniforms.transform) gl.uniform4fv(uniforms.transform, config.transform)
      if (uniforms.space) gl.uniform4fv(uniforms.space, config.space)
      if (uniforms.cursor) gl.uniform4fv(uniforms.cursor, config.cursor)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      canvas.dataset.ready = 'true'
    }

    const resize = () => {
      if (!gl || !initialized || contextLost) return
      const bounds = shell.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.round(bounds.width))
      const nextHeight = Math.max(1, Math.round(Math.max(bounds.height, window.innerHeight)))
      if (nextWidth === width && nextHeight === height) return
      width = nextWidth
      height = nextHeight
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      gl.viewport(0, 0, canvas.width, canvas.height)
      render(elapsedSeconds)
    }

    const isMotionAllowed = () => {
      return typeof document !== 'undefined' && document.body.classList.contains('allow-animations')
    }

    const drawStatic = () => {
      if (document.hidden || !optionsRef.current.enabled || !gl || contextLost) return
      resize()
      render(elapsedSeconds)
    }

    const tick = (now: number) => {
      frame = null
      if (document.hidden || (!isMotionAllowed() && motion.matches) || !optionsRef.current.enabled || contextLost) return
      if (lastFrameAt === 0) lastFrameAt = now
      if (now - lastFrameAt >= FRAME_INTERVAL_MS) {
        elapsedSeconds += (now - lastFrameAt) / 1000
        lastFrameAt = now
        render(elapsedSeconds)
      }
      frame = window.requestAnimationFrame(tick)
    }

    const start = () => {
      if (!optionsRef.current.enabled || document.hidden || (!isMotionAllowed() && motion.matches) || contextLost || frame !== null) return
      resize()
      lastFrameAt = 0
      frame = window.requestAnimationFrame(tick)
    }

    const initialize = () => {
      if (initialized || !optionsRef.current.enabled || contextLost) return
      let vertex: WebGLShader | null = null
      let fragment: WebGLShader | null = null
      try {
        gl = canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: 'low-power',
        })
        if (!gl) throw new Error('WebGL1 is unavailable')

        vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
        fragment = compileShader(gl, gl.FRAGMENT_SHADER, MESH_DRIFT_FRAGMENT_SHADER)
        program = gl.createProgram()
        if (!program) throw new Error('WebGL program allocation failed')
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.linkProgram(program)
        gl.deleteShader(vertex)
        gl.deleteShader(fragment)
        vertex = null
        fragment = null
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) ?? 'Unknown shader link error')
        }

        vertices = gl.createBuffer()
        if (!vertices) throw new Error('WebGL vertex buffer allocation failed')
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
        const position = gl.getAttribLocation(program, 'a_position')
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
        uniforms = {
          colors: gl.getUniformLocation(program, 'u_colors[0]'),
          scene: gl.getUniformLocation(program, 'u_scene'),
          shape: gl.getUniformLocation(program, 'u_shape'),
          surface: gl.getUniformLocation(program, 'u_surface'),
          finish: gl.getUniformLocation(program, 'u_finish'),
          transform: gl.getUniformLocation(program, 'u_transform'),
          space: gl.getUniformLocation(program, 'u_space'),
          cursor: gl.getUniformLocation(program, 'u_cursor'),
        }
        gl.disable(gl.BLEND)
        gl.disable(gl.DEPTH_TEST)
        initialized = true
        canvas.dataset.error = ''
        resize()
      } catch (error) {
        canvas.dataset.ready = 'false'
        canvas.dataset.error = error instanceof Error ? error.message : 'WebGL initialization failed'
        if (gl && vertex) gl.deleteShader(vertex)
        if (gl && fragment) gl.deleteShader(fragment)
        if (gl && vertices) gl.deleteBuffer(vertices)
        if (gl && program) gl.deleteProgram(program)
        gl = null
        program = null
        vertices = null
        uniforms = null
      }
    }

    const syncMotion = () => {
      stop()
      if (!optionsRef.current.enabled || document.hidden) return
      initialize()
      if (!isMotionAllowed() && motion.matches) drawStatic()
      else start()
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else syncMotion()
    }

    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      initialized = false
      stop()
      canvas.dataset.ready = 'false'
    }

    const onContextRestored = () => {
      contextLost = false
      initialized = false
      gl = null
      program = null
      vertices = null
      uniforms = null
      syncMotion()
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(shell)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('resize', resize)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    motion.addEventListener('change', syncMotion)

    const renderer: Renderer = { start, stop, resize, drawStatic, syncMotion }
    rendererRef.current = renderer
    if (optionsRef.current.enabled) syncMotion()

    return () => {
      stop()
      resizeObserver?.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      motion.removeEventListener('change', syncMotion)
      if (gl && vertices) gl.deleteBuffer(vertices)
      if (gl && program) gl.deleteProgram(program)
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    optionsRef.current = { enabled, isDark }
    const renderer = rendererRef.current
    if (!enabled) {
      renderer?.stop()
      return
    }
    renderer?.syncMotion()
  }, [enabled, isDark])

  return (
    <canvas
      ref={canvasRef}
      className="shinpo-mesh-drift"
      data-active={enabled ? 'true' : 'false'}
      data-ready="false"
      aria-hidden="true"
    />
  )
}
