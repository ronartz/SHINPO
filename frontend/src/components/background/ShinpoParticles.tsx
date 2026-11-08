import { useEffect, useRef } from 'react'

interface Particle {
  angle: number
  radius: number
  y: number
  size: number
  angularSpeed: number
  driftSpeed: number
  opacity: number
  colorIndex: number
  screenX: number
  screenY: number
  scale: number
}

const DESKTOP_QUANTITY = 200
const MOBILE_QUANTITY = 45
const MAX_DPR = 1.5
const TAU = Math.PI * 2
const COLOR_TOKENS = ['--color-primary', '--chart-2', '--chart-3']

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
      ? ['#6936DF', '#2563EB', '#0891B2']
      : ['#9757FA', '#4D77F9', '#1BC9DE']
    : isLight
      ? ['#4D7C0F', '#0284C7', '#15803D']
      : ['#AFF33E', '#38BDF8', '#22C55E']

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

    const refreshPalette = () => {
      palette = resolveThemePalette(shell)
      if (motion.matches) drawStatic()
    }

    const spawn = (): Particle => {
      const spread = Math.hypot(width, height) * 0.75
      const angle = Math.random() * TAU
      return {
        angle,
        radius: Math.random() * spread,
        y: (Math.random() - 0.5) * height * 1.8,
        size: 2.8 + Math.random() * 1.4,
        angularSpeed: (Math.random() - 0.5) * 0.0016,
        driftSpeed: 0.18 + Math.random() * 0.08,
        opacity: 0.35 + Math.random() * 0.20,
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
        const renderRadius = Math.max(1.2, particle.size * particle.scale)
        const renderAlpha = Math.min(0.85, Math.max(0.20, particle.opacity * (particle.scale * 0.85)))
        context.globalAlpha = renderAlpha
        context.fillStyle = palette[particle.colorIndex]
        context.beginPath()
        context.arc(particle.screenX, particle.screenY, renderRadius, 0, TAU)
        context.fill()
      }
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
      if (document.hidden || motion.matches) return
      if (now - lastFrame >= 1000 / 50) {
        paint(true)
        lastFrame = now
      }
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      if (document.hidden || motion.matches || frame !== null) return
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
      if (motion.matches) drawStatic()
      else start()
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else if (motion.matches) drawStatic()
      else start()
    }

    const onMotionChange = () => {
      stop()
      if (motion.matches) drawStatic()
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
