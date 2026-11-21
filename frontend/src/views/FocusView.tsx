import React, { useEffect, useState } from 'react'
import { emergencyStopGuardianInterventions, getGuardianObservations, getGuardianStatus, updateGuardianPreferences } from '../api/focusSessions'
import type { FocusSession, FocusSessionStatus, GuardianMode, GuardianObservation, GuardianPreferences, GuardianStatus } from '../api/focusSessions'
import { guardianCapabilityLabel, guardianInterventionDescription } from '../utils/guardianCapability'
import { getLiveFocusElapsedSeconds } from '../utils/liveFocusElapsed'
import type { SentinelWarningItem } from '../api/device'
import { Icon } from '../components/common/Icon'
import {
  formatTimerDigits,
  describeFocusPlan,
  durationPresets,
} from '../utils/focusTimer'
import { formatSafeTimeString } from '../api/eventNormalizer'
import { StudyResourcesPanel } from '../components/focus'
import { trackMicrokitPointer } from '../components/microkit/pointerGlow'
import { sortFocusSessionsNewestFirst } from '../utils/focusSessionHistory'
import { ShinpoNumberStepper } from '../components/ui/NumberStepper'

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
  guardianClosureConsent: boolean
  setGuardianClosureConsent: (enabled: boolean) => void
  onGuardianPreferencesSaved: (preferences: GuardianPreferences) => void
  backgroundRuntimeConsent: boolean
  setBackgroundRuntimeConsent: (enabled: boolean) => void
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

const GUARDIAN_MODE_OPTIONS: ReadonlyArray<{ mode: GuardianMode; label: string; detail: string }> = [
  { mode: 'GUIDED', label: 'Light', detail: 'App monitoring is warning-only; website rules depend on a connected Browser Companion.' },
  { mode: 'PROTECTED', label: 'Standard', detail: 'With separate consent, SHINPO samples recognized app-running time and warns.' },
  { mode: 'STRICT', label: 'Strict', detail: 'During Focus, recognized blocked apps receive one consent-based graceful close request when observed; non-exiting apps remain open.' },
]

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
  selectedPomodoroPlan: _selectedPomodoroPlan,
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
  guardianClosureConsent,
  setGuardianClosureConsent,
  onGuardianPreferencesSaved,
  backgroundRuntimeConsent,
  setBackgroundRuntimeConsent,
  guardianModeAvailable,
}) => {
  const [guardianObservations, setGuardianObservations] = useState<GuardianObservation[]>([])
  const [guardianObservationError, setGuardianObservationError] = useState(false)
  const [guardianNow, setGuardianNow] = useState<number | null>(null)
  const [guardianPreferenceMessage, setGuardianPreferenceMessage] = useState('')
  const [guardianPreferenceError, setGuardianPreferenceError] = useState('')
  const [savingGuardianPreference, setSavingGuardianPreference] = useState(false)
  const [guardianStopMessage, setGuardianStopMessage] = useState('')
  const [guardianStatus, setGuardianStatus] = useState<GuardianStatus | null>(null)

  useEffect(() => {
    if (!guardianModeAvailable) return
    let active = true
    const isStarting = !guardianStatus || guardianStatus.observerStatus === 'STARTING'
    const refresh = () => getGuardianStatus().then((status) => { if (active) setGuardianStatus(status) }).catch(() => { if (active) setGuardianStatus(null) })
    void refresh()
    const timer = window.setInterval(() => void refresh(), isStarting ? 800 : 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [guardianModeAvailable, activeSession?.id, activeSession?.currentPhase, activeSession?.status, guardianStatus?.observerStatus])

  useEffect(() => {
    const maxBreak = Math.max(1, Math.min(60, Math.floor(selectedDuration / 2)))
    if (pomodoroLongBreakMinutes > maxBreak) {
      setPomodoroLongBreakMinutes(maxBreak)
    }
    const maxGrace = Math.max(1, Math.min(10, Math.floor(selectedDuration / 3)))
    if (pomodoroGraceMinutes > maxGrace) {
      setPomodoroGraceMinutes(maxGrace)
    }
  }, [selectedDuration, pomodoroLongBreakMinutes, pomodoroGraceMinutes, setPomodoroLongBreakMinutes, setPomodoroGraceMinutes])

  const saveGuardianPreference = async (applyToNewSessions: boolean) => {
    setSavingGuardianPreference(true)
    setGuardianPreferenceMessage('')
    setGuardianPreferenceError('')
    try {
      const saved = await updateGuardianPreferences({
        preferredMode: guardianMode,
        appMonitoringConsent: applyToNewSessions && guardianAppMonitoring,
        applyToNewSessions,
        closureConsent: applyToNewSessions && guardianAppMonitoring && guardianClosureConsent,
        backgroundRuntimeConsent: applyToNewSessions && guardianAppMonitoring && backgroundRuntimeConsent,
      })
      onGuardianPreferencesSaved(saved)
      if (!saved.appMonitoringConsent) setGuardianAppMonitoring(false)
      setGuardianClosureConsent(saved.closureConsent)
      if (!applyToNewSessions || !saved.appMonitoringConsent) {
        setBackgroundRuntimeConsent(false)
        setGuardianClosureConsent(false)
      }
      setGuardianPreferenceMessage(applyToNewSessions
        ? 'Guardian choice saved in this encrypted vault.'
        : 'Saved Guardian choice forgotten; app observation is off.')
    } catch {
      setGuardianPreferenceError('Could not save the Guardian choice. No preference change was confirmed.')
    } finally {
      setSavingGuardianPreference(false)
    }
  }

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
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const recentSessions = sortFocusSessionsNewestFirst(safeSessions)
  const visibleSessions = isAurora ? showAllSessions ? recentSessions : recentSessions.slice(0, 5) : safeSessions

  return (
    <div className="focus-workspace-container" data-focus-mode={isPaused ? 'paused' : isBreak ? 'break' : activeSession?.status === 'ACTIVE' ? 'active' : 'ready'}>
      <div className="focus-hero-split">
        {/* Left Column: Timer HUD and Intention Card */}
        <div className="focus-left-column">
          <div
            className="bento-card card-timer-hud"
            data-focus-state={isPaused ? 'paused' : isBreak ? 'break' : isSequenceComplete || isTimerExpired ? 'complete' : activeSession?.status === 'ACTIVE' ? 'active' : 'ready'}
          >
            <div className="card-header-row">
              <div className="card-title-group">
                <span className="card-title">Focus Engine</span>
                <span className={`badge-tag ${pendingWarning
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
                      Guardian is warning-only; applications are not closed.
                    </div>
                  </div>
                </div>
                <div className="grace-banner-countdown">
                  {formatTimerDigits(graceSecondsLeft)}
                </div>
              </div>
            )}

            {/* Live Break / Grace Notice Banner */}
            {activeSession && (isBreak || isReturnRequired) && (
              <div
                className="focus-break-notice-banner"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md, 12px)',
                  background: isReturnRequired
                    ? 'color-mix(in srgb, var(--accent-terracotta) 14%, var(--surface-subtle))'
                    : 'color-mix(in srgb, var(--brand-primary) 12%, var(--surface-subtle))',
                  border: `1px solid ${
                    isReturnRequired
                      ? 'color-mix(in srgb, var(--accent-terracotta) 35%, transparent)'
                      : 'color-mix(in srgb, var(--brand-primary) 30%, transparent)'
                  }`,
                  margin: '8px 0 16px',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={isReturnRequired ? 'bell' : 'clock'} size={18} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isReturnRequired ? 'var(--accent-terracotta)' : 'var(--text-1)' }}>
                      {isReturnRequired
                        ? 'Break Ended · Return Required'
                        : currentPhase === 'GRACE'
                          ? 'Grace Period Active'
                          : 'Midpoint Break in Progress'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.35 }}>
                      {isReturnRequired
                        ? 'App termination will re-arm when you return to focus.'
                        : 'Distracting apps are permitted during breaks. App blocking is paused.'}
                    </div>
                  </div>
                </div>
                {handleReturnToFocus && (
                  <button
                    type="button"
                    className="btn-timer primary microkit-finish-glow"
                    style={{ padding: '6px 14px', fontSize: 12, height: 'auto', whiteSpace: 'nowrap' }}
                    onClick={() => handleReturnToFocus(activeSession.id)}
                  >
                    <Icon name="play" size={13} />
                    <span>Return to Focus</span>
                  </button>
                )}
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
                    {isReturnRequired
                      ? 'Your break and grace period have ended'
                      : isSequenceComplete
                        ? 'Your cycle is complete'
                        : isPaused
                          ? 'Paused · resume when ready'
                          : isBreak
                            ? currentPhase === 'GRACE'
                              ? 'Grace period · return to focus soon'
                              : 'Midpoint break in progress'
                            : activeSession?.pomodoroEnabled && timerSeconds === 0
                              ? 'Moving to the next phase…'
                              : activeSession?.status === 'ACTIVE'
                                ? 'Deep work in progress'
                                : 'Make room for focused work'}
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
                    {isBreak
                      ? `Midpoint Break · ${activeSession?.name || 'Focus Session'}`
                      : activeSession?.name || (sessionIntention.trim() ? `Target: ${sessionIntention.trim()}` : 'Choose one meaningful next step')}
                  </span>
                </div>
              </div>

              {activeSession?.status === 'PAUSED' && (
                <span className="focus-paused-note">Paused · {formatTimerDigits(timerSeconds)} remaining</span>
              )}
            </div>

            {!activeSession && (
              <p className="timer-plan-preview" style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-2)', textAlign: 'center', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--text-1)' }}>Plan preview:</strong> {describeFocusPlan(selectedDuration, pomodoroEnabled && selectedDuration >= 5, pomodoroLongBreakMinutes, pomodoroGraceMinutes)}
              </p>
            )}

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
                  {(isBreak || isReturnRequired) && (
                    <button className="btn-timer primary microkit-finish-glow" onClick={() => handleReturnToFocus(activeSession.id)}>
                      <Icon name="play" size={16} />
                      <span>Return to Focus (Skip Break)</span>
                    </button>
                  )}
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
        </div>

        {/* Right Column: Configuration or Live Context */}
        <div className="focus-right-column">
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
                  <span>{isReturnRequired ? 'Return required' : isBreak ? currentPhase === 'GRACE' ? 'Grace time remaining' : 'Break time remaining' : 'Active focus time'}</span>
                  <b>{isReturnRequired ? 'Now' : `${formatTimerDigits(isBreak ? timerSeconds : getLiveFocusElapsedSeconds(activeSession, timerSeconds))}${isBreak ? ' remaining' : ' focused'}`}</b>
                </div>
                {activeSession.guardianAppMonitoring && <section className="guardian-observations" aria-live="polite" aria-label="Local app monitoring">
                  <div><strong>Local app monitoring</strong><span>{guardianCapabilityLabel(guardianStatus?.interventionCapability)}</span></div>
                  {guardianStatus?.standardAllowanceSeconds !== null && guardianStatus?.standardAllowanceSeconds !== undefined && <span>Standard allowance used: {Math.floor(guardianStatus.standardAllowanceSeconds / 60)}:{String(guardianStatus.standardAllowanceSeconds % 60).padStart(2, '0')} of 10:00 · sampled app-running time</span>}
                  <div className="guardian-intervention-banner">
                    <span className="guardian-intervention-status">
                      {guardianStatus?.interventionCapability === 'EMERGENCY_STOPPED'
                        ? 'Guardian emergency stopped — protection disarmed for this session.'
                        : isBreak || isReturnRequired
                          ? 'Break phase active — apps are permitted and not closed until you resume focus.'
                          : activeSession.guardianMode === 'STRICT'
                            ? (guardianStatus?.observerStatus === 'STARTING'
                                ? 'Starting Strict app observation…'
                                : guardianStatus?.interventionCapability === 'STRICT_COOPERATIVE_CLOSE' && !guardianStatus.warningOnly
                                  ? guardianInterventionDescription(guardianStatus.interventionCapability)
                                  : guardianInterventionDescription(guardianStatus?.interventionCapability))
                            : (!guardianStatus || guardianStatus.warningOnly
                                ? 'App closure is not currently armed.'
                                : 'Active protection armed.')}
                    </span>
                    {activeSession.guardianMode === 'STRICT' && guardianStatus && guardianStatus.interventionCapability !== 'EMERGENCY_STOPPED' && (
                      <button
                        type="button"
                        className="btn-guardian-emergency-stop"
                        onClick={() => void emergencyStopGuardianInterventions().then(() => {
                          setGuardianStopMessage('Guardian intervention stopped for this session.')
                          return getGuardianStatus().then(setGuardianStatus)
                        }).catch(() => setGuardianStopMessage('Could not confirm the emergency stop.'))}
                      >
                        <Icon name="shield" size={13} />
                        <span>Emergency stop</span>
                      </button>
                    )}
                  </div>
                  {guardianStopMessage && <p role="status" className="guardian-stop-status-msg">{guardianStopMessage}</p>}
                  {isRecentGuardianObservation && <p role="status" className="guardian-observation-notice">
                    {latestGuardianObservation.outcome === 'ALLOWED_BREAK'
                      ? `${latestGuardianObservation.processName} is allowed during this break. Guardian does not control applications.`
                      : `${latestGuardianObservation.processName} matches the built-in distraction catalog. ${latestGuardianObservation.outcome.replaceAll('_', ' ').toLowerCase()}.`}
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
                      className={`preset-chip ${selectedDuration === mins && !isCustomDuration ? 'active' : ''
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
                    <div className="custom-slider-row" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="range"
                        min={5}
                        max={180}
                        step={5}
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(Number(e.target.value))}
                        className="custom-slider microkit-scrub-range"
                        style={{ flex: 1, '--scrub-progress': `${((selectedDuration - 5) / 175) * 100}%` } as React.CSSProperties}
                      />
                      <div style={{ width: 110 }}>
                        <ShinpoNumberStepper
                          min={1}
                          max={480}
                          value={selectedDuration}
                          onChange={(val) => setSelectedDuration(Math.max(1, Math.min(480, val)))}
                          unit="m"
                          ariaLabel="Custom duration in minutes"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <section className="pomodoro-config" aria-label="Pomodoro cycle configuration">
                  {guardianModeAvailable && !activeSession && (
                    <div className="study-mode-section" id="study-mode-section">
                      <div className="study-section-label-row">
                        <span className="study-section-label">Guardian mode</span>
                      </div>
                      <div className="study-mode-options" role="group" aria-label="Guardian mode">
                      {GUARDIAN_MODE_OPTIONS.map(({ mode, label }) => {
                        const isSelected = guardianMode === mode || (mode === 'PROTECTED' && (guardianMode as string) === 'STANDARD')
                        return (
                          <button
                            key={mode}
                            type="button"
                            className={`study-mode-option ${isSelected ? 'is-active' : ''}`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setGuardianMode(mode)
                              if (mode === 'STRICT') {
                                setGuardianAppMonitoring(true)
                              }
                            }}
                          >
                            <strong>{label}</strong>
                            <span className="study-mode-option-detail">
                              {mode === 'GUIDED' ? 'Warning-only' : mode === 'PROTECTED' ? 'Sampled runtime' : 'Consent-based graceful close'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {(() => {
                      const opt = GUARDIAN_MODE_OPTIONS.find(({ mode }) => mode === guardianMode || (mode === 'PROTECTED' && (guardianMode as string) === 'STANDARD'))
                      return opt?.detail ? <p className="study-mode-description" aria-live="polite">{opt.detail}</p> : null
                    })()}
                    <fieldset className="guardian-consent-group">
                      <legend>App observation consent</legend>
                      <label className="pomodoro-toggle"><input type="checkbox" checked={guardianAppMonitoring} onChange={(event) => setGuardianAppMonitoring(event.target.checked)} />Allow SHINPO to observe matching process names during this Focus session</label>
                      <p className="guardian-observation-note">On Fedora Wayland, foreground time is unavailable. Standard uses sampled app-running time—not foreground time—and requires separate consent.</p>
                      <label className="pomodoro-toggle"><input type="checkbox" checked={backgroundRuntimeConsent} disabled={!guardianAppMonitoring} onChange={(event) => setBackgroundRuntimeConsent(event.target.checked)} />Allow Standard to count up to 10 minutes while a recognized app is running</label>
                      {guardianMode === 'STRICT' && (
                        <label className="pomodoro-toggle">
                          <input
                            type="checkbox"
                            checked={guardianClosureConsent}
                            disabled={!guardianAppMonitoring || savingGuardianPreference}
                            onChange={(event) => setGuardianClosureConsent(event.target.checked)}
                          />
                          I consent to SHINPO sending a graceful close request to recognized blocked apps during Strict Focus sessions. Apps that do not exit will remain open; SHINPO will not force-kill them.
                        </label>
                      )}
                    </fieldset>
                    <p className="guardian-observation-note" style={{ margin: '12px 0' }}>
                      {guardianMode === 'STRICT'
                        ? 'On Linux, Strict can request graceful closure of a recognized blocked app after it is observed during Focus, when you have saved separate closure consent. Detection follows the app observer polling interval. Windows currently supports observation only.'
                        : 'Guardian observes recognized applications during Focus. Strict closure is Linux-only, requires separate saved consent and never escalates to force-killing.'}
                    </p>
                    <div className="guardian-preference-actions" style={{ marginTop: 6, marginBottom: 8 }}>
                      <button type="button" disabled={savingGuardianPreference} onClick={() => void saveGuardianPreference(true)}>
                        {savingGuardianPreference ? 'Saving…' : 'Remember for future sessions'}
                      </button>
                      <button type="button" disabled={savingGuardianPreference} onClick={() => void saveGuardianPreference(false)}>
                        Forget saved choice
                      </button>
                    </div>
                    {guardianPreferenceMessage && <p role="status" className="guardian-observation-note">{guardianPreferenceMessage}</p>}
                    {guardianPreferenceError && <p role="alert" className="guardian-observation-note">{guardianPreferenceError}</p>}
                  </div>
                  )}
                  <label className={`pomodoro-toggle${selectedDuration < 5 ? ' is-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={pomodoroEnabled && selectedDuration >= 5}
                      disabled={selectedDuration < 5}
                      onChange={(event) => {
                        setPomodoroEnabled(event.target.checked)
                        setSelectedPomodoroPlan(null)
                      }}
                    />
                    <span>Include one midpoint break</span>
                    {selectedDuration < 5 && (
                      <span className="pomodoro-disabled-hint" style={{ fontSize: '11.5px', color: 'var(--text-3)', marginLeft: 8 }}>
                        (Requires 5+ min session)
                      </span>
                    )}
                  </label>
                  {pomodoroEnabled && selectedDuration >= 5 && <div className="pomodoro-config-fields">
                    <label>
                      <span style={{ marginBottom: 4, fontWeight: 600 }}>Long break</span>
                      <ShinpoNumberStepper
                        min={1}
                        max={Math.max(1, Math.min(120, selectedDuration < 30 ? Math.floor(selectedDuration / 2) : 120))}
                        value={pomodoroLongBreakMinutes}
                        onChange={setPomodoroLongBreakMinutes}
                        unit="min"
                        ariaLabel="Long break duration in minutes"
                      />
                    </label>
                    <label>
                      <span style={{ marginBottom: 4, fontWeight: 600 }}>Grace</span>
                      <ShinpoNumberStepper
                        min={1}
                        max={Math.max(1, Math.min(10, selectedDuration < 15 ? Math.floor(selectedDuration / 3) : 10))}
                        value={pomodoroGraceMinutes}
                        onChange={setPomodoroGraceMinutes}
                        unit="min"
                        ariaLabel="Grace period in minutes"
                      />
                    </label>
                  </div>}
                  {pomodoroEnabled && selectedDuration >= 5 && <div className="pomodoro-config-fields">
                    <label className="pomodoro-toggle"><input type="checkbox" checked={latePenaltyEnabled} onChange={(event) => setLatePenaltyEnabled(event.target.checked)} />Apply a progress adjustment only if I miss the return deadline</label>
                    {latePenaltyEnabled && <>
                      <label>
                        <span style={{ marginBottom: 4, fontWeight: 600 }}>Adjustment per late return</span>
                        <ShinpoNumberStepper
                          min={1}
                          max={100}
                          value={latePenaltyXp}
                          onChange={setLatePenaltyXp}
                          unit="XP"
                          ariaLabel="Adjustment per late return"
                        />
                      </label>
                      <label>
                        <span style={{ marginBottom: 4, fontWeight: 600 }}>Daily adjustment limit</span>
                        <ShinpoNumberStepper
                          min={latePenaltyXp}
                          max={100}
                          value={latePenaltyDailyCapXp}
                          onChange={setLatePenaltyDailyCapXp}
                          unit="XP"
                          ariaLabel="Daily adjustment limit"
                        />
                      </label>
                    </>}
                  </div>}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full-width Section Below: Session Intention */}
      {!activeSession && (
        <div className="focus-intention-fullwidth-row">
          <div className="bento-card card-session-intention focus-panel-glass">
            <div className="intention-card-grid">
              <div className="intention-primary-col">
                <div className="card-header-row">
                  <div className="card-title-group">
                    <span className="card-title">Session Intention</span>
                    <span className="badge-tag">Single Focus</span>
                  </div>
                  <Icon name="target" size={18} />
                </div>
                <p className="intention-helper-text">
                  Define the single outcome you will complete during this focus block.
                </p>
                <div className="session-intention-box">
                  <input
                    type="text"
                    value={sessionIntention}
                    onChange={(e) => setSessionIntention(e.target.value)}
                    placeholder="e.g. Finish design review, debug auth flow, draft spec..."
                    className="session-intention-input"
                    disabled={!!activeSession}
                    aria-label="Session Intention"
                  />
                </div>
                <div className="intention-quick-tags">
                  <span>Quick focus:</span>
                  {['Deep work', 'Investigation', 'Code review', 'Writing & planning'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="intention-tag-chip"
                      onClick={() => setSessionIntention(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="intention-companion-col">
                <div className="intention-readiness-header">
                  <Icon name="shield" size={15} />
                  <span>Execution Shield & Readiness</span>
                </div>
                <ul className="intention-readiness-checklist">
                  <li>
                    <Icon name="check" size={13} />
                    <span>Focus protection & process shielding ready</span>
                  </li>
                  <li>
                    <Icon name="check" size={13} />
                    <span>Encrypted local session telemetry armed</span>
                  </li>
                  <li>
                    <Icon name="check" size={13} />
                    <span>Contextual study links activate on launch</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <StudyResourcesPanel
        missionId={activeSession?.missionId ?? undefined}
        sessionId={activeSession?.id}
        taskTitle={activeSession?.name ?? null}
        initialMode={guardianMode}
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
                {safeSessions.map((sess) => (
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
