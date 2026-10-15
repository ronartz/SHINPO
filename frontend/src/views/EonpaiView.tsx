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
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [pendingActions, setPendingActions] = useState<AiActionDto[]>([])
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<Record<string, { status: string; message: string }>>({})

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const aiFeedRef = useRef<HTMLDivElement | null>(null)
  const aiContentRef = useRef<HTMLDivElement | null>(null)
  const autoFollowEnabledRef = useRef(true)
  const lastScrollTopRef = useRef(0)

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
        [actionId]: { status: res.status, message: res.resultSummary || 'Action applied successfully' },
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

  const handleSend = useCallback(() => {
    if (!localInput.trim() || aiLoading) return
    handleAiSend(localInput.trim())
    setLocalInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [localInput, aiLoading, handleAiSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  const handleChatScroll = useCallback(() => {
    const feedEl = aiFeedRef.current
    if (!feedEl) return

    const { scrollTop, scrollHeight, clientHeight } = feedEl
    const distFromBottom = scrollHeight - scrollTop - clientHeight

    if (scrollTop < lastScrollTopRef.current - 12) {
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
    <div className="eonpai-workspace">
      {/* Supporting Utility Panel */}
      <aside className="eonpai-utility-panel" aria-label="EONPAI Supporting Tools">
        <div className="eonpai-utility-header">
          <span className="eonpai-utility-title">Quick Actions</span>
          <span className="eonpai-utility-count">6</span>
        </div>

        <nav className="eonpai-command-list" aria-label="Quick Actions">
          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Plan my day based on scheduled tasks')}
          >
            <div className="command-row-main">
              <Icon name="schedule" size={14} />
              <span>Plan my day</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('What is my next priority task?')}
          >
            <div className="command-row-main">
              <Icon name="target" size={14} />
              <span>Next priority task</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Break down my top priority goal into tasks')}
          >
            <div className="command-row-main">
              <Icon name="plus" size={14} />
              <span>Break down goal</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Analyze my last focus session and provide structured feedback')}
          >
            <div className="command-row-main">
              <Icon name="clock" size={14} />
              <span>Summarize session</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleTriggerPresetAction('Check focus protection status and active application policies')}
          >
            <div className="command-row-main">
              <Icon name="shield" size={14} />
              <span>Focus protection</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          <button
            type="button"
            className="eonpai-command-row"
            onClick={() => handleStartTutorial(0)}
          >
            <div className="command-row-main">
              <Icon name="sparkle" size={14} />
              <span>Guided tour</span>
            </div>
            <Icon name="arrow-up-right" size={12} className="command-arrow" />
          </button>

          {showMoreActions && (
            <div className="eonpai-command-more-group">
              <button
                type="button"
                className="eonpai-command-row"
                onClick={() => handleTriggerPresetAction('I need a short break. Guide me through a 5-minute recovery.')}
              >
                <div className="command-row-main">
                  <Icon name="pause" size={14} />
                  <span>Take a break</span>
                </div>
                <Icon name="arrow-up-right" size={12} className="command-arrow" />
              </button>

              <button
                type="button"
                className="eonpai-command-row"
                onClick={() => handleTriggerPresetAction('Report an issue or bug')}
              >
                <div className="command-row-main">
                  <Icon name="edit" size={14} />
                  <span>Report issue</span>
                </div>
                <Icon name="arrow-up-right" size={12} className="command-arrow" />
              </button>
            </div>
          )}

          <button
            type="button"
            className="eonpai-toggle-more-btn"
            onClick={() => setShowMoreActions((prev) => !prev)}
          >
            <span>{showMoreActions ? 'Show less' : 'More actions (2)'}</span>
            <Icon name={showMoreActions ? 'chevron' : 'chevron'} size={12} />
          </button>
        </nav>

        <div className="eonpai-utility-footer">
          <div className="eonpai-tip-box">
            <span className="eonpai-tip-label">Quick Tip</span>
            <p className="eonpai-tip-text">
              Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for a new line.
            </p>
          </div>
        </div>
      </aside>

      {/* Primary Conversation Panel */}
      <section className="eonpai-conversation-card" aria-label="EONPAI Conversation">
        {/* Restrained Single Workspace Header */}
        <header className="eonpai-chat-header">
          <div className="eonpai-identity-wrap">
            <div className="eonpai-avatar-badge">
              <Icon name="sparkle" size={15} />
            </div>
            <div className="eonpai-title-meta">
              <h2 className="eonpai-title">EONPAI</h2>
              <span className="eonpai-subtitle">Personal execution assistant</span>
            </div>
            <div className="eonpai-status-badge" title="AI Provider: Ollama (qwen3:4b)">
              <span className="eonpai-status-dot connected" />
              <span className="eonpai-status-text">Local · qwen3:4b</span>
            </div>
          </div>
          <button
            type="button"
            className="eonpai-new-chat-btn"
            onClick={handleClearChat}
            title="Start fresh conversation"
          >
            <Icon name="refresh" size={13} />
            <span>New Chat</span>
          </button>
        </header>

        {/* Scrollable Message Feed */}
        <div
          className="eonpai-chat-feed"
          ref={aiFeedRef}
          onScroll={handleChatScroll}
          tabIndex={0}
          role="region"
          aria-label="Message Feed"
        >
          <div className="eonpai-chat-content-wrap" ref={aiContentRef}>
            {/* Pending Controlled Actions Queue Banner */}
            {pendingActions.length > 0 && (
              <div className="eonpai-pending-banner">
                <div className="pending-banner-info">
                  <Icon name="shield" size={15} />
                  <span>
                    {pendingActions.length} Controlled Action{pendingActions.length > 1 ? 's' : ''} Awaiting Review
                  </span>
                </div>
              </div>
            )}

            {/* Pending Controlled Actions */}
            {pendingActions.map((act) => (
              <div key={act.actionId} className="ai-bubble assistant">
                <div className="ai-bubble-text">
                  <strong>Controlled Action Proposed:</strong> Awaiting your review and explicit approval.
                </div>
                <div className="ai-action-card">
                  <div className="ai-action-header">
                    <div className="ai-action-title-group">
                      <Icon name="shield" size={14} />
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

            {/* Main Chat Stream */}
            {chatMessages.map((msg, index) => (
              <div
                key={msg.id ?? index}
                className={`ai-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="ai-bubble-text">{msg.text}</div>

                {/* Controlled Action Proposal Card */}
                {msg.actionProposal && (
                  <div className="ai-action-card">
                    <div className="ai-action-header">
                      <div className="ai-action-title-group">
                        <Icon name="shield" size={14} />
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

                {/* Interactive Guided Tour Card */}
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
                      type="button"
                      className="ai-tutorial-btn"
                      onClick={() => handleStartTutorial(0)}
                    >
                      <span>Start interactive tour</span>
                      <Icon name="arrow-up-right" size={12} />
                    </button>
                  </div>
                )}

                {/* Bug Diagnostics Card */}
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

                {/* Suggested Daily Plan */}
                {msg.dailyPlan && (
                  <div className="ai-plan-card">
                    <div className="ai-plan-header">
                      <div className="ai-plan-title-group">
                        <Icon name="schedule" size={15} />
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
                            type="button"
                            className="ai-arm-sprint-btn"
                            onClick={() =>
                              handleArmMissionAsSession(item.missionTitle, item.durationMinutes)
                            }
                            title="Start as focus session"
                          >
                            <span>Start Focus</span>
                            <Icon name="play" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="ai-plan-actions-row">
                      <button
                        type="button"
                        className="ai-commit-plan-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitDailyPlan(msg.dailyPlan!, index, msg.suggestionId)
                        }
                      >
                        <Icon name="check" size={13} />
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

                {/* Structured Decomposition Cards - Refined per Section 16 */}
                {msg.missions && msg.missions.length > 0 && (
                  <div className="eonpai-tasks-block">
                    <div className="eonpai-tasks-header">
                      <div className="eonpai-tasks-title-group">
                        <Icon name="target" size={14} />
                        <span className="eonpai-tasks-title">Suggested Tasks</span>
                        <span className="eonpai-tasks-count">{msg.missions.length}</span>
                      </div>
                      <button
                        type="button"
                        className="eonpai-commit-all-btn"
                        disabled={msg.committing || msg.committed}
                        onClick={() =>
                          handleCommitChatSuggestion(msg.suggestionId ?? 0, index)
                        }
                      >
                        <Icon name="plus" size={12} />
                        <span>
                          {msg.committed
                            ? 'Tasks Added'
                            : msg.committing
                              ? 'Adding Tasks...'
                              : 'Add All Tasks'}
                        </span>
                      </button>
                    </div>

                    <div className="eonpai-tasks-list">
                      {msg.missions.map((m, mIdx) => (
                        <div key={mIdx} className="eonpai-task-row" role="group" aria-label={`Task: ${m.title}`}>
                          <div className="eonpai-task-idx">{mIdx + 1}</div>
                          <div className="eonpai-task-details">
                            <div className="eonpai-task-name">{m.title}</div>
                            {m.description && (
                              <div className="eonpai-task-sub">{m.description}</div>
                            )}
                          </div>
                          <div className="eonpai-task-meta">
                            <span className="eonpai-task-duration">{m.estimatedMinutes} min</span>
                            <button
                              type="button"
                              className="eonpai-task-add-btn"
                              disabled={msg.committing || msg.committed}
                              onClick={() =>
                                handleCommitChatSuggestion(msg.suggestionId ?? 0, index, m)
                              }
                              title="Add task to backlog"
                            >
                              <Icon name="plus" size={12} />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session Feedback Debrief Card */}
                {msg.debriefAnalysis && (
                  <div className="ai-debrief-card">
                    <div className="ai-debrief-header">
                      <div className="ai-debrief-title-group">
                        <Icon name="sparkle" size={14} />
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
                          <Icon name="target" size={12} />
                          <span>Pacing Review</span>
                        </div>
                        <p className="ai-debrief-text">{msg.debriefAnalysis.tacticalCritique}</p>
                      </div>
                    )}

                    {msg.debriefAnalysis.nextSprintRecommendation && (
                      <div className="ai-debrief-recommendation-box">
                        <div className="ai-debrief-recommendation-header">
                          <Icon name="zap" size={12} />
                          <span>Next Recommendation</span>
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
                                type="button"
                                className="ai-arm-sprint-btn"
                                onClick={() => handleRecoveryActionClick(opt)}
                                title={`Activate ${opt.label}`}
                              >
                                <span>Activate</span>
                                <Icon name="arrow-up-right" size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Session Interruption Recovery */}
                {msg.sessionRecovery && (
                  <div className="ai-recovery-card">
                    <div className="ai-recovery-header">
                      <div className="ai-recovery-title-group">
                        <Icon name="zap" size={15} />
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
                            type="button"
                            className="ai-arm-sprint-btn"
                            onClick={() => handleRecoveryActionClick(opt)}
                            title={`Activate ${opt.label}`}
                          >
                            <span>Activate</span>
                            <Icon name="arrow-up-right" size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {aiLoading && (
              <div className="ai-bubble assistant eonpai-thinking-bubble">
                <span className="thinking-dot-pulse" />
                <span>EONPAI is formulating a response...</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollBottomBtn && (
          <button
            type="button"
            className="ai-scroll-bottom-btn"
            onClick={handleScrollToBottom}
            aria-label="Jump to latest messages"
            title="Jump to latest"
          >
            ↓
          </button>
        )}

        {/* Fixed Modern Composer at Bottom */}
        <footer className="eonpai-composer">
          <div className="eonpai-composer-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              className="eonpai-composer-input"
              placeholder="Ask EONPAI to plan your day, decompose a goal, or review focus..."
              value={localInput}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={aiLoading}
              aria-label="Message to EONPAI"
            />
            <button
              type="button"
              className="eonpai-composer-send-btn"
              onClick={handleSend}
              disabled={aiLoading || !localInput.trim()}
              title="Send Message"
            >
              <span>Send</span>
              <Icon name="arrow-up-right" size={13} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
})
