import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Icon } from '../common/Icon'
import { isTauriEnvironment, invokeTauriCommand } from '../../api/tauri'
import { ConfirmationDialog } from '../dialogs/ConfirmationDialog'

export interface PowerDropdownProps {
  isOpen: boolean
  onClose: () => void
  isFocusActive: boolean
  onLogout: () => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export const PowerDropdown: React.FC<PowerDropdownProps> = ({
  isOpen,
  onClose,
  isFocusActive,
  onLogout,
  anchorRef,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pendingAction, setPendingAction] = useState<'restart' | 'exit' | null>(null)

  // Focus management & keyboard navigation
  useEffect(() => {
    if (!isOpen) return

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

  const executeRestart = useCallback(async () => {
    try {
      if (isTauriEnvironment()) {
        await invokeTauriCommand('desktop_restart_app')
      } else if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (err) {
      console.error('[PowerDropdown] Failed to restart app:', err)
      if (typeof window !== 'undefined') window.location.reload()
    }
  }, [])

  const executeMinimize = useCallback(async () => {
    onClose()
    try {
      if (isTauriEnvironment()) {
        await invokeTauriCommand('desktop_minimize_window')
      } else {
        console.info('[PowerDropdown] Minimize is only supported in desktop mode')
      }
    } catch (err) {
      console.error('[PowerDropdown] Failed to minimize window:', err)
    }
  }, [onClose])

  const executeExit = useCallback(async () => {
    try {
      if (isTauriEnvironment()) {
        await invokeTauriCommand('desktop_exit_app')
      } else {
        onLogout()
      }
    } catch (err) {
      console.error('[PowerDropdown] Failed to exit app:', err)
      onLogout()
    }
  }, [onLogout])

  const handleRestartClick = useCallback(() => {
    onClose()
    if (isFocusActive) {
      setPendingAction('restart')
    } else {
      executeRestart()
    }
  }, [isFocusActive, onClose, executeRestart])

  const handleExitClick = useCallback(() => {
    onClose()
    if (isFocusActive) {
      setPendingAction('exit')
    } else {
      executeExit()
    }
  }, [isFocusActive, onClose, executeExit])

  const handleConfirmPending = useCallback(() => {
    const action = pendingAction
    setPendingAction(null)
    if (action === 'restart') {
      executeRestart()
    } else if (action === 'exit') {
      executeExit()
    }
  }, [pendingAction, executeRestart, executeExit])

  const handleCancelPending = useCallback(() => {
    setPendingAction(null)
  }, [])

  return (
    <>
      {isOpen && (
        <div
          ref={menuRef}
          className="shinpo-dropdown-menu shinpo-power-dropdown"
          role="menu"
          id="power-dropdown-menu"
          aria-label="Application Power and Lifecycle Menu"
          tabIndex={-1}
        >
          {/* Action 1: Restart SHINPO */}
          <button
            type="button"
            className="dropdown-menu-item"
            role="menuitem"
            onClick={handleRestartClick}
          >
            <Icon name="refresh" size={16} />
            <span className="dropdown-menu-item-text">
              <span className="dropdown-menu-item-title">Restart SHINPO</span>
              <span className="dropdown-menu-item-desc">Close and relaunch the app</span>
            </span>
          </button>

          {/* Action 2: Minimize SHINPO */}
          <button
            type="button"
            className="dropdown-menu-item"
            role="menuitem"
            onClick={executeMinimize}
          >
            <Icon name="minimize" size={16} />
            <span className="dropdown-menu-item-text">
              <span className="dropdown-menu-item-title">Minimize SHINPO</span>
              <span className="dropdown-menu-item-desc">Keep running in the taskbar</span>
            </span>
          </button>

          <div className="dropdown-menu-divider" role="separator" />

          {/* Action 3: Exit SHINPO */}
          <button
            type="button"
            className="dropdown-menu-item dropdown-menu-item-danger"
            role="menuitem"
            onClick={handleExitClick}
          >
            <Icon name="power" size={16} />
            <span className="dropdown-menu-item-text">
              <span className="dropdown-menu-item-title">Exit SHINPO</span>
              <span className="dropdown-menu-item-desc">Close the application</span>
            </span>
          </button>
        </div>
      )}

      {/* Confirmation Dialog for Active Focus Session Protection */}
      <ConfirmationDialog
        isOpen={pendingAction !== null}
        title="Active Focus Session in Progress"
        message={
          pendingAction === 'restart'
            ? 'You have an active focus session in progress. Restarting SHINPO will pause your timer and checkpoint your session progress to the encrypted vault. Are you sure you want to restart?'
            : 'You have an active focus session in progress. Exiting SHINPO will pause your timer and checkpoint your session progress to the encrypted vault. Are you sure you want to exit?'
        }
        confirmLabel={pendingAction === 'restart' ? 'Restart SHINPO' : 'Exit SHINPO'}
        cancelLabel="Keep Focusing"
        isDestructive={true}
        onConfirm={handleConfirmPending}
        onCancel={handleCancelPending}
      />
    </>
  )
}
