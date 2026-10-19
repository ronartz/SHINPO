import React, { useRef, useEffect, useCallback } from 'react'
import { Portal } from './Portal'
import { useFloatingPosition } from './useFloatingPosition'

export interface ShinpoPopoverProps {
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLElement | null>
  children: React.ReactNode
  className?: string
  matchTriggerWidth?: boolean
  minWidth?: number
  offset?: number
  padding?: number
  closeOnEscape?: boolean
  closeOnOutsideClick?: boolean
  ariaLabel?: string
  role?: string
}

export const ShinpoPopover: React.FC<ShinpoPopoverProps> = ({
  isOpen,
  onClose,
  triggerRef,
  children,
  className = '',
  matchTriggerWidth = false,
  minWidth,
  offset = 6,
  padding = 10,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  ariaLabel,
  role = 'region',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  const { style, placement } = useFloatingPosition({
    triggerRef,
    popoverRef,
    isOpen,
    offset,
    padding,
    matchTriggerWidth,
    minWidth,
  })

  // Dismiss on outside click (mousedown & touchstart)
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen, closeOnOutsideClick, triggerRef, onClose])

  // Dismiss on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose()
      }
    },
    [closeOnEscape, onClose]
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <Portal>
      <div
        ref={popoverRef}
        role={role}
        aria-label={ariaLabel}
        data-placement={placement}
        className={`shinpo-popover-surface ${className}`}
        style={style}
      >
        {children}
      </div>
    </Portal>
  )
}

