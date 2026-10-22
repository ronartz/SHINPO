import { useState, useEffect, useCallback, useLayoutEffect } from 'react'

export interface FloatingPositionOptions {
  triggerRef: React.RefObject<HTMLElement | null>
  popoverRef: React.RefObject<HTMLElement | null>
  isOpen: boolean
  offset?: number
  padding?: number
  matchTriggerWidth?: boolean
  minWidth?: number
}

export interface FloatingPositionResult {
  style: React.CSSProperties
  placement: 'bottom' | 'top' | 'left' | 'right'
  isInsideDialog: boolean
  recalculate: () => void
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function useFloatingPosition({
  triggerRef,
  popoverRef,
  isOpen,
  offset = 6,
  padding = 10,
  matchTriggerWidth = false,
  minWidth,
}: FloatingPositionOptions): FloatingPositionResult {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
  })
  const [placement, setPlacement] = useState<'bottom' | 'top' | 'left' | 'right'>('bottom')
  const [isInsideDialog, setIsInsideDialog] = useState(false)

  const calculatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger || !isOpen) return

    const triggerRect = trigger.getBoundingClientRect()
    const popover = popoverRef.current

    // Detect if inside an active dialog/modal
    const inDialog = Boolean(
      trigger.closest('.shinpo-dialog-overlay, .modal-overlay, [role="dialog"], .quick-modal-overlay')
    )
    setIsInsideDialog(inDialog)

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const spaceBelow = viewportHeight - triggerRect.bottom - offset - padding
    const spaceAbove = triggerRect.top - offset - padding
    const spaceRight = viewportWidth - triggerRect.right - offset - padding
    const spaceLeft = triggerRect.left - offset - padding

    const popoverHeight = popover ? popover.offsetHeight : 240
    const popoverWidth = matchTriggerWidth
      ? triggerRect.width
      : Math.max(minWidth || 0, popover ? popover.offsetWidth : triggerRect.width)

    // Flip logic: if insufficient space below and more space above, open upwards
    let nextPlacement: 'bottom' | 'top' | 'left' | 'right' = 'bottom'
    if (inDialog && spaceRight >= popoverWidth) {
      nextPlacement = 'right'
    } else if (inDialog && spaceLeft >= popoverWidth) {
      nextPlacement = 'left'
    } else if (inDialog && spaceAbove >= Math.min(popoverHeight, 200)) {
      nextPlacement = 'top'
    } else if (spaceBelow < Math.min(popoverHeight, 200) && spaceAbove > spaceBelow) {
      nextPlacement = 'top'
    }
    setPlacement(nextPlacement)

    // Vertical top coordinate
    let top: number
    let maxHeight: number
    let left = triggerRect.left

    if (nextPlacement === 'right' || nextPlacement === 'left') {
      top = Math.min(Math.max(padding, triggerRect.top), viewportHeight - padding - 100)
      maxHeight = Math.max(100, Math.min(320, viewportHeight - top - padding))
      left = nextPlacement === 'right'
        ? triggerRect.right + offset
        : triggerRect.left - popoverWidth - offset
    } else if (nextPlacement === 'bottom') {
      top = triggerRect.bottom + offset
      maxHeight = Math.max(100, Math.min(320, spaceBelow))
    } else {
      top = Math.max(padding, triggerRect.top - (popover ? popover.offsetHeight : 240) - offset)
      maxHeight = Math.max(100, Math.min(320, spaceAbove))
    }

    // Horizontal left coordinate with edge protection
    if (nextPlacement !== 'left' && left + popoverWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - popoverWidth - padding)
    }
    if (left < padding) {
      left = padding
    }

    const calculatedZIndex = inDialog ? 9500 : 1000

    setStyle({
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: matchTriggerWidth ? `${Math.round(triggerRect.width)}px` : undefined,
      minWidth: minWidth ? `${minWidth}px` : undefined,
      maxHeight: `${Math.round(maxHeight)}px`,
      zIndex: calculatedZIndex,
      visibility: 'visible',
    })
  }, [triggerRef, popoverRef, isOpen, offset, padding, matchTriggerWidth, minWidth])

  useIsomorphicLayoutEffect(() => {
    if (isOpen) {
      calculatePosition()
    }
  }, [isOpen, calculatePosition])

  useEffect(() => {
    if (!isOpen) return

    const handleScrollOrResize = () => {
      calculatePosition()
    }

    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true })

    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true })
    }
  }, [isOpen, calculatePosition])

  return {
    style,
    placement,
    isInsideDialog,
    recalculate: calculatePosition,
  }
}
