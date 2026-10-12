import React, { useState, useRef, useEffect, useCallback } from 'react'
import type {
  ProposedMission,
  TutorialStep,
  BugReportInfo,
  SessionDebriefAnalysis,
  SessionRecovery,
  DailyPlan,
  RecoveryOption,
  AiActionDto,
} from '../api/ai'
import {
  confirmAiAction,
  rejectAiAction,
  getPendingAiActions,
} from '../api/ai'
import { Icon } from '../components/common/Icon'
import { trackRender } from '../utils/renderTracker'

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  text: string
  missions?: ProposedMission[]
  tutorial?: TutorialStep | null
  bugReport?: BugReportInfo | null
  suggestionType?: string
  suggestionId?: number
  committed?: boolean
  committing?: boolean
  debriefAnalysis?: SessionDebriefAnalysis | null
  sessionRecovery?: SessionRecovery | null
  dailyPlan?: DailyPlan | null
  actionProposal?: AiActionDto | null
}

export interface EonpaiViewProps {
  chatMessages: ChatMessage[]
  aiLoading: boolean
  handleTriggerPresetAction: (prompt: string) => void
  handleClearChat: () => void | Promise<void>
  handleStartTutorial: (initialStepIndex?: number) => void
  handleArmMissionAsSession: (title: string, duration?: number) => void
  handleCommitDailyPlan: (plan: DailyPlan, index: number, suggestionId?: number) => void | Promise<void>
  handleCommitChatSuggestion: (suggestionId: number, index: number, specificMission?: ProposedMission) => void | Promise<void>
  handleRecoveryActionClick: (opt: RecoveryOption) => void
  handleAiSend: (messageText?: string, contextualSessionId?: number) => void | Promise<void>
  onActionExecuted?: () => void
}

export const EonpaiView: React.FC<EonpaiViewProps> = React.memo(({
  chatMessages,
  aiLoading,
  handleTriggerPresetAction,
  handleClearChat,
  handleStartTutorial,
  handleArmMissionAsSession,
  handleCommitDailyPlan,
  handleCommitChatSuggestion,
  handleRecoveryActionClick,
  handleAiSend,
  onActionExecuted,
}) => {
  trackRender('EonpaiView')

  const [localInput, setLocalInput] = useState('')
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false)
  const [pendingActions, setPendingActions] = useState<AiActionDto[]>([])
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<Record<string, { status: string; message: string }>>({})

  const loadPendingActions = useCallback(async () => {
    try {
      const list = await getPendingAiActions()
      setPendingActions(list)
    } catch {
      // Ignore background error
    }
  }, [])

  useEffect(() => {
    loadPendingActions()
    const interval = setInterval(loadPendingActions, 8000)
    return () => clearInterval(interval)
  }, [loadPendingActions])

  const handleConfirmAction = useCallback(async (actionId: string) => {
    setActionLoadingId(actionId)
    try {
      const res = await confirmAiAction(actionId)
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: res.status, message: res.resultSummary || 'Action executed successfully' },
      }))
      await loadPendingActions()
      onActionExecuted?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution failed'
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: 'FAILED', message: msg },
      }))
    } finally {
      setActionLoadingId(null)
    }
  }, [loadPendingActions, onActionExecuted])

  const handleRejectAction = useCallback(async (actionId: string) => {
    setActionLoadingId(actionId)
    try {
      await rejectAiAction(actionId)
      setActionFeedback((prev) => ({
        ...prev,
        [actionId]: { status: 'REJECTED', message: 'Action proposal rejected' },
      }))
      await loadPendingActions()
    } catch (err: unknown) {
      console.error('Failed to reject action', err)
    } finally {
      setActionLoadingId(null)
    }
  }, [loadPendingActions])
  const aiFeedRef = useRef<HTMLDivElement | null>(null)
  const aiContentRef = useRef<HTMLDivElement | null>(null)
  const autoFollowEnabledRef = useRef(true)
  const lastScrollTopRef = useRef(0)

  const handleSend = useCallback(() => {
    if (!localInput.trim() || aiLoading) return
    handleAiSend(localInput.trim())
    setLocalInput('')
  }, [localInput, aiLoading, handleAiSend])

  const handleChatScroll = useCallback(() => {
    const feedEl = aiFeedRef.current
    if (!feedEl) return

    const { scrollTop, scrollHeight, clientHeight } = feedEl
    const distFromBottom = scrollHeight - scrollTop - clientHeight

    if (scrollTop < lastScrollTopRef.current - 10) {
      autoFollowEnabledRef.current = false
    }

    if (distFromBottom <= 30) {
      autoFollowEnabledRef.current = true
    }

    setShowScrollBottomBtn(distFromBottom > 60)
    lastScrollTopRef.current = scrollTop
  }, [])

  const handleScrollToBottom = useCallback(() => {
    autoFollowEnabledRef.current = true
    setShowScrollBottomBtn(false)
    if (aiFeedRef.current) {
      aiFeedRef.current.scrollTo({
        top: aiFeedRef.current.scrollHeight,
        behavior: 'smooth',
      })
      lastScrollTopRef.current = aiFeedRef.current.scrollHeight
    }
  }, [])

  // Auto-follow via ResizeObserver on the messages content wrapper
  useEffect(() => {
    const feedEl = aiFeedRef.current
    const contentEl = aiContentRef.current
    if (!feedEl || !contentEl) return

    const observer = new ResizeObserver(() => {
      if (autoFollowEnabledRef.current && feedEl) {
        feedEl.scrollTop = feedEl.scrollHeight
        lastScrollTopRef.current = feedEl.scrollTop
        setShowScrollBottomBtn(false)
      } else if (feedEl) {
        const dist = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight
        setShowScrollBottomBtn(dist > 60)
      }
    })

    observer.observe(contentEl)
    return () => observer.disconnect()
  }, [])

  // Auto-follow when chat messages or loading state change
  useEffect(() => {
    if (autoFollowEnabledRef.current && aiFeedRef.current) {
      aiFeedRef.current.scrollTop = aiFeedRef.current.scrollHeight
      lastScrollTopRef.current = aiFeedRef.current.scrollTop
    }
  }, [chatMessages, aiLoading])

  return (
    <div className="ai-bento-container">
      <div className="ai-sidebar-card">
        <div className="card-header-row" style={{ margin: 0 }}>
          <h2 className="card-title">QUICK ACTIONS</h2>
          <div className="ai-sparkle-icon">
            <Icon name="sparkle" size={16} />
          </div>
        </div>
        <p className="ai-sidebar-sub">
          Ask for guidance, plan your schedule, or break down goals into tasks.
        </p>

        <div className="ai-preset-grid">
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('Plan my day based on scheduled tasks')}
          >
            <span>Plan My Day</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('Analyze my last focus session and provide structured feedback')}
          >
            <span>Summarize Last Session</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('I need a short break. Guide me through a 5-minute recovery.')}
          >
            <span>Take a Break</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleStartTutorial(0)}
          >
            <span>Start Guided Tour</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('Check focus protection daemon status and active blocked applications')}
          >
            <span>Check Focus Protection</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('Report an issue or bug')}
          >
            <span>Report an Issue / Bug</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('What is my next priority action?')}
          >
            <span>What is My Next Action?</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
          <button
            type="button"
            className="ai-preset-btn"
            onClick={() => handleTriggerPresetAction('Break down my top priority goal into tasks')}
          >
            <span>Break Down Top Goal</span>
            <Icon name="arrow-up-right" size={14} />
          </button>
        </div>
      </div>

      <div className="ai-chat-card">
        <div className="ai-chat-card-header">
          <div className="ai-header-status-group">
            <h2 className="ai-header-name">EONPAI CONVERSATION</h2>
            <div className="eonpai-online-badge">
              <span className="online-dot" />
              <span>EONPAI ONLINE</span>
            </div>
          </div>
          <button
            type="button"
            className="ai-clear-btn"
            onClick={handleClearChat}
            title="Start fresh conversation"
          >
            <Icon name="refresh" size={13} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="ai-chat-feed" ref={aiFeedRef} onScroll={handleChatScroll}>
          <div className="ai-chat-content-wrap" ref={aiContentRef}>
            {/* Pending Controlled Actions Queue */}
            {pendingActions.length > 0 && (
              <div className="ai-pending-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="shield" size={16} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#00e5ff' }}>
                    {pendingActions.length} Controlled Action{pendingActions.length > 1 ? 's' : ''} Awaiting Confirmation
                  </span>
                </div>
              </div>
            )}

            {pendingActions.map((act) => (
              <div key={act.actionId} className="ai-bubble assistant">
                <div className="ai-bubble-text">
                  🛡️ <strong>EONPAI Proposed Controlled Action:</strong> Awaiting your review and explicit approval.
                </div>
                <div className="ai-action-card">
                  <div className="ai-action-header">
                    <div className="ai-action-title-group">
                      <Icon name="shield" size={15} />
                      <span className="ai-action-type">{act.actionType}</span>
                    </div>
                    <span className={`ai-risk-tag ${(act.riskLevel || 'LOW').toLowerCase()}`}>
                      {act.riskLevel || 'LOW'} RISK
                    </span>
                  </div>
                  <div className="ai-action-desc">{act.description}</div>
                  {actionFeedback[act.actionId] ? (
                    <div className="ai-action-actions-row">
                      <span className={`ai-action-status-badge ${actionFeedback[act.actionId].status.toLowerCase()}`}>
                        {actionFeedback[act.actionId].status}: {actionFeedback[act.actionId].message}
                      </span>
                    </div>
                  ) : (
                    <div className="ai-action-actions-row">
                      <button
                        type="button"
                        className="ai-action-reject-btn"
                        disabled={actionLoadingId === act.actionId}
                        onClick={() => handleRejectAction(act.actionId)}
                      >
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        className="ai-action-apply-btn"
                        disabled={actionLoadingId === act.actionId}
                        onClick={() => handleConfirmAction(act.actionId)}
                      >
                        {actionLoadingId === act.actionId ? (
                          <span>Applying...</span>
                        ) : (
                          <>
                            <Icon name="check" size={13} />
                            <span>Confirm &amp; Apply</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatMessages.map((msg, index) => (
              <div
                key={msg.id ?? index}
                className={`ai-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="ai-bubble-text">{msg.text}</div>

                {/* Controlled Action Proposal Card in message */}
                {msg.actionProposal && (
                  <div className="ai-action-card">
                    <div className="ai-action-header">
                      <div className="ai-action-title-group">
                        <Icon name="shield" size={15} />
                        <span className="ai-action-type">{msg.actionProposal.actionType}</span>
                      </div>
                      <span className={`ai-risk-tag ${(msg.actionProposal.riskLevel || 'LOW').toLowerCase()}`}>
                        {msg.actionProposal.riskLevel || 'LOW'} RISK
                      </span>
                    </div>
                    <div className="ai-action-desc">{msg.actionProposal.description}</div>
                    {actionFeedback[msg.actionProposal.actionId] ? (
                      <div className="ai-action-actions-row">
                        <span className={`ai-action-status-badge ${actionFeedback[msg.actionProposal.actionId].status.toLowerCase()}`}>
                          {actionFeedback[msg.actionProposal.actionId].status}: {actionFeedback[msg.actionProposal.actionId].message}
                        </span>
                      </div>
                    ) : (
                      <div className="ai-action-actions-row">
                        <button
                          type="button"
                          className="ai-action-reject-btn"
                          disabled={actionLoadingId === msg.actionProposal.actionId}
                          onClick={() => handleRejectAction(msg.actionProposal!.actionId)}
                        >
                          <span>Reject</span>
                        </button>
                        <button
                          type="button"
                          className="ai-action-apply-btn"
                          disabled={actionLoadingId === msg.actionProposal.actionId}
                          onClick={() => handleConfirmAction(msg.actionProposal!.actionId)}
                        >
                          {actionLoadingId === msg.actionProposal.actionId ? (
                            <span>Applying...</span>
                          ) : (
                            <>
                              <Icon name="check" size={13} />
                              <span>Confirm &amp; Apply</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Guided Tour Prompt Card */}
                {msg.tutorial && (
                  <div className="ai-tutorial-card">
                    <div className="ai-tutorial-header">
                      <span className="tutorial-step-tag">
                        TUTORIAL • STEP {msg.tutorial.stepId}
                      </span>
                      <span className="tutorial-total-steps">
                        {msg.tutorial.tutorialId}
                      </span>
                    </div>
                    <div className="ai-tutorial-content">
                      {msg.tutorial.instruction}
                    </div>
                    <button
                      className="ai-tutorial-btn"
                      onClick={() => handleStartTutorial(0)}
                    >
                      <span>Start interactive tour</span>
                      <Icon name="arrow-up-right" size={12} />
                    </button>
                  </div>
                )}

                {/* Bug Report Diagnostics Card */}
                {msg.bugReport && (
                  <div className="ai-bug-card">
                    <div className="ai-bug-header">
                      <Icon name="shield" size={14} />
                      <span>DIAGNOSTIC SNAPSHOT: {msg.bugReport.bugId}</span>
                    </div>
                    <div className="ai-bug-field">
                      <strong>Feature:</strong> {msg.bugReport.feature}
                    </div>
                    <div className="ai-bug-field">
                      <strong>Summary:</strong> {msg.bugReport.summary}
                    </div>
                    <div className="ai-bug-field">
                      <strong>Status:</strong> {msg.bugReport.status}
                    </div>
                    {msg.bugReport.diagnostics && (
                      <div className="ai-bug-field">
                        <strong>Diagnostics:</strong> {msg.bugReport.diagnostics}
                      </div>
                    )}
                  </div>
                )}

                {/* Daily Agenda Plan */}
                {msg.dailyPlan && (
                  <div className="ai-plan-card">
                    <div className="ai-plan-header">
                      <div className="ai-plan-title-group">
                        <Icon name="schedule" size={16} />
                        <span className="ai-plan-title">
                          {msg.dailyPlan.headline}
                        </span>
                      </div>
                      <span className="ai-plan-energy-badge">
                        {msg.dailyPlan.rationale}
                      </span>
                    </div>

                    <div className="ai-plan-timeline">
                      {msg.dailyPlan.planItems?.map((item, pIdx) => (
                        <div key={pIdx} className="ai-timeline-block">
                          <div className="timeline-block-time">
                            <span className="timeline-time-str">
                              {item.scheduledStartTime || `${item.durationMinutes}m`}
                            </span>
                            <span className="timeline-duration-badge">
                              {item.durationMinutes}m
                            </span>
                          </div>
                          <div className="timeline-block-content">
                            <div className="timeline-mission-title-row">
                              <span className="timeline-mission-title">{item.missionTitle}</span>
                              {item.energyWindow && (
                                <span className="timeline-window-tag">{item.energyWindow}</span>
                              )}
                            </div>
                            {item.goalTitle && (
                              <div className="timeline-intention">{item.goalTitle}</div>
                            )}
                          </div>
                          <button
                            className="ai-arm-sprint-btn"
                            onClick={() =>
                              handleArmMissionAsSession(item.missionTitle, item.durationMinutes)
                            }
                            title="Start as focus session"
                          >
                            <span>Start</span>
                            <Icon name="play" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="ai-plan-actions-row">
                      <button
                        className="ai-commit-plan-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitDailyPlan(msg.dailyPlan!, index, msg.suggestionId)
                        }
                      >
                        <Icon name="check" size={14} />
                        <span>
                          {msg.committed
                            ? 'Agenda Scheduled'
                            : msg.committing
                            ? 'Scheduling Agenda...'
                            : 'Schedule Daily Agenda'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Structured Decomposition Cards */}
                {msg.missions && msg.missions.length > 0 && (
                  <div className="ai-missions-wrapper">
                    <div className="ai-missions-header">
                      <span className="ai-missions-count">
                        Proposed Tasks • {msg.missions.length} tasks
                      </span>
                      <button
                        className="ai-commit-all-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitChatSuggestion(msg.suggestionId ?? 0, index)
                        }
                      >
                        <Icon name="plus" size={13} />
                        <span>
                          {msg.committed
                            ? 'All Tasks Added'
                            : msg.committing
                            ? 'Adding Tasks...'
                            : 'Add All to Backlog'}
                        </span>
                      </button>
                    </div>

                    <div className="ai-missions-list">
                      {msg.missions.map((m, mIdx) => (
                        <div key={mIdx} className="ai-mission-card" role="group" aria-label={`Task: ${m.title}`}>
                          <div className="ai-mission-main">
                            <div className="ai-mission-title">{m.title}</div>
                            {m.description && (
                              <div className="ai-mission-desc">{m.description}</div>
                            )}
                          </div>
                          <div className="ai-mission-actions">
                            <span className="ai-duration-tag">{m.estimatedMinutes}M</span>
                            <button
                              className="ai-commit-btn"
                              disabled={msg.committing || msg.committed}
                              onClick={() =>
                                handleCommitChatSuggestion(msg.suggestionId ?? 0, index, m)
                              }
                              title="Add to Backlog"
                            >
                              <span>+ Backlog</span>
                            </button>
                            <button
                              className="ai-arm-sprint-btn"
                              onClick={() =>
                                handleArmMissionAsSession(m.title, m.estimatedMinutes)
                              }
                              title="Start as focus session"
                            >
                              <span>Start focus</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Debrief Analysis Card */}
                {msg.debriefAnalysis && (
                  <div className="ai-debrief-card">
                    <div className="ai-debrief-header">
                      <div className="ai-debrief-title-group">
                        <Icon name="sparkle" size={15} />
                        <span className="ai-debrief-title">
                          Session Feedback: {msg.debriefAnalysis.sessionName} ({msg.debriefAnalysis.actualMinutes}m)
                        </span>
                      </div>
                      <div className="ai-debrief-score-badge">
                        <span>Quality: {msg.debriefAnalysis.completionQuality || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="ai-debrief-metrics-row">
                      <div className="debrief-stat-block">
                        <span className="stat-label">Planned Time</span>
                        <span className="stat-val">{msg.debriefAnalysis.plannedMinutes}m</span>
                      </div>
                      <div className="debrief-stat-block">
                        <span className="stat-label">Estimation Accuracy</span>
                        <span className="stat-val">{msg.debriefAnalysis.estimationAccuracyPct}%</span>
                      </div>
                    </div>

                    {msg.debriefAnalysis.tacticalCritique && (
                      <div className="ai-debrief-critique-box">
                        <div className="ai-debrief-critique-header">
                          <Icon name="target" size={13} />
                          <span>Pacing Feedback</span>
                        </div>
                        <p className="ai-debrief-text">{msg.debriefAnalysis.tacticalCritique}</p>
                      </div>
                    )}

                    {msg.debriefAnalysis.nextSprintRecommendation && (
                      <div className="ai-debrief-recommendation-box">
                        <div className="ai-debrief-recommendation-header">
                          <Icon name="zap" size={13} />
                          <span>Next Step Recommendation</span>
                        </div>
                        <p className="ai-debrief-text">{msg.debriefAnalysis.nextSprintRecommendation}</p>
                      </div>
                    )}

                    {msg.debriefAnalysis.suggestedNextSteps && msg.debriefAnalysis.suggestedNextSteps.length > 0 && (
                      <div className="ai-debrief-actions">
                        <span className="ai-debrief-actions-title">Recommended Next Steps:</span>
                        <div className="ai-recovery-options-row">
                          {msg.debriefAnalysis.suggestedNextSteps.map((opt, oIdx) => (
                            <div key={oIdx} className="ai-recovery-option-card">
                              <div className="recovery-option-info">
                                <span className="recovery-option-title">{opt.label}</span>
                                <span className="recovery-option-desc">{opt.suggestedAction}</span>
                              </div>
                              <button
                                className="ai-arm-sprint-btn"
                                onClick={() => handleRecoveryActionClick(opt)}
                                title={`Activate ${opt.label}`}
                              >
                                <span>Activate</span>
                                <Icon name="arrow-up-right" size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Session Recovery Protocol */}
                {msg.sessionRecovery && (
                  <div className="ai-recovery-card">
                    <div className="ai-recovery-header">
                      <div className="ai-recovery-title-group">
                        <Icon name="zap" size={16} />
                        <span className="ai-recovery-title">Session Interrupted: {msg.sessionRecovery.sessionName}</span>
                      </div>
                      <span className="ai-recovery-trigger-badge">
                        {msg.sessionRecovery.actualMinutes}m / {msg.sessionRecovery.plannedMinutes}m
                      </span>
                    </div>

                    <p className="ai-recovery-diagnosis">
                      {msg.sessionRecovery.diagnosticMessage}
                    </p>

                    <div className="ai-recovery-options-row">
                      {msg.sessionRecovery.recoveryOptions?.map((opt, oIdx) => (
                        <div key={oIdx} className="ai-recovery-option-card">
                          <div className="recovery-option-info">
                            <span className="recovery-option-title">{opt.label}</span>
                            <span className="recovery-option-desc">{opt.suggestedAction}</span>
                          </div>
                          <button
                            className="ai-arm-sprint-btn"
                            onClick={() => handleRecoveryActionClick(opt)}
                            title={`Activate ${opt.label}`}
                          >
                            <span>Activate</span>
                            <Icon name="arrow-up-right" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="ai-bubble assistant" style={{ fontStyle: 'italic' }}>
                EONPAI formulating response...
              </div>
            )}
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <button
            className="ai-scroll-bottom-btn"
            onClick={handleScrollToBottom}
            aria-label="Scroll to latest"
            title="Scroll to latest"
          >
            ↓
          </button>
        )}

        <div className="ai-chat-input-bar">
          <input
            type="text"
            className="ai-input-field ai-chat-input"
            placeholder="Ask EONPAI anything (e.g. 'plan my day', 'break down a goal')..."
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            className="ai-send-btn"
            onClick={handleSend}
            disabled={aiLoading || !localInput.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
})
