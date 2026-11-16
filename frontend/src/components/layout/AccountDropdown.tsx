import React, { useEffect, useRef, useCallback } from 'react'
import type { AuthUser } from '../../api/auth'
import type { SettingsSection } from '../dialogs/SettingsModal'
import { Icon } from '../common/Icon'

export interface AccountDropdownProps {
  isOpen: boolean
  onClose: () => void
  currentUser: AuthUser | null
  onOpenSettings: (section?: SettingsSection) => void
  onStartTutorial?: () => void
  onLogout: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export const AccountDropdown: React.FC<AccountDropdownProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenSettings,
  onStartTutorial,
  onLogout,
  anchorRef,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)

  // Focus management & keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    // Focus first focusable item in menu on open
    const firstButton = menuRef.current?.querySelector<HTMLButtonElement>('button.dropdown-menu-item')
    firstButton?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        anchorRef?.current?.focus()
        return
      }

      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button.dropdown-menu-item') ?? []
      )
      if (buttons.length === 0) return

      const activeIdx = buttons.indexOf(document.activeElement as HTMLButtonElement)

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextIdx = (activeIdx + 1) % buttons.length
        buttons[nextIdx]?.focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIdx = (activeIdx - 1 + buttons.length) % buttons.length
        buttons[prevIdx]?.focus()
      } else if (e.key === 'Home') {
        e.preventDefault()
        buttons[0]?.focus()
      } else if (e.key === 'End') {
        e.preventDefault()
        buttons[buttons.length - 1]?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!anchorRef?.current || !anchorRef.current.contains(target))
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  const handleAction = useCallback(
    (action: () => void) => {
      onClose()
      action()
    },
    [onClose]
  )

  if (!isOpen || !currentUser) return null

  const initialLetter = currentUser.username.charAt(0).toUpperCase() || 'U'

  return (
    <div
      ref={menuRef}
      className="shinpo-dropdown-menu shinpo-account-dropdown"
      role="menu"
      id="account-dropdown-menu"
      aria-label={`Account menu for ${currentUser.username}`}
      tabIndex={-1}
    >
      {/* Header with Avatar & Details */}
      <div className="account-menu-header" role="presentation">
        <div className="account-menu-avatar" aria-hidden="true">
          {initialLetter}
        </div>
        <div className="account-menu-user-info">
          <span className="account-menu-username" title={currentUser.username}>
            {currentUser.username}
          </span>
          <span className="account-menu-subtitle">Personal workspace</span>
        </div>
      </div>

      <div className="dropdown-menu-divider" role="separator" />

      {/* Main Settings Navigation */}
      <button
        type="button"
        className="dropdown-menu-item"
        role="menuitem"
        onClick={() => handleAction(() => onOpenSettings('account'))}
      >
        <Icon name="target" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">My profile</span>
        </span>
      </button>

      <button
        type="button"
        className="dropdown-menu-item"
        role="menuitem"
        onClick={() => handleAction(() => onOpenSettings('appearance'))}
      >
        <Icon name="sparkle" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">Appearance</span>
        </span>
      </button>

      <button
        type="button"
        className="dropdown-menu-item"
        role="menuitem"
        onClick={() => handleAction(() => onOpenSettings('appearance'))}
      >
        <Icon name="settings" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">All settings</span>
        </span>
      </button>

      <button
        type="button"
        className="dropdown-menu-item"
        role="menuitem"
        onClick={() => handleAction(() => onOpenSettings('companion'))}
      >
        <Icon name="apps" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">Browser Companion</span>
        </span>
      </button>

      <button
        type="button"
        className="dropdown-menu-item"
        role="menuitem"
        onClick={() =>
          handleAction(() => {
            if (typeof onStartTutorial === 'function') {
              onStartTutorial()
            } else if (typeof window !== 'undefined' && window.__SHINPO_START_TUTORIAL__) {
              window.__SHINPO_START_TUTORIAL__()
            }
          })
        }
      >
        <Icon name="check-circle" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">Guided tutorial</span>
        </span>
      </button>

      <div className="dropdown-menu-divider" role="separator" />

      {/* Danger/Lock Action */}
      <button
        type="button"
        className="dropdown-menu-item dropdown-menu-item-danger"
        role="menuitem"
        onClick={() => handleAction(onLogout)}
      >
        <Icon name="lock" size={16} />
        <span className="dropdown-menu-item-text">
          <span className="dropdown-menu-item-title">Lock workspace</span>
        </span>
      </button>
    </div>
  )
}
