import React, { useState, useRef } from 'react'
import { ShinpoPopover } from '../Popover/ShinpoPopover'

export interface ShinpoTooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  className?: string
  offset?: number
}

export const ShinpoTooltip: React.FC<ShinpoTooltipProps> = ({
  content,
  children,
  className = '',
  offset = 6,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setIsOpen(true), 120)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(false)
  }

  return (
    <>
      {React.cloneElement(children, {
        ref: triggerRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        onFocus: handleMouseEnter,
        onBlur: handleMouseLeave,
      } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> })}

      <ShinpoPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerRef}
        offset={offset}
        closeOnOutsideClick={false}
        role="tooltip"
        className={`shinpo-tooltip-surface ${className}`}
      >
        <div
          style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text, #F3F4F6)',
            backgroundColor: 'var(--surface-elevated, #24252D)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            maxWidth: 240,
            lineHeight: 1.4,
          }}
        >
          {content}
        </div>
      </ShinpoPopover>
    </>
  )
}
