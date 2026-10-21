export type TutorialStepDef = {
  id: string
  number: number
  title: string
  targetTab: string
  targetSelector: string
  fallbackSelector?: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  eonpaiDialogue: string
  instruction: string
  whyItMatters: string
  completionCondition: string
}

export const SHINPO_ONBOARDING_STEPS: TutorialStepDef[] = [
  {
    id: 'CREATE_GOAL', number: 1, title: 'Choose a goal', targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-goal'], button.btn-new-goal", fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom', eonpaiDialogue: 'Start with an outcome that matters to you.',
    instruction: 'Create a goal; you can finish this guide before doing the work.',
    whyItMatters: 'A clear goal gives your work direction.', completionCondition: 'GOAL',
  },
  {
    id: 'CREATE_TASK', number: 2, title: 'Make it actionable', targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-task'], [data-tutorial='missions-queue']", fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom', eonpaiDialogue: 'Turn the goal into a small next action.',
    instruction: 'Add a task and link it to your goal.',
    whyItMatters: 'A concrete task is easier to start.', completionCondition: 'TASK',
  },
  {
    id: 'SCHEDULE', number: 3, title: 'Reserve focus time', targetTab: 'Schedule',
    targetSelector: "[data-tutorial='schedule-book-btn'], .schedule-btn-book", fallbackSelector: "[data-tutorial='nav-schedule']",
    placement: 'bottom', eonpaiDialogue: 'Give the task a place in your day.',
    instruction: 'Schedule a focus session linked to that task.',
    whyItMatters: 'A time reservation makes your intention visible.', completionCondition: 'SCHEDULE',
  },
  {
    id: 'FOCUS', number: 4, title: 'Start a focus sprint', targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='start-timer-btn'], .timer-card", fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top', eonpaiDialogue: 'When you are ready, start the scheduled session.',
    instruction: 'Use the session controls to begin, pause, or resume focus.',
    whyItMatters: 'SHINPO records your session and keeps your task connected.', completionCondition: 'FOCUS',
  },
  {
    id: 'COMPLETE', number: 5, title: 'Close the loop', targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='complete-session-btn'], [data-tutorial='completed-column']", fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top', eonpaiDialogue: 'Finish the work, then record the result.',
    instruction: 'Complete your task and add a short session reflection.',
    whyItMatters: 'Completion history makes your progress trustworthy.', completionCondition: 'COMPLETE',
  },
  {
    id: 'PROGRESS', number: 6, title: 'See your progress', targetTab: 'Analytics',
    targetSelector: "[data-tutorial='metric-completion'], [data-tutorial='profile-badge-card']", fallbackSelector: "[data-tutorial='nav-analytics']",
    placement: 'bottom', eonpaiDialogue: 'Your dashboard and analytics reflect the work you log.',
    instruction: 'Review your progress; replay this tour any time from EONPAI.',
    whyItMatters: 'Useful feedback helps you plan the next realistic step.', completionCondition: 'PROGRESS',
  },
]
