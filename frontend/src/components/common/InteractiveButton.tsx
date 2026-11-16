import React, { forwardRef, useRef } from 'react'
import {
  calculateButtonInteractionMetrics,
} from '../../utils/interactiveButtonPhysics'

export type InteractiveButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'icon'
  | 'compact'
  | 'navigation'
  | 'floating'

export type InteractiveButtonSize = 'sm' | 'md' | 'lg'

export interface InteractiveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: InteractiveButtonVariant
  size?: InteractiveButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const InteractiveButton = forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className = '',
      type = 'button',
      onPointerMove,
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      onKeyDown,
      ...restProps
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLButtonElement | null>(null)

    const setRef = (node: HTMLButtonElement | null) => {
      internalRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        ;(forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
      }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return
      const btn = e.currentTarget
      const rect = btn.getBoundingClientRect()
      if (rect.width <= 0) return

      const { mouseX, mouseY, normX, edgeProximity, edgePercent } =
        calculateButtonInteractionMetrics(e.clientX, e.clientY, rect)

      btn.style.setProperty('--btn-x', `${mouseX}px`)
      btn.style.setProperty('--btn-y', `${mouseY}px`)
      btn.style.setProperty('--btn-norm-x', normX.toFixed(3))
      btn.style.setProperty('--btn-edge-proximity', edgeProximity.toFixed(3))
      btn.style.setProperty('--btn-edge-side', `${edgePercent}%`)
      btn.style.setProperty('--btn-hover', '1')

      onPointerMove?.(e)
    }

    const handlePointerEnter = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return
      e.currentTarget.style.setProperty('--btn-hover', '1')
      onPointerEnter?.(e)
    }

    const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
      const btn = e.currentTarget
      btn.style.setProperty('--btn-hover', '0')
      btn.style.setProperty('--btn-pressed', '0')
      onPointerLeave?.(e)
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || isLoading) return
      if (e.button === 0) {
        e.currentTarget.style.setProperty('--btn-pressed', '1')
      }
      onPointerDown?.(e)
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      const btn = e.currentTarget
      btn.style.setProperty('--btn-pressed', '0')
      if (!disabled && !isLoading) {
        btn.classList.add('is-activating')
        setTimeout(() => {
          btn.classList.remove('is-activating')
        }, 280)
      }
      onPointerUp?.(e)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!disabled && !isLoading && (e.key === 'Enter' || e.key === ' ')) {
        const btn = e.currentTarget
        btn.classList.add('is-activating')
        setTimeout(() => {
          btn.classList.remove('is-activating')
        }, 280)
      }
      onKeyDown?.(e)
    }

    const classNames = [
      'shinpo-interactive-btn',
      `variant-${variant}`,
      `size-${size}`,
      isLoading ? 'is-loading' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={setRef}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading ? 'true' : undefined}
        data-interactive-btn="true"
        data-interactive-variant={variant}
        className={classNames}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        {...restProps}
      >
        {isLoading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ animation: 'spin 1s linear infinite' }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            <span>{children}</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="btn-icon left-icon">{leftIcon}</span>}
            {children !== undefined && children !== null && <span>{children}</span>}
            {rightIcon && <span className="btn-icon right-icon">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

InteractiveButton.displayName = 'InteractiveButton'
