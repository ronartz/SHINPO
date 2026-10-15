import { useState, useCallback } from 'react'
import type React from 'react'

export interface ConfirmDialogConfig {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  onConfirm: () => Promise<void> | void
}

export function useConfirmationDialog() {
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: React.ReactNode
    confirmLabel?: string
    cancelLabel?: string
    isDestructive?: boolean
    isLoading?: boolean
    errorMessage?: string | null
    onConfirm: () => Promise<void> | void
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  const requestConfirmation = useCallback((config: ConfirmDialogConfig) => {
    setConfirmDialog({
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmLabel: config.confirmLabel ?? 'Confirm',
      cancelLabel: config.cancelLabel ?? 'Cancel',
      isDestructive: config.isDestructive ?? false,
      isLoading: false,
      errorMessage: null,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true, errorMessage: null }))
        try {
          await config.onConfirm()
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }))
        } catch (err: unknown) {
          setConfirmDialog((prev) => ({
            ...prev,
            isLoading: false,
            errorMessage: err instanceof Error ? err.message : 'An error occurred.',
          }))
        }
      },
    })
  }, [])

  const closeConfirmation = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, errorMessage: null, isLoading: false }))
  }, [])

  return {
    confirmDialog,
    requestConfirmation,
    closeConfirmation,
  }
}

