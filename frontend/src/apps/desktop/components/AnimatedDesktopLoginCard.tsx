import { useState } from 'react'
import { Icon } from '../../../components/common/Icon'
import { ShinpoLogo } from '../../../components/ShinpoLogo'
import { getBackendBaseUrl } from '../../../api/config'
import { isLocalVaultSession } from '../../../api/auth'
import { isTauriEnvironment } from '../../../api/tauri'
import type { DesktopLoginCardProps } from './loginCardTypes'

const REMEMBERED_USER_KEY = 'shinpo_remembered_username'

export function AnimatedDesktopLoginCard(props: DesktopLoginCardProps) {
  const {
    authMode,
    setAuthMode,
    authIdentifier,
    setAuthIdentifier,
    authPassword,
    setAuthPassword,
    authEmail,
    setAuthEmail,
    authRecoveryKey,
    setAuthRecoveryKey,
    authError,
    setAuthError,
    authLoading,
    showAuthPassword,
    setShowAuthPassword,
    handleAuthSubmit,
    pendingRecovery,
    setPendingRecovery,
    recoveryConfirmed,
    setRecoveryConfirmed,
    recoveryKeyCopied,
    setRecoveryKeyCopied,
    customServerUrlInput,
    setCustomServerUrlInput,
    showServerConfig,
    setShowServerConfig,
    handleSaveServerUrl,
    handleResetServerUrl,
    serverConfigSaved,
    serverConfigError,
    setCurrentUser,
  } = props

  const localVaultExists = isLocalVaultSession()

  // 3D Tilt State
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [focusedField, setFocusedField] = useState<'identifier' | 'password' | 'email' | 'recoveryKey' | null>(null)
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return Boolean(localStorage.getItem(REMEMBERED_USER_KEY))
    } catch {
      return false
    }
  })

  const handleToggleRememberMe = () => {
    setRememberMe((prev) => {
      const nextState = !prev
      try {
        if (nextState && authIdentifier.trim()) {
          localStorage.setItem(REMEMBERED_USER_KEY, authIdentifier.trim())
        } else {
          localStorage.removeItem(REMEMBERED_USER_KEY)
        }
      } catch {
        // ignore
      }
      return nextState
    })
  }

  const onSubmitForm = (e: React.FormEvent) => {
    try {
      if (rememberMe && authIdentifier.trim()) {
        localStorage.setItem(REMEMBERED_USER_KEY, authIdentifier.trim())
      } else {
        localStorage.removeItem(REMEMBERED_USER_KEY)
      }
    } catch {
      // ignore
    }
    handleAuthSubmit(e)
  }

  // Tilt event handlers
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - rect.left - rect.width / 2
    const dy = e.clientY - rect.top - rect.height / 2
    const clampedX = Math.max(-300, Math.min(300, dx))
    const clampedY = Math.max(-300, Math.min(300, dy))
    const rotX = (-clampedY / 300) * 10
    const rotY = (clampedX / 300) * 10
    setTilt({ x: rotX, y: rotY })
    e.currentTarget.style.setProperty('--auth-tilt-x', `${rotX}deg`)
    e.currentTarget.style.setProperty('--auth-tilt-y', `${rotY}deg`)
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setTilt({ x: 0, y: 0 })
    e.currentTarget.style.setProperty('--auth-tilt-x', '0deg')
    e.currentTarget.style.setProperty('--auth-tilt-y', '0deg')
  }

  // Titles and descriptions
  const headingTitle = authMode === 'REGISTER'
    ? isTauriEnvironment() ? 'Create your workspace' : 'Create Account'
    : authMode === 'RECOVER'
      ? 'Recover Workspace'
      : 'Welcome Back'

  const supportingDesc = authMode === 'REGISTER'
    ? isTauriEnvironment()
      ? 'Create an encrypted workspace stored on this device'
      : 'Sign up to start your journey with SHINPO'
    : authMode === 'RECOVER'
      ? 'Enter your cryptographic key to reset your vault'
      : isTauriEnvironment()
        ? localVaultExists
          ? 'Enter your password to unlock your device vault'
          : 'Sign in to continue to SHINPO'
        : 'Sign in to continue to SHINPO'

  const authSubmitLabel = authLoading
    ? authMode === 'REGISTER'
      ? isTauriEnvironment() ? 'Creating workspace…' : 'Creating account…'
      : authMode === 'RECOVER' ? 'Recovering workspace…' : isTauriEnvironment() ? 'Unlocking…' : 'Signing in…'
    : authMode === 'REGISTER'
      ? isTauriEnvironment() ? 'Create local workspace' : 'Create Account'
      : authMode === 'RECOVER' ? 'Recover & Unlock' : isTauriEnvironment() ? 'Unlock workspace' : 'Sign In'

  return (
    <div className="animated-login-stage">
      <div
        className="animated-card-tilt-wrapper auth-card"
        style={{
          transform: `perspective(1500px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="animated-card-group">
          {/* Card Ambient Glow */}
          <div className="animated-card-glow" />

          {/* Traveling Border Light Beams */}
          <div className="animated-beam-container">
            <div className="animated-beam--top" />
            <div className="animated-beam--right" />
            <div className="animated-beam--bottom" />
            <div className="animated-beam--left" />
            <div className="animated-corner-glow animated-corner--tl" />
            <div className="animated-corner-glow animated-corner--tr" />
            <div className="animated-corner-glow animated-corner--br" />
            <div className="animated-corner-glow animated-corner--bl" />
          </div>

          {/* Subtle Ambient Border */}
          <div className="animated-card-border-line" />

          {/* Glass Card Surface */}
          <div className="animated-glass-card auth-card">
            {/* Subtle Diagonal Pattern Overlay */}
            <div className="animated-card-pattern" />

            {/* Header & Logo Section */}
            <div className="animated-header-section">
              <div className="animated-logo-badge">
                <ShinpoLogo size={24} variant="icon" />
                <div className="animated-logo-badge__inner-light" />
              </div>
              <h1 className="animated-card-title">{headingTitle}</h1>
              <p className="animated-card-desc">{supportingDesc}</p>

              {/* Mode Nav Tabs for Web/Cloud or Recover */}
              {authMode === 'RECOVER' ? (
                <div className="animated-nav-tabs">
                  <button
                    type="button"
                    className="animated-tab-btn active"
                    onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setAuthRecoveryKey('') }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              ) : (
                <div className="animated-nav-tabs">
                  <button
                    type="button"
                    className={`animated-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
                    aria-pressed={authMode === 'LOGIN'}
                    onClick={() => {
                      setAuthMode('LOGIN')
                      setAuthError(null)
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`animated-tab-btn ${authMode === 'REGISTER' ? 'active' : ''}`}
                    aria-pressed={authMode === 'REGISTER'}
                    onClick={() => {
                      setAuthMode('REGISTER')
                      setAuthError(null)
                    }}
                  >
                    {isTauriEnvironment() ? 'Create Workspace' : 'Create Account'}
                  </button>
                </div>
              )}
            </div>

            {/* Recovery Key Display View (Shown once after local vault creation) */}
            {pendingRecovery ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    marginBottom: '8px',
                  }}>
                    <Icon name="shield" size={20} />
                  </div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px 0', color: 'var(--input-text)' }}>
                    Save Your Recovery Key
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-supporting)', margin: 0, lineHeight: 1.45 }}>
                    Your local vault is encrypted. This key is displayed <strong>only once</strong> and is required if you ever forget your password.
                  </p>
                </div>

                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-supporting)', marginBottom: '4px' }}>
                    Cryptographic Recovery Key
                  </div>
                  <code
                    id="recovery-key-display"
                    style={{
                      display: 'block',
                      fontFamily: 'monospace',
                      fontSize: '12.5px',
                      wordBreak: 'break-all',
                      userSelect: 'all',
                      color: 'var(--beam-color)',
                      padding: '6px 8px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    {pendingRecovery.recoveryKey}
                  </code>
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(pendingRecovery.recoveryKey)
                        } catch {
                          // fallback
                        }
                        setRecoveryKeyCopied(true)
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: recoveryKeyCopied ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid',
                        borderColor: recoveryKeyCopied ? '#22c55e' : 'rgba(255, 255, 255, 0.15)',
                        color: recoveryKeyCopied ? '#22c55e' : 'var(--input-text)',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name={recoveryKeyCopied ? 'check' : 'copy'} size={13} />
                      {recoveryKeyCopied ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>
                </div>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  fontSize: '12px',
                  color: 'var(--input-text)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    id="recovery-confirmed-checkbox"
                    checked={recoveryConfirmed}
                    onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <span>I have copied and safely stored my recovery key offline.</span>
                </label>

                <div className="animated-signin-btn-wrapper">
                  <button
                    type="button"
                    id="recovery-continue-btn"
                    className="animated-signin-btn"
                    disabled={!recoveryConfirmed}
                    onClick={() => {
                      const user = pendingRecovery.user
                      setPendingRecovery(null)
                      setRecoveryKeyCopied(false)
                      setRecoveryConfirmed(false)
                      setCurrentUser(user)
                    }}
                    style={{
                      opacity: recoveryConfirmed ? 1 : 0.45,
                      cursor: recoveryConfirmed ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span>Continue to Workspace</span>
                    <span className="animated-btn-arrow">→</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Main Authentication Form */
              <form className="animated-auth-form" onSubmit={onSubmitForm}>
                {authError && (
                  <div id="auth-error" className="animated-error-banner" role="alert">
                    {authError}
                  </div>
                )}

                {/* Identifier Input */}
                <div className={`animated-field-wrapper ${focusedField === 'identifier' ? 'is-focused' : ''}`}>
                  <div className={`animated-field-group ${focusedField === 'identifier' ? 'is-focused' : ''}`}>
                    <span className="animated-field-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="auth-identifier"
                      name="identifier"
                      type="text"
                      className="animated-input-element"
                      aria-label={isTauriEnvironment() ? 'Local username' : 'Email or username'}
                      placeholder={isTauriEnvironment() ? (authMode === 'REGISTER' ? 'Local username (no spaces)' : 'Username') : 'Email or username'}
                      value={authIdentifier}
                      onChange={(e) => {
                        setAuthIdentifier(e.target.value)
                        if (rememberMe) {
                          try {
                            localStorage.setItem(REMEMBERED_USER_KEY, e.target.value.trim())
                          } catch {
                            // ignore
                          }
                        }
                      }}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      maxLength={authMode === 'LOGIN' ? 254 : 64}
                      autoComplete="username"
                      aria-invalid={Boolean(authError)}
                      aria-describedby={authError ? 'auth-error' : undefined}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Email Input (Register Mode Only) */}
                {authMode === 'REGISTER' && (
                  <div className={`animated-field-wrapper ${focusedField === 'email' ? 'is-focused' : ''}`}>
                    <div className={`animated-field-group ${focusedField === 'email' ? 'is-focused' : ''}`}>
                      <span className="animated-field-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect width="20" height="16" x="2" y="4" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </span>
                      <input
                        id="auth-email"
                        name="email"
                        type="email"
                        className="animated-input-element"
                        aria-label="Email"
                        placeholder="Email address"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        maxLength={254}
                        autoComplete="email"
                        aria-invalid={Boolean(authError)}
                        aria-describedby={authError ? 'auth-error' : undefined}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Recovery Key Input (Recover Mode Only) */}
                {authMode === 'RECOVER' && (
                  <div className={`animated-field-wrapper ${focusedField === 'recoveryKey' ? 'is-focused' : ''}`}>
                    <div className={`animated-field-group ${focusedField === 'recoveryKey' ? 'is-focused' : ''}`}>
                      <span className="animated-field-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="7.5" cy="15.5" r="5.5" />
                          <path d="m21 2-9.6 9.6" />
                          <path d="m15.5 7.5 3 3L22 7l-3-3" />
                        </svg>
                      </span>
                      <input
                        id="auth-recovery-key"
                        name="recoveryKey"
                        type="password"
                        className="animated-input-element"
                        aria-label="Recovery key"
                        placeholder="Enter recovery key"
                        value={authRecoveryKey}
                        onChange={(e) => setAuthRecoveryKey(e.target.value)}
                        onFocus={() => setFocusedField('recoveryKey')}
                        onBlur={() => setFocusedField(null)}
                        maxLength={128}
                        autoComplete="off"
                        aria-invalid={Boolean(authError)}
                        aria-describedby={authError ? 'auth-error' : undefined}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Password Input */}
                <div className={`animated-field-wrapper ${focusedField === 'password' ? 'is-focused' : ''}`}>
                  <div className={`animated-field-group ${focusedField === 'password' ? 'is-focused' : ''}`}>
                    <span className="animated-field-icon">
                      <Icon name="lock" size={15} />
                    </span>
                    <input
                      id="auth-password"
                      name="password"
                      type={showAuthPassword ? 'text' : 'password'}
                      className="animated-input-element has-toggle"
                      aria-label="Password"
                      placeholder={authMode === 'RECOVER' ? 'New Password' : 'Password'}
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      minLength={authMode === 'LOGIN' ? undefined : 15}
                      maxLength={128}
                      autoComplete={authMode === 'LOGIN' ? 'current-password' : 'new-password'}
                      aria-invalid={Boolean(authError)}
                      aria-describedby={authError ? 'auth-error' : undefined}
                      required
                    />
                    <button
                      type="button"
                      className="animated-pwd-toggle"
                      onClick={() => setShowAuthPassword((prev) => !prev)}
                      aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                      title={showAuthPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showAuthPassword ? 'eye-off' : 'eye'} size={15} />
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password Row */}
                {authMode === 'LOGIN' && (
                  <div className="animated-actions-row">
                    <label htmlFor="remember-me" className="animated-remember-label">
                      <div className="animated-checkbox-container">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          checked={rememberMe}
                          onChange={handleToggleRememberMe}
                          className="animated-checkbox-input"
                        />
                        {rememberMe && (
                          <div className="animated-checkbox-icon">
                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span>Remember username</span>
                    </label>

                    <button
                      type="button"
                      className="animated-forgot-btn"
                      onClick={() => {
                        setAuthMode('RECOVER')
                        setAuthError(null)
                        setAuthPassword('')
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Primary Action Button (NO Google login, NO 'or' divider) */}
                <div className="animated-signin-btn-wrapper">
                  <div className="animated-btn-glow" />
                  <button
                    type="submit"
                    className="animated-signin-btn"
                    disabled={authLoading}
                    aria-busy={authLoading}
                  >
                    {authLoading && <div className="animated-btn-shimmer" />}
                    {authLoading ? (
                      <div className="animated-btn-spinner" />
                    ) : (
                      <>
                        <span>{authSubmitLabel}</span>
                        <span className="animated-btn-arrow">→</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Account Creation / Sign in Toggle Link */}
                <div className="animated-signup-row">
                  {authMode === 'REGISTER' ? (
                    <>
                      <span>Already have a workspace?</span>
                      <button
                        type="button"
                        className="animated-signup-link"
                        onClick={() => {
                          setAuthMode('LOGIN')
                          setAuthError(null)
                        }}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      <span>Don't have an account?</span>
                      <button
                        type="button"
                        className="animated-signup-link"
                        onClick={() => {
                          setAuthMode('REGISTER')
                          setAuthError(null)
                        }}
                      >
                        {isTauriEnvironment() ? 'Create local workspace' : 'Sign up'}
                      </button>
                    </>
                  )}
                </div>

                {/* Server Endpoint Configuration (Web / Non-Tauri fallback only) */}
                {!isTauriEnvironment() && (
                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center' }}>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-supporting)',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        padding: '2px 0',
                      }}
                      onClick={() => setShowServerConfig((prev) => !prev)}
                      title="Configure Backend Server Endpoint"
                    >
                      Server: <strong style={{ color: 'var(--input-text)' }}>{getBackendBaseUrl() || 'Direct / Proxy (/api)'}</strong>
                    </button>
                    {showServerConfig && (
                      <div style={{ marginTop: '8px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="url"
                            className="animated-input-element"
                            placeholder="https://shinpo.example.com"
                            style={{ fontSize: '11.5px', height: '32px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: '6px', padding: '0 8px', flex: 1 }}
                            value={customServerUrlInput}
                            onChange={(e) => setCustomServerUrlInput(e.target.value)}
                          />
                          <button
                            type="button"
                            className="animated-tab-btn active"
                            style={{ padding: '4px 12px', fontSize: '11.5px', cursor: 'pointer', flexShrink: 0 }}
                            onClick={handleSaveServerUrl}
                          >
                            {serverConfigSaved ? <>Saved <Icon name="check" size={12} aria-hidden="true" /></> : 'Save'}
                          </button>
                        </div>
                        {serverConfigError && (
                          <p role="alert" className="animated-auth-error" style={{ marginTop: '6px', fontSize: '11px' }}>
                            {serverConfigError}
                          </p>
                        )}
                        {handleResetServerUrl && (
                          <div style={{ marginTop: '6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-supporting)',
                                fontSize: '11px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0,
                              }}
                              onClick={handleResetServerUrl}
                            >
                              Reset to Default Server
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
