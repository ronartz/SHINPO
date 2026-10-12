import React, { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface ConfirmationDialogProps {
  isOpen: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  isLoading?: boolean
  errorMessage?: string | null
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  // Focus restoration & trapping
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement
      // Focus cancel button by default for safety on destructive actions
      const timer = setTimeout(() => {
        if (isDestructive && cancelBtnRef.current) {
          cancelBtnRef.current.focus()
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.()
      previousActiveElementRef.current = null
    }
  }, [isOpen, isDestructive])

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        e.stopPropagation()
        onCancel()
      } else if (e.key === 'Tab') {
        // Simple focus trap between cancel and confirm
        const focusable = [cancelBtnRef.current, confirmBtnRef.current].filter(Boolean) as HTMLElement[]
        if (focusable.length < 2) return

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
    [isLoading, onCancel]
  )

  if (!isOpen) return null

  const content = (
    <div
      className="confirmation-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel()
        }
      }}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="confirmation-dialog-card"
        style={{
          backgroundColor: 'var(--surface-card, #181B24)',
          border: '1px solid var(--border-strong, rgba(255, 255, 255, 0.14))',
          borderRadius: 18,
          padding: 24,
          width: '100%',
          maxWidth: 'min(440px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2
            id="confirm-dialog-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text, #F3F4F6)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
          <div
            id="confirm-dialog-desc"
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--text-2, #8E95A5)',
              wordBreak: 'break-word',
            }}
          >
            {message}
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              fontSize: 12.5,
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 4,
            flexWrap: 'wrap',
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            className="quick-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              minWidth: 80,
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="quick-btn-submit"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              minWidth: 90,
              background: isDestructive
                ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                : undefined,
              borderColor: isDestructive ? '#EF4444' : undefined,
              boxShadow: isDestructive
                ? '0 4px 14px rgba(239, 68, 68, 0.35)'
                : undefined,
            }}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

