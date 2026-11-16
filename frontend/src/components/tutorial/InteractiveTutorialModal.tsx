import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import {
  TUTORIAL_STAGES,
  SAMPLE_GOAL_CHOICES,
  type TutorialStageDef,
  type SimulatedGuardianMode,
} from './interactiveTutorialTypes'

export interface InteractiveTutorialModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (data: {
    goalTitle: string
    objectiveTitle: string
    taskTitle: string
    taskDuration: number
    taskPriority: 'HIGH' | 'MEDIUM' | 'LOW'
    scheduledDay: string
    scheduledTimeSlot: string
    saveToWorkspace: boolean
  }) => void
  userId?: number | null
}

const STAGE_COORDS = [
  { x: 50, y: 32 },
  { x: 150, y: 20 },
  { x: 250, y: 44 },
  { x: 350, y: 20 },
  { x: 450, y: 44 },
  { x: 550, y: 20 },
  { x: 650, y: 32 },
] as const

const JOURNEY_PATH_D =
  'M 50,32 C 100,16 100,16 150,20 C 200,24 200,48 250,44 C 300,40 300,16 350,20 C 400,24 400,48 450,44 C 500,40 500,16 550,20 C 600,24 600,32 650,32'

export const InteractiveTutorialModal: React.FC<InteractiveTutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStage, setCurrentStage] = useState<number>(1)
  const [maxVisitedStage, setMaxVisitedStage] = useState<number>(1)

  // Stage 1: Direction
  const [selectedGoalId, setSelectedGoalId] = useState<string>('product-beta')
  const [selectedGoalTitle, setSelectedGoalTitle] = useState<string>(SAMPLE_GOAL_CHOICES[0].title)
  const [customGoalText, setCustomGoalText] = useState<string>('')

  // Stage 2: Breakdown
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('actionable')
  const [selectedObjectiveText, setSelectedObjectiveText] = useState<string>(
    SAMPLE_GOAL_CHOICES[0].defaultObjective,
  )
  const [objectiveFeedback, setObjectiveFeedback] = useState<{
    isActionable: boolean
    message: string
  } | null>({
    isActionable: true,
    message: 'Actionable & Measurable! Clear criteria let you know exactly when you succeed and enable focused sprints.',
  })

  // Stage 3: Task
  const [taskTitle, setTaskTitle] = useState<string>('Run automated release verification suite')
  const [taskDuration, setTaskDuration] = useState<number>(25)
  const [taskPriority, setTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH')

  // Stage 4: Schedule
  const [scheduledDay, setScheduledDay] = useState<string>('Today')
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>('09:00 - 09:45')

  // Stage 5: Guardian
  const [guardianMode, setGuardianMode] = useState<SimulatedGuardianMode>('STANDARD')
  const [simulatedAppPolicy, setSimulatedAppPolicy] = useState<'BLOCKED' | 'ALLOWED'>('BLOCKED')

  // Stage 6: Focus Demo
  const [timerDemoState, setTimerDemoState] = useState<'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED'>('IDLE')
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number>(10)

  // Stage 7: Review
  const [saveGoalToWorkspace, setSaveGoalToWorkspace] = useState<boolean>(true)

  const surfaceRef = useRef<HTMLDivElement>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)

  // Track max stage visited so user can click back along the path
  useEffect(() => {
    if (currentStage > maxVisitedStage) {
      const timer = setTimeout(() => {
        setMaxVisitedStage(currentStage)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [currentStage, maxVisitedStage])

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setCurrentStage(1)
        setMaxVisitedStage(1)
        setTimerDemoState('IDLE')
        setTimerRemainingSeconds(10)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Accelerated demo timer countdown logic (Stage 6)
  useEffect(() => {
    let timerId: ReturnType<typeof setInterval> | null = null

    if (timerDemoState === 'RUNNING') {
      timerId = setInterval(() => {
        setTimerRemainingSeconds((prev) => {
          if (prev <= 1) {
            setTimerDemoState('FINISHED')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerId) clearInterval(timerId)
    }
  }, [timerDemoState])

  // Accessibility: Focus trap & Escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        if (!surfaceRef.current) return
        const focusableElements = surfaceRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusableElements.length === 0) return

        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Update objectives when goal changes
  const handleSelectSampleGoal = (choice: (typeof SAMPLE_GOAL_CHOICES)[number]) => {
    setSelectedGoalId(choice.id)
    setSelectedGoalTitle(choice.title)
    setCustomGoalText('')
    setSelectedObjectiveId('actionable')
    setSelectedObjectiveText(choice.defaultObjective)
    setTaskTitle(`Execute: ${choice.defaultObjective}`)
    setObjectiveFeedback({
      isActionable: true,
      message: 'Actionable & Measurable! Clear criteria let you know exactly when you succeed and enable focused sprints.',
    })
  }

  const handleCustomGoalChange = (text: string) => {
    setSelectedGoalId('custom')
    setSelectedGoalTitle(text)
    setCustomGoalText(text)
    if (text.trim().length > 0) {
      setSelectedObjectiveText(`Define concrete milestones for "${text.trim()}"`)
      setTaskTitle(`Complete first milestone for: ${text.trim()}`)
    }
  }

  // Objective candidates for Stage 2
  const objectiveOptions = [
    {
      id: 'actionable',
      text: selectedObjectiveText || 'Pass all 5 automated release verification gates',
      isActionable: true,
      explanation: 'Actionable & Measurable! Concrete criteria let you know exactly when you succeed.',
    },
    {
      id: 'vague',
      text: 'Make sure things look and feel pretty good',
      isActionable: false,
      explanation: 'Too vague. Without a clear definition of done, focus sessions easily drift.',
    },
    {
      id: 'overly-broad',
      text: 'Eliminate every single possible bug in computer software forever',
      isActionable: false,
      explanation: 'Overly broad and unbounded. Scope must be realistically achievable in 1–3 sprints.',
    },
  ]

  const handleSelectObjective = (opt: (typeof objectiveOptions)[0]) => {
    setSelectedObjectiveId(opt.id)
    if (opt.isActionable) {
      setSelectedObjectiveText(opt.text)
      setObjectiveFeedback({
        isActionable: true,
        message: '✓ Actionable & Measurable! Clear criteria let you know exactly when you succeed.',
      })
    } else {
      setObjectiveFeedback({
        isActionable: false,
        message: `⚠ ${opt.explanation}`,
      })
    }
  }

  const canProceedFromCurrentStage = (): boolean => {
    switch (currentStage) {
      case 1:
        return selectedGoalTitle.trim().length > 0
      case 2:
        return selectedObjectiveId === 'actionable'
      case 3:
        return taskTitle.trim().length > 0
      case 4:
        return scheduledDay.length > 0 && scheduledTimeSlot.length > 0
      case 5:
        return true
      case 6:
        return true
      case 7:
        return true
      default:
        return true
    }
  }

  const handleNextStage = () => {
    if (currentStage < 7) {
      const next = currentStage + 1
      setCurrentStage(next)
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Stage ${next} of 7: ${TUTORIAL_STAGES[next - 1].title}`
      }
    } else {
      onComplete({
        goalTitle: selectedGoalTitle,
        objectiveTitle: selectedObjectiveText,
        taskTitle,
        taskDuration,
        taskPriority,
        scheduledDay,
        scheduledTimeSlot,
        saveToWorkspace: saveGoalToWorkspace,
      })
    }
  }

  const handlePrevStage = () => {
    if (currentStage > 1) {
      const prev = currentStage - 1
      setCurrentStage(prev)
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Stage ${prev} of 7: ${TUTORIAL_STAGES[prev - 1].title}`
      }
    }
  }

  const handleJumpToStage = (stageIndex: number) => {
    if (stageIndex <= maxVisitedStage) {
      setCurrentStage(stageIndex)
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Stage ${stageIndex} of 7: ${TUTORIAL_STAGES[stageIndex - 1].title}`
      }
    }
  }

  if (!isOpen) return null

  const activeStageDef: TutorialStageDef = TUTORIAL_STAGES[currentStage - 1]
  const progressPercent = ((currentStage - 1) / 6) * 100

  return (
    <div
      className="shinpo-tutorial-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={surfaceRef}
        className="shinpo-tutorial-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-stage-title"
        aria-describedby="tutorial-stage-subtitle"
      >
        {/* Invisible live region for screen reader stage announcements */}
        <div ref={liveRegionRef} className="sr-only" aria-live="polite" />

        {/* 1. Top Bar & Curved Journey Path */}
        <div className="tutorial-header">
          <div className="tutorial-top-bar">
            <div className="tutorial-eyebrow-group">
              <span className="tutorial-eyebrow-badge">Interactive Onboarding</span>
              <span className="tutorial-counter">
                Stage {currentStage} of 7
              </span>
            </div>
            <button
              type="button"
              className="tutorial-close-btn"
              onClick={onClose}
              aria-label="Skip and close tutorial"
              title="Close (Esc)"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          {/* Curved SVG Journey Path Rail */}
          <div className="tutorial-journey-rail" aria-hidden="true">
            <svg
              className="tutorial-journey-svg"
              viewBox="0 0 720 64"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background Path */}
              <path d={JOURNEY_PATH_D} className="journey-path-background" />

              {/* Active Animated Progress Stroke */}
              <path
                d={JOURNEY_PATH_D}
                className="journey-path-progress"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - progressPercent}
              />

              {/* 7 Interactive Nodes */}
              {TUTORIAL_STAGES.map((st, i) => {
                const coord = STAGE_COORDS[i]
                const isCompleted = st.index < currentStage
                const isActive = st.index === currentStage
                const isClickable = st.index <= maxVisitedStage

                return (
                  <g
                    key={st.id}
                    className={`journey-node ${isCompleted ? 'is-completed' : ''} ${
                      isActive ? 'is-active' : ''
                    }`}
                    onClick={() => isClickable && handleJumpToStage(st.index)}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    tabIndex={isClickable ? 0 : -1}
                    role="button"
                    aria-label={`Stage ${st.index}: ${st.title} ${
                      isCompleted ? '(Completed)' : isActive ? '(Current)' : ''
                    }`}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleJumpToStage(st.index)
                      }
                    }}
                  >
                    <circle cx={coord.x} cy={coord.y} r="14" className="journey-node-circle" />
                    <text x={coord.x} y={coord.y} className="journey-node-text">
                      {isCompleted ? '✓' : st.index}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="tutorial-body">
          <div className="stage-header">
            <div className="workflow-chain-indicator">
              <span>Goal</span>
              <span className="workflow-chain-arrow">→</span>
              <span>Objective</span>
              <span className="workflow-chain-arrow">→</span>
              <span>Task</span>
              <span className="workflow-chain-arrow">→</span>
              <span>Focus</span>
            </div>
            <h2 id="tutorial-stage-title" className="stage-title">
              {activeStageDef.title}
            </h2>
            <p id="tutorial-stage-subtitle" className="stage-subtitle">
              {activeStageDef.subtitle}
            </p>
          </div>

          {/* STAGE 1: Define your direction */}
          {currentStage === 1 && (
            <div className="interactive-exercise-card">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary, #94a3b8)' }}>
                Select an ambitious direction or define your own:
              </span>
              <div className="options-grid">
                {SAMPLE_GOAL_CHOICES.map((choice) => {
                  const isSelected = selectedGoalId === choice.id
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={`choice-card-btn ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectSampleGoal(choice)}
                    >
                      <span className="choice-card-category">{choice.category}</span>
                      <span className="choice-card-title">{choice.title}</span>
                      <span className="choice-card-desc">{choice.description}</span>
                    </button>
                  )
                })}
              </div>

              <div className="custom-input-box">
                <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--color-text-secondary, #94a3b8)' }}>
                  Or enter a custom goal:
                </span>
                <input
                  type="text"
                  className="custom-text-input"
                  placeholder="e.g. Ship v1.0 Production Release by Friday"
                  value={customGoalText}
                  onChange={(e) => handleCustomGoalChange(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STAGE 2: Break it down */}
          {currentStage === 2 && (
            <div className="interactive-exercise-card">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary, #94a3b8)' }}>
                For goal: <strong style={{ color: 'var(--brand-primary, #7c3aed)' }}>{selectedGoalTitle}</strong>
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #94a3b8)' }}>
                Choose the most actionable, measurable objective to unlock progress:
              </span>

              <div className="options-grid" style={{ gridTemplateColumns: '1fr' }}>
                {objectiveOptions.map((opt) => {
                  const isSelected = selectedObjectiveId === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`choice-card-btn ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectObjective(opt)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name={opt.isActionable ? 'check-circle' : 'target'} size={15} />
                        <span className="choice-card-title">{opt.text}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {objectiveFeedback && (
                <div
                  className={`objective-feedback-box ${
                    objectiveFeedback.isActionable ? 'is-actionable' : 'is-vague'
                  }`}
                >
                  <Icon name={objectiveFeedback.isActionable ? 'check' : 'bell'} size={16} />
                  <span>{objectiveFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: Plan a task */}
          {currentStage === 3 && (
            <div className="interactive-exercise-card">
              <div className="task-planner-simulation">
                {/* Form Controls */}
                <div className="task-form-panel">
                  <div className="task-field-group">
                    <label className="task-field-label" htmlFor="tutorial-task-title">
                      Task Title
                    </label>
                    <input
                      id="tutorial-task-title"
                      type="text"
                      className="custom-text-input"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                    />
                  </div>

                  <div className="task-field-group">
                    <span className="task-field-label">Duration</span>
                    <div className="pill-selector-row">
                      {[15, 25, 45, 60].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          className={`selector-pill-btn ${taskDuration === mins ? 'is-active' : ''}`}
                          onClick={() => setTaskDuration(mins)}
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="task-field-group">
                    <span className="task-field-label">Priority</span>
                    <div className="pill-selector-row">
                      {(['HIGH', 'MEDIUM', 'LOW'] as const).map((pri) => (
                        <button
                          key={pri}
                          type="button"
                          className={`selector-pill-btn ${taskPriority === pri ? 'is-active' : ''}`}
                          onClick={() => setTaskPriority(pri)}
                        >
                          {pri}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Simulated Task Card Live Preview */}
                <div className="task-preview-panel">
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary, #94a3b8)', marginBottom: 8 }}>
                    Live Preview
                  </span>
                  <div className="simulated-task-card">
                    <div className="simulated-task-badges">
                      <span className={`simulated-priority-tag p-${taskPriority.toLowerCase()}`}>
                        {taskPriority}
                      </span>
                      <span className="simulated-duration-pill">
                        <Icon name="clock" size={13} />
                        {taskDuration} mins
                      </span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 750, color: 'var(--color-text-primary, #ffffff)' }}>
                      {taskTitle || 'Untitled Task'}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--brand-primary, #7c3aed)' }}>
                      Goal: {selectedGoalTitle}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: Schedule your work */}
          {currentStage === 4 && (
            <div className="interactive-exercise-card">
              <div className="calendar-simulation-box">
                <div>
                  <span className="task-field-label" style={{ display: 'block', marginBottom: 8 }}>
                    Select Day
                  </span>
                  <div className="pill-selector-row">
                    {['Today', 'Tomorrow', 'Saturday'].map((day) => (
                      <button
                        key={day}
                        type="button"
                        className={`selector-pill-btn ${scheduledDay === day ? 'is-active' : ''}`}
                        onClick={() => setScheduledDay(day)}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="task-field-label" style={{ display: 'block', marginBottom: 8 }}>
                    Select Suggested Focus Slot
                  </span>
                  <div className="calendar-slot-grid">
                    {['09:00 - 09:45', '14:00 - 14:45', '16:30 - 17:15'].map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`calendar-slot-btn ${scheduledTimeSlot === slot ? 'is-active' : ''}`}
                        onClick={() => setScheduledTimeSlot(slot)}
                      >
                        <Icon name="calendar" size={14} />
                        <span>{slot}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulated Timeline Track Preview */}
                <div>
                  <span className="task-field-label" style={{ display: 'block', marginBottom: 8 }}>
                    Timeline Placement Preview ({scheduledDay})
                  </span>
                  <div className="timeline-track-preview">
                    <span className="timeline-hour-gutter">
                      {scheduledTimeSlot.split(' - ')[0]}
                    </span>
                    <div className="timeline-focus-block">
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 750 }}>
                          {taskTitle}
                        </span>
                        <span style={{ fontSize: '11px', opacity: 0.85 }}>
                          Reserved Focus Block • {taskDuration}m
                        </span>
                      </div>
                      <Icon name="focus" size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: Meet Guardian */}
          {currentStage === 5 && (
            <div className="interactive-exercise-card">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary, #94a3b8)' }}>
                Guardian monitors distraction without modifying user data. Select your preferred posture:
              </span>

              <div className="guardian-modes-grid">
                {[
                  {
                    id: 'LIGHT' as const,
                    name: 'Light Mode',
                    badge: 'Observer',
                    desc: 'Background telemetry. Logs distraction frequency and provides gentle reminders without interruption.',
                  },
                  {
                    id: 'STANDARD' as const,
                    name: 'Standard Mode',
                    badge: 'Guardrail',
                    desc: 'Active desktop window detection. Displays non-intrusive warnings when prohibited software steals attention.',
                  },
                  {
                    id: 'STRICT' as const,
                    name: 'Strict Mode',
                    badge: 'Enforcer',
                    desc: 'High-discipline focus lock. Actively prompts to close distracting processes during deep work sprints.',
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`guardian-mode-card ${guardianMode === mode.id ? 'is-active' : ''}`}
                    onClick={() => setGuardianMode(mode.id)}
                  >
                    <div className="guardian-mode-header">
                      <Icon name="shield" size={15} />
                      <span>{mode.name}</span>
                    </div>
                    <span className="guardian-mode-desc">{mode.desc}</span>
                  </button>
                ))}
              </div>

              {/* Sample Policy Toggle */}
              <div className="simulated-rule-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon name="apps" size={16} />
                  <div>
                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 750 }}>
                      Discord / Social Messaging
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #94a3b8)' }}>
                      Simulated application policy during Focus sprint
                    </span>
                  </div>
                </div>
                <div className="rule-toggle-buttons">
                  <button
                    type="button"
                    className={`rule-pill-btn ${simulatedAppPolicy === 'BLOCKED' ? 'is-blocked' : ''}`}
                    onClick={() => setSimulatedAppPolicy('BLOCKED')}
                  >
                    Blocked
                  </button>
                  <button
                    type="button"
                    className={`rule-pill-btn ${simulatedAppPolicy === 'ALLOWED' ? 'is-allowed' : ''}`}
                    onClick={() => setSimulatedAppPolicy('ALLOWED')}
                  >
                    Allowed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 6: Try the Focus Engine */}
          {currentStage === 6 && (
            <div className="interactive-exercise-card">
              <div className="timer-simulation-card">
                <span className="demo-timer-status">
                  {timerDemoState === 'IDLE' && 'Ready to Sprint (Accelerated Demo)'}
                  {timerDemoState === 'RUNNING' && 'Focusing... (10x Speed Demo)'}
                  {timerDemoState === 'PAUSED' && 'Sprint Paused'}
                  {timerDemoState === 'FINISHED' && 'Sprint Complete! Reflection Saved ✓'}
                </span>

                <div className="demo-timer-clock">
                  00:{timerRemainingSeconds.toString().padStart(2, '0')}
                </div>

                <div className="demo-timer-controls">
                  {timerDemoState === 'IDLE' && (
                    <button
                      type="button"
                      className="demo-action-btn btn-play"
                      onClick={() => setTimerDemoState('RUNNING')}
                    >
                      <Icon name="play" size={15} />
                      <span>Start Demo Sprint</span>
                    </button>
                  )}

                  {timerDemoState === 'RUNNING' && (
                    <>
                      <button
                        type="button"
                        className="demo-action-btn btn-pause"
                        onClick={() => setTimerDemoState('PAUSED')}
                      >
                        <Icon name="pause" size={15} />
                        <span>Pause</span>
                      </button>
                      <button
                        type="button"
                        className="demo-action-btn btn-complete"
                        onClick={() => {
                          setTimerDemoState('FINISHED')
                          setTimerRemainingSeconds(0)
                        }}
                      >
                        <Icon name="check" size={15} />
                        <span>Finish Early</span>
                      </button>
                    </>
                  )}

                  {timerDemoState === 'PAUSED' && (
                    <>
                      <button
                        type="button"
                        className="demo-action-btn btn-play"
                        onClick={() => setTimerDemoState('RUNNING')}
                      >
                        <Icon name="play" size={15} />
                        <span>Resume</span>
                      </button>
                      <button
                        type="button"
                        className="demo-action-btn btn-complete"
                        onClick={() => {
                          setTimerDemoState('FINISHED')
                          setTimerRemainingSeconds(0)
                        }}
                      >
                        <Icon name="check" size={15} />
                        <span>Finish Early</span>
                      </button>
                    </>
                  )}

                  {timerDemoState === 'FINISHED' && (
                    <button
                      type="button"
                      className="demo-action-btn btn-play"
                      onClick={() => {
                        setTimerRemainingSeconds(10)
                        setTimerDemoState('RUNNING')
                      }}
                    >
                      <Icon name="refresh" size={15} />
                      <span>Re-run Demo</span>
                    </button>
                  )}
                </div>

                <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #94a3b8)', textAlign: 'center', marginTop: 8 }}>
                  Isolated demo simulation: No dummy records or minutes are committed to your real encrypted database.
                </span>
              </div>
            </div>
          )}

          {/* STAGE 7: Review your work */}
          {currentStage === 7 && (
            <div className="interactive-exercise-card">
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary, #94a3b8)' }}>
                Your complete productivity loop is assembled and ready:
              </span>

              <div className="complete-loop-grid">
                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="goals" size={14} />
                    <span>Goal</span>
                  </div>
                  <span className="loop-feature-detail">{selectedGoalTitle}</span>
                </div>

                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="target" size={14} />
                    <span>Objective</span>
                  </div>
                  <span className="loop-feature-detail">{selectedObjectiveText}</span>
                </div>

                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="clock" size={14} />
                    <span>Planned Task</span>
                  </div>
                  <span className="loop-feature-detail">
                    {taskTitle} ({taskDuration}m, {taskPriority})
                  </span>
                </div>

                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="calendar" size={14} />
                    <span>Schedule</span>
                  </div>
                  <span className="loop-feature-detail">
                    {scheduledDay} at {scheduledTimeSlot}
                  </span>
                </div>

                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="shield" size={14} />
                    <span>Guardian Protection</span>
                  </div>
                  <span className="loop-feature-detail">
                    {guardianMode} Mode ({simulatedAppPolicy} for social apps)
                  </span>
                </div>

                <div className="loop-feature-card">
                  <div className="loop-feature-header">
                    <Icon name="analytics" size={14} />
                    <span>Analytics Impact</span>
                  </div>
                  <span className="loop-feature-detail">
                    +1 Focus Sprint • +{taskDuration}m Deep Work • 100% Velocity
                  </span>
                </div>
              </div>

              {/* Seed Goal Checkbox */}
              <label className="workspace-seed-option">
                <input
                  type="checkbox"
                  checked={saveGoalToWorkspace}
                  onChange={(e) => setSaveGoalToWorkspace(e.target.checked)}
                />
                <span>
                  Add this goal and task to my real workspace so I can start right away.
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 3. Footer Navigation Bar */}
        <div className="tutorial-footer">
          <button
            type="button"
            className="btn-tutorial-skip"
            onClick={onClose}
          >
            Skip Tutorial
          </button>

          <div className="tutorial-nav-buttons">
            {currentStage > 1 && (
              <button
                type="button"
                className="btn-tutorial-back"
                onClick={handlePrevStage}
              >
                Back
              </button>
            )}

            <button
              type="button"
              className="btn-tutorial-primary"
              disabled={!canProceedFromCurrentStage()}
              onClick={handleNextStage}
            >
              <span>{currentStage === 7 ? 'Open my workspace' : 'Next Stage'}</span>
              <Icon name={currentStage === 7 ? 'check' : 'chevron-right'} size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
