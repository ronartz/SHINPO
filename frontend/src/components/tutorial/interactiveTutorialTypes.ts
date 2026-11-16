export type TutorialStageId =
  | 'DIRECTION'
  | 'BREAKDOWN'
  | 'TASK'
  | 'SCHEDULE'
  | 'GUARDIAN'
  | 'FOCUS'
  | 'REVIEW'

export interface TutorialStageDef {
  id: TutorialStageId
  index: number
  title: string
  subtitle: string
  badge: string
}

export const TUTORIAL_STAGES: readonly TutorialStageDef[] = [
  { id: 'DIRECTION', index: 1, title: 'Define your direction', subtitle: 'Turn high-level ambitions into a structured goal', badge: 'Goal' },
  { id: 'BREAKDOWN', index: 2, title: 'Break it down', subtitle: 'Extract actionable, measurable objectives', badge: 'Objective' },
  { id: 'TASK', index: 3, title: 'Plan a task', subtitle: 'Define a concrete execution block with duration and priority', badge: 'Task' },
  { id: 'SCHEDULE', index: 4, title: 'Schedule your work', subtitle: 'Reserve dedicated Focus time on your timeline', badge: 'Calendar' },
  { id: 'GUARDIAN', index: 5, title: 'Meet Guardian', subtitle: 'Configure distraction observation and protection policies', badge: 'Guardian' },
  { id: 'FOCUS', index: 6, title: 'Try the Focus Engine', subtitle: 'Experience the authoritative countdown timer and reflection loop', badge: 'Focus' },
  { id: 'REVIEW', index: 7, title: 'Review your work', subtitle: 'Connect the complete loop: Goal → Task → Focus → Analytics', badge: 'Complete' },
] as const

export interface SampleGoalChoice {
  id: string
  title: string
  category: string
  description: string
  defaultObjective: string
}

export const SAMPLE_GOAL_CHOICES: readonly SampleGoalChoice[] = [
  {
    id: 'product-beta',
    title: 'Launch SHINPO Private Beta V1.0',
    category: 'Product Delivery',
    description: 'Stabilize release gates, harden vault encryption, and onboard first 50 users.',
    defaultObjective: 'Pass all 5 automated release verification gates',
  },
  {
    id: 'deep-architecture',
    title: 'Master TypeScript & Deep Modules',
    category: 'Skill Building',
    description: 'Design deep module interfaces and eliminate leaky component abstractions.',
    defaultObjective: 'Refactor core service boundaries and write contract tests',
  },
  {
    id: 'deep-work-habit',
    title: 'Establish 2-Hour Daily Deep Work Habit',
    category: 'Focus Practice',
    description: 'Protect mornings for strategic coding without tab-switching or distractions.',
    defaultObjective: 'Complete two uninterrupted 45-minute Focus sprints every weekday',
  },
]

export interface BreakdownObjectiveOption {
  id: string
  text: string
  isActionable: boolean
  explanation: string
}

export interface SimulatedTaskState {
  title: string
  durationMinutes: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export type SimulatedGuardianMode = 'LIGHT' | 'STANDARD' | 'STRICT'

export interface InteractiveTutorialState {
  currentStage: number
  selectedGoal: string
  customGoalText: string
  selectedObjective: string
  simulatedTask: SimulatedTaskState
  scheduledDay: string
  scheduledTimeSlot: string
  guardianMode: SimulatedGuardianMode
  guardianSamplePolicy: 'BLOCKED' | 'ALLOWED' | 'OFF'
  timerDemoState: 'IDLE' | 'RUNNING' | 'PAUSED' | 'FINISHED'
  timerRemainingSeconds: number
  saveGoalToWorkspace: boolean
}

export function isInteractiveTutorialEnabled(): boolean {
  try {
    const setting = localStorage.getItem('shinpo_interactive_tutorial_enabled')
    if (setting !== null) return setting !== 'false'
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_INTERACTIVE_TUTORIAL !== undefined) {
      return import.meta.env.VITE_INTERACTIVE_TUTORIAL !== 'false'
    }
  } catch {
    // Defaults to enabled
  }
  return true
}

