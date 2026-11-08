import React from 'react'

interface MobileOverviewViewProps {
  onStartFocus: () => void
  onNavigateToGoals: () => void
}

export const MobileOverviewView: React.FC<MobileOverviewViewProps> = ({
  onStartFocus,
  onNavigateToGoals,
}) => {
  return (
    <div className="shinpo-mobile-overview">
      <h1 className="shinpo-mobile-heading">Daily Progress</h1>
      <p className="shinpo-mobile-subtitle">Focus on what moves the needle today.</p>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="shinpo-mobile-card" style={{ padding: '14px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Daily Streak</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brand-primary, #6366f1)', marginTop: '4px' }}>
            🔥 3 Days
          </div>
        </div>

        <div className="shinpo-mobile-card" style={{ padding: '14px', margin: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Focus Completed</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            ⚡ 50 min
          </div>
        </div>
      </div>

      {/* Focus Action Hero Card */}
      <div className="shinpo-mobile-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
        <div className="shinpo-mobile-card-header">
          <span className="shinpo-mobile-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Ready for Deep Work?
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-primary, #6366f1)', background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
            25m Sprint
          </span>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Block distractions, build momentum, and lock into your single most impactful task.
        </p>
        <button
          type="button"
          className="shinpo-mobile-btn shinpo-mobile-btn-primary"
          onClick={onStartFocus}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Focus Session
        </button>
      </div>

      {/* Key Objectives Preview */}
      <div className="shinpo-mobile-card">
        <div className="shinpo-mobile-card-header">
          <span className="shinpo-mobile-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Today's Top Objectives
          </span>
          <button
            type="button"
            onClick={onNavigateToGoals}
            style={{ background: 'none', border: 'none', color: 'var(--brand-primary, #6366f1)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '4px' }}
          >
            View all →
          </button>
        </div>

        <div className="shinpo-mobile-task-item">
          <div className="shinpo-mobile-checkbox">
            <div className="shinpo-mobile-checkbox-box checked">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="shinpo-mobile-task-text completed">
            Complete daily core mission
          </div>
        </div>

        <div className="shinpo-mobile-task-item">
          <div className="shinpo-mobile-checkbox">
            <div className="shinpo-mobile-checkbox-box"></div>
          </div>
          <div className="shinpo-mobile-task-text">
            Execute 2 Focus Sprints (50 mins total)
          </div>
        </div>

        <div className="shinpo-mobile-task-item">
          <div className="shinpo-mobile-checkbox">
            <div className="shinpo-mobile-checkbox-box"></div>
          </div>
          <div className="shinpo-mobile-task-text">
            Review evening debrief with EONPAI
          </div>
        </div>
      </div>
    </div>
  )
}
