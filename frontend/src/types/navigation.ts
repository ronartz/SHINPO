export type AppView =
  | 'Dashboard'
  | 'Goals & Missions'
  | 'Focus Engine'
  | 'Schedule'
  | 'Analytics'
  | 'Task Manager'
  | 'AI Assistant'

export type IconName =
  | 'dashboard'
  | 'quests'
  | 'schedule'
  | 'calendar'
  | 'goals'
  | 'focus'
  | 'analytics'
  | 'apps'
  | 'journal'
  | 'rewards'
  | 'settings'
  | 'search'
  | 'bell'
  | 'moon'
  | 'sun'
  | 'chevron'
  | 'chevron-left'
  | 'chevron-right'
  | 'menu'
  | 'play'
  | 'pause'
  | 'check'
  | 'check-circle'
  | 'plus'
  | 'target'
  | 'clock'
  | 'xp'
  | 'close'
  | 'sparkle'
  | 'refresh'
  | 'arrow-up-right'
  | 'power'
  | 'trash'
  | 'edit'
  | 'zap'
  | 'shield'
  | 'shield-check'
  | 'lock'
  | 'eye'
  | 'eye-off'


export interface NavItemConfig {
  id: AppView
  icon: IconName
  label: string
  tut: string
  hasBadge?: boolean
}

export const NAVIGATION_ITEMS: readonly NavItemConfig[] = [
  { id: 'Dashboard', icon: 'dashboard', label: 'Dashboard', tut: 'nav-dashboard' },
  { id: 'Goals & Missions', icon: 'goals', label: 'Goals & Tasks', tut: 'nav-goals' },
  { id: 'Focus Engine', icon: 'focus', label: 'Focus Sprints', tut: 'nav-focus' },
  { id: 'Schedule', icon: 'schedule', label: 'Calendar', tut: 'nav-schedule', hasBadge: true },
  { id: 'Task Manager', icon: 'shield', label: 'Focus Protection', tut: 'nav-tasks' },
  { id: 'Analytics', icon: 'analytics', label: 'Analytics', tut: 'nav-analytics' },
  { id: 'AI Assistant', icon: 'sparkle', label: 'EONPAI Guide', tut: 'nav-ai' },
] as const

export function getViewHeaderTitle(view: AppView): string {
  switch (view) {
    case 'AI Assistant':
      return 'EONPAI Cognitive Guide'
    case 'Focus Engine':
      return 'Focus Sprint Arena'
    case 'Goals & Missions':
      return 'Goals & Tasks'
    case 'Schedule':
      return 'Calendar Schedule'
    case 'Task Manager':
      return 'Focus Protection Sentinel'
    case 'Analytics':
      return 'Performance Analytics'
    case 'Dashboard':
      return 'Execution Cockpit'
    default:
      return view
  }
}

declare global {
  interface Window {
    __SHINPO_START_TUTORIAL__?: (initialStepIndex?: number) => void
    __SHINPO_NAVIGATE_TAB__?: (tab: AppView) => void
  }
}


