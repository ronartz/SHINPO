import React, { useEffect, useRef } from 'react'
import { ShinpoDialog } from './ShinpoDialog'
import type { ShinpoConfirmDialogProps } from './types'

export const ShinpoConfirmDialog: React.FC<ShinpoConfirmDialogProps> = ({
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
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Safety focus on cancel button for destructive actions
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (isDestructive && cancelBtnRef.current) {
          cancelBtnRef.current.focus()
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus()
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen, isDestructive])

  return (
    <ShinpoDialog
      isOpen={isOpen}
      onClose={() => {
        if (!isLoading) onCancel()
      }}
      size="sm"
      closeOnBackdropClick={!isLoading}
      closeOnEscape={!isLoading}
      showCloseButton={!isLoading}
      title={title}
    >
      <ShinpoDialog.Body>
        <div style={{ fontSize: 13.5, color: 'var(--text-2, #B0B5C2)', lineHeight: 1.5 }}>
          {message}
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              color: 'var(--brand-red, #F87171)',
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            {errorMessage}
          </div>
        )}
      </ShinpoDialog.Body>

      <ShinpoDialog.Footer>
        <button
          ref={cancelBtnRef}
          type="button"
          className="shinpo-btn variant-secondary size-md"
          onClick={onCancel}
          disabled={isLoading}
        >
          {cancelLabel}
        </button>

        <button
          ref={confirmBtnRef}
          type="button"
          className={`shinpo-btn ${isDestructive ? 'variant-danger' : 'variant-primary'} size-md`}
          onClick={onConfirm}
          disabled={isLoading}
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
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              Processing...
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </ShinpoDialog.Footer>
    </ShinpoDialog>
  )
}

