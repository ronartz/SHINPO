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

type FloatingGeometry = {
  trigger: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width'>
  popoverWidth: number
  popoverHeight: number
  viewportWidth: number
  viewportHeight: number
  offset: number
  padding: number
  matchTriggerWidth: boolean
  minWidth?: number
  inDialog: boolean
}

export function calculateFloatingGeometry({
  trigger,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  offset,
  padding,
  matchTriggerWidth,
  minWidth,
  inDialog,
}: FloatingGeometry): { style: React.CSSProperties; placement: 'bottom' | 'top' } {
  const availableWidth = Math.max(0, viewportWidth - padding * 2)
  const width = Math.min(availableWidth, matchTriggerWidth
    ? trigger.width
    : Math.max(minWidth ?? 0, popoverWidth))
  const spaceBelow = Math.max(0, viewportHeight - trigger.bottom - offset - padding)
  const spaceAbove = Math.max(0, trigger.top - offset - padding)
  const minimumUsefulHeight = Math.min(popoverHeight, 160)
  const placement = spaceBelow < minimumUsefulHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
  const availableHeight = Math.min(320, placement === 'bottom' ? spaceBelow : spaceAbove)
  const height = Math.min(popoverHeight, availableHeight)
  const top = placement === 'bottom'
    ? trigger.bottom + offset
    : trigger.top - height - offset
  const left = Math.max(padding, Math.min(trigger.left, viewportWidth - padding - width))

  return {
    placement,
    style: {
      position: 'fixed',
      top: `${Math.round(Math.max(padding, Math.min(top, viewportHeight - padding - height)))}px`,
      left: `${Math.round(left)}px`,
      width: matchTriggerWidth ? `${Math.round(width)}px` : undefined,
      minWidth: minWidth ? `${Math.min(minWidth, availableWidth)}px` : undefined,
      maxHeight: `${Math.round(availableHeight)}px`,
      zIndex: inDialog ? 9500 : 1000,
      visibility: 'visible',
    },
  }
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

    const popoverHeight = popover ? popover.offsetHeight : 240
    const popoverWidth = matchTriggerWidth
      ? triggerRect.width
      : Math.max(minWidth || 0, popover ? popover.offsetWidth : triggerRect.width)
    const geometry = calculateFloatingGeometry({
      trigger: triggerRect,
      popoverWidth,
      popoverHeight,
      viewportWidth,
      viewportHeight,
      offset,
      padding,
      matchTriggerWidth,
      minWidth,
      inDialog,
    })
    setPlacement(geometry.placement)
    setStyle(geometry.style)
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

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(handleScrollOrResize)
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current)
    if (popoverRef.current) resizeObserver?.observe(popoverRef.current)
    const frame = window.requestAnimationFrame(handleScrollOrResize)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
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
