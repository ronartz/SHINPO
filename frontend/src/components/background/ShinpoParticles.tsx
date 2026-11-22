import { useEffect, useRef } from 'react'

interface Particle {
  angle: number
  radius: number
  y: number
  size: number
  angularSpeed: number
  driftSpeed: number
  baseOpacity: number
  opacityPhase: number
  colorIndex: number
  screenX: number
  screenY: number
  scale: number
}

const DESKTOP_QUANTITY = 120
const MOBILE_QUANTITY = 55
const MAX_DPR = 1.5
const TAU = Math.PI * 2
const COLOR_TOKENS = ['--particle-color', '--particle-color-secondary', '--color-primary']

function resolveThemePalette(shell: HTMLElement): string[] {
  const isLight =
    shell.classList.contains('theme-light') ||
    document.documentElement.getAttribute('data-theme') === 'light'
  const isAurora =
    shell.classList.contains('theme-aurora') ||
    document.documentElement.getAttribute('data-brand') === 'aurora' ||
    document.documentElement.classList.contains('theme-aurora')

  const fallbacks: string[] = isAurora
    ? isLight
      ? ['rgba(15, 118, 110, 0.75)', 'rgba(124, 58, 237, 0.65)', '#7C3AED']
      : ['rgba(168, 85, 247, 0.85)', 'rgba(56, 189, 248, 0.75)', '#c084fc', '#38bdf8']
    : isLight
      ? ['rgba(79, 70, 229, 0.7)', 'rgba(77, 124, 15, 0.6)', '#4D7C0F']
      : ['rgba(163, 230, 53, 0.8)', 'rgba(56, 189, 248, 0.7)', '#AFF33E', '#a855f7']

  try {
    const probe = document.createElement('span')
    probe.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;visibility:hidden;pointer-events:none;width:0;height:0;'
    shell.appendChild(probe)
    const resolved = COLOR_TOKENS.map((token, index) => {
      probe.style.color = `var(${token})`
      const computed = window.getComputedStyle(probe).color
      if (computed && computed !== '' && computed !== 'rgba(0, 0, 0, 0)') {
        return computed
      }
      return fallbacks[index]
    })
    shell.removeChild(probe)
    return resolved
  } catch {
    return fallbacks
  }
}

export function ShinpoParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const shell = canvas?.parentElement
    const context = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !shell || !context) return

    let width = Math.max(1, window.innerWidth)
    let height = Math.max(1, window.innerHeight)
    let particles: Particle[] = []
    let palette = ['#9757FA', '#4D77F9', '#1BC9DE']
    let frame: number | null = null
    let lastFrame = 0
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fov = 450
    const depthRange = 180

    const isMotionAllowed = () => {
      return typeof document !== 'undefined' && document.body.classList.contains('allow-animations')
    }

    const refreshPalette = () => {
      palette = resolveThemePalette(shell)
      if (!isMotionAllowed() && motion.matches) drawStatic()
    }

    const spawn = (): Particle => {
      const spread = Math.hypot(width, height) * 0.75
      const angle = Math.random() * TAU
      return {
        angle,
        radius: Math.random() * spread,
        y: (Math.random() - 0.5) * height * 1.8,
        size: 3.2 + Math.random() * 4.0,
        angularSpeed: (Math.random() - 0.5) * 0.022,
        driftSpeed: 2.2 + Math.random() * 2.2,
        baseOpacity: 0.90 + Math.random() * 0.10,
        opacityPhase: Math.random() * TAU,
        colorIndex: Math.floor(Math.random() * palette.length),
        screenX: 0,
        screenY: 0,
        scale: 1,
      }
    }

    const project = (particle: Particle, advance: boolean) => {
      if (advance) {
        particle.angle += particle.angularSpeed
        particle.y -= particle.driftSpeed
        particle.opacityPhase += 0.06
        if (particle.screenY < -30 || particle.y < -height * 0.9) {
          particle.y = height * 0.9
          particle.radius = Math.random() * Math.hypot(width, height) * 0.75
        }
      }
      const z = Math.sin(particle.angle) * depthRange
      const scale = fov / Math.max(1, fov + z)
      particle.screenX = width / 2 + Math.cos(particle.angle) * particle.radius * scale
      particle.screenY = height / 2 + particle.y * scale
      particle.scale = scale
    }

    const paint = (advance: boolean) => {
      context.clearRect(0, 0, width, height)
      for (const particle of particles) project(particle, advance)
      if (advance) particles.sort((a, b) => a.scale - b.scale)
      for (const particle of particles) {
        const renderRadius = Math.max(2.8, particle.size * particle.scale)
        const pulse = Math.sin(particle.opacityPhase) * 0.15
        const renderAlpha = Math.min(1.0, Math.max(0.70, (particle.baseOpacity + pulse) * particle.scale))
        context.globalAlpha = renderAlpha
        context.shadowBlur = Math.min(22, 12 * particle.scale)
        context.shadowColor = palette[particle.colorIndex]
        context.fillStyle = palette[particle.colorIndex]
        context.beginPath()
        context.arc(particle.screenX, particle.screenY, renderRadius, 0, TAU)
        context.fill()
      }
      context.shadowBlur = 0
      context.globalAlpha = 1
    }

    function drawStatic() {
      if (!canvas || document.hidden) return
      paint(false)
    }

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      lastFrame = 0
    }

    const tick = (now: number) => {
      frame = null
      if (document.hidden || (!isMotionAllowed() && motion.matches)) return
      if (now - lastFrame >= 1000 / 50) {
        paint(true)
        lastFrame = now
      }
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (document.hidden || (!isMotionAllowed() && motion.matches) || frame !== null) return
      frame = requestAnimationFrame(tick)
    }

    const resize = () => {
      const nextWidth = Math.max(1, window.innerWidth)
      const nextHeight = Math.max(1, window.innerHeight)
      const resized = nextWidth !== width || nextHeight !== height
      width = nextWidth
      height = nextHeight
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (resized || particles.length === 0) {
        const count = window.innerWidth < 768 ? MOBILE_QUANTITY : DESKTOP_QUANTITY
        particles = Array.from({ length: count }, spawn)
      }
      if (!isMotionAllowed() && motion.matches) drawStatic()
      else start()
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else if (!isMotionAllowed() && motion.matches) drawStatic()
      else start()
    }

    const onMotionChange = () => {
      stop()
      if (!isMotionAllowed() && motion.matches) drawStatic()
      else start()
    }

    const resizeObserver = new ResizeObserver(resize)
    const themeObserver = new MutationObserver(refreshPalette)
    resizeObserver.observe(shell)
    resizeObserver.observe(document.documentElement)
    themeObserver.observe(shell, { attributes: true, attributeFilter: ['class', 'style'] })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-brand'] })
    document.addEventListener('visibilitychange', onVisibilityChange)
    motion.addEventListener('change', onMotionChange)
    window.addEventListener('resize', resize)

    refreshPalette()
    resize()

    return () => {
      stop()
      resizeObserver.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      motion.removeEventListener('change', onMotionChange)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="shinpo-particles" data-testid="shinpo-particles" aria-hidden="true" />
}
