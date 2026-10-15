import React from 'react'
import type { FocusSession, FocusSessionStatus } from '../api/focusSessions'
import type { SentinelWarningItem } from '../api/device'
import { Icon } from '../components/common/Icon'
import {
  formatTimerDigits,
  durationPresets,
  pomodoroPlans,
} from '../utils/focusTimer'
import { formatSafeTimeString } from '../api/eventNormalizer'

export interface FocusViewProps {
  activeSession?: FocusSession | null
  timerSeconds: number
  sessions: FocusSession[]
  pendingWarning: SentinelWarningItem | null
  activeGraceWarning: SentinelWarningItem | null
  graceSecondsLeft: number
  sessionIntention: string
  setSessionIntention: (intention: string) => void
  selectedDuration: number
  setSelectedDuration: (duration: number) => void
  isCustomDuration: boolean
  setIsCustomDuration: (custom: boolean) => void
  selectedPomodoroPlan: string | null
  setSelectedPomodoroPlan: (plan: string | null) => void
  handleStartSession: () => void
  handlePause: (id: number) => void
  handleResume: (id: number) => void
  setCompletingSessionId: (id: number | null) => void
  handleDeleteSession: (id: number) => void
  handleCancelSession?: (id: number) => void
}

import { trackRender } from '../utils/renderTracker'

const getStatusClass = (status: FocusSessionStatus | string): string => {
  switch (status) {
    case 'COMPLETED':
      return 'completed'
    case 'ACTIVE':
      return 'active'
    case 'PAUSED':
      return 'paused'
    case 'SCHEDULED':
      return 'scheduled'
    case 'CANCELLED':
      return 'cancelled'
    case 'EXPIRED':
      return 'expired'
    case 'FAILED':
      return 'failed'
    default:
      return 'pending'
  }
}

export const FocusView: React.FC<FocusViewProps> = ({
  activeSession,
  timerSeconds,
  sessions,
  pendingWarning,
  activeGraceWarning,
  graceSecondsLeft,
  sessionIntention,
  setSessionIntention,
  selectedDuration,
  setSelectedDuration,
  isCustomDuration,
  setIsCustomDuration,
  selectedPomodoroPlan,
  setSelectedPomodoroPlan,
  handleStartSession,
  handlePause,
  handleResume,
  setCompletingSessionId,
  handleDeleteSession,
  handleCancelSession,
}) => {
  trackRender('FocusView')
  return (
    <div className="bento-grid">
      {/* Running Timer HUD */}
      <div className="bento-card card-timer-hud">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-title">Focus Engine</span>
            <span className={`badge-tag ${
              pendingWarning
                ? 'red'
                : activeGraceWarning
                ? 'yellow'
                : activeSession?.status === 'ACTIVE'
                ? 'green'
                : activeSession?.status === 'PAUSED'
                ? 'amber'
                : 'blue'
            }`}>
              {pendingWarning
                ? 'Warning'
                : activeGraceWarning
                ? `Grace (${formatTimerDigits(graceSecondsLeft)})`
                : activeSession
                ? (activeSession.status === 'ACTIVE' && timerSeconds === 0 ? 'Complete' : activeSession.status === 'ACTIVE' ? 'Active' : activeSession.status === 'PAUSED' ? 'Paused' : activeSession.status)
                : 'Ready'}
            </span>
          </div>
          <Icon name="clock" size={20} />
        </div>

        {/* Live Grace Period Countdown Banner in Focus Engine HUD */}
        {activeGraceWarning && (
          <div className="sentinel-grace-banner" style={{ margin: '8px 0 16px' }}>
            <div className="grace-banner-left">
              <Icon name="clock" size={16} />
              <div>
                <div className="grace-banner-title">
                  Grace Active: <strong>{activeGraceWarning.processName}</strong>
                </div>
                <div className="grace-banner-subtitle">
                  Focus protection deferred. App will close when timer reaches 0.
                </div>
              </div>
            </div>
            <div className="grace-banner-countdown">
              {formatTimerDigits(graceSecondsLeft)}
            </div>
          </div>
        )}

        <div className="timer-hud-center">
          {activeSession?.status === 'ACTIVE' && timerSeconds === 0 ? (
            <div className="timer-ended-banner">
              <Icon name="check" size={16} />
              <span className="timer-ended-text">Session Complete — Debrief</span>
            </div>
          ) : (
            <div
              className={`timer-digits-display${activeSession?.status === 'PAUSED' ? ' timer-paused' : ''}`}
            >
              {formatTimerDigits(timerSeconds)}
            </div>
          )}

          {activeSession?.status === 'PAUSED' && (
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span className="badge-tag" style={{ background: 'rgba(255,180,0,0.15)', color: 'var(--accent-yellow, #F59E0B)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 11 }}>
                PAUSED — Time frozen
              </span>
            </div>
          )}

          {(activeSession?.intention || sessionIntention) && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span className="active-intention-tag">
                {activeSession?.intention || sessionIntention}
              </span>
            </div>
          )}
        </div>

        <div className="timer-progress-track">
          <div
            className="timer-progress-fill"
            style={{
              transform: `scaleX(${
                activeSession
                  ? Math.max(
                      0,
                      Math.min(
                        1,
                        1 - timerSeconds / ((activeSession.durationMinutes || 25) * 60),
                      ),
                    )
                  : 0
              })`,
            }}
          />
        </div>

        <div className="timer-action-buttons">
          {!activeSession && (
            <button className="btn-timer primary" onClick={handleStartSession} data-tutorial="start-timer-btn">
              <Icon name="play" size={16} />
              <span>Start {selectedDuration}m Session</span>
            </button>
          )}

          {activeSession && activeSession.status === 'ACTIVE' && (
            <>
              <button
                className="btn-timer secondary"
                onClick={() => handlePause(activeSession.id)}
              >
                <Icon name="pause" size={16} />
                <span>Pause Session</span>
              </button>
              <button
                className="btn-timer primary"
                onClick={() => setCompletingSessionId(activeSession.id)}
                data-tutorial="debrief-controls"
              >
                <Icon name="check" size={16} />
                <span>Complete & Summarize</span>
              </button>
              {handleCancelSession && (
                <button
                  className="btn-timer warning"
                  onClick={() => handleCancelSession(activeSession.id)}
                  title="Cancel active focus session without deleting records"
                >
                  <Icon name="close" size={16} />
                  <span>Cancel Session</span>
                </button>
              )}
            </>
          )}

          {activeSession && activeSession.status === 'PAUSED' && (
            <>
              <button
                className="btn-timer primary"
                onClick={() => handleResume(activeSession.id)}
              >
                <Icon name="play" size={16} />
                <span>Resume Session</span>
              </button>
              <button
                className="btn-timer secondary"
                onClick={() => setCompletingSessionId(activeSession.id)}
              >
                <Icon name="check" size={16} />
                <span>End & Summarize</span>
              </button>
              {handleCancelSession && (
                <button
                  className="btn-timer warning"
                  onClick={() => handleCancelSession(activeSession.id)}
                  title="Cancel paused focus session without deleting records"
                >
                  <Icon name="close" size={16} />
                  <span>Cancel Session</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Session Creator & Pomodoro Plans */}
      <div className="bento-card card-session-creator">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-title">Session Configuration</span>
            <span className="badge-tag">Duration & Presets</span>
          </div>
          <Icon name="target" size={20} />
        </div>

        <div className="preset-chip-row">
          {durationPresets.map((mins) => (
            <button
              key={mins}
              className={`preset-chip ${
                selectedDuration === mins && !isCustomDuration ? 'active' : ''
              }`}
              onClick={() => {
                setSelectedDuration(mins)
                setSelectedPomodoroPlan(null)
                setIsCustomDuration(false)
              }}
            >
              {mins}m
            </button>
          ))}
          <button
            className={`preset-chip ${isCustomDuration ? 'active' : ''}`}
            onClick={() => {
              setIsCustomDuration(true)
              setSelectedPomodoroPlan(null)
            }}
          >
            Custom
          </button>
        </div>

        {isCustomDuration && (
          <div className="custom-duration-card">
            <div className="custom-duration-header">
              <span>Custom Duration</span>
              <span className="custom-mins-badge">{selectedDuration} min</span>
            </div>
            <div className="custom-slider-row">
              <input
                type="range"
                min={5}
                max={180}
                step={5}
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                className="custom-slider"
              />
              <input
                type="number"
                min={1}
                max={480}
                value={selectedDuration}
                onChange={(e) =>
                  setSelectedDuration(Math.max(1, Math.min(480, Number(e.target.value))))
                }
                className="modal-field"
                style={{
                  width: 75,
                  marginBottom: 0,
                  padding: '6px 8px',
                  textAlign: 'center',
                  fontWeight: 800,
                }}
              />
            </div>
          </div>
        )}

        {/* Optional Session Intention Input */}
        <div className="session-intention-box">
          <input
            type="text"
            value={sessionIntention}
            onChange={(e) => setSessionIntention(e.target.value)}
            placeholder="Session intention (e.g. Write design doc, review PR)..."
            className="session-intention-input"
            disabled={!!activeSession}
          />
        </div>

        <div className="pomodoro-plan-grid">
          {pomodoroPlans.map((plan) => (
            <div
              key={plan.name}
              className={`plan-card-item ${
                selectedPomodoroPlan === plan.name ? 'active' : ''
              }`}
              onClick={() => {
                setSelectedPomodoroPlan(plan.name)
                setSelectedDuration(plan.totalMinutes)
              }}
            >
              <div>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-schedule-sub">{plan.schedule}</div>
              </div>
              <span className="badge-tag blue">{plan.totalMinutes}m</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bento Card 3: Focus Sessions History */}
      <div className="bento-card card-session-history">
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-title">Recent Sessions</span>
            <span className="badge-tag">{sessions.length} {sessions.length === 1 ? 'Session' : 'Sessions'}</span>
          </div>
          <Icon name="clock" size={18} />
        </div>

        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>
            No focus session records yet. Start your first session above.
          </div>
        ) : (
          <div className="dense-table-wrapper">
            <table className="dense-table">
              <thead>
                <tr>
                  <th>Session Name</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((sess) => (
                  <tr key={sess.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
                        {sess.name}
                      </div>
                      {sess.intention && (
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>
                          {sess.intention}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge-tag blue">{sess.durationMinutes || 25}m</span>
                    </td>
                    <td>
                      <span className={`status-indicator-pill ${getStatusClass(sess.status)}`}>
                        {sess.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                      {formatSafeTimeString(sess.startedAt || sess.createdAt)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-icon-delete"
                        title={
                          sess.id === activeSession?.id || sess.status === 'ACTIVE' || sess.status === 'PAUSED'
                            ? 'Active session cannot be deleted while running. Cancel or complete it first.'
                            : 'Delete Focus Session'
                        }
                        aria-label="Delete Focus Session"
                        disabled={sess.id === activeSession?.id || sess.status === 'ACTIVE' || sess.status === 'PAUSED'}
                        onClick={() => handleDeleteSession(sess.id)}
                        style={
                          sess.id === activeSession?.id || sess.status === 'ACTIVE' || sess.status === 'PAUSED'
                            ? { opacity: 0.3, cursor: 'not-allowed' }
                            : undefined
                        }
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
