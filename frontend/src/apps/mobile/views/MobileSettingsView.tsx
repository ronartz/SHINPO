import React from 'react'

interface MobileSettingsViewProps {
  brand: 'aurora' | 'classic'
  theme: 'light' | 'dark'
  onToggleBrand: () => void
  onToggleTheme: () => void
  onSwitchToDesktop: () => void
}

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  brand,
  theme,
  onToggleBrand,
  onToggleTheme,
  onSwitchToDesktop,
}) => {
  return (
    <div className="shinpo-mobile-settings">
      <h1 className="shinpo-mobile-heading">Settings</h1>
      <p className="shinpo-mobile-subtitle">Configure mobile interface and platform preferences.</p>

      {/* Presentation & Themes */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-card-title" style={{ marginBottom: '14px' }}>
          Visual Theme & Brand
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Design Brand</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Current: <strong style={{ textTransform: 'capitalize' }}>{brand}</strong>
            </div>
          </div>
          <button
            type="button"
            className="shinpo-mobile-btn shinpo-mobile-btn-secondary"
            onClick={onToggleBrand}
            style={{ width: 'auto', minHeight: '44px', padding: '0 16px' }}
          >
            Switch to {brand === 'aurora' ? 'Classic' : 'Aurora'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Color Mode</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Current: <strong style={{ textTransform: 'capitalize' }}>{theme}</strong>
            </div>
          </div>
          <button
            type="button"
            className="shinpo-mobile-btn shinpo-mobile-btn-secondary"
            onClick={onToggleTheme}
            style={{ width: 'auto', minHeight: '44px', padding: '0 16px' }}
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* Platform & Architecture Switcher */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-card-title" style={{ marginBottom: '10px' }}>
          Platform Presentation
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
          You are viewing the mobile presentation architecture. Both desktop and mobile presentations share core domain logic while maintaining 100% separate layouts and CSS.
        </p>
        <button
          type="button"
          className="shinpo-mobile-btn shinpo-mobile-btn-secondary"
          onClick={onSwitchToDesktop}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Switch to Desktop View
        </button>
      </div>

      {/* Honest Architectural Status */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-card-title" style={{ marginBottom: '12px' }}>
          System Capabilities
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Local Vault Storage</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>● Active</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Focus Engine Logic</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>● Shared Core</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Guardian Native Shield</span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>Desktop Host Only</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Browser Extension Native Host</span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>Desktop Host Only</span>
          </div>
        </div>
      </div>
    </div>
  )
}
