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
  completionCondition: string
}

export const SHINPO_ONBOARDING_STEPS: TutorialStepDef[] = [
  {
    id: 'CREATE_GOAL',
    number: 1,
    title: 'Create a goal',
    targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-goal']",
    fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom',
    eonpaiDialogue: 'Create your first goal.',
    instruction: "Click '+ New Strategic Goal' to create a goal.",
    completionCondition: 'GOAL_CREATED',
  },
  {
    id: 'DECONSTRUCT_GOAL',
    number: 2,
    title: 'Add missions',
    targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='decompose-goal']",
    fallbackSelector: "[data-tutorial='new-goal']",
    placement: 'bottom',
    eonpaiDialogue: 'Break the goal into actionable missions.',
    instruction: "Click 'Deconstruct' on your goal.",
    completionCondition: 'GOAL_DECONSTRUCTED',
  },
  {
    id: 'OPEN_SCHEDULE',
    number: 3,
    title: 'Schedule your work',
    targetTab: 'Schedule',
    targetSelector: "[data-tutorial='nav-schedule']",
    fallbackSelector: "[data-tutorial='schedule-book-btn']",
    placement: 'right',
    eonpaiDialogue: 'Schedule a focus session here.',
    instruction: "Click 'Calendar' in the sidebar.",
    completionCondition: 'NAVIGATED_SCHEDULE',
  },
  {
    id: 'FOCUS_CONTROLS',
    number: 4,
    title: 'Start a focus session',
    targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='start-timer-btn']",
    fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top',
    eonpaiDialogue: 'Run your sprint with distraction blocking.',
    instruction: "Click 'Engage 30m Sprint' to begin.",
    completionCondition: 'FOCUS_STARTED',
  },
  {
    id: 'VIEW_ANALYTICS',
    number: 5,
    title: 'Review your result',
    targetTab: 'Analytics',
    targetSelector: "[data-tutorial='nav-analytics']",
    placement: 'right',
    eonpaiDialogue: 'Review your session completion results.',
    instruction: "Click 'Analytics' to inspect your session data.",
    completionCondition: 'VIEW_ANALYTICS',
  },
  {
    id: 'CHECK_PROGRESS',
    number: 6,
    title: 'Check your progress',
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='nav-dashboard']",
    placement: 'right',
    eonpaiDialogue: 'Track your streak, XP, and velocity.',
    instruction: "Return to Dashboard to view your execution loop.",
    completionCondition: 'TOUR_FINISHED',
  },
]
