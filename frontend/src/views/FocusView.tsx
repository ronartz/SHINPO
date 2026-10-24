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
import { StudyResourcesPanel } from '../components/focus'

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
  handleReturnToFocus: (id: number) => void
  pomodoroEnabled: boolean
  setPomodoroEnabled: (enabled: boolean) => void
  pomodoroFocusCycles: number
  setPomodoroFocusCycles: (cycles: number) => void
  pomodoroShortBreakMinutes: number
  setPomodoroShortBreakMinutes: (minutes: number) => void
  pomodoroLongBreakMinutes: number
  setPomodoroLongBreakMinutes: (minutes: number) => void
  pomodoroGraceMinutes: number
  setPomodoroGraceMinutes: (minutes: number) => void
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
  handleReturnToFocus,
  pomodoroEnabled,
  setPomodoroEnabled,
  pomodoroFocusCycles,
  setPomodoroFocusCycles,
  pomodoroShortBreakMinutes,
  setPomodoroShortBreakMinutes,
  pomodoroLongBreakMinutes,
  setPomodoroLongBreakMinutes,
  pomodoroGraceMinutes,
  setPomodoroGraceMinutes,
}) => {
  trackRender('FocusView')

  const isFocusEngaged = activeSession?.status === 'ACTIVE' || activeSession?.status === 'PAUSED'
  const currentPhase = activeSession?.currentPhase ?? 'FOCUS'
  const isBreak = currentPhase === 'SHORT_BREAK' || currentPhase === 'LONG_BREAK' || currentPhase === 'GRACE'
  const isReturnRequired = currentPhase === 'RETURN_REQUIRED'
  const isPaused = activeSession?.status === 'PAUSED'
  const isSequenceComplete = currentPhase === 'COMPLETE'
  const isTimerExpired = timerSeconds === 0 && (!activeSession?.pomodoroEnabled || isSequenceComplete)
  const phaseDurationMinutes = currentPhase === 'GRACE'
    ? activeSession?.pomodoroGraceMinutes ?? pomodoroGraceMinutes
    : currentPhase === 'SHORT_BREAK'
    ? activeSession?.pomodoroShortBreakMinutes ?? pomodoroShortBreakMinutes
    : currentPhase === 'LONG_BREAK'
      ? activeSession?.pomodoroLongBreakMinutes ?? pomodoroLongBreakMinutes
      : activeSession?.durationMinutes ?? selectedDuration
  const focusDurationSeconds = Math.max(1, phaseDurationMinutes * 60)
  const focusProgress = isFocusEngaged
    ? Math.max(0, Math.min(1, 1 - timerSeconds / focusDurationSeconds))
    : 0
  const orbitLength = 2 * Math.PI * 148

  return (
    <div className="focus-workspace-container" data-focus-mode={isPaused ? 'paused' : isBreak ? 'break' : activeSession?.status === 'ACTIVE' ? 'active' : 'ready'}>
      <div className="focus-hero-split">
        {/* Running Timer HUD */}
        <div
          className="bento-card card-timer-hud"
          data-focus-state={isPaused ? 'paused' : isBreak ? 'break' : isSequenceComplete || isTimerExpired ? 'complete' : activeSession?.status === 'ACTIVE' ? 'active' : 'ready'}
        >
        <div className="card-header-row">
          <div className="card-title-group">
            <span className="card-title">Focus Engine</span>
            <span className={`badge-tag ${
              pendingWarning
                ? 'red'
                : activeGraceWarning
                ? 'yellow'
                : isPaused
                ? 'amber'
                : isBreak
                ? 'blue'
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
                : isReturnRequired ? 'Return to Focus'
                : isSequenceComplete ? 'Reflection ready' : isPaused ? `Paused · ${isBreak ? currentPhase === 'GRACE' ? 'grace' : currentPhase === 'LONG_BREAK' ? 'long break' : 'short break' : 'focus'}` : isBreak ? (currentPhase === 'GRACE' ? timerSeconds <= 120 ? `Grace · return soon (${formatTimerDigits(timerSeconds)})` : `Grace (${formatTimerDigits(timerSeconds)})` : currentPhase === 'LONG_BREAK' ? 'Long break' : 'Short break') : activeSession
                ? (isTimerExpired ? 'Complete' : activeSession.status === 'ACTIVE' ? 'Active' : activeSession.status === 'PAUSED' ? 'Paused' : activeSession.status)
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
                  Focus protection paused for <strong>{activeGraceWarning.processName}</strong>
                </div>
                <div className="grace-banner-subtitle">
                  The app will close when the countdown ends.
                </div>
              </div>
            </div>
            <div className="grace-banner-countdown">
              {formatTimerDigits(graceSecondsLeft)}
            </div>
          </div>
        )}

        <div className="timer-hud-center">
          <div className="focus-time-orbit">
            <svg className="focus-orbit-art" viewBox="0 0 320 320" aria-hidden="true">
              <circle className="focus-orbit-track" cx="160" cy="160" r="148" />
              <circle className="focus-orbit-progress" cx="160" cy="160" r="148" style={{ strokeDasharray: orbitLength, strokeDashoffset: orbitLength * (1 - focusProgress) }} />
              <circle className="focus-orbit-marker" cx="160" cy="12" r="3" />
            </svg>
            <span className="focus-progress-accessible" role="progressbar" aria-label="Focus session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focusProgress * 100)} />
            <div className="focus-time-core">
              <span className="focus-stage-state" aria-live="polite">
                {isReturnRequired ? 'Your break and grace period have ended' : isSequenceComplete ? 'Your cycle is complete' : isPaused ? 'Paused · resume when ready' : isBreak ? 'Step away and reset' : activeSession?.pomodoroEnabled && timerSeconds === 0 ? 'Moving to the next phase…' : activeSession?.status === 'ACTIVE' ? 'Deep work in progress' : 'Make room for focused work'}
              </span>
              {isSequenceComplete ? (
                <div className="timer-ended-banner"><Icon name="check" size={16} /><span className="timer-ended-text">Pomodoro complete · reflect</span></div>
              ) : activeSession?.status === 'ACTIVE' && isTimerExpired && !isBreak ? (
                <div className="timer-ended-banner">
                  <Icon name="check" size={16} />
                  <span className="timer-ended-text">Session Complete — Debrief</span>
                </div>
              ) : (
                <div
                  className={`timer-digits-display${activeSession?.status === 'PAUSED' ? ' timer-paused' : ''}`}
                  role="timer"
                  aria-label={`${formatTimerDigits(timerSeconds)} remaining`}
                >
                  {formatTimerDigits(timerSeconds)}
                </div>
              )}
              <span className="focus-stage-task">
                {activeSession?.name || (sessionIntention.trim() || 'Choose one meaningful next step')}
              </span>
            </div>
          </div>

          {activeSession?.status === 'PAUSED' && (
            <span className="focus-paused-note">Paused · {formatTimerDigits(timerSeconds)} remaining</span>
          )}

          {(activeSession?.intention || sessionIntention) && !isFocusEngaged && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span className="active-intention-tag">
                {activeSession?.intention || sessionIntention}
              </span>
            </div>
          )}
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
                disabled={isSequenceComplete || isReturnRequired}
              >
                <Icon name="pause" size={16} />
                <span>Pause Session</span>
              </button>
              {(isBreak || isReturnRequired) && <button className="btn-timer primary" onClick={() => handleReturnToFocus(activeSession.id)}>Return to Focus</button>}
              {!isReturnRequired && <button
                className="btn-timer primary"
                onClick={() => setCompletingSessionId(activeSession.id)}
                data-tutorial="debrief-controls"
              >
                <Icon name="check" size={16} />
                <span>Finish and reflect</span>
              </button>}
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
                <span>Finish and reflect</span>
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
            <span className="card-title">{activeSession ? 'Current Session' : 'Session Configuration'}</span>
            <span className="badge-tag">{activeSession ? `${currentPhase.replace('_', ' ').toLowerCase()} · ${activeSession.completedFocusCycles ?? 0}/${activeSession.pomodoroFocusCycles ?? 1} cycles` : 'Duration & Presets'}</span>
          </div>
          <Icon name={activeSession ? 'clock' : 'target'} size={20} />
        </div>

        {activeSession ? (
          <div className="focus-session-live-context">
            <span className="focus-context-label">{isReturnRequired ? 'RETURN REQUIRED' : isBreak ? 'RECOVERY IS PART OF THE WORK' : 'ONE THING AT A TIME'}</span>
            <strong>{activeSession.name}</strong>
            <p>{isReturnRequired ? 'Your break and grace period have ended. Return to Focus to resume this session.' : isBreak ? 'Leave the screen, stretch, and return when the break ends.' : activeSession.intention || 'Keep your attention on this session. You can pause whenever you need to.'}</p>
            <div className="focus-context-stat">
              <span>{isReturnRequired ? 'Return required' : isBreak ? currentPhase === 'GRACE' ? 'Grace time remaining' : 'Break time remaining' : 'Active focus recorded'}</span>
              <b>{isReturnRequired ? 'Now' : `${formatTimerDigits(isBreak ? timerSeconds : activeSession.focusActiveSeconds ?? activeSession.activeSeconds)}${isBreak ? ' remaining' : ' focused'}`}</b>
            </div>
          </div>
        ) : (
          <>
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

        <section className="pomodoro-config" aria-label="Pomodoro cycle configuration">
          <label className="pomodoro-toggle">
            <input type="checkbox" checked={pomodoroEnabled} onChange={(event) => { setPomodoroEnabled(event.target.checked); setSelectedPomodoroPlan(null) }} />
            <span>Run focus and break cycles</span>
          </label>
          {pomodoroEnabled && <div className="pomodoro-config-fields">
            <label>Cycles<input type="number" min={1} max={12} value={pomodoroFocusCycles} onChange={(event) => setPomodoroFocusCycles(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>
            <label>Short break<input type="number" min={1} max={60} value={pomodoroShortBreakMinutes} onChange={(event) => setPomodoroShortBreakMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></label>
            <label>Long break<input type="number" min={1} max={120} value={pomodoroLongBreakMinutes} onChange={(event) => setPomodoroLongBreakMinutes(Math.max(1, Math.min(120, Number(event.target.value) || 1)))} /></label>
            <label>Grace<input type="number" min={1} max={60} value={pomodoroGraceMinutes} onChange={(event) => setPomodoroGraceMinutes(Math.max(1, Math.min(60, Number(event.target.value) || 1)))} /></label>
          </div>}
          {pomodoroEnabled && <p className="pomodoro-config-summary">{selectedDuration} min focus × {pomodoroFocusCycles} cycles · {pomodoroShortBreakMinutes} min short breaks · {pomodoroLongBreakMinutes} min final break + {pomodoroGraceMinutes} min grace</p>}
        </section>

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
                setPomodoroEnabled(false)
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
          </>
        )}
      </div>
      </div>

      <StudyResourcesPanel
        missionId={activeSession?.missionId ?? undefined}
        sessionId={activeSession?.id}
        taskTitle={activeSession?.name ?? null}
      />

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
