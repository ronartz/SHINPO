export type TutorialStepDef = {
  id: string
  number: number
  title: string
  targetTab: string
  targetSelector: string
  fallbackSelector?: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  instruction: string
}

export const SHINPO_ONBOARDING_STEPS: TutorialStepDef[] = [
  {
    id: 'CREATE_GOAL', number: 1, title: 'Choose a goal', targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-goal'], button.btn-new-goal", fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom',
    instruction: 'The starter example is editable: edit it or create a goal for an outcome you want to reach.',
  },
  {
    id: 'CREATE_TASK', number: 2, title: 'Make it actionable', targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-task'], [data-tutorial='missions-queue']", fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom',
    instruction: 'The starter task example is editable: edit it or add a small task linked to your goal.',
  },
  {
    id: 'SCHEDULE', number: 3, title: 'Reserve focus time', targetTab: 'Schedule',
    targetSelector: "[data-tutorial='schedule-book-btn'], .schedule-btn-book", fallbackSelector: "[data-tutorial='nav-schedule']",
    placement: 'bottom',
    instruction: 'Book a Focus session for the task you want to work on.',
  },
  {
    id: 'FOCUS', number: 4, title: 'Start a focus session', targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='start-timer-btn'], .timer-card", fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top',
    instruction: 'Start your session when you’re ready. You can pause and resume at any time.',
  },
  {
    id: 'COMPLETE', number: 5, title: 'Close the loop', targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='complete-session-btn'], [data-tutorial='completed-column']", fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top',
    instruction: 'Finish the session, note what you accomplished, and mark the linked task complete.',
  },
  {
    id: 'PROGRESS', number: 6, title: 'See your progress', targetTab: 'Analytics',
    targetSelector: "[data-tutorial='metric-completion'], [data-tutorial='profile-badge-card']", fallbackSelector: "[data-tutorial='nav-analytics']",
    placement: 'bottom',
    instruction: 'Review your completed work and Focus time here. Replay this walkthrough from EONPAI.',
  },
]
