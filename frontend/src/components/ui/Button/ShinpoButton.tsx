import { forwardRef } from 'react'
import {
  InteractiveButton,
  type InteractiveButtonProps,
  type InteractiveButtonVariant,
} from '../../common/InteractiveButton'

export interface ShinpoButtonProps extends Omit<InteractiveButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'destructive'
}

export const ShinpoButton = forwardRef<HTMLButtonElement, ShinpoButtonProps>(
  ({ variant = 'primary', className = '', ...props }, ref) => {
    // Map legacy 'danger' to 'destructive' for theme-aware tokens
    const mappedVariant: InteractiveButtonVariant =
      variant === 'danger' ? 'destructive' : (variant as InteractiveButtonVariant)

    const extraClass = variant === 'danger' ? 'variant-danger' : ''

    return (
      <InteractiveButton
        ref={ref}
        variant={mappedVariant}
        className={`shinpo-btn ${extraClass} ${className}`.trim()}
        {...props}
      />
    )
  }
)

ShinpoButton.displayName = 'ShinpoButton'
