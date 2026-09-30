import React, { useEffect, useRef, useState } from 'react'

export interface CustomCursorProps {
  /** Target dot size in pixels */
  dotSize?: number
  /** Ring resting size in pixels */
  ringSize?: number
  /** Color token or hex code */
  color?: string
  /** Whether to show a text badge when hovering targets with data-cursor-text */
  enableTextMorph?: boolean
}

/**
 * CustomCursor
 * 
 * Interactive, high-performance cursor component engineered with smooth 
 * spring-lag trailing physics, target morphing, and native SHINPO design tokens.
 * 
 * Automatically disables on touch devices and respects prefers-reduced-motion.
 */
export const CustomCursor: React.FC<CustomCursorProps> = ({
  dotSize = 8,
  ringSize = 36,
  color = 'var(--accent-green, #35E36F)',
  enableTextMorph = true,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isClicking, setIsClicking] = useState(false)
  const [cursorText, setCursorText] = useState<string | null>(null)
  const [targetRect, setTargetRect] = useState<{ width: number; height: number; radius: number } | null>(null)

  // Real mouse coordinates
  const mousePos = useRef({ x: -100, y: -100 })
  // Smoothly interpolated ring coordinates
  const ringPos = useRef({ x: -100, y: -100 })
  
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const animFrameId = useRef<number | null>(null)

  useEffect(() => {
    // Check for touch device or reduced motion preference
    if (typeof window === 'undefined') return
    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (isTouch || prefersReducedMotion) return

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      if (!isVisible) setIsVisible(true)

      // Direct dot positioning for instantaneous responsiveness
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`
      }

      // Target element inspection for morphing
      const target = (e.target as HTMLElement | null)?.closest?.(
        'button, a, input, [role="button"], .sidebar-btn, .ai-preset-btn, .btn-action, .interactive-card, [data-cursor-target]'
      ) as HTMLElement | null

      if (target) {
        setIsHovered(true)
        const customText = target.getAttribute('data-cursor-text')
        setCursorText(enableTextMorph && customText ? customText : null)

        // If target wants rectangular boundary morphing
        if (target.hasAttribute('data-cursor-morph')) {
          const rect = target.getBoundingClientRect()
          setTargetRect({
            width: rect.width + 12,
            height: rect.height + 12,
            radius: parseInt(window.getComputedStyle(target).borderRadius || '8', 10),
          })
        } else {
          setTargetRect(null)
        }
      } else {
        setIsHovered(false)
        setCursorText(null)
        setTargetRect(null)
      }
    }

    const handleMouseDown = () => setIsClicking(true)
    const handleMouseUp = () => setIsClicking(false)
    const handleMouseLeave = () => setIsVisible(false)
    const handleMouseEnter = () => setIsVisible(true)

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    // Smooth physics loop for the trailing ring (LERP animation)
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor

    const render = () => {
      const smoothing = isHovered ? 0.24 : 0.16
      ringPos.current.x = lerp(ringPos.current.x, mousePos.current.x, smoothing)
      ringPos.current.y = lerp(ringPos.current.y, mousePos.current.y, smoothing)

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`
      }

      animFrameId.current = requestAnimationFrame(render)
    }

    animFrameId.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current)
    }
  }, [isVisible, isHovered, enableTextMorph])

  // Don't render if invisible or not mounted
  if (!isVisible) return null

  const ringWidth = targetRect ? targetRect.width : isHovered ? ringSize * 1.4 : ringSize
  const ringHeight = targetRect ? targetRect.height : isHovered ? ringSize * 1.4 : ringSize
  const borderRadius = targetRect ? `${targetRect.radius}px` : '50%'

  return (
    <div
      className="shinpo-custom-cursor-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999999,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* 1. Precision Inner Dot */}
      <div
        ref={dotRef}
        className="shinpo-cursor-dot"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          backgroundColor: color,
          borderRadius: '50%',
          boxShadow: `0 0 10px ${color}`,
          transform: `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0) scale(${isClicking ? 0.7 : isHovered ? 0 : 1})`,
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease',
          opacity: isHovered && cursorText ? 0 : 1,
          pointerEvents: 'none',
          willChange: 'transform',
        }}
      />

      {/* 2. Fluid Target-Morphing Outer Ring */}
      <div
        ref={ringRef}
        className={`shinpo-cursor-ring ${isHovered ? 'hovered' : ''} ${isClicking ? 'clicking' : ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: ringWidth,
          height: ringHeight,
          marginLeft: -ringWidth / 2,
          marginTop: -ringHeight / 2,
          borderRadius: borderRadius,
          border: isHovered ? `1.5px solid ${color}` : `1.2px solid ${color}`,
          backgroundColor: isHovered ? 'rgba(53, 227, 111, 0.08)' : 'rgba(53, 227, 111, 0.02)',
          boxShadow: isHovered
            ? `0 0 20px rgba(53, 227, 111, 0.25), inset 0 0 10px rgba(53, 227, 111, 0.1)`
            : '0 0 8px rgba(53, 227, 111, 0.12)',
          backdropFilter: isHovered ? 'blur(1px)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), height 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-radius 0.22s ease, background-color 0.2s ease, box-shadow 0.2s ease',
          pointerEvents: 'none',
          willChange: 'transform, width, height',
        }}
      >
        {/* Optional Contextual Micro-Badge inside Ring */}
        {cursorText && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: color,
              textTransform: 'uppercase',
              pointerEvents: 'none',
              animation: 'shinpoCursorFadeIn 0.15s ease',
            }}
          >
            {cursorText}
          </span>
        )}
      </div>

      <style>{`
        @keyframes shinpoCursorFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (pointer: coarse) {
          .shinpo-custom-cursor-container {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
export default CustomCursor
