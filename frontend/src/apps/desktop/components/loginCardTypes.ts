import type { FormEvent, Dispatch, SetStateAction } from 'react'
import type { AuthUser } from '../../../api/auth'

export type DesktopLoginCardProps = {
  authMode: 'LOGIN' | 'REGISTER' | 'RECOVER'
  setAuthMode: (mode: 'LOGIN' | 'REGISTER' | 'RECOVER') => void
  authIdentifier: string
  setAuthIdentifier: (val: string) => void
  authPassword: string
  setAuthPassword: (val: string) => void
  authEmail: string
  setAuthEmail: (val: string) => void
  authRecoveryKey: string
  setAuthRecoveryKey: (val: string) => void
  authError: string | null
  setAuthError: (err: string | null) => void
  authLoading: boolean
  showAuthPassword: boolean
  setShowAuthPassword: Dispatch<SetStateAction<boolean>>
  handleAuthSubmit: (e: FormEvent) => void | Promise<void>
  pendingRecovery: { user: AuthUser; recoveryKey: string } | null
  setPendingRecovery: (val: { user: AuthUser; recoveryKey: string } | null) => void
  recoveryConfirmed: boolean
  setRecoveryConfirmed: (val: boolean) => void
  recoveryKeyCopied: boolean
  setRecoveryKeyCopied: (val: boolean) => void
  customServerUrlInput: string
  setCustomServerUrlInput: (val: string) => void
  showServerConfig: boolean
  setShowServerConfig: Dispatch<SetStateAction<boolean>>
  handleSaveServerUrl: () => void | Promise<void>
  handleResetServerUrl?: () => void | Promise<void>
  serverConfigSaved?: boolean
  serverConfigError?: string
  setCurrentUser: (user: AuthUser | null) => void
  isDarkMode: boolean
  isAurora: boolean
}

export type LoginViewMode = 'animated-login' | 'legacy-login'
export const DEFAULT_LOGIN_VIEW_MODE: LoginViewMode = 'animated-login'
export const LOGIN_VIEW_MODE_STORAGE_KEY = 'shinpo_login_view_mode'
