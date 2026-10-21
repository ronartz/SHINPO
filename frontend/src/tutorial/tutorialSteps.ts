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
    id: 'WELCOME_DASHBOARD',
    number: 1,
    title: 'Execution Cockpit',
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='cockpit-priority'], [aria-label=\"Today's Priority\"]",
    fallbackSelector: "[data-tutorial='nav-dashboard']",
    placement: 'bottom',
    eonpaiDialogue:
      'Your daily execution command center. Your top priority and schedule are front and center.',
    instruction: 'Choose your top priority or click Next to explore strategic goals.',
    whyItMatters: 'Clear priorities eliminate decision fatigue before starting work.',
    completionCondition: 'DASHBOARD_REVIEWED',
  },
  {
    id: 'CREATE_GOAL',
    number: 2,
    title: 'Create a Goal',
    targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='new-goal'], .btn-timer.primary[data-tutorial='new-goal'], button.btn-new-goal",
    fallbackSelector: "[data-tutorial='nav-goals']",
    placement: 'bottom',
    eonpaiDialogue:
      'What outcome do you want to achieve? Every sprint starts with a clear target.',
    instruction: 'Click "+ New Goal" to name an objective, or select a practice goal.',
    whyItMatters: 'Strategic goals give purpose to your daily focus sprints.',
    completionCondition: 'GOAL_EXPLORED',
  },
  {
    id: 'DECONSTRUCT_GOAL',
    number: 3,
    title: 'Break It Down',
    targetTab: 'Goals & Missions',
    targetSelector: "[data-tutorial='decompose-goal'], [data-tutorial='missions-queue'], [data-tutorial='new-task']",
    fallbackSelector: "[data-tutorial='new-goal']",
    placement: 'bottom',
    eonpaiDialogue:
      'Big goals become approachable when decomposed into concrete 15-to-45-minute actionable tasks.',
    instruction: 'Notice how tasks link directly to their parent goal with time estimates.',
    whyItMatters: 'Actionable tasks prevent procrastination by showing your immediate next move.',
    completionCondition: 'TASKS_EXPLORED',
  },
  {
    id: 'SCHEDULE_COMMITMENT',
    number: 4,
    title: 'Schedule Your Time',
    targetTab: 'Schedule',
    targetSelector: "[data-tutorial='schedule-book-btn'], .schedule-btn-book, .schedule-week-strip",
    fallbackSelector: "[data-tutorial='nav-schedule']",
    placement: 'bottom',
    eonpaiDialogue:
      'Unscheduled intentions rarely happen. Timebox dedicated focus blocks onto your calendar.',
    instruction: 'Review your timeline where focus sessions are arranged without conflicts.',
    whyItMatters: 'Proactive scheduling defends your attention before external distractions claim it.',
    completionCondition: 'SCHEDULE_EXPLORED',
  },
  {
    id: 'TODAYS_SCHEDULE',
    number: 5,
    title: "Today's Schedule",
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='todays-schedule-card'], [aria-label=\"Today's Schedule\"]",
    fallbackSelector: "[data-tutorial='nav-dashboard']",
    placement: 'left',
    eonpaiDialogue:
      'Scheduled focus blocks appear in your dashboard queue ready to launch with one click.',
    instruction: 'Review your planned focus blocks with clear status badges and clean spacing.',
    whyItMatters: 'Zero ambiguity about what you should execute next today.',
    completionCondition: 'QUEUE_REVIEWED',
  },
  {
    id: 'FOCUS_CONTROLS',
    number: 6,
    title: 'Start Deep Work',
    targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='start-timer-btn'], .timer-card, .btn-timer.primary",
    fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'top',
    eonpaiDialogue:
      'This is your focus arena. Select your sprint duration and begin uninterrupted flow.',
    instruction: 'Choose a sprint duration (15m, 25m, 45m, 60m) to lock your focus.',
    whyItMatters: 'Timeboxed sprints leverage momentum and prevent mid-task distractions.',
    completionCondition: 'TIMER_EXPLORED',
  },
  {
    id: 'FOCUS_PROTECTION',
    number: 7,
    title: 'Shield Distractions',
    targetTab: 'Task Manager',
    targetSelector: "[data-tutorial='sentinel-status-card'], .tm-controls-card",
    fallbackSelector: "[data-tutorial='nav-task-manager']",
    placement: 'bottom',
    eonpaiDialogue:
      'Sentinel protects your focus locally by monitoring and containing distracting applications.',
    instruction: 'Select your protection level: Monitoring Only, Balanced, or Strict containment.',
    whyItMatters: 'System-level guardrails defend your attention without ongoing willpower drain.',
    completionCondition: 'PROTECTION_REVIEWED',
  },
  {
    id: 'STUDY_RESOURCES',
    number: 8,
    title: 'Study Resources',
    targetTab: 'Focus Engine',
    targetSelector: "[data-tutorial='study-resources-panel'], .study-resources-panel",
    fallbackSelector: "[data-tutorial='nav-focus']",
    placement: 'left',
    eonpaiDialogue:
      'Need API docs or research? Whitelist approved links so your workflow stays unblocked.',
    instruction: 'Add approved documentation links to keep reference materials easily accessible.',
    whyItMatters: 'Essential reference materials remain available while social feeds stay blocked.',
    completionCondition: 'RESOURCES_EXPLORED',
  },
  {
    id: 'SESSION_REFLECTION',
    number: 9,
    title: 'Log Reflection',
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='completed-column'], [data-tutorial='metric-completion'], [aria-label=\"Today's Priority\"]",
    fallbackSelector: "[data-tutorial='nav-dashboard']",
    placement: 'left',
    eonpaiDialogue:
      'When your sprint ends, rate your focus quality and jot a quick note.',
    instruction: 'Log a 1-to-5 star quality score to track your focus calibration.',
    whyItMatters: 'Deliberate reflection turns completed sessions into compound personal mastery.',
    completionCondition: 'REFLECTION_EXPLORED',
  },
  {
    id: 'REWARDS_PROGRESSION',
    number: 10,
    title: 'Earn Progress',
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='profile-badge-card'], .profile-badge-card",
    fallbackSelector: "[data-tutorial='nav-dashboard']",
    placement: 'bottom',
    eonpaiDialogue:
      'Every verified task (+10 XP) and focus session (+15 XP) builds your mastery level.',
    instruction: 'Review your experience points and tier progress toward Master of Flow.',
    whyItMatters: 'Truthful reward accounting celebrates real accomplishments, never busywork.',
    completionCondition: 'REWARDS_REVIEWED',
  },
  {
    id: 'EONPAI_ASSISTANT',
    number: 11,
    title: 'Ask EONPAI',
    targetTab: 'AI Assistant',
    targetSelector: "[data-tutorial='eonpai-composer'], .eonpai-composer",
    fallbackSelector: "[data-tutorial='nav-ai']",
    placement: 'top',
    eonpaiDialogue:
      'Feeling stuck? Ask EONPAI to break down tasks or suggest a brief reset.',
    instruction: 'Type a planning question or click a preset prompt for instant guidance.',
    whyItMatters: 'An intelligent guide helps break through friction whenever motivation dips.',
    completionCondition: 'EONPAI_EXPLORED',
  },
  {
    id: 'SETTINGS_PREFERENCES',
    number: 12,
    title: 'Workstation Ready',
    targetTab: 'Dashboard',
    targetSelector: "[data-tutorial='topbar-settings-btn'], button[aria-label='Settings']",
    fallbackSelector: "[data-tutorial='nav-dashboard']",
    placement: 'bottom',
    eonpaiDialogue:
      'Your execution workstation is calibrated and ready. Finish onboarding to begin executing.',
    instruction: 'Click "Finish Tour" to claim your +50 XP completion certification reward.',
    whyItMatters: 'You now know the complete loop from strategic goal to finished sprint.',
    completionCondition: 'TOUR_FINISHED',
  },
]
