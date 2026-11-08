import { Icon } from '../../../components/common/Icon'
import { ShinpoLogo } from '../../../components/ShinpoLogo'
import { getBackendBaseUrl } from '../../../api/config'
import { isLocalVaultSession } from '../../../api/auth'
import { isTauriEnvironment } from '../../../api/tauri'
import type { DesktopLoginCardProps } from './loginCardTypes'

export function LegacyDesktopLoginCard(props: DesktopLoginCardProps) {
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
  const authDescription = authMode === 'RECOVER'
    ? 'Enter the one-time recovery key saved when this encrypted local workspace was created. Recovery resets the password and unlocks this device vault.'
    : isTauriEnvironment()
      ? authMode === 'REGISTER'
        ? 'Create an encrypted workspace stored on this device. Your recovery key appears once after setup; save it somewhere private.'
        : localVaultExists
          ? 'Enter your password to unlock the encrypted workspace stored on this device.'
          : 'Enter the username for a local workspace on this device, or create a new workspace.'
      : authMode === 'REGISTER'
        ? 'Create a SHINPO account to save your work and progress.'
        : 'Sign in to continue to your SHINPO workspace.'

  const authSubmitLabel = authLoading
    ? authMode === 'REGISTER'
      ? isTauriEnvironment() ? 'Creating workspace…' : 'Creating account…'
      : authMode === 'RECOVER' ? 'Recovering workspace…' : isTauriEnvironment() ? 'Unlocking workspace…' : 'Signing in…'
    : authMode === 'REGISTER'
      ? isTauriEnvironment() ? 'Create local workspace' : 'Create Account'
      : authMode === 'RECOVER' ? 'Recover & Unlock Workspace' : isTauriEnvironment() ? 'Unlock workspace' : 'Sign In'

  return (
    <div
      className="auth-card"
      onPointerMove={(event) => {
        if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        const x = (event.clientX - bounds.left) / bounds.width - 0.5
        const y = (event.clientY - bounds.top) / bounds.height - 0.5
        event.currentTarget.style.setProperty('--auth-tilt-x', `${-y * 2}deg`)
        event.currentTarget.style.setProperty('--auth-tilt-y', `${x * 2}deg`)
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty('--auth-tilt-x', '0deg')
        event.currentTarget.style.setProperty('--auth-tilt-y', '0deg')
      }}
    >
      <div className="auth-brand-row">
        <ShinpoLogo size={36} variant="full" />
        <div className="auth-system-badge">
          <span>SHINPO WORKSPACE</span>
        </div>
      </div>

      {pendingRecovery ? (
        <div className="auth-recovery-confirmation" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-danger, #ef4444)',
              marginBottom: '10px'
            }}>
              <Icon name="shield" size={22} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-1, #f8fafc)' }}>
              Save Your Recovery Key
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-2, #94a3b8)', margin: 0, lineHeight: 1.5 }}>
              Your local vault is encrypted. This cryptographic recovery key is displayed <strong>only once</strong> and is required if you ever forget your password.
            </p>
          </div>

          <div style={{
            background: 'var(--surface-3, #0f172a)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-3, #64748b)',
              marginBottom: '6px'
            }}>
              Cryptographic Recovery Key
            </div>
            <code
              id="recovery-key-display"
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '13px',
                wordBreak: 'break-all',
                userSelect: 'all',
                color: 'var(--accent-cyan, #22d3ee)',
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,20.06)'
              }}
            >
              {pendingRecovery.recoveryKey}
            </code>
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="auth-copy-key-btn"
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
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: recoveryKeyCopied ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface-2, rgba(255,255,255,0.08))',
                  border: '1px solid',
                  borderColor: recoveryKeyCopied ? 'var(--color-success, #22c55e)' : 'var(--border-subtle, rgba(255,255,255,0.15))',
                  color: recoveryKeyCopied ? 'var(--color-success, #22c55e)' : 'var(--text-1, #f8fafc)',
                  cursor: 'pointer'
                }}
              >
                <Icon name={recoveryKeyCopied ? 'check' : 'copy'} size={14} />
                {recoveryKeyCopied ? 'Copied to Clipboard' : 'Copy Key'}
              </button>
            </div>
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '13px',
            color: 'var(--text-1, #f8fafc)',
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              id="recovery-confirmed-checkbox"
              checked={recoveryConfirmed}
              onChange={(e) => setRecoveryConfirmed(e.target.checked)}
              style={{ marginTop: '3px', cursor: 'pointer' }}
            />
            <span>I have copied and safely stored my recovery key offline.</span>
          </label>

          <button
            type="button"
            id="recovery-continue-btn"
            className="auth-submit-btn"
            disabled={!recoveryConfirmed}
            onClick={() => {
              const user = pendingRecovery.user
              setPendingRecovery(null)
              setRecoveryKeyCopied(false)
              setRecoveryConfirmed(false)
              setCurrentUser(user)
            }}
            style={{
              width: '100%',
              opacity: recoveryConfirmed ? 1 : 0.45,
              cursor: recoveryConfirmed ? 'pointer' : 'not-allowed'
            }}
          >
            Continue to Workspace
          </button>
        </div>
      ) : (
        <>
          <div className="auth-heading" aria-live="polite">
            <h1>
              {authMode === 'REGISTER'
                ? 'Create your workspace'
                : authMode === 'RECOVER'
                  ? 'Recover your workspace'
                  : localVaultExists
                    ? 'Welcome back'
                    : 'Sign in to SHINPO'}
            </h1>
          </div>
          {authMode === 'RECOVER' ? (
            <div className="auth-nav-tabs">
              <button
                type="button"
                className="auth-tab-btn active"
                onClick={() => { setAuthMode('LOGIN'); setAuthError(null); setAuthRecoveryKey('') }}
              >Back to Sign In</button>
            </div>
          ) : (
            <div className="auth-nav-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${authMode === 'LOGIN' ? 'active' : ''}`}
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
                className={`auth-tab-btn ${authMode === 'REGISTER' ? 'active' : ''}`}
                aria-pressed={authMode === 'REGISTER'}
                onClick={() => {
                  setAuthMode('REGISTER')
                  setAuthError(null)
                }}
              >
                {isTauriEnvironment() ? 'Create workspace' : 'Create Account'}
              </button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <p className="auth-context-note">{authDescription}</p>
            {authError && (
              <div id="auth-error" className="auth-error-banner" role="alert">
                {authError}
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="auth-identifier">
                {isTauriEnvironment() ? 'Local username' : authMode === 'LOGIN' ? 'Username or Email' : 'Username'}
              </label>
              <input
                id="auth-identifier"
                className="auth-input"
                type="text"
                placeholder={isTauriEnvironment() ? (authMode === 'REGISTER' ? 'e.g. username (no spaces)' : 'Your SHINPO username') : authMode === 'LOGIN' ? 'Username or email' : 'Choose a username'}
                value={authIdentifier}
                onChange={(e) => setAuthIdentifier(e.target.value)}
                maxLength={authMode === 'LOGIN' ? 254 : 64}
                autoComplete={authMode === 'LOGIN' ? 'username' : 'username'}
                aria-invalid={Boolean(authError)}
                aria-describedby={authError ? 'auth-error' : undefined}
                required
                autoFocus
              />
              {authMode === 'REGISTER' && (
                <small className="auth-context-note">3–32 characters using letters, numbers, dot, dash, or underscore (no spaces).</small>
              )}
            </div>

            {authMode === 'REGISTER' && (
              <div className="auth-field-group">
                <label className="auth-label" htmlFor="auth-email">Email Address</label>
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  aria-invalid={Boolean(authError)}
                  aria-describedby={authError ? 'auth-error' : undefined}
                  required
                />
              </div>
            )}

            {authMode === 'RECOVER' && (
              <div className="auth-field-group">
                <label className="auth-label" htmlFor="auth-recovery-key">Recovery Key</label>
                <input
                  id="auth-recovery-key"
                  className="auth-input"
                  type="password"
                  value={authRecoveryKey}
                  onChange={(e) => setAuthRecoveryKey(e.target.value)}
                  maxLength={128}
                  autoComplete="off"
                  aria-invalid={Boolean(authError)}
                  aria-describedby={authError ? 'auth-error' : undefined}
                  required
                />
              </div>
            )}

            <div className="auth-field-group">
              <label className="auth-label" htmlFor="auth-password">{authMode === 'RECOVER' ? 'New Password' : 'Password'}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id="auth-password"
                  className="auth-input"
                  type={showAuthPassword ? 'text' : 'password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  minLength={authMode === 'LOGIN' ? undefined : 15}
                  maxLength={128}
                  autoComplete={authMode === 'LOGIN' ? 'current-password' : 'new-password'}
                  aria-invalid={Boolean(authError)}
                  aria-describedby={authError ? 'auth-error' : undefined}
                  required
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowAuthPassword((prev) => !prev)}
                  aria-label={showAuthPassword ? 'Hide password' : 'Show password'}
                  title={showAuthPassword ? 'Hide password' : 'Show password'}
                  aria-controls="auth-password"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                  }}
                >
                  <Icon name={showAuthPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
              {authMode !== 'LOGIN' && (
                <small className="auth-context-note">Use at least 15 characters; common passwords are rejected.</small>
              )}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={authLoading} aria-busy={authLoading}>
              {authSubmitLabel}
            </button>

            {localVaultExists && authMode === 'LOGIN' && (
              <button
                type="button"
                className="auth-server-toggle-btn"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => { setAuthMode('RECOVER'); setAuthError(null); setAuthPassword('') }}
              >
                Forgot password? Recover with key
              </button>
            )}

            {!isTauriEnvironment() && (
              <div className="auth-server-config-section" style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
                <button
                  type="button"
                  className="auth-server-toggle-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3, #5c5c5c)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: '100%',
                    justifyContent: 'center',
                    padding: '4px 0',
                  }}
                  onClick={() => setShowServerConfig((prev) => !prev)}
                  title="Configure Cloud Backend Endpoint"
                >
                  <span>Server: <strong style={{ color: 'var(--text-2, #cccccc)' }}>{getBackendBaseUrl() || 'Direct / Proxy (/api)'}</strong></span>
                </button>

                {showServerConfig && (
                  <div className="auth-server-dropdown" style={{ marginTop: '10px', textAlign: 'left' }}>
                    <label className="auth-label" style={{ fontSize: '12px', marginBottom: '4px', display: 'block', color: 'var(--text-3, #5c5c5c)' }}>
                      Server URL (remote servers require HTTPS; HTTP is only for localhost)
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="auth-input"
                        type="url"
                        placeholder="https://shinpo.example.com"
                        value={customServerUrlInput}
                        onChange={(e) => setCustomServerUrlInput(e.target.value)}
                        style={{ fontSize: '12px', padding: '6px 10px', flex: 1 }}
                      />
                      <button
                        type="button"
                        className="auth-tab-btn active"
                        style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                        onClick={handleSaveServerUrl}
                      >
                        {serverConfigSaved ? <>Saved <Icon name="check" size={12} aria-hidden="true" /></> : 'Save'}
                      </button>
                    </div>
                    {serverConfigError && <p role="alert" className="auth-error">{serverConfigError}</p>}
                    {handleResetServerUrl && (
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-3, #5c5c5c)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          marginTop: '6px',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                        onClick={handleResetServerUrl}
                      >
                        Reset to Default Server
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </>
      )}
    </div>
  )
}
