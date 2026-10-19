import React, { useEffect, useRef, useCallback, useId } from 'react'
import { Portal } from '../Popover/Portal'
import type { ShinpoDialogProps } from './types'

export const ShinpoDialog: React.FC<ShinpoDialogProps> & {
  Header: React.FC<{ children: React.ReactNode; className?: string }>
  Body: React.FC<{ children: React.ReactNode; className?: string }>
  Footer: React.FC<{ children: React.ReactNode; className?: string }>
} = ({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
  className = '',
  cardClassName = '',
  ariaLabelledBy,
  ariaDescribedBy,
  'data-tutorial': dataTutorial,
  'data-testid': dataTestId,
}) => {
  const generatedId = useId()
  const titleId = ariaLabelledBy || `shinpo-dialog-title-${generatedId}`
  const descId = ariaDescribedBy || `shinpo-dialog-desc-${generatedId}`

  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  // Focus restoration & body scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'

      // Focus first focusable element or dialog card
      const timer = setTimeout(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusable.length > 0) {
            focusable[0].focus()
          } else {
            dialogRef.current.focus()
          }
        }
      }, 50)

      return () => {
        clearTimeout(timer)
        document.body.style.overflow = originalOverflow
        if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus?.()
          previousActiveElementRef.current = null
        }
      }
    }
  }, [isOpen])

  // Focus trapping & Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null)

        if (focusable.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [closeOnEscape, onClose]
  )

  if (!isOpen) return null

  return (
    <Portal>
      <div
        className={`shinpo-dialog-overlay ${className}`}
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget && closeOnBackdropClick) {
            onClose()
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          data-tutorial={dataTutorial}
          data-testid={dataTestId}
          className={`shinpo-dialog-card size-${size} ${cardClassName}`}
        >
          {/* Default header if title is passed as prop */}
          {(title || showCloseButton) && (
            <div className="shinpo-dialog-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                {title && (
                  <h2 id={titleId} className="shinpo-dialog-title">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="shinpo-dialog-description">
                    {description}
                  </p>
                )}
              </div>

              {showCloseButton && (
                <button
                  type="button"
                  className="shinpo-dialog-close-btn"
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Children or explicit subcomponents */}
          {children}
        </div>
      </div>
    </Portal>
  )
}

ShinpoDialog.Header = ({ children, className = '' }) => (
  <div className={`shinpo-dialog-header ${className}`}>{children}</div>
)

ShinpoDialog.Body = ({ children, className = '' }) => (
  <div className={`shinpo-dialog-body ${className}`}>{children}</div>
)

ShinpoDialog.Footer = ({ children, className = '' }) => (
  <div className={`shinpo-dialog-footer ${className}`}>{children}</div>
)

