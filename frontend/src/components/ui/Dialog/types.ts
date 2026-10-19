import React from 'react'

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ShinpoDialogProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  size?: DialogSize
  closeOnBackdropClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  children?: React.ReactNode
  className?: string
  cardClassName?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  'data-tutorial'?: string
  'data-testid'?: string
}

export interface ShinpoConfirmDialogProps {
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

