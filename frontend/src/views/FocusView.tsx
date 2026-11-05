import React, { useEffect, useState } from 'react'
import { getGuardianObservations } from '../api/focusSessions'
import type { FocusSession, FocusSessionStatus, GuardianMode, GuardianObservation } from '../api/focusSessions'
import type { SentinelWarningItem } from '../api/device'
import { Icon } from '../components/common/Icon'
import {
  formatTimerDigits,
  describeFocusPlan,
  durationPresets,
  pomodoroPlans,
} from '../utils/focusTimer'
import { formatSafeTimeString } from '../api/eventNormalizer'
import { StudyResourcesPanel } from '../components/focus'
import { trackMicrokitPointer } from '../components/microkit/pointerGlow'
import { sortFocusSessionsNewestFirst } from '../utils/focusSessionHistory'

export interface FocusViewProps {
  isAurora?: boolean
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
  pomodoroShortBreakMinutes: number
  pomodoroLongBreakMinutes: number
  setPomodoroLongBreakMinutes: (minutes: number) => void
  pomodoroGraceMinutes: number
  setPomodoroGraceMinutes: (minutes: number) => void
  latePenaltyEnabled: boolean
  setLatePenaltyEnabled: (enabled: boolean) => void
  latePenaltyXp: number
  setLatePenaltyXp: (xp: number) => void
  latePenaltyDailyCapXp: number
  setLatePenaltyDailyCapXp: (xp: number) => void
  guardianMode: GuardianMode
  setGuardianMode: (mode: GuardianMode) => void
  guardianAppMonitoring: boolean
  setGuardianAppMonitoring: (enabled: boolean) => void
  guardianModeAvailable: boolean
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
  isAurora = false,
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
  pomodoroShortBreakMinutes,
  pomodoroLongBreakMinutes,
  setPomodoroLongBreakMinutes,
  pomodoroGraceMinutes,
  setPomodoroGraceMinutes,
  latePenaltyEnabled,
  setLatePenaltyEnabled,
  latePenaltyXp,
  setLatePenaltyXp,
  latePenaltyDailyCapXp,
  setLatePenaltyDailyCapXp,
  guardianMode,
  setGuardianMode,
  guardianAppMonitoring,
  setGuardianAppMonitoring,
  guardianModeAvailable,
}) => {
  const [guardianObservations, setGuardianObservations] = useState<GuardianObservation[]>([])
  const [guardianObservationError, setGuardianObservationError] = useState(false)
  const [guardianNow, setGuardianNow] = useState<number | null>(null)

  useEffect(() => {
    const sessionId = activeSession?.id
    if (!guardianModeAvailable || activeSession?.status !== 'ACTIVE' || !activeSession.guardianAppMonitoring || !sessionId) {
      return
    }
    let mounted = true
    const refresh = () => getGuardianObservations(sessionId)
      .then((items) => { if (mounted) { setGuardianObservations(items); setGuardianObservationError(false); setGuardianNow(Date.now()) } })
      .catch(() => { if (mounted) setGuardianObservationError(true) })
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [activeSession?.id, activeSession?.status, activeSession?.guardianAppMonitoring, guardianModeAvailable])

  trackRender('FocusView')

  const isFocusEngaged = activeSession?.status === 'ACTIVE' || activeSession?.status === 'PAUSED'
  const currentPhase = activeSession?.currentPhase ?? 'FOCUS'
  const isBreak = currentPhase === 'BREAK' || currentPhase === 'SHORT_BREAK' || currentPhase === 'LONG_BREAK' || currentPhase === 'GRACE'
  const latestGuardianObservation = guardianObservations[0]
  const isRecentGuardianObservation = latestGuardianObservation && guardianNow !== null &&
    guardianNow - new Date(latestGuardianObservation.observedAt).getTime() < 30_000
  const isReturnRequired = currentPhase === 'RETURN_REQUIRED'
  const isPaused = activeSession?.status === 'PAUSED'
  const isSequenceComplete = currentPhase === 'COMPLETE'
  const isTimerExpired = timerSeconds === 0 && (!activeSession?.pomodoroEnabled || isSequenceComplete)
  const phaseDurationMinutes = currentPhase === 'GRACE'
    ? activeSession?.pomodoroGraceMinutes ?? pomodoroGraceMinutes
    : currentPhase === 'SHORT_BREAK'
    ? activeSession?.pomodoroShortBreakMinutes ?? pomodoroShortBreakMinutes
    : currentPhase === 'BREAK'
      ? activeSession?.pomodoroLongBreakMinutes ?? pomodoroLongBreakMinutes
    : currentPhase === 'LONG_BREAK'
      ? activeSession?.pomodoroLongBreakMinutes ?? pomodoroLongBreakMinutes
      : activeSession?.durationMinutes ?? selectedDuration
  const focusDurationSeconds = Math.max(1, phaseDurationMinutes * 60)
  const focusProgress = isFocusEngaged
    ? Math.max(0, Math.min(1, 1 - timerSeconds / focusDurationSeconds))
    : 0
  const orbitLength = 2 * Math.PI * 148
  const [showAllSessions, setShowAllSessions] = React.useState(false)
  const recentSessions = sortFocusSessionsNewestFirst(sessions)
  const visibleSessions = isAurora ? showAllSessions ? recentSessions : recentSessions.slice(0, 5) : sessions

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
                : isSequenceComplete ? 'Reflection ready' : isPaused ? `Paused · ${isBreak ? currentPhase === 'GRACE' ? 'grace' : currentPhase === 'LONG_BREAK' || currentPhase === 'BREAK' ? 'long break' : 'short break' : 'focus'}` : isBreak ? (currentPhase === 'GRACE' ? timerSeconds <= 120 ? `Grace · return soon (${formatTimerDigits(timerSeconds)})` : `Grace (${formatTimerDigits(timerSeconds)})` : currentPhase === 'LONG_BREAK' || currentPhase === 'BREAK' ? 'Long break' : 'Short break') : activeSession
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
            <button className="btn-timer primary microkit-pointer-glow" data-microkit-glow onPointerMove={trackMicrokitPointer} onClick={handleStartSession} data-tutorial="start-timer-btn">
              <Icon name="play" size={16} />
              <span>Start {selectedDuration}m Session</span>
            </button>
          )}

          {activeSession && activeSession.status === 'ACTIVE' && (
            <>
              <button
                className="btn-timer secondary microkit-invert-press"
                onClick={() => handlePause(activeSession.id)}
                disabled={isSequenceComplete || isReturnRequired}
              >
                <Icon name="pause" size={16} />
                <span>Pause Session</span>
              </button>
              {(isBreak || isReturnRequired) && <button className="btn-timer primary" onClick={() => handleReturnToFocus(activeSession.id)}>Return to Focus</button>}
              {!isReturnRequired && <button
                className="btn-timer primary microkit-finish-glow"
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
                className="btn-timer secondary microkit-finish-glow"
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
            <span className="badge-tag">{activeSession ? `${currentPhase.replace('_', ' ').toLowerCase()} · ${activeSession.completedFocusCycles ?? 0}/${activeSession.pomodoroEnabled ? 2 : 1} focus blocks` : 'Duration & Presets'}</span>
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
            {activeSession.guardianAppMonitoring && <section className="guardian-observations" aria-live="polite" aria-label="Local app monitoring">
              <div><strong>Local app monitoring</strong><span>Warning only · apps are never closed</span></div>
              {isRecentGuardianObservation && <p role="status" className="guardian-observation-notice">
                {latestGuardianObservation.outcome === 'ALLOWED_BREAK'
                  ? `${latestGuardianObservation.processName} is allowed during this break. Guardian does not control applications.`
                  : `${latestGuardianObservation.processName} matches the built-in distraction catalog. This warning is saved in your encrypted vault; SHINPO will not close the app.`}
              </p>}
              {guardianObservationError
                ? <p>Local observations are temporarily unavailable.</p>
                : guardianObservations.length
                  ? <ul>{guardianObservations.slice(0, 4).map((item) => <li key={item.id}><span><strong>{item.processName}</strong><small>{item.outcome.replaceAll('_', ' ').toLowerCase()} · {item.rationale} · {item.catalogVersion}</small></span><time>{new Date(item.observedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></li>)}</ul>
                  : <p>No matching distraction apps observed this session.</p>}
            </section>}
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
          {guardianModeAvailable && !activeSession && <div className="study-mode-section">
            <span className="study-section-label">Automatic Guardian</span>
            <div className="study-mode-options" role="group" aria-label="Guardian mode">
              {([
                ['GUIDED', 'Light', 'Website warnings; known distracting apps are recorded only.'],
                ['PROTECTED', 'Standard', 'Known distracting sites are restricted; app alerts are warnings.'],
                ['STRICT', 'Strict', 'Unknown sites may be restricted; app alerts remain warnings.'],
              ] as const).map(([mode, label, detail]) => <button key={mode} type="button" className={`study-mode-option ${guardianMode === mode ? 'is-active' : ''}`} aria-pressed={guardianMode === mode} onClick={() => setGuardianMode(mode)}><strong>{label}</strong><span>{detail}</span></button>)}
            </div>
            <label className="pomodoro-toggle"><input type="checkbox" checked={guardianAppMonitoring} onChange={(event) => setGuardianAppMonitoring(event.target.checked)} />Allow SHINPO to observe matching app names during this Focus session</label>
            <p className="guardian-observation-note">When enabled, matching process names and warning history are saved in this device's encrypted vault. Apps are never closed.</p>
          </div>}
          <label className="pomodoro-toggle">
            <input type="checkbox" checked={pomodoroEnabled} onChange={(event) => { setPomodoroEnabled(event.target.checked); setSelectedPomodoroPlan(null) }} />
            <span>Include one midpoint break</span>
          </label>
          {pomodoroEnabled && <div className="pomodoro-config-fields">
            <label>Long break<input type="number" min={1} max={120} value={pomodoroLongBreakMinutes} onChange={(event) => setPomodoroLongBreakMinutes(Math.max(1, Math.min(120, Number(event.target.value) || 1)))} /></label>
            <label>Grace<input type="number" min={1} max={10} value={pomodoroGraceMinutes} onChange={(event) => setPomodoroGraceMinutes(Math.max(1, Math.min(10, Number(event.target.value) || 1)))} /></label>
          </div>}
          <p className="pomodoro-config-summary"><strong>Plan preview:</strong> {describeFocusPlan(selectedDuration, pomodoroEnabled, pomodoroLongBreakMinutes, pomodoroGraceMinutes)}</p>
          {pomodoroEnabled && <div className="pomodoro-config-fields">
            <label className="pomodoro-toggle"><input type="checkbox" checked={latePenaltyEnabled} onChange={(event) => setLatePenaltyEnabled(event.target.checked)} />Deduct XP only if I miss the return deadline</label>
            {latePenaltyEnabled && <>
              <label>XP per late return<input type="number" min={1} max={100} value={latePenaltyXp} onChange={(event) => setLatePenaltyXp(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label>
              <label>Daily XP cap<input type="number" min={latePenaltyXp} max={100} value={latePenaltyDailyCapXp} onChange={(event) => setLatePenaltyDailyCapXp(Math.max(latePenaltyXp, Math.min(100, Number(event.target.value) || 1)))} /></label>
            </>}
          </div>}
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
                className="custom-slider microkit-scrub-range"
                style={{ '--scrub-progress': `${((selectedDuration - 5) / 175) * 100}%` } as React.CSSProperties}
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
          {isAurora && sessions.length > 5 ? (
            <button type="button" className="focus-history-toggle" aria-expanded={showAllSessions} onClick={() => setShowAllSessions((value) => !value)}>
              {showAllSessions ? 'Show recent' : 'View all'}
            </button>
          ) : <Icon name="clock" size={18} />}
        </div>

        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 14 }}>
            No focus session records yet. Start your first session above.
          </div>
        ) : isAurora ? (
          <ol className="focus-session-history-list">
            {visibleSessions.map((sess) => {
              const actualSeconds = sess.focusActiveSeconds ?? sess.activeSeconds ?? 0
              const actualMinutes = Math.floor(actualSeconds / 60)
              const sessionTime = sess.startedAt || sess.scheduledAt || sess.createdAt
              const parsedTime = new Date(sessionTime)
              const timeLabel = Number.isNaN(parsedTime.getTime())
                ? 'Time unavailable'
                : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsedTime)
              const sessionSummary = sess.status === 'SCHEDULED'
                ? `Scheduled ${timeLabel} · ${sess.durationMinutes} min planned`
                : `${timeLabel} · ${actualMinutes} min focused`
              const canDelete = sess.id !== activeSession?.id && sess.status !== 'ACTIVE' && sess.status !== 'PAUSED'
              return <li key={sess.id} className="focus-session-history-item">
                <div className="focus-session-history-copy">
                  <strong>{sess.name}</strong>
                  <span>{sessionSummary}</span>
                  {sess.intention && <small>{sess.intention}</small>}
                </div>
                <span className={`status-indicator-pill ${getStatusClass(sess.status)}`}>{sess.status}</span>
                <button className="btn-icon-delete" title={canDelete ? 'Delete Focus Session' : 'Active session cannot be deleted while running. Cancel or complete it first.'} aria-label={`Delete Focus Session: ${sess.name}`} disabled={!canDelete} onClick={() => handleDeleteSession(sess.id)}>
                  <Icon name="trash" size={15} />
                </button>
              </li>
            })}
          </ol>
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
