import { useState, useCallback, useEffect } from 'react'
import type { AuthUser } from '../api/auth'
import {
  getStoredUser,
  login,
  register,
  logout as apiLogout,
  fetchCurrentUser,
} from '../api/auth'

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser())
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Listen for unauthorized events dispatched by API client
  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null)
      setAuthError('Your session has expired. Please sign in again.')
    }
    window.addEventListener('shinpo:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('shinpo:unauthorized', handleUnauthorized)
  }, [])

  // Sync current user on mount
  useEffect(() => {
    if (currentUser) {
      fetchCurrentUser().then((user) => {
        if (user) setCurrentUser(user)
      }).catch(() => {})
    }
  }, [])

  const handleLogin = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!authIdentifier.trim() || !authPassword) {
      setAuthError('Username/email and password are required.')
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      const response = await login(authIdentifier.trim(), authPassword)
      setCurrentUser(response.user)
      setAuthPassword('')
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setAuthLoading(false)
    }
  }, [authIdentifier, authPassword])

  const handleRegister = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!authIdentifier.trim() || !authEmail.trim() || !authPassword) {
      setAuthError('Username, email, and password are all required.')
      return
    }
    setAuthLoading(true)
    setAuthError(null)
    try {
      const response = await register(authIdentifier.trim(), authEmail.trim(), authPassword)
      setCurrentUser(response.user)
      setAuthPassword('')
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setAuthLoading(false)
    }
  }, [authIdentifier, authEmail, authPassword])

  const handleLogout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setCurrentUser(null)
    }
  }, [])

  return {
    currentUser,
    setCurrentUser,
    authMode,
    setAuthMode,
    authIdentifier,
    setAuthIdentifier,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authError,
    setAuthError,
    authLoading,
    handleLogin,
    handleRegister,
    handleLogout,
  }
}

